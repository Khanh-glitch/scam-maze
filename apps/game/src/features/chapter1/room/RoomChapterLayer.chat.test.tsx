// PHASE 7B: the Messages app as real conversations (Linh about EASY MONEY, Hung about THE GOLDEN
// PLATFORM) and the Calls app as real phone calls (Training Office, bank, Financial Supervision
// Office), through the real phone UI with the real scenario. The core still owns every outcome: a
// reply or a turn of a call is a scenario action, and opening an app or a chat is not.
import { act, fireEvent, render, screen, waitFor, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { ACTIVE_SCENARIO } from "../../../game/narrative/activeScenario";
import { selectDeviceView } from "../../../game/narrative/device";
import type { CoreAction } from "../../../game/narrative/types";
import type { ChapterStore } from "../../../game/narrative/store";
import { encodeProgress, restoreProgress } from "../../../game/saves/chapterProgress";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { passedVoiceCues, reachedVoiceCues } from "../voice/mission01Voice";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer() {
  const bridge = new RoomStoryBridge();
  bridge.commands = {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
  let store: ChapterStore | null = null;
  render(
    <RoomChapterLayer
      session={SESSION}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={SAVE_SOURCE}
      ringSettleMs={0}
      clockPaused
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) fireEvent.click(screen.getByTestId("chapter-intro"));
  return { bridge, store: () => store as unknown as ChapterStore };
}

type Rig = ReturnType<typeof mountLayer>;

const phoneDialog = () => screen.getByRole("dialog", { name: "Phone" });
const lockedPhone = (rig: Rig) => {
  act(() => rig.bridge.onProp("phone", "inspect-ready"));
  return phoneDialog();
};
const openPhone = (rig: Rig) => {
  const phone = lockedPhone(rig);
  fireEvent.click(screen.getByTestId("phone-unlock"));
  return phone;
};
const advance = (rig: Rig, minutes: number) => act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes }));
const cues = (rig: Rig) => reachedVoiceCues(rig.store().getState(), ACTIVE_SCENARIO);
const TIMEOUT = { timeout: 6000 };
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
/** The player's earlier steps, taken through the core. */
function play(rig: Rig, actions: CoreAction[]) {
  for (const action of actions) {
    let accepted = false;
    act(() => {
      accepted = rig.store().dispatch(action).accepted;
    });
    expect(accepted, JSON.stringify(action)).toBe(true);
  }
}

