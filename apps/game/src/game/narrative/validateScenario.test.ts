// Tests for the scenario validator (Requirements 3.6, 3.7, 8.9, 9.8, 9.9, 9.10, 11.4, 12.6, 18.1).
// The fixture scenario (`src/test/fixtureScenario.ts`) must pass every check. Each broken scenario
// is a deep clone of the fixture with one targeted break, so it shows the check that catches it.
// Shipped Chapter 1 data is checked when it is assembled (task 7.3), not here.

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO } from "../../test/fixtureScenario";
import type { Condition, DialogueNode, ScenarioDefinition } from "./types";
import {
  FALLBACK_OPTION_ID,
  validateScenario,
  validateScenarioIssues,
  type ScenarioIssue,
  type ValidatorCheck,
} from "./validateScenario";

/** Deep clone of the fixture. Scenario_Data is plain JSON-compatible data. */
function cloneScenario(): ScenarioDefinition {
  return JSON.parse(JSON.stringify(FIXTURE_SCENARIO)) as ScenarioDefinition;
}

function issuesFor(s: ScenarioDefinition, check: ValidatorCheck): ScenarioIssue[] {
  return validateScenarioIssues(s).filter((issue) => issue.check === check);
}

/** True when some issue of `check` has a message that includes `text`. */
function hasIssue(s: ScenarioDefinition, check: ValidatorCheck, text: string): boolean {
  return issuesFor(s, check).some((issue) => issue.message.includes(text));
}

/** A spoken caller node that does nothing special; tests override single fields. */
function spokenNode(id: string, optionId: string, next: string): DialogueNode {
  return {
    id,
    speaker: "caller",
    speakerId: "spk.alex",
    tone: "professional",
    lineId: "alex.open",
    options: [{ id: optionId, lineId: "alex.refuse", next }],
  };
}

