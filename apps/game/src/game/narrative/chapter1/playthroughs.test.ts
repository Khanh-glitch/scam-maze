// Chapter 1 scripted playthroughs (spec chapter-01-double-deception, task 7.5; Requirements 5.1,
// 5.4, 5.5, 5.7, 9.2, 10.5 to 10.10): first call choices, the two traps, the independent check,
// the five reactive third-call starts, all four endings, the secret variant and early exits.
import { describe, expect, it } from "vitest";
import {
  ALEX_SHARES_CODE,
  CALL_SAVED_CONTACT,
  DECLINE_ALEX,
  FOLLOW_THE_NOTIFICATION,
  LINK_FIRST_TWO,
  assertInvariants,
  completeChapterFrom,
  playScript,
  reachEndingA,
  reachEndingB,
  reachEndingC,
  reachEndingD,
  type GuidedCompletion,
} from "../../../test/chapterRuns";
import { buildDebrief } from "../debrief";
import { chapterReducer, createInitialState } from "../reducer";
import { selectConsequenceVariant } from "../outcome";
import type { ChapterState, CoreAction } from "../types";
import { CHAPTER_1_SCENARIO } from "./scenario";
import { CASE_REFERENCE } from "./sources";

const SCENARIO = CHAPTER_1_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const dev = (deviceActionId: Extract<CoreAction, { type: "DEVICE_ACTION" }>["deviceActionId"]): CoreAction => ({
  type: "DEVICE_ACTION",
  deviceActionId,
});
const ringRecovery: CoreAction = { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" };
const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });

/** Plays actions from the initial state; throws on the first rejected action. */
function run(actions: readonly CoreAction[], from: ChapterState = createInitialState()): ChapterState {
  let state = from;
  for (const action of actions) {
    const result = chapterReducer(state, action, SCENARIO);
    if (!result.accepted) throw new Error(`rejected ${JSON.stringify(action)}: ${result.reason ?? ""}`);
    state = result.state;
  }
  return state;
}

function messageBodies(state: ChapterState): string[] {
  return state.phone.messages.map((id) => SCENARIO.phone.messages[id].body);
}

function variantId(run: GuidedCompletion): string {
  return selectConsequenceVariant(run.outcomeState, SCENARIO)?.id ?? "none";
}