describe("Messages: Linh and EASY MONEY as a conversation", () => {
  it("lists the chat, reads it only when it is opened, and starts Alex's voice only then", () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 150);
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    const row = within(phone).getByTestId("device-row-msg.easy-money");
    expect(row.textContent).toContain("Linh");
    expect(row.textContent).toContain("Unread");
    // Seeing the chat in the list is not reading it.
    expect(rig.store().getState().device.items["msg.easy-money"].read).toBe(false);
    expect(cues(rig)).not.toContain("easyMoney");
    fireEvent.click(row);
    expect(rig.store().getState().device.items["msg.easy-money"].read).toBe(true);
    expect(cues(rig)).toContain("easyMoney");
    expect(within(phone).getByTestId("chat-opening").textContent).toContain("easy money for a student");
  });

  it("offers the replies as buttons, sends one at a time, and shows the answer only after it is sent", async () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 150);
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    fireEvent.click(within(phone).getByTestId("device-row-msg.easy-money"));
    // No free text: the replies are the written options, and there is no text field.
    expect(phone.querySelectorAll("input, textarea")).toHaveLength(0);
    expect(within(phone).getByTestId("device-action-msg.easy-money-ask-linh").textContent).toContain("Ask Linh how she was paid");
    expect(within(phone).getByTestId("device-action-msg.easy-money-decline")).toBeTruthy();
    expect(within(phone).getByTestId("device-action-msg.easy-money-open-link").textContent).toContain("Open the job page");
    // The answer of a reply that was not sent is not on screen.
    expect(phone.textContent).not.toContain("deposit of 300,000");
    const before = rig.store().getState();
    const timeBefore = before.resources.timeMinutes;
    const evidenceBefore = before.resources.evidence;
    fireEvent.click(within(phone).getByTestId("device-action-msg.easy-money-ask-linh"));
    // Alex's line is shown at once, on his side; the answer follows after a typing moment.
    const mine = within(phone).getByTestId("conversation-line-msg.easy-money/ask-linh/0");
    expect(mine.getAttribute("data-speaker")).toBe("alex");
    expect(mine.textContent).toContain("How did you get paid?");
    expect(within(phone).getByTestId("chat-typing")).toBeTruthy();
    expect(within(phone).queryByTestId("conversation-line-msg.easy-money/ask-linh/1")).toBeNull();
    // The game state changed with the reply, not with opening the chat.
    const after = rig.store().getState();
    expect(after.resources.timeMinutes).toBeLessThan(timeBefore);
    expect(after.resources.evidence).toBe(evidenceBefore + 1);
    const answer = await within(phone).findByTestId("conversation-line-msg.easy-money/ask-linh/1", {}, TIMEOUT);
    expect(answer.getAttribute("data-speaker")).toBe("other");
    expect(answer.textContent).toContain("deposit of 300,000");
    expect(within(phone).queryByTestId("chat-typing")).toBeNull();
    // A reply that was sent is not offered again; the other one still is.
    expect(within(phone).queryByTestId("device-action-msg.easy-money-ask-linh")).toBeNull();
    fireEvent.click(await within(phone).findByTestId("device-action-msg.easy-money-decline", {}, TIMEOUT));
    await within(phone).findByTestId("conversation-line-msg.easy-money/decline/1", {}, TIMEOUT);
    // Both replies were sent; only the page action is left.
    expect(within(phone).queryByTestId("device-action-msg.easy-money-decline")).toBeNull();
    expect(within(phone).getByTestId("device-action-msg.easy-money-open-link")).toBeTruthy();
    // Every bubble has a time from the game clock.
    expect(within(phone).getAllByText(/^\d{2}:\d{2}$/).length).toBeGreaterThanOrEqual(5);
  }, 30_000);

  it("keeps the conversation when you leave the chat and come back", async () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 150);
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    fireEvent.click(within(phone).getByTestId("device-row-msg.easy-money"));
    fireEvent.click(within(phone).getByTestId("device-action-msg.easy-money-ask-linh"));
    await within(phone).findByTestId("conversation-line-msg.easy-money/ask-linh/1", {}, TIMEOUT);
    fireEvent.click(within(phone).getByTestId("phone-home-indicator"));
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    // Back in the same chat, every line at once and no typing again.
    expect(within(phone).getByTestId("conversation-line-msg.easy-money/ask-linh/1")).toBeTruthy();
    expect(within(phone).queryByTestId("chat-typing")).toBeNull();
    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    expect(within(phone).getByTestId("device-row-msg.easy-money").textContent).toContain("deposit of 300,000");
  }, 30_000);

  it("opens the chat from its notification on the lock screen", () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 150);
    lockedPhone(rig);
    fireEvent.click(screen.getByTestId("phone-notification-device:messages:msg.easy-money"));
    expect(screen.getByTestId("device-item-msg.easy-money")).toBeTruthy();
    expect(rig.store().getState().device.items["msg.easy-money"].read).toBe(true);
    expect(cues(rig)).toContain("easyMoney");
  });

  it("keeps the whole conversation in a save: continuing rebuilds every line", async () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 150);
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    fireEvent.click(within(phone).getByTestId("device-row-msg.easy-money"));
    fireEvent.click(within(phone).getByTestId("device-action-msg.easy-money-ask-linh"));
    await within(phone).findByTestId("conversation-line-msg.easy-money/ask-linh/1", {}, TIMEOUT);
    const live = rig.store().getState();
    const progress = encodeProgress(live, null, "checkpoint");
    expect(progress).not.toBeNull();
    const restored = restoreProgress(JSON.parse(JSON.stringify(progress)), ACTIVE_SCENARIO);
    expect(restored.ok).toBe(true);
    if (!restored.ok) return;
    const lines = (state: typeof live) =>
      selectDeviceView(state, ACTIVE_SCENARIO, "phone")
        .apps.messages.find((item) => item.id === "msg.easy-money")
        ?.conversation.map((line) => [line.key, line.speaker, line.text, line.atMinute]);
    expect(lines(restored.state)).toEqual(lines(live));
    expect(lines(live)).toHaveLength(2);
    // The chat stays read, so Alex's voice does not play its line again after Continue.
    expect(restored.state.device.items["msg.easy-money"].read).toBe(true);
    expect(passedVoiceCues(restored.state, ACTIVE_SCENARIO)).toContain("easyMoney");
  }, 30_000);
});