describe("validateScenario", () => {
  it("returns no errors for the fixture scenario", () => {
    expect(validateScenario(FIXTURE_SCENARIO)).toEqual([]);
    expect(validateScenarioIssues(FIXTURE_SCENARIO)).toEqual([]);
  });

  it("does not modify the scenario it checks", () => {
    const before = JSON.stringify(FIXTURE_SCENARIO);
    validateScenario(FIXTURE_SCENARIO);
    expect(JSON.stringify(FIXTURE_SCENARIO)).toBe(before);
  });

  it("rejects a root that is not an object instead of calling it valid", () => {
    for (const junk of [null, undefined, [], "x", 42, true]) {
      const issues = validateScenarioIssues(junk as unknown as ScenarioDefinition);
      expect(issues, String(junk)).toHaveLength(1);
      expect(issues[0].check).toBe("V1");
      expect(issues[0].message).toMatch(/^Scenario must be an object, got /);
    }
  });

  it("rejects a scenario without the collections it needs to be played", () => {
    const messages = validateScenario({} as ScenarioDefinition);
    for (const key of ["objectives", "dialogues", "decisions", "endings", "acts"]) {
      expect(messages).toContain(`Scenario has no ${key}; it needs at least one.`);
    }
    const s = cloneScenario();
    (s as { dialogues: unknown }).dialogues = {};
    expect(validateScenario(s)).toContain("Scenario has no dialogues; it needs at least one.");
  });

  it("reports an option that points to a missing node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options[0].next = "alex.missing";
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.alex" option "alex.share-code" points to unknown node "alex.missing".',
    );
  });

  it("reports a missing start node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].startNodeId = "alex.nowhere";
    expect(validateScenario(s)).toContain('Dialogue graph "dlg.alex" start node "alex.nowhere" does not exist.');
  });

  it("reports a missing conditional start node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].startNodeWhen = [{ when: [], nodeId: "alex.nowhere" }];
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.alex" conditional start node "alex.nowhere" does not exist.',
    );
  });

  it("reports nodes that cannot reach an end node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.loop"] = spokenNode("alex.loop", "alex.loop.again", "alex.loop");
    expect(validateScenario(s)).toEqual(['Dialogue graph "dlg.alex" node "alex.loop" cannot reach an end node.']);
  });

  it("reports unknown line IDs on nodes and options", () => {
    const s = cloneScenario();
    const node = s.dialogues["dlg.alex"].nodes["alex.open"];
    node.lineId = "alex.unapproved";
    node.options[1].lineId = "alex.opt.unapproved";
    const errors = validateScenario(s);
    expect(errors).toContain('Dialogue graph "dlg.alex" node "alex.open" uses unknown line "alex.unapproved".');
    expect(errors).toContain('Dialogue graph "dlg.alex" option "alex.refuse" uses unknown line "alex.opt.unapproved".');
  });

  it("reports unknown evidence, claim and object references", () => {
    const s = cloneScenario();
    s.interactables["obj.receipts"].reveals = ["ev.missing" as never];
    s.evidence["ev.account-activity"].relations[0].claimId = "claim.missing" as never;
    (s.npcs as Record<string, unknown>)["npc.x"] = {
      id: "npc.x",
      name: "X",
      interactableId: "obj.missing",
      graphId: "dlg.alex",
    };
    const errors = validateScenario(s);
    expect(errors).toContain('Interactable "obj.receipts" reveals unknown evidence "ev.missing".');
    expect(errors).toContain('Evidence "ev.account-activity" relates to unknown claim "claim.missing".');
    expect(errors).toContain('NPC "npc.x" uses unknown object "obj.missing".');
  });

  it("reports unknown evidence in a dialogue effect", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.refused"].onEnter = [{ kind: "discoverEvidence", evidenceId: "ev.missing" as never }];
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.alex" node "alex.refused" references unknown evidence "ev.missing".',
    );
  });

  it("reports setClaimStatus outside an independent-channel graph", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options[0].effects = [
      { kind: "setClaimStatus", claimId: "claim.alex-identity", status: "supported" },
    ];
    expect(validateScenario(s)).toEqual([
      'Dialogue graph "dlg.alex" option "alex.share-code" sets claim "claim.alex-identity" status outside an independent-channel graph.',
    ]);
  });

  it("accepts setClaimStatus in the independent-channel graph", () => {
    expect(validateScenarioIssues(FIXTURE_SCENARIO)).toEqual([]);
    expect(FIXTURE_SCENARIO.dialogues["dlg.official-line"].independentChannel).toBe(true);
  });

  it("reports a debrief tag that has no decision note text", () => {
    const s = cloneScenario();
    s.debrief.decisionNotes["refused-code"] = "   ";
    expect(validateScenario(s)).toContain(
      'Dialogue graph "dlg.alex" option "alex.refuse" uses debrief tag "refused-code" with no decision note text.',
    );
  });

  it("reports duplicate option IDs across graphs", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options[1].id = "alex.share-code";
    expect(validateScenario(s)).toContain(
      'Duplicate option ID "alex.share-code" (in node "alex.open" of "dlg.alex" and node "alex.open" of "dlg.alex").',
    );
  });

  it("reports the reserved fallback option ID", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options[0].id = FALLBACK_OPTION_ID;
    expect(validateScenario(s)).toContain(
      `Dialogue graph "dlg.alex" option "${FALLBACK_OPTION_ID}" uses the reserved fallback option ID.`,
    );
  });

  it("reports duplicate IDs in arrays and record keys that do not match the item ID", () => {
    const s = cloneScenario();
    s.phone.bankApp.screens.push({ ...s.phone.bankApp.screens[0] });
    s.evidence["ev.account-activity"].id = "ev.notification-metadata";
    const errors = validateScenario(s);
    expect(errors).toContain(`Duplicate bank app screen ID "${s.phone.bankApp.screens[0].id}".`);
    expect(errors).toContain(
      'The evidence stored under key "ev.account-activity" has id "ev.notification-metadata".',
    );
  });

  it("reports an end node that still has options", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.refused"].options = [{ id: "alex.extra", lineId: "alex.refuse", next: "alex.open" }];
    expect(validateScenario(s)).toContain('Dialogue graph "dlg.alex" node "alex.refused" is an end node but has options.');
  });
});

// ---------------------------------------------------------------------------
// V1 references and voice fields
// ---------------------------------------------------------------------------

