// Which lucide icon a response card shows. It is chosen deterministically from the option id (the
// last segment, for example `ask-verify` in `rec.opt.confirms-alex.ask-verify`) and from the
// fallback flag, never from the wording in the current language, so both locales show the same
// icon. Pure: no React, no i18n.

export type ChoiceIconKind = "hang-up" | "challenge" | "reply";

/** Segments (split at `-`) that end or refuse the call. */
const HANG_UP_WORDS: ReadonlySet<string> = new Set(["hang", "hangup", "refuse", "decline", "stop", "end", "done"]);
/** Segments that challenge the caller or ask to verify. */
const CHALLENGE_WORDS: ReadonlySet<string> = new Set([
  "verify",
  "proof",
  "who",
  "callback",
  "challenge",
  "challenging",
  "check",
]);

export function choiceIconKind(option: { id: string; fallback?: boolean }): ChoiceIconKind {
  // The engine-provided fallback option always ends the conversation: the hang-up exit.
  if (option.fallback === true) return "hang-up";
  const last = option.id.slice(option.id.lastIndexOf(".") + 1).toLowerCase();
  const words = last.split("-");
  // "call-back" is two words: join the neighbours before the lookup.
  if (last.includes("call-back")) return "challenge";
  if (words.some((word) => HANG_UP_WORDS.has(word))) return "hang-up";
  if (words.some((word) => CHALLENGE_WORDS.has(word))) return "challenge";
  return "reply";
}
