// RoomChapterLayer accessibility tests, task 10.5. Requirements 22.1 to 22.3, 23.2 to 23.4.
// Dialog names, focus trap and focus return, polite live-region announcements, reduced motion and
// the keyboard order of the call controls. jsdom does not move focus on Tab, so Tab is checked
// through the layer's trap (a keydown the trap answers) and through the DOM order of the
// tabbable elements. The real scenario, a fake bridge and the fake audio port.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import type { CoreAction } from "../../../game/narrative/types";
import { applyLocale } from "../../../i18n";
import enLaptop from "../../../i18n/locales/en/chapter1/laptop";
import enOutcome from "../../../i18n/locales/en/chapter1/outcome";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import enRoom from "../../../i18n/locales/en/chapter1/room";
import { DECLINE_ALEX, reachEndingA } from "../../../test/chapterRuns";
import { mockReducedMotion, restoreMatchMedia } from "../../../test/loadingRuns";
import { getTabbable } from "../focusTrap";
import { ALEX_OPEN_MANIFEST, dispatchCore, finishIntro, setupLayer, type LayerRig } from "./testHarness";
import { useInstantCallText } from "../../../test/instantCallText";
useInstantCallText();

const ROOM = enRoom.room;
const PHONE = enPhone.phone;
const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };
const ANSWER: CoreAction = { type: "ANSWER_CALL" };
const AFTER_DECLINE: CoreAction[] = [START, ...DECLINE_ALEX];
/** Alex and the third caller declined: Act V, decisions offered. */
const ACT_FIVE: CoreAction[] = [
  ...AFTER_DECLINE,
  { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" },
  { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" },
  { type: "END_CALL" },
];

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  restoreMatchMedia();
  document.body.innerHTML = "";
});

const openProp = (rig: LayerRig, prop: "laptop" | "phone") => act(() => rig.bridge.onProp(prop, "inspect-ready"));

/** The accessible name of a dialog that is named by its heading (`aria-labelledby`). */
function labelledName(dialog: HTMLElement): string {
  const id = dialog.getAttribute("aria-labelledby");
  expect(id).toBeTruthy();
  const heading = document.getElementById(id as string);
  expect(heading).not.toBeNull();
  return (heading?.textContent ?? "").trim();
}