describe("validateScenarioIssues: V1 references and voice fields", () => {
  it("reports a node ID used in two graphs", () => {
    const s = cloneScenario();
    s.dialogues["dlg.recovery"].nodes["alex.open"] = JSON.parse(
      JSON.stringify(s.dialogues["dlg.alex"].nodes["alex.open"]),
    ) as DialogueNode;
    expect(hasIssue(s, "V1", 'Duplicate dialogue node ID "alex.open"')).toBe(true);
  });

  it("reports a Spoken_Node with no tone", () => {
    const s = cloneScenario();
    delete s.dialogues["dlg.alex"].nodes["alex.open"].tone;
    expect(issuesFor(s, "V1").some((i) => i.where.includes('node "alex.open"') && i.message.includes("no tone"))).toBe(true);
  });

  it("reports a Spoken_Node with an unknown tone", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].tone = "sleepy" as never;
    expect(hasIssue(s, "V1", 'unknown tone "sleepy"')).toBe(true);
  });

  it("reports an unknown speaker ID on a node", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].speakerId = "spk.nobody" as never;
    expect(hasIssue(s, "V1", 'unknown speaker "spk.nobody"')).toBe(true);
  });

  it("reports a Spoken_Node with no speaker at all", () => {
    const s = cloneScenario();
    const graph = s.dialogues["dlg.alex"];
    delete graph.nodes["alex.open"].speakerId;
    delete (graph.persona as { speakerId?: string }).speakerId;
    expect(
      issuesFor(s, "V1").some((i) => i.where.includes('node "alex.open"') && i.message.includes("no known speaker")),
    ).toBe(true);
  });

  it.each([-1, 3001, Number.NaN])("reports pauseBeforeMs %s outside 0 to 3000", (pause) => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].pauseBeforeMs = pause;
    expect(
      issuesFor(s, "V1").some((i) => i.where.includes('node "alex.open"') && i.message.includes("pauseBeforeMs")),
    ).toBe(true);
  });

  it.each([0, 3000])("accepts pauseBeforeMs %s", (pause) => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].pauseBeforeMs = pause;
    expect(validateScenarioIssues(s)).toEqual([]);
  });

  it("reports an act that references an unknown objective", () => {
    const s = cloneScenario();
    s.acts[0].objectives = [...s.acts[0].objectives, "obj.missing" as never];
    expect(
      issuesFor(s, "V1").some((i) => i.where === `Act "${s.acts[0].id}"` && i.message.includes('"obj.missing"')),
    ).toBe(true);
  });

  it("reports an act whose exit conditions differ from the next act's enter conditions", () => {
    const s = cloneScenario();
    s.acts[0].exitWhen = [{ kind: "flag", flag: "code_shared" }];
    expect(
      issuesFor(s, "V1").some((i) => i.where === `Act "${s.acts[0].id}"` && i.message.includes("exit conditions differ")),
    ).toBe(true);
  });

  it("reports an objective that belongs to two acts", () => {
    const s = cloneScenario();
    const shared = s.acts[0].objectives[0];
    s.acts[1].objectives = [...s.acts[1].objectives, shared];
    expect(issuesFor(s, "V1").some((i) => i.where === `Objective "${shared}"` && i.message.includes("2 acts"))).toBe(true);
  });

  it("reports an objective that belongs to no act", () => {
    const s = cloneScenario();
    const dropped = s.acts[0].objectives[0];
    s.acts[0].objectives = s.acts[0].objectives.filter((id) => id !== dropped);
    expect(issuesFor(s, "V1").some((i) => i.where === `Objective "${dropped}"` && i.message.includes("0 acts"))).toBe(true);
  });
});

// ---------------------------------------------------------------------------
// V3 termination and shape
// ---------------------------------------------------------------------------

