// Chapter 1 evidence coverage (spec chapter-01-double-deception, task 7.5; Requirements 7.1 to
// 7.5, 12.4): E01 to E06 are discoverable, at least four by interaction, and two independent paths
// (physical and digital) each lead to the saved contact.
import { describe, expect, it } from "vitest";
import { DECLINE_ALEX } from "../../../test/chapterRuns";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction } from "../types";
import type { EvidenceId } from "./ids";
import { CHAPTER_1_SCENARIO } from "./scenario";

const SCENARIO = CHAPTER_1_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const dev = (deviceActionId: Extract<CoreAction, { type: "DEVICE_ACTION" }>["deviceActionId"]): CoreAction => ({
  type: "DEVICE_ACTION",
  deviceActionId,
});
const touch = (objectId: Extract<CoreAction, { type: "INTERACT_OBJECT" }>["objectId"]): CoreAction => ({
  type: "INTERACT_OBJECT",
  objectId,
});

function run(actions: readonly CoreAction[]): ChapterState {
  let state = createInitialState();
  for (const action of actions) {
    const result = chapterReducer(state, action, SCENARIO);
    if (!result.accepted) throw new Error(`rejected ${JSON.stringify(action)}: ${result.reason ?? ""}`);
    state = result.state;
  }
  return state;
}

/** E01 to E06 with both E03 variants. */
const E01_TO_E06: EvidenceId[] = [
  "ev.caller-id-anomaly",
  "ev.notification-metadata",
  "ev.official-contact-paper",
  "ev.official-contact-app",
  "ev.account-activity",
  "ev.shared-case-id",
  "ev.note-app-origin",
];

describe("Chapter 1 evidence coverage", () => {
  it("defines E01 to E06 with a source, a discovery route and at least one warning sign or relation", () => {
    for (const id of E01_TO_E06) {
      const item = SCENARIO.evidence[id];
      expect(item.sourceId).toBeDefined();
      expect(Object.hasOwn(SCENARIO.sources, item.sourceId!)).toBe(true);
      expect(item.discovery).toBeDefined();
      expect(item.relations.length + item.warningSigns.length).toBeGreaterThan(0);
    }
  });

  it("discovers all of E01 to E06 (and the optional calendar) in one run", () => {
    const state = run([
      START,
      { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" },
      dev("dev.open-call-details"),
      { type: "END_CALL" },
      touch("obj.receipts"),
      touch("obj.note"),
      touch("obj.calendar"),
      dev("dev.open-alex-record"),
      dev("dev.open-notification"),
      dev("dev.inspect-notification-origin"),
      dev("dev.open-bank-app"),
      dev("dev.open-account-activity"),
      dev("dev.open-saved-contacts"),
      dev("dev.compare-case-ref"),
    ]);
    for (const id of [...E01_TO_E06, "ev.calendar-routine" as const, "ev.alex-statement" as const]) {
      expect(state.discovered).toContain(id);
    }
  });

  it("makes at least four of E01 to E06 discoverable by interaction with a prop or a screen", () => {
    const interactive = E01_TO_E06.filter((id) => {
      const via = SCENARIO.evidence[id].discovery.via;
      return via === "interact" || via === "device";
    });
    expect(interactive.length).toBeGreaterThanOrEqual(4);
  });

  it("offers a physical path that works with no laptop or phone evidence action", () => {
    const state = run([START, ...DECLINE_ALEX, touch("obj.receipts"), touch("obj.note")]);
    expect(state.discovered).toEqual(expect.arrayContaining(["ev.official-contact-paper", "ev.note-app-origin"]));
    expect(state.flags.notification_opened).toBe(false);
    const verify = chapterReducer(
      state,
      { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
      SCENARIO,
    );
    expect(verify.accepted).toBe(true);
  });

  it("offers a digital path that works without any prop", () => {
    const state = run([
      START,
      ...DECLINE_ALEX,
      dev("dev.open-notification"),
      dev("dev.inspect-notification-origin"),
      dev("dev.open-bank-app"),
      dev("dev.open-saved-contacts"),
      dev("dev.open-account-activity"),
    ]);
    expect(state.interacted).toEqual([]);
    expect(state.discovered).toEqual(
      expect.arrayContaining(["ev.notification-metadata", "ev.official-contact-app", "ev.account-activity"]),
    );
    const verify = chapterReducer(
      state,
      { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
      SCENARIO,
    );
    expect(verify.accepted).toBe(true);
  });

  it("never lets a single weak item contradict a claim before the official line", () => {
    for (const id of E01_TO_E06) {
      const item = SCENARIO.evidence[id];
      expect(item.relations.some((relation) => relation.stance === "contradicts" && id !== "ev.note-app-origin")).toBe(
        false,
      );
    }
    const official = SCENARIO.evidence["ev.official-confirmation"];
    expect(official.discovery).toEqual({ via: "dialogue-node", nodeId: "off.confirm" });
  });
});
