// Unit tests for the evidence registry: every discovery route, and duplicate and unavailable
// rejection. Uses the fixture scenario and builds states directly, so the reducer is not involved.

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO, fixtureState } from "../../test/fixtureScenario";
import type { EvidenceId } from "./chapter1/ids";
import { canDiscover, discover, evidenceForClaim } from "./evidence";
import type { CallRecord, ChapterState, CoreAction } from "./types";

const S = FIXTURE_SCENARIO;

/** Appends accepted-looking events for the given actions. */
function withActions(state: ChapterState, actions: readonly CoreAction[]): ChapterState {
  const events = [...state.events];
  for (const action of actions) {
    events.push({
      seq: events.length,
      action,
      derived: { evidence: [], flags: [], resources: {}, persistent: [], objectivesActivated: [], objectivesCompleted: [], debriefTags: [] },
    });
  }
  return { ...state, events };
}

const callRecord = (status: CallRecord["status"]): CallRecord => ({
  callId: "call.alex",
  direction: "incoming",
  displayName: "Unknown caller",
  number: "+000 0100 2200",
  status,
  ringCount: 1,
});

describe("discovery routes", () => {
  it("interact: the object reveals its evidence, by state and by trigger", () => {
    const state = fixtureState();
    expect(canDiscover(state, "ev.account-activity", "interact", S)).toBe(false);
    expect(canDiscover(state, "ev.account-activity", { via: "interact", objectId: "obj.receipts" }, S)).toBe(true);
    expect(canDiscover(state, "ev.account-activity", { via: "interact", objectId: "obj.other" as never }, S)).toBe(false);
    expect(canDiscover({ ...state, interacted: ["obj.receipts"] }, "ev.account-activity", "interact", S)).toBe(true);
  });

  it("inspect: holds only when the requirement holds", () => {
    const state = fixtureState();
    expect(canDiscover(state, "ev.shared-case-id", "inspect", S)).toBe(false);
    const ready = fixtureState({ discovered: ["ev.notification-metadata"] });
    expect(canDiscover(ready, "ev.shared-case-id", "inspect", S)).toBe(true);
  });

  it("dialogue-node: holds once the node was reached in the current or a finished conversation", () => {
    const state = fixtureState();
    expect(canDiscover(state, "ev.alex-statement", "dialogue-node", S)).toBe(false);
    expect(canDiscover(state, "ev.alex-statement", { via: "dialogue-node", nodeId: "alex.open" }, S)).toBe(true);
    expect(canDiscover(state, "ev.alex-statement", { via: "dialogue-node", nodeId: "alex.refused" }, S)).toBe(false);

    const current = fixtureState({
      conversation: { graphId: "dlg.alex", nodeId: "alex.open", callId: "call.alex", history: [] },
    });
    expect(canDiscover(current, "ev.alex-statement", "dialogue-node", S)).toBe(true);

    const finished = fixtureState({
      conversationHistory: [{ graphId: "dlg.alex", history: [], endNodeId: "alex.open" }],
    });
    expect(canDiscover(finished, "ev.alex-statement", "dialogue-node", S)).toBe(true);
  });

  it("device: a trigger for the item's own action reveals it", () => {
    const state = fixtureState();
    const trigger = { via: "device", deviceActionId: "dev.inspect-notification-origin" } as const;
    expect(canDiscover(state, "ev.notification-metadata", trigger, S)).toBe(true);
  });

  it("device: a trigger for another action does not reveal it", () => {
    const state = fixtureState();
    const other = { via: "device", deviceActionId: "dev.open-bank-app" } as const;
    expect(canDiscover(state, "ev.notification-metadata", other, S)).toBe(false);
  });

  it("device: by state, holds only after the action is in the event log", () => {
    const state = fixtureState();
    expect(canDiscover(state, "ev.notification-metadata", "device", S)).toBe(false);
    const done = withActions(state, [
      { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" },
    ]);
    expect(canDiscover(done, "ev.notification-metadata", "device", S)).toBe(true);
  });

  it("device: fails when the action does not list the item in `reveals`", () => {
    const scenario = {
      ...S,
      deviceActions: {
        ...S.deviceActions,
        "dev.inspect-notification-origin": {
          ...S.deviceActions["dev.inspect-notification-origin"],
          reveals: [],
        },
      },
    };
    const trigger = { via: "device", deviceActionId: "dev.inspect-notification-origin" } as const;
    expect(canDiscover(fixtureState(), "ev.notification-metadata", trigger, scenario)).toBe(false);
  });

  it("device: a missing action definition never reveals", () => {
    const scenario = { ...S, deviceActions: {} as typeof S.deviceActions };
    const trigger = { via: "device", deviceActionId: "dev.inspect-notification-origin" } as const;
    expect(canDiscover(fixtureState(), "ev.notification-metadata", trigger, scenario)).toBe(false);
  });

  it("rejects a route that differs from the item's route", () => {
    const state = fixtureState();
    expect(canDiscover(state, "ev.notification-metadata", "interact", S)).toBe(false);
    expect(canDiscover(state, "ev.account-activity", "device", S)).toBe(false);
  });

  it("keeps discovery order", () => {
    const state = discover(discover(fixtureState(), "ev.account-activity"), "ev.alex-statement");
    expect(state.discovered).toEqual(["ev.account-activity", "ev.alex-statement"]);
  });
});

describe("canDiscover rejection", () => {
  it("rejects unknown evidence IDs, including inherited property names", () => {
    const state = fixtureState();
    expect(canDiscover(state, "ev.unknown" as EvidenceId, "inspect", S)).toBe(false);
    expect(canDiscover(state, "__proto__" as EvidenceId, "inspect", S)).toBe(false);
  });

  it("rejects already discovered evidence", () => {
    const state = discover(fixtureState({ discovered: ["ev.notification-metadata"] }), "ev.notification-metadata");
    const trigger = { via: "device", deviceActionId: "dev.inspect-notification-origin" } as const;
    expect(canDiscover(state, "ev.notification-metadata", trigger, S)).toBe(false);
    expect(canDiscover(state, "ev.shared-case-id", "inspect", S)).toBe(true);
    const both = discover(state, "ev.shared-case-id");
    expect(canDiscover(both, "ev.shared-case-id", "inspect", S)).toBe(false);
  });

  it("does not treat a declined call as having reached a dialogue node", () => {
    const state = fixtureState({ call: { current: null, status: "idle", log: [callRecord("declined")] } });
    expect(canDiscover(state, "ev.alex-statement", "dialogue-node", S)).toBe(false);
  });
});

describe("registry functions", () => {
  it("discover is an idempotent append that never mutates its input", () => {
    const state = fixtureState();
    const once = discover(state, "ev.account-activity");
    expect(once).not.toBe(state);
    expect(state.discovered).toEqual([]);
    expect(once.discovered).toEqual(["ev.account-activity"]);
    expect(discover(once, "ev.account-activity")).toBe(once);
  });

  it("evidenceForClaim returns only discovered evidence, in discovery order, with stances", () => {
    const state = fixtureState({ discovered: ["ev.shared-case-id", "ev.account-activity"] });
    const entries = evidenceForClaim(state, "claim.claims-independent", S);
    expect(entries.map((entry) => [entry.evidence.id, entry.stance])).toEqual([
      ["ev.shared-case-id", "inconclusive"],
    ]);
    expect(evidenceForClaim(state, "claim.alex-identity", S)).toEqual([]);
    expect(evidenceForClaim(fixtureState(), "claim.recovery-needed", S)).toEqual([]);
  });
});
