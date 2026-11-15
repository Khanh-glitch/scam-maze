import { describe, expect, it } from "vitest";
import {
  ACT_IDS,
  CALL_IDS,
  CLAIM_IDS,
  DECISION_IDS,
  DEDUCTION_IDS,
  DEVICE_ACTION_IDS,
  DIALOGUE_GRAPH_IDS,
  EVIDENCE_IDS,
  FLAG_IDS,
  INTERACTABLE_IDS,
  MESSAGE_IDS,
  NPC_IDS,
  OBJECTIVE_IDS,
  OUTCOME_IDS,
  SOURCE_IDS,
  SPEAKER_IDS,
  TONE_IDS,
  VERIFY_METHODS,
  WARNING_SIGN_IDS,
  type IncomingCallId,
} from "./ids";

const LISTS: Record<string, readonly string[]> = {
  OBJECTIVE_IDS,
  INTERACTABLE_IDS,
  EVIDENCE_IDS,
  CLAIM_IDS,
  CALL_IDS,
  DIALOGUE_GRAPH_IDS,
  MESSAGE_IDS,
  FLAG_IDS,
  DECISION_IDS,
  OUTCOME_IDS,
  WARNING_SIGN_IDS,
  VERIFY_METHODS,
  SPEAKER_IDS,
  TONE_IDS,
  ACT_IDS,
  SOURCE_IDS,
  DEDUCTION_IDS,
  DEVICE_ACTION_IDS,
};

describe("chapter 1 ids", () => {
  it.each(Object.entries(LISTS))("%s has no duplicates", (_name, list) => {
    expect(new Set(list).size).toBe(list.length);
  });

  it("uses the prefix conventions", () => {
    expect(EVIDENCE_IDS.every((id) => id.startsWith("ev."))).toBe(true);
    expect(DEVICE_ACTION_IDS.every((id) => id.startsWith("dev."))).toBe(true);
    expect(SOURCE_IDS.every((id) => id.startsWith("src."))).toBe(true);
    expect(DEDUCTION_IDS.every((id) => id.startsWith("ded."))).toBe(true);
  });

  it("has the expected list sizes", () => {
    expect(ACT_IDS).toHaveLength(5);
    expect(DECISION_IDS).toHaveLength(5);
    expect(OUTCOME_IDS).toHaveLength(4);
    expect(VERIFY_METHODS).toEqual(["saved-official-contact", "bank-app"]);
    expect(NPC_IDS).toHaveLength(0);
  });

  it("keeps the outgoing official line out of IncomingCallId", () => {
    const incoming: IncomingCallId[] = ["call.alex", "call.recovery"];
    expect(incoming.every((id) => (CALL_IDS as readonly string[]).includes(id))).toBe(true);
    // @ts-expect-error call.official is outgoing only
    const invalid: IncomingCallId = "call.official";
    expect(invalid).toBe("call.official");
    expect(CALL_IDS.filter((id) => !incoming.includes(id as IncomingCallId))).toEqual(["call.official"]);
  });
});
