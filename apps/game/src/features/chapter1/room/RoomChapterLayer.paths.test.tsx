// RoomChapterLayer end-to-end paths, task 10.5. Requirements 22.1 to 22.3, 23.2 to 23.4.
// Three chapter paths driven through the layer's UI: bridge prop events (`inspect-ready`,
// `interact`), overlay buttons, call controls, reply buttons and the decision panel. The real
// scenario, a fake bridge and the fake audio port; no WebGL, no network, no real audio.
//
// Core actions are dispatched directly only where the room has no UI for them. Each such step is
// marked "NO UI:" below. Everything else is a click.
import { act, fireEvent, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import type { DecisionId, OutcomeId } from "../../../game/narrative/chapter1/ids";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { applyLocale } from "../../../i18n";
import enLaptop from "../../../i18n/locales/en/chapter1/laptop";
import enOutcome from "../../../i18n/locales/en/chapter1/outcome";
import enPhone from "../../../i18n/locales/en/chapter1/phone";
import enRoom from "../../../i18n/locales/en/chapter1/room";
import { finishIntro, setupLayer, type LayerRig } from "./testHarness";
import { useInstantCallText } from "../../../test/instantCallText";
useInstantCallText();

const LAPTOP = enLaptop.laptop;
const PHONE = enPhone.phone;
const DECISION = enOutcome.decision;
const DECISIONS = CHAPTER_1_SCENARIO.decisions;

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

const callStatus = (rig: LayerRig) => rig.store().getState().call.status;
const currentCall = (rig: LayerRig) => rig.store().getState().call.current;

/** The room engine reports a pose; the layer opens the matching overlay. */
const openProp = (rig: LayerRig, prop: "laptop" | "phone") => act(() => rig.bridge.onProp(prop, "inspect-ready"));

/** Escape closes the top overlay once; the engine then reports that the pose ended. */
function leaveProp(rig: LayerRig, prop: "laptop" | "phone") {
  fireEvent.keyDown(document, { key: "Escape" });
  act(() => rig.bridge.onProp(prop, "inspect-end"));
}

function openLaptopTab(name: string) {
  fireEvent.click(within(screen.getByRole("dialog", { name: LAPTOP.dialogLabel })).getByRole("tab", { name }));
}

/** While a call is on screen: the caller line is outside the phone and the choices are too. */
function expectCallLayout() {
  const host = screen.getByTestId("phone-screen-host");
  const subtitle = screen.getByTestId("call-subtitle-line");
  const line = subtitle.textContent ?? "";
  expect(line.length).toBeGreaterThan(10);
  expect(host.contains(subtitle)).toBe(false);
  expect(host.textContent ?? "").not.toContain(line);
  expect(screen.getByTestId("call-subtitle-overlay").closest('[data-testid="phone-screen-host"]')).toBeNull();
  const choices = screen.queryByTestId("player-choice-overlay");
  if (choices) {
    expect(host.contains(choices)).toBe(false);
    for (const option of within(choices).queryAllByRole("button")) expect(host.contains(option)).toBe(false);
  }
}

/** Answers the ringing call and clicks the given reply options, checking the layout at each step. */
function talk(optionIds: readonly string[]) {
  for (const id of optionIds) {
    expectCallLayout();
    fireEvent.click(screen.getByTestId(`dialogue-option-${id}`));
  }
}

function answerRingingCall(rig: LayerRig, callId: string) {
  expect(callStatus(rig)).toBe("ringing");
  expect(currentCall(rig)).toBe(callId);
  fireEvent.click(within(screen.getByTestId("phone-screen-host")).getByTestId("incoming-call-accept"));
  expect(callStatus(rig)).toBe("active");
}

/** Decision panel -> confirm -> ending transition -> Continue -> debrief with a timeline. */
function decideAndDebrief(rig: LayerRig, decisionId: DecisionId, outcome: OutcomeId) {
  const panel = screen.getByRole("dialog", { name: DECISION.heading });
  // The choices are in the decision panel, outside any phone screen.
  expect(screen.queryByTestId("phone-screen-host")).toBeNull();
  fireEvent.click(within(panel).getByRole("button", { name: DECISIONS[decisionId].label }));
  fireEvent.click(within(screen.getByRole("dialog", { name: DECISION.confirmHeading })).getByRole("button", { name: DECISION.confirm }));
  expect(rig.store().getState().outcome).toBe(outcome);

  const ending = screen.getByTestId("ending-transition");
  expect(ending.getAttribute("data-outcome")).toBe(outcome);
  expect(screen.queryByTestId("debrief-screen")).toBeNull();
  fireEvent.click(within(ending).getByRole("button", { name: enOutcome.ending.continue }));
  expect(rig.store().getState().status).toBe("finished");
  const debrief = screen.getByTestId("debrief-screen");
  expect(debrief.getAttribute("data-outcome")).toBe(outcome);
  const timeline = within(debrief).getByTestId("debrief-timeline");
  expect(within(timeline).getAllByRole("listitem").length).toBeGreaterThan(0);
}

/** New game: intro, then the first call rings. Declines Alex on the phone screen. */
function declineAlex(rig: LayerRig) {
  finishIntro();
  expect(rig.store().getState().status).toBe("playing");
  expect(callStatus(rig)).toBe("ringing");
  expect(currentCall(rig)).toBe("call.alex");
  const host = screen.getByTestId("phone-screen-host");
  expect(within(host).getByTestId("incoming-call-decline")).toBeTruthy();
  fireEvent.click(within(host).getByTestId("incoming-call-decline"));
  expect(callStatus(rig)).toBe("declined");
  expect(screen.queryByTestId("call-presentation")).toBeNull();
}

describe("path 1: signature path to false-victory", () => {
  it("declines Alex, follows the notification, trusts the third caller and follows recovery", () => {
    const rig = setupLayer();
    declineAlex(rig);

    // The laptop shows the notification. Open its details, then the Review Security tab.
    openProp(rig, "laptop");
    fireEvent.click(screen.getByRole("button", { name: LAPTOP.notification.details }));
    expect(rig.store().getState().flags.notification_opened).toBe(true);
    openLaptopTab(LAPTOP.apps.security);
    expect(rig.store().getState().events.some((e) => e.action.type === "DEVICE_ACTION" && e.action.deviceActionId === "dev.review-security")).toBe(true);

    // The third call is held while the laptop is open and rings once the room is free.
    expect(callStatus(rig)).not.toBe("ringing");
    leaveProp(rig, "laptop");
    answerRingingCall(rig, "call.recovery");

    talk([
      "rec.opt.start.followed.go-on",
      "rec.opt.cites-case.continue",
      "rec.opt.confirms-alex.what-needed",
      "rec.opt.procedure.continue",
      "rec.trust",
    ]);
    expect(callStatus(rig)).toBe("ended");
    expect(rig.store().getState().flags.second_caller_trusted).toBe(true);

    // Act V: the decision panel opens by itself.
    decideAndDebrief(rig, "follow-recovery", "false-victory");
  });
});

describe("path 2: verify independently to break-the-chain", () => {
  it("reads the statement, calls the saved contact and verifies", () => {
    const rig = setupLayer();
    declineAlex(rig);

    // The paper statement (E03) is read at the receipts prop. It is one counted item, so the
    // third call does not ring yet and the player can still call the saved contact first.
    act(() => rig.bridge.onProp("receipts", "interact"));
    expect(rig.store().getState().interacted).toContain("obj.receipts");
    expect(rig.store().getState().discovered).toContain("ev.official-contact-paper");
    expect(rig.store().getState().call.status).not.toBe("ringing");
    // The saved contact is called from the call history on the phone.
    openProp(rig, "phone");
  fireEvent.click(screen.getByTestId("phone-unlock"));
    const phone = screen.getByRole("dialog", { name: PHONE.overlay.name });
    fireEvent.click(within(phone).getByRole("button", { name: PHONE.home.calls }));
    fireEvent.click(within(phone).getByRole("button", { name: enRoom.room.records.callSaved.label }));
    expect(currentCall(rig)).toBe("call.official");
    expect(rig.store().getState().call.status).toBe("active");
    // The call is on top of the room; closing the records lets the player use the call controls.
    leaveProp(rig, "phone");

    talk(["off.opt.open.ask-case", "off.opt.ask.give-case"]);
    expect(rig.store().getState().conversation?.nodeId).toBe("off.confirm");
    expectCallLayout();
    fireEvent.click(screen.getByTestId("dialogue-option-off.opt.confirm.all-done"));
    // The call may end by itself at the end node; hang up if it is still on screen.
    if (rig.store().getState().call.status === "active") fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(rig.store().getState().flags.official_channel_verified).toBe(true);

    // The official call is over, so the third caller rings. Answer it and hang up.

    answerRingingCall(rig, "call.recovery");
    expectCallLayout();
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(rig.store().getState().call.current).toBeNull();

    decideAndDebrief(rig, "verify-independently", "break-the-chain");
  });
});

describe("path 3: refuse and stop to unfinished-case", () => {
  it("dismisses the notification, answers and hangs up the third call, then refuses", () => {
    const rig = setupLayer();
    declineAlex(rig);

    openProp(rig, "laptop");
    fireEvent.click(screen.getByRole("button", { name: LAPTOP.notification.dismiss }));
    expect(rig.store().getState().flags.notification_dismissed).toBe(true);
    leaveProp(rig, "laptop");

    answerRingingCall(rig, "call.recovery");
    expectCallLayout();
    fireEvent.click(screen.getByTestId("call-screen-hang-up"));
    expect(callStatus(rig)).toBe("ended");
    expect(screen.queryByTestId("call-presentation")).toBeNull();

    decideAndDebrief(rig, "refuse-and-stop", "unfinished-case");
  });
});
