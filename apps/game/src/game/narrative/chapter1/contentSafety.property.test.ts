// Feature: chapter-01-double-deception, Property 16: Localization is display-only and content is safe
// (the content-safety half: no "safe" or "an toàn" wording, only reserved domains, only +000 numbers,
// and no "scam" or "fake" word in the notification text shown before the debrief). The locale
// overlay half is covered by properties/localize.property.test.ts.
//
// Seeded random walks through the real scenario: after every accepted action, every text the
// player can see in that state is linted. Failures print the seed and the case index.
import { isOwnerApprovedHost } from "../approvedDomains";
import { describe, expect, it } from "vitest";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  generateActionSequence,
} from "../../../test/chapterRuns";
import { availableOptions } from "../dialogueEngine";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState } from "../types";
import { CHAPTER_1_SCENARIO } from "./scenario";

const SCENARIO = CHAPTER_1_SCENARIO;
const FILE_SEED = (CORE_PROPERTY_SEED ^ 0x5afe7e57) >>> 0;
const RUNS = Math.max(CORE_PROPERTY_RUNS, 200);

const DOMAIN_PATTERN =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|bank|gov|edu|co|vn|app|info|biz|xyz|ru|cn|uk|us|me|tv|cc|site|online|test|example|invalid|local)\b/gi;
const PHONE_PATTERN = /\+\s?\d[\d\s().-]*\d/g;
const NOTIFICATION_FORBIDDEN = /\b(scam|scams|scammer|fake|fakes)\b/i;
const NOTIFICATION_EVIDENCE = ["ev.notification-metadata", "ev.shared-case-id"] as const;

function reservedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (isOwnerApprovedHost(h)) return true;
  return h.endsWith(".test") || h.endsWith(".example") || h.endsWith(".invalid") || h === "example.com" || h.endsWith(".example.com");
}

function lintText(text: string): string[] {
  const problems: string[] = [];
  if (/\bsafe\b/i.test(text) || /an toàn/i.test(text)) problems.push('uses "safe" wording');
  for (const host of text.match(DOMAIN_PATTERN) ?? []) {
    if (!reservedHost(host)) problems.push(`domain ${host} is not reserved`);
  }
  for (const number of text.match(PHONE_PATTERN) ?? []) {
    if (!number.replace(/\s/g, "").startsWith("+000")) problems.push(`number ${number} does not start with +000`);
  }
  return problems;
}

/** Texts the player can see in `state`, with a label. Notification texts are flagged separately. */
function visibleTexts(state: ChapterState): Array<{ label: string; text: string; notification: boolean }> {
  const out: Array<{ label: string; text: string; notification: boolean }> = [];
  const add = (label: string, text: string | undefined, notification = false): void => {
    if (text !== undefined) out.push({ label, text, notification });
  };
  const conversation = state.conversation;
  if (conversation !== null && Object.hasOwn(SCENARIO.dialogues, conversation.graphId)) {
    const graph = SCENARIO.dialogues[conversation.graphId];
    const node = Object.hasOwn(graph.nodes, conversation.nodeId) ? graph.nodes[conversation.nodeId] : undefined;
    if (node) {
      add(`${graph.id}/${node.id}`, graph.lines[node.lineId]);
      for (const option of availableOptions(state, SCENARIO)) add(`${graph.id}/${option.id}`, graph.lines[option.lineId]);
    }
  }
  for (const id of state.discovered) {
    const item = SCENARIO.evidence[id];
    const isNotification = (NOTIFICATION_EVIDENCE as readonly string[]).includes(id);
    add(`${id}.title`, item.title, isNotification);
    add(`${id}.description`, item.description, isNotification);
  }
  for (const id of state.phone.messages) add(id, SCENARIO.phone.messages[id].body);
  for (const record of state.call.log) {
    add(`call ${record.callId} name`, record.displayName);
    add(`call ${record.callId} number`, record.number);
  }
  for (const id of state.objectives.active) add(id, SCENARIO.objectives[id].text);
  if (state.outcome !== null) {
    const ending = SCENARIO.endings[state.outcome];
    const aftermath = ending.aftermath;
    for (const [key, text] of Object.entries({ ...aftermath, narrationNodeIds: undefined })) {
      if (typeof text === "string") add(`${state.outcome}.${key}`, text);
    }
    for (const variant of ending.variants) add(`${state.outcome}.variant.${variant.id}`, variant.text);
  }
  return out;
}

describe("Property 16 (content safety): visible text follows the content rules in every reachable state", () => {
  it(
    `holds for ${RUNS} seeded action sequences`,
    () => {
      const failures: string[] = [];
      const seen = new Map<string, string[]>();
      for (let index = 0; index < RUNS; index += 1) {
        const seed = caseSeed(FILE_SEED, index);
        const actions = generateActionSequence(seed, CORE_SEQUENCE_MAX_LENGTH);
        let state = createInitialState();
        for (let step = 0; step < actions.length; step += 1) {
          state = chapterReducer(state, actions[step], SCENARIO).state;
          for (const { label, text, notification } of visibleTexts(state)) {
            let problems = seen.get(text);
            if (problems === undefined) {
              problems = lintText(text);
              seen.set(text, problems);
            }
            for (const problem of problems) {
              failures.push(`seed ${seed} index ${index} step ${step}: ${label}: ${problem}`);
            }
            if (notification && state.outcome === null && NOTIFICATION_FORBIDDEN.test(text)) {
              failures.push(`seed ${seed} index ${index} step ${step}: ${label}: notification text uses scam/fake`);
            }
          }
          if (failures.length > 20) break;
        }
        if (failures.length > 20) break;
      }
      expect(failures.slice(0, 20), `file seed ${FILE_SEED}`).toEqual([]);
    },
    120_000,
  );
});
