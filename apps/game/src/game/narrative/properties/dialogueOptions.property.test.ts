// Feature: chapter-01-double-deception, carried-over property: Dialogue options respect conditions and never dead-end
// (the Property 8 of chapter-01-the-urgent-call, rewritten for the Double Deception scenario; task 2.1 re-enable).
// Dialogue options respect conditions and never
// dead-end. In every state reached by a seeded random action sequence that has a current
// conversation on a non-end node, `availableOptions` is non-empty, lists exactly the authored
// options whose conditions hold (in authored order), shows the fallback only when no authored
// option is available, and every listed option is accepted by SELECT_DIALOGUE_OPTION.

import { describe, expect, it } from "vitest";

import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  describeAction,
  generateActionSequence,
  runSequence,
  shrinkFailingPrefix,
} from "../../../test/chapterRuns";
import { createLcg, randomInt } from "../../../test/seededRandom";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { evaluateConditions } from "../conditions";
import { FALLBACK_OPTION_ID, availableOptions } from "../dialogueEngine";
import { chapterReducer } from "../reducer";
import type { ChapterState } from "../types";

/** Seed offset so this file's sequences differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x0008) >>> 0;

/** A node offers at most this many options. */
const MAX_OPTIONS = 4;

/** Returns one message per violation of Property 8 in `state`; empty when it holds. */
function optionProblems(state: ChapterState): string[] {
  const conversation = state.conversation;
  if (conversation === null) return [];
  const graph = CHAPTER_1_SCENARIO.dialogues[conversation.graphId];
  const node = graph?.nodes[conversation.nodeId];
  if (!node) return [`conversation points at missing node ${conversation.graphId}/${conversation.nodeId}`];
  if (node.end) return [];

  const where = `${conversation.graphId}/${node.id}`;
  const problems: string[] = [];
  const listed = availableOptions(state, CHAPTER_1_SCENARIO);
  if (listed.length === 0) problems.push(`${where}: no options (dead end)`);
  if (listed.length > MAX_OPTIONS) problems.push(`${where}: ${listed.length} options listed, at most ${MAX_OPTIONS}`);

  // Reference: the authored options whose conditions hold, in authored order.
  const expectedAuthored = node.options
    .filter((option) => evaluateConditions(option.conditions, state, CHAPTER_1_SCENARIO))
    .map((option) => option.id);
  const listedAuthored = listed.filter((option) => !option.fallback);
  const listedFallback = listed.filter((option) => option.fallback);

  for (const option of listedAuthored) {
    const authored = node.options.find((candidate) => candidate.id === option.id);
    if (!authored) problems.push(`${where}: listed option ${option.id} is not authored at this node`);
    else if (!evaluateConditions(authored.conditions, state, CHAPTER_1_SCENARIO)) {
      problems.push(`${where}: listed option ${option.id} has failing conditions`);
    }
  }
  const listedIds = listedAuthored.map((option) => option.id);
  if (JSON.stringify(listedIds) !== JSON.stringify(expectedAuthored)) {
    problems.push(`${where}: listed ${JSON.stringify(listedIds)}, expected ${JSON.stringify(expectedAuthored)}`);
  }

  if (expectedAuthored.length > 0 && listedFallback.length > 0) {
    problems.push(`${where}: fallback listed while authored options are available`);
  }
  if (expectedAuthored.length === 0 && (listedFallback.length !== 1 || listed.length !== 1)) {
    problems.push(`${where}: expected only the fallback option, got ${JSON.stringify(listed.map((o) => o.id))}`);
  }
  for (const option of listedFallback) {
    if (option.id !== FALLBACK_OPTION_ID) problems.push(`${where}: fallback has id ${option.id}`);
  }

  for (const option of listed) {
    const result = chapterReducer(state, { type: "SELECT_DIALOGUE_OPTION", optionId: option.id });
    if (!result.accepted) {
      problems.push(`${where}: listed option ${option.id} rejected: ${result.reason ?? ""}`);
    }
  }
  return problems;
}

/** True when any state produced by `actions` violates Property 8. */
function sequenceFails(actions: readonly unknown[]): boolean {
  return runSequence(actions).states.some((state) => optionProblems(state).length > 0);
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("Dialogue options respect conditions and never dead-end", () => {
  it("lists only available authored options, never dead-ends, and accepts every listed option", () => {
    // Feature: chapter-01-double-deception, carried-over property: Dialogue options respect conditions and never dead-end
    let checkedStates = 0;
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const length = randomInt(createLcg(seed ^ 0x5a5a5a5a), 0, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const run = runSequence(actions);
      for (const [step, state] of run.states.entries()) {
        const problems = optionProblems(state);
        if (state.conversation !== null) checkedStates += 1;
        if (problems.length > 0) {
          const prefix = shrinkFailingPrefix(actions, sequenceFails);
          throw new Error(
            `Property 8 failed (seed ${seed}, case ${index}, state ${step}): ${problems.join("; ")}. ` +
              `Shortest failing prefix: ${(prefix ?? actions).map(describeAction).join(", ")}`,
          );
        }
      }
    }
    // Guard against a vacuous pass: the generator must reach conversations.
    if (checkedStates === 0) throw new Error("Property 8: no generated state had a conversation.");
  }, PROPERTY_TIMEOUT_MS);

  it("every authored node offers at most four options and a way to leave the conversation", () => {
    // Feature: chapter-01-double-deception, carried-over property: Dialogue options respect conditions and never dead-end
    const problems: string[] = [];
    let nodesChecked = 0;
    for (const graph of Object.values(CHAPTER_1_SCENARIO.dialogues)) {
      // Nodes that can end the conversation: end nodes, or nodes with an option that hangs up.
      const canLeave = new Set<string>();
      for (const node of Object.values(graph.nodes)) {
        if (node.end || node.options.some((option) => typeof option.next !== "string")) canLeave.add(node.id);
      }
      let changed = true;
      while (changed) {
        changed = false;
        for (const node of Object.values(graph.nodes)) {
          if (canLeave.has(node.id)) continue;
          if (node.options.some((option) => typeof option.next === "string" && canLeave.has(option.next))) {
            canLeave.add(node.id);
            changed = true;
          }
        }
      }
      for (const node of Object.values(graph.nodes)) {
        if (node.end) {
          if (node.options.length > 0) problems.push(`${graph.id}/${node.id}: end node has options`);
          continue;
        }
        nodesChecked += 1;
        if (node.options.length > MAX_OPTIONS) {
          problems.push(`${graph.id}/${node.id}: ${node.options.length} authored options, at most ${MAX_OPTIONS}`);
        }
        if (!canLeave.has(node.id)) problems.push(`${graph.id}/${node.id}: no way to leave the conversation`);
        for (const option of node.options) {
          if (typeof option.next === "string" && !Object.hasOwn(graph.nodes, option.next)) {
            problems.push(`${graph.id}/${node.id}: option ${option.id} points at missing node ${option.next}`);
          }
        }
      }
    }
    expect(nodesChecked, "no non-end node was checked").toBeGreaterThan(0);
    expect(problems).toEqual([]);
  });
});
