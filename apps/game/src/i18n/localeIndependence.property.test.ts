// Feature: chapter-01-double-deception, Property 16: Localization is display-only and content is safe
// Locale independence of the Chapter 1 core and saves (game-i18n-en-vi, task 6.9).
// Properties 7 and 8 from design.md, "Correctness Properties". The file sits outside
// `game/narrative/` because it imports the Vietnamese overlay and the I18n_Module.

import { describe, expect, it } from "vitest";
import type { GameLocale } from "@scammaze/shared-types";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../game/narrative/chapter1/scenario";
import { localizeInteractionPrompts, localizeScenario, narrativeTextEntries } from "../game/narrative/localize";
import { chapterReducer, createInitialState } from "../game/narrative/reducer";
import {
  enumerateCandidateActions,
  selectActiveObjectives,
  selectCallLog,
  selectClaimStatuses,
  selectDecisionPanel,
  selectDialogueView,
  selectJournalEntries,
  selectPhoneMessages,
} from "../game/narrative/selectors";
import { createChapterStore } from "../game/narrative/store";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../game/narrative/types";
import { encodeProgress, restoreProgress } from "../game/saves/chapterProgress";
import type { SavedPlayerPose } from "../game/saves/saveGame";
import {
  CORE_PROPERTY_RUNS,
  CORE_PROPERTY_SEED,
  CORE_SEQUENCE_MAX_LENGTH,
  caseSeed,
  describeAction,
  generateActionSequence,
  shrinkFailingPrefix,
} from "../test/chapterRuns";
import { createLcg, pick, randomInt } from "../test/seededRandom";
import { applyLocale, i18n } from "./index";
import { getDisplayScenario } from "./narrative";
import { CHAPTER_1_NARRATIVE_VI } from "./narrative/chapter1.vi";

const PROPERTY_7_SEED = (CORE_PROPERTY_SEED ^ 0x1e7e0007) >>> 0;
const PROPERTY_8_SEED = (CORE_PROPERTY_SEED ^ 0x1e7e0008) >>> 0;
const LOCALES: readonly GameLocale[] = ["en", "vi"];
const CHECKPOINT_ID = "obj.check-claims";

/** English texts of every Narrative_Text_Key: the only strings allowed to differ between locales. */
const ENGLISH_TEXTS = new Set(
  narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS).map((entry) => entry.text),
);

/** Vietnamese overlay strings that differ from the English text, for the "no translated text" check. */
const VIETNAMESE_ONLY_TEXTS = (() => {
  const english = new Map(
    narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS).map((entry) => [entry.key, entry.text]),
  );
  return Object.entries(CHAPTER_1_NARRATIVE_VI)
    .filter(([key, text]) => text.trim().length > 0 && english.get(key) !== text)
    .map(([, text]) => text);
})();

/** The state without the copied caller names (`call.log[].displayName`), which follow the scenario. */
function withoutCallNames(state: ChapterState): unknown {
  return {
    ...state,
    call: { ...state.call, log: state.call.log.map(({ displayName: _displayName, ...rest }) => rest) },
  };
}

/**
 * Differences between `en` and `vi` other than narrative text: same types, keys and lengths,
 * equal non-string leaves, and equal strings unless the English string is a narrative text.
 */
function nonTextDifferences(en: unknown, vi: unknown, path: string, out: string[]): string[] {
  if (typeof en === "string" && typeof vi === "string") {
    if (en !== vi && !ENGLISH_TEXTS.has(en)) out.push(`${path}: ${JSON.stringify(en)} vs ${JSON.stringify(vi)}`);
    return out;
  }
  if (Array.isArray(en) || Array.isArray(vi)) {
    if (!Array.isArray(en) || !Array.isArray(vi) || en.length !== vi.length) {
      out.push(`${path}: array shape differs`);
      return out;
    }
    en.forEach((item, index) => nonTextDifferences(item, vi[index], `${path}[${index}]`, out));
    return out;
  }
  if (en !== null && vi !== null && typeof en === "object" && typeof vi === "object") {
    const enKeys = Object.keys(en).sort();
    const viKeys = Object.keys(vi).sort();
    if (JSON.stringify(enKeys) !== JSON.stringify(viKeys)) {
      out.push(`${path}: keys ${enKeys.join(",")} vs ${viKeys.join(",")}`);
      return out;
    }
    for (const key of enKeys) {
      nonTextDifferences((en as Record<string, unknown>)[key], (vi as Record<string, unknown>)[key], `${path}.${key}`, out);
    }
    return out;
  }
  if (!Object.is(en, vi)) out.push(`${path}: ${String(en)} vs ${String(vi)}`);
  return out;
}

