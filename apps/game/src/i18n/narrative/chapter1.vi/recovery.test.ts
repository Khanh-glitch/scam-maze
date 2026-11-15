// Coverage test for the Vietnamese `dlg.recovery` overlay part (spec chapter-01-double-deception,
// task 11.3): every English entry has a Vietnamese entry with the same identifiers and numbers.

import { describe, expect, it } from "vitest";
import { CHAPTER_1_INTERACTION_PROMPTS } from "../../../game/narrative/chapter1/interactables";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { narrativeTextEntries } from "../../../game/narrative/localize";
import { RECOVERY_VI } from "./recovery";

const PREFIX = "dialogues/dlg.recovery/";

const ENGLISH = narrativeTextEntries(CHAPTER_1_SCENARIO, CHAPTER_1_INTERACTION_PROMPTS).filter((entry) =>
  entry.key.startsWith(PREFIX),
);

/** Tokens that contain a digit, such as NG-4471-X and each group of the phone number. */
function numberTokens(text: string): string[] {
  return (text.match(/[+\w-]*\d[\w-]*/g) ?? []).sort();
}

describe("recovery overlay (dlg.recovery)", () => {
  it("finds the English entries to translate", () => {
    expect(ENGLISH.length).toBeGreaterThan(20);
  });

  it("has exactly the keys of the English entries", () => {
    expect(Object.keys(RECOVERY_VI).sort()).toEqual(ENGLISH.map((entry) => entry.key).sort());
  });

  it("has a non-empty Vietnamese text for every English entry", () => {
    for (const entry of ENGLISH) {
      const vi = RECOVERY_VI[entry.key];
      expect(typeof vi === "string" && vi.trim().length > 0, entry.key).toBe(true);
    }
  });

  it("keeps the same numbers and case IDs as the English text", () => {
    for (const entry of ENGLISH) {
      expect(numberTokens(RECOVERY_VI[entry.key]), entry.key).toEqual(numberTokens(entry.text));
    }
  });

  it("never says 'an toàn' and has no emoji or countdown wording", () => {
    for (const [key, text] of Object.entries(RECOVERY_VI)) {
      expect(text.toLowerCase(), key).not.toContain("an toàn");
      expect(/\p{Extended_Pictographic}/u.test(text), key).toBe(false);
      expect(/đếm ngược|còn \d+ (phút|giây)/i.test(text), key).toBe(false);
    }
  });
});
