// Phone and laptop content: arrival, opening, actions with time and cash, the bank ledger, the map,
// the calendar and submission, files and backups, outgoing calls, and replay from a save.
// The items below are test content, not Mission 01.
import { describe, expect, it } from "vitest";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import { FOUNDATION_SCENARIO, LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { selectDeviceView, validateDeviceContent } from "../narrative/device";
import { localizeScenario, narrativeTextEntries } from "../narrative/localize";
import { chapterReducer, createInitialState, isCoreAction } from "../narrative/reducer";
import { CHAPTER_DURATION_MINUTES, minutesFromStart } from "../narrative/resources";
import type { ChapterState, CoreAction, DeviceItemDef, ScenarioDefinition } from "../narrative/types";

const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const open = (itemId: string): CoreAction => ({ type: "OPEN_DEVICE_ITEM", itemId });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });

const ITEMS: DeviceItemDef[] = [
  {
    id: "mail.registry",
    app: "mail",
    folder: "university",
    title: "Clearance form",
    from: "Registry Office <office@registry.example>",
    body: "Please review your clearance form.",
    arrives: { atMinute: 30 },
    actions: [
      { id: "reply", label: "Reply", timeCostMinutes: 10 },
      {
        id: "pay-fee",
        label: "Pay the fee",
        cashCost: 22_000,
        ledgerLabel: "ledger.fee",
        counterparty: "Registry Office",
        once: true,
        effects: [{ kind: "adjustResource", resource: "supportNetwork", delta: 5 }],
      },
    ],
  },
  {
    id: "mail.recruiter",
    app: "mail",
    folder: "recruitment",
    title: "Project assistant role",
    from: "Talent Team <jobs@talent.example>",
    body: "We would like to talk about a role.",
    onOpen: [{ kind: "setPersistent", flag: "minhTrustsAlex", value: false }],
  },
  {
    id: "msg.minh",
    app: "messages",
    title: "Minh",
    body: "Can you send me the interview notes?",
    actions: [{ id: "send-notes", label: "Send the notes", timeCostMinutes: 5, once: true, effects: [{ kind: "deliverItem", itemId: "msg.minh-thanks" }] }],
  },
  { id: "msg.minh-thanks", app: "messages", title: "Minh (reply)", body: "Thank you.", arrives: { when: [{ kind: "itemActionDone", itemId: "msg.minh", actionId: "send-notes" }] } },
  { id: "bank.payee", app: "bank", title: "Print shop", amount: 150_000, body: "Pay a bill.", actions: [{ id: "pay", label: "Pay", cashCost: 150_000, ledgerLabel: "ledger.print" }] },
  {
    id: "bank.loan",
    app: "bank",
    title: "Short loan",
    body: "Borrow money.",
    actions: [{ id: "borrow-pay", label: "Pay with a loan", cashCost: 5_000_000, allowDebt: true }],
  },
  {
    id: "place.campus",
    app: "map",
    title: "Campus",
    body: "The university.",
    actions: [
      { id: "ride", label: "Ride there", timeCostMinutes: 20, cashCost: 105_000, moveTo: "place.campus" },
      { id: "bus", label: "Take the bus", timeCostMinutes: 60, cashCost: 7_000, moveTo: "place.campus" },
    ],
  },
  { id: "cal.interview", app: "calendar", title: "Interview", startsAtMinute: minutesFromStart(3, 11, 30), endsAtMinute: minutesFromStart(3, 12, 30), body: "At the shop." },
  {
    id: "cal.submission",
    app: "calendar",
    title: "Thesis submission",
    startsAtMinute: minutesFromStart(5, 14, 0),
    endsAtMinute: minutesFromStart(5, 17, 0),
    body: "Submit the final version.",
    actions: [
      {
        id: "submit",
        label: "Submit",
        requires: [{ kind: "resourceAtLeast", resource: "thesisProgress", value: 100 }],
        effects: [{ kind: "setSubmission", status: "submitted" }],
      },
    ],
  },
  { id: "house.room", app: "housing", title: "Room near campus", amount: 3_000_000, body: "A room.", actions: [{ id: "inquire", label: "Ask about it", timeCostMinutes: 15 }] },
  { id: "job.assistant", app: "jobs", title: "Library assistant", body: "A part-time job.", actions: [{ id: "apply", label: "Apply", timeCostMinutes: 30, once: true }] },
  {
    id: "file.thesis",
    app: "files",
    folder: "thesis",
    title: "thesis-final.docx",
    body: "The thesis file.",
    devices: ["laptop"],
    actions: [{ id: "backup", label: "Make a backup", timeCostMinutes: 30, effects: [{ kind: "setPersistent", flag: "backupSecured", value: true }] }],
  },
];

