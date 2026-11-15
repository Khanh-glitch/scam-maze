// Feature: chapter-01-double-deception, Property 10: Third call gating and reactive start
//
// `call.recovery` may ring if and only if Alex's call is closed, no call or conversation is active,
// no decision or outcome exists, it has not rung, and one of its six authored `ringWhen`
// alternatives holds. When it is answered, the start node is the first match of the authored
// priority list (verified, confronted, inspected, followed, blank), computed here from the state
// without reading the scenario's `startNodeWhen`. Validates: Requirements 9.1, 9.2, 9.9, 12.6.

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  caseSeed,
  describeAction,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { chapterReducer, createInitialState } from "../reducer";
import { enumerateCandidateActions, selectRingableCall } from "../selectors";
import type { ChapterState, CoreAction } from "../types";

const SEED = (CORE_PROPERTY_SEED ^ 0x0010) >>> 0;
const PROPERTY_TIMEOUT_MS = 120_000;

type StartKey = "verified" | "confronted" | "inspected" | "followed" | "blank";
const START_KEYS: readonly StartKey[] = ["verified", "confronted", "inspected", "followed", "blank"];

/** E01 to E06 as authored in the design (three of them open the third call). */
const EARLY_EVIDENCE: readonly string[] = [
  "ev.caller-id-anomaly",
  "ev.notification-metadata",
  "ev.official-contact-paper",
  "ev.official-contact-app",
  "ev.account-activity",
  "ev.shared-case-id",
  "ev.note-app-origin",
];

const START: CoreAction = { type: "START_CHAPTER" };
const ring = (reason: "follow-up" | "callback" = "follow-up"): CoreAction => ({
  type: "RING_CALL",
  callId: "call.recovery",
  reason,
});
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };
const device = (deviceActionId: "dev.open-notification" | "dev.dismiss-notification" | "dev.review-security" | "dev.inspect-notification-origin" | "dev.open-alex-record" | "dev.compare-case-ref"): CoreAction => ({
  type: "DEVICE_ACTION",
  deviceActionId,
});
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

const DECLINE_ALEX: CoreAction[] = [{ type: "RING_CALL", callId: "call.alex", reason: "first-interaction" }, END_CALL];

