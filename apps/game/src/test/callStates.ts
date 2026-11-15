/**
 * Generated Chapter 1 call states for the call presentation property tests
 * (.kiro/specs/game-3d-phone-call-ui/design.md, "Testing Strategy"; Requirements 13.10, 13.11),
 * rewritten for the double-deception graphs `dlg.alex`, `dlg.recovery` and `dlg.official-line`.
 *
 * For a seed, the helper picks one of the three Chapter 1 calls and builds its setup prefix:
 * - first call (`call.alex`): START_CHAPTER, RING_CALL call.alex;
 * - third call (`call.recovery`): an Alex call that is answered, walked for 0 to 3 options that
 *   set no Decision, hung up if still live, then the laptop notification is followed
 *   (Review Security), which lets the third call ring, then RING_CALL call.recovery;
 * - official line (`call.official`): the decision-panel prefix (the statement is read, the first
 *   call is closed), then VERIFY_CLAIM with the saved official contact. The line starts active.
 * It then either stops while the call rings (incoming calls only) or answers, and walks 0 to 6
 * randomly chosen available options. The locale (`en` or `vi`) is generated too. Every state
 * comes from `chapterReducer` through `runSequence`.
 *
 * The walk stops early when the conversation has no available option, and it never takes an
 * option that ends the call or sets an Outcome, so the final state always has a live call
 * (ringing or active) and the call presentation is shown for it.
 *
 * Like chapterRuns.ts, this module imports only the pure chapter core and test helpers (no
 * React, no Testing Library).
 */

import type { GameLocale } from "@scammaze/shared-types";

import type { CallId } from "../game/narrative/chapter1/ids";
import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import { availableOptions } from "../game/narrative/dialogueEngine";
import { chapterReducer, createInitialState } from "../game/narrative/reducer";
import type { ChapterState, CoreAction } from "../game/narrative/types";
import { SUPPORTED_LOCALES } from "../i18n/locales";
import { caseSeed, describeAction, runSequence, type SequenceRun } from "./chapterRuns";
import { createLcg, pick, randomInt } from "./seededRandom";

/** Fixed seed for the call presentation property tests. Files derive per-case seeds from it. */
export const CALL_STATE_SEED = 0x3d9c0a11;

/** The three Chapter 1 calls a generated state can hold. */
export const GENERATED_CALLS: readonly CallId[] = ["call.alex", "call.recovery", "call.official"];

/** Largest number of options walked after the call is answered (design: 0 to 6). */
export const CALL_WALK_MAX_OPTIONS = 6;

/** Largest number of options walked inside the first call of the third-call prefix. */
const THIRD_CALL_PREFIX_MAX_OPTIONS = 3;

