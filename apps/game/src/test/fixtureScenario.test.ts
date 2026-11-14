import { describe, expect, it } from "vitest";
import { FIXTURE_SCENARIO as S, fixtureState, withEvidence, withFlags } from "./fixtureScenario";
import {
  ACT_IDS,
  CLAIM_IDS,
  DECISION_IDS,
  EVIDENCE_IDS,
  FLAG_IDS,
  OBJECTIVE_IDS,
} from "../game/narrative/chapter1/ids";
import type { Condition, Effect } from "../game/narrative/types";

function conditionsOf(): Condition[] {
  const out: Condition[] = [];
  for (const o of Object.values(S.objectives)) out.push(...o.activateWhen, ...o.completeWhen);
  for (const c of Object.values(S.calls)) out.push(...c.ringWhen.flat());
  for (const d of Object.values(S.decisions)) out.push(...d.requires, ...(d.preStep?.requires ?? []));
  for (const e of Object.values(S.endings)) out.push(...e.selectWhen);
  for (const a of S.acts) out.push(...a.enterWhen, ...a.exitWhen);
  for (const d of Object.values(S.deductions)) out.push(...d.requires);
  for (const d of Object.values(S.deviceActions)) out.push(...d.requires);
  for (const b of S.beats) out.push(...b.when);
  return out;
}

function effectsOf(): Effect[] {
  const out: Effect[] = [];
  for (const d of Object.values(S.deductions)) out.push(...d.effects);
  for (const d of Object.values(S.deviceActions)) out.push(...d.effects);
  for (const d of Object.values(S.decisions)) out.push(...(d.effects ?? []));
  for (const b of S.beats) out.push(...b.effects);
  for (const g of Object.values(S.dialogues)) {
    for (const n of Object.values(g.nodes)) {
      out.push(...(n.onEnter ?? []));
      for (const opt of n.options) out.push(...(opt.effects ?? []));
    }
  }
  return out;
}