describe("validateScenarioIssues: V3 termination and shape", () => {
  it("reports a node with more than four unconditional options", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options = [1, 2, 3, 4, 5].map((n) => ({
      id: `opt.test.many.${n}`,
      lineId: "alex.refuse",
      next: "alex.refused",
    }));
    const issues = issuesFor(s, "V3");
    expect(issues).toHaveLength(1);
    expect(issues[0].where).toContain('node "alex.open"');
    expect(issues[0].message).toContain("5 unconditional options");
  });

  it("does not count conditional options toward the limit of four", () => {
    const s = cloneScenario();
    s.dialogues["dlg.alex"].nodes["alex.open"].options = [1, 2, 3, 4, 5].map((n) => ({
      id: `opt.test.cond.${n}`,
      lineId: "alex.refuse",
      conditions: n > 4 ? [{ kind: "notFlag", flag: "code_shared" } as Condition] : [],
      next: "alex.refused",
    }));
    expect(issuesFor(s, "V3")).toEqual([]);
  });

  it("reports a pressure node that needs more than three option steps to reach an end", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.alex"].nodes;
    nodes["test.p0"] = { ...spokenNode("test.p0", "opt.test.p0", "test.c1"), pressure: true };
    nodes["test.c1"] = spokenNode("test.c1", "opt.test.c1", "test.c2");
    nodes["test.c2"] = spokenNode("test.c2", "opt.test.c2", "test.c3");
    nodes["test.c3"] = spokenNode("test.c3", "opt.test.c3", "alex.refused");
    const issues = issuesFor(s, "V3");
    expect(issues).toHaveLength(1);
    expect(issues[0].where).toContain('node "test.p0"');
    expect(issues[0].message).toContain("4 option steps");
  });

  it("accepts a pressure node that reaches an end in three option steps", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.alex"].nodes;
    nodes["test.p0"] = { ...spokenNode("test.p0", "opt.test.p0", "test.c1"), pressure: true };
    nodes["test.c1"] = spokenNode("test.c1", "opt.test.c1", "test.c2");
    nodes["test.c2"] = spokenNode("test.c2", "opt.test.c2", "alex.refused");
    expect(issuesFor(s, "V3")).toEqual([]);
  });

  it("reports every node of a cycle that has no exit", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.alex"].nodes;
    nodes["test.a"] = spokenNode("test.a", "opt.test.a", "test.b");
    nodes["test.b"] = spokenNode("test.b", "opt.test.b", "test.a");
    expect(issuesFor(s, "V3").map((i) => i.where).sort()).toEqual([
      'Dialogue graph "dlg.alex" node "test.a"',
      'Dialogue graph "dlg.alex" node "test.b"',
    ]);
  });
});

// ---------------------------------------------------------------------------
// V4 impossible conditions
// ---------------------------------------------------------------------------

