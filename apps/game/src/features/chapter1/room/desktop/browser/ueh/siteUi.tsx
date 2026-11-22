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

/** One saved entry offered under a field, like a browser's autofill list. */
export interface AutofillSuggestion {
  testId: string;
  primary: string;
  secondary?: string;
  onPick: () => void;
}

/**
 * A form field that behaves like a real one but never takes a real value. Focusing it shows the
 * browser's saved entries (`suggestions`) the way Chrome does. Typing works too, but whatever key is
 * pressed, the field "types" the next character of the game's fictional value (`typesAs`), so a real
 * login, card number or password never enters the game. Paste and drop are ignored.
 *
 * `freeDigits` makes it a plain numeric field (for a one-time code the game itself shows on the
 * phone): only digits, up to that many.
 */
export const GameField: React.FC<{
  colors: SiteColors;
  id: string;
  label: string;
  value: string;
  placeholder?: string;
  onChange?: (value: string) => void;
  typesAs?: string;
  freeDigits?: number;
  /** Shown as dots (a password). */
  secret?: boolean;
  suggestionsLabel?: string;
  suggestionsIcon?: React.ReactNode;
  suggestions?: readonly AutofillSuggestion[];
  invalid?: string | null;
}> = ({ colors, id, label, value, placeholder, onChange, typesAs, freeDigits, secret = false, suggestionsLabel, suggestionsIcon, suggestions = [], invalid = null }) => {
  const [focused, setFocused] = React.useState(false);
  const showList = focused && value === "" && suggestions.length > 0 && onChange !== undefined;
  const typed = (next: string) => onChange?.(next);
  const onKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (freeDigits !== undefined || onChange === undefined) return;
    if (event.key === "Backspace") {
      event.preventDefault();
      typed(value.slice(0, -1));
    } else if (event.key.length === 1 && !event.ctrlKey && !event.metaKey && !event.altKey) {
      event.preventDefault();
      if (typesAs !== undefined && value.length < typesAs.length) typed(typesAs.slice(0, value.length + 1));
    }
  };
  const block = (event: React.SyntheticEvent) => {
    if (freeDigits === undefined) event.preventDefault();
  };
  // The real browser must never offer the player's own saved logins or cards here (owner): a field
  // that types the game's value is read-only to the browser (no autofill on read-only fields), and a
  // secret is drawn as dots instead of being a password field (which wakes the password manager).
  const scripted = freeDigits === undefined && onChange !== undefined;
  const shown = secret ? "\u2022".repeat(value.length) : value;
  return (
    <div className="relative">
      <label htmlFor={id} className="block text-xs font-semibold" style={{ color: colors.muted }}>
        {label}
      </label>
      <div className="relative mt-1">
      <input
        id={id}
        data-testid={id}
        type="text"
        name={`game-${id}`}
        inputMode={freeDigits !== undefined ? "numeric" : undefined}
        autoComplete="off"
        autoCorrect="off"
        autoCapitalize="off"
        spellCheck={false}
        data-1p-ignore=""
        data-lpignore="true"
        data-form-type="other"
        readOnly={onChange === undefined || scripted}
        aria-readonly={onChange === undefined ? true : undefined}
        value={shown}
        placeholder={placeholder}
        aria-invalid={invalid ? true : undefined}
        aria-describedby={invalid ? `${id}-error` : undefined}
        onFocus={() => setFocused(true)}
        onBlur={() => setFocused(false)}
        onKeyDown={onKeyDown}
        onPaste={block}
        onDrop={block}
        onChange={(event) => {
          if (freeDigits !== undefined) typed(event.target.value.replace(/\D/g, "").slice(0, freeDigits));
        }}
        className={`w-full rounded-lg border bg-white px-3 py-2 text-sm tabular-nums outline-none focus:border-[#f47a38] focus-visible:ring-2 focus-visible:ring-[#f47a38]/40 ${onChange === undefined ? "cursor-default" : "cursor-text"}`}
        style={{ borderColor: invalid ? "#b42318" : colors.line, color: colors.ink, letterSpacing: freeDigits !== undefined ? "0.3em" : undefined }}
      />
      {scripted && focused && (
        // A read-only field draws no caret, so the page draws one after the text.
        <div aria-hidden="true" className="pointer-events-none absolute inset-0 flex items-center overflow-hidden px-[13px] text-sm tabular-nums">
          <span className="invisible whitespace-pre">{shown}</span>
          <span data-testid={`${id}-caret`} className="game-caret ml-px inline-block h-4 w-px" style={{ background: colors.ink }} />
        </div>
      )}
      </div>
      {invalid && (
        <p id={`${id}-error`} className="mt-1 text-xs" style={{ color: "#b42318" }}>
          {invalid}
        </p>
      )}
      {showList && (
        // The browser's own list, not part of the page: neutral gray, like Chrome's.
        <div
          role="listbox"
          aria-label={suggestionsLabel}
          data-testid={`${id}-suggestions`}
          className="absolute left-0 right-0 top-full z-20 mt-1 overflow-hidden rounded-lg border border-[#d0d4da] bg-white py-1 text-left shadow-[0_8px_24px_rgba(15,23,42,0.18)]"
        >
          {suggestionsLabel && (
            <p className="flex items-center gap-1.5 px-3 pb-1 pt-0.5 text-[11px] font-medium text-[#5f6368]">
              {suggestionsIcon}
              {suggestionsLabel}
            </p>
          )}
          {suggestions.map((entry) => (
            <button
              key={entry.testId}
              type="button"
              role="option"
              aria-selected="false"
              data-testid={entry.testId}
              // Keeps the focus in the field while the mouse is down, as the browser list does.
              onMouseDown={(event) => event.preventDefault()}
              onClick={entry.onPick}
              className="flex w-full cursor-pointer flex-col px-3 py-1.5 text-left hover:bg-[#f1f3f4] focus-visible:bg-[#e8f0fe] focus-visible:outline-none"
            >
              <span className="text-sm text-[#202124]">{entry.primary}</span>
              {entry.secondary && <span className="text-xs text-[#5f6368]">{entry.secondary}</span>}
            </button>
          ))}
        </div>
      )}
    </div>
  );
};

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
