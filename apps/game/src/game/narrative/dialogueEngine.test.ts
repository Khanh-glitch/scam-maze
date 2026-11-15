// Unit tests for the dialogue engine on the double-deception graphs (dlg.alex, dlg.recovery,
// dlg.official-line): start nodes, gated options, the harmful options, the pressure cap and the
// fallback option.

import { describe, expect, it } from "vitest";

import { CALL_SAVED_CONTACT, DECLINE_ALEX, LINK_FIRST_TWO } from "../../test/chapterRuns";
import { CHAPTER_1_SCENARIO } from "./chapter1/scenario";
import { applyEffect, MAX_PRESSURE } from "./conditions";
import {
  availableOptions,
  FALLBACK_OPTION_ID,
  FALLBACK_OPTION_TEXT,
  OPTION_NOT_AVAILABLE,
  resolveStartNode,
  selectOption,
  startConversation,
} from "./dialogueEngine";
import { chapterReducer, createInitialState } from "./reducer";
import type { ChapterState, CoreAction, ScenarioDefinition } from "./types";

function play(
  state: ChapterState,
  actions: readonly CoreAction[],
  scenario: ScenarioDefinition = CHAPTER_1_SCENARIO,
): ChapterState {
  let current = state;
  for (const action of actions) {
    const result = chapterReducer(current, action, scenario);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    current = result.state;
  }
  return current;
}

const option = (optionId: string): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId });
const device = (deviceActionId: Extract<CoreAction, { type: "DEVICE_ACTION" }>["deviceActionId"]): CoreAction => ({
  type: "DEVICE_ACTION",
  deviceActionId,
});
const optionIds = (state: ChapterState, scenario = CHAPTER_1_SCENARIO): string[] =>
  availableOptions(state, scenario).map((view) => view.id);
const started = (): ChapterState => play(createInitialState(), [{ type: "START_CHAPTER" }]);
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const RING_RECOVERY: CoreAction = { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };

/** The first call is answered and Alex is at his opening node. */
const atAlexOpen = (): ChapterState => play(started(), [RING_ALEX, ANSWER]);
/** The first call is declined; the notification exists and Alex is closed. */
const afterDeclinedAlex = (): ChapterState => play(started(), DECLINE_ALEX);

describe("Alex's opening node (dlg.alex)", () => {
  it("starts at alex.open when the call is answered, with the four authored options", () => {
    const state = atAlexOpen();
    expect(state.conversation).toMatchObject({ graphId: "dlg.alex", nodeId: "alex.open", callId: "call.alex" });
    expect(state.flags.first_call_answered).toBe(true);
    expect(optionIds(state)).toEqual([
      "alex.opt.open.ask-who",
      "alex.opt.open.challenge-number",
      "alex.opt.open.ask-details",
      "alex.opt.open.hang-up",
    ]);
  });

  it("returns option text from the graph's approved lines", () => {
    const state = atAlexOpen();
    const lines = CHAPTER_1_SCENARIO.dialogues["dlg.alex"].lines;
    for (const view of availableOptions(state, CHAPTER_1_SCENARIO)) {
      expect(view.fallback).toBe(false);
      expect(view.text).toBe(lines[view.lineId]);
    }
  });

  it("hanging up through the option archives the conversation, ends the call and marks the call rejected", () => {
    const state = play(atAlexOpen(), [option("alex.opt.open.hang-up")]);
    expect(state.conversation).toBeNull();
    expect(state.call).toMatchObject({ current: null, status: "ended" });
    expect(state.flags.first_call_rejected).toBe(true);
    expect(state.conversationHistory).toEqual([
      {
        graphId: "dlg.alex",
        history: [{ nodeId: "alex.open", optionId: "alex.opt.open.hang-up" }],
        endNodeId: "alex.end.hung-up",
      },
    ]);
  });

  it("returns no options when there is no conversation, and selecting one is rejected", () => {
    expect(availableOptions(started(), CHAPTER_1_SCENARIO)).toEqual([]);
    expect(selectOption(started(), "alex.opt.open.ask-who", CHAPTER_1_SCENARIO)).toEqual({
      ok: false,
      reason: OPTION_NOT_AVAILABLE,
    });
  });

  it("startConversation does nothing while another conversation runs", () => {
    const talking = atAlexOpen();
    expect(startConversation(talking, "dlg.recovery", CHAPTER_1_SCENARIO)).toBe(talking);
  });
});

