// Chapter 1 assembled scenario: title, validator and solver results (Requirements 3.1, 3.6, 3.7).
import { describe, expect, it } from "vitest";
import { OUTCOME_IDS } from "./ids";
import { analyzeReachability, playbackOnlyGraphIds } from "../reachability";
import { AFTERMATH_SEQUENCES } from "./dialogues/aftermath";
import { validateScenarioIssues } from "../validateScenario";
import { CHAPTER_1_SCENARIO } from "./scenario";

describe("CHAPTER_1_SCENARIO", () => {
  it("has the title and subtitle", () => {
    expect(CHAPTER_1_SCENARIO.title).toBe("The Urgent Call");
    expect(CHAPTER_1_SCENARIO.subtitle).toBe("The False Victory");
  });

  it("has no validator issue", () => {
    expect(validateScenarioIssues(CHAPTER_1_SCENARIO)).toEqual([]);
  });

  it("treats only the two narration graphs as playback-only", () => {
    expect(playbackOnlyGraphIds(CHAPTER_1_SCENARIO).sort()).toEqual(["dlg.aftermath", "dlg.intro"]);
  });

  it("names every aftermath node in an ending or in the secret sequence", () => {
    const named = new Set<string>(AFTERMATH_SEQUENCES["c-secret"]);
    for (const ending of Object.values(CHAPTER_1_SCENARIO.endings)) {
      for (const id of ending.aftermath.narrationNodeIds) named.add(id);
    }
    expect([...named].sort()).toEqual(Object.keys(CHAPTER_1_SCENARIO.dialogues["dlg.aftermath"].nodes).sort());
  });

  it("reaches all four endings with no unreachable node or option and no soft lock", () => {
    const report = analyzeReachability(CHAPTER_1_SCENARIO);
    expect(report.truncated).toBe(false);
    expect(report.outcomesReached).toEqual([...OUTCOME_IDS].sort());
    expect(report.unreachableOutcomes).toEqual([]);
    expect(report.unreachableNodes).toEqual([]);
    expect(report.unreachableOptions).toEqual([]);
    expect(report.softLocks).toEqual([]);
  }, 300_000);
});
