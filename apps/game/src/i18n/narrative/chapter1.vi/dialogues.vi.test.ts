// Task 11.2: the Vietnamese overlay covers every entry of dlg.alex, dlg.official-line, dlg.intro and
// dlg.aftermath, and keeps case IDs, numbers and domains unchanged.
import { describe, expect, it } from "vitest";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../../../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { narrativeTextEntries } from "../../../game/narrative/localize";
import { AFTERMATH_VI } from "./aftermath";
import { ALEX_VI } from "./alex";
import { INTRO_VI } from "./intro";
import { OFFICIAL_VI } from "./official";

const GRAPH_IDS = ["dlg.alex", "dlg.official-line", "dlg.intro", "dlg.aftermath"];
const OVERLAY: Readonly<Record<string, string>> = { ...ALEX_VI, ...OFFICIAL_VI, ...INTRO_VI, ...AFTERMATH_VI };

const ENGLISH = narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS).filter((entry) =>
  GRAPH_IDS.some((id) => entry.key.startsWith(`dialogues/${id}/`)),
);

/** Digits, case IDs and domains that must survive translation unchanged. */
function fixedTokens(text: string): string[] {
  const found = text.match(/NG-\d+-X|[a-z0-9-]+(?:\.[a-z0-9-]+)*\.(?:test|example|invalid)|\d+/g) ?? [];
  return [...found].sort();
}

describe("Vietnamese overlay for alex, official, intro and aftermath", () => {
  it("covers a known number of English entries", () => {
    expect(ENGLISH.length).toBeGreaterThan(60);
  });

  it("has exactly the English keys of these four graphs", () => {
    expect(Object.keys(OVERLAY).sort()).toEqual(ENGLISH.map((entry) => entry.key).sort());
  });

  it("has a non-empty, translated text for every entry", () => {
    for (const entry of ENGLISH) {
      const vi = OVERLAY[entry.key];
      expect(vi, entry.key).toBeTruthy();
      expect(vi.trim(), entry.key).not.toBe("");
    }
  });

  it("keeps numbers, case IDs and domains unchanged", () => {
    for (const entry of ENGLISH) {
      expect(fixedTokens(OVERLAY[entry.key]), entry.key).toEqual(fixedTokens(entry.text));
    }
  });

  it("never calls anything 'an toàn' and uses no emoji", () => {
    for (const [key, text] of Object.entries(OVERLAY)) {
      expect(text.toLowerCase(), key).not.toContain("an toàn");
      expect(/\p{Extended_Pictographic}/u.test(text), key).toBe(false);
    }
  });
});
