import { cleanup } from "@testing-library/react";
import { afterEach, vi } from "vitest";
import { applyLocale, initI18n } from "../i18n";

// The game routes to "LAST SUBMISSION: 72 GIỜ CUỐI", which has no missions yet. The UI, voice, save
// and i18n suites exercise the reusable engine systems (calls, dialogue, evidence, decisions,
// endings, voice, Vietnamese overlay) with the parked story "The Urgent Call" as the content
// fixture, so these two modules resolve to it in tests. `foundation.test.ts` and
// `activeScenario.test.ts` load the real routing with `vi.importActual`.
vi.mock("../game/narrative/activeScenario", async () => {
  const { CHAPTER_1_SCENARIO } = await import("../game/narrative/chapter1/scenario");
  return { ACTIVE_SCENARIO: CHAPTER_1_SCENARIO };
});
vi.mock("../i18n/narrative/lastSubmission.vi", async () => {
  const { CHAPTER_1_NARRATIVE_VI } = await import("../i18n/narrative/chapter1.vi");
  return { LAST_SUBMISSION_NARRATIVE_VI: CHAPTER_1_NARRATIVE_VI };
});

// Every test starts in English, the default locale.
initI18n("en");
// jsdom has no media playback (`play` only logs "not implemented"). The intro voice clips use
// HTMLAudioElement, so playback resolves silently here; `duration` stays NaN, and the intro then
// types at its fallback speed.
if (typeof HTMLMediaElement !== "undefined") {
  Object.defineProperty(HTMLMediaElement.prototype, "play", {
    configurable: true,
    value: () => Promise.resolve(),
  });
  Object.defineProperty(HTMLMediaElement.prototype, "pause", { configurable: true, value: () => undefined });
}

afterEach(() => {
  cleanup();
  applyLocale("en");
});
