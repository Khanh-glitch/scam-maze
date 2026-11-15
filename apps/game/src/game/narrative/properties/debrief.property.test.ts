// Feature: chapter-01-double-deception, Property 14: Debrief is derived and honest
// Validates: Requirements 16.1, 16.2, 16.3, 16.4
// Each case runs a seeded random action sequence, then completes the chapter with the guided
// policy, and checks `buildDebrief` against values computed here from Scenario_Data,
// `state.discovered` and `state.events`. The scripted endings A to D (with variants) cover all
// four outcomes. Failure messages carry the seed and the case index.

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  completeChapterFrom,
  generateActionSequence,
  reachEndingA,
  reachEndingB,
  reachEndingC,
  reachEndingD,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { BEAT_TAG_PREFIX } from "../beats";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { OUTCOME_IDS, type EvidenceId } from "../chapter1/ids";
import { buildDebrief } from "../debrief";
import type { ChapterState } from "../types";

/** Seed offset so this file's sequences differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x000e) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const scenario = CHAPTER_1_SCENARIO;

/** Returns one message per violated check for a state that has an outcome. */
function debriefProblems(state: ChapterState): string[] {
  const problems: string[] = [];
  const check = (ok: boolean, message: string): void => {
    if (!ok) problems.push(message);
  };

  const eventsBefore = JSON.stringify(state.events);
  const stateBefore = JSON.stringify(state);
  const view = buildDebrief(state, scenario);
  if (view === null) return ["debrief is null for a state with an outcome"];

  // Pure: same state gives an equal debrief, the input is not mutated, the event log is unchanged.
  check(JSON.stringify(buildDebrief(state, scenario)) === JSON.stringify(view), "debrief differs when built twice");
  check(JSON.stringify(state) === stateBefore, "buildDebrief mutated the state");
  check(JSON.stringify(state.events) === eventsBefore, "buildDebrief rewrote the event log");

  // Timeline: seq order, one entry per event with a non-beat tag, no beat entries.
  const seqs = view.timeline.map((entry) => entry.seq);
  check(seqs.every((seq, i) => i === 0 || seq > seqs[i - 1]), `timeline is not in seq order: ${seqs.join(",")}`);
  const expectedSeqs = state.events
    .filter((entry) => entry.derived.debriefTags.some((tag) => !tag.startsWith(BEAT_TAG_PREFIX)))
    .map((entry) => entry.seq);
  check(JSON.stringify(seqs) === JSON.stringify(expectedSeqs), `timeline seqs ${seqs.join(",")} != tagged events ${expectedSeqs.join(",")}`);
  for (const entry of view.timeline) {
    const event = state.events[entry.seq];
    check(event !== undefined, `timeline entry ${entry.seq} has no event`);
    check(!entry.tag.startsWith(BEAT_TAG_PREFIX), `timeline entry ${entry.seq} is a beat (${entry.tag})`);
    check(event?.derived.debriefTags.includes(entry.tag) === true, `timeline tag ${entry.tag} is not on event ${entry.seq}`);
    check(entry.text.trim() !== "", `timeline entry ${entry.seq} (${entry.tag}) has empty text`);
    check(
      Object.hasOwn(scenario.debrief.decisionNotes, entry.tag) && entry.text === scenario.debrief.decisionNotes[entry.tag],
      `timeline entry ${entry.seq} text for ${entry.tag} is not from scenario data`,
    );
  }

  // Found evidence equals discovered evidence exactly.
  check(
    JSON.stringify(view.evidenceFound.map((item) => item.id)) === JSON.stringify(state.discovered),
    "evidenceFound differs from state.discovered",
  );

  // Missed clues: only undiscovered, disjoint from found, exactly the hinted undiscovered items.
  const foundIds = new Set<string>(view.evidenceFound.map((item) => item.id));
  for (const clue of view.cluesMissed) {
    check(!state.discovered.includes(clue.id), `missed clue ${clue.id} was discovered`);
    check(!foundIds.has(clue.id), `missed clue ${clue.id} is also in evidenceFound`);
  }
  const expectedMissed = (Object.keys(scenario.evidence) as EvidenceId[]).filter(
    (id) => Boolean(scenario.evidence[id].debriefHint) && !state.discovered.includes(id),
  );
  check(
    JSON.stringify(view.cluesMissed.map((clue) => clue.id)) === JSON.stringify(expectedMissed),
    "cluesMissed is not the hinted undiscovered evidence",
  );

  // Analysis.
  const flags = state.flags;
  const first = flags.code_shared === true;
  const second = flags.money_moved === true || flags.second_caller_trusted === true;
  const expectedTrap = first && second ? "both" : first ? "first" : second ? "second" : "none";
  check(view.analysis.trapEntered === expectedTrap, `trapEntered ${view.analysis.trapEntered} != ${expectedTrap}`);
  check(view.analysis.thirdCallerIndependent === false, "thirdCallerIndependent is not false");
  check(view.analysis.pressureLevel === state.pressure, "pressureLevel differs from state.pressure");
  for (const [name, text] of Object.entries({
    pressureBuilt: view.analysis.pressureBuilt,
    whyWarningLooked: view.analysis.whyWarningLooked,
    trapNote: view.analysis.trapNote,
  })) {
    check(text.trim() !== "", `analysis.${name} is empty`);
  }
  check(view.analysis.verifyNextTime.length > 0, "analysis.verifyNextTime is empty");

  // The third caller is mentioned only when the player answered that call (P2-6).
  const answeredThird = state.call.log.some(
    (record) => record.callId === "call.recovery" && (record.status === "answered" || record.status === "ended"),
  );
  check(view.analysis.thirdCallerEncountered === answeredThird, `thirdCallerEncountered ${view.analysis.thirdCallerEncountered} != ${answeredThird}`);
  if (answeredThird) {
    check((view.analysis.thirdCallerNote ?? "").trim() !== "", "analysis.thirdCallerNote is empty after the third call");
  } else {
    check(view.analysis.thirdCallerNote === null, "analysis.thirdCallerNote is set without a third call");
  }
  return problems;
}

