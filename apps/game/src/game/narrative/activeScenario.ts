// The scenario the game routes to. Flip this one export to change which Chapter 1 story is active.
//
// The earlier story ("The Urgent Call: The False Victory", `CHAPTER_1_SCENARIO` in
// `chapter1/scenario.ts`) is parked: its data, tests and the engine systems it uses stay in the
// repository, but no screen, save or loader routes to it.
import { LAST_SUBMISSION_SCENARIO } from "./chapter1/lastSubmission";
import type { ScenarioDefinition } from "./types";

export const ACTIVE_SCENARIO: ScenarioDefinition = LAST_SUBMISSION_SCENARIO;
