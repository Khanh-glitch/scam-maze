// Unit tests for rule-driven ending selection and consequence variants
// (spec chapter-01-double-deception, task 3.4). States are crafted from the fixture scenario.

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO, fixtureState, withFlags } from "../../test/fixtureScenario";
import type { DecisionId, DeductionId, FlagId } from "./chapter1/ids";
import { selectConsequenceVariant, selectOutcome } from "./outcome";
import type { ChapterState, EndingDef, ScenarioDefinition } from "./types";

const S = FIXTURE_SCENARIO;

function crafted(
  decision: DecisionId | null,
  flags: FlagId[] = [],
  deductions: DeductionId[] = [],
): ChapterState {
  return { ...withFlags(fixtureState({ decision }), flags), deductions };
}

const BOTH: DeductionId[] = ["ded.same-source", "ded.notification-mismatch"];

describe("selectOutcome", () => {
  it("returns null without a decision, even with a risky flag", () => {
    expect(selectOutcome(crafted(null), S)).toBeNull();
    expect(selectOutcome(crafted(null, ["money_moved"]), S)).toBeNull();
  });

  it("selects the first ending whose rules hold, by ascending order", () => {
    expect(selectOutcome(crafted("follow-recovery", ["money_moved"]), S)).toBe("false-victory");
    expect(selectOutcome(crafted("verify-independently", ["official_channel_verified"], BOTH), S)).toBe(
      "perfect-chain",
    );
    expect(selectOutcome(crafted("refuse-and-stop"), S)).toBe("break-the-chain");
  });

  it("prefers the lower order when several endings match", () => {
    const state = crafted("verify-independently", ["official_channel_verified", "money_moved"], BOTH);
    expect(selectOutcome(state, S)).toBe("false-victory");
  });

  it("falls back to the last unconditional ending, so the result is total", () => {
    expect(selectOutcome(crafted("verify-independently"), S)).toBe("unfinished-case");
    expect(selectOutcome(crafted("refuse-and-stop", ["code_shared"]), S)).toBe("unfinished-case");
    expect(selectOutcome(crafted("verify-independently", ["official_channel_verified"], ["ded.same-source"]), S)).toBe(
      "unfinished-case",
    );
  });

  it("follows the data: changing `order` changes the result", () => {
    const swapped = {
      ...S,
      endings: {
        ...S.endings,
        "false-victory": { ...S.endings["false-victory"], order: 10 },
        "unfinished-case": { ...S.endings["unfinished-case"], order: 0 },
      },
    } as ScenarioDefinition;
    expect(selectOutcome(crafted("follow-recovery", ["money_moved"]), swapped)).toBe("unfinished-case");
  });

  it("is deterministic and does not mutate the state", () => {
    const state = crafted("follow-recovery", ["money_moved"]);
    const snapshot = JSON.stringify(state);
    expect(selectOutcome(state, S)).toBe(selectOutcome(state, S));
    expect(JSON.stringify(state)).toBe(snapshot);
  });

  it("returns null only when no ending matches (broken data)", () => {
    const noFallback = {
      ...S,
      endings: { "false-victory": S.endings["false-victory"] },
    } as unknown as ScenarioDefinition;
    expect(selectOutcome(crafted("refuse-and-stop"), noFallback)).toBeNull();
  });
});

describe("selectConsequenceVariant", () => {
  const withVariants = (ending: EndingDef): ScenarioDefinition => ({
    ...S,
    endings: { ...S.endings, "false-victory": ending },
  });

  it("returns null without an outcome or without an ending", () => {
    expect(selectConsequenceVariant(crafted("refuse-and-stop"), S)).toBeNull();
    expect(selectConsequenceVariant(crafted("refuse-and-stop"), S, null)).toBeNull();
    const missing = { ...S, endings: {} } as unknown as ScenarioDefinition;
    expect(selectConsequenceVariant(crafted("refuse-and-stop"), missing, "false-victory")).toBeNull();
  });

  it("uses the outcome argument, defaulting to state.outcome", () => {
    const state: ChapterState = { ...crafted("refuse-and-stop"), outcome: "break-the-chain" };
    expect(selectConsequenceVariant(state, S)?.id).toBe("break-the-chain.default");
    expect(selectConsequenceVariant(state, S, "unfinished-case")?.id).toBe("unfinished-case.default");
  });

  it("returns the first variant whose conditions hold", () => {
    const base = S.endings["false-victory"];
    const scenario = withVariants({
      ...base,
      variants: [
        { id: "case-report", when: [{ kind: "flag", flag: "official_channel_verified" }], text: "Reported." },
        { id: "contained-late", when: [{ kind: "flag", flag: "code_shared" }], text: "Late." },
        { id: "default", when: [], text: "Default." },
      ],
    });
    const state = (flags: FlagId[]): ChapterState => crafted("follow-recovery", flags);
    expect(selectConsequenceVariant(state(["official_channel_verified", "code_shared"]), scenario, "false-victory")?.id).toBe(
      "case-report",
    );
    expect(selectConsequenceVariant(state(["code_shared"]), scenario, "false-victory")?.id).toBe("contained-late");
    expect(selectConsequenceVariant(state([]), scenario, "false-victory")?.id).toBe("default");
  });

  it("returns null when no variant matches", () => {
    const scenario = withVariants({
      ...S.endings["false-victory"],
      variants: [{ id: "only", when: [{ kind: "flag", flag: "official_channel_verified" }], text: "Reported." }],
    });
    expect(selectConsequenceVariant(crafted("follow-recovery"), scenario, "false-victory")).toBeNull();
  });
});
