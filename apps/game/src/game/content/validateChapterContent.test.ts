// Example tests for the Chapter 1 content validator (V5, V6, V7) on the real scenario.
// The Vietnamese overlay and the manifest are built here from the scenario text (one present clip
// per spoken node and locale), so the tests do not depend on the generated manifest or on the
// translation tasks. Checking the committed manifest against the real overlay belongs to the voice
// task that regenerates it.

import { describe, expect, it } from "vitest";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import { buildVoiceJobs, isSpokenNode, overlayLineKey } from "../voice/buildVoiceJobs";
import type { VoiceClipEntry, VoiceManifest } from "../voice/manifestTypes";
import {
  CLIP_MIME,
  validateChapterContent,
  type ClipFileInfo,
  type FileInfoLookup,
} from "./validateChapterContent";

interface Fixture {
  overlay: Record<string, string>;
  manifest: VoiceManifest;
  files: Map<string, ClipFileInfo>;
}

function buildFixture(): Fixture {
  const overlay: Record<string, string> = {};
  for (const graph of Object.values(CHAPTER_1_SCENARIO.dialogues)) {
    for (const node of Object.values(graph.nodes)) {
      if (isSpokenNode(node)) overlay[overlayLineKey(graph.id, node.lineId)] = `[vi] ${graph.lines[node.lineId]}`;
    }
  }
  const files = new Map<string, ClipFileInfo>();
  const clips: VoiceClipEntry[] = buildVoiceJobs(CHAPTER_1_SCENARIO, { vi: overlay }).map((job) => {
    const src = `${CHAPTER1_VOICE_BASE}/${job.locale}/${job.clipId}.mp3`;
    files.set(src, { exists: true, bytes: 5000, mime: CLIP_MIME, durationMs: 4000 });
    return {
      clipId: job.clipId,
      nodeId: job.clipId,
      graphId: job.graphId,
      speakerId: job.speakerId,
      locale: job.locale,
      tone: job.tone,
      voiceNote: "test",
      sourceTextHash: job.textHash,
      status: "present",
      sources: [{ src, type: CLIP_MIME }],
      durationMs: 4000,
      bytes: 5000,
      origin: "tts-generated",
      credit: "test",
    } as VoiceClipEntry;
  });
  return { overlay, manifest: { schemaVersion: 1, chapterId: "chapter-1", clips } as VoiceManifest, files };
}

function run(fixture: Fixture, patch: { overlay?: Record<string, string>; manifest?: VoiceManifest; fileInfo?: FileInfoLookup } = {}) {
  return validateChapterContent({
    scenario: CHAPTER_1_SCENARIO,
    overlays: { vi: patch.overlay ?? fixture.overlay },
    manifest: patch.manifest ?? fixture.manifest,
    fileInfo: patch.fileInfo ?? ((src) => fixture.files.get(src)),
  });
}

function lineIdOf(nodeId: string): string {
  for (const graph of Object.values(CHAPTER_1_SCENARIO.dialogues)) {
    const node = (graph.nodes as Record<string, { lineId?: string }>)[nodeId];
    if (node?.lineId !== undefined) return node.lineId;
  }
  throw new Error(`No line for node ${nodeId}`);
}

describe("validateChapterContent on the real Chapter 1 scenario", () => {
  it("covers every spoken node of every graph, including the narration graphs", () => {
    const fixture = buildFixture();
    const graphs = new Set(fixture.manifest.clips.map((clip) => clip.graphId));
    for (const id of ["dlg.alex", "dlg.recovery", "dlg.official-line", "dlg.aftermath", "dlg.intro"]) {
      expect(graphs.has(id as never), id).toBe(true);
    }
  });

  it("reports no issue for a complete overlay, manifest and file set", () => {
    expect(run(buildFixture())).toEqual([]);
  });

  it("without fileInfo, still checks V5 and V6 and reports nothing", () => {
    const fixture = buildFixture();
    expect(
      validateChapterContent({
        scenario: CHAPTER_1_SCENARIO,
        overlays: { vi: fixture.overlay },
        manifest: fixture.manifest,
      }),
    ).toEqual([]);
  });
});

describe("validateChapterContent broken fixtures", () => {
  it("V5: reports a Vietnamese overlay text that is removed", () => {
    const fixture = buildFixture();
    const clip = fixture.manifest.clips.find((entry) => entry.locale === "vi") as VoiceClipEntry;
    const overlay = { ...fixture.overlay };
    delete overlay[overlayLineKey(clip.graphId, lineIdOf(clip.nodeId))];
    const issues = run(fixture, { overlay });
    expect(issues.some((issue) => issue.check === "V5" && issue.where.includes(clip.nodeId))).toBe(true);
  });

  it("V6: reports a manifest that lacks an entry", () => {
    const fixture = buildFixture();
    const dropped = fixture.manifest.clips[0];
    const manifest = { ...fixture.manifest, clips: fixture.manifest.clips.slice(1) } as VoiceManifest;
    const issues = run(fixture, { manifest });
    expect(issues.some((issue) => issue.check === "V6" && issue.where.includes(dropped.nodeId))).toBe(true);
  });

  it("V6: reports a stale sourceTextHash", () => {
    const fixture = buildFixture();
    const target = fixture.manifest.clips[0];
    const manifest = {
      ...fixture.manifest,
      clips: fixture.manifest.clips.map((entry) =>
        entry === target ? { ...entry, sourceTextHash: "00000000" } : entry,
      ),
    } as VoiceManifest;
    const issues = run(fixture, { manifest });
    expect(issues.some((issue) => issue.check === "V6" && issue.where.includes(target.nodeId))).toBe(true);
  });

  it("V7: reports a present clip whose file is missing", () => {
    const fixture = buildFixture();
    const target = fixture.manifest.clips[0];
    const fileInfo: FileInfoLookup = (src) => (src === target.sources[0].src ? undefined : fixture.files.get(src));
    const issues = run(fixture, { fileInfo });
    expect(issues.some((issue) => issue.check === "V7" && issue.where.includes(target.nodeId))).toBe(true);
  });

  it("V7: reports a wrong MIME type and a size that differs from the manifest", () => {
    const fixture = buildFixture();
    const target = fixture.manifest.clips[0];
    const fileInfo: FileInfoLookup = (src) => {
      const info = fixture.files.get(src);
      if (info === undefined || src !== target.sources[0].src) return info;
      return { ...info, mime: "audio/wav", bytes: info.bytes + 1 };
    };
    const issues = run(fixture, { fileInfo }).filter(
      (issue) => issue.check === "V7" && issue.where.includes(target.nodeId),
    );
    expect(issues.length).toBeGreaterThanOrEqual(2);
  });
});