describe("the code request (dlg.alex)", () => {
  const atCodeRequest = (): ChapterState =>
    play(atAlexOpen(), [option("alex.opt.open.ask-details"), option("alex.opt.details.go-on")]);

  it("reaches the request for the code, which the player may refuse or hang up on", () => {
    const state = atCodeRequest();
    expect(state.conversation?.nodeId).toBe("alex.pressure");
    expect(state.flags.alex_request_heard).toBe(true);
    expect(optionIds(state)).toEqual(["alex.share-code", "alex.opt.pressure.refuse-code", "alex.opt.pressure.hang-up"]);
    expect(state.flags.code_shared).toBe(false);
  });

  it("sets code_shared only when the player reads the code, and the call ends at the end node", () => {
    const state = play(atCodeRequest(), [option("alex.share-code")]);
    expect(state.flags.code_shared).toBe(true);
    expect(state.conversation).toBeNull();
    expect(state.call.status).toBe("ended");
    expect(state.conversationHistory[0].endNodeId).toBe("alex.code-taken");
  });

  it("refusing the code keeps code_shared false and ends the call when the player checks themselves", () => {
    const refused = play(atCodeRequest(), [option("alex.opt.pressure.refuse-code")]);
    expect(refused.conversation?.nodeId).toBe("alex.refused");
    const state = play(refused, [option("alex.opt.refused.check-myself")]);
    expect(state.flags.code_shared).toBe(false);
    expect(state.flags.first_call_rejected).toBe(true);
    expect(state.call.status).toBe("ended");
  });
});

describe("pressure", () => {
  it("adds 1 per pressure node and keeps the value when a later node is not a pressure node", () => {
    let state = atAlexOpen();
    expect(state.pressure).toBe(0);
    const steps: Array<[string, string, number]> = [
      ["alex.opt.open.ask-details", "alex.details", 1],
      ["alex.opt.details.go-on", "alex.pressure", 2],
      ["alex.opt.pressure.refuse-code", "alex.refused", 2],
    ];
    for (const [optionId, nodeId, pressure] of steps) {
      state = play(state, [option(optionId)]);
      expect(state.conversation?.nodeId).toBe(nodeId);
      expect(state.pressure).toBe(pressure);
    }
  });

  it("caps addPressure effects at MAX_PRESSURE", () => {
    expect(MAX_PRESSURE).toBe(3);
    const state = applyEffect(started(), { kind: "addPressure", amount: 10 }, CHAPTER_1_SCENARIO);
    expect(state.pressure).toBe(3);
    expect(applyEffect(state, { kind: "addPressure" }, CHAPTER_1_SCENARIO)).toBe(state);
  });
});