/** Selector outputs for one state and scenario, as the UI reads them. */
function selectorViews(state: ChapterState, scenario: ScenarioDefinition): Record<string, unknown> {
  return {
    objectives: selectActiveObjectives(state, scenario),
    dialogue: selectDialogueView(state, scenario),
    journal: selectJournalEntries(state, scenario),
    claims: selectClaimStatuses(state, scenario),
    decision: selectDecisionPanel(state, scenario),
    callLog: selectCallLog(state, scenario),
    messages: selectPhoneMessages(state, scenario),
  };
}

/** Problems of one action sequence under both scenarios; empty when Property 7 holds. */
function property7Problems(actions: readonly unknown[], vi: ScenarioDefinition): string[] {
  const problems: string[] = [];
  let enState = createInitialState(CHAPTER_1_SCENARIO);
  let viState = createInitialState(vi);
  actions.forEach((action, index) => {
    const enResult = chapterReducer(enState, action, CHAPTER_1_SCENARIO);
    const viResult = chapterReducer(viState, action, vi);
    if (enResult.accepted !== viResult.accepted) {
      problems.push(`step ${index} ${describeAction(action)}: accepted ${enResult.accepted} vs ${viResult.accepted}`);
    }
    enState = enResult.state;
    viState = viResult.state;
  });
  if (JSON.stringify(withoutCallNames(enState)) !== JSON.stringify(withoutCallNames(viState))) {
    problems.push("final states differ beyond call.log[].displayName");
  }
  if (JSON.stringify(enumerateCandidateActions(enState, CHAPTER_1_SCENARIO)) !== JSON.stringify(enumerateCandidateActions(viState, vi))) {
    problems.push("candidate actions differ");
  }
  // The UI renders the canonical store state with the display scenario: only text may change.
  problems.push(
    ...nonTextDifferences(selectorViews(enState, CHAPTER_1_SCENARIO), selectorViews(enState, vi), "selectors", []),
  );
  return problems;
}

function randomPose(next: () => number): SavedPlayerPose | null {
  if (next() < 0.2) return null;
  return { position: [next() * 20 - 10, 0, next() * 20 - 10], yaw: next() * Math.PI * 2 };
}

interface StoreRun {
  state: ChapterState;
  serialized: string;
}

/** Dispatches through a Chapter_Store, switching the UI locale before the steps in `switches`. */
function runStore(
  actions: readonly unknown[],
  pose: SavedPlayerPose | null,
  switches: ReadonlyMap<number, GameLocale>,
): StoreRun {
  applyLocale("en");
  const store = createChapterStore(createInitialState());
  actions.forEach((action, index) => {
    const locale = switches.get(index);
    if (locale !== undefined) applyLocale(locale);
    // Malformed values are part of the sequence on purpose; the reducer rejects them.
    store.dispatch(action as CoreAction);
  });
  const state = store.getState();
  return { state, serialized: JSON.stringify(encodeProgress(state, pose, CHECKPOINT_ID)) };
}

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

