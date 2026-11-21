// Phone records overlay tests (spec chapter-01-double-deception, task 9.4; Requirements 5.5, 13.6).
//
// Device-action tests drive the overlay with hand-built selector views and a spy, because the
// fixture scenario defines no phone device actions. The saved-contact tests use a real chapter
// store, the fixture scenario and the real `selectPhoneRecords`.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import React, { useState, useSyncExternalStore } from "react";
import { describe, expect, it, vi } from "vitest";
import type { DeviceActionId } from "../../../game/narrative/chapter1/ids";
import { createInitialState } from "../../../game/narrative/reducer";
import {
  selectPhoneMessages,
  selectPhoneRecords,
  type CallLogEntryView,
  type DeviceActionView,
  type PhoneMessageView,
  type PhoneRecordsView,
} from "../../../game/narrative/selectors";
import { createChapterStore } from "../../../game/narrative/store";
import { FIXTURE_SCENARIO, withEvidence } from "../../../test/fixtureScenario";
import { PhoneOverlay } from "./PhoneOverlay";

const dialog = () => screen.getByRole("dialog", { name: "Phone" });

function callEntry(callId: "call.alex" | "call.recovery", name: string, number: string): CallLogEntryView {
  return {
    callId,
    direction: "incoming",
    displayName: name,
    number,
    status: "declined",
    ringCount: 1,
    evidenceId: null,
    evidenceRecorded: false,
    evidenceAvailable: false,
  };
}

const VOICEMAIL: PhoneMessageView = {
  id: "msg.alex-voicemail",
  from: "Unknown caller",
  body: "Case NG-4471-X is open. Call back on +000 0100 2200.",
  unread: true,
  evidenceId: "ev.alex-statement",
  evidenceRecorded: false,
};

function actionView(id: DeviceActionId, done: boolean): DeviceActionView {
  return { id, label: id, once: true, done, available: !done };
}

interface Setup {
  calls: CallLogEntryView[];
  actions: DeviceActionId[];
  voicemail?: PhoneMessageView | null;
}

/** Overlay with hand-built records. A dispatched action turns into a `done` view, like the core. */
const Harness: React.FC<{ setup: Setup; spy: (id: DeviceActionId) => void }> = ({ setup, spy }) => {
  const [done, setDone] = useState<DeviceActionId[]>([]);
  const records: PhoneRecordsView = {
    calls: setup.calls,
    voicemail: setup.voicemail ?? null,
    summaries: [],
    savedContact: null,
    deviceActions: setup.actions.map((id) => actionView(id, done.includes(id))),
  };
  return (
    <PhoneOverlay
      records={records}
      messages={setup.voicemail ? [setup.voicemail] : []}
      onInspectEvidence={() => undefined}
      onDeviceAction={(id) => {
        spy(id);
        setDone((previous) => (previous.includes(id) ? previous : [...previous, id]));
      }}
      onCallSavedContact={() => undefined}
      onClose={() => undefined}
      startLocked={false}
    />
  );
};

