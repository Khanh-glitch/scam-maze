// The subtitles of Alex's voice lines: one sentence at a time, at the position of the clip, in the
// language of the game, never two sentences together, gone when the clip ends.
import { act, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { applyLocale } from "../../../i18n";
import en from "../../../i18n/locales/en/chapter1/voice";
import vi_ from "../../../i18n/locales/vi/chapter1/voice";
import { MISSION01_VOICE_CUES, type Mission01VoiceCue } from "./mission01Voice";
import { MISSION01_SUBTITLE_TIMINGS } from "./mission01SubtitleTimings";
import { buildSubtitleCues, cueAt, splitCaptionUnits } from "./mission01Subtitles";
import { Mission01VoiceCaption } from "./Mission01VoiceCaption";

const TEXTS = { en: en.voice.alex as Record<string, string>, vi: vi_.voice.alex as Record<string, string> };

describe("the caption units", () => {
  it("are the sentences of the transcript, one at a time", () => {
    expect(splitCaptionUnits("Seventy-two hours.\nThat's all I have left.")).toEqual(["Seventy-two hours.", "That's all I have left."]);
    expect(splitCaptionUnits("Okay. One section at a time. I can do this.")).toEqual(["Okay.", "One section at a time.", "I can do this."]);
    expect(splitCaptionUnits("Nhưng... lỡ nó là thật thì sao?")).toEqual(["Nhưng...", "lỡ nó là thật thì sao?"]);
    expect(splitCaptionUnits("  \n ")).toEqual([]);
  });

  it("never need more than two lines of subtitle", () => {
    for (const locale of ["en", "vi"] as const) {
      for (const cue of MISSION01_VOICE_CUES) {
        for (const unit of splitCaptionUnits(TEXTS[locale][cue])) expect(unit.length, `${locale} ${cue}: ${unit}`).toBeLessThanOrEqual(110);
      }
    }
  });
});

describe("the timings of each clip", () => {
  it("exist for every cue in both languages, with one timing per caption unit", () => {
    for (const locale of ["en", "vi"] as const) {
      for (const cue of MISSION01_VOICE_CUES) {
        const units = splitCaptionUnits(TEXTS[locale][cue]);
        const timings = MISSION01_SUBTITLE_TIMINGS[locale][cue];
        expect(timings, `${locale} ${cue}`).toBeDefined();
        expect(timings.length, `${locale} ${cue}`).toBe(units.length);
      }
    }
  });

  it("run forward inside the clip and give every sentence time to be read", () => {
    for (const locale of ["en", "vi"] as const) {
      for (const cue of MISSION01_VOICE_CUES) {
        const timings = MISSION01_SUBTITLE_TIMINGS[locale][cue];
        timings.forEach(([start, end], index) => {
          expect(end, `${locale} ${cue} #${index}`).toBeGreaterThan(start + 300);
          expect(end, `${locale} ${cue} #${index}`).toBeLessThanOrEqual(36_500);
          if (index > 0) {
            expect(start, `${locale} ${cue} #${index}`).toBeGreaterThanOrEqual(timings[index - 1][0]);
            // A sentence never starts long before the previous one ends.
            expect(start, `${locale} ${cue} #${index}`).toBeGreaterThanOrEqual(timings[index - 1][1] - 250);
          }
        });
      }
    }
  });

  it("find the sentence that is spoken at a moment of the clip, and nothing between two sentences or after the end", () => {
    const cues = buildSubtitleCues(TEXTS.en.intro, MISSION01_SUBTITLE_TIMINGS.en.intro, 35_400);
    expect(cueAt(cues, 100)?.text).toBe("Seventy-two hours.");
    expect(cueAt(cues, 3500)?.text).toBe("That's all I have left.");
    expect(cueAt(cues, 35_300)?.text).toBe("I should get back to work.");
    expect(cueAt(cues, 36_000)).toBeNull();
    expect(cueAt(cues, 2_900)).toBeNull();
  });

  it("spread the sentences over the clip by length when a clip has no timing", () => {
    const cues = buildSubtitleCues("One. Two two.", undefined, 3000);
    expect(cues.map((cue) => cue.text)).toEqual(["One.", "Two two."]);
    expect(cues[0].startMs).toBe(0);
    expect(cues[1].endMs).toBeCloseTo(3000);
    expect(cues[0].endMs).toBe(cues[1].startMs);
  });
});

describe("the subtitle on screen", () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    applyLocale("en");
  });

  const show = (cue: Mission01VoiceCue | null, position: { ms: number }, subtitlesEnabled = true) =>
    render(<Mission01VoiceCaption cue={cue} subtitlesEnabled={subtitlesEnabled} getPositionMs={() => position.ms} />);
  const text = () => screen.queryByTestId("alex-voice-caption")?.textContent ?? null;
  const tick = (ms = 100) => act(() => void vi.advanceTimersByTime(ms));

  it("shows only the sentence that is being said, following the clip", () => {
    applyLocale("en");
    const position = { ms: 100 };
    show("intro", position);
    tick();
    expect(text()).toBe("Seventy-two hours.");
    position.ms = 3500;
    tick();
    expect(text()).toBe("That's all I have left.");
    position.ms = 2900;
    tick();
    expect(text()).toBeNull();
    position.ms = 36_000;
    tick();
    expect(text()).toBeNull();
  });

  it("uses the language and the timing of the language that is chosen", () => {
    applyLocale("vi");
    const position = { ms: 100 };
    show("intro", position);
    tick();
    expect(text()).toBe("Bảy mươi hai giờ.");
    position.ms = 22_800;
    tick();
    expect(text()).toBe("Còn chuyện công việc sau khi tốt nghiệp...");
    position.ms = 24_800;
    tick();
    expect(text()).toBe("mình vẫn chưa biết phải làm sao.");
  });

  it("shows nothing when Subtitles are off or no line is playing", () => {
    applyLocale("en");
    show("verify", { ms: 500 }, false);
    tick();
    expect(text()).toBeNull();
    show(null, { ms: 500 });
    tick();
    expect(text()).toBeNull();
  });

  it("sits at the bottom centre, above the bottom hint, and is at most two lines", () => {
    applyLocale("en");
    show("verify", { ms: 500 });
    tick();
    const wrap = screen.getByTestId("alex-voice-caption-wrap");
    expect(wrap.className).toContain("bottom-[11%]");
    expect(wrap.className).toContain("justify-center");
    expect(screen.getByTestId("alex-voice-caption").className).toContain("line-clamp-2");
  });
});
