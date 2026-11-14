// Feature: chapter-01-double-deception, Property 12: Ending selection is a deterministic total function
// Outcome lock: once an ending is set it never changes and only FINISH_CHAPTER is accepted.
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  MALFORMED_ACTIONS,
  caseSeed,
  completeChapterFrom,
  describeAction,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import {
  CLAIM_IDS,
  DECISION_IDS,
  DEVICE_ACTION_IDS,
  EVIDENCE_IDS,
  INTERACTABLE_IDS,
  NPC_IDS,
  OBJECTIVE_IDS,
  VERIFY_METHODS,
  type DecisionId,
  type IncomingCallId,
} from "../chapter1/ids";
import { selectOutcome } from "../outcome";
import { chapterReducer, isCoreAction } from "../reducer";
import type { ChapterState, CoreAction, RingReason } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const TERMINAL_SEED = (CORE_PROPERTY_SEED ^ 0x000c0013) >>> 0;

/** Number of generated probe values per case, on top of the fixed lists. */
const GENERATED_PROBES = 40;

const INCOMING_CALLS: readonly IncomingCallId[] = ["call.alex", "call.recovery"];
const RING_REASONS: readonly RingReason[] = ["first-interaction", "exploration-timer", "re-ring", "callback", "follow-up"];

/** Every authored option ID across all graphs, plus one that exists nowhere. */
const OPTION_IDS: readonly string[] = [
  ...Object.values(CHAPTER_1_SCENARIO.dialogues).flatMap((graph) =>
    Object.values(graph.nodes).flatMap((node) => node.options.map((option) => option.id)),
  ),
  "opt.does-not-exist",
];

/** Well-formed actions of every Core_Action type, with every known ID for each parameter. */
const WELL_FORMED_ACTIONS: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  ...INTERACTABLE_IDS.map((objectId): CoreAction => ({ type: "INTERACT_OBJECT", objectId })),
  ...EVIDENCE_IDS.map((evidenceId): CoreAction => ({ type: "INSPECT_EVIDENCE", evidenceId })),
  { type: "OPEN_PHONE" },
  { type: "CLOSE_PHONE" },
  ...INCOMING_CALLS.flatMap((callId) =>
    RING_REASONS.map((reason): CoreAction => ({ type: "RING_CALL", callId, reason })),
  ),
  { type: "ANSWER_CALL" },
  { type: "END_CALL" },
  ...NPC_IDS.map((npcId): CoreAction => ({ type: "TALK_TO_NPC", npcId })),
  ...OPTION_IDS.map((optionId): CoreAction => ({ type: "SELECT_DIALOGUE_OPTION", optionId })),
  ...CLAIM_IDS.flatMap((claimId) =>
    VERIFY_METHODS.map((method): CoreAction => ({ type: "VERIFY_CLAIM", claimId, method })),
  ),
  ...DECISION_IDS.map((decision): CoreAction => ({ type: "MAKE_DECISION", decision })),
  ...OBJECTIVE_IDS.map((objectiveId): CoreAction => ({ type: "COMPLETE_OBJECTIVE", objectiveId })),
  ...DEVICE_ACTION_IDS.map((deviceActionId): CoreAction => ({ type: "DEVICE_ACTION", deviceActionId })),
  { type: "COMBINE_EVIDENCE", evidenceIds: ["ev.alex-statement", "ev.shared-case-id"] },
  { type: "FINISH_CHAPTER" },
];

function isFinish(value: unknown): boolean {
  return isCoreAction(value) && value.type === "FINISH_CHAPTER";
}

/** Picks a random decision that the reducer accepts in `state`, so all four endings occur. */
function randomAcceptedDecision(next: () => number): (state: ChapterState) => DecisionId {
  return (state) => {
    const accepted = DECISION_IDS.filter(
      (decision) => chapterReducer(state, { type: "MAKE_DECISION", decision }).accepted,
    );
    return accepted.length > 0 ? pick(next, accepted) : "refuse-and-stop";
  };
}

/**
 * A reachable state with an Outcome, just before FINISH_CHAPTER: the first state of a random run
 * that has an Outcome, or, when the run never reaches one, the guided policy's outcome state.
 */
function outcomeStateFor(seed: number): ChapterState {
  const next = createLcg(seed);
  const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
  const run = runSequence(generateActionSequence(seed, length));
  const reached = run.states.find((state) => state.outcome !== null);
  return reached ?? completeChapterFrom(run.final, undefined, undefined, randomAcceptedDecision(next)).outcomeState;
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

describe("chapter core terminal state (Property 12, outcome lock)", () => {
  it("accepts only FINISH_CHAPTER after the Outcome, and nothing after it", () => {
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(TERMINAL_SEED, index);
      const context = `seed ${seed} (case ${index})`;
      const outcomeState = outcomeStateFor(seed);
      expect(outcomeState.outcome, context).not.toBeNull();
      expect(outcomeState.status, context).not.toBe("finished");
      // The locked outcome is the one the ending table selects for the recorded decision.
      expect(outcomeState.outcome, `${context}, selection`).toBe(selectOutcome(outcomeState));

      const probes: unknown[] = [
        ...generateActionSequence(caseSeed(seed, 1), GENERATED_PROBES, outcomeState),
        ...MALFORMED_ACTIONS,
        ...WELL_FORMED_ACTIONS,
      ];

      // With an Outcome set, everything except FINISH_CHAPTER is rejected unchanged.
      for (const probe of probes) {
        if (isFinish(probe)) continue;
        const result = chapterReducer(outcomeState, probe);
        const where = `${context}, action ${describeAction(probe)}`;
        expect(result.accepted, where).toBe(false);
        expect(result.state, where).toBe(outcomeState);
        expect(result.reason, where).toBeTruthy();
      }

      // FINISH_CHAPTER is accepted once and keeps the outcome and the decision.
      const finish = chapterReducer(outcomeState, { type: "FINISH_CHAPTER" });
      expect(finish.accepted, context).toBe(true);
      const finished = finish.state;
      expect(finished.status, context).toBe("finished");
      expect(finished.outcome, context).toBe(outcomeState.outcome);
      expect(finished.decision, context).toBe(outcomeState.decision);

      // After FINISH_CHAPTER, everything is rejected unchanged, including FINISH_CHAPTER.
      for (const probe of probes) {
        const result = chapterReducer(finished, probe);
        const where = `${context}, after finish, action ${describeAction(probe)}`;
        expect(result.accepted, where).toBe(false);
        expect(result.state, where).toBe(finished);
        expect(result.reason, where).toBeTruthy();
      }
    }
  }, PROPERTY_TIMEOUT_MS);
});