describe("the third caller's reactive start node (dlg.recovery)", () => {
  const graph = CHAPTER_1_SCENARIO.dialogues["dlg.recovery"];
  const startFor = (state: ChapterState): string => resolveStartNode(state, graph, CHAPTER_1_SCENARIO);

  it("starts at the blank node when nothing is known", () => {
    expect(startFor(afterDeclinedAlex())).toBe("rec.start.blank");
  });

  it("starts at the followed node after Review Security", () => {
    const state = play(afterDeclinedAlex(), [device("dev.open-notification"), device("dev.review-security")]);
    expect(startFor(state)).toBe("rec.start.followed");
  });

  it("starts at the inspected node after the notification origin was checked", () => {
    const state = play(afterDeclinedAlex(), [device("dev.open-notification"), device("dev.inspect-notification-origin")]);
    expect(startFor(state)).toBe("rec.start.inspected");
  });

  it("starts at the confronted node once ded.same-source is recorded", () => {
    const state = play(afterDeclinedAlex(), LINK_FIRST_TWO);
    expect(state.deductions).toEqual(["ded.same-source"]);
    expect(startFor(state)).toBe("rec.start.confronted");
  });

  it("starts at the verified node after the official line, ahead of every other situation", () => {
    const state = play(afterDeclinedAlex(), [...LINK_FIRST_TWO, ...CALL_SAVED_CONTACT]);
    expect(state.flags.official_channel_verified).toBe(true);
    expect(startFor(state)).toBe("rec.start.verified");
  });

  it("starts the conversation at the node the situation selects", () => {
    const state = play(play(afterDeclinedAlex(), LINK_FIRST_TWO), [RING_RECOVERY, ANSWER]);
    expect(state.conversation).toMatchObject({ graphId: "dlg.recovery", nodeId: "rec.start.confronted", callId: "call.recovery" });
  });

  it("each visit runs to an end node and is archived with its history", () => {
    const state = play(play(afterDeclinedAlex(), LINK_FIRST_TWO), [
      RING_RECOVERY,
      ANSWER,
      option("rec.opt.start.confronted.go-on"),
      option("rec.opt.cites-case.hang-up"),
    ]);
    expect(state.conversation).toBeNull();
    expect(state.conversationHistory.at(-1)).toEqual({
      graphId: "dlg.recovery",
      history: [
        { nodeId: "rec.start.confronted", optionId: "rec.opt.start.confronted.go-on" },
        { nodeId: "rec.cites-case", optionId: "rec.opt.cites-case.hang-up" },
      ],
      endNodeId: "rec.end.hung-up",
    });
  });
});