describe("fixture scenario structure", () => {
  it("has the expected number of items per mechanism", () => {
    expect(Object.keys(S.calls).filter((id) => S.calls[id as keyof typeof S.calls].ringWhen.length > 0)).toHaveLength(2);
    expect(Object.keys(S.deviceActions)).toHaveLength(2);
    expect(S.beats).toHaveLength(1);
    expect(Object.keys(S.evidence)).toHaveLength(5);
    expect(new Set(Object.values(S.evidence).map((e) => e.sourceId)).size).toBe(3);
    expect(Object.keys(S.deductions)).toHaveLength(2);
    expect(Object.keys(S.decisions)).toHaveLength(3);
    expect(Object.keys(S.endings)).toHaveLength(4);
    expect(Object.values(S.dialogues).filter((g) => g.independentChannel)).toHaveLength(1);
    expect(Object.keys(S.objectives)).toHaveLength(OBJECTIVE_IDS.length);
    expect(S.acts.map((a) => a.id)).toEqual([...ACT_IDS]);
  });

  it("resolves every reference to a defined item", () => {
    const evidenceIds = new Set(Object.keys(S.evidence));
    const sourceIds = new Set(Object.keys(S.sources));
    for (const e of Object.values(S.evidence)) expect(sourceIds.has(e.sourceId)).toBe(true);
    for (const e of Object.values(S.evidence)) {
      for (const r of e.relations) expect(CLAIM_IDS).toContain(r.claimId);
      if (e.discovery.via === "device") expect(S.deviceActions[e.discovery.deviceActionId]).toBeDefined();
      if (e.discovery.via === "interact") expect(S.interactables[e.discovery.objectId]).toBeDefined();
      if (e.discovery.via === "dialogue-node") {
        const nodeId = e.discovery.nodeId;
        expect(Object.values(S.dialogues).some((g) => nodeId in g.nodes)).toBe(true);
      }
    }
    for (const d of Object.values(S.deductions)) {
      for (const id of [...d.inputs, ...(d.inputsAnyOf ?? [])]) expect(evidenceIds.has(id)).toBe(true);
    }
    for (const a of Object.values(S.deviceActions)) {
      for (const id of a.reveals) expect(evidenceIds.has(id)).toBe(true);
    }
    for (const c of Object.values(S.calls)) expect(S.dialogues[c.graphId]).toBeDefined();
    for (const g of Object.values(S.dialogues)) {
      expect(g.nodes[g.startNodeId]).toBeDefined();
      for (const n of Object.values(g.nodes)) {
        expect(g.lines[n.lineId]).toBeDefined();
        for (const o of n.options) {
          expect(g.lines[o.lineId]).toBeDefined();
          if (typeof o.next === "string") expect(g.nodes[o.next]).toBeDefined();
        }
      }
    }
    for (const a of S.acts) for (const id of a.objectives) expect(S.objectives[id]).toBeDefined();
    for (const note of S.journalNotes) for (const id of note.requires) expect(evidenceIds.has(id)).toBe(true);
    for (const id of Object.keys(S.decisions)) expect(DECISION_IDS).toContain(id);
    for (const id of Object.keys(S.evidence)) expect(EVIDENCE_IDS).toContain(id);
  });

  it("references only defined ids inside conditions and effects", () => {
    for (const c of conditionsOf()) {
      switch (c.kind) {
        case "hasEvidence":
          expect(S.evidence[c.evidenceId]).toBeDefined();
          break;
        case "hasAnyEvidence":
          for (const id of c.evidenceIds) expect(S.evidence[id]).toBeDefined();
          break;
        case "flag":
        case "notFlag":
          expect(FLAG_IDS).toContain(c.flag);
          break;
        case "callEnded":
        case "callRang":
        case "callClosed":
          expect(S.calls[c.callId]).toBeDefined();
          break;
        case "deductionRecorded":
          expect(S.deductions[c.deductionId]).toBeDefined();
          break;
        case "decisionIs":
          expect(S.decisions[c.decision]).toBeDefined();
          break;
        case "objectiveCompleted":
          expect(S.objectives[c.objectiveId]).toBeDefined();
          break;
        default:
          break;
      }
    }
    for (const e of effectsOf()) {
      if (e.kind === "setFlag") expect(FLAG_IDS).toContain(e.flag);
      if (e.kind === "discoverEvidence") expect(S.evidence[e.evidenceId]).toBeDefined();
    }
  });

  it("has exactly one ending selected without conditions and unique orders", () => {
    const endings = Object.values(S.endings);
    expect(endings.filter((e) => e.selectWhen.length === 0)).toHaveLength(1);
    expect(new Set(endings.map((e) => e.order)).size).toBe(4);
  });

  it("has a chain of act conditions where each exit equals the next enter", () => {
    for (let i = 0; i < S.acts.length - 1; i += 1) {
      expect(S.acts[i].exitWhen).toEqual(S.acts[i + 1].enterWhen);
    }
  });

  it("uses only fictional data and no safety wording", () => {
    const text = JSON.stringify(S);
    expect(text).not.toMatch(/\bsafe\b/i);
    expect(text).not.toMatch(/https?:\/\//i);
    for (const call of Object.values(S.calls)) expect(call.number.startsWith("+000")).toBe(true);
    for (const m of text.matchAll(/[a-z0-9-]+\.(?:[a-z]+)\b/gi)) {
      const word = m[0].toLowerCase();
      if (/^(alex|rec|off|obj|ev|ded|dev|src|ws|dlg|call|act|beat|note|screen)\./.test(word)) continue;
      if (/\.(invalid|example|test)$/.test(word)) continue;
      // Remaining dotted words must be sentence ends or ids, not domains.
      expect(word).not.toMatch(/\.(com|net|org|io|vn)$/);
    }
  });
});

describe("fixture builders", () => {
  it("fixtureState returns a playing state with all claims unverified", () => {
    const s = fixtureState();
    expect(s.status).toBe("playing");
    expect(Object.values(s.claims).every((c) => c === "unverified")).toBe(true);
  });

  it("withFlags and withEvidence return new states without mutating the input", () => {
    const base = fixtureState();
    const flagged = withFlags(base, ["code_shared"]);
    expect(flagged.flags.code_shared).toBe(true);
    expect(base.flags.code_shared).toBe(false);
    const found = withEvidence(withEvidence(base, ["ev.alex-statement"]), ["ev.alex-statement", "ev.shared-case-id"]);
    expect(found.discovered).toEqual(["ev.alex-statement", "ev.shared-case-id"]);
    expect(base.discovered).toEqual([]);
  });

  it("fixtureState applies overrides", () => {
    expect(fixtureState({ pressure: 2 }).pressure).toBe(2);
  });
});