const START: CoreAction = { type: "START_CHAPTER" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const END_CALL: CoreAction = { type: "END_CALL" };

function option(optionId: string): CoreAction {
  return { type: "SELECT_DIALOGUE_OPTION", optionId };
}

/**
 * A prefix that closes the first call (hung up at its first node), reads the paper statement and
 * leaves the phone closed with no Decision. After it, the laptop notification exists, the saved
 * official contact is known and the decision panel can be offered.
 */
export const DECISION_PANEL_PREFIX: readonly CoreAction[] = [
  START,
  { type: "INTERACT_OBJECT", objectId: "obj.receipts" },
  { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" },
  ANSWER,
  option("alex.opt.open.hang-up"),
  { type: "OPEN_PHONE" },
  { type: "CLOSE_PHONE" },
];

const OFFICIAL_LINE_CALL: CoreAction = {
  type: "VERIFY_CLAIM",
  claimId: "claim.alex-identity",
  method: "saved-official-contact",
};

export interface GeneratedCallState {
  seed: number;
  callId: CallId;
  locale: GameLocale;
  /** Actions that bring the call onto the phone (ringing, or active for the official line). */
  setup: CoreAction[];
  /** ANSWER_CALL (when answered) and the walked SELECT_DIALOGUE_OPTION actions. */
  walk: CoreAction[];
  /** `setup` followed by `walk`; every action is accepted. */
  actions: CoreAction[];
  /** The reducer run of `actions` from `createInitialState()`. */
  run: SequenceRun;
  /** `run.final`: the call is current and ringing or active. */
  state: ChapterState;
  /** True when the generator stopped while the call rings. */
  ringing: boolean;
  /** Number of options walked after the call was answered (0 to 6). */
  optionsWalked: number;
}

/** Applies `action` and throws when the reducer rejects it (the generator must stay valid). */
function step(state: ChapterState, action: CoreAction, seed: number): ChapterState {
  const result = chapterReducer(state, action);
  if (!result.accepted) {
    throw new Error(
      `callStates: seed ${seed}: ${describeAction(action)} was rejected: ${result.reason ?? "no reason"}`,
    );
  }
  return result.state;
}

function liveCall(state: ChapterState): boolean {
  return state.call.status === "ringing" || state.call.status === "active";
}

/**
 * Walks up to `count` random available options of the current conversation. Stops when no option
 * is available, and does not take an option for which `keep(next)` is false. Pushes the taken
 * actions onto `actions` and returns the last state.
 */
function walkOptions(
  next: () => number,
  start: ChapterState,
  count: number,
  keep: (state: ChapterState) => boolean,
  actions: CoreAction[],
  seed: number,
): ChapterState {
  let state = start;
  for (let i = 0; i < count; i += 1) {
    const options = availableOptions(state, CHAPTER_1_SCENARIO);
    if (options.length === 0) break;
    const action = option(pick(next, options).id);
    const after = step(state, action, seed);
    if (!keep(after)) break;
    actions.push(action);
    state = after;
  }
  return state;
}

/** START_CHAPTER, RING_CALL call.alex. */
function firstCallSetup(): CoreAction[] {
  return [START, { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" }];
}

/**
 * A first call that is answered, walked for 0 to 3 options that set no Decision, then hung up if
 * it is still live; then the notification is followed (Review Security, which lets the third call
 * ring) and RING_CALL call.recovery.
 */
function thirdCallSetup(next: () => number, seed: number): CoreAction[] {
  const actions = [...firstCallSetup(), ANSWER];
  let state = createInitialState();
  for (const action of actions) state = step(state, action, seed);
  state = walkOptions(
    next,
    state,
    randomInt(next, 0, THIRD_CALL_PREFIX_MAX_OPTIONS),
    (after) => after.decision === null,
    actions,
    seed,
  );
  if (state.call.current !== null) actions.push(END_CALL);
  actions.push({ type: "DEVICE_ACTION", deviceActionId: "dev.review-security" });
  actions.push({ type: "RING_CALL", callId: "call.recovery", reason: "follow-up" });
  return actions;
}

/** The decision-panel prefix, then the official-line call (it starts active). */
function officialLineSetup(): CoreAction[] {
  return [...DECISION_PANEL_PREFIX, OFFICIAL_LINE_CALL];
}

/** Builds one generated call state from `seed`. Throws if a generated action is rejected. */
export function generateCallState(seed: number): GeneratedCallState {
  const next = createLcg(seed);
  const callId = pick(next, GENERATED_CALLS);
  const locale = pick(next, SUPPORTED_LOCALES);

  const setup =
    callId === "call.alex"
      ? firstCallSetup()
      : callId === "call.recovery"
        ? thirdCallSetup(next, seed)
        : officialLineSetup();

  let state = createInitialState();
  for (const action of setup) state = step(state, action, seed);
  if (state.call.current !== callId || !liveCall(state)) {
    throw new Error(`callStates: seed ${seed}: setup did not bring ${callId} onto the phone`);
  }

  const walk: CoreAction[] = [];
  let ringing = false;
  let optionsWalked = 0;
  if (state.call.status === "ringing" && next() < 0.5) {
    ringing = true;
  } else {
    if (state.call.status === "ringing") {
      walk.push(ANSWER);
      state = step(state, ANSWER, seed);
    }
    const before = walk.length;
    state = walkOptions(
      next,
      state,
      randomInt(next, 0, CALL_WALK_MAX_OPTIONS),
      (after) => after.call.current === callId && liveCall(after) && after.outcome === null,
      walk,
      seed,
    );
    optionsWalked = walk.length - before;
  }

  const actions = [...setup, ...walk];
  const run = runSequence(actions);
  return { seed, callId, locale, setup, walk, actions, run, state: run.final, ringing, optionsWalked };
}

/** `count` generated call states, case `i` built from `caseSeed(baseSeed, i)`. */
export function generateCallStates(count: number, baseSeed: number = CALL_STATE_SEED): GeneratedCallState[] {
  return Array.from({ length: count }, (_, index) => generateCallState(caseSeed(baseSeed, index)));
}

/** Short printable form of a generated call state, for failure messages (seed, call, locale). */
export function describeCallState(generated: GeneratedCallState): string {
  const mode = generated.ringing ? "ringing" : `answered, ${generated.optionsWalked} options`;
  return `seed ${generated.seed} ${generated.callId} (${mode}) locale ${generated.locale}: ${generated.actions
    .map(describeAction)
    .join(", ")}`;
}