describe("validateScenarioIssues: V4 impossible conditions", () => {
  function conditionOnFirstOption(s: ScenarioDefinition, condition: Condition): void {
    s.dialogues["dlg.alex"].nodes["alex.open"].options[0].conditions = [condition];
  }

  it("reports a flag that no effect sets", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, { kind: "flag", flag: "bank_app_opened" });
    expect(hasIssue(s, "V4", 'flag "bank_app_opened"')).toBe(true);
  });

  it("accepts a flag that a beat, a device action or a deduction sets", () => {
    const s = cloneScenario();
    for (const flag of ["notification_delivered", "notification_origin_inspected", "shared_origin_established"] as const) {
      conditionOnFirstOption(s, { kind: "flag", flag });
      expect(issuesFor(s, "V4"), flag).toEqual([]);
    }
  });

  it("reports evidence that has no way to be discovered", () => {
    const s = cloneScenario();
    (s.evidence as Record<string, unknown>)["ev.orphan"] = {
      ...JSON.parse(JSON.stringify(s.evidence["ev.account-activity"])),
      id: "ev.orphan",
      discovery: { via: "interact", objectId: "obj.missing" },
    };
    conditionOnFirstOption(s, { kind: "hasEvidence", evidenceId: "ev.orphan" as never });
    expect(hasIssue(s, "V4", 'evidence "ev.orphan"')).toBe(true);
  });

  it("reports a claim status that nothing produces", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, { kind: "claimStatus", claimId: "claim.alex-identity", status: "supported" });
    expect(hasIssue(s, "V4", 'claim "claim.alex-identity" status "supported"')).toBe(true);
  });

  it.each(["callEnded", "callRang", "callClosed"] as const)("reports %s for a call without a dialogue graph", (kind) => {
    const s = cloneScenario();
    (s.calls as Record<string, unknown>)["call.nograph"] = {
      ...JSON.parse(JSON.stringify(s.calls["call.alex"])),
      id: "call.nograph",
      graphId: "dlg.missing",
    };
    conditionOnFirstOption(s, { kind, callId: "call.nograph" as never });
    expect(hasIssue(s, "V4", `${kind} for call "call.nograph"`)).toBe(true);
  });

  it("reports evidenceCountAtLeast with a count above the listed items", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, {
      kind: "evidenceCountAtLeast",
      evidenceIds: ["ev.account-activity", "ev.alex-statement"],
      count: 3,
    });
    expect(hasIssue(s, "V4", "needs 3 evidence items but lists only 2")).toBe(true);
  });

  it("accepts evidenceCountAtLeast at the boundary of the listed items", () => {
    const s = cloneScenario();
    conditionOnFirstOption(s, {
      kind: "evidenceCountAtLeast",
      evidenceIds: ["ev.account-activity", "ev.alex-statement"],
      count: 2,
    });
    expect(issuesFor(s, "V4")).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Double-deception rules: one fault per rule (task 3.7)
// ---------------------------------------------------------------------------

describe("validateScenarioIssues: references in sources, deductions, device actions, beats and ring rules", () => {
  it("reports evidence that names an unknown source", () => {
    const s = cloneScenario();
    s.evidence["ev.account-activity"].sourceId = "src.missing" as never;
    expect(hasIssue(s, "V1", 'references unknown source "src.missing"')).toBe(true);
  });

  it("reports a source identifier with an unknown key", () => {
    const s = cloneScenario();
    s.sources["src.call-alex"].identifiers.push({ key: "mood" as never, value: "calm" });
    expect(hasIssue(s, "V1", 'unknown identifier key "mood"')).toBe(true);
  });

  it("reports a source stored under the wrong key", () => {
    const s = cloneScenario();
    s.sources["src.call-alex"].id = "src.notification";
    expect(hasIssue(s, "V1", 'The source stored under key "src.call-alex"')).toBe(true);
  });

  it("reports a deduction input that does not exist", () => {
    const s = cloneScenario();
    s.deductions["ded.same-source"].inputs = ["ev.alex-statement", "ev.missing" as never];
    expect(hasIssue(s, "V1", 'Deduction "ded.same-source" references unknown evidence "ev.missing"')).toBe(true);
  });

  it("reports a deduction that combines the wrong number of items", () => {
    const s = cloneScenario();
    s.deductions["ded.same-source"].inputs = ["ev.alex-statement"];
    expect(hasIssue(s, "V1", "combines 1 evidence items; it needs 2 or 3")).toBe(true);
  });

  it("reports a deduction condition that names an unknown deduction", () => {
    const s = cloneScenario();
    s.deductions["ded.same-source"].requires = [{ kind: "deductionRecorded", deductionId: "ded.missing" as never }];
    expect(hasIssue(s, "V1", 'unknown deduction "ded.missing"')).toBe(true);
  });

  it("reports a device action that reveals unknown evidence", () => {
    const s = cloneScenario();
    s.deviceActions["dev.inspect-notification-origin"].reveals = ["ev.missing" as never];
    expect(hasIssue(s, "V1", 'Device action "dev.inspect-notification-origin" references unknown evidence "ev.missing"')).toBe(
      true,
    );
  });

  it("reports device evidence that its action does not list in reveals", () => {
    const s = cloneScenario();
    s.deviceActions["dev.inspect-notification-origin"].reveals = [];
    expect(hasIssue(s, "V1", 'does not list it in reveals')).toBe(true);
  });

  it("reports a device action condition that names an unknown flag", () => {
    const s = cloneScenario();
    s.deviceActions["dev.review-security"].requires = [{ kind: "flag", flag: "flag_missing" as never }];
    expect(hasIssue(s, "V1", 'unknown flag "flag_missing"')).toBe(true);
  });

  it("reports a beat with an unknown condition or effect reference", () => {
    const s = cloneScenario();
    s.beats[0].when = [{ kind: "callClosed", callId: "call.missing" as never }];
    s.beats[0].effects = [{ kind: "discoverEvidence", evidenceId: "ev.missing" as never }];
    expect(hasIssue(s, "V1", 'Beat "beat.notification" references unknown call "call.missing"')).toBe(true);
    expect(hasIssue(s, "V1", 'Beat "beat.notification" references unknown evidence "ev.missing"')).toBe(true);
  });

  it("reports a ring rule that names an unknown call", () => {
    const s = cloneScenario();
    s.calls["call.recovery"].ringWhen = [[{ kind: "callRang", callId: "call.missing" as never }]];
    expect(hasIssue(s, "V1", 'references unknown call "call.missing"')).toBe(true);
  });

  it("reports an objective condition and an ending condition that name unknown items", () => {
    const s = cloneScenario();
    s.objectives["obj.decide"].completeWhen = [{ kind: "decisionIs", decision: "run-away" as never }];
    s.endings["break-the-chain"].selectWhen = [{ kind: "deductionRecorded", deductionId: "ded.missing" as never }];
    expect(hasIssue(s, "V1", 'Objective "obj.decide" completion references unknown decision "run-away"')).toBe(true);
    expect(hasIssue(s, "V1", 'Ending "break-the-chain" selection references unknown deduction "ded.missing"')).toBe(true);
  });
});

describe("validateScenarioIssues: deduction basis against source identifiers", () => {
  it("accepts both bases of the fixture deductions", () => {
    expect(issuesFor(cloneScenario(), "V1")).toEqual([]);
  });

  it("reports a shared-identifier basis when the sources carry different values", () => {
    const s = cloneScenario();
    const identifier = s.sources["src.call-alex"].identifiers.find((i) => i.key === "case");
    if (!identifier) throw new Error("fixture changed: src.call-alex has no case identifier");
    identifier.value = "NG-0000-Z";
    expect(hasIssue(s, "V1", 'Deduction "ded.same-source" claims a shared "case" identifier')).toBe(true);
  });

  it("reports a shared-identifier basis when a source has no such identifier", () => {
    const s = cloneScenario();
    s.sources["src.call-alex"].identifiers = s.sources["src.call-alex"].identifiers.filter((i) => i.key !== "case");
    expect(hasIssue(s, "V1", 'claims a shared "case" identifier')).toBe(true);
  });

  it("reports a conflicting-identifier basis when the sources carry the same value", () => {
    const s = cloneScenario();
    const identifier = s.sources["src.statement-paper"].identifiers.find((i) => i.key === "domain");
    if (!identifier) throw new Error("fixture changed: src.statement-paper has no domain identifier");
    identifier.value = "northgate-alerts.invalid";
    expect(hasIssue(s, "V1", 'Deduction "ded.notification-mismatch" claims conflicting "domain" identifiers')).toBe(true);
  });

  it("checks every inputsAnyOf member", () => {
    const s = cloneScenario();
    s.deductions["ded.notification-mismatch"].inputsAnyOf = ["ev.account-activity", "ev.alex-statement"];
    // ev.alex-statement comes from a source with no domain identifier, so that combination has no conflict.
    expect(hasIssue(s, "V1", "claims conflicting \"domain\" identifiers")).toBe(true);
  });
});

describe("validateScenarioIssues: no evidence discoverable only after a deduction that needs it", () => {
  it("reports evidence gated by a deduction that has it as an input", () => {
    const s = cloneScenario();
    s.evidence["ev.alex-statement"].discovery = {
      via: "inspect",
      requires: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
    };
    expect(hasIssue(s, "V4", 'Evidence "ev.alex-statement" can only be discovered after deduction "ded.same-source"')).toBe(
      true,
    );
  });

  it("reports the same loop through a device action", () => {
    const s = cloneScenario();
    s.deviceActions["dev.inspect-notification-origin"].requires = [
      { kind: "deductionRecorded", deductionId: "ded.notification-mismatch" },
    ];
    expect(hasIssue(s, "V4", 'Evidence "ev.notification-metadata" can only be discovered after deduction')).toBe(true);
  });

  it("accepts evidence gated by a deduction whose inputs are free", () => {
    const s = cloneScenario();
    s.evidence["ev.account-activity"].discovery = {
      via: "inspect",
      requires: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
    };
    // ded.same-source needs ev.alex-statement and ev.shared-case-id, which do not need ev.account-activity.
    s.interactables["obj.receipts"].reveals = [];
    expect(issuesFor(s, "V4")).toEqual([]);
  });
});

describe("validateScenarioIssues: setClaimStatus only in independent channels or inconclusive deductions", () => {
  it("accepts an inconclusive status in a deduction", () => {
    expect(
      FIXTURE_SCENARIO.deductions["ded.notification-mismatch"].effects.some((e) => e.kind === "setClaimStatus"),
    ).toBe(true);
    expect(validateScenarioIssues(FIXTURE_SCENARIO)).toEqual([]);
  });

  it("reports a deduction that sets a status other than inconclusive", () => {
    const s = cloneScenario();
    s.deductions["ded.notification-mismatch"].effects = [
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "contradicted" },
    ];
    expect(hasIssue(s, "V1", 'may only set "inconclusive"')).toBe(true);
  });

  it("reports a deduction that adds pressure", () => {
    const s = cloneScenario();
    s.deductions["ded.same-source"].effects = [{ kind: "addPressure" }];
    expect(hasIssue(s, "V1", "must not change pressure")).toBe(true);
  });

  it("reports setClaimStatus in a device action", () => {
    const s = cloneScenario();
    s.deviceActions["dev.review-security"].effects = [
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "inconclusive" },
    ];
    expect(hasIssue(s, "V1", 'Device action "dev.review-security" sets claim')).toBe(true);
  });

  it("reports setClaimStatus in a beat and in a decision", () => {
    const s = cloneScenario();
    s.beats[0].effects = [{ kind: "setClaimStatus", claimId: "claim.alex-identity", status: "inconclusive" }];
    s.decisions["refuse-and-stop"].effects = [
      { kind: "setClaimStatus", claimId: "claim.alex-identity", status: "inconclusive" },
    ];
    expect(hasIssue(s, "V1", 'Beat "beat.notification" sets claim')).toBe(true);
    expect(hasIssue(s, "V1", 'Decision "refuse-and-stop" sets claim')).toBe(true);
  });
});