/** One tolerant script per start node; the property checks the result, so a bad script shows up as missing coverage. */
const SCRIPTS: Record<StartKey, CoreAction[]> = {
  blank: [START, ...DECLINE_ALEX, device("dev.dismiss-notification")],
  followed: [START, ...DECLINE_ALEX, device("dev.open-notification"), device("dev.review-security")],
  inspected: [
    START,
    ...DECLINE_ALEX,
    device("dev.open-notification"),
    device("dev.inspect-notification-origin"),
    device("dev.review-security"),
  ],
  confronted: [
    START,
    ...DECLINE_ALEX,
    device("dev.open-alex-record"),
    device("dev.open-notification"),
    device("dev.inspect-notification-origin"),
    device("dev.compare-case-ref"),
    { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.notification-metadata", "ev.shared-case-id"] },
  ],
  verified: [
    START,
    ...DECLINE_ALEX,
    { type: "INTERACT_OBJECT", objectId: "obj.receipts" },
    { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
    option("off.opt.open.ask-case"),
    option("off.opt.ask.give-case"),
    option("off.opt.confirm.all-done"),
  ],
};

// ---------------------------------------------------------------------------
// Independent oracle
// ---------------------------------------------------------------------------

const alexClosed = (s: ChapterState): boolean =>
  s.call.log.some((r) => r.callId === "call.alex" && (r.status === "ended" || r.status === "declined" || r.status === "missed"));

const recoveryRung = (s: ChapterState): boolean => s.call.log.some((r) => r.callId === "call.recovery");

/** The six authored `ringWhen` alternatives, written out again (Alex closed is part of each). */
function alternativeHolds(s: ChapterState): boolean {
  const early = EARLY_EVIDENCE.filter((id) => (s.discovered as string[]).includes(id)).length;
  return (
    s.flags.review_security_opened === true ||
    s.flags.notification_dismissed === true ||
    (s.flags.notification_handled === true && early >= 2) ||
    s.flags.official_channel_verified === true ||
    early >= 3 ||
    (s.claims as Record<string, string>)["claim.claims-independent"] === "inconclusive"
  );
}

const idle = (s: ChapterState): boolean =>
  s.status === "playing" &&
  s.outcome === null &&
  s.decision === null &&
  s.call.current === null &&
  s.call.status !== "ringing" &&
  s.conversation === null;

const expectedRingable = (s: ChapterState): boolean =>
  idle(s) && alexClosed(s) && !recoveryRung(s) && alternativeHolds(s);

function expectedStart(s: ChapterState): StartKey {
  if (s.flags.official_channel_verified === true) return "verified";
  if (s.deductions.includes("ded.same-source")) return "confronted";
  if (s.flags.notification_origin_inspected === true) return "inspected";
  if (s.flags.review_security_opened === true) return "followed";
  return "blank";
}

// ---------------------------------------------------------------------------
// One case
// ---------------------------------------------------------------------------

interface CaseReport {
  failures: string[];
  starts: Set<StartKey>;
}

function runCase(index: number): CaseReport {
  const seed = caseSeed(SEED, index);
  const next = createLcg(seed);
  const failures: string[] = [];
  const starts = new Set<StartKey>();
  const trail: string[] = [];
  const fail = (message: string): void => {
    failures.push(`seed ${seed}, case ${index}: ${message}. Actions: ${trail.join(", ")}`);
  };

  const scripted = index % 6 !== 5;
  const key = START_KEYS[index % START_KEYS.length];
  let state = createInitialState();

  /** Checks Property 10 on `state` (gating, reducer agreement, single ring). */
  const checkState = (): void => {
    const selected = selectRingableCall(state, CHAPTER_1_SCENARIO);
    const expected = expectedRingable(state);
    if ((selected === "call.recovery") !== expected) {
      fail(`selectRingableCall is ${String(selected)} but expected ringable is ${expected}`);
    }
    const rings = state.call.log.filter((r) => r.callId === "call.recovery");
    if (rings.length > 1 || rings.some((r) => r.ringCount > 1)) fail("call.recovery rang more than once");
    if (idle(state)) {
      const attempt = chapterReducer(state, ring(), CHAPTER_1_SCENARIO);
      const shouldAccept = alexClosed(state) && !recoveryRung(state) && alternativeHolds(state);
      if (attempt.accepted !== shouldAccept) {
        fail(`RING_CALL call.recovery accepted=${attempt.accepted} (${attempt.reason ?? ""}), expected ${shouldAccept}`);
      }
      if (!attempt.accepted && attempt.state !== state) fail("a rejected RING_CALL changed the state");
    }
  };

  /** Applies an action; on ANSWER_CALL of the third call checks the start node. Returns acceptance. */
  const step = (action: CoreAction): boolean => {
    const before = state;
    const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
    if (!result.accepted) return false;
    trail.push(describeAction(action));
    state = result.state;
    if (action.type === "ANSWER_CALL" && before.call.current === "call.recovery") {
      const want = expectedStart(before);
      const got = state.conversation;
      if (got === null || got.graphId !== "dlg.recovery" || got.nodeId !== `rec.start.${want}`) {
        fail(`answered with start node ${got?.nodeId ?? "none"}, expected rec.start.${want}`);
      } else {
        starts.add(want);
      }
    }
    checkState();
    return true;
  };

  checkState();
  if (scripted) {
    for (const action of SCRIPTS[key]) step(action);
  }

  // Dismissing the notification never blocks the third call (no soft lock).
  if (idle(state) && alexClosed(state) && !recoveryRung(state)) {
    const dismissed = chapterReducer(state, device("dev.dismiss-notification"), CHAPTER_1_SCENARIO);
    if (dismissed.accepted && selectRingableCall(dismissed.state, CHAPTER_1_SCENARIO) !== "call.recovery") {
      fail("after dismissing the notification the third call cannot ring");
    }
  }

  // Take the third call right after the script when it may ring.
  if (selectRingableCall(state, CHAPTER_1_SCENARIO) === "call.recovery") {
    if (!step(ring())) fail("RING_CALL rejected although selectRingableCall allows it");
    else if (state.call.status !== "ringing") fail("call is not ringing after RING_CALL");
    else if (!step(ANSWER)) fail("ANSWER_CALL rejected for the ringing third call");
    else {
      // Leave the call by the shortest path the engine offers: hang up.
      step(END_CALL);
      if (chapterReducer(state, ring(), CHAPTER_1_SCENARIO).accepted) fail("call.recovery can ring a second time");
    }
  }

  // Random tail: candidate actions, with the occasional decision.
  const tail = randomInt(next, 0, scripted ? 14 : 45);
  for (let i = 0; i < tail; i += 1) {
    const candidates = enumerateCandidateActions(state, CHAPTER_1_SCENARIO).filter(
      (action) => action.type !== "MAKE_DECISION" || next() < 0.1,
    );
    if (candidates.length === 0) break;
    const action = candidates[randomInt(next, 0, candidates.length - 1)];
    step(action);
    // Prefer taking the third call when it rings, so the start node is checked often.
    if (state.call.status === "ringing" && state.call.current === "call.recovery" && next() < 0.8) step(ANSWER);
  }
  return { failures, starts };
}

// ---------------------------------------------------------------------------

describe("Property 10: Third call gating and reactive start", () => {
  it("rings the third call only when allowed, once, and starts at the first matching node", () => {
    // Feature: chapter-01-double-deception, Property 10: Third call gating and reactive start
    const calls = CHAPTER_1_SCENARIO.calls["call.recovery"];
    expect(calls.direction).toBe("incoming");
    expect(calls.ringWhen.length, "six authored ringWhen alternatives").toBe(6);

    const failures: string[] = [];
    const covered = new Set<StartKey>();
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const report = runCase(index);
      failures.push(...report.failures);
      report.starts.forEach((key) => covered.add(key));
    }
    const report = `Base seed ${SEED}. First failures:\n${failures.slice(0, 5).join("\n")}`;
    expect(failures, report).toEqual([]);
    expect([...covered].sort(), `Start nodes reached (seed ${SEED})`).toEqual([...START_KEYS].sort());
  }, PROPERTY_TIMEOUT_MS);

  it("still gives the third call to a player who dismisses the notification", () => {
    let state = createInitialState();
    for (const action of [START, ...DECLINE_ALEX, device("dev.dismiss-notification")]) {
      const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
      expect(result.accepted, `${describeAction(action)}: ${result.reason ?? ""}`).toBe(true);
      state = result.state;
    }
    expect(state.flags.notification_opened).toBe(false);
    expect(selectRingableCall(state, CHAPTER_1_SCENARIO)).toBe("call.recovery");
    for (const action of [ring(), ANSWER]) {
      const result = chapterReducer(state, action, CHAPTER_1_SCENARIO);
      expect(result.accepted, describeAction(action)).toBe(true);
      state = result.state;
    }
    expect(state.conversation?.nodeId).toBe("rec.start.blank");
  }, PROPERTY_TIMEOUT_MS);
});
