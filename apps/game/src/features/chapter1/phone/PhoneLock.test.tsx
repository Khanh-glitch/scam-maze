// The phone's lock screen, notifications, home screen and navigation. The overlay is driven with
// hand-built views and spies, so the tests can state exactly which game callbacks fire.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { describe, expect, it, vi, type Mock } from "vitest";
import type { DeviceActionId } from "../../../game/narrative/chapter1/ids";
import { DEVICE_APP_IDS, type DeviceItemView, type DeviceView } from "../../../game/narrative/device";
import type { DeviceAppId } from "../../../game/narrative/types";
import type { DeviceActionView, PhoneMessageView, PhoneRecordsView } from "../../../game/narrative/selectors";
import { buildNotifications } from "./phoneNotifications";
import { PhoneOverlay, type PhoneOverlayProps } from "./PhoneOverlay";

const dialog = () => screen.getByRole("dialog", { name: "Phone" });

function item(id: string, app: DeviceAppId, title: string, over: Partial<DeviceItemView> = {}): DeviceItemView {
  return {
    id,
    app,
    title,
    from: "Registry Office",
    detail: null,
    body: `Body of ${title}`,
    folder: null,
    arrivedAtMinute: 10,
    read: false,
    tracksUnread: app === "mail" || app === "messages" || app === "housing" || app === "jobs",
    startsAtMinute: null,
    endsAtMinute: null,
    amount: null,
    actions: [],
    conversation: [],
    figures: null,
    ...over,
  };
}

function deviceView(items: DeviceItemView[]): DeviceView {
  const apps = {} as Record<DeviceAppId, DeviceItemView[]>;
  const unread = {} as Record<DeviceAppId, number>;
  for (const app of DEVICE_APP_IDS) {
    apps[app] = items.filter((entry) => entry.app === app);
    unread[app] = apps[app].filter((entry) => entry.tracksUnread && !entry.read).length;
  }
  return {
    apps,
    unread,
    available: DEVICE_APP_IDS.filter((app) => apps[app].length > 0),
    bank: {
      balance: 1000,
      ledger: [],
      digitalSecurity: 3,
      finance: { cash: 1000, spendable: 1000, debt: 0, lockedFunds: 0, financialLoss: 0, displayedProfit: 0 },
    },
    calendar: { minutesLeft: 600, thesisProgress: 10, submission: "not-submitted", now: 0 },
    map: { location: null },
    files: { backupSecured: false, evidenceCount: 0, evidenceTitles: [] },
  } as unknown as DeviceView;
}

function actionView(id: DeviceActionId, done: boolean): DeviceActionView {
  return { id, label: id, once: true, done, available: !done };
}

const VOICEMAIL: PhoneMessageView = {
  id: "msg.alex-voicemail",
  from: "Voicemail from an unknown caller",
  body: "Voicemail text",
  unread: true,
  evidenceId: "ev.alex-statement",
  evidenceRecorded: false,
};

const CHAT: PhoneMessageView = {
  id: "msg.alex-summary",
  from: "Friend Minh",
  body: "Are you coming tonight?",
  unread: true,
  evidenceId: "ev.alex-statement",
  evidenceRecorded: false,
};

function records(over: Partial<PhoneRecordsView> = {}): PhoneRecordsView {
  return { calls: [], voicemail: null, summaries: [], savedContact: null, deviceActions: [], ...over };
}

interface Spies {
  onOpenItem: Mock<(itemId: string) => void>;
  onUseItem: Mock<(itemId: string, actionId: string) => void>;
  onInspectEvidence: Mock<PhoneOverlayProps["onInspectEvidence"]>;
  onDeviceAction: Mock<PhoneOverlayProps["onDeviceAction"]>;
  onClose: Mock<() => void>;
  onView: Mock<NonNullable<NonNullable<PhoneOverlayProps["device"]>["onView"]>>;
}