describe("Property 14: Debrief is derived and honest", () => {
  it("is a pure, honest function of the state for random completed runs", () => {
    const outcomes = new Set<string>();
    const failures: string[] = [];
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5a5a5a5a), 0, CORE_SEQUENCE_MAX_LENGTH);
      const { outcomeState, final } = completeChapterFrom(runSequence(generateActionSequence(seed, length)).final);
      for (const [name, state] of [["outcome state", outcomeState], ["finished state", final]] as const) {
        if (name === "outcome state" && state.outcome !== null) outcomes.add(state.outcome);
        for (const problem of debriefProblems(state)) failures.push(`seed ${seed}, case ${index} (${name}): ${problem}`);
      }
    }
    expect(failures, failures.slice(0, 10).join("\n")).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);

  it("holds for all four endings and their variants", () => {
    const runs = {
      A: reachEndingA(),
      B: reachEndingB(),
      C: reachEndingC(),
      "C case-report": reachEndingC({ caseReport: true }),
      D: reachEndingD(),
      "D evidence-built": reachEndingD({ evidenceBuilt: true }),
    };
    const failures: string[] = [];
    const reached = new Set<string>();
    for (const [name, run] of Object.entries(runs)) {
      reached.add(run.outcomeState.outcome ?? "none");
      for (const state of [run.outcomeState, run.final]) {
        for (const problem of debriefProblems(state)) failures.push(`ending ${name}: ${problem}`);
      }
    }
    expect(failures, failures.join("\n")).toEqual([]);
    expect([...reached].sort()).toEqual([...OUTCOME_IDS].sort());
  }, PROPERTY_TIMEOUT_MS);

  it("returns null when there is no outcome", () => {
    const run = runSequence([{ type: "START_CHAPTER" }]);
    expect(buildDebrief(run.final, scenario)).toBeNull();
  });
});
