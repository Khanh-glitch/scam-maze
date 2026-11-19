// Phone and laptop content for "LAST SUBMISSION: 72 GIỜ CUỐI": email, chats, contacts and calls,
// bank, map, calendar, housing, jobs and files. Pure TypeScript: no React, Three.js, R3F, Drei,
// Rapier, Zustand or Dexie imports.
//
// Every app is a view over `ScenarioDefinition.deviceItems` plus the shared state in
// `ChapterState.device`. Opening an item and using an action are core actions (`OPEN_DEVICE_ITEM`,
// `USE_DEVICE_ITEM`), so they cost simulated time and cash, can change persistent state, can
// advance events and missions, and replay from a save. The views carry facts and costs only: they
// never label an item or an action as safe, unsafe, good or bad.
import { evaluateConditions } from "./conditions";
import { simulatedClock, CHAPTER_DURATION_MINUTES } from "./resources";
import type {
  ChapterState,
  DeviceAppId,
  DeviceItemActionDef,
  DeviceItemDef,
  DeviceItemState,
  DeviceKind,
  LedgerEntry,
  ScenarioDefinition,
  SubmissionStatus,
} from "./types";
import { elapsedMinutes } from "./world";

export const DEVICE_APP_IDS: readonly DeviceAppId[] = ["mail", "messages", "contacts", "bank", "map", "calendar", "housing", "jobs", "files"];

/** Where each app lives by default. An item can override it with `devices`. */
export const DEFAULT_APP_DEVICES: Record<DeviceAppId, readonly DeviceKind[]> = {
  mail: ["phone", "laptop"],
  messages: ["phone"],
  contacts: ["phone"],
  bank: ["phone", "laptop"],
  map: ["phone"],
  calendar: ["phone", "laptop"],
  housing: ["phone", "laptop"],
  jobs: ["phone", "laptop"],
  files: ["phone", "laptop"],
};

export function itemDevices(item: DeviceItemDef): readonly DeviceKind[] {
  return item.devices ?? DEFAULT_APP_DEVICES[item.app];
}

export function deviceItemDef(scenario: ScenarioDefinition, itemId: string): DeviceItemDef | undefined {
  return scenario.deviceItems?.find((item) => item.id === itemId);
}

export function itemActionDef(item: DeviceItemDef, actionId: string): DeviceItemActionDef | undefined {
  return item.actions?.find((action) => action.id === actionId);
}

/** Item states for every item that is there from the start. */
export function createInitialDeviceItems(scenario: ScenarioDefinition): Record<string, DeviceItemState> {
  const items: Record<string, DeviceItemState> = {};
  for (const item of scenario.deviceItems ?? []) {
    const arrivesLater = item.arrives !== undefined;
    if (!arrivesLater) items[item.id] = { arrivedAtMinute: 0, read: false, readAtMinute: null, done: [] };
  }
  return items;
}

/** The simulated clock at `minutes` since the chapter started. */
export function clockAtMinute(minutes: number): { isoWeekday: number; hour: number; minute: number } {
  const clock = simulatedClock(CHAPTER_DURATION_MINUTES - Math.max(0, minutes));
  return { isoWeekday: clock.isoWeekday, hour: clock.hour, minute: clock.minute };
}

// ---------------------------------------------------------------------------
// Views
// ---------------------------------------------------------------------------

export type ActionBlock = "done" | "locked" | "cash" | "time" | "call";

export interface DeviceActionView {
  id: string;
  label: string;
  timeCostMinutes: number;
  cashCost: number;
  available: boolean;
  /** Why it cannot be used now. Null when it can. */
  blocked: ActionBlock | null;
  /** True when the action places a call. */
  placesCall: boolean;
}

export interface DeviceItemView {
  id: string;
  app: DeviceAppId;
  title: string;
  from: string | null;
  detail: string | null;
  body: string;
  folder: string | null;
  arrivedAtMinute: number;
  read: boolean;
  startsAtMinute: number | null;
  endsAtMinute: number | null;
  amount: number | null;
  actions: DeviceActionView[];
}

export interface LedgerEntryView {
  seq: number;
  atMinute: number;
  label: string;
  amount: number;
  counterparty: string | null;
}

export interface DeviceView {
  /** Items that arrived and show on this device, by app. */
  apps: Record<DeviceAppId, DeviceItemView[]>;
  /** Unread items by app. */
  unread: Record<DeviceAppId, number>;
  /** Apps that have at least one item on this device. */
  available: DeviceAppId[];
  bank: { balance: number; ledger: LedgerEntryView[]; digitalSecurity: number };
  calendar: { minutesLeft: number; thesisProgress: number; submission: SubmissionStatus; now: number };
  map: { location: string | null };
  files: { backupSecured: boolean; evidenceCount: number; evidenceTitles: string[] };
}

