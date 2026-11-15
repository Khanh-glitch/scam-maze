// Example tests for buildVoiceJobs against the real Chapter 1 scenario and Vietnamese overlay.
// Feature: chapter-01-voice-narrative, task 9.9; spec chapter-01-double-deception, task 11.6.
// Validates: Requirements 14.1, 14.2, 14.3

import { describe, expect, it } from "vitest";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CHAPTER_1_NARRATIVE_VI } from "../../i18n/narrative/chapter1.vi";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import {
  buildVoiceJobs,
  CHAPTER1_VOICE_CAST,
  computeChapterContentVersion,
  isSpokenNode,
  listUntranslatedSpokenLines,
  overlayLineKey,
  TONE_RATE_MULTIPLIER,
} from "./buildVoiceJobs";
import { fnv1a32 } from "./hash";

const OVERLAYS = { vi: CHAPTER_1_NARRATIVE_VI } as const;

const graphs = Object.values(CHAPTER_1_SCENARIO.dialogues);
const allNodes = graphs.flatMap((graph) =>
  Object.values(graph.nodes).map((node) => ({ graph, node })),
);
const spoken = allNodes.filter(({ node }) => isSpokenNode(node));

const jobs = buildVoiceJobs(CHAPTER_1_SCENARIO, OVERLAYS);
const untranslated = listUntranslatedSpokenLines(CHAPTER_1_SCENARIO, OVERLAYS, "vi");

