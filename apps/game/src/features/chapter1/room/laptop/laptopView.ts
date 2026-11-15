// View model for the laptop overlay (design.md, "Laptop overlay"). Pure: it reshapes the output of
// `selectLaptopView` so the components stay simple. No React, no i18n, no state writes.
import type { DeviceActionView, LaptopView, NotificationState } from "../../../../game/narrative/selectors";
import type { DeviceActionId } from "../../../../game/narrative/chapter1/ids";

/** Device actions the notification app can dispatch. */
export const NOTIFICATION_ACTIONS = {
  open: "dev.open-notification",
  inspect: "dev.inspect-notification-origin",
  dismiss: "dev.dismiss-notification",
} as const satisfies Record<string, DeviceActionId>;

/** Device actions of the saved bank app, the compare view and the Review Security page. */
export const BANK_ACTIONS = {
  openApp: "dev.open-bank-app",
  openActivity: "dev.open-account-activity",
  openContacts: "dev.open-saved-contacts",
} as const satisfies Record<string, DeviceActionId>;

export const COMPARE_ACTIONS = {
  caseRef: "dev.compare-case-ref",
  contacts: "dev.compare-contacts",
} as const satisfies Record<string, DeviceActionId>;

export const SECURITY_ACTION = "dev.review-security" as const satisfies DeviceActionId;

export type BankScreenId = "home" | "activity" | "contacts" | "messages";

export interface BankScreenView {
  id: string;
  title: string;
  /** Scenario text of the screen (plain text, never rendered as a link). */
  body: string;
}

export interface BankAppView {
  opened: boolean;
  screens: BankScreenView[];
  /** Action that opens the app, or `null` when not offered. */
  openAppAction: DeviceActionId | null;
  /** Action that records the activity screen was viewed, or `null` when not offered. */
  activityAction: DeviceActionId | null;
  contactsAction: DeviceActionId | null;
}

export function buildBankAppView(view: LaptopView): BankAppView {
  return {
    opened: view.bankApp.opened,
    screens: view.bankApp.screens.map((screen) => ({ ...screen })),
    openAppAction: availableAction(view.deviceActions, BANK_ACTIONS.openApp),
    activityAction: availableAction(view.deviceActions, BANK_ACTIONS.openActivity),
    contactsAction: availableAction(view.deviceActions, BANK_ACTIONS.openContacts),
  };
}

export interface CompareRowModel {
  key: string;
  notification: string | null;
  reference: string | null;
}

export interface CompareViewModel {
  rows: CompareRowModel[];
  caseAction: DeviceActionId | null;
  contactsAction: DeviceActionId | null;
  caseCompared: boolean;
  contactsCompared: boolean;
}

function isDone(actions: readonly DeviceActionView[], id: DeviceActionId): boolean {
  return actions.some((action) => action.id === id && action.done);
}

export function buildCompareViewModel(view: LaptopView): CompareViewModel {
  return {
    rows: view.compareRows.map((row) => ({ key: row.key, notification: row.notification, reference: row.reference })),
    caseAction: availableAction(view.deviceActions, COMPARE_ACTIONS.caseRef),
    contactsAction: availableAction(view.deviceActions, COMPARE_ACTIONS.contacts),
    caseCompared: isDone(view.deviceActions, COMPARE_ACTIONS.caseRef),
    contactsCompared: isDone(view.deviceActions, COMPARE_ACTIONS.contacts),
  };
}

export interface ReviewSecurityView {
  /** True when the notification was delivered, so the queued case exists. */
  available: boolean;
  /** Contact number from the notification, plain text. */
  contactNumber: string | null;
  openAction: DeviceActionId | null;
}

export function buildReviewSecurityView(view: LaptopView): ReviewSecurityView {
  return {
    available: view.notification.state !== "none",
    contactNumber: view.compareRows.find((row) => row.key === "contact")?.notification ?? null,
    openAction: availableAction(view.deviceActions, SECURITY_ACTION),
  };
}

export interface NotificationAppView {
  state: NotificationState;
  /** True when the notification is in the list (it stays after a dismiss). */
  listed: boolean;
  /** True when the details panel is shown. */
  detailsOpen: boolean;
  originInspected: boolean;
  /** Case reference on the notification, once it was opened. Plain text, never a link. */
  caseReference: string | null;
  /** Contact number on the notification, once it was opened. Plain text, never a link. */
  contactNumber: string | null;
  /** Each action is `null` when the core does not offer it now. */
  openAction: DeviceActionId | null;
  inspectAction: DeviceActionId | null;
  dismissAction: DeviceActionId | null;
}

function availableAction(actions: readonly DeviceActionView[], id: DeviceActionId): DeviceActionId | null {
  return actions.some((action) => action.id === id && action.available) ? id : null;
}

export function buildNotificationAppView(view: LaptopView): NotificationAppView {
  const { state, originInspected } = view.notification;
  const detailsOpen = state === "opened";
  const row = (key: string): string | null => view.compareRows.find((r) => r.key === key)?.notification ?? null;
  return {
    state,
    listed: state !== "none",
    detailsOpen,
    originInspected,
    caseReference: detailsOpen ? row("case") : null,
    contactNumber: detailsOpen ? row("contact") : null,
    openAction: state === "new" || state === "dismissed" ? availableAction(view.deviceActions, NOTIFICATION_ACTIONS.open) : null,
    inspectAction: detailsOpen && !originInspected ? availableAction(view.deviceActions, NOTIFICATION_ACTIONS.inspect) : null,
    dismissAction: state === "new" ? availableAction(view.deviceActions, NOTIFICATION_ACTIONS.dismiss) : null,
  };
}
