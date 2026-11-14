// BankApp, CompareView and ReviewSecurityPage tests (task 9.3). Requirements 6.3, 6.6, 6.7, 19.3, 19.4.
// Hand-built views only.
import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { LaptopView } from "../../../../game/narrative/selectors";
import type { CoreAction } from "../../../../game/narrative/types";
import { applyLocale } from "../../../../i18n";
import en from "../../../../i18n/locales/en/chapter1/laptop";
import { BankApp } from "./BankApp";
import { CompareView } from "./CompareView";
import { ReviewSecurityPage } from "./ReviewSecurityPage";
import {
  buildBankAppView,
  buildCompareViewModel,
  buildReviewSecurityView,
} from "./laptopView";

const T = en.laptop;

function action(id: string, available = true, done = false) {
  return { id, label: id, once: true, done, available } as unknown as LaptopView["deviceActions"][number];
}

function makeView(over: Partial<LaptopView> = {}): LaptopView {
  return {
    notification: { state: "opened", originInspected: false, handled: true },
    bankApp: {
      opened: true,
      title: "Northgate Mobile",
      screens: [
        { id: "home", title: "Home", body: "No open case." },
        { id: "activity", title: "Activity", body: "Activity text." },
        { id: "contacts", title: "Contacts", body: "Customer line 555-0100." },
        { id: "messages", title: "Messages", body: "No security messages." },
      ],
    },
    compareRows: [
      { key: "case", notification: "CASE-0000", reference: null },
      { key: "contact", notification: "555-0199", reference: "555-0100" },
    ],
    deviceActions: [],
    ...over,
  };
}

const lastIds = (dispatch: ReturnType<typeof vi.fn>) =>
  dispatch.mock.calls.map((call) => (call[0] as { deviceActionId: string }).deviceActionId);

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});
afterEach(() => {
  vi.restoreAllMocks();
});

describe("BankApp", () => {
  it("opens the app once on first display", () => {
    const dispatch = vi.fn<(a: CoreAction) => void>();
    const view = makeView({
      bankApp: { opened: false, title: "", screens: [] },
      deviceActions: [action("dev.open-bank-app")],
    });
    const { rerender } = render(<BankApp view={buildBankAppView(view)} dispatch={dispatch} />);
    rerender(<BankApp view={buildBankAppView(view)} dispatch={dispatch} />);
    expect(lastIds(dispatch)).toEqual(["dev.open-bank-app"]);
  });

  it("dispatches the activity and contacts actions once when those screens open", () => {
    const dispatch = vi.fn<(a: CoreAction) => void>();
    const view = makeView({
      deviceActions: [action("dev.open-account-activity"), action("dev.open-saved-contacts")],
    });
    render(<BankApp view={buildBankAppView(view)} dispatch={dispatch} />);
    expect(dispatch).not.toHaveBeenCalled();
    fireEvent.click(screen.getByRole("button", { name: T.bank.tabs.activity }));
    expect(screen.getByText("Activity text.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.bank.tabs.contacts }));
    expect(screen.getByText("Customer line 555-0100.")).toBeTruthy();
    fireEvent.click(screen.getByRole("button", { name: T.bank.tabs.activity }));
    fireEvent.click(screen.getByRole("button", { name: T.bank.tabs.contacts }));
    expect(lastIds(dispatch)).toEqual(["dev.open-account-activity", "dev.open-saved-contacts"]);
    expect(dispatch).toHaveBeenCalledWith({ type: "DEVICE_ACTION", deviceActionId: "dev.open-saved-contacts" });
  });

  it("dispatches nothing for screens whose action is already done", () => {
    const dispatch = vi.fn<(a: CoreAction) => void>();
    const view = makeView({ deviceActions: [action("dev.open-account-activity", false, true)] });
    render(<BankApp view={buildBankAppView(view)} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: T.bank.tabs.activity }));
    expect(dispatch).not.toHaveBeenCalled();
  });
});