describe("buildVoiceJobs with the real Chapter 1 data", () => {
  it("has spoken nodes to voice", () => {
    expect(spoken.length).toBeGreaterThan(0);
  });

  it("covers the five Chapter 1 dialogue graphs", () => {
    expect(graphs.map((graph) => graph.id).sort()).toEqual(
      ["dlg.aftermath", "dlg.alex", "dlg.intro", "dlg.official-line", "dlg.recovery"],
    );
  });

  it("makes one en job per spoken node", () => {
    const ids = jobs.filter((job) => job.locale === "en").map((job) => job.clipId);
    expect(ids).toHaveLength(spoken.length);
    expect(new Set(ids).size).toBe(spoken.length);
    expect([...ids].sort()).toEqual(spoken.map(({ node }) => node.id).sort());
  });

  it("makes a vi job for every spoken node that has overlay text and lists the rest as untranslated", () => {
    const viIds = jobs.filter((job) => job.locale === "vi").map((job) => job.clipId);
    expect(new Set(viIds).size).toBe(viIds.length);
    expect(viIds.length + untranslated.length).toBe(spoken.length);
    for (const line of untranslated) expect(viIds).not.toContain(line.clipId);
  });

  it("skips system nodes and every non-spoken node", () => {
    const spokenIds = new Set(spoken.map(({ node }) => node.id));
    const systemNodes = allNodes.filter(({ node }) => node.speaker === "system");
    for (const { node } of allNodes) {
      if (spokenIds.has(node.id)) continue;
      expect(jobs.some((job) => job.clipId === node.id)).toBe(false);
    }
    for (const { node } of systemNodes) {
      expect(jobs.some((job) => job.clipId === node.id)).toBe(false);
    }
  });

  it("gives every job non-empty text and textHash equal to fnv1a32(text)", () => {
    for (const job of jobs) {
      expect(job.text.length).toBeGreaterThan(0);
      expect(job.textHash).toBe(fnv1a32(job.text));
    }
  });

  it("uses the canonical English line for en jobs", () => {
    for (const job of jobs.filter((j) => j.locale === "en")) {
      const entry = spoken.find(({ node }) => node.id === job.clipId);
      expect(entry).toBeDefined();
      expect(job.text).toBe(entry!.graph.lines[entry!.node.lineId]);
    }
  });

  it("takes vi text only from the overlay and never labels English as vi", () => {
    for (const job of jobs.filter((j) => j.locale === "vi")) {
      const entry = spoken.find(({ node }) => node.id === job.clipId)!;
      const overlayText = CHAPTER_1_NARRATIVE_VI[overlayLineKey(entry.graph.id, entry.node.lineId)];
      expect(overlayText).toBeTruthy();
      expect(job.text).toBe(overlayText);
    }
  });

  it("makes no vi job when the overlay is missing, instead of using English", () => {
    const enOnly = buildVoiceJobs(CHAPTER_1_SCENARIO, {});
    expect(enOnly.every((job) => job.locale === "en")).toBe(true);
    expect(enOnly).toHaveLength(spoken.length);
  });

  it("matches cast voice, pitch and tone-adjusted rate to the design", () => {
    for (const job of jobs) {
      const cast = CHAPTER1_VOICE_CAST[job.speakerId].locales[job.locale];
      expect(job.voice).toBe(cast.voice);
      expect(job.pitch).toBeCloseTo(cast.pitch, 3);
      // The job rate is rounded to 3 decimals.
      const expectedRate = Math.round(cast.rate * TONE_RATE_MULTIPLIER[job.tone] * 1000) / 1000;
      expect(job.rate).toBe(expectedRate);
    }
  });

  it("uses the design tone multipliers", () => {
    expect(TONE_RATE_MULTIPLIER).toEqual({
      professional: 1.0,
      reassuring: 0.95,
      defensive: 1.0,
      impatient: 1.1,
      pressuring: 1.05,
    });
  });

  it("uses the Chapter 1 cast table", () => {
    expect(Object.keys(CHAPTER1_VOICE_CAST).sort()).toEqual(
      ["spk.alex", "spk.narrator", "spk.northgate-agent", "spk.recovery"],
    );
    expect(CHAPTER1_VOICE_CAST["spk.alex"].locales.en.voice).toBe("Microsoft David");
    expect(CHAPTER1_VOICE_CAST["spk.recovery"].locales.en.voice).toBe("Microsoft Mark");
    expect(CHAPTER1_VOICE_CAST["spk.northgate-agent"].locales.en.voice).toBe("Microsoft Zira");
    expect(CHAPTER1_VOICE_CAST["spk.narrator"].locales.en.voice).toBe("Microsoft Mark");
    for (const entry of Object.values(CHAPTER1_VOICE_CAST)) {
      expect(entry.locales.vi.voice).toBe("Microsoft An");
    }
    expect(CHAPTER1_VOICE_CAST["spk.narrator"].phoneFilter).toBe(false);
    expect(CHAPTER1_VOICE_CAST["spk.recovery"].phoneFilter).toBe(true);
  });

  it("gives speakers that share a voice a different rate or pitch", () => {
    for (const locale of ["en", "vi"] as const) {
      const entries = Object.entries(CHAPTER1_VOICE_CAST).map(([id, entry]) => ({ id, ...entry.locales[locale] }));
      for (const a of entries) {
        for (const b of entries) {
          if (a.id >= b.id || a.voice !== b.voice) continue;
          expect(a.rate !== b.rate || a.pitch !== b.pitch, `${locale}: ${a.id} vs ${b.id}`).toBe(true);
        }
      }
    }
  });

  it("derives a stable content version that changes with a line", () => {
    const version = computeChapterContentVersion(CHAPTER_1_SCENARIO);
    expect(version).toMatch(/^[0-9a-f]{8}$/);
    expect(computeChapterContentVersion(CHAPTER_1_SCENARIO)).toBe(version);
    const first = spoken[0];
    const changed = {
      ...CHAPTER_1_SCENARIO,
      dialogues: {
        ...CHAPTER_1_SCENARIO.dialogues,
        [first.graph.id]: {
          ...first.graph,
          lines: { ...first.graph.lines, [first.node.lineId]: `${first.graph.lines[first.node.lineId]} changed` },
        },
      },
    };
    expect(computeChapterContentVersion(changed)).not.toBe(version);
  });

  it("writes MP3 files under public/audio/chapter01 and WAV files outside public", () => {
    expect(CHAPTER1_VOICE_BASE).toBe("/audio/chapter01");
    for (const job of jobs) {
      expect(job.outMp3).toBe(`public/audio/chapter01/${job.locale}/${job.clipId}.mp3`);
      expect(job.outWav.startsWith("public/")).toBe(false);
      expect(job.outWav.endsWith(`${job.clipId}.wav`)).toBe(true);
    }
  });
});
