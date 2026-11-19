// The phone and the laptop with the shared device content: apps, unread badges, actions that cost
// time and cash, the bank ledger, the calendar, files and notices for new mail. The items below
// are test content, not Mission 01.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ChapterStore } from "../../../game/narrative/store";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

vi.mock("../../../game/narrative/activeScenario", async () => {
  const { LAST_SUBMISSION_SCENARIO } = await import("../../../game/narrative/chapter1/lastSubmission");
  return {
    ACTIVE_SCENARIO: {
      ...LAST_SUBMISSION_SCENARIO,
      gameplay: { clockRuns: false },
      ledgerLabels: { "ledger.fee": "Clearance fee" },
      deviceItems: [
        {
          id: "mail.registry",
          app: "mail",
          folder: "university",
          title: "Clearance form",
          from: "Registry Office <office@registry.example>",
          body: "Please review your clearance form.",
          actions: [
            { id: "pay-fee", label: "Pay the fee", cashCost: 22000, ledgerLabel: "ledger.fee", counterparty: "Registry Office", once: true },
            { id: "reply", label: "Reply", timeCostMinutes: 10 },
          ],
        },
        { id: "mail.job", app: "mail", folder: "recruitment", title: "Project assistant role", from: "Talent Team <jobs@talent.example>", body: "A role." },
        { id: "msg.minh", app: "messages", title: "Minh", body: "Can you send me the notes?" },
        { id: "contact.office", app: "contacts", title: "Student support office", detail: "+000 555 0101", body: "International student support." },
        { id: "mail.late", app: "mail", folder: "other", title: "A late email", body: "Arrived later.", arrives: { atMinute: 30 } },
        { id: "house.room", app: "housing", title: "Room near campus", amount: 3000000, body: "A room.", actions: [{ id: "inquire", label: "Ask about it", timeCostMinutes: 15 }] },
        { id: "cal.interview", app: "calendar", title: "Interview", startsAtMinute: 900, endsAtMinute: 960, body: "At the shop." },
        {
          id: "file.thesis",
          app: "files",
          title: "thesis-final.docx",
          body: "The thesis file.",
          actions: [{ id: "backup", label: "Make a backup", timeCostMinutes: 30, effects: [{ kind: "setPersistent", flag: "backupSecured", value: true }] }],
        },
        { id: "place.campus", app: "map", title: "Campus", body: "The university.", actions: [{ id: "bus", label: "Take the bus", timeCostMinutes: 60, cashCost: 7000, moveTo: "place.campus" }] },
      ],
    },
  };
});

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const SAVE_SOURCE: SaveGameSource = { read: () => ({ status: "none" }), write: () => true, clear: () => true };

