// Vietnamese Chapter 1 narrative overlay (game-i18n-en-vi, design section 1 "File-split rule").
// Rebuilt in spec chapter-01-double-deception, task 11.4, for the "Double Deception" scenario.
// Each area part lives in its own file under `chapter1.vi/` so translations can be written in
// parallel. The parts use disjoint keys, so this plain spread has no collisions.

import type { NarrativeOverlay } from "../../game/narrative/localize";
import { AFTERMATH_VI } from "./chapter1.vi/aftermath";
import { ALEX_VI } from "./chapter1.vi/alex";
import { CORE_VI } from "./chapter1.vi/core";
import { DECISIONS_VI } from "./chapter1.vi/decisions";
import { DEDUCTIONS_VI } from "./chapter1.vi/deductions";
import { DEVICE_ACTIONS_VI } from "./chapter1.vi/deviceActions";
import { ENDINGS_VI } from "./chapter1.vi/endings";
import { EVIDENCE_VI } from "./chapter1.vi/evidence";
import { INTRO_VI } from "./chapter1.vi/intro";
import { OFFICIAL_VI } from "./chapter1.vi/official";
import { PHONE_VI } from "./chapter1.vi/phone";
import { RECOVERY_VI } from "./chapter1.vi/recovery";
import { SOURCES_VI } from "./chapter1.vi/sources";

/** The overlay parts by area, for the disjoint-key test. */
export const CHAPTER_1_NARRATIVE_VI_PARTS = {
  core: CORE_VI,
  evidence: EVIDENCE_VI,
  decisions: DECISIONS_VI,
  phone: PHONE_VI,
  sources: SOURCES_VI,
  deductions: DEDUCTIONS_VI,
  deviceActions: DEVICE_ACTIONS_VI,
  endings: ENDINGS_VI,
  intro: INTRO_VI,
  alex: ALEX_VI,
  official: OFFICIAL_VI,
  recovery: RECOVERY_VI,
  aftermath: AFTERMATH_VI,
} as const satisfies Record<string, NarrativeOverlay>;

export const CHAPTER_1_NARRATIVE_VI: NarrativeOverlay = {
  ...CORE_VI,
  ...EVIDENCE_VI,
  ...DECISIONS_VI,
  ...PHONE_VI,
  ...SOURCES_VI,
  ...DEDUCTIONS_VI,
  ...DEVICE_ACTIONS_VI,
  ...ENDINGS_VI,
  ...INTRO_VI,
  ...ALEX_VI,
  ...OFFICIAL_VI,
  ...RECOVERY_VI,
  ...AFTERMATH_VI,
};