function mount(items: DeviceItemView[], over: Partial<PhoneOverlayProps> = {}, recs: PhoneRecordsView = records()) {
  const spies: Spies = {
    onOpenItem: vi.fn<(itemId: string) => void>(),
    onUseItem: vi.fn<(itemId: string, actionId: string) => void>(),
    onInspectEvidence: vi.fn<PhoneOverlayProps["onInspectEvidence"]>(),
    onDeviceAction: vi.fn<PhoneOverlayProps["onDeviceAction"]>(),
    onClose: vi.fn<() => void>(),
    onView: vi.fn<NonNullable<NonNullable<PhoneOverlayProps["device"]>["onView"]>>(),
  };
  const view = deviceView(items);
  const ui = (
    <PhoneOverlay
      records={recs}
      messages={[]}
      onInspectEvidence={spies.onInspectEvidence}
      onDeviceAction={spies.onDeviceAction}
      onCallSavedContact={() => undefined}
      onClose={spies.onClose}
      device={{ view, onOpenItem: spies.onOpenItem, onUseItem: spies.onUseItem, onView: spies.onView }}
      {...over}
    />
  );
  return { spies, ...render(ui) };
}

const MAIL = () => item("mail.registry", "mail", "Registry notice");

describe("the phone lock screen", () => {
  it("opens locked, with the time, the day and the unread notifications, and no apps", () => {
    mount([MAIL(), item("job.1", "jobs", "Night shift offer")]);
    expect(dialog().getAttribute("data-phone-locked")).toBe("true");
    expect(screen.getByTestId("phone-lock-time").textContent).toMatch(/^\d{2}:\d{2}$/);
    expect(screen.getByTestId("phone-lock-day").textContent).toBeTruthy();
    expect(screen.getByTestId("phone-notification-device:mail:mail.registry").textContent).toContain("Registry notice");
    expect(screen.getByTestId("phone-notification-device:jobs:job.1").textContent).toContain("Night shift offer");
    expect(screen.queryByTestId("phone-app-mail")).toBeNull();
  });

  it("says so when there is nothing new, and counts the cards it does not show", () => {
    const { unmount } = mount([]);
    expect(screen.getByTestId("phone-lock-empty").textContent).toBe("No new notifications.");
    unmount();
    mount([1, 2, 3, 4, 5].map((n) => item(`mail.${n}`, "mail", `Notice ${n}`, { arrivedAtMinute: n })));
    expect(screen.getAllByTestId(/^phone-notification-/)).toHaveLength(3);
    expect(screen.getByTestId("phone-lock-more").textContent).toBe("+2 more");
  });

  it("unlocks with a click, with an upward swipe and with the Up arrow key", () => {
    for (const how of ["click", "swipe", "key"] as const) {
      const { unmount } = mount([MAIL()]);
      if (how === "click") fireEvent.click(screen.getByTestId("phone-unlock"));
      else if (how === "swipe") {
        const lock = screen.getByTestId("phone-lock");
        fireEvent.pointerDown(lock, { clientY: 300 });
        fireEvent.pointerMove(lock, { clientY: 280 });
        expect(dialog().getAttribute("data-phone-locked")).toBe("true");
        fireEvent.pointerMove(lock, { clientY: 240 });
      } else fireEvent.keyDown(screen.getByTestId("phone-lock"), { key: "ArrowUp" });
      expect(dialog().getAttribute("data-phone-locked"), how).toBe("false");
      expect(screen.getByTestId("phone-app-mail")).toBeTruthy();
      unmount();
    }
  });

  it("does not unlock on a downward drag or a plain press", () => {
    mount([MAIL()]);
    const lock = screen.getByTestId("phone-lock");
    fireEvent.pointerDown(lock, { clientY: 300 });
    fireEvent.pointerMove(lock, { clientY: 400 });
    fireEvent.pointerUp(lock);
    expect(dialog().getAttribute("data-phone-locked")).toBe("true");
  });

  it("starts unlocked when it is opened on a given app", () => {
    mount([MAIL()], { initialRoute: "device:mail" });
    expect(dialog().getAttribute("data-phone-locked")).toBe("false");
  });

  it("keeps Close available on the lock screen and calls onClose", () => {
    const { spies } = mount([MAIL()]);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Close phone" }));
    expect(spies.onClose).toHaveBeenCalledTimes(1);
  });
});