describe("validateScenarioIssues: beats settle within the pass limit", () => {
  const CHAIN_FLAGS = [
    "first_call_answered",
    "case_id_heard",
    "alex_request_heard",
    "notification_opened",
    "notification_dismissed",
    "bank_app_opened",
    "recovery_instruction_known",
    "chain_identified",
    "notification_origin_mismatch",
    "shared_origin_established",
  ] as const;

  /** A chain where beat n waits for the flag of beat n-1, listed in reverse (worst case). */
  function withReversedChain(length: number): ScenarioDefinition {
    const s = cloneScenario();
    const chain = CHAIN_FLAGS.slice(0, length).map((flag, index) => ({
      id: `beat.chain.${index}`,
      when: index === 0 ? [{ kind: "callRang" as const, callId: "call.alex" as const }] : [{ kind: "flag" as const, flag: CHAIN_FLAGS[index - 1] }],
      effects: [{ kind: "setFlag" as const, flag }],
    }));
    s.beats = [...chain].reverse();
    return s;
  }

  it("accepts a reversed chain of exactly 8 beats", () => {
    expect(issuesFor(withReversedChain(8), "V3")).toEqual([]);
  });

  it("reports a reversed chain that needs more than 8 passes", () => {
    const s = withReversedChain(10);
    const issues = issuesFor(s, "V3").filter((i) => i.where.startsWith("Beat "));
    expect(issues.map((i) => i.where).sort()).toEqual(['Beat "beat.chain.8"', 'Beat "beat.chain.9"']);
    expect(issues.find((i) => i.where === 'Beat "beat.chain.9"')?.message).toContain("needs 10 passes");
  });

  it("accepts the same chain when it is listed in dependency order", () => {
    const s = withReversedChain(10);
    s.beats = [...s.beats].reverse();
    expect(issuesFor(s, "V3")).toEqual([]);
  });

  it("reports a duplicate beat ID", () => {
    const s = cloneScenario();
    s.beats = [...s.beats, { ...s.beats[0] }];
    expect(hasIssue(s, "V1", 'Duplicate beat ID "beat.notification"')).toBe(true);
  });
});

