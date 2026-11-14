import { describe, expect, it } from "vitest";
import { CHAPTER_1_DEDUCTIONS } from "./deductions";
import { DEDUCTION_IDS, EVIDENCE_IDS } from "./ids";
import type { EvidenceId, SourceId } from "./ids";
import { CHAPTER_1_SOURCES } from "./sources";

// Evidence to source, from the design evidence table. E05 (shared case ID) is compared across
// `src.notification` and `src.call-alex`, and E07 can come from the call or the voicemail, so
// each evidence item lists every source it may come from.
const EVIDENCE_SOURCES: Partial<Record<EvidenceId, SourceId[]>> = {
  "ev.alex-statement": ["src.call-alex", "src.voicemail-alex"],
  "ev.notification-metadata": ["src.notification"],
  "ev.shared-case-id": ["src.notification", "src.call-alex"],
  "ev.official-contact-paper": ["src.statement-paper"],
  "ev.official-contact-app": ["src.saved-app"],
  "ev.note-app-origin": ["src.note"],
  "ev.recovery-statement": ["src.call-recovery"],
};

function identifier(source: SourceId, key: string): string | undefined {
  return CHAPTER_1_SOURCES[source].identifiers.find((i) => i.key === key)?.value;
}

/** Every combination of one source per input evidence item, for one evidence set. */
function sourceCombinations(set: EvidenceId[]): SourceId[][] {
  return set.reduce<SourceId[][]>(
    (acc, id) => acc.flatMap((prefix) => (EVIDENCE_SOURCES[id] ?? []).map((s) => [...prefix, s])),
    [[]],
  );
}

describe("chapter 1 deduction data", () => {
  it("defines every deduction ID with a matching id", () => {
    for (const id of DEDUCTION_IDS) expect(CHAPTER_1_DEDUCTIONS[id].id).toBe(id);
  });

  it("uses known evidence IDs and 2 or 3 inputs", () => {
    for (const d of Object.values(CHAPTER_1_DEDUCTIONS)) {
      const all = [...d.inputs, ...(d.inputsAnyOf ?? [])];
      for (const id of all) expect(EVIDENCE_IDS).toContain(id);
      expect(d.inputs.length + (d.inputsAnyOf ? 1 : 0)).toBeGreaterThanOrEqual(2);
      expect(d.inputs.length + (d.inputsAnyOf ? 1 : 0)).toBeLessThanOrEqual(3);
    }
  });

  it("has a basis that holds against the source identifiers for every input set", () => {
    for (const d of Object.values(CHAPTER_1_DEDUCTIONS)) {
      const sets = d.inputsAnyOf ? d.inputsAnyOf.map((any) => [...d.inputs, any]) : [d.inputs];
      for (const set of sets) {
        const combos = sourceCombinations(set);
        expect(combos.length).toBeGreaterThan(0);
        for (const combo of combos) {
          const values = combo.map((s) => identifier(s, d.basis.key));
          if (d.basis.kind === "shared-identifier") {
            expect(values.every((v) => v !== undefined)).toBe(true);
            expect(new Set(values).size).toBe(1);
          } else {
            const present = values.filter((v): v is string => v !== undefined);
            expect(new Set(present).size).toBeGreaterThanOrEqual(2);
          }
        }
      }
    }
  });

  it("sets claims only to inconclusive and adds no pressure", () => {
    for (const d of Object.values(CHAPTER_1_DEDUCTIONS)) {
      for (const effect of d.effects) {
        expect(effect.kind === "setFlag" || effect.kind === "setClaimStatus").toBe(true);
        if (effect.kind === "setClaimStatus") expect(effect.status).toBe("inconclusive");
      }
    }
  });

  it("uses the required statement and gating", () => {
    expect(CHAPTER_1_DEDUCTIONS["ded.same-source"].statement).toBe("These claims are not independently verified.");
    expect(CHAPTER_1_DEDUCTIONS["ded.third-caller-not-independent"].requires).toEqual([
      { kind: "deductionRecorded", deductionId: "ded.same-source" },
    ]);
  });
});