function emptyRecord<T>(make: () => T): Record<DeviceAppId, T> {
  const record = {} as Record<DeviceAppId, T>;
  for (const app of DEVICE_APP_IDS) record[app] = make();
  return record;
}

function actionView(state: ChapterState, scenario: ScenarioDefinition, itemState: DeviceItemState, action: DeviceItemActionDef): DeviceActionView {
  const cashCost = action.cashCost ?? 0;
  const timeCost = action.timeCostMinutes ?? 0;
  let blocked: ActionBlock | null = null;
  if (action.once === true && itemState.done.includes(action.id)) blocked = "done";
  else if (!evaluateConditions(action.requires, state, scenario)) blocked = "locked";
  else if (cashCost > 0 && action.allowDebt !== true && state.resources.cash < cashCost) blocked = "cash";
  else if (timeCost > 0 && state.resources.timeMinutes <= 0) blocked = "time";
  else if (action.callId !== undefined && (state.call.current !== null || state.conversation !== null)) blocked = "call";
  return {
    id: action.id,
    label: action.label,
    timeCostMinutes: timeCost,
    cashCost,
    available: blocked === null,
    blocked,
    placesCall: action.callId !== undefined,
  };
}

function itemView(state: ChapterState, scenario: ScenarioDefinition, item: DeviceItemDef, itemState: DeviceItemState): DeviceItemView {
  return {
    id: item.id,
    app: item.app,
    title: item.title,
    from: item.from ?? null,
    detail: item.detail ?? null,
    body: item.body,
    folder: item.folder ?? null,
    arrivedAtMinute: itemState.arrivedAtMinute,
    read: itemState.read,
    startsAtMinute: item.startsAtMinute ?? null,
    endsAtMinute: item.endsAtMinute ?? null,
    amount: item.amount ?? null,
    actions: (item.actions ?? []).map((action) => actionView(state, scenario, itemState, action)),
  };
}

const cache = new WeakMap<ChapterState, WeakMap<ScenarioDefinition, Map<DeviceKind, DeviceView>>>();

/** The device apps for `device`, memoized by state and scenario (stable for `useSyncExternalStore`). */
export function selectDeviceView(state: ChapterState, scenario: ScenarioDefinition, device: DeviceKind): DeviceView {
  let byScenario = cache.get(state);
  if (!byScenario) {
    byScenario = new WeakMap();
    cache.set(state, byScenario);
  }
  let byDevice = byScenario.get(scenario);
  if (!byDevice) {
    byDevice = new Map();
    byScenario.set(scenario, byDevice);
  }
  const hit = byDevice.get(device);
  if (hit) return hit;
  const value = computeDeviceView(state, scenario, device);
  byDevice.set(device, value);
  return value;
}

function computeDeviceView(state: ChapterState, scenario: ScenarioDefinition, device: DeviceKind): DeviceView {
  const apps = emptyRecord<DeviceItemView[]>(() => []);
  const unread = emptyRecord(() => 0);
  for (const item of scenario.deviceItems ?? []) {
    if (!itemDevices(item).includes(device)) continue;
    if (!Object.hasOwn(state.device.items, item.id)) continue;
    const view = itemView(state, scenario, item, state.device.items[item.id]);
    apps[item.app].push(view);
    if (!view.read) unread[item.app] += 1;
  }
  const sortKey = (view: DeviceItemView): number => (view.startsAtMinute !== null ? view.startsAtMinute : -view.arrivedAtMinute);
  for (const app of DEVICE_APP_IDS) apps[app].sort((a, b) => sortKey(a) - sortKey(b) || (a.id < b.id ? -1 : 1));
  const now = elapsedMinutes(state, scenario);
  const evidenceTitles = state.discovered
    .filter((id) => Object.hasOwn(scenario.evidence, id))
    .map((id) => scenario.evidence[id].title);
  return {
    apps,
    unread,
    available: DEVICE_APP_IDS.filter((app) => apps[app].length > 0),
    bank: {
      balance: state.resources.cash,
      ledger: [...state.device.ledger]
        .reverse()
        .map((entry): LedgerEntryView => ({
          seq: entry.seq,
          atMinute: entry.atMinute,
          label: ledgerLabel(scenario, entry),
          amount: entry.amount,
          counterparty: entry.counterparty,
        })),
      digitalSecurity: state.resources.digitalSecurity,
    },
    calendar: { minutesLeft: state.resources.timeMinutes, thesisProgress: state.resources.thesisProgress, submission: state.device.submission, now },
    map: { location: state.device.location },
    files: { backupSecured: state.persistent.backupSecured, evidenceCount: state.resources.evidence, evidenceTitles },
  };
}

