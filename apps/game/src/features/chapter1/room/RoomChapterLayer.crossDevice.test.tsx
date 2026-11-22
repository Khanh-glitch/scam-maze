// PHASE 7C/7D: the phone's own Mail, Browser, Banking and Files apps, and that the phone and the
// laptop show one game state. They share the laptop apps and the reducer, so a step taken on one
// device is seen at once on the other, money is taken once, and no event is duplicated.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { MISSION_01_CONFIG } from "../../../game/narrative/chapter1/mission01";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async (importOriginal) => importOriginal());
vi.mock("../../../i18n/narrative/lastSubmission.vi", async (importOriginal) => importOriginal());

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };
const FEE = MISSION_01_CONFIG.clearanceFeeVnd;

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
    <RoomChapterLayer session={SESSION} settings={DEFAULT_SETTINGS} bridge={bridge} saveSource={SAVE_SOURCE} ringSettleMs={0} clockPaused onStoreReady={(s) => (store = s)} />,
  );
  for (let i = 0; i < 12 && screen.queryByTestId("chapter-intro"); i += 1) fireEvent.click(screen.getByTestId("chapter-intro"));
  return { bridge, store: () => store as unknown as ChapterStore };
}
type Rig = ReturnType<typeof mountLayer>;

function openPhone(rig: Rig) {
  act(() => rig.bridge.onProp("phone", "inspect-ready"));
  fireEvent.click(screen.getByTestId("phone-unlock"));
  return screen.getByRole("dialog", { name: "Phone" });
}
function closePhone(rig: Rig) {
  act(() => rig.bridge.onProp("phone", "inspect-end"));
}
function openLaptop(rig: Rig, iconId: string) {
  act(() => rig.bridge.onProp("laptop", "inspect-ready"));
  const laptop = screen.getByRole("dialog", { name: "Laptop screen" });
  if (within(laptop).queryByTestId("desktop-window") !== null) fireEvent.click(within(laptop).getByTestId("desktop-back"));
  fireEvent.click(within(laptop).getByTestId(`desktop-icon-${iconId}`));
  return laptop;
}
function closeLaptop(rig: Rig) {
  act(() => rig.bridge.onProp("laptop", "inspect-end"));
}

beforeEach(() => act(() => applyLocale("en")));

