// Chapter 1 content tests (spec chapter-01-double-deception, task 7.5; Requirements 5.1, 5.4, 5.5,
// 6.4, 6.5, 12.4, 19.1, 19.2). Data lint over every text field of the scenario, plus checks that
// the first call and its records carry the case ID and foreshadow the later layers.
import { isOwnerApprovedHost } from "../approvedDomains";
import { readFileSync, readdirSync, existsSync } from "node:fs";
import { join, resolve } from "node:path";
import { describe, expect, it } from "vitest";
import { chapterReducer, createInitialState } from "../reducer";
import { DECLINE_ALEX } from "../../../test/chapterRuns";
import { ALEX_DIALOGUE } from "./dialogues/alex";
import { CHAPTER_1_SCENARIO } from "./scenario";
import { CASE_REFERENCE } from "./sources";

const SCENARIO = CHAPTER_1_SCENARIO;

// ---------------------------------------------------------------------------
// Lint helpers
// ---------------------------------------------------------------------------

const DOMAIN_PATTERN =
  /\b(?:[a-z0-9-]+\.)+(?:com|net|org|io|bank|gov|edu|co|vn|app|info|biz|xyz|ru|cn|uk|us|me|tv|cc|site|online|test|example|invalid|local)\b/gi;
const PHONE_PATTERN = /\+\s?\d[\d\s().-]*\d/g;
const ID_LIKE = /^(?:ev|dev|src|ded|obj|call|dlg|msg|claim|ws|spk|act|off|alex|rec|after|intro|note|beat|opt|line)\.[a-z0-9.-]+$/;

function reservedHost(host: string): boolean {
  const h = host.toLowerCase();
  if (isOwnerApprovedHost(h)) return true;
  return (
    h.endsWith(".test") ||
    h.endsWith(".example") ||
    h.endsWith(".invalid") ||
    h === "example.com" ||
    h.endsWith(".example.com")
  );
}

/** Problems found in one piece of text. Empty means the text passes the content rules. */
function lintText(text: string): string[] {
  const problems: string[] = [];
  if (/\bsafe\b/i.test(text) || /an toàn/i.test(text)) problems.push('uses "safe" wording');
  for (const host of text.match(DOMAIN_PATTERN) ?? []) {
    if (!reservedHost(host)) problems.push(`domain ${host} is not reserved`);
  }
  for (const number of text.match(PHONE_PATTERN) ?? []) {
    if (!number.replace(/\s/g, "").startsWith("+000")) problems.push(`number ${number} does not start with +000`);
  }
  return problems;
}

/** Every user-facing string in the scenario with its path. ID-like strings are skipped. */
function collectStrings(value: unknown, path: string, out: Array<{ path: string; text: string }>): void {
  if (typeof value === "string") {
    if (!ID_LIKE.test(value)) out.push({ path, text: value });
    return;
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => collectStrings(item, `${path}[${index}]`, out));
    return;
  }
  if (value !== null && typeof value === "object") {
    for (const [key, child] of Object.entries(value)) collectStrings(child, `${path}.${key}`, out);
  }
}

const ALL_STRINGS: Array<{ path: string; text: string }> = [];
collectStrings(SCENARIO, "scenario", ALL_STRINGS);

const FORBIDDEN_NOTIFICATION_WORDS = /\b(scam|scams|scammer|fake|fakes)\b/i;

