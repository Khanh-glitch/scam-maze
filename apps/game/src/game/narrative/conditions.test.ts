// Example tests for the call, objective, outcome, deduction, decision and evidence-count
// conditions, and for the purity of `applyEffect`. Uses the fixture scenario.

import { describe, expect, it } from "vitest";

import { FIXTURE_SCENARIO, fixtureState } from "../../test/fixtureScenario";
import { applyEffect, evaluateCondition } from "./conditions";
import type { CallRecord, ChapterState, Condition } from "./types";

const record = (callId: CallRecord["callId"], status: CallRecord["status"]): CallRecord => ({
  callId,
  direction: "incoming",
  displayName: "Test caller",
  number: "+000 555 0100",
  status,
  ringCount: 1,
});

const withLog = (log: CallRecord[]): ChapterState => {
  const base = fixtureState();
  return { ...base, call: { ...base.call, log } };
};

describe("callRang", () => {
  const condition = { kind: "callRang", callId: "call.recovery" } as const;

  it("is false when the call has no log record", () => {
    expect(evaluateCondition(condition, fixtureState())).toBe(false);
    expect(evaluateCondition(condition, withLog([record("call.alex", "ended")]))).toBe(false);
  });

  it("is true for any status once a record exists", () => {
    for (const status of ["ringing", "answered", "declined", "missed", "ended"] as const) {
      expect(evaluateCondition(condition, withLog([record("call.recovery", status)]))).toBe(true);
    }
  });
});

describe("callClosed", () => {
  const condition = { kind: "callClosed", callId: "call.alex" } as const;

  it("is false without a record and while the call is ringing or answered", () => {
    expect(evaluateCondition(condition, fixtureState())).toBe(false);
    expect(evaluateCondition(condition, withLog([record("call.alex", "ringing")]))).toBe(false);
    expect(evaluateCondition(condition, withLog([record("call.alex", "answered")]))).toBe(false);
  });

  it("is true once the call ended, was declined or was missed", () => {
    for (const status of ["ended", "declined", "missed"] as const) {
      expect(evaluateCondition(condition, withLog([record("call.alex", status)]))).toBe(true);
    }
  });

  it("ignores records of other calls", () => {
    expect(evaluateCondition(condition, withLog([record("call.recovery", "ended")]))).toBe(false);
  });
});

describe("callEnded", () => {
  const condition = { kind: "callEnded", callId: "call.alex" } as const;

  it("does not count a declined or missed call", () => {
    expect(evaluateCondition(condition, withLog([record("call.alex", "declined")]))).toBe(false);
    expect(evaluateCondition(condition, withLog([record("call.alex", "missed")]))).toBe(false);
    expect(evaluateCondition(condition, withLog([record("call.alex", "ended")]))).toBe(true);
  });
});

describe("deductionRecorded", () => {
  const condition = { kind: "deductionRecorded", deductionId: "ded.same-source" } as const;

  it("is false until the deduction is in the recorded list", () => {
    expect(evaluateCondition(condition, fixtureState())).toBe(false);
    expect(evaluateCondition(condition, fixtureState({ deductions: ["ded.notification-mismatch"] }))).toBe(false);
  });

  it("is true once recorded", () => {
    expect(evaluateCondition(condition, fixtureState({ deductions: ["ded.same-source"] }))).toBe(true);
  });
});

describe("decisionIs", () => {
  const condition = { kind: "decisionIs", decision: "refuse-and-stop" } as const;

  it("is false with no decision or another decision", () => {
    expect(evaluateCondition(condition, fixtureState())).toBe(false);
    expect(evaluateCondition(condition, fixtureState({ decision: "follow-recovery" }))).toBe(false);
  });

  it("is true only for the recorded decision", () => {
    expect(evaluateCondition(condition, fixtureState({ decision: "refuse-and-stop" }))).toBe(true);
  });
});

describe("objectiveCompleted", () => {
  const condition = { kind: "objectiveCompleted", objectiveId: "obj.decide" } as const;

  it("is false when the objective is not completed, even if active", () => {
    const base = fixtureState();
    expect(evaluateCondition(condition, base)).toBe(false);
    expect(
      evaluateCondition(condition, { ...base, objectives: { active: ["obj.decide"], completed: [] } }),
    ).toBe(false);
  });

  it("is true when the objective is in the completed list", () => {
    const base = fixtureState();
    const state = { ...base, objectives: { active: [], completed: ["obj.decide" as const] } };
    expect(evaluateCondition(condition, state)).toBe(true);
  });
});

describe("outcomeSet", () => {
  const condition = { kind: "outcomeSet" } as const;

  it("is false while the outcome is null", () => {
    expect(evaluateCondition(condition, fixtureState())).toBe(false);
  });

  it("is true once any outcome is set", () => {
    expect(evaluateCondition(condition, fixtureState({ outcome: "perfect-chain" }))).toBe(true);
  });
});

describe("evidenceCountAtLeast", () => {
  const condition: Extract<Condition, { kind: "evidenceCountAtLeast" }> = {
    kind: "evidenceCountAtLeast",
    evidenceIds: ["ev.alex-statement", "ev.shared-case-id"],
    count: 2,
  };

  it("is false below the count", () => {
    expect(evaluateCondition(condition, fixtureState())).toBe(false);
    expect(evaluateCondition(condition, fixtureState({ discovered: ["ev.alex-statement"] }))).toBe(false);
  });

  it("is true exactly at the count and above it", () => {
    const both = fixtureState({ discovered: ["ev.alex-statement", "ev.shared-case-id"] });
    expect(evaluateCondition(condition, both)).toBe(true);
    const one = fixtureState({ discovered: ["ev.shared-case-id"] });
    expect(evaluateCondition({ ...condition, count: 1 }, one)).toBe(true);
  });

  it("ignores discovered items that are not in the list", () => {
    const state = fixtureState({ discovered: ["ev.alex-statement"] });
    expect(evaluateCondition({ ...condition, evidenceIds: ["ev.shared-case-id"], count: 1 }, state)).toBe(false);
  });
});

describe("applyEffect purity and claim status", () => {
  it("setClaimStatus is applied as given, without mutating the input", () => {
    const state = fixtureState();
    const before = JSON.stringify(state);
    const next = applyEffect(
      state,
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "contradicted" },
      FIXTURE_SCENARIO,
    );
    expect(next.claims["claim.notification-genuine"]).toBe("contradicted");
    expect(JSON.stringify(state)).toBe(before);
    expect(next).not.toBe(state);
  });

  it("returns the same object for a no-op effect", () => {
    const state = fixtureState();
    const same = applyEffect(
      state,
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "unverified" },
      FIXTURE_SCENARIO,
    );
    expect(same).toBe(state);
  });

  it("ignores a claim ID that the scenario does not define", () => {
    const state = fixtureState();
    const same = applyEffect(
      state,
      { kind: "setClaimStatus", claimId: "claim.unknown" as never, status: "contradicted" },
      FIXTURE_SCENARIO,
    );
    expect(same).toBe(state);
  });
});
