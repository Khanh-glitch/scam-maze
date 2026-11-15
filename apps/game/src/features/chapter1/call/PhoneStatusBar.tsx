// Decorative iPhone-style status bar of the call screen: the in-game clock on the left, the
// Dynamic Island gap in the middle, and signal, Wi-Fi and battery images on the right. DOM only. The clock reads the same in-game time as the wall clock of the room (`gameClock`).
import React, { useEffect, useState } from "react";
import { gameClockText } from "../../../game/clock/gameClock";

export type StatusBarTone = "dark" | "light";

/**
 * Owner-supplied icon art (PNG at 3x). `dark` = white glyphs for a dark screen (the call screen,
 * folder `statusBar`); `light` = dark glyphs for a light screen (folder `StatusBarLight`). The
 * battery art has the level (76) drawn in, so the level is fixed. The clock is live text instead
 * of `Time.png`, because it must follow the in-game time.
 */
const TONES: Record<StatusBarTone, { dir: string; ink: string }> = {
  dark: { dir: "/assets/ui/statusBar", ink: "#ffffff" },
  light: { dir: "/assets/ui/StatusBarLight", ink: "#000000" },
};

/** Icon size in CSS px: the art is 3x, so 1/3 of its pixel size. */
const ICONS = [
  { file: "Mobile Signal.png", w: 17, h: 11 },
  { file: "Wifi.png", w: 16, h: 11 },
  { file: "Battery.png", w: 24, h: 13 },
] as const;

export const PhoneStatusBar: React.FC<{ tone?: StatusBarTone }> = ({ tone = "dark" }) => {
  const [time, setTime] = useState(gameClockText);
  useEffect(() => {
    const id = window.setInterval(() => setTime(gameClockText()), 1000);
    return () => window.clearInterval(id);
  }, []);
  const c = TONES[tone];
  return (
    <div
      aria-hidden="true"
      data-testid="phone-status-bar"
      data-tone={tone}
      className="pointer-events-none absolute inset-x-0 top-[1.25%] grid h-[4.2%] grid-cols-[1fr_31%_1fr] items-center"
      style={{ color: c.ink }}
    >
      <span data-testid="phone-status-time" className="text-center text-[15px] font-semibold leading-none tabular-nums">
        {time}
      </span>
      <span />
      <span className="flex items-center justify-center gap-1.5">
        {ICONS.map((icon) => (
          <img
            key={icon.file}
            src={`${c.dir}/${encodeURIComponent(icon.file)}`}
            alt=""
            width={icon.w}
            height={icon.h}
            draggable={false}
            style={{ width: icon.w, height: icon.h }}
          />
        ))}
      </span>
    </div>
  );
};