describe("Messages: Hung and THE GOLDEN PLATFORM as a conversation", () => {
  it("shows Hung's message, lets Alex ask or refuse, and reads the answer after the reply", async () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 400);
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    const row = within(phone).getByTestId("device-row-msg.golden-friend");
    expect(cues(rig)).not.toContain("investment");
    fireEvent.click(row);
    expect(cues(rig)).toContain("investment");
    expect(within(phone).getByTestId("chat-opening").textContent).toContain("Golden Platform");
    expect(phone.textContent).not.toContain("the manager is my relative");
    fireEvent.click(within(phone).getByTestId("device-action-msg.golden-friend-ask-hung"));
    const answer = await within(phone).findByTestId("conversation-line-msg.golden-friend/ask-hung/1", {}, TIMEOUT);
    expect(answer.textContent).toContain("the manager is my relative");
    fireEvent.click(await within(phone).findByTestId("device-action-msg.golden-friend-decline", {}, TIMEOUT));
    await within(phone).findByTestId("conversation-line-msg.golden-friend/decline/1", {}, TIMEOUT);
    expect(rig.store().getState().device.items["msg.golden-friend"].done).toEqual(["ask-hung", "decline"]);
  }, 30_000);
});

describe("Calls: contacts, keypad and real calls", () => {
  const openContacts = (phone: HTMLElement) => {
    fireEvent.click(within(phone).getByRole("button", { name: /Calls/ }));
    fireEvent.click(within(phone).getByTestId("calls-tab-contacts"));
  };

  it("lists the three official contacts and opening a card or the app changes nothing in the game", () => {
    applyLocale("en");
    const rig = mountLayer();
    const phone = openPhone(rig);
    const before = rig.store().getState();
    openContacts(phone);
    for (const id of ["contact.training-office", "contact.bank"]) expect(within(phone).getByTestId(`device-row-${id}`)).toBeTruthy();
    fireEvent.click(within(phone).getByTestId("device-row-contact.training-office"));
    expect(within(phone).getByText("+000 100 0200")).toBeTruthy();
    expect(within(phone).getByTestId("contact-call-contact.training-office")).toBeTruthy();
    expect(rig.store().getState().events.length).toBe(before.events.length);
    expect(rig.store().getState().resources.timeMinutes).toBe(before.resources.timeMinutes);
  });

  it("rings, connects, takes turns with the Training Office and ends; the cue 'verify' comes from the call", async () => {
    applyLocale("en");
    const rig = mountLayer();
    const phone = openPhone(rig);
    openContacts(phone);
    fireEvent.click(within(phone).getByTestId("device-row-contact.training-office"));
    fireEvent.click(within(phone).getByTestId("contact-call-contact.training-office"));
    const screenEl = within(phone).getByTestId("call-screen");
    expect(screenEl.getAttribute("data-phase")).toBe("ringing");
    expect(within(phone).getByTestId("call-status").textContent).toContain("Calling Training Office");
    expect(cues(rig)).not.toContain("verify");
    const confirm = await within(phone).findByTestId("device-action-contact.training-office-confirm-fee", {}, { timeout: 9000 });
    expect(screenEl.getAttribute("data-phase")).toBe("connected");
    expect(cues(rig)).toContain("verify");
    expect(within(phone).getByTestId("call-duration").textContent).toMatch(/^\d{2}:\d{2}$/);
    fireEvent.click(confirm);
    fireEvent.click(await within(phone).findByTestId("device-action-contact.training-office-ask-account", {}, { timeout: 9000 }));
    await waitFor(() => expect(within(phone).getAllByTestId(/^conversation-line-/)).toHaveLength(6), { timeout: 9000 });
    expect(rig.store().getState().persistent.schoolAccessVerified).toBe(true);
    // All the turns are done: nothing more to ask, and the call can end.
    expect(await within(phone).findByTestId("call-no-script", {}, TIMEOUT)).toBeTruthy();
    fireEvent.click(within(phone).getByTestId("call-end"));
    expect(screenEl.getAttribute("data-phase")).toBe("ended");
    expect(within(phone).getByTestId("call-ended-note").textContent).toContain("Training Office");
    // The call is in the call list, and the history stays on the contact.
    fireEvent.click(within(phone).getByTestId("call-leave"));
    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    fireEvent.click(within(phone).getByTestId("calls-tab-recents"));
    expect(within(phone).getByTestId("call-made-contact.training-office")).toBeTruthy();
  }, 40_000);

  it("a call that is ended while it rings changes nothing", () => {
    applyLocale("en");
    const rig = mountLayer();
    const phone = openPhone(rig);
    openContacts(phone);
    fireEvent.click(within(phone).getByTestId("device-row-contact.training-office"));
    const before = rig.store().getState().events.length;
    fireEvent.click(within(phone).getByTestId("contact-call-contact.training-office"));
    fireEvent.click(within(phone).getByTestId("call-end"));
    expect(within(phone).getByTestId("call-screen").getAttribute("data-phase")).toBe("ended");
    expect(rig.store().getState().events.length).toBe(before);
  });

  it("dials a saved number on the keypad, and says so when the number cannot be reached", async () => {
    applyLocale("en");
    const rig = mountLayer();
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Calls/ }));
    fireEvent.click(within(phone).getByTestId("calls-tab-keypad"));
    expect(within(phone).getByTestId("dial-call").hasAttribute("disabled")).toBe(true);
    for (const key of "9999") fireEvent.click(within(phone).getByTestId(`dial-key-${key}`));
    fireEvent.click(within(phone).getByTestId("dial-call"));
    expect(within(phone).getByTestId("dial-notice").textContent).toContain("cannot be reached");
    const events = rig.store().getState().events.length;
    for (let i = 0; i < 4; i += 1) fireEvent.click(within(phone).getByTestId("dial-backspace"));
    for (const key of "0001000200") fireEvent.click(within(phone).getByTestId(`dial-key-${key}`));
    expect(within(phone).getByTestId("dial-display").textContent).toBe("0001000200");
    fireEvent.click(within(phone).getByTestId("dial-call"));
    expect(within(phone).getByTestId("call-screen")).toBeTruthy();
    expect(within(phone).getByTestId("call-status").textContent).toContain("Training Office");
    expect(rig.store().getState().events.length).toBe(events);
  });

  it("calls the Financial Supervision Office after Hung's message and asks about the platform", async () => {
    applyLocale("en");
    const rig = mountLayer();
    advance(rig, 400);
    const phone = openPhone(rig);
    openContacts(phone);
    fireEvent.click(within(phone).getByTestId("device-row-contact.authority"));
    fireEvent.click(within(phone).getByTestId("contact-call-contact.authority"));
    const ask = await within(phone).findByTestId("device-action-contact.authority-ask-platform", {}, { timeout: 9000 });
    expect(phone.textContent).toContain("Financial Supervision Office, public information line");
    expect(phone.textContent).not.toContain("No firm with that name");
    const evidence = rig.store().getState().resources.evidence;
    fireEvent.click(ask);
    const answer = await within(phone).findByTestId("conversation-line-contact.authority/ask-platform/1", {}, TIMEOUT);
    expect(answer.textContent).toContain("No firm with that name is on our public list");
    expect(rig.store().getState().resources.evidence).toBe(evidence + 1);
    fireEvent.click(within(phone).getByTestId("call-end"));
  }, 40_000);

  it("calls the bank after the account was exposed, reports it, and the report is recorded", async () => {
    applyLocale("en");
    const rig = mountLayer();
    play(rig, [{ type: "ADVANCE_TIME", minutes: 10 }, open("mail.clearance"), use("mail.clearance", "open-link"), use("page.fee", "sign-in")]);
    const phone = openPhone(rig);
    openContacts(phone);
    fireEvent.click(within(phone).getByTestId("device-row-contact.bank"));
    fireEvent.click(within(phone).getByTestId("contact-call-contact.bank"));
    const report = await within(phone).findByTestId("device-action-contact.bank-report-fraud", {}, { timeout: 9000 });
    expect(phone.textContent).toContain("I will never ask for your password");
    expect(rig.store().getState().persistent.bankReported).toBeFalsy();
    fireEvent.click(report);
    await within(phone).findByTestId("conversation-line-contact.bank/report-fraud/1", {}, TIMEOUT);
    expect(rig.store().getState().persistent.bankReported).toBe(true);
    fireEvent.click(await within(phone).findByTestId("device-action-contact.bank-ask-next", {}, TIMEOUT));
    await within(phone).findByTestId("conversation-line-contact.bank/ask-next/1", {}, TIMEOUT);
    fireEvent.click(within(phone).getByTestId("call-end"));
    expect(phone.textContent).not.toMatch(/Northgate/i);
  }, 40_000);

  it("the bank line has nothing to say until there is something to report, and no Northgate text", () => {
    applyLocale("en");
    const rig = mountLayer();
    const phone = openPhone(rig);
    openContacts(phone);
    fireEvent.click(within(phone).getByTestId("device-row-contact.bank"));
    fireEvent.click(within(phone).getByTestId("contact-call-contact.bank"));
    expect(within(phone).getByTestId("call-screen")).toBeTruthy();
    expect(phone.textContent).not.toMatch(/Northgate/i);
  });
});