describe("CompareView", () => {
  it("shows both sides and no verdict before the player acts", () => {
    const view = makeView({ deviceActions: [action("dev.compare-case-ref"), action("dev.compare-contacts")] });
    const { container } = render(<CompareView view={buildCompareViewModel(view)} dispatch={vi.fn()} />);
    expect(screen.getByText(T.compare.notificationColumn)).toBeTruthy();
    expect(screen.getByText(T.compare.savedColumn)).toBeTruthy();
    expect(screen.getByText("555-0199")).toBeTruthy();
    expect(screen.getByText("555-0100")).toBeTruthy();
    expect(screen.getByText("CASE-0000")).toBeTruthy();
    expect(screen.getByText(T.compare.notFound)).toBeTruthy();
    for (const text of [T.compare.matches, T.compare.differs, T.compare.caseResult, T.compare.contactResult]) {
      expect(screen.queryByText(text)).toBeNull();
    }
    expect(container.querySelectorAll("a, input, form, [href]").length).toBe(0);
  });

  it("dispatches the compare actions and shows results only after they are done", () => {
    const dispatch = vi.fn<(a: CoreAction) => void>();
    const view = makeView({ deviceActions: [action("dev.compare-case-ref"), action("dev.compare-contacts")] });
    render(<CompareView view={buildCompareViewModel(view)} dispatch={dispatch} />);
    fireEvent.click(screen.getByRole("button", { name: T.compare.compareCase }));
    fireEvent.click(screen.getByRole("button", { name: T.compare.compareContacts }));
    expect(lastIds(dispatch)).toEqual(["dev.compare-case-ref", "dev.compare-contacts"]);

    const done = makeView({
      deviceActions: [action("dev.compare-case-ref", false, true), action("dev.compare-contacts", false, true)],
    });
    render(<CompareView view={buildCompareViewModel(done)} dispatch={dispatch} />);
    expect(screen.getByText(T.compare.caseResult)).toBeTruthy();
    expect(screen.getByText(T.compare.contactResult)).toBeTruthy();
  });

  it("hides compare buttons that the core does not offer and explains an empty view", () => {
    render(<CompareView view={buildCompareViewModel(makeView({ compareRows: [] }))} dispatch={vi.fn()} />);
    expect(screen.getByText(T.compare.noRecords)).toBeTruthy();
    expect(screen.queryByRole("button")).toBeNull();
  });
});

describe("ReviewSecurityPage", () => {
  it("has no inputs, anchors, forms or buttons, and never calls fetch", () => {
    const fetchSpy = vi.fn();
    vi.stubGlobal("fetch", fetchSpy);
    try {
      const { container } = render(
        <ReviewSecurityPage
          view={buildReviewSecurityView(makeView({ deviceActions: [action("dev.review-security")] }))}
          dispatch={vi.fn()}
        />,
      );
      expect(screen.getByText(T.security.step3)).toBeTruthy();
      expect(container.querySelectorAll("a, input, textarea, select, form, button, [href]").length).toBe(0);
      expect(container.innerHTML).not.toMatch(/href=|tel:/);
      expect(fetchSpy).not.toHaveBeenCalled();
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it("dispatches dev.review-security once when opened", () => {
    const dispatch = vi.fn<(a: CoreAction) => void>();
    const view = buildReviewSecurityView(makeView({ deviceActions: [action("dev.review-security")] }));
    const { rerender } = render(<ReviewSecurityPage view={view} dispatch={dispatch} />);
    rerender(<ReviewSecurityPage view={view} dispatch={dispatch} />);
    expect(dispatch).toHaveBeenCalledTimes(1);
    expect(dispatch).toHaveBeenCalledWith({ type: "DEVICE_ACTION", deviceActionId: "dev.review-security" });
  });

  it("shows the queued case with the number as plain text", () => {
    render(<ReviewSecurityPage view={buildReviewSecurityView(makeView())} dispatch={vi.fn()} />);
    expect(screen.getByText("Your case is queued. A specialist will call from 555-0199.")).toBeTruthy();
  });
});
