import { describe, expect, it } from "vitest";
import { crossfadeMs, isTense, selectMusicCue } from "./musicCueSelection";
import { MUSIC_MANIFEST } from "./musicManifest";

describe("selectMusicCue", () => {
  it("is silent when sound is off, whatever the scene", () => {
    expect(selectMusicCue({ scene: "room", soundEnabled: false })).toBeNull();
    expect(selectMusicCue({ scene: "ending", soundEnabled: false, outcome: "hope" })).toBeNull();
    expect(selectMusicCue({ scene: "street", soundEnabled: false })).toBeNull();
  });

  it("leaves the menu to its own recorded track", () => {
    expect(selectMusicCue({ scene: "menu", soundEnabled: true })).toBeNull();
  });

  it("plays the theme for the intro and the calm room when nothing is wrong", () => {
    expect(selectMusicCue({ scene: "intro", soundEnabled: true })).toBe("theme.alex");
    expect(selectMusicCue({ scene: "room", soundEnabled: true })).toBe("room.calm");
    expect(selectMusicCue({ scene: "room", soundEnabled: true, tense: false })).toBe("room.calm");
  });

  it("switches the room to the tense cue when a signal fires", () => {
    expect(selectMusicCue({ scene: "room", soundEnabled: true, tense: true })).toBe("room.tense");
  });

  it("plays street and ride outside, and the radio wins over both", () => {
    expect(selectMusicCue({ scene: "street", soundEnabled: true })).toBe("street");
    expect(selectMusicCue({ scene: "ride", soundEnabled: true })).toBe("ride");
    expect(selectMusicCue({ scene: "street", soundEnabled: true, radio: "room.calm" })).toBe(
      "room.calm",
    );
  });

  it("lets the ending win over every other scene", () => {
    expect(
      selectMusicCue({ scene: "ending", soundEnabled: true, outcome: "hope", radio: "street" }),
    ).toBe("ending.hope");
    expect(selectMusicCue({ scene: "ending", soundEnabled: true, outcome: "cost" })).toBe(
      "ending.cost",
    );
    expect(selectMusicCue({ scene: "ending", soundEnabled: true })).toBe("ending.cost");
  });
});

describe("isTense", () => {
  const base = { scamSurfaceOpen: false, security: 100, minutesLeft: 4320 };

  it("is tense while a scam surface is open", () => {
    expect(isTense({ ...base, scamSurfaceOpen: true })).toBe(true);
  });

  it("turns tense exactly at the security threshold", () => {
    const limit = MUSIC_MANIFEST.tense.securityAtMost;
    expect(isTense({ ...base, security: limit + 1 })).toBe(false);
    expect(isTense({ ...base, security: limit })).toBe(true);
  });

  it("turns tense when the deadline is close", () => {
    const limit = MUSIC_MANIFEST.tense.minutesLeftAtMost;
    expect(isTense({ ...base, minutesLeft: limit + 1 })).toBe(false);
    expect(isTense({ ...base, minutesLeft: limit })).toBe(true);
  });
});

describe("crossfadeMs", () => {
  it("does nothing when the cue does not change", () => {
    expect(crossfadeMs("room.calm", "room.calm")).toBe(0);
    expect(crossfadeMs(null, null)).toBe(0);
  });

  it("gives the room's two moods a medium fade and the ending the longest", () => {
    expect(crossfadeMs("room.calm", "room.tense")).toBe(MUSIC_MANIFEST.crossfadeMs.roomMood);
    expect(crossfadeMs("room.tense", "ending.cost")).toBe(MUSIC_MANIFEST.crossfadeMs.ending);
    expect(crossfadeMs(null, "ending.hope")).toBe(MUSIC_MANIFEST.crossfadeMs.ending);
  });

  it("fades room to street with the default length", () => {
    expect(crossfadeMs("room.calm", "street")).toBe(MUSIC_MANIFEST.crossfadeMs.default);
    expect(crossfadeMs("street", "ride")).toBe(MUSIC_MANIFEST.crossfadeMs.default);
  });
});