describe("options gated by deductions (dlg.recovery)", () => {
  // The start node differs with the situation; every start node has one "go on" option.
  const goOn = (state: ChapterState): ChapterState => {
    const id = optionIds(state).find((candidate) => candidate.endsWith(".go-on"));
    if (!id) throw new Error(`No go-on option at ${state.conversation?.nodeId}`);
    return play(state, [option(id)]);
  };

  it("offers no challenge option without a deduction, and rejects it", () => {
    const state = goOn(play(afterDeclinedAlex(), [device("dev.review-security"), RING_RECOVERY, ANSWER]));
    expect(state.conversation?.nodeId).toBe("rec.cites-case");
    expect(optionIds(state)).toEqual(["rec.opt.cites-case.continue", "rec.opt.cites-case.hang-up"]);
    const result = chapterReducer(state, option("rec.challenge-case"));
    expect(result).toEqual({ state, accepted: false, reason: OPTION_NOT_AVAILABLE });
  });

  it("offers the case-number challenge once ded.same-source is recorded", () => {
    const state = goOn(play(afterDeclinedAlex(), [...LINK_FIRST_TWO, RING_RECOVERY, ANSWER]));
    expect(optionIds(state)).toContain("rec.challenge-case");
    expect(optionIds(state)).not.toContain("rec.number-not-on-statement");
    const deflected = play(state, [option("rec.challenge-case")]);
    expect(deflected.conversation?.nodeId).toBe("rec.deflect-case");
  });

  it("offers the number challenge once ded.notification-mismatch is recorded", () => {
    const ready = play(afterDeclinedAlex(), [
      device("dev.open-notification"),
      device("dev.inspect-notification-origin"),
      { type: "INTERACT_OBJECT", objectId: "obj.receipts" },
      { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.notification-metadata", "ev.official-contact-paper"] },
      device("dev.review-security"),
      RING_RECOVERY,
      ANSWER,
    ]);
    expect(ready.deductions).toEqual(["ded.notification-mismatch"]);
    const state = goOn(ready);
    expect(optionIds(state)).toContain("rec.number-not-on-statement");
    expect(optionIds(state)).not.toContain("rec.challenge-case");
  });
});

describe("the trust option (dlg.recovery)", () => {
  it("sets second_caller_trusted only when the player trusts the third caller", () => {
    let state = play(afterDeclinedAlex(), [device("dev.review-security"), RING_RECOVERY, ANSWER]);
    state = play(state, [
      option("rec.opt.start.followed.go-on"),
      option("rec.opt.cites-case.continue"),
      option("rec.opt.confirms-alex.what-needed"),
      option("rec.opt.procedure.continue"),
    ]);
    expect(state.conversation?.nodeId).toBe("rec.pressure");
    expect(state.flags.second_caller_trusted).toBe(false);
    expect(state.flags.recovery_instruction_known).toBe(true);
    state = play(state, [option("rec.trust")]);
    expect(state.flags.second_caller_trusted).toBe(true);
    expect(state.call.status).toBe("ended");
  });

  it("discovers the third caller's statement at rec.cites-case", () => {
    const state = play(afterDeclinedAlex(), [
      device("dev.review-security"),
      RING_RECOVERY,
      ANSWER,
      option("rec.opt.start.followed.go-on"),
    ]);
    expect(state.discovered).toContain("ev.recovery-statement");
  });
});

describe("the official line (dlg.official-line)", () => {
  it("confirms nothing before the confirmation node, and contradicts the claims when it is reached", () => {
    const calling = play(afterDeclinedAlex(), [
      { type: "INTERACT_OBJECT", objectId: "obj.receipts" },
      { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
    ]);
    expect(calling.conversation).toMatchObject({ graphId: "dlg.official-line", nodeId: "off.open", callId: "call.official" });
    expect(calling.flags.official_channel_verified).toBe(false);
    expect(Object.values(calling.claims)).not.toContain("contradicted");
    const confirmed = play(calling, [option("off.opt.open.ask-case"), option("off.opt.ask.give-case")]);
    expect(confirmed.flags.official_channel_verified).toBe(true);
    expect(confirmed.discovered).toContain("ev.official-confirmation");
    expect(Object.values(confirmed.claims)).toEqual(["contradicted", "contradicted", "contradicted", "contradicted"]);
  });

  it("hanging up before the confirmation changes no claim", () => {
    const state = play(afterDeclinedAlex(), [
      { type: "INTERACT_OBJECT", objectId: "obj.receipts" },
      { type: "VERIFY_CLAIM", claimId: "claim.alex-identity", method: "saved-official-contact" },
      option("off.opt.open.hang-up"),
    ]);
    expect(state.flags.official_channel_verified).toBe(false);
    expect(Object.values(state.claims)).toEqual(["unverified", "unverified", "unverified", "unverified"]);
    expect(state.call.status).toBe("ended");
  });
});

describe("fallback option", () => {
  /** Scenario clone where no authored option at Alex's opening node is available. */
  function scenarioWithBlockedOpening(): ScenarioDefinition {
    const clone = JSON.parse(JSON.stringify(CHAPTER_1_SCENARIO)) as ScenarioDefinition;
    for (const opt of clone.dialogues["dlg.alex"].nodes["alex.open"].options) {
      opt.conditions = [{ kind: "flag", flag: "money_moved" }];
    }
    return clone;
  }

  const atBlockedOpening = (scenario: ScenarioDefinition): ChapterState =>
    play(createInitialState(scenario), [{ type: "START_CHAPTER" }, RING_ALEX, ANSWER], scenario);

  it("is the only option when no authored option is available", () => {
    const scenario = scenarioWithBlockedOpening();
    const state = atBlockedOpening(scenario);
    expect(availableOptions(state, scenario)).toEqual([
      { id: FALLBACK_OPTION_ID, lineId: "__fallback.end", text: FALLBACK_OPTION_TEXT, fallback: true },
    ]);
    expect(FALLBACK_OPTION_TEXT).toBe("End the conversation");
    expect(chapterReducer(state, option("alex.opt.open.hang-up"), scenario).reason).toBe(OPTION_NOT_AVAILABLE);
  });

  it("ends the conversation and the call when selected", () => {
    const scenario = scenarioWithBlockedOpening();
    const state = play(atBlockedOpening(scenario), [option(FALLBACK_OPTION_ID)], scenario);
    expect(state.conversation).toBeNull();
    expect(state.call.status).toBe("ended");
    expect(state.conversationHistory).toEqual([
      {
        graphId: "dlg.alex",
        history: [{ nodeId: "alex.open", optionId: FALLBACK_OPTION_ID }],
        endNodeId: null,
      },
    ]);
  });

  it("is not available when an authored option is available", () => {
    const state = atAlexOpen();
    expect(optionIds(state)).not.toContain(FALLBACK_OPTION_ID);
    expect(chapterReducer(state, option(FALLBACK_OPTION_ID)).reason).toBe(OPTION_NOT_AVAILABLE);
  });
});