describe("locale independence properties", () => {
  // Feature: game-i18n-en-vi, Property 7: The core gives the same results with any Localized_Scenario
  it("Property 7: the core gives the same results with any Localized_Scenario (Requirements 10.4, 9.4)", () => {
    const vi = getDisplayScenario("vi");
    expect(vi).not.toBe(CHAPTER_1_SCENARIO);
    // Same IDs, conditions, numbers and structure: only narrative text differs.
    expect(nonTextDifferences(CHAPTER_1_SCENARIO, vi, "scenario", [])).toEqual([]);

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(PROPERTY_7_SEED, index);
      const length = randomInt(createLcg(seed), 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const problems = property7Problems(actions, vi);
      if (problems.length > 0) {
        const prefix = shrinkFailingPrefix(actions, (candidate) => property7Problems(candidate, vi).length > 0);
        expect(
          problems,
          `seed 0x${seed.toString(16)} (case ${index}), shrunk prefix: ${(prefix ?? actions).map(describeAction).join(" → ")}`,
        ).toEqual([]);
      }
    }
  }, PROPERTY_TIMEOUT_MS);

  // Feature: game-i18n-en-vi, Property 8: Saves do not depend on the UI language\n  // (also Property 16, chapter-01-double-deception: locale switches never change Chapter_State)
  it("Property 8: saves do not depend on the UI language (Requirements 10.5, 10.6, 10.7)", () => {
    expect(VIETNAMESE_ONLY_TEXTS.length).toBeGreaterThan(0);
    let switchedRuns = 0;

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(PROPERTY_8_SEED, index);
      const next = createLcg(seed);
      const length = randomInt(next, 1, CORE_SEQUENCE_MAX_LENGTH);
      const actions = generateActionSequence(seed, length);
      const pose = randomPose(next);
      const switches = new Map<number, GameLocale>();
      const switchCount = randomInt(next, 1, 4);
      for (let s = 0; s < switchCount; s += 1) switches.set(randomInt(next, 0, length - 1), pick(next, LOCALES));
      if ([...switches.values()].includes("vi")) switchedRuns += 1;
      const label = `seed 0x${seed.toString(16)} (case ${index}), switches ${JSON.stringify([...switches])}`;

      const plain = runStore(actions, pose, new Map());
      const switched = runStore(actions, pose, switches);
      expect(switched.state, label).toEqual(plain.state);
      expect(switched.serialized, label).toBe(plain.serialized);
      expect(
        VIETNAMESE_ONLY_TEXTS.filter((text) => switched.serialized.includes(text)),
        label,
      ).toEqual([]);

      // Requirement 10.7: progress encoded while vi is active restores the same state under en.
      applyLocale("vi");
      const progress = encodeProgress(switched.state, pose, CHECKPOINT_ID);
      applyLocale("en");
      expect(i18n.language, label).toBe("en");
      if (progress === null) continue;
      const restored = restoreProgress(progress);
      expect(restored.ok, label).toBe(true);
      if (restored.ok) expect(restored.state, label).toEqual(plain.state);
    }
    // At least some runs actually switched to Vietnamese mid-sequence.
    expect(switchedRuns).toBeGreaterThan(CORE_PROPERTY_RUNS / 2);
  }, PROPERTY_TIMEOUT_MS);
});

const PROPERTY_16_SEED = (CORE_PROPERTY_SEED ^ 0x1e7e0016) >>> 0;
const PROPERTY_16_RUNS = Math.max(CORE_PROPERTY_RUNS, 200);

const ENGLISH_BY_KEY = new Map(
  narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS).map((entry) => [entry.key, entry.text]),
);

// Safety lint shared in spirit with content.vi.test.ts and chapter1/content.test.ts.
const DOMAIN_PATTERN = /\b[a-z0-9](?:[a-z0-9-]*[a-z0-9])?(?:\.[a-z0-9](?:[a-z0-9-]*[a-z0-9])?)+\b/gi;
const RESERVED_DOMAIN = /(?:\.test|\.example|\.invalid|^example\.com)$/i;
const PHONE_PATTERN = /\+\d[\d \-]*\d|\b\d(?:[ \-]?\d){6,}\b/g;