describe("Chapter 1 data lint", () => {
  it("collects a meaningful number of text fields", () => {
    expect(ALL_STRINGS.length).toBeGreaterThan(200);
  });

  it('has no "safe" or "an toàn" wording, no unreserved domain and no number outside +000', () => {
    const failures = ALL_STRINGS.flatMap(({ path, text }) =>
      lintText(text).map((problem) => `${path}: ${problem}: ${text.slice(0, 80)}`),
    );
    expect(failures).toEqual([]);
  });

  it("has no unreserved domain or number in the Vietnamese narrative overlay source", () => {
    const base = resolve(import.meta.dirname, "../../../i18n/narrative");
    const files: string[] = [];
    if (existsSync(join(base, "chapter1.vi.ts"))) files.push(join(base, "chapter1.vi.ts"));
    const dir = join(base, "chapter1.vi");
    if (existsSync(dir)) {
      for (const name of readdirSync(dir)) if (name.endsWith(".ts") && !/\.test\.tsx?$/.test(name)) files.push(join(dir, name));
    }
    expect(files.length).toBeGreaterThan(0);
    const failures: string[] = [];
    for (const file of files) {
      const text = readFileSync(file, "utf8")
        .split("\n")
        .filter((line) => !/^\s*(import|export)\b.*from\s/.test(line) && !/^\s*\/\//.test(line))
        .join("\n");
      // Content IDs (line.*, ev.*, ...) look like domains; they are keys, not text.
      const withoutIds = text.replace(/\b(?:ev|dev|src|ded|obj|call|dlg|msg|claim|ws|spk|act|off|alex|rec|after|intro|note|beat|opt|line)\.[a-z0-9.-]+/g, "");
      for (const problem of lintText(withoutIds)) failures.push(`${file}: ${problem}`);
    }
    expect(failures).toEqual([]);
  });

  it('never uses the word "scam" or "fake" in the notification text the player sees before the debrief', () => {
    const notificationTexts: Array<{ where: string; text: string }> = [];
    const evidence = SCENARIO.evidence["ev.notification-metadata"];
    notificationTexts.push(
      { where: "ev.notification-metadata.title", text: evidence.title },
      { where: "ev.notification-metadata.description", text: evidence.description },
    );
    const source = SCENARIO.sources["src.notification"];
    notificationTexts.push(
      { where: "src.notification.label", text: source.label },
      { where: "src.notification.claimedOrigin", text: source.claimedOrigin },
    );
    for (const id of [
      "dev.open-notification",
      "dev.dismiss-notification",
      "dev.inspect-notification-origin",
      "dev.review-security",
      "dev.compare-case-ref",
      "dev.compare-contacts",
    ] as const) {
      notificationTexts.push({ where: `${id}.label`, text: SCENARIO.deviceActions[id].label });
    }
    // The alert shown on the laptop lives in the English UI dictionary.
    const laptop = readFileSync(resolve(import.meta.dirname, "../../../i18n/locales/en/chapter1/laptop.ts"), "utf8");
    const block = laptop.slice(laptop.indexOf("notification: {"), laptop.indexOf("bank: {"));
    expect(block).toContain("alertText");
    for (const match of block.matchAll(/(\w+):\s*"([^"]*)"/g)) {
      notificationTexts.push({ where: `laptop.notification.${match[1]}`, text: match[2] });
    }
    const failures = notificationTexts
      .filter(({ text }) => FORBIDDEN_NOTIFICATION_WORDS.test(text))
      .map(({ where, text }) => `${where}: ${text}`);
    expect(failures).toEqual([]);
  });

  it("detects bad text (self-check of the linter)", () => {
    expect(lintText("This number is safe.")).not.toEqual([]);
    expect(lintText("Visit bank.com now")).not.toEqual([]);
    expect(lintText("Call +44 20 7946 0000")).not.toEqual([]);
    expect(lintText("Visit northgate-bank.example or call +000 0100 0800")).toEqual([]);
    expect(lintText("Visit example.com")).toEqual([]);
  });
});

describe("Chapter 1 first call content", () => {
  it("lets the player hang up at every spoken node of the first call", () => {
    const missing: string[] = [];
    for (const node of Object.values(ALEX_DIALOGUE.nodes)) {
      if (node.end !== undefined || node.options.length === 0) continue;
      const exits = node.options.some(
        (option) => typeof option.next !== "string" || option.id.endsWith("hang-up") || option.next.startsWith("alex.end."),
      );
      if (!exits) missing.push(node.id);
    }
    expect(missing).toEqual([]);
  });

  it("ends the call through END_CALL at every point (hang up is always a core action)", () => {
    let state = createInitialState();
    state = chapterReducer(state, { type: "START_CHAPTER" }, SCENARIO).state;
    state = chapterReducer(state, { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" }, SCENARIO).state;
    state = chapterReducer(state, { type: "ANSWER_CALL" }, SCENARIO).state;
    const result = chapterReducer(state, { type: "END_CALL" }, SCENARIO);
    expect(result.accepted).toBe(true);
    expect(result.state.call.current).toBeNull();
  });

  it("gives the case ID in the voicemail and in the call summary", () => {
    expect(SCENARIO.phone.messages["msg.alex-voicemail"].body).toContain(CASE_REFERENCE);
    expect(SCENARIO.phone.messages["msg.alex-summary"].body).toContain(CASE_REFERENCE);
  });

  it("delivers the voicemail with the case ID after a declined first call", () => {
    let state = chapterReducer(createInitialState(), { type: "START_CHAPTER" }, SCENARIO).state;
    for (const action of DECLINE_ALEX) {
      const result = chapterReducer(state, action, SCENARIO);
      expect(result.accepted).toBe(true);
      state = result.state;
    }
    expect(state.phone.messages).toContain("msg.alex-voicemail");
    expect(SCENARIO.phone.messages[state.phone.messages[0]].body).toContain(CASE_REFERENCE);
  });

  it("foreshadows the laptop notification and the follow-up team in the first call", () => {
    const lines = Object.values(ALEX_DIALOGUE.lines).join("\n");
    expect(lines).toMatch(/notification/i);
    expect(lines).toMatch(/follow-up|incident team|team/i);
    expect(lines).toContain(CASE_REFERENCE);
  });

  it("keeps a written foreshadowing clue for the notification and the third call", () => {
    const statement = SCENARIO.evidence["ev.alex-statement"];
    expect(statement.description).toMatch(/notification/i);
    expect(statement.description).toMatch(/follow-up team/i);
    expect(SCENARIO.phone.messages["msg.alex-summary"].body).toMatch(/team would call you back/i);
    expect(SCENARIO.phone.messages["msg.alex-voicemail"].evidenceId).toBe("ev.alex-statement");
  });
});
