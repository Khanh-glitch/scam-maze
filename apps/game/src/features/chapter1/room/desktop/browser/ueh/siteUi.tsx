// Small building blocks shared by the two simulated UEH sites. Colors come from the site's palette.
import React from "react";
import { ChevronRight } from "lucide-react";
import type { SiteColors } from "./uehTheme";

export const SITE_FOCUS = "focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#f47a38]";

export const Card: React.FC<{
  colors: SiteColors;
  title?: string;
  icon?: React.ReactNode;
  accent?: boolean;
  testId?: string;
  className?: string;
  children: React.ReactNode;
}> = ({ colors, title, icon, accent = false, testId, className = "", children }) => (
  <section
    data-testid={testId}
    className={`rounded-xl border p-4 ${className}`}
    style={{
      background: accent ? colors.orangeSoft : colors.white,
      borderColor: accent ? colors.orange : colors.line,
      boxShadow: "0 1px 2px rgba(16,48,47,0.06), 0 6px 14px -8px rgba(16,48,47,0.18)",
    }}
  >
    {title && (
      <h3 className="mb-2 flex items-center gap-2 text-sm font-bold" style={{ color: colors.tealDark }}>
        {icon}
        {title}
      </h3>
    )}
    {children}
  </section>
);

export const Breadcrumbs: React.FC<{ colors: SiteColors; items: ReadonlyArray<{ label: string; onClick?: () => void }> }> = ({ colors, items }) => (
  <nav aria-label="breadcrumb" data-testid="site-breadcrumbs">
    <ol className="flex flex-wrap items-center gap-1 text-xs" style={{ color: colors.muted }}>
      {items.map((item, index) => (
        <li key={`${item.label}-${index}`} className="flex items-center gap-1">
          {index > 0 && <ChevronRight className="h-3 w-3" aria-hidden="true" />}
          {item.onClick ? (
            <button type="button" onClick={item.onClick} className={`cursor-pointer rounded underline-offset-2 hover:underline ${SITE_FOCUS}`} style={{ color: colors.teal }}>
              {item.label}
            </button>
          ) : (
            <span aria-current={index === items.length - 1 ? "page" : undefined} style={{ color: index === items.length - 1 ? colors.ink : colors.muted }}>
              {item.label}
            </span>
          )}
        </li>
      ))}
    </ol>
  </nav>
);

export function siteButtonClass(kind: "primary" | "accent" | "quiet"): string {
  const base = `inline-flex cursor-pointer items-center justify-center gap-2 rounded-lg px-4 py-2 text-sm font-semibold motion-safe:transition-colors disabled:cursor-not-allowed ${SITE_FOCUS}`;
  if (kind === "primary") return `${base} bg-[#005b69] text-white hover:bg-[#00424d] disabled:bg-[#c4d8d6] disabled:text-[#5d7776]`;
  if (kind === "accent") return `${base} bg-[#f47a38] text-[#2b1700] hover:bg-[#e06a26] disabled:bg-[#ecd9c3] disabled:text-[#7a6650]`;
  return `${base} border border-[#bcd5d2] bg-white text-[#10302f] hover:bg-[#eef6f5] disabled:text-[#8aa3a1]`;
}

/**
 * A form field that is filled with the game's fictional data. It cannot be typed into, so the player
 * never types a real value; "use my saved details" buttons fill it.
 */
export const GameField: React.FC<{ colors: SiteColors; id: string; label: string; value: string; placeholder: string }> = ({ colors, id, label, value, placeholder }) => (
  <div>
    <label htmlFor={id} className="block text-xs font-semibold" style={{ color: colors.muted }}>
      {label}
    </label>
    <input
      id={id}
      data-testid={id}
      readOnly
      value={value}
      placeholder={placeholder}
      className="mt-1 w-full rounded-lg border bg-white px-3 py-2 text-sm tabular-nums outline-none read-only:cursor-default focus-visible:ring-2 focus-visible:ring-[#f47a38]"
      style={{ borderColor: colors.line, color: colors.ink }}
    />
  </div>
);

export const Progress: React.FC<{ colors: SiteColors; percent: number; label: string }> = ({ colors, percent, label }) => (
  <div
    role="progressbar"
    aria-label={label}
    aria-valuemin={0}
    aria-valuemax={100}
    aria-valuenow={Math.round(percent)}
    className="h-2.5 w-full overflow-hidden rounded-full"
    style={{ background: colors.tealSoft }}
  >
    <div className="h-full rounded-full" style={{ width: `${Math.max(0, Math.min(100, percent))}%`, background: `linear-gradient(90deg, ${colors.teal}, ${colors.orange})` }} />
  </div>
);