describe("PhoneOverlay call details and records", () => {
  it("dispatches the call details action once and shows the details", () => {
    const spy = vi.fn();
    const calls = [callEntry("call.alex", "Unknown caller", "+000 0100 2200")];
    render(<Harness setup={{ calls, actions: ["dev.open-call-details"] }} spy={spy} />);

    fireEvent.click(within(dialog()).getByRole("button", { name: /Calls/ }));
    expect(within(dialog()).getByText("+000 0100 2200")).toBeTruthy();
    expect(within(dialog()).queryByText("Call details")).toBeNull();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Open the call details" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("dev.open-call-details");
    expect(within(dialog()).getByRole("heading", { name: "Call details" })).toBeTruthy();
    expect(within(dialog()).queryByRole("button", { name: "Open the call details" })).toBeNull();
  });

  it("shows Alex's record only after it is opened, dispatching once", () => {
    const spy = vi.fn();
    render(<Harness setup={{ calls: [], actions: ["dev.open-alex-record"], voicemail: VOICEMAIL }} spy={spy} />);

    fireEvent.click(within(dialog()).getByRole("button", { name: "Voicemail" }));
    expect(within(dialog()).queryByText(/Case NG-4471-X is open/)).toBeNull();

    fireEvent.click(within(dialog()).getByRole("button", { name: "Open the record of the first call" }));
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("dev.open-alex-record");
    expect(within(dialog()).getByText(/Case NG-4471-X is open/)).toBeTruthy();
    expect(within(dialog()).queryByRole("button", { name: "Open the record of the first call" })).toBeNull();
  });

  it("offers the recovery call details only after that call rang", () => {
    const spy = vi.fn();
    const alex = callEntry("call.alex", "Unknown caller", "+000 0100 2200");
    const recovery = callEntry("call.recovery", "Follow-up team", "+000 0100 7771");

    // Before the recovery call rang: no log entry and no available action for it.
    const { unmount } = render(<Harness setup={{ calls: [alex], actions: ["dev.open-call-details"] }} spy={spy} />);
    fireEvent.click(within(dialog()).getByRole("button", { name: /Calls/ }));
    expect(within(dialog()).queryByText("Follow-up team")).toBeNull();
    expect(within(dialog()).getAllByRole("button", { name: "Open the call details" })).toHaveLength(1);
    unmount();

    render(
      <Harness
        setup={{ calls: [alex, recovery], actions: ["dev.open-call-details", "dev.open-recovery-details"] }}
        spy={spy}
      />,
    );
    fireEvent.click(within(dialog()).getByRole("button", { name: /Calls/ }));
    const buttons = within(dialog()).getAllByRole("button", { name: "Open the call details" });
    expect(buttons).toHaveLength(2);
    // Newest first: the recovery call is the first entry.
    fireEvent.click(buttons[0]);
    expect(spy).toHaveBeenCalledTimes(1);
    expect(spy).toHaveBeenCalledWith("dev.open-recovery-details");
  });

  it("renders no anchor elements in any app", () => {
    const calls = [callEntry("call.alex", "Unknown caller", "+000 0100 2200")];
    const { container } = render(
      <Harness
        setup={{ calls, actions: ["dev.open-call-details", "dev.open-alex-record"], voicemail: VOICEMAIL }}
        spy={() => undefined}
      />,
    );
    const noAnchors = () => expect(container.querySelectorAll("a")).toHaveLength(0);
    noAnchors();
    for (const app of [/Messages/, /Calls/, "Voicemail"]) {
      fireEvent.click(within(dialog()).getByRole("button", { name: app }));
      for (const button of within(dialog()).queryAllByRole("button")) {
        const label = button.getAttribute("aria-label");
        if (label === "Close phone" || label === "Go home" || /Back/.test(button.textContent ?? "")) continue;
        fireEvent.click(button);
      }
      noAnchors();
      fireEvent.click(within(dialog()).getByRole("button", { name: /Back/ }));
    }
    // The old street bank app is gone.
    expect(within(dialog()).queryByRole("button", { name: /Bank/ })).toBeNull();
  });

  it("supports keyboard operation: focus moves into the phone and every control is a native button", () => {
    const spy = vi.fn();
    const calls = [callEntry("call.alex", "Unknown caller", "+000 0100 2200")];
    render(<Harness setup={{ calls, actions: ["dev.open-call-details"] }} spy={spy} />);

    expect(document.activeElement).toBe(within(dialog()).getByRole("heading", { name: "Home", level: 2 }));
    for (const button of within(dialog()).getAllByRole("button")) {
      expect(button.tagName).toBe("BUTTON");
      expect(button.getAttribute("type")).toBe("button");
      expect(button.tabIndex).toBe(0);
    }

    const callsButton = within(dialog()).getByRole("button", { name: /Calls/ });
    callsButton.focus();
    fireEvent.click(callsButton); // the browser's activation of a focused button
    expect(document.activeElement).toBe(within(dialog()).getByRole("heading", { name: "Calls", level: 2 }));

    const open = within(dialog()).getByRole("button", { name: "Open the call details" });
    open.focus();
    expect(document.activeElement).toBe(open);
    fireEvent.click(open);
    expect(spy).toHaveBeenCalledTimes(1);
  });
});

describe("PhoneOverlay saved contact", () => {
  const S = FIXTURE_SCENARIO;

  /** Chapter store at the start, the first call declined, optionally holding saved-contact evidence. */
  function storeWith(evidence: Parameters<typeof withEvidence>[1]) {
    const store = createChapterStore(createInitialState(S), S);
    for (const action of [
      { type: "START_CHAPTER" },
      { type: "RING_CALL", callId: "call.alex", reason: "exploration-timer" },
      { type: "END_CALL" },
    ] as const) {
      expect(store.dispatch(action).accepted).toBe(true);
    }
    if (evidence.length === 0) return store;
    // Same state shape the reducer would produce after the evidence was discovered.
    const seeded = createChapterStore(withEvidence(store.getState(), evidence), S);
    return seeded;
  }

  const StoreHarness: React.FC<{ store: ReturnType<typeof createChapterStore> }> = ({ store }) => {
    const state = useSyncExternalStore(store.subscribe, store.getState);
    return (
      <PhoneOverlay
        records={selectPhoneRecords(state, S)}
        messages={selectPhoneMessages(state, S)}
        onInspectEvidence={() => undefined}
        onDeviceAction={(deviceActionId) => store.dispatch({ type: "DEVICE_ACTION", deviceActionId })}
        onCallSavedContact={(claimId) =>
          store.dispatch({ type: "VERIFY_CLAIM", claimId, method: "saved-official-contact" })
        }
        onClose={() => store.dispatch({ type: "CLOSE_PHONE" })}
        initialRoute="calls"
      />
    );
  };

  it("hides Call saved contact until an independent contact is found", () => {
    render(<StoreHarness store={storeWith([])} />);
    expect(within(dialog()).queryByRole("button", { name: "Call the saved contact" })).toBeNull();
    expect(within(dialog()).queryByText("+000 0100 0800")).toBeNull();
  });

  for (const evidenceId of ["ev.official-contact-paper", "ev.official-contact-app"] as const) {
    it(`shows Call saved contact once ${evidenceId} is found and dispatches VERIFY_CLAIM`, () => {
      const store = storeWith([evidenceId]);
      const { container } = render(<StoreHarness store={store} />);
      // The number is plain text.
      expect(within(dialog()).getByText("+000 0100 0800")).toBeTruthy();
      expect(container.querySelectorAll("a")).toHaveLength(0);

      act(() => {
        fireEvent.click(within(dialog()).getByRole("button", { name: "Call the saved contact" }));
      });
      const verify = store.getState().events.filter((entry) => entry.action.type === "VERIFY_CLAIM");
      expect(verify).toHaveLength(1);
      expect(verify[0].action).toEqual({
        type: "VERIFY_CLAIM",
        claimId: "claim.recovery-needed",
        method: "saved-official-contact",
      });
    });
  }
});
