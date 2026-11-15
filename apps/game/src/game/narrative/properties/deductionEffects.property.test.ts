// Feature: chapter-01-double-deception, Property 9: Deductions change later gameplay
// Validates: Requirements 8.10, 9.2, 10.3
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  DECLINE_ALEX,
  caseSeed,
  generateActionSequence,
  runSequence,
} from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import type { DeductionId, DeviceActionId, EvidenceId } from "../chapter1/ids";
import { availableOptions } from "../dialogueEngine";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction, DeductionDef } from "../types";

/** Distinct base seed so this file's cases differ from the other property files. */
const DEDUCTION_EFFECTS_SEED = (CORE_PROPERTY_SEED ^ 0x00090009) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 90_000;

const SCENARIO = CHAPTER_1_SCENARIO;

const START: CoreAction = { type: "START_CHAPTER" };
const device = (deviceActionId: DeviceActionId): CoreAction => ({ type: "DEVICE_ACTION", deviceActionId });

/** Prefixes that stop just before a deduction becomes possible. */
const PREFIXES: readonly (readonly CoreAction[])[] = [
  [START, ...DECLINE_ALEX, device("dev.open-alex-record"), device("dev.open-notification"), device("dev.inspect-notification-origin"), device("dev.compare-case-ref")],
  [START, ...DECLINE_ALEX, device("dev.open-notification"), device("dev.inspect-notification-origin"), { type: "INTERACT_OBJECT", objectId: "obj.receipts" }],
  [
    START,
    ...DECLINE_ALEX,
    device("dev.open-bank-app"),
    device("dev.open-saved-contacts"),
    device("dev.open-alex-record"),
    device("dev.open-notification"),
    device("dev.inspect-notification-origin"),
    device("dev.compare-case-ref"),
  ],
];

/** Final state of each prefix: the points where a deduction is ready to be recorded. */
const PREFIX_ENDS: ChapterState[] = PREFIXES.map((prefix) => {
  let state = createInitialState(SCENARIO);
  for (const action of prefix) state = chapterReducer(state, action, SCENARIO).state;
  return state;
});

/** Evidence sets that match `deduction` (one per `inputsAnyOf` alternative). */
function evidenceSets(deduction: DeductionDef): EvidenceId[][] {
  if (!deduction.inputsAnyOf) return [[...deduction.inputs]];
  return deduction.inputsAnyOf.map((extra) => [...deduction.inputs, extra]);
}

function combineAction(ids: EvidenceId[]): CoreAction {
  return { type: "COMBINE_EVIDENCE", evidenceIds: ids };
}

interface Pair {
  before: ChapterState;
  after: ChapterState;
}

/** A reachable state where COMBINE records `target`, and the state after the COMBINE. */
function findPair(next: () => number, seed: number, target: DeductionId): Pair | null {
  const deduction = SCENARIO.deductions[target];
  const ready = PREFIX_ENDS.filter((state) =>
    evidenceSets(deduction).some((ids) => chapterReducer(state, combineAction(ids), SCENARIO).accepted),
  );
  if (ready.length === 0) return null;
  const start = pick(next, ready);
  const length = randomInt(next, 0, 20);
  const run = runSequence(generateActionSequence(seed, length, start, SCENARIO), start, SCENARIO);
  const states = [...run.states];
  for (let i = states.length - 1; i > 0; i -= 1) {
    const j = randomInt(next, 0, i);
    [states[i], states[j]] = [states[j], states[i]];
  }
  for (const before of states) {
    for (const ids of evidenceSets(deduction)) {
      const result = chapterReducer(before, combineAction(ids), SCENARIO);
      if (result.accepted && result.state.deductions.includes(target) && !before.deductions.includes(target)) {
        return { before, after: result.state };
      }
    }
  }
  return null;
}

/** Plays the third call up to the node `rec.cites-case`. Returns the state there, the start node and the options. */
function playToCitesCase(state: ChapterState): { at: ChapterState; startNode: string } | null {
  if (state.call.current !== null || state.conversation !== null || state.decision !== null) return null;
  let current = state;
  for (const action of [{ type: "RING_CALL", callId: "call.recovery", reason: "follow-up" }, { type: "ANSWER_CALL" }] as CoreAction[]) {
    const result = chapterReducer(current, action, SCENARIO);
    if (!result.accepted) return null;
    current = result.state;
  }
  const startNode = current.conversation?.nodeId ?? "";
  const [first] = availableOptions(current, SCENARIO);
  if (!first) return null;
  const go = chapterReducer(current, { type: "SELECT_DIALOGUE_OPTION", optionId: first.id }, SCENARIO);
  if (!go.accepted || go.state.conversation?.nodeId !== "rec.cites-case") return null;
  return { at: go.state, startNode };
}