describe("validateScenarioIssues: no layer needs a harmful option to advance", () => {
  it("accepts a node where one harmful option sits beside harmless ones", () => {
    const options = FIXTURE_SCENARIO.dialogues["dlg.alex"].nodes["alex.open"].options;
    expect(options.some((o) => (o.effects ?? []).some((e) => e.kind === "setFlag" && e.flag === "code_shared"))).toBe(true);
    expect(issuesFor(cloneScenario(), "V3")).toEqual([]);
  });

  it("reports a node whose only ways forward are harmful", () => {
    const s = cloneScenario();
    for (const option of s.dialogues["dlg.alex"].nodes["alex.open"].options) {
      option.effects = [{ kind: "setFlag", flag: "code_shared" }];
    }
    expect(hasIssue(s, "V3", 'node "alex.open" needs a harmful option to reach an end')).toBe(true);
  });

  it("reports a node whose only route to an end passes a harmful option further on", () => {
    const s = cloneScenario();
    const nodes = s.dialogues["dlg.recovery"].nodes;
    nodes["rec.open"].options = [nodes["rec.open"].options[0]];
    expect(hasIssue(s, "V3", 'node "rec.open" needs a harmful option')).toBe(true);
  });

  it("reports a scenario where every decision is harmful", () => {
    const s = cloneScenario();
    for (const decision of Object.values(s.decisions)) decision.effects = [{ kind: "setFlag", flag: "money_moved" }];
    expect(hasIssue(s, "V3", "Every decision has a harmful effect")).toBe(true);
  });
});

