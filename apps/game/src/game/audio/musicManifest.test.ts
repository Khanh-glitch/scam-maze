import { readFileSync } from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
import {
  MUSIC_CUE_IDS,
  MUSIC_MANIFEST,
  barSeconds,
  cueGain,
  findMusicCue,
  loopSeconds,
  musicCueUrl,
} from "./musicManifest";

const FILE_PATTERN = /^[a-z0-9_]+\.(mp3|ogg)$/;

describe("music manifest", () => {
  it("lists exactly the cue ids the game knows", () => {
    expect(MUSIC_MANIFEST.cues.map((cue) => cue.id)).toEqual([...MUSIC_CUE_IDS]);
  });

  it("uses lower-case file names inside the music directory", () => {
    for (const cue of MUSIC_MANIFEST.cues) {
      expect(cue.file, cue.id).toMatch(FILE_PATTERN);
      expect(musicCueUrl(cue)).toBe(`${MUSIC_MANIFEST.directory}/${cue.file}`);
    }
  });

  it("never maps two cues to the same file", () => {
    const files = MUSIC_MANIFEST.cues.map((cue) => cue.file);
    expect(new Set(files).size).toBe(files.length);
  });

  it("keeps gains, ducking and priorities in usable ranges", () => {
    for (const cue of MUSIC_MANIFEST.cues) {
      expect(cueGain(cue), cue.id).toBeGreaterThan(0);
      expect(cueGain(cue), cue.id).toBeLessThanOrEqual(1);
      expect(cue.duckDb, cue.id).toBeLessThan(0);
      expect(cue.priority, cue.id).toBeGreaterThan(0);
    }
    expect(new Set(MUSIC_MANIFEST.cues.map((cue) => cue.priority)).size).toBe(
      MUSIC_MANIFEST.cues.length,
    );
  });

  it("gives loop cues an exact bar length and one-shots a length window", () => {
    for (const cue of MUSIC_MANIFEST.cues) {
      if (cue.loop) {
        const seconds = loopSeconds(cue);
        expect(seconds, cue.id).not.toBeNull();
        expect(seconds!, cue.id).toBeCloseTo(barSeconds(cue.bpm) * cue.bars, 6);
        expect(cue.lengthRangeSeconds, cue.id).toBeUndefined();
        expect(seconds!, cue.id).toBeGreaterThan(30);
      } else {
        expect(loopSeconds(cue), cue.id).toBeNull();
        const range = cue.lengthRangeSeconds;
        expect(range, cue.id).toBeDefined();
        expect(range![0], cue.id).toBeLessThan(range![1]);
        const composed = barSeconds(cue.bpm) * cue.bars;
        expect(range![0], cue.id).toBeGreaterThanOrEqual(composed * 0.9 - 1e-6);
      }
    }
  });

  it("keeps the composers' brief in sync with the manifest", () => {
    const brief = readFileSync(path.resolve(process.cwd(), "../../docs/gameplay/MUSIC_BRIEF.md"), "utf8");
    for (const cue of MUSIC_MANIFEST.cues) {
      expect(brief, cue.id).toContain(cue.file);
      expect(brief, cue.id).toContain(cue.id);
    }
    expect(brief).toContain(MUSIC_MANIFEST.directory);
    expect(brief).toContain(`${Math.abs(MUSIC_MANIFEST.loudness.loopLufs)} LUFS`);
  });

  it("resolves cues by id", () => {
    expect(findMusicCue("room.calm")?.file).toBe("room_calm.mp3");
    expect(findMusicCue("radio.lofi")).toBeUndefined();
  });
});