/** Problems of one text under the safety rules: no "safe" or "an toàn", reserved domains, +000 numbers. */
function safetyProblems(text: string): string[] {
  const problems: string[] = [];
  if (/\bsafe\b/i.test(text) || /an toàn/iu.test(text)) problems.push('uses "safe" wording');
  for (const match of text.matchAll(DOMAIN_PATTERN)) {
    const domain = match[0].toLowerCase();
    if (/^[a-z]{2,}$/.test(domain.split(".").pop() ?? "") && !RESERVED_DOMAIN.test(domain)) {
      problems.push(`domain ${domain} is not reserved`);
    }
  }
  for (const match of text.matchAll(PHONE_PATTERN)) {
    if (!/^\+000 /.test(match[0])) problems.push(`number ${match[0]} does not start with +000`);
  }
  return problems;
}

/** A random overlay: each Vietnamese entry is kept, blanked or removed. */
function randomOverlay(next: () => number): Record<string, string> {
  const overlay: Record<string, string> = {};
  for (const [key, text] of Object.entries(CHAPTER_1_NARRATIVE_VI)) {
    const roll = next();
    if (roll < 0.6) overlay[key] = text;
    else if (roll < 0.7) overlay[key] = "";
  }
  return overlay;
}

describe("localization is display-only and content is safe", () => {
  // Feature: chapter-01-double-deception, Property 16: Localization is display-only and content is safe
  // Validates: Requirements 18.2, 18.3, 18.4
  it("Property 16: any overlay keeps the structure and falls back to English per key", () => {
    const canonicalBefore = JSON.stringify(CHAPTER_1_SCENARIO);
    for (let index = 0; index < PROPERTY_16_RUNS; index += 1) {
      const seed = caseSeed(PROPERTY_16_SEED, index);
      const label = `seed 0x${seed.toString(16)} (case ${index})`;
      const overlay = randomOverlay(createLcg(seed));
      const localized = localizeScenario(CHAPTER_1_SCENARIO, overlay);
      expect(nonTextDifferences(CHAPTER_1_SCENARIO, localized, "scenario", []), label).toEqual([]);
      const wrong = narrativeTextEntries(localized, localizeInteractionPrompts(CHAPTER_1_INTERACTION_PROMPTS, overlay))
        .filter((entry) => {
          const expected = (overlay[entry.key] ?? "").length > 0 ? overlay[entry.key] : ENGLISH_BY_KEY.get(entry.key);
          return entry.text !== expected;
        })
        .map((entry) => entry.key);
      expect(wrong, label).toEqual([]);
    }
    expect(JSON.stringify(CHAPTER_1_SCENARIO), "canonical scenario was mutated").toBe(canonicalBefore);
  }, PROPERTY_TIMEOUT_MS);

  // Feature: chapter-01-double-deception, Property 16: Localization is display-only and content is safe
  // Validates: Requirements 18.2, 19.1, 19.2, 19.6, 16.6
  it("Property 16: every English key has a Vietnamese entry and both locales pass the safety lint", () => {
    const missing = [...ENGLISH_BY_KEY]
      .filter(([key, text]) => text.trim().length > 0 && (CHAPTER_1_NARRATIVE_VI[key] ?? "").trim().length === 0)
      .map(([key]) => key);
    expect(missing, `seed 0x${PROPERTY_16_SEED.toString(16)}`).toEqual([]);

    const problems: string[] = [];
    for (const locale of LOCALES) {
      const display = getDisplayScenario(locale);
      for (const entry of narrativeTextEntries(display, CHAPTER_1_INTERACTION_PROMPTS)) {
        for (const problem of safetyProblems(entry.text)) problems.push(`${locale} ${entry.key}: ${problem}`);
      }
    }
    for (const [key, text] of Object.entries(CHAPTER_1_NARRATIVE_VI)) {
      for (const problem of safetyProblems(text)) problems.push(`vi overlay ${key}: ${problem}`);
    }
    expect(problems, `seed 0x${PROPERTY_16_SEED.toString(16)}`).toEqual([]);
  }, PROPERTY_TIMEOUT_MS);
});