describe("validateScenarioIssues: ending rules are total over decisions", () => {
  it("accepts an unconditional last ending", () => {
    expect(issuesFor(cloneScenario(), "V3")).toEqual([]);
  });

  it("reports a decision that no ending can match when none is unconditional", () => {
    const s = cloneScenario();
    s.endings["unfinished-case"].selectWhen = [{ kind: "decisionIs", decision: "refuse-and-stop" }];
    s.endings["false-victory"].selectWhen = [{ kind: "decisionIs", decision: "verify-independently" }];
    expect(hasIssue(s, "V3", 'Decision "follow-recovery" selects no ending')).toBe(true);
    expect(hasIssue(s, "V3", 'Decision "refuse-and-stop" selects no ending')).toBe(false);
  });

  it("accepts endings that cover every decision without an unconditional ending", () => {
    const s = cloneScenario();
    s.endings["unfinished-case"].selectWhen = [{ kind: "flag", flag: "code_shared" }];
    expect(issuesFor(s, "V3")).toEqual([]);
  });
});

describe("validateScenarioIssues: every ringWhen can hold", () => {
  it("reports an incoming call with no ringWhen alternative", () => {
    const s = cloneScenario();
    s.calls["call.recovery"].ringWhen = [];
    expect(hasIssue(s, "V4", 'Call "call.recovery" is incoming but has no ringWhen alternative')).toBe(true);
  });

  it("reports an incoming call whose alternatives contradict themselves", () => {
    const s = cloneScenario();
    s.calls["call.recovery"].ringWhen = [
      [{ kind: "flag", flag: "notification_handled" }, { kind: "notFlag", flag: "notification_handled" }],
    ];
    expect(hasIssue(s, "V4", "both required and forbidden")).toBe(true);
  });

  it("reports an incoming call whose alternatives need an unproducible flag", () => {
    const s = cloneScenario();
    s.calls["call.recovery"].ringWhen = [[{ kind: "flag", flag: "bank_app_opened" }]];
    expect(hasIssue(s, "V4", 'Call "call.recovery" has no ringWhen alternative that can hold')).toBe(true);
  });

  it("accepts a call when only one of its alternatives can hold", () => {
    const s = cloneScenario();
    s.calls["call.recovery"].ringWhen = [
      [{ kind: "flag", flag: "bank_app_opened" }],
      [{ kind: "flag", flag: "notification_handled" }],
    ];
    expect(hasIssue(s, "V4", "has no ringWhen alternative that can hold")).toBe(false);
  });

  it("does not require ringWhen for the outgoing official call", () => {
    expect(FIXTURE_SCENARIO.calls["call.official"].ringWhen).toEqual([]);
    expect(issuesFor(cloneScenario(), "V4")).toEqual([]);
  });
});

describe("validateScenarioIssues: objective completion", () => {
  it("reports an objective with an empty completeWhen", () => {
    const s = cloneScenario();
    s.objectives["obj.investigate"].completeWhen = [];
    expect(hasIssue(s, "V3", 'Objective "obj.investigate" has no completion conditions')).toBe(true);
  });
});
