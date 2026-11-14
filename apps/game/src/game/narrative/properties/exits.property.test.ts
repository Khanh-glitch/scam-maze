// Feature: chapter-01-double-deception, Property 11: Exits are always available
// Validates: Requirements 10.1, 10.2, 11.3, 12.1
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  DECLINE_ALEX,
  caseSeed,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { availableOptions } from "../dialogueEngine";
import { chapterReducer, createInitialState } from "../reducer";
import { selectDecisionPanel } from "../selectors";
import type { ChapterState, CoreAction } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const EXITS_SEED = (CORE_PROPERTY_SEED ^ 0x000b000b) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 120_000;

const END_CALL: CoreAction = { type: "END_CALL" };

/** Played from the start so about half of the cases begin close to Act V. */
const TO_ACT_FIVE: readonly CoreAction[] = [
  { type: "START_CHAPTER" },
  ...DECLINE_ALEX,
  { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" },
  { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" },
  END_CALL,
];

function startState(steered: boolean): ChapterState {
  let state = createInitialState();
  if (!steered) return state;
  for (const action of TO_ACT_FIVE) state = chapterReducer(state, action, CHAPTER_1_SCENARIO).state;
  return state;
}

interface Counts {
  states: number;
  calls: number;
  dialogueNodes: number;
  actFive: number;
  verifyChecks: number;
  reportOffered: number;
}

/** Messages for every violated exit rule in `state`. */
function exitViolations(state: ChapterState, counts: Counts): string[] {
  const out: string[] = [];
  counts.states += 1;

  // END_CALL whenever a call is ringing or active.
  if (state.call.status === "ringing" || state.call.status === "active") {
    counts.calls += 1;
    const result = chapterReducer(state, END_CALL, CHAPTER_1_SCENARIO);
    if (!result.accepted) out.push(`END_CALL rejected while call is ${state.call.status}: ${result.reason ?? ""}`);
  }

  // A hang-up option exists and is available on every active dialogue node with options.
  if (state.call.status === "active" && state.conversation !== null) {
    const options = availableOptions(state, CHAPTER_1_SCENARIO);
    if (options.length > 0) {
      counts.dialogueNodes += 1;
      const graph = CHAPTER_1_SCENARIO.dialogues[state.conversation.graphId];
      const node = graph.nodes[state.conversation.nodeId];
      const hangUp = options.some((view) => {
        // The fallback option always ends the conversation.
        if (view.fallback) return true;
        const authored = node.options.find((candidate) => candidate.id === view.id);
        if (!authored) return false;
        if (typeof authored.next === "object") return authored.next.end === "hang-up";
        return Object.hasOwn(graph.nodes, authored.next) && graph.nodes[authored.next].end?.kind === "hung-up";
      });
      if (!hangUp) {
        out.push(
          `no available hang-up option at ${state.conversation.graphId}/${state.conversation.nodeId}: ` +
            options.map((option) => option.id).join(", "),
        );
      }
    }
  }

  // Report only after ded.same-source, in the reducer and in the panel.
  const same = state.deductions.includes("ded.same-source");
  const report = chapterReducer(state, { type: "MAKE_DECISION", decision: "report-deception" }, CHAPTER_1_SCENARIO);
  if (report.accepted && !same) out.push("report-deception accepted without ded.same-source");

  const panel = selectDecisionPanel(state, CHAPTER_1_SCENARIO);
  const free = state.call.current === null && state.conversation === null;
  const panelOption = (id: string) => panel.options.find((option) => option.id === id);
  const reportView = panelOption("report-deception");
  if (reportView?.available === true && !same) out.push("panel offers report-deception without ded.same-source");

  if (panel.offered) {
    counts.actFive += 1;
    const refuse = panelOption("refuse-and-stop");
    if (!refuse) out.push("panel has no refuse-and-stop option");
    else if (free) {
      if (!refuse.available) out.push("refuse-and-stop unavailable in Act V with no call or conversation");
      const result = chapterReducer(state, { type: "MAKE_DECISION", decision: "refuse-and-stop" }, CHAPTER_1_SCENARIO);
      if (!result.accepted) out.push(`refuse-and-stop rejected in Act V: ${result.reason ?? ""}`);
    }
    if (free && same && reportView?.available !== true) out.push("report-deception unavailable although ded.same-source is recorded");
    if (free && same) counts.reportOffered += 1;

    // verify-independently: its pre-step is available whenever E03 or E03b is discovered.
    const knowsContact =
      state.discovered.includes("ev.official-contact-paper") || state.discovered.includes("ev.official-contact-app");
    const verify = panelOption("verify-independently");
    if (!verify) out.push("panel has no verify-independently option");
    else if (knowsContact) {
      counts.verifyChecks += 1;
      const step = verify.preStep;
      if (!step) out.push("verify-independently has no pre-step");
      else if (free && !step.available && !step.done) out.push("verify pre-step unavailable although E03 or E03b is discovered");
      const verified = state.flags.official_channel_verified === true;
      if (free && verified && !verify.available) out.push("verify-independently unavailable after the official channel was verified");
    }
  }
  return out;
}

describe("Property 11: exits are always available", () => {
  it("keeps hang-up, refuse-and-stop, verify and report rules in every reachable state", () => {
    const counts: Counts = { states: 0, calls: 0, dialogueNodes: 0, actFive: 0, verifyChecks: 0, reportOffered: 0 };
    const failures: string[] = [];
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(EXITS_SEED, index);
      const next = createLcg(seed);
      const length = randomInt(next, 0, CORE_SEQUENCE_MAX_LENGTH);
      const initial = startState(index % 2 === 1);
      const run = runSequence(generateActionSequence(seed, length, initial), initial);
      run.states.forEach((state, step) => {
        for (const message of exitViolations(state, counts)) {
          failures.push(`seed ${seed} (case ${index}, state ${step}): ${message}`);
        }
      });
    }
    expect(failures.slice(0, 10), `${failures.length} violations; base seed ${EXITS_SEED}`).toEqual([]);
    // The property must actually exercise each rule.
    expect(counts.calls).toBeGreaterThan(0);
    expect(counts.dialogueNodes).toBeGreaterThan(0);
    expect(counts.actFive).toBeGreaterThan(0);
    expect(counts.verifyChecks, "verify-independently rule never exercised").toBeGreaterThan(0);
    expect(counts.reportOffered, "report-deception rule never exercised").toBeGreaterThan(0);
  }, PROPERTY_TIMEOUT_MS);

  it("has no timer or countdown field in the scenario data", () => {
    const timerKey = /timer|timeout|countdown|deadline|timeLimit|expire|seconds|durationMs/i;
    const found: string[] = [];
    const walk = (value: unknown, path: string): void => {
      if (Array.isArray(value)) {
        value.forEach((item, i) => walk(item, `${path}[${i}]`));
      } else if (value !== null && typeof value === "object") {
        for (const [key, child] of Object.entries(value)) {
          if (timerKey.test(key)) found.push(`${path}.${key}`);
          walk(child, `${path}.${key}`);
        }
      }
    };
    walk(CHAPTER_1_SCENARIO, "scenario");
    expect(found).toEqual([]);
  });
});