describe("dialog accessible names", () => {
  it("names the laptop, the phone records and the journal", () => {
    const rig = setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();

    openProp(rig, "laptop");
    expect(screen.getByRole("dialog", { name: enLaptop.laptop.dialogLabel }).getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => rig.bridge.onProp("laptop", "inspect-end"));

    openProp(rig, "phone");
    expect(screen.getByRole("dialog", { name: PHONE.overlay.name }).getAttribute("aria-modal")).toBe("true");
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => rig.bridge.onProp("phone", "inspect-end"));

    fireEvent.click(screen.getByRole("button", { name: /^Journal/ }));
    const journal = screen.getByRole("dialog", { name: /journal/i });
    expect(journal.getAttribute("aria-modal")).toBe("true");
    expect(labelledName(journal)).not.toBe("");
  });

  it("names the decision panel and the debrief", () => {
    const rig = setupLayer({ restoreActions: ACT_FIVE });
    finishIntro();
    const decision = screen.getByRole("dialog", { name: enOutcome.decision.heading });
    expect(decision.getAttribute("aria-modal")).toBe("true");
    expect(rig.store().getState().outcome).toBeNull();
    document.body.innerHTML = "";

    setupLayer({ restoreActions: reachEndingA().actions });
    const debrief = screen.getByTestId("debrief-screen");
    expect(debrief.getAttribute("role")).toBe("dialog");
    expect(debrief.getAttribute("aria-modal")).toBe("true");
    const name = labelledName(debrief);
    expect(name).not.toBe("");
    expect(screen.getByRole("dialog", { name })).toBe(debrief);
  });

  it("names the call dialog", () => {
    setupLayer({ restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    expect(screen.getByRole("dialog", { name: PHONE.callPresentation.name })).toBe(screen.getByTestId("call-presentation"));
  });
});

describe("focus trap and focus return", () => {
  it("moves focus in, wraps Tab and Shift+Tab inside the journal and returns focus to the opener", () => {
    setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const opener = screen.getByRole("button", { name: /^Journal/ });
    opener.focus();
    fireEvent.click(opener);

    const dialog = screen.getByRole("dialog", { name: /journal/i });
    expect(dialog.contains(document.activeElement)).toBe(true);
    const items = getTabbable(dialog);
    expect(items.length).toBeGreaterThan(1);

    items[items.length - 1].focus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Tab" });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(document.activeElement as Element, { key: "Tab", shiftKey: true });
    expect(document.activeElement).toBe(items[items.length - 1]);

    // Focus that is outside the dialog is pulled back in.
    opener.focus();
    fireEvent.keyDown(opener, { key: "Tab" });
    expect(dialog.contains(document.activeElement)).toBe(true);

    fireEvent.keyDown(document, { key: "Escape" });
    expect(screen.queryByRole("dialog")).toBeNull();
    expect(document.activeElement).toBe(opener);
  });

  it("wraps Tab inside the laptop and returns focus to the element that was focused before", () => {
    const rig = setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    openProp(rig, "laptop");
    const dialog = screen.getByRole("dialog", { name: enLaptop.laptop.dialogLabel });
    expect(dialog.contains(document.activeElement)).toBe(true);
    const items = getTabbable(dialog);
    items[items.length - 1].focus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Tab" });
    expect(document.activeElement).toBe(items[0]);

    fireEvent.keyDown(document, { key: "Escape" });
    act(() => rig.bridge.onProp("laptop", "inspect-end"));
    expect(document.activeElement).toBe(opener);
  });

  it("keeps Tab inside the phone records and returns focus when they close", () => {
    const rig = setupLayer({ restoreActions: AFTER_DECLINE });
    finishIntro();
    const opener = document.createElement("button");
    document.body.append(opener);
    opener.focus();

    openProp(rig, "phone");
    const dialog = screen.getByRole("dialog", { name: PHONE.overlay.name });
    const items = getTabbable(dialog);
    items[items.length - 1].focus();
    fireEvent.keyDown(document.activeElement as Element, { key: "Tab" });
    expect(document.activeElement).toBe(items[0]);
    fireEvent.keyDown(document, { key: "Escape" });
    act(() => rig.bridge.onProp("phone", "inspect-end"));
    expect(document.activeElement).toBe(opener);
  });

  it("returns focus to the journal button after the journal closes from a call, and keeps the call", () => {
    const rig = setupLayer({ restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    const notes = screen.getByTestId("room-call-notes");
    notes.focus();
    fireEvent.click(notes);
    const journal = screen.getByRole("dialog", { name: /journal/i });
    expect(journal.contains(document.activeElement)).toBe(true);
    fireEvent.keyDown(document, { key: "Escape" });
    expect(rig.store().getState().call.status).toBe("active");
    expect(screen.getAllByRole("dialog")).toHaveLength(1);
    expect(screen.getByTestId("call-presentation").contains(document.activeElement)).toBe(true);
  });
});

describe("polite live region", () => {
  it("announces a new notification, new evidence and a recorded deduction", () => {
    const rig = setupLayer();
    finishIntro();
    const region = screen.getByTestId("room-live-region");
    expect(region.getAttribute("role")).toBe("status");
    expect(region.getAttribute("aria-live")).toBe("polite");
    expect(region.textContent).toBe("");

    // Decline the first call on the phone screen: the laptop alert arrives.
    fireEvent.click(screen.getByTestId("incoming-call-decline"));
    expect(region.textContent).toContain(ROOM.announce.notification);

    // The statement on the receipts prop is new evidence.
    act(() => rig.bridge.onProp("receipts", "interact"));
    const evidenceTitle = CHAPTER_1_SCENARIO.evidence["ev.official-contact-paper"].title;
    expect(region.textContent).toContain(`New evidence recorded: ${evidenceTitle}`);
    expect(region.textContent).not.toContain(ROOM.announce.notification);

    // NO UI: these device actions have no control in this test's flow (they are reachable in the
    // laptop and phone apps, covered by the path tests); the journal combine is dispatched directly.
    dispatchCore(
      rig,
      { type: "DEVICE_ACTION", deviceActionId: "dev.open-alex-record" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.open-notification" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.inspect-notification-origin" },
      { type: "DEVICE_ACTION", deviceActionId: "dev.compare-case-ref" },
    );
    dispatchCore(rig, {
      type: "COMBINE_EVIDENCE",
      evidenceIds: ["ev.alex-statement", "ev.notification-metadata", "ev.shared-case-id"],
    });
    expect(rig.store().getState().deductions).toContain("ded.same-source");
    const statement = CHAPTER_1_SCENARIO.deductions["ded.same-source"].statement;
    expect(region.textContent).toContain(`Deduction recorded: ${statement}`);
  });
});

describe("reduced motion", () => {
  const FADE = "scammaze-subtitle-in";
  const hasKeyframes = (name: string) => Array.from(document.querySelectorAll("style")).some((el) => (el.textContent ?? "").includes(name));

  it("removes the subtitle fade and the ringing wobble when the user prefers reduced motion", () => {
    mockReducedMotion(true);
    setupLayer({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    const icon = screen.getByTestId("incoming-call-icon");
    expect(icon.getAttribute("data-vibrating")).toBe("false");
    expect(icon.getAttribute("style")).toBeNull();
    expect(hasKeyframes("scammaze-call-screen-vibrate")).toBe(false);

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    const line = screen.getByTestId("call-subtitle-line");
    expect(line.parentElement?.getAttribute("style")).toBeNull();
    expect(hasKeyframes(FADE)).toBe(false);
  });

  it("keeps the fade and the wobble when motion is allowed", () => {
    mockReducedMotion(false);
    setupLayer({ restoreActions: [START, RING_ALEX] });
    finishIntro();
    const icon = screen.getByTestId("incoming-call-icon");
    expect(icon.getAttribute("data-vibrating")).toBe("true");
    expect(hasKeyframes("scammaze-call-screen-vibrate")).toBe(true);

    fireEvent.click(screen.getByTestId("incoming-call-accept"));
    expect(hasKeyframes(FADE)).toBe(true);
  });
});

describe("keyboard order of the call controls", () => {
  const testIdOf = (element: HTMLElement) => element.getAttribute("data-testid") ?? "";

  it("is Mute, Speaker, End call, then the reply options while Replay is off", () => {
    setupLayer({ restoreActions: [START, RING_ALEX, ANSWER] });
    finishIntro();
    const dialog = screen.getByTestId("call-presentation");
    const order = getTabbable(dialog).map(testIdOf);
    expect(order.slice(0, 3)).toEqual(["call-screen-mute", "call-screen-speaker", "call-screen-hang-up"]);
    expect(order.slice(3).length).toBeGreaterThan(0);
    expect(order.slice(3).every((id) => id.startsWith("dialogue-option-"))).toBe(true);
    expect(screen.getByTestId("call-screen-replay").hasAttribute("disabled")).toBe(true);
  });

  it("is Mute, Speaker, Replay, End call, then the options when Replay is enabled", async () => {
    const rig = setupLayer({ restoreActions: [START, RING_ALEX, ANSWER], manifest: ALEX_OPEN_MANIFEST });
    finishIntro();
    await rig.settle();
    const dialog = screen.getByTestId("call-presentation");
    expect(screen.getByTestId("call-screen-replay").hasAttribute("disabled")).toBe(false);
    const order = getTabbable(dialog).map(testIdOf);
    expect(order.slice(0, 4)).toEqual(["call-screen-mute", "call-screen-speaker", "call-screen-replay", "call-screen-hang-up"]);
    expect(order.slice(4).every((id) => id.startsWith("dialogue-option-"))).toBe(true);
    // The reply buttons are outside the phone screen host.
    const host = within(dialog).getByTestId("phone-screen-host");
    for (const id of order.slice(4)) expect(host.contains(screen.getByTestId(id))).toBe(false);
  });
});