const CONTACT: DeviceItemDef = {
  id: "contact.office",
  app: "contacts",
  title: "Student support office",
  detail: "+000 555 0101",
  body: "International student support.",
  actions: [{ id: "call", label: "Call", callId: "call.official" }],
};

function scenarioWith(items: DeviceItemDef[] = ITEMS, base: ScenarioDefinition = FOUNDATION_SCENARIO): ScenarioDefinition {
  return {
    ...base,
    deviceItems: items,
    ledgerLabels: { "ledger.fee": "Clearance fee", "ledger.print": "Print shop bill" },
  };
}

function run(scenario: ScenarioDefinition, actions: CoreAction[]): ChapterState {
  let state = createInitialState(scenario);
  for (const action of actions) {
    const result = chapterReducer(state, action, scenario);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

const scenario = scenarioWith();
const rejection = (state: ChapterState, action: CoreAction, s: ScenarioDefinition = scenario) => chapterReducer(state, action, s).reason;

describe("arrival", () => {
  it("shows items from the start and brings later items on time", () => {
    const start = run(scenario, [START]);
    expect(Object.hasOwn(start.device.items, "mail.recruiter")).toBe(true);
    expect(Object.hasOwn(start.device.items, "mail.registry")).toBe(false);
    const later = run(scenario, [START, advance(29)]);
    expect(Object.hasOwn(later.device.items, "mail.registry")).toBe(false);
    const arrived = run(scenario, [START, advance(29), advance(1)]);
    expect(arrived.device.items["mail.registry"].arrivedAtMinute).toBe(30);
    expect(arrived.events.at(-1)?.derived.debriefTags).toEqual(["world:item:mail.registry:arrived"]);
  });

  it("brings an item when a decision makes its condition hold", () => {
    const before = run(scenario, [START]);
    expect(Object.hasOwn(before.device.items, "msg.minh-thanks")).toBe(false);
    const after = run(scenario, [START, open("msg.minh"), use("msg.minh", "send-notes")]);
    expect(Object.hasOwn(after.device.items, "msg.minh-thanks")).toBe(true);
  });

  it("rejects an item that has not arrived", () => {
    const state = run(scenario, [START]);
    expect(rejection(state, open("mail.registry"))).toBe("This item has not arrived yet.");
    expect(rejection(state, open("missing"))).toBe("This item does not exist.");
    expect(rejection(state, use("mail.registry", "reply"))).toBe("This item has not arrived yet.");
  });
});

describe("opening an item", () => {
  it("marks it read, costs no time, and applies its effects once", () => {
    let state = run(scenario, [START]);
    state = chapterReducer(state, open("mail.recruiter"), scenario).state;
    expect(state.device.items["mail.recruiter"].read).toBe(true);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES);
    expect(state.persistent.minhTrustsAlex).toBe(false);
    const again = chapterReducer(state, open("mail.recruiter"), scenario);
    // Opening it again is accepted, costs no time and applies nothing twice.
    expect(again.accepted).toBe(true);
    expect(again.state.resources).toEqual(state.resources);
    expect(again.state.persistent).toEqual(state.persistent);
  });
});

describe("using an action", () => {
  it("costs time and cash, writes the ledger, applies effects and remembers the action", () => {
    const state = run(scenario, [START, advance(40), use("mail.registry", "pay-fee")]);
    expect(state.resources.cash).toBe(2_478_000);
    expect(state.resources.supportNetwork).toBe(55);
    expect(state.device.ledger).toEqual([
      { seq: 0, atMinute: 40, label: "ledger.fee", amount: -22_000, counterparty: "Registry Office", itemId: "mail.registry", actionId: "pay-fee" },
    ]);
    expect(state.device.items["mail.registry"].done).toEqual(["pay-fee"]);
    expect(state.events.at(-1)?.derived.resources).toEqual({ cash: -22_000, supportNetwork: 5 });
    expect(rejection(state, use("mail.registry", "pay-fee"))).toBe("This action was already used.");
  });

  it("charges simulated time and lets the clock-driven world react", () => {
    const state = run(scenario, [START, advance(40), use("mail.registry", "reply")]);
    expect(state.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 50);
  });

  it("rejects a payment the cash cannot cover, unless the action allows debt", () => {
    const poor: ChapterState = { ...run(scenario, [START]), resources: { ...run(scenario, [START]).resources, cash: 100_000 } };
    expect(rejection(poor, use("bank.payee", "pay"))).toBe("There is not enough cash for this.");
    const indebted = chapterReducer(poor, use("bank.loan", "borrow-pay"), scenario).state;
    expect(indebted.resources.cash).toBe(-4_900_000);
    expect(indebted.device.ledger[0].amount).toBe(-5_000_000);
  });

  it("moves Alex on the map and charges the chosen route", () => {
    const ride = run(scenario, [START, use("place.campus", "ride")]);
    expect(ride.device.location).toBe("place.campus");
    expect(ride.resources.cash).toBe(2_500_000 - 105_000);
    expect(ride.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 20);
    const bus = run(scenario, [START, use("place.campus", "bus")]);
    expect(bus.resources.cash).toBe(2_500_000 - 7_000);
    expect(bus.resources.timeMinutes).toBe(CHAPTER_DURATION_MINUTES - 60);
  });

  it("keeps submission behind its conditions and then records it", () => {
    const early = run(scenario, [START]);
    expect(rejection(early, use("cal.submission", "submit"))).toBe("This action is not available now.");
    const ready: ChapterState = { ...early, resources: { ...early.resources, thesisProgress: 100 } };
    const done = chapterReducer(ready, use("cal.submission", "submit"), scenario).state;
    expect(done.device.submission).toBe("submitted");
    expect(selectDeviceView(done, scenario, "phone").calendar.submission).toBe("submitted");
  });

  it("makes a backup that later missions can read", () => {
    const state = run(scenario, [START, use("file.thesis", "backup")]);
    expect(state.persistent.backupSecured).toBe(true);
    expect(selectDeviceView(state, scenario, "laptop").files.backupSecured).toBe(true);
  });

  it("does not reset earlier consequences when later actions run", () => {
    const state = run(scenario, [START, open("mail.recruiter"), advance(40), use("mail.registry", "pay-fee"), use("house.room", "inquire"), use("file.thesis", "backup")]);
    expect(state.persistent.minhTrustsAlex).toBe(false);
    expect(state.persistent.backupSecured).toBe(true);
    expect(state.device.ledger).toHaveLength(1);
    expect(state.resources.cash).toBe(2_478_000);
  });

  it("places an outgoing call from a contact", () => {
    const withCall = scenarioWith([CONTACT], CHAPTER_1_SCENARIO);
    const state = run(withCall, [START, use("contact.office", "call")]);
    expect(state.call.status).toBe("active");
    expect(state.call.current).toBe("call.official");
    expect(state.conversation?.graphId).toBe("dlg.official-line");
    expect(rejection(state, use("contact.office", "call"), withCall)).toBe("Finish the call first.");
  });

  it("gives the same state for the same actions and restores it from a save", () => {
    const actions = [START, advance(40), open("mail.registry"), use("mail.registry", "pay-fee"), use("place.campus", "bus"), use("file.thesis", "backup")];
    const state = run(scenario, actions);
    expect(run(scenario, actions)).toEqual(state);
    const progress = encodeProgress(state, null, "start");
    const restored = restoreProgress(JSON.parse(JSON.stringify(progress)), scenario);
    expect(restored.ok && restored.state).toEqual(state);
  });
});

describe("what the apps show", () => {
  it("lists items per device, with unread counts and the facts of each app", () => {
    const state = run(scenario, [START, advance(40), use("place.campus", "ride"), use("mail.registry", "pay-fee")]);
    const phone = selectDeviceView(state, scenario, "phone");
    const laptop = selectDeviceView(state, scenario, "laptop");
    expect(phone.apps.mail.map((item) => item.id).sort()).toEqual(["mail.recruiter", "mail.registry"]);
    expect(phone.apps.files.map((item) => item.id)).toEqual([]);
    expect(laptop.apps.files.map((item) => item.id)).toEqual(["file.thesis"]);
    expect(laptop.apps.contacts).toEqual([]);
    expect(phone.unread.mail).toBe(1); // the registry mail was used, so it counts as read
    expect(phone.bank.balance).toBe(2_500_000 - 105_000 - 22_000);
    expect(phone.bank.ledger.map((entry) => entry.label)).toEqual(["Clearance fee", "Ride there"]);
    expect(phone.map.location).toBe("place.campus");
    expect(phone.calendar.now).toBe(60);
    expect(phone.apps.calendar.map((item) => item.id)).toEqual(["cal.interview", "cal.submission"]);
  });

  it("explains why an action cannot be used, without any good or bad mark", () => {
    const state = run(scenario, [START]);
    const view = selectDeviceView(state, scenario, "phone");
    const submit = view.apps.calendar.find((item) => item.id === "cal.submission")!.actions[0];
    expect(submit).toMatchObject({ available: false, blocked: "locked" });
    const poor = { ...state, resources: { ...state.resources, cash: 0 } };
    const payee = selectDeviceView(poor, scenario, "phone").apps.bank.find((item) => item.id === "bank.payee")!;
    expect(payee.actions[0].blocked).toBe("cash");
    expect(JSON.stringify(view)).not.toMatch(/safe|unsafe|scam|good|bad|score/i);
  });

  it("returns the same view object for the same state", () => {
    const state = run(scenario, [START]);
    expect(selectDeviceView(state, scenario, "phone")).toBe(selectDeviceView(state, scenario, "phone"));
  });
});

describe("action shapes", () => {
  it("rejects malformed device actions", () => {
    expect(isCoreAction({ type: "OPEN_DEVICE_ITEM", itemId: "" })).toBe(false);
    expect(isCoreAction({ type: "USE_DEVICE_ITEM", itemId: "a" })).toBe(false);
    expect(isCoreAction({ type: "USE_DEVICE_ITEM", itemId: "a", actionId: "b" })).toBe(true);
    expect(isCoreAction({ type: "OPEN_DEVICE_ITEM", itemId: "a" })).toBe(true);
  });
});

describe("content validation and localization", () => {
  it("accepts consistent content", () => {
    expect(validateDeviceContent(scenario)).toEqual([]);
    expect(validateDeviceContent(LAST_SUBMISSION_SCENARIO)).toEqual([]);
  });

  it("reports duplicates, unknown apps, missing triggers, real domains and unknown calls", () => {
    const bad = scenarioWith([
      { id: "a", app: "mail", title: "x", body: "see www.somebank.com", arrives: {} },
      { id: "a", app: "weather" as never, title: "y", body: "z" },
      { id: "c", app: "calendar", title: "no start", body: "b", actions: [{ id: "x", label: "X", callId: "call.nope" }, { id: "x", label: "Y", cashCost: -1 }] },
      { id: "d", app: "mail", title: "d", body: "d", onOpen: [{ kind: "deliverItem", itemId: "ghost" }] },
    ]);
    const problems = validateDeviceContent(bad).join("\n");
    expect(problems).toContain('"a" is defined twice');
    expect(problems).toContain("unknown app");
    expect(problems).toContain("arrives with no time and no condition");
    expect(problems).toContain('"www.somebank.com", which is not reserved');
    expect(problems).toContain("calendar item with no start time");
    expect(problems).toContain('unknown call "call.nope"');
    expect(problems).toContain("two actions named");
    expect(problems).toContain("invalid cash cost");
    expect(problems).toContain('unknown item "ghost"');
  });

  it("allows reserved domains and ignores amounts and times", () => {
    const fine = scenarioWith([{ id: "m", app: "mail", title: "Fee 22.000 VND at 17.00", from: "a@b.example", detail: "c@example.com and d.test", body: "x" }]);
    expect(validateDeviceContent(fine)).toEqual([]);
  });

  it("lists every item and ledger text for the Vietnamese overlay and localizes them", () => {
    const keys = narrativeTextEntries(scenario, {} as never).map((entry) => entry.key);
    expect(keys).toContain("device/mail.registry/title");
    expect(keys).toContain("device/mail.registry/actions/pay-fee/label");
    expect(keys).toContain("ledger/ledger.fee");
    const vi = localizeScenario(scenario, { "device/mail.registry/title": "Mẫu xác nhận", "ledger/ledger.fee": "Phí xác nhận" });
    expect(vi.deviceItems?.find((item) => item.id === "mail.registry")?.title).toBe("Mẫu xác nhận");
    expect(vi.ledgerLabels?.["ledger.fee"]).toBe("Phí xác nhận");
    expect(vi.deviceItems?.find((item) => item.id === "mail.registry")?.actions?.[1].cashCost).toBe(22_000);
  });
});