describe("first call", () => {
  it("declining leaves a voicemail with the case ID, no call summary, and a laptop notification", () => {
    const state = run([START, ...DECLINE_ALEX]);
    expect(state.flags.first_call_rejected).toBe(true);
    expect(state.flags.first_call_answered).toBe(false);
    expect(state.phone.messages).toEqual(["msg.alex-voicemail"]);
    expect(messageBodies(state)[0]).toContain(CASE_REFERENCE);
    expect(state.flags.notification_delivered).toBe(true);
    expect(state.flags.code_shared).toBe(false);
  });

  it("accepting then asking details then hanging up leaves a call summary with the case ID", () => {
    const state = run([
      START,
      { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" },
      { type: "ANSWER_CALL" },
      option("alex.opt.open.ask-details"),
      option("alex.opt.details.hang-up"),
    ]);
    expect(state.flags.first_call_answered).toBe(true);
    expect(state.flags.first_call_rejected).toBe(true);
    expect(state.flags.code_shared).toBe(false);
    expect(state.phone.messages).toEqual(["msg.alex-summary"]);
    expect(messageBodies(state)[0]).toContain(CASE_REFERENCE);
    expect(state.flags.notification_delivered).toBe(true);
  });

  it("hanging up at the first node ends the call at once without harm", () => {
    const state = run([
      START,
      { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" },
      { type: "ANSWER_CALL" },
      option("alex.opt.open.hang-up"),
    ]);
    expect(state.call.current).toBeNull();
    expect(state.flags.first_call_rejected).toBe(true);
    expect(state.flags.code_shared).toBe(false);
    expect(state.flags.notification_delivered).toBe(true);
  });

  it("hanging up with END_CALL while the call is active also closes it", () => {
    const state = run([
      START,
      { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" },
      { type: "ANSWER_CALL" },
      { type: "END_CALL" },
    ]);
    expect(state.call.current).toBeNull();
    expect(state.flags.notification_delivered).toBe(true);
    expect(state.flags.code_shared).toBe(false);
  });

  it("sharing the code is an explicit option and sets code_shared", () => {
    const state = run([START, ...ALEX_SHARES_CODE]);
    expect(state.flags.code_shared).toBe(true);
  });
});

describe("the five reactive third-call starts", () => {
  const cases: Array<{ start: string; script: CoreAction[] }> = [
    { start: "rec.start.blank", script: [START, ...DECLINE_ALEX, dev("dev.dismiss-notification"), ringRecovery] },
    { start: "rec.start.followed", script: [START, ...DECLINE_ALEX, ...FOLLOW_THE_NOTIFICATION, ringRecovery] },
    {
      start: "rec.start.inspected",
      script: [
        START,
        ...DECLINE_ALEX,
        dev("dev.open-notification"),
        dev("dev.inspect-notification-origin"),
        dev("dev.open-bank-app"),
        dev("dev.open-account-activity"),
        dev("dev.open-saved-contacts"),
        ringRecovery,
      ],
    },
    { start: "rec.start.confronted", script: [START, ...DECLINE_ALEX, ...LINK_FIRST_TWO, ringRecovery] },
    { start: "rec.start.verified", script: [START, ...DECLINE_ALEX, ...CALL_SAVED_CONTACT, ringRecovery] },
  ];

  for (const { start, script } of cases) {
    it(`starts at ${start}`, () => {
      const state = run([...script, { type: "ANSWER_CALL" }]);
      expect(state.conversation?.graphId).toBe("dlg.recovery");
      expect(state.conversation?.nodeId).toBe(start);
    });
  }

  it("does not ring the third call before the first call has closed", () => {
    const state = run([START]);
    expect(chapterReducer(state, ringRecovery, SCENARIO).accepted).toBe(false);
  });
});

describe("the endings", () => {
  it("Ending A (false-victory): reject Alex, follow the notification, trust the third caller", () => {
    const result = reachEndingA();
    expect(result.final.outcome).toBe("false-victory");
    expect(result.final.status).toBe("finished");
    expect(result.final.flags.first_call_rejected).toBe(true);
    expect(result.final.flags.second_caller_trusted).toBe(true);
    expect(result.final.flags.money_moved).toBe(true);
    expect(result.final.flags.code_shared).toBe(false);
    expect(variantId(result)).toBe("after-rejecting-alex");
    expect(assertInvariants(result.final)).toEqual([]);
  });

  it("Ending B (perfect-chain): trust both callers", () => {
    const result = reachEndingB();
    expect(result.final.outcome).toBe("perfect-chain");
    expect(result.final.flags.code_shared).toBe(true);
    expect(result.final.flags.second_caller_trusted).toBe(true);
    expect(result.final.flags.money_moved).toBe(true);
    expect(assertInvariants(result.final)).toEqual([]);
  });

  it("Ending C (break-the-chain): independent verification, without all optional evidence", () => {
    const result = reachEndingC();
    expect(result.final.outcome).toBe("break-the-chain");
    expect(result.final.flags.official_channel_verified).toBe(true);
    expect(result.final.flags.money_moved).toBe(false);
    expect(result.final.claims["claim.alex-identity"]).toBe("contradicted");
    expect(result.final.discovered).toContain("ev.official-confirmation");
    for (const missing of ["ev.calendar-routine", "ev.recovery-number-match", "ev.shared-case-id"] as const) {
      expect(result.final.discovered).not.toContain(missing);
    }
    expect(variantId(result)).toBe("default");
    expect(assertInvariants(result.final)).toEqual([]);
  });

  it("Ending C secret variant (case-report) needs both deductions", () => {
    const result = reachEndingC({ caseReport: true });
    expect(result.final.outcome).toBe("break-the-chain");
    expect(result.final.deductions).toEqual(
      expect.arrayContaining(["ded.same-source", "ded.third-caller-not-independent"]),
    );
    expect(variantId(result)).toBe("case-report");
    expect(variantId(reachEndingC())).not.toBe("case-report");
  });

  it("Ending D (unfinished-case): decline Alex, refuse and stop", () => {
    const result = reachEndingD();
    expect(result.final.outcome).toBe("unfinished-case");
    expect(result.final.flags.money_moved).toBe(false);
    expect(result.final.flags.code_shared).toBe(false);
    expect(result.final.flags.second_caller_trusted).toBe(false);
    expect(variantId(result)).toBe("default");
  });

  it("Ending D evidence-built variant after recording the first deduction", () => {
    const result = reachEndingD({ evidenceBuilt: true });
    expect(result.final.outcome).toBe("unfinished-case");
    expect(variantId(result)).toBe("evidence-built");
  });

  it("gives each ending a different consequence and aftermath", () => {
    const outcomes = [reachEndingA(), reachEndingB(), reachEndingC(), reachEndingD()].map(
      (result) => SCENARIO.endings[result.final.outcome!],
    );
    expect(new Set(outcomes.map((ending) => ending.aftermath.consequence)).size).toBe(4);
    expect(new Set(outcomes.map((ending) => ending.aftermath.phone)).size).toBe(4);
    expect(new Set(outcomes.map((ending) => ending.aftermath.laptop)).size).toBe(4);
    for (const ending of outcomes) expect(ending.simulationLabel).toMatch(/simulation/i);
  });

  it("builds a debrief for every ending", () => {
    for (const result of [reachEndingA(), reachEndingB(), reachEndingC(), reachEndingD()]) {
      const debrief = buildDebrief(result.final, SCENARIO);
      expect(debrief).toBeTruthy();
    }
  });
});

describe("independent verification (digital path only)", () => {
  it("breaks the chain through the saved bank app without touching any prop", () => {
    const result = playScript([
      START,
      ...DECLINE_ALEX,
      dev("dev.open-bank-app"),
      dev("dev.open-saved-contacts"),
      { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
      option("off.opt.open.ask-case"),
      option("off.opt.ask.give-case"),
      option("off.opt.confirm.all-done"),
      { type: "MAKE_DECISION", decision: "verify-independently" },
    ]);
    expect(result.final.outcome).toBe("break-the-chain");
    expect(result.final.interacted).toEqual([]);
  });
});

describe("early exits and no soft lock", () => {
  it("decline Alex, refuse the third call, then refuse and stop: unfinished-case", () => {
    const state = run([START, ...DECLINE_ALEX, dev("dev.dismiss-notification"), ringRecovery, { type: "END_CALL" }]);
    expect(state.call.current).toBeNull();
    const done = run([{ type: "MAKE_DECISION", decision: "refuse-and-stop" }, { type: "FINISH_CHAPTER" }], state);
    expect(done.outcome).toBe("unfinished-case");
    expect(done.status).toBe("finished");
  });

  it("refusing is available straight after the first call, before any evidence", () => {
    const state = run([START, ...DECLINE_ALEX]);
    const result = chapterReducer(state, { type: "MAKE_DECISION", decision: "refuse-and-stop" }, SCENARIO);
    expect(result.accepted).toBe(true);
    expect(result.state.outcome).toBe("unfinished-case");
  });

  it("completes the chapter from the start state and from several early states", () => {
    const starts: ChapterState[] = [
      createInitialState(),
      run([START]),
      run([START, { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" }]),
      run([START, { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" }, { type: "ANSWER_CALL" }]),
      run([START, ...DECLINE_ALEX]),
      run([START, ...DECLINE_ALEX, ...FOLLOW_THE_NOTIFICATION, ringRecovery]),
      run([START, ...ALEX_SHARES_CODE]),
    ];
    for (const start of starts) {
      const completion = completeChapterFrom(start);
      expect(completion.final.status).toBe("finished");
      expect(completion.final.outcome).not.toBeNull();
    }
  });
});