describe("the phone's own apps show the same game state as the laptop", () => {
  it("reading an email on the phone leaves it read on the laptop", () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-mail"));
    fireEvent.click(within(phone).getByTestId("mail-row-mail.clearance"));
    expect(rig.store().getState().device.items["mail.clearance"].read).toBe(true);
    closePhone(rig);
    const laptop = openLaptop(rig, "device-mail");
    expect(within(laptop).getByTestId("mail-row-mail.clearance")).toBeTruthy();
    // The laptop mail row no longer marks it unread.
    expect(within(laptop).getByTestId("mail-unread-count").textContent).toContain("3");
  });

  it("the email link opens the phone browser, and the whole chain takes the fee exactly once", async () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    const phone = openPhone(rig);
    const startCash = rig.store().getState().resources.cash;
    fireEvent.click(within(phone).getByTestId("phone-app-mail"));
    fireEvent.click(within(phone).getByTestId("mail-row-mail.clearance"));
    fireEvent.click(within(phone).getByTestId("mail-link"));
    await within(phone).findByTestId("fake-step-notice");
    fireEvent.click(within(phone).getByTestId("clearance-continue"));
    fireEvent.focus(await within(phone).findByTestId("login-id"));
    fireEvent.click(within(phone).getByTestId("login-fill"));
    fireEvent.click(within(phone).getByTestId("login-submit"));
    fireEvent.focus(await within(phone).findByTestId("pay-number"));
    fireEvent.click(within(phone).getByTestId("pay-fill"));
    // The saved card leaves the security code to the player, as the browser does.
    for (const key of "123") fireEvent.keyDown(within(phone).getByTestId("pay-cvc"), { key });
    fireEvent.click(within(phone).getByTestId("pay-submit"));
    fireEvent.focus(await within(phone).findByTestId("verify-code"));
    fireEvent.click(within(phone).getByTestId("verify-fill"));
    fireEvent.click(within(phone).getByTestId("verify-submit"));
    await within(phone).findByTestId("fake-step-complete");
    const state = rig.store().getState();
    expect(state.resources.cash).toBe(startCash - FEE);
    expect(state.persistent.accountCompromised).toBe(true);
    // One ledger line for the fee, not two.
    const feeLines = state.device.ledger.filter((entry) => entry.itemId === "page.fee" && entry.actionId === "enter-code");
    expect(feeLines).toHaveLength(1);
    // The laptop bank shows that one payment.
    closePhone(rig);
    const laptop = openLaptop(rig, "device-bank");
    // Overview shows the balance the phone left; Transactions shows the single fee line.
    expect(within(laptop).getByTestId("bank-balance").textContent).toContain((startCash - FEE).toLocaleString("en-US"));
    fireEvent.click(within(laptop).getByTestId("bank-tab-transactions"));
    expect(within(laptop).getAllByTestId(/^bank-tx-tx-/)).toHaveLength(1);
  }, 20_000);

  it("the phone browser and the laptop browser do not share tabs, but share the game state behind a page", async () => {
    const rig = mountLayer();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 10 }));
    // Verify on the laptop portal by bookmark.
    const laptop = openLaptop(rig, "browser");
    fireEvent.click(within(laptop).getByTestId("browser-bookmarks"));
    fireEvent.click(within(laptop).getByTestId("menu-bookmark-https://student.ueh.edu.vn/"));
    await within(laptop).findByTestId("portal-site");
    closeLaptop(rig);
    // The phone browser starts on its own New Tab, not the laptop's portal tab.
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-browser"));
    expect((within(phone).getByTestId("browser-address") as HTMLInputElement).value).toBe("");
  });

  it("the phone banking app places the bank call through the phone's Contacts, not a second call path", () => {
    const rig = mountLayer();
    // Expose the account so the bank line can be called.
    act(() => {
      for (const action of [
        { type: "ADVANCE_TIME", minutes: 10 },
        { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" },
        { type: "USE_DEVICE_ITEM", itemId: "mail.clearance", actionId: "open-link" },
        { type: "USE_DEVICE_ITEM", itemId: "page.fee", actionId: "sign-in" },
      ] as const) {
        expect(rig.store().dispatch(action).accepted).toBe(true);
      }
    });
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-bank"));
    fireEvent.click(within(phone).getByTestId("bank-tab-support"));
    // On the phone the support page has no call button; it sends the player to Contacts.
    expect(within(phone).queryByTestId("device-action-contact.bank-call")).toBeNull();
    fireEvent.click(within(phone).getByTestId("bank-call-official"));
    // That lands in the Calls app on the bank contact.
    expect(within(phone).getByTestId("contact-call-contact.bank")).toBeTruthy();
  });

  it("the phone's Files folder shows the same saved evidence as the laptop", () => {
    const rig = mountLayer();
    act(() => {
      for (const action of [
        { type: "ADVANCE_TIME", minutes: 10 },
        { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" },
        { type: "USE_DEVICE_ITEM", itemId: "mail.clearance", actionId: "save-record" },
      ] as const) {
        expect(rig.store().dispatch(action).accepted).toBe(true);
      }
    });
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-files"));
    fireEvent.click(within(phone).getByTestId("files-folder-evidence"));
    expect(within(phone).getByTestId("device-row-file.email-record")).toBeTruthy();
    closePhone(rig);
    const laptop = openLaptop(rig, "device-files");
    fireEvent.click(within(laptop).getByTestId("files-folder-evidence"));
    expect(within(laptop).getByTestId("device-row-file.email-record")).toBeTruthy();
  });
});
