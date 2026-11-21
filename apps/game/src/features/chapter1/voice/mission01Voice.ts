// Alex's spoken lines of Mission 01 (10 lines, an English and a Vietnamese clip each). Pure data and rules: no React, no audio API.
// Each line is a reaction to something the player sees or does, never to a timer. A message or a
// notification that merely arrives on its own does not make Alex speak:
//   intro             the new-game intro opens (never when a save is continued)
//   thesisStart       the player starts to write or edit the thesis for the first time (a task or a session)
//   emailReceived     the player sees the Graduation Clearance email in an inbox for the first time
//   emailSuspicious   the player opens that email (it comes first when the email is opened straight away)
//   verify            the player verifies on purpose: checks the saved portal or calls the Training Office
//   securityBreach    the player notices the first unauthorized transfer (a bank alert or the bank app).
//                     The transfer itself happens in the game as before and does not wait for the voice.
//   easyMoney         the player opens Linh's message about the online job
//   investment        the player opens Hung's message about the investment
//   exhausted         fatigue reached the exhausted level
//   overnight         the draft missed its internal deadline and Alex works through the night
// The cue is derived from the state (level based), so a restored game never replays a line: the
// player compares against the cues that already hold when the layer starts.
import type { GameLocale } from "@scammaze/shared-types";
import { MISSION01_VOICE_BASE } from "../../../config/assetPaths";
import { fatigueLevel } from "../../../game/narrative/fatigue";
import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";
import { CHAPTER_1_INITIAL_STATE } from "../../../game/narrative/resources";
import { gameplayConfig } from "../../../game/narrative/world";

export const MISSION01_VOICE_CUES = [
  "intro",
  "thesisStart",
  "emailReceived",
  "emailSuspicious",
  "verify",
  "securityBreach",
  "easyMoney",
  "investment",
  "exhausted",
  "overnight",
] as const;
export type Mission01VoiceCue = (typeof MISSION01_VOICE_CUES)[number];

/** Name of each cue's clips. The clip of a language is `<MISSION01_VOICE_BASE>/<locale>/<stem>_<locale>.mp3`. */
export const MISSION01_VOICE_STEMS: Record<Mission01VoiceCue, string> = {
  intro: "alex_intro",
  thesisStart: "alex_thesis_start",
  emailReceived: "alex_email_received",
  emailSuspicious: "alex_email_suspicious",
  verify: "alex_verify",
  securityBreach: "alex_security_breach",
  easyMoney: "alex_easy_money",
  investment: "alex_investment",
  exhausted: "alex_exhausted",
  overnight: "alex_overnight",
};

/** The clip of a cue in the language the player chose (English and Vietnamese clips exist). */
export function mission01VoiceUrl(cue: Mission01VoiceCue, locale: GameLocale): string {
  return `${MISSION01_VOICE_BASE}/${locale}/${MISSION01_VOICE_STEMS[cue]}_${locale}.mp3`;
}

/**
 * The recorded clip of one line of a chat or a phone call, when there is one:
 * `<MISSION01_VOICE_BASE>/<locale>/lines/<item>.<action>.<index>.mp3`. A line key is
 * `<item>/<action>/<index>`. When the clip is missing the line is shown as text and can be read
 * with the browser's computer voice.
 */
export function mission01LineVoiceUrl(lineKey: string, locale: GameLocale): string {
  return `${MISSION01_VOICE_BASE}/${locale}/lines/${lineKey.replaceAll("/", ".")}.mp3`;
}
const done = (state: ChapterState, itemId: string, actionId: string): boolean =>
  Object.hasOwn(state.device.items, itemId) && state.device.items[itemId].done.includes(actionId);
const opened = (state: ChapterState, itemId: string): boolean => Object.hasOwn(state.device.items, itemId) && state.device.items[itemId].read;

/**
 * What the player has seen on a screen in this run. Presentation state, not game state: the voice
 * layer sets it from the lists the device apps show.
 */
export interface VoiceSurfaces {
  /** An inbox that listed the Graduation Clearance email was on screen. */
  mailListed: boolean;
  /** The bank app was on screen after the first unauthorized transfer happened. */
  bankViewed: boolean;
}
export const NO_SURFACES: VoiceSurfaces = { mailListed: false, bankViewed: false };
const BANK_ALERTS = ["msg.bank-alert-1", "msg.bank-alert-2", "msg.bank-alert-3"] as const;

/**
 * The cues whose moment has been reached in this state and with these surfaces opened (all of
 * them, not only the new ones). The intro is not here: it belongs to the new-game intro screen. The
 * order is the order of the list.
 */
export function reachedVoiceCues(state: ChapterState, scenario: ScenarioDefinition, surfaces: VoiceSurfaces = NO_SURFACES): Mission01VoiceCue[] {
  const fatigue = gameplayConfig(scenario).fatigue;
  const startProgress = (scenario.initial ?? CHAPTER_1_INITIAL_STATE).resources.thesisProgress;
  const reached: Record<Exclude<Mission01VoiceCue, "intro">, boolean> = {
    thesisStart: state.world.thesisTasksDone.length > 0 || state.resources.thesisProgress > startProgress,
    emailReceived: surfaces.mailListed && Object.hasOwn(state.device.items, "mail.clearance"),
    emailSuspicious: opened(state, "mail.clearance"),
    verify: done(state, "portal.saved", "check-account") || done(state, "contact.training-office", "call"),
    securityBreach: Object.hasOwn(state.world.events, "m01.transfer-1") && (surfaces.bankViewed || BANK_ALERTS.some((id) => opened(state, id))),
    easyMoney: opened(state, "msg.easy-money") || done(state, "msg.easy-money", "open-link"),
    investment: opened(state, "msg.golden-friend") || done(state, "msg.golden-friend", "open-link"),
    exhausted: fatigue.enabled && fatigueLevel(state.resources.fatigue, fatigue) === "exhausted",
    overnight: state.persistent.overnightWork,
  };
  return MISSION01_VOICE_CUES.filter((cue): cue is Exclude<Mission01VoiceCue, "intro"> => cue !== "intro" && reached[cue]);
}

/**
 * The moments that are already behind the player in this state. A run that starts from a save marks
 * them as played so nothing is replayed: what the player did, and the email and the transfer once
 * they exist (the player may have seen them before the save).
 */
export function passedVoiceCues(state: ChapterState, scenario: ScenarioDefinition): Mission01VoiceCue[] {
  return reachedVoiceCues(state, scenario, { mailListed: true, bankViewed: true });
}