describe("notifications open the right content", () => {
  it("a mail notification opens that mail and reads it once", () => {
    const { spies } = mount([MAIL(), item("mail.other", "mail", "Other mail", { arrivedAtMinute: 5 })]);
    fireEvent.click(screen.getByTestId("phone-notification-device:mail:mail.registry"));
    expect(dialog().getAttribute("data-phone-locked")).toBe("false");
    expect(screen.getByTestId("device-item-mail.registry")).toBeTruthy();
    expect(screen.getByRole("heading", { name: "Registry notice" })).toBeTruthy();
    expect(spies.onOpenItem).toHaveBeenCalledTimes(1);
    expect(spies.onOpenItem).toHaveBeenCalledWith("mail.registry");
    expect(spies.onUseItem).not.toHaveBeenCalled();
    expect(spies.onDeviceAction).not.toHaveBeenCalled();
  });

  it("a voicemail notification opens Voicemail but does not open the record", () => {
    const { spies } = mount(
      [],
      {},
      records({ voicemail: VOICEMAIL, deviceActions: [actionView("dev.open-alex-record", false)] }),
    );
    fireEvent.click(screen.getByTestId("phone-notification-voicemail:msg.alex-voicemail"));
    expect(screen.getByTestId("phone-screen-voicemail")).toBeTruthy();
    expect(spies.onDeviceAction).not.toHaveBeenCalled();
    expect(screen.queryByText("Voicemail text")).toBeNull();
  });

  it("a message notification opens Messages on that message and records its evidence", () => {
    const spies = { inspect: vi.fn() };
    render(
      <PhoneOverlay
        records={records()}
        messages={[CHAT]}
        onInspectEvidence={spies.inspect}
        onDeviceAction={() => undefined}
        onCallSavedContact={() => undefined}
        onClose={() => undefined}
      />,
    );
    fireEvent.click(screen.getByTestId("phone-notification-message:msg.alex-summary"));
    expect(screen.getByTestId("phone-screen-messages")).toBeTruthy();
    expect(screen.getByText("Friend Minh", { selector: "h3" })).toBeTruthy();
    expect(spies.inspect).toHaveBeenCalledTimes(1);
    expect(spies.inspect).toHaveBeenCalledWith("ev.alex-statement");
  });

  it("a read item has no notification", () => {
    const list = buildNotifications({ records: records(), messages: [], device: deviceView([item("m", "mail", "Read", { read: true })]) });
    expect(list).toEqual([]);
  });

  it("sorts the newest first and ignores apps that do not track unread items", () => {
    const list = buildNotifications({
      records: records(),
      messages: [],
      device: deviceView([
        item("a", "mail", "Old", { arrivedAtMinute: 1 }),
        item("b", "mail", "New", { arrivedAtMinute: 9 }),
        item("c", "files", "A file", { arrivedAtMinute: 20 }),
      ]),
    });
    expect(list.map((n) => n.id)).toEqual(["device:mail:b", "device:mail:a"]);
  });
});

