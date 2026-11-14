import { describe, expect, it } from "vitest";
import {
  FIXTURE_SCENARIO,
  fixtureState,
  withEvidence,
  withFlags,
} from "../../test/fixtureScenario";
import type { DeductionId, EvidenceId } from "./chapter1/ids";
import { canRecordDeduction, matchDeduction } from "./deductions";
import type { DeductionDef, ScenarioDefinition } from "./types";

const SAME = ["ev.alex-statement", "ev.shared-case-id"] as EvidenceId[];
const MISMATCH = ["ev.notification-metadata", "ev.account-activity"] as EvidenceId[];

/** A scenario with one deduction that has two `inputsAnyOf` members. */
function anyOfScenario(): ScenarioDefinition {
  const deduction: DeductionDef = {
    ...FIXTURE_SCENARIO.deductions["ded.notification-mismatch" as DeductionId],
    inputsAnyOf: ["ev.account-activity", "ev.shared-case-id"] as EvidenceId[],
  };
  return {
    ...FIXTURE_SCENARIO,
    deductions: { [deduction.id]: deduction } as ScenarioDefinition["deductions"],
  };
}

describe("matchDeduction", () => {
  it("matches the exact input set", () => {
    expect(matchDeduction(SAME, FIXTURE_SCENARIO)?.id).toBe("ded.same-source");
  });

  it("is order independent", () => {
    expect(matchDeduction([...SAME].reverse(), FIXTURE_SCENARIO)?.id).toBe("ded.same-source");
    expect(matchDeduction([...MISMATCH].reverse(), FIXTURE_SCENARIO)?.id).toBe(
      "ded.notification-mismatch",
    );
  });

  it("rejects missing members", () => {
    expect(matchDeduction([SAME[0]], FIXTURE_SCENARIO)).toBeNull();
    expect(matchDeduction([], FIXTURE_SCENARIO)).toBeNull();
  });

  it("rejects extra members", () => {
    expect(matchDeduction([...SAME, "ev.account-activity" as EvidenceId], FIXTURE_SCENARIO)).toBeNull();
  });

  it("rejects duplicates", () => {
    expect(matchDeduction([SAME[0], SAME[0], SAME[1]], FIXTURE_SCENARIO)).toBeNull();
    expect(matchDeduction([SAME[0], SAME[0]], FIXTURE_SCENARIO)).toBeNull();
  });

  it("matches with exactly one inputsAnyOf member", () => {
    const scenario = anyOfScenario();
    const base = "ev.notification-metadata" as EvidenceId;
    expect(matchDeduction([base, "ev.account-activity" as EvidenceId], scenario)).not.toBeNull();
    expect(matchDeduction([base, "ev.shared-case-id" as EvidenceId], scenario)).not.toBeNull();
  });

  it("rejects none or both inputsAnyOf members", () => {
    const scenario = anyOfScenario();
    const base = "ev.notification-metadata" as EvidenceId;
    expect(matchDeduction([base], scenario)).toBeNull();
    expect(
      matchDeduction(
        [base, "ev.account-activity", "ev.shared-case-id"] as EvidenceId[],
        scenario,
      ),
    ).toBeNull();
  });
});

describe("canRecordDeduction", () => {
  const same = FIXTURE_SCENARIO.deductions["ded.same-source" as DeductionId];

  it("requires every input to be discovered", () => {
    expect(canRecordDeduction(fixtureState(), same, FIXTURE_SCENARIO)).toBe(false);
    expect(
      canRecordDeduction(withEvidence(fixtureState(), [SAME[0]]), same, FIXTURE_SCENARIO),
    ).toBe(false);
    expect(
      canRecordDeduction(withEvidence(fixtureState(), SAME), same, FIXTURE_SCENARIO),
    ).toBe(true);
  });

  it("rejects a deduction that is already recorded", () => {
    const state = { ...withEvidence(fixtureState(), SAME), deductions: [same.id] };
    expect(canRecordDeduction(state, same, FIXTURE_SCENARIO)).toBe(false);
  });

  it("requires an inputsAnyOf member to be discovered", () => {
    const scenario = anyOfScenario();
    const deduction = Object.values(scenario.deductions)[0];
    const base = withEvidence(fixtureState(), ["ev.notification-metadata" as EvidenceId]);
    expect(canRecordDeduction(base, deduction, scenario)).toBe(false);
    expect(
      canRecordDeduction(
        withEvidence(base, ["ev.account-activity" as EvidenceId]),
        deduction,
        scenario,
      ),
    ).toBe(true);
  });

  it("requires the requires conditions to hold", () => {
    const gated: DeductionDef = { ...same, requires: [{ kind: "flag", flag: "notification_delivered" }] };
    const state = withEvidence(fixtureState(), SAME);
    expect(canRecordDeduction(state, gated, FIXTURE_SCENARIO)).toBe(false);
    expect(
      canRecordDeduction(withFlags(state, ["notification_delivered"]), gated, FIXTURE_SCENARIO),
    ).toBe(true);
  });
});
