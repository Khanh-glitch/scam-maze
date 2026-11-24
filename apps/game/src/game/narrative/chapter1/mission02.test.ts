// Mission 02, Slice A: the parcel thread of Wednesday morning, played through the real reducer.
//
// The suite is written against `LAST_SUBMISSION_SCENARIO` (not a fixture), so it also guards the
// wiring in `lastSubmission.ts` and the six persistent flags this mission adds. Every other mission
// suite treats Mission 02's content as invisible; this one is where it is visible.
import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO as S } from "./lastSubmission";
import { MISSION_02_CONFIG } from "./mission02";
import { selectDeviceView, validateDeviceContent } from "../device";
import { chapterReducer, createInitialState } from "../reducer";
import { minutesFromStart } from "../resources";
import type { ChapterState, CoreAction } from "../types";
import { validateScenario } from "../validateScenario";
import { selectPendingEvents, validateWorldContent } from "../world";

const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });

function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  let state = from;
  for (const action of actions) {
    const result = chapterReducer(state, action, S);
    expect(result.accepted, `${action.type} ${JSON.stringify(action)}: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

/** The morning of Wednesday: no message yet. */
const MONDAY_EVENING = run([START]);
/** The message has arrived. */
const MESSAGE = run([START, advance(MISSION_02_CONFIG.opensAtMinute)]);
/** The chapter is running and the message has arrived. */
const PAST_ARRIVAL = run([START, advance(MISSION_02_CONFIG.opensAtMinute)]);
/** The page is open. */
const PAGE = run([open("msg.parcel-fee"), use("msg.parcel-fee", "open-link")], PAST_ARRIVAL);

const item = (state: ChapterState, id: string) =>
  selectDeviceView(state, S, "phone").apps.messages.find((entry) => entry.id === id);

describe("the scenario stays consistent with Mission 02 in it", () => {
  it("validates world, device and scenario data", () => {
    expect(validateWorldContent(S)).toEqual([]);
    expect(validateDeviceContent(S)).toEqual([]);
    expect(validateScenario(S).filter((message) => !/needs at least one/.test(message))).toEqual([]);
  });

  it("keeps the desk sheet of the mission and no evidence of the parked story", () => {
    expect(Object.keys(S.interactables)).toEqual(["obj.note"]);
    expect(S.interactables["obj.note"].inspectionText).toContain("TH24 4471 0925");
    expect(S.evidence).toEqual({});
  });
});

describe("the paper on the desk", () => {
  it("can be read at any time, in the chapter's own currency: nothing", () => {
    const before = selectDeviceView(PAST_ARRIVAL, S, "phone").calendar.now;
    const readSlip = run([{ type: "INTERACT_OBJECT", objectId: "obj.note" }], PAST_ARRIVAL);
    expect(readSlip.interacted).toContain("obj.note");
    expect(selectDeviceView(readSlip, S, "phone").calendar.now).toBe(before);
    // The slip teaches; it does not decide anything, so it reveals no evidence item.
    expect(readSlip.discovered).toEqual([]);
  });
});

describe("the message", () => {
  it("arrives at Wednesday 08:00 and not a minute before", () => {
    expect(minutesFromStart(3, 8, 0)).toBe(MISSION_02_CONFIG.opensAtMinute);
    expect(Object.hasOwn(MONDAY_EVENING.device.items, "msg.parcel-fee")).toBe(false);
    const message = item(MESSAGE, "msg.parcel-fee");
    expect(message?.title).toBe("Tốc Hành 24");
    expect(message?.body).toContain("22,000 VND");
    expect(message?.arrivedAtMinute).toBe(MISSION_02_CONFIG.opensAtMinute);
  });

  it("is a message: the sender number is fictional and the page has no link to follow", () => {
    const message = item(MESSAGE, "msg.parcel-fee");
    expect(message?.detail).toBe("+000 90 4471 2210");
    // The page is a device item, not a URL: the player opens an action, nothing is fetched.
    const page = selectDeviceView(PAGE, S, "phone").apps.mail.find((entry) => entry.id === "page.parcel");
    expect(page?.detail).toBe("tochhanh24.example");
  });

  it("can be left alone, at no cost", () => {
    const left = run([open("msg.parcel-fee"), use("msg.parcel-fee", "ignore")], PAST_ARRIVAL);
    expect(left.persistent.parcelFeePaid).toBe(false);
    expect(left.resources.cash).toBe(2_500_000);
  });
});

describe("the page", () => {
  it("asks for the details before it asks for the money, and the details are what cost", () => {
    const page = selectDeviceView(PAGE, S, "phone").apps.mail.find((entry) => entry.id === "page.parcel")!;
    // The fee button does not exist yet: the page asks for the details first.
    expect(page.actions.map((action) => action.id)).toContain("enter-details");
    expect(page.actions.map((action) => action.id)).not.toContain("pay-fee");
    const typed = run([open("page.parcel"), use("page.parcel", "enter-details")], PAGE);
    const after = selectDeviceView(typed, S, "phone").apps.mail.find((entry) => entry.id === "page.parcel")!;
    expect(after.actions.find((action) => action.id === "pay-fee")?.available).toBe(true);
    expect(typed.persistent.parcelCredentialsExposed).toBe(true);
    expect(typed.resources.digitalSecurity).toBe(100 + MISSION_02_CONFIG.security.enterDetails);
  });

  it("takes the fee only after the details, and writes one ledger line", () => {
    const typed = run([open("page.parcel"), use("page.parcel", "enter-details")], PAGE);
    expect(typed.persistent.parcelFeePaid).toBe(false);
    const paid = run([use("page.parcel", "pay-fee")], typed);
    expect(paid.persistent.parcelFeePaid).toBe(true);
    expect(paid.resources.cash).toBe(2_500_000 - MISSION_02_CONFIG.redeliveryFeeVnd);
    expect(paid.device.ledger).toHaveLength(1);
    expect(paid.device.ledger[0].label).toBe("ledger.parcel-fee");
    const view = selectDeviceView(paid, S, "phone");
    expect(view.bank.ledger[0].label).toBe("Parcel redelivery fee");
  });

  it("never tells the player what the page is", () => {
    const texts = S.deviceItems!
      .filter((entry) => entry.id === "page.parcel" || entry.id === "msg.parcel-fee")
      .map((entry) => `${entry.body} ${entry.actions?.map((action) => action.label).join(" ") ?? ""}`)
      .join(" ");
    expect(texts).not.toMatch(/\bsafe\b|unsafe|scam|phish|fake|suspicious|warning/i);
    expect(texts).not.toMatch(/an toàn|cảnh báo|đáng ngờ/i);
  });
});

describe("the app that could have answered the message", () => {
  it("finds the parcel at the counter with the code on the slip, and says there is no fee", () => {
    const state = run([open("app.courier"), use("app.courier", "lookup-with-slip")], PAST_ARRIVAL);
    expect(state.persistent.parcelAtCounter).toBe(true);
    expect(state.resources.evidence).toBe(1);
    const conversation = selectDeviceView(state, S, "phone").apps.files.find((entry) => entry.id === "app.courier")!.conversation;
    expect(conversation.map((line) => line.text).join(" ")).toContain("No redelivery fee is recorded");
  });

  it("still agrees when the player searches by phone number, and says who pays the fee", () => {
    const state = run([open("app.courier"), use("app.courier", "lookup-by-phone")], PAST_ARRIVAL);
    expect(state.persistent.parcelAtCounter).toBe(true);
    const conversation = selectDeviceView(state, S, "phone").apps.files.find((entry) => entry.id === "app.courier")!.conversation;
    expect(conversation.map((line) => line.text).join(" ")).toContain("The sender pays the fee, not the receiver");
  });

  it("charges the two routes different amounts of the one thing the chapter has: minutes", () => {
    const before = selectDeviceView(PAST_ARRIVAL, S, "phone").calendar.now;
    const withSlip = run([open("app.courier"), use("app.courier", "lookup-with-slip")], PAST_ARRIVAL);
    const byPhone = run([open("app.courier"), use("app.courier", "lookup-by-phone")], PAST_ARRIVAL);
    const spent = (state: ChapterState) => selectDeviceView(state, S, "phone").calendar.now - before;
    expect(spent(withSlip)).toBe(MISSION_02_CONFIG.minutes.lookupWithSlip);
    expect(spent(byPhone)).toBe(MISSION_02_CONFIG.minutes.lookupByPhone);
    expect(spent(byPhone)).toBeGreaterThan(spent(withSlip));
    // Both routes reach the same fact; neither is rewarded or punished for it.
    expect(withSlip.resources.cash).toBe(byPhone.resources.cash);
  });
});

describe("the counter closing", () => {
  it("is a record, not a failure: it arrives at 13:30 and cannot be argued with", () => {
    const late = run([START, advance(minutesFromStart(3, 13, 30))]);
    const closing = selectPendingEvents(late, S).find((event) => event.id === "m02.counter-closes");
    // autoResolve: it never waits for an answer, so it is resolved the moment it is due.
    expect(closing).toBeUndefined();
    expect(late.world.events["m02.counter-closes"]?.status).toBe("resolved");
    expect(late.status).toBe("playing");
  });

  it("does not fire when the parcel was already found", () => {
    const found = run([
      START,
      advance(MISSION_02_CONFIG.opensAtMinute),
      open("app.courier"),
      use("app.courier", "lookup-with-slip"),
      advance(minutesFromStart(3, 13, 30) - MISSION_02_CONFIG.opensAtMinute - MISSION_02_CONFIG.minutes.lookupWithSlip),
    ]);
    expect(found.world.events["m02.counter-closes"]).toBeUndefined();
  });
});