function optionIds(state: ChapterState): string[] {
  return availableOptions(state, SCENARIO).map((option) => option.id);
}

describe("chapter core deductions change later gameplay", () => {
  it(
    "unlocks the authored decision, dialogue options and start node after a deduction",
    () => {
      const failures: string[] = [];
      const exercised: Record<string, number> = {};
      const count = (key: string): void => {
        exercised[key] = (exercised[key] ?? 0) + 1;
      };
      const targets: DeductionId[] = ["ded.same-source", "ded.notification-mismatch"];

      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed(DEDUCTION_EFFECTS_SEED, index);
        const next = createLcg(seed);
        const target = targets[index % targets.length];
        const where = `seed ${seed} (case ${index}), ${target}`;
        const pair = findPair(next, seed, target);
        if (pair === null) {
          failures.push(`${where}: no reachable state where the deduction can be recorded`);
          continue;
        }
        const { before, after } = pair;
        count(`${target}:pair`);

        // Decision `report-deception` needs ded.same-source.
        if (target === "ded.same-source" && before.decision === null && before.conversation === null && before.call.current === null) {
          const decide: CoreAction = { type: "MAKE_DECISION", decision: "report-deception" };
          const without = chapterReducer(before, decide, SCENARIO);
          const withDed = chapterReducer(after, decide, SCENARIO);
          if (without.accepted) failures.push(`${where}: report-deception accepted without the deduction`);
          else if (!withDed.accepted) failures.push(`${where}: report-deception rejected with the deduction (${withDed.reason ?? "no reason"})`);
          else count("report-deception");
        }

        // Third call: start node and challenge options.
        const a = playToCitesCase(before);
        const b = playToCitesCase(after);
        if (a === null || b === null) continue;
        const idsA = optionIds(a.at);
        const idsB = optionIds(b.at);
        if (target === "ded.same-source") {
          count("recovery");
          if (a.startNode === "rec.start.confronted") failures.push(`${where}: confronted start node without the deduction`);
          if (b.startNode !== "rec.start.confronted" && b.startNode !== "rec.start.verified") {
            failures.push(`${where}: start node with the deduction is ${b.startNode}`);
          } else if (b.startNode === "rec.start.confronted") count("confronted-start");
          if (idsA.includes("rec.challenge-case")) failures.push(`${where}: challenge-case offered without the deduction`);
          if (!idsB.includes("rec.challenge-case")) failures.push(`${where}: challenge-case missing with the deduction`);
          else count("challenge-case");
        } else {
          count("recovery");
          if (idsA.includes("rec.number-not-on-statement")) failures.push(`${where}: challenge-number offered without the deduction`);
          if (!idsB.includes("rec.number-not-on-statement")) failures.push(`${where}: challenge-number missing with the deduction`);
          else count("challenge-number");
        }
      }

      const report = `seed base ${DEDUCTION_EFFECTS_SEED}; ${failures.length} failure(s):\n${failures.slice(0, 10).join("\n")}`;
      expect(failures, report).toEqual([]);
      // Each influence must have been exercised, so the property is not vacuous.
      for (const key of ["report-deception", "confronted-start", "challenge-case", "challenge-number"]) {
        expect(exercised[key] ?? 0, `${key} never exercised; seed base ${DEDUCTION_EFFECTS_SEED}`).toBeGreaterThan(0);
      }
    },
    PROPERTY_TIMEOUT_MS,
  );

  it("is authored so that at least two deductions influence later gameplay", () => {
    const influencing = new Set<string>();
    const scan = (value: unknown): void => {
      if (Array.isArray(value)) {
        value.forEach(scan);
      } else if (value !== null && typeof value === "object") {
        const record = value as Record<string, unknown>;
        if (record.kind === "deductionRecorded" && typeof record.deductionId === "string") influencing.add(record.deductionId);
        Object.values(record).forEach(scan);
      }
    };
    scan(SCENARIO.decisions);
    scan(SCENARIO.dialogues);
    scan(SCENARIO.endings);
    expect([...influencing].length, `influencing deductions: ${[...influencing].join(", ")}`).toBeGreaterThanOrEqual(2);
  });
});