function mountLayer(): { store: () => ChapterStore; bridge: RoomStoryBridge } {
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
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  return {
    bridge,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

function finishIntro() {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

function openPhone(rig: ReturnType<typeof mountLayer>) {
  finishIntro();
  act(() => rig.bridge.onProp("phone", "inspect-ready"));
  return screen.getByRole("dialog", { name: "Phone" });
}

function openLaptop(rig: ReturnType<typeof mountLayer>) {
  finishIntro();
  act(() => rig.bridge.onProp("laptop", "inspect-ready"));
  return screen.getByRole("dialog");
}

describe("the phone with device content", () => {
  it("shows the device apps on the home screen with an unread badge", () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    for (const app of ["mail", "bank", "map", "calendar", "housing", "files"]) expect(within(phone).getByTestId(`phone-app-${app}`)).toBeTruthy();
    expect(within(phone).getByTestId("phone-app-mail").textContent).toContain("2 unread");
    // Jobs has no item, so it has no app. Messages and Contacts live in the original phone apps.
    expect(within(phone).queryByTestId("phone-app-jobs")).toBeNull();
    expect(within(phone).queryByTestId("phone-app-messages")).toBeNull();
  });

  it("opens an email: marks it read at no time cost, and pays a fee into the bank ledger", () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByTestId("phone-app-mail"));
    fireEvent.click(within(phone).getByTestId("device-row-mail.registry"));
    expect(rig.store().getState().device.items["mail.registry"].read).toBe(true);
    expect(rig.store().getState().resources.timeMinutes).toBe(72 * 60);
    const pay = within(phone).getByTestId("device-action-mail.registry-pay-fee");
    expect(pay.textContent).toBe("Pay the fee (22,000 VND)");
    expect(within(phone).getByTestId("device-action-mail.registry-reply").textContent).toBe("Reply (10 min)");
    fireEvent.click(pay);
    expect(rig.store().getState().resources.cash).toBe(2_478_000);
    // A once-only action cannot be used again, and the screen says why.
    expect((within(phone).getByTestId("device-action-mail.registry-pay-fee") as HTMLButtonElement).disabled).toBe(true);
    expect(within(phone).getByText("Already done")).toBeTruthy();

    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    fireEvent.click(within(phone).getByTestId("phone-app-bank"));
    expect(within(phone).getByTestId("bank-balance").textContent).toContain("2,478,000 VND");
    const entry = within(phone).getByTestId("ledger-entry");
    expect(entry.textContent).toContain("Clearance fee");
    expect(entry.textContent).toContain("-22,000 VND");
  });

  it("shows chats inside Messages, the map with the route cost, and the calendar with the deadline", () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    expect(within(phone).getByTestId("device-row-msg.minh")).toBeTruthy();
    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));

    fireEvent.click(within(phone).getByTestId("phone-app-map"));
    expect(within(phone).getByTestId("map-location").textContent).toContain("You have not gone anywhere yet.");
    fireEvent.click(within(phone).getByTestId("device-row-place.campus"));
    fireEvent.click(within(phone).getByTestId("device-action-place.campus-bus"));
    expect(rig.store().getState().device.location).toBe("place.campus");
    expect(rig.store().getState().resources.timeMinutes).toBe(72 * 60 - 60);
    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    expect(within(phone).getByTestId("map-location").textContent).toContain("You are at: Campus");
    fireEvent.click(within(phone).getByRole("button", { name: "Back" }));

    fireEvent.click(within(phone).getByTestId("phone-app-calendar"));
    expect(within(phone).getByTestId("calendar-header").textContent).toContain("Final deadline: Friday, 17:00");
    expect(within(phone).getByTestId("calendar-submission").textContent).toContain("Not submitted");
    expect(within(phone).getByTestId("device-row-cal.interview").textContent).toContain("Upcoming");
    expect(within(phone).getByTestId("device-row-cal.interview").textContent).toContain("Wednesday 08:00 to Wednesday 09:00");
  });

  it("shows new mail with a notice when it arrives, and the mail folders", () => {
    const rig = mountLayer();
    finishIntro();
    act(() => void rig.store().dispatch({ type: "ADVANCE_TIME", minutes: 30 }));
    expect(screen.getByTestId("event-arrival-notice").textContent).toContain("A late email");
    act(() => rig.bridge.onProp("phone", "inspect-ready"));
    const phone = screen.getByRole("dialog", { name: "Phone" });
    fireEvent.click(within(phone).getByTestId("phone-app-mail"));
    expect(within(phone).getByTestId("device-row-mail.late")).toBeTruthy();
    fireEvent.click(within(phone).getByRole("button", { name: "Recruitment" }));
    expect(within(phone).queryByTestId("device-row-mail.late")).toBeNull();
    expect(within(phone).getByTestId("device-row-mail.job")).toBeTruthy();
  });

  it("lists the contacts inside the Calls app next to the call history", () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Calls/ }));
    expect(within(phone).getByText("Contacts")).toBeTruthy();
    fireEvent.click(within(phone).getByTestId("device-row-contact.office"));
    expect(within(phone).getByText("+000 555 0101")).toBeTruthy();
  });

  it("has no Northgate bank content and no voicemail app, and the home screen has no duplicate empty states", () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    expect(within(phone).queryByRole("button", { name: /Voicemail/ })).toBeNull();
    for (const name of [/Messages/, /Calls/]) {
      fireEvent.click(within(phone).getByRole("button", { name }));
      expect(phone.textContent).not.toMatch(/Northgate/i);
      fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    }
    for (const app of ["mail", "bank", "map", "calendar", "housing", "files"]) {
      fireEvent.click(within(phone).getByTestId(`phone-app-${app}`));
      expect(phone.textContent).not.toMatch(/Northgate/i);
      fireEvent.click(within(phone).getByRole("button", { name: "Back" }));
    }
  });

  it("shows no Messages duplicate empty text when there are no chats", () => {
    const rig = mountLayer();
    const phone = openPhone(rig);
    fireEvent.click(within(phone).getByRole("button", { name: /Messages/ }));
    expect(within(phone).getAllByText(/No messages|Nothing here yet/)).toHaveLength(1);
  });

  it("labels the apps in Vietnamese", () => {
    applyLocale("vi");
    const rig = mountLayer();
    finishIntro();
    act(() => rig.bridge.onProp("phone", "inspect-ready"));
    const phone = screen.getByRole("dialog");
    expect(within(phone).getByTestId("phone-app-mail").textContent).toContain("Thư");
    expect(within(phone).getByTestId("phone-app-bank").textContent).toContain("Ngân hàng");
  });
});

describe("the laptop with device content", () => {
  it("shows the same device apps as tabs and no tab of the parked story", () => {
    const rig = mountLayer();
    const laptop = openLaptop(rig);
    const tabs = within(laptop).getAllByRole("tab").map((tab) => tab.textContent);
    expect(tabs).toEqual(["Mail", "Bank", "Calendar", "Housing", "Files", "Thesis"]);
    expect(within(laptop).queryByText("Northgate Mobile")).toBeNull();
    expect(within(laptop).queryByText("Notifications")).toBeNull();
    expect(laptop.textContent).not.toMatch(/Northgate/i);
    expect(within(laptop).getByText("17:00")).toBeTruthy();
  });

  it("shares state with the phone: a backup made on the laptop shows in Files and in the core state", () => {
    const rig = mountLayer();
    const laptop = openLaptop(rig);
    fireEvent.click(within(laptop).getByRole("tab", { name: "Files" }));
    expect(within(laptop).getByTestId("files-backup").textContent).toContain("No backup");
    fireEvent.click(within(laptop).getByTestId("device-row-file.thesis"));
    fireEvent.click(within(laptop).getByTestId("device-action-file.thesis-backup"));
    expect(rig.store().getState().persistent.backupSecured).toBe(true);
    fireEvent.click(within(laptop).getByRole("button", { name: "Back" }));
    expect(within(laptop).getByTestId("files-backup").textContent).toContain("A backup of the thesis data is available.");
  });

  it("shows the housing listing price and costs time to ask about it", () => {
    const rig = mountLayer();
    const laptop = openLaptop(rig);
    fireEvent.click(within(laptop).getByRole("tab", { name: "Housing" }));
    expect(within(laptop).getByTestId("device-row-house.room").textContent).toContain("3,000,000 VND");
    fireEvent.click(within(laptop).getByTestId("device-row-house.room"));
    fireEvent.click(within(laptop).getByTestId("device-action-house.room-inquire"));
    expect(rig.store().getState().resources.timeMinutes).toBe(72 * 60 - 15);
  });
});