describe("home, apps and navigation", () => {
  it("shows a colored tile per app, a dock, and an unread badge", () => {
    mount([MAIL(), item("cal.1", "calendar", "Interview", { tracksUnread: false, read: true })]);
    fireEvent.click(screen.getByTestId("phone-unlock"));
    const dock = screen.getByTestId("phone-dock");
    expect(within(dock).getByTestId("phone-app-mail").textContent).toContain("1 unread");
    expect(within(dock).getByRole("button", { name: /Calls/ })).toBeTruthy();
    expect(within(screen.getByTestId("phone-grid")).getByTestId("phone-app-calendar")).toBeTruthy();
    const tiles = Array.from(dialog().querySelectorAll<HTMLElement>("[aria-hidden='true'][style*='linear-gradient']")).map((el) => el.style.background);
    expect(new Set(tiles).size).toBeGreaterThan(3);
  });

  it("opening apps, going Home and coming back dispatches no game action", () => {
    const { spies } = mount([MAIL(), item("cal.1", "calendar", "Interview", { tracksUnread: false, read: true })]);
    fireEvent.click(screen.getByTestId("phone-unlock"));
    for (const id of ["phone-app-calendar", "phone-app-bank", "phone-app-mail"]) {
      fireEvent.click(screen.getByTestId(id));
      fireEvent.click(screen.getByTestId("phone-home-indicator"));
    }
    fireEvent.click(within(dialog()).getByRole("button", { name: /Calls/ }));
    fireEvent.click(screen.getByTestId("phone-home-indicator"));
    expect(spies.onOpenItem).not.toHaveBeenCalled();
    expect(spies.onUseItem).not.toHaveBeenCalled();
    expect(spies.onDeviceAction).not.toHaveBeenCalled();
    expect(spies.onInspectEvidence).not.toHaveBeenCalled();
  });

  it("Back and Home both return: Back leaves the item, Home leaves the app", () => {
    mount([MAIL()]);
    fireEvent.click(screen.getByTestId("phone-unlock"));
    fireEvent.click(screen.getByTestId("phone-app-mail"));
    fireEvent.click(screen.getByTestId("device-row-mail.registry"));
    expect(screen.getByTestId("device-item-mail.registry")).toBeTruthy();
    fireEvent.click(within(dialog()).getByRole("button", { name: "Back" }));
    expect(screen.getByTestId("device-app-mail")).toBeTruthy();
    fireEvent.click(screen.getByTestId("phone-home-indicator"));
    expect(screen.getByTestId("phone-home")).toBeTruthy();
  });

  it("keeps the open item and the folder of an app when you leave it and come back", () => {
    const { spies } = mount([
      item("mail.a", "mail", "Alpha", { folder: "university" }),
      item("mail.b", "mail", "Beta", { folder: "recruitment" }),
    ]);
    fireEvent.click(screen.getByTestId("phone-unlock"));
    fireEvent.click(screen.getByTestId("phone-app-mail"));
    fireEvent.click(within(dialog()).getByRole("button", { name: "Recruitment" }));
    expect(screen.queryByTestId("device-row-mail.a")).toBeNull();
    fireEvent.click(screen.getByTestId("device-row-mail.b"));
    expect(spies.onOpenItem).toHaveBeenCalledTimes(1);
    fireEvent.click(screen.getByTestId("phone-home-indicator"));
    fireEvent.click(screen.getByTestId("phone-app-mail"));
    // Still on Beta, and opening the app again did not read it a second time.
    expect(screen.getByTestId("device-item-mail.b")).toBeTruthy();
    expect(spies.onOpenItem).toHaveBeenCalledTimes(1);
    fireEvent.click(within(dialog()).getByRole("button", { name: "Back" }));
    expect(within(dialog()).getByRole("button", { name: "Recruitment" }).getAttribute("aria-pressed")).toBe("true");
  });

  it("tells the story voice which list is on screen only while a list is on screen", () => {
    const { spies } = mount([MAIL()]);
    // The lock screen and the home screen show no list.
    expect(spies.onView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("phone-unlock"));
    expect(spies.onView).not.toHaveBeenCalled();
    fireEvent.click(screen.getByTestId("phone-app-mail"));
    expect(spies.onView).toHaveBeenLastCalledWith({ app: "mail", itemIds: ["mail.registry"] });
    fireEvent.click(screen.getByTestId("phone-home-indicator"));
    expect(spies.onView).toHaveBeenLastCalledWith(null);
  });

  it("opens a notification straight into the item without announcing the list", () => {
    const { spies } = mount([MAIL()]);
    fireEvent.click(screen.getByTestId("phone-notification-device:mail:mail.registry"));
    expect(spies.onView).not.toHaveBeenCalledWith(expect.objectContaining({ app: "mail" }));
  });

  it("has no anchors on the lock screen, the home screen or an app", () => {
    const { container } = mount([MAIL()]);
    expect(container.querySelectorAll("a")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("phone-unlock"));
    expect(container.querySelectorAll("a")).toHaveLength(0);
    fireEvent.click(screen.getByTestId("phone-app-mail"));
    expect(container.querySelectorAll("a")).toHaveLength(0);
  });

  it("keeps the Decide card on the home screen", () => {
    const onDecide = vi.fn();
    mount([], { onDecide });
    fireEvent.click(screen.getByTestId("phone-unlock"));
    act(() => {
      fireEvent.click(within(dialog()).getByRole("button", { name: "Decide" }));
    });
    expect(onDecide).toHaveBeenCalledTimes(1);
  });
});
