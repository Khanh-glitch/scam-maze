// Decorative iPhone-style status bar of the call screen: the in-game clock on the left, the
// Dynamic Island gap in the middle, and signal, Wi-Fi and battery on the right. DOM and inline SVG
// only. The clock reads the same in-game time as the wall clock of the room (`gameClock`).
import React, { useEffect, useState } from "react";
import { gameClockText } from "../../../game/clock/gameClock";

/** Fixed battery level shown in the pill. */
const BATTERY_LEVEL = 76;

export type StatusBarTone = "dark" | "light";

/** `dark` = white glyphs for a dark screen (the call screen); `light` = black glyphs for a light one. */
const TONES: Record<StatusBarTone, { ink: string; track: string; label: string }> = {
  dark: { ink: "#ffffff", track: "rgba(255,255,255,0.35)", label: "#000000" },
  light: { ink: "#000000", track: "rgba(0,0,0,0.35)", label: "#ffffff" },
};

const SignalIcon: React.FC<{ ink: string }> = ({ ink }) => (
  <svg viewBox="0 0 18 12" className="h-3 w-[18px]" fill={ink} aria-hidden="true">
    <rect x="0" y="8" width="3" height="4" rx="0.9" />
    <rect x="5" y="5.5" width="3" height="6.5" rx="0.9" />
    <rect x="10" y="3" width="3" height="9" rx="0.9" />
    <rect x="15" y="0" width="3" height="12" rx="0.9" />
  </svg>
);

const WifiIcon: React.FC<{ ink: string }> = ({ ink }) => (
  <svg viewBox="0 0 17 12" className="h-3 w-[17px]" fill="none" stroke={ink} strokeWidth="1.9" strokeLinecap="round" aria-hidden="true">
    <path d="M1.2 4.2a10 10 0 0 1 14.6 0" />
    <path d="M3.9 7a6.1 6.1 0 0 1 9.2 0" />
    <circle cx="8.5" cy="10.1" r="1.2" fill={ink} stroke="none" />
  </svg>
);

const BatteryIcon: React.FC<{ ink: string; track: string; label: string; level: number }> = ({ ink, track, label, level }) => (
  <svg viewBox="0 0 27 13" className="h-[13px] w-[27px]" aria-hidden="true">
    <rect x="0" y="0" width="24" height="13" rx="4" fill={track} />
    <rect x="0" y="0" width={(24 * level) / 100} height="13" rx="4" fill={ink} />
    <rect x="25" y="4.2" width="1.8" height="4.6" rx="0.9" fill={track} />
    <text x="12" y="10.2" textAnchor="middle" fontSize="9.5" fontWeight="700" fill={label} fontFamily="system-ui, sans-serif">
      {level}
    </text>
  </svg>
);

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
        <SignalIcon ink={c.ink} />
        <WifiIcon ink={c.ink} />
        <BatteryIcon ink={c.ink} track={c.track} label={c.label} level={BATTERY_LEVEL} />
      </span>
    </div>
  );
};