/** The text of a ledger line: its key in `ledgerLabels`, else the label of the action that made it. */
export function ledgerLabel(scenario: ScenarioDefinition, entry: LedgerEntry): string {
  const labels = scenario.ledgerLabels;
  if (labels !== undefined && Object.hasOwn(labels, entry.label)) return labels[entry.label];
  if (entry.itemId !== null && entry.actionId !== null) {
    const item = deviceItemDef(scenario, entry.itemId);
    const action = item === undefined ? undefined : itemActionDef(item, entry.actionId);
    if (action !== undefined) return action.label;
  }
  return entry.label;
}

// ---------------------------------------------------------------------------
// Content validation
// ---------------------------------------------------------------------------

/** Domains that are allowed in plain text: reserved or documentation domains only. */
const RESERVED_DOMAIN = /(?:^|\.)(?:test|example|invalid|localhost)$|^example\.(?:com|net|org)$|\.example\.(?:com|net|org)$/i;
const FILE_EXTENSION = /\.(?:docx?|pdf|xlsx?|pptx?|txt|csv|zip|png|jpe?g|gif|mp3|mp4|wav|m4a)$/i;
const DOMAIN_LIKE = /\b[a-z0-9][a-z0-9-]*(?:\.[a-z0-9][a-z0-9-]*)+\b/gi;

function unreservedDomains(text: string): string[] {
  const found: string[] = [];
  for (const match of text.matchAll(DOMAIN_LIKE)) {
    const domain = match[0];
    // Skip numbers such as 2.500.000, times such as 17.00 and file names such as thesis-final.docx.
    if (/^[\d.]+$/.test(domain) || FILE_EXTENSION.test(domain)) continue;
    if (!RESERVED_DOMAIN.test(domain)) found.push(domain);
  }
  return found;
}

/**
 * Checks the device content: unique IDs, known apps, a way for later items to arrive, unique
 * action IDs, references to places, calls and conditions, and plain-text addresses on reserved
 * domains only (`.test`, `.example`, `.invalid`, `example.com`). Messages are plain messages.
 */
export function validateDeviceContent(scenario: ScenarioDefinition): string[] {
  const problems: string[] = [];
  if (typeof scenario !== "object" || scenario === null) return problems;
  if (scenario.deviceItems === undefined) return problems;
  if (!Array.isArray(scenario.deviceItems)) return ["Scenario device items must be a list."];
  const ids = new Set<string>();
  for (const item of scenario.deviceItems) {
    const where = `Device item "${item.id}"`;
    if (ids.has(item.id)) problems.push(`${where} is defined twice.`);
    ids.add(item.id);
    if (!DEVICE_APP_IDS.includes(item.app)) problems.push(`${where} has an unknown app "${item.app}".`);
    if (item.arrives !== undefined && item.arrives.atMinute === undefined && (item.arrives.when === undefined || item.arrives.when.length === 0)) {
      problems.push(`${where} arrives with no time and no condition.`);
    }
    if (item.app === "calendar" && item.startsAtMinute === undefined) problems.push(`${where} is a calendar item with no start time.`);
    if (item.startsAtMinute !== undefined && item.endsAtMinute !== undefined && item.endsAtMinute < item.startsAtMinute) {
      problems.push(`${where} ends before it starts.`);
    }
    for (const text of [item.from, item.detail, item.body, item.title]) {
      if (typeof text !== "string") continue;
      for (const domain of unreservedDomains(text)) problems.push(`${where} shows the domain "${domain}", which is not reserved.`);
    }
    const actionIds = new Set<string>();
    for (const action of item.actions ?? []) {
      if (actionIds.has(action.id)) problems.push(`${where} has two actions named "${action.id}".`);
      actionIds.add(action.id);
      if (action.cashCost !== undefined && (!Number.isInteger(action.cashCost) || action.cashCost < 0)) {
        problems.push(`${where}, action "${action.id}" has an invalid cash cost.`);
      }
      if (action.timeCostMinutes !== undefined && (!Number.isInteger(action.timeCostMinutes) || action.timeCostMinutes < 0)) {
        problems.push(`${where}, action "${action.id}" has an invalid time cost.`);
      }
      if (action.callId !== undefined) {
        const call = Object.hasOwn(scenario.calls, action.callId) ? scenario.calls[action.callId as keyof typeof scenario.calls] : undefined;
        if (call === undefined) problems.push(`${where}, action "${action.id}" places the unknown call "${action.callId}".`);
        else if (call.direction !== "outgoing") problems.push(`${where}, action "${action.id}" places "${action.callId}", which is not an outgoing call.`);
      }
    }
  }
  for (const item of scenario.deviceItems) {
    for (const effect of [...(item.onOpen ?? []), ...(item.actions ?? []).flatMap((action) => action.effects ?? [])]) {
      if (effect.kind === "deliverItem" && !ids.has(effect.itemId)) {
        problems.push(`Device item "${item.id}" delivers the unknown item "${effect.itemId}".`);
      }
    }
  }
  return problems;
}
