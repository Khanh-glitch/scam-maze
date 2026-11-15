// A small, fictional scenario that uses every core mechanism once. For core tests only.
// Pure TypeScript: no React. Fictional data: `+000` numbers, `.invalid` and `.example` domains.
// The core is typed against the chapter 1 ID unions, so records that are keyed by an ID union are
// filled partially and cast; the fixture only defines the IDs it uses.

import { createInitialState } from "../game/narrative/reducer";
import type {
  ActDef,
  CallDef,
  ChapterState,
  Condition,
  DecisionDef,
  DeductionDef,
  DeviceActionDef,
  DialogueGraph,
  EndingDef,
  EvidenceItem,
  ScenarioDefinition,
  SourceDef,
} from "../game/narrative/types";
import type {
  ClaimId,
  DecisionId,
  EvidenceId,
  FlagId,
  ObjectiveId,
  OutcomeId,
} from "../game/narrative/chapter1/ids";

/** Casts a partial record to the full ID-keyed record the scenario type asks for. */
function full<T>(value: Partial<T>): T {
  return value as T;
}

const sources: SourceDef[] = [
  {
    id: "src.call-alex",
    label: "First call",
    kind: "call",
    claimedOrigin: "Northgate Bank security",
    trust: "unverified",
    identifiers: [
      { key: "case", value: "NG-4471-X" },
      { key: "callerId", value: "+000 0100 2200" },
    ],
  },
  {
    id: "src.notification",
    label: "Laptop notification",
    kind: "notification",
    claimedOrigin: "Northgate Bank security",
    trust: "unverified",
    identifiers: [
      { key: "case", value: "NG-4471-X" },
      { key: "domain", value: "northgate-alerts.invalid" },
    ],
  },
  {
    id: "src.statement-paper",
    label: "Paper statement",
    kind: "document",
    claimedOrigin: "Northgate Bank",
    trust: "pre-existing",
    identifiers: [{ key: "domain", value: "northgate-bank.example" }],
  },
];

const evidence: EvidenceItem[] = [
  {
    id: "ev.alex-statement",
    title: "What the first caller said",
    description: "The caller named a case and said a notification would follow.",
    source: "dialogue",
    location: "First call",
    discovery: { via: "dialogue-node", nodeId: "alex.open" },
    relations: [{ claimId: "claim.alex-identity", stance: "needs-verification", note: "Self-reported." }],
    warningSigns: ["ws.urgency"],
    sourceId: "src.call-alex",
    relevance: "A caller who supplies their own case number has not shown who they are.",
  },
  {
    id: "ev.notification-metadata",
    title: "Notification sender details",
    description: "The sender domain is northgate-alerts.invalid.",
    source: "device",
    location: "Laptop",
    discovery: { via: "device", deviceActionId: "dev.inspect-notification-origin" },
    relations: [{ claimId: "claim.notification-genuine", stance: "contradicts", note: "Domain differs from the statement." }],
    warningSigns: ["ws.unverified-sender"],
    sourceId: "src.notification",
    relevance: "The sender domain can be compared with a document you already have.",
  },
  {
    id: "ev.shared-case-id",
    title: "Case number in the notification",
    description: "The notification quotes the same case number as the first caller.",
    source: "device",
    location: "Laptop",
    discovery: { via: "inspect", requires: [{ kind: "hasEvidence", evidenceId: "ev.notification-metadata" }] },
    relations: [{ claimId: "claim.claims-independent", stance: "inconclusive", note: "Same number, same story." }],
    warningSigns: ["ws.shared-case-id"],
    sourceId: "src.notification",
    relevance: "Two messages that share a case number may come from one source.",
  },
  {
    id: "ev.account-activity",
    title: "Paper statement",
    description: "The statement lists the official website northgate-bank.example and no open case.",
    source: "physical",
    location: "Desk",
    discovery: { via: "interact", objectId: "obj.receipts" },
    relations: [{ claimId: "claim.recovery-needed", stance: "contradicts", note: "No open case is listed." }],
    warningSigns: [],
    sourceId: "src.statement-paper",
    relevance: "A document you already hold can be checked against a new message.",
    debriefHint: "The paper statement on the desk was never opened.",
  },
  {
    // The reducer's saved-contact check reads this ID, so the fixture needs it to offer the official line.
    id: "ev.official-contact-paper",
    title: "Saved contact on the statement",
    description: "The statement prints a phone number for the bank.",
    source: "physical",
    location: "Desk",
    discovery: { via: "inspect", requires: [{ kind: "hasEvidence", evidenceId: "ev.account-activity" }] },
    relations: [{ claimId: "claim.recovery-needed", stance: "needs-verification", note: "Call it to check." }],
    warningSigns: [],
    sourceId: "src.statement-paper",
    relevance: "A number printed on a document you already hold is a channel you can trust more than a caller.",
  },
];

const deductions: DeductionDef[] = [
  {
    id: "ded.same-source",
    inputs: ["ev.alex-statement", "ev.shared-case-id"],
    requires: [],
    basis: { kind: "shared-identifier", key: "case" },
    statement: "These claims are not independently verified.",
    effects: [{ kind: "setFlag", flag: "shared_origin_established" }],
    debriefTag: "same-source",
  },
  {
    id: "ded.notification-mismatch",
    inputs: ["ev.notification-metadata"],
    inputsAnyOf: ["ev.account-activity"],
    requires: [],
    basis: { kind: "conflicting-identifier", key: "domain" },
    statement: "The notification domain does not match the statement.",
    effects: [
      { kind: "setFlag", flag: "notification_origin_mismatch" },
      { kind: "setClaimStatus", claimId: "claim.notification-genuine", status: "inconclusive" },
    ],
    debriefTag: "notification-mismatch",
  },
];

const deviceActions: DeviceActionDef[] = [
  {
    id: "dev.inspect-notification-origin",
    device: "laptop",
    label: "Check who sent the notification",
    requires: [{ kind: "flag", flag: "notification_delivered" }],
    effects: [
      { kind: "setFlag", flag: "notification_origin_inspected" },
      { kind: "setFlag", flag: "notification_handled" },
    ],
    reveals: ["ev.notification-metadata"],
    once: true,
    debriefTag: "inspected-origin",
  },
  {
    // Produces `review_security_opened`, which the second `ringWhen` alternative of call.recovery needs.
    id: "dev.review-security",
    device: "laptop",
    label: "Open the review security page",
    requires: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
    effects: [{ kind: "setFlag", flag: "review_security_opened" }],
    reveals: [],
    once: true,
  },
];

const alexGraph: DialogueGraph = {
  id: "dlg.alex",
  persona: { speakerId: "spk.alex", name: "Alex", role: "Caller", honesty: "scammer" },
  channel: "phone",
  independentChannel: false,
  startNodeId: "alex.open",
  lines: {
    "alex.open": "This is Northgate security. Your case is NG-4471-X. A notification will follow soon.",
    "alex.share-code": "Read me the code you just received.",
    "alex.refuse": "I will not share a code.",
    "alex.refused": "Then the case stays open. Check your laptop.",
    "alex.code-taken": "Thank you. The follow-up team will call you.",
  },
  nodes: {
    "alex.open": {
      id: "alex.open",
      speaker: "caller",
      lineId: "alex.open",
      pressure: true,
      tone: "pressuring",
      options: [
        { id: "alex.share-code", lineId: "alex.share-code", effects: [{ kind: "setFlag", flag: "code_shared" }], next: "alex.code-taken", debriefTag: "shared-code" },
        { id: "alex.refuse", lineId: "alex.refuse", next: "alex.refused", debriefTag: "refused-code" },
        { id: "alex.hang-up", lineId: "alex.refuse", next: { end: "hang-up" }, debriefTag: "hung-up" },
      ],
    },
    "alex.refused": {
      id: "alex.refused",
      speaker: "caller",
      lineId: "alex.refused",
      tone: "defensive",
      options: [],
      end: { kind: "completed" },
    },
    "alex.code-taken": {
      id: "alex.code-taken",
      speaker: "caller",
      lineId: "alex.code-taken",
      tone: "reassuring",
      options: [],
      end: { kind: "completed" },
    },
  },
};

const recoveryGraph: DialogueGraph = {
  id: "dlg.recovery",
  persona: { speakerId: "spk.recovery", name: "Recovery desk", role: "Caller", honesty: "scammer" },
  channel: "phone",
  independentChannel: false,
  startNodeId: "rec.open",
  lines: {
    "rec.open": "I am from the follow-up team for case NG-4471-X. Move your funds to a holding account.",
    "rec.trust": "I will follow your steps.",
    "rec.end": "Good. Stay on the line.",
  },
  nodes: {
    "rec.open": {
      id: "rec.open",
      speaker: "caller",
      lineId: "rec.open",
      pressure: true,
      tone: "reassuring",
      options: [
        { id: "rec.trust", lineId: "rec.trust", effects: [{ kind: "setFlag", flag: "second_caller_trusted" }], next: "rec.end" },
        { id: "rec.hang-up", lineId: "rec.trust", next: { end: "hang-up" } },
      ],
    },
    "rec.end": {
      id: "rec.end",
      speaker: "caller",
      lineId: "rec.end",
      tone: "pressuring",
      options: [],
      end: { kind: "completed" },
    },
  },
};

const officialGraph: DialogueGraph = {
  id: "dlg.official-line",
  persona: { speakerId: "spk.northgate-agent", name: "Northgate line", role: "Agent", honesty: "trusted" },
  channel: "phone",
  independentChannel: true,
  startNodeId: "off.open",
  lines: {
    "off.open": "Northgate Bank. How can I help?",
    "off.ask": "Is there a case NG-4471-X?",
    "off.confirm": "There is no such case on your account.",
  },
  nodes: {
    "off.open": {
      id: "off.open",
      speaker: "caller",
      lineId: "off.open",
      tone: "professional",
      options: [{ id: "off.ask", lineId: "off.ask", next: "off.confirm" }],
    },
    "off.confirm": {
      id: "off.confirm",
      speaker: "caller",
      lineId: "off.confirm",
      tone: "professional",
      onEnter: [
        { kind: "setClaimStatus", claimId: "claim.recovery-needed", status: "contradicted" },
        { kind: "setFlag", flag: "official_channel_verified" },
      ],
      options: [],
      end: { kind: "completed" },
    },
  },
};

const calls: CallDef[] = [
  {
    id: "call.alex",
    direction: "incoming",
    displayName: "Unknown caller",
    number: "+000 0100 2200",
    graphId: "dlg.alex",
    ringWhen: [[{ kind: "notFlag", flag: "first_call_answered" }, { kind: "notFlag", flag: "first_call_rejected" }]],
  },
  {
    id: "call.recovery",
    direction: "incoming",
    displayName: "Follow-up team",
    number: "+000 0100 7771",
    graphId: "dlg.recovery",
    ringWhen: [
      [{ kind: "flag", flag: "notification_handled" }],
      [{ kind: "callClosed", callId: "call.alex" }, { kind: "flag", flag: "review_security_opened" }],
    ],
  },
  {
    id: "call.official",
    direction: "outgoing",
    displayName: "Northgate Bank (saved contact)",
    number: "+000 0100 0800",
    graphId: "dlg.official-line",
    ringWhen: [],
  },
];

const decisions: DecisionDef[] = [
  {
    id: "follow-recovery",
    label: "Follow the second caller",
    requires: [{ kind: "callRang", callId: "call.recovery" }],
    unavailableHint: "The second caller has not called yet.",
    effects: [{ kind: "setFlag", flag: "money_moved" }],
    debriefTag: "followed-recovery",
  },
  {
    id: "refuse-and-stop",
    label: "Refuse and stop",
    requires: [],
    unavailableHint: "",
    debriefTag: "refused",
  },
  {
    id: "verify-independently",
    label: "Verify with the saved contact",
    requires: [{ kind: "callClosed", callId: "call.alex" }],
    unavailableHint: "Finish the first call first.",
    preStep: {
      label: "Call the saved contact",
      method: "saved-official-contact",
      claimId: "claim.recovery-needed",
      requires: [{ kind: "hasAnyEvidence", evidenceIds: ["ev.account-activity", "ev.notification-metadata"] }],
      unavailableHint: "Find a saved contact first.",
    },
    debriefTag: "verified",
  },
];

const endings: EndingDef[] = [
  ending("false-victory", 1, [{ kind: "flag", flag: "money_moved" }]),
  ending("perfect-chain", 2, [
    { kind: "decisionIs", decision: "verify-independently" },
    { kind: "flag", flag: "official_channel_verified" },
    { kind: "deductionRecorded", deductionId: "ded.same-source" },
    { kind: "deductionRecorded", deductionId: "ded.notification-mismatch" },
  ]),
  ending("break-the-chain", 3, [
    { kind: "decisionIs", decision: "refuse-and-stop" },
    { kind: "notFlag", flag: "code_shared" },
    { kind: "notFlag", flag: "money_moved" },
  ]),
  ending("unfinished-case", 4, []),
];

function ending(id: OutcomeId, order: number, selectWhen: Condition[]): EndingDef {
  return {
    id,
    title: `Ending ${id}`,
    variants: [{ id: `${id}.default`, when: [], text: `Text for ${id}.` }],
    simulationLabel: "Simulation: nothing real happened.",
    selectWhen,
    order,
    aftermath: {
      consequence: `Consequence for ${id}.`,
      phone: `Phone aftermath for ${id}.`,
      laptop: `Laptop aftermath for ${id}.`,
      evidenceSummary: `Evidence summary for ${id}.`,
      caseReport: `Case report for ${id}.`,
      narrationNodeIds: [],
    },
  };
}

const acts: ActDef[] = [
  { id: "act.1", title: "Act 1", enterWhen: [], exitWhen: [{ kind: "callClosed", callId: "call.alex" }], objectives: ["obj.answer-or-decline"] },
  {
    id: "act.2",
    title: "Act 2",
    enterWhen: [{ kind: "callClosed", callId: "call.alex" }],
    exitWhen: [{ kind: "flag", flag: "notification_handled" }],
    objectives: ["obj.check-laptop"],
  },
  {
    id: "act.3",
    title: "Act 3",
    enterWhen: [{ kind: "flag", flag: "notification_handled" }],
    exitWhen: [{ kind: "callRang", callId: "call.recovery" }],
    objectives: ["obj.investigate"],
  },
  {
    id: "act.4",
    title: "Act 4",
    enterWhen: [{ kind: "callRang", callId: "call.recovery" }],
    exitWhen: [{ kind: "callClosed", callId: "call.recovery" }],
    objectives: ["obj.answer-recovery"],
  },
  {
    id: "act.5",
    title: "Act 5",
    enterWhen: [{ kind: "callClosed", callId: "call.recovery" }],
    exitWhen: [{ kind: "outcomeSet" }],
    objectives: ["obj.decide", "obj.review"],
  },
];

function keyed<T extends { id: string }, K extends string>(items: T[]): Record<K, T> {
  const record: Record<string, T> = {};
  for (const item of items) record[item.id] = item;
  return record as Record<K, T>;
}

export const FIXTURE_SCENARIO: ScenarioDefinition = {
  id: "chapter-1",
  title: "Fixture scenario",
  subtitle: "Core tests only",
  objectives: full<Record<ObjectiveId, ScenarioDefinition["objectives"][ObjectiveId]>>({
    "obj.answer-or-decline": {
      id: "obj.answer-or-decline",
      text: "Answer or decline the call.",
      activateWhen: [],
      completeWhen: [{ kind: "callClosed", callId: "call.alex" }],
    },
    "obj.check-laptop": {
      id: "obj.check-laptop",
      text: "Check the laptop.",
      activateWhen: [{ kind: "callClosed", callId: "call.alex" }],
      completeWhen: [{ kind: "flag", flag: "notification_handled" }],
      hint: "Look at the notification.",
    },
    "obj.investigate": {
      id: "obj.investigate",
      text: "Compare what you found.",
      activateWhen: [{ kind: "flag", flag: "notification_handled" }],
      completeWhen: [{ kind: "deductionRecorded", deductionId: "ded.same-source" }],
    },
    "obj.answer-recovery": {
      id: "obj.answer-recovery",
      text: "Deal with the second call.",
      activateWhen: [{ kind: "callRang", callId: "call.recovery" }],
      completeWhen: [{ kind: "callClosed", callId: "call.recovery" }],
    },
    "obj.decide": {
      id: "obj.decide",
      text: "Decide what to do.",
      activateWhen: [{ kind: "callClosed", callId: "call.recovery" }],
      completeWhen: [{ kind: "outcomeSet" }],
    },
    "obj.review": {
      id: "obj.review",
      text: "Review the case.",
      activateWhen: [{ kind: "outcomeSet" }],
      completeWhen: [{ kind: "objectiveCompleted", objectiveId: "obj.decide" }],
    },
  }),
  interactables: full<ScenarioDefinition["interactables"]>({
    "obj.receipts": {
      id: "obj.receipts",
      label: "Paper statement",
      actionLabel: "read",
      inspectionText: "The statement lists northgate-bank.example and no open case.",
      produces: { type: "INTERACT_OBJECT" },
      reveals: ["ev.account-activity"],
    },
  }),
  claims: full<Record<ClaimId, { id: ClaimId; text: string }>>({
    "claim.alex-identity": { id: "claim.alex-identity", text: "The caller is from the bank." },
    "claim.notification-genuine": { id: "claim.notification-genuine", text: "The notification is from the bank." },
    "claim.recovery-needed": { id: "claim.recovery-needed", text: "Funds must be moved." },
    "claim.claims-independent": { id: "claim.claims-independent", text: "The two messages are independent." },
  }),
  evidence: keyed<EvidenceItem, EvidenceId>(evidence),
  warningSigns: full<ScenarioDefinition["warningSigns"]>({
    "ws.urgency": { id: "ws.urgency", label: "Urgency", description: "The caller pushes for quick action." },
    "ws.unverified-sender": { id: "ws.unverified-sender", label: "Unverified sender", description: "The sender is not confirmed." },
    "ws.shared-case-id": { id: "ws.shared-case-id", label: "Shared case number", description: "Two messages quote one number." },
  }),
  journalNotes: [
    {
      id: "note.both-found",
      requires: ["ev.alex-statement", "ev.shared-case-id"],
      text: "Both messages quote the same case number.",
    },
  ],
  calls: keyed(calls),
  npcs: full<ScenarioDefinition["npcs"]>({}),
  dialogues: full<ScenarioDefinition["dialogues"]>({
    "dlg.alex": alexGraph,
    "dlg.recovery": recoveryGraph,
    "dlg.official-line": officialGraph,
  }),
  phone: {
    messages: full<ScenarioDefinition["phone"]["messages"]>({}),
    contacts: [{ name: "Northgate Bank", number: "+000 0100 0800" }],
    officialWebsite: "northgate-bank.example",
    bankApp: { title: "Northgate app", screens: [{ id: "screen.home", title: "Home", body: "No open case." }] },
  },
  decisions: keyed<DecisionDef, DecisionId>(decisions),
  endings: keyed<EndingDef, OutcomeId>(endings),
  debrief: {
    mechanism: "A caller and a notification repeat one story to look independent.",
    saferAlternatives: ["Use a contact you saved before the call."],
    outcomeSummaries: {
      "false-victory": "Funds moved.",
      "perfect-chain": "Chain identified and verified.",
      "break-the-chain": "Stopped without verifying.",
      "unfinished-case": "Case left open.",
    },
    decisionNotes: {
      "shared-code": "A code was shared.",
      "refused-code": "You refused to share the code.",
      "hung-up": "You hung up on the caller.",
      refused: "You refused and stopped.",
      "notification-mismatch": "You compared the notification with your statement.",
      "inspected-origin": "You checked who sent the notification.",
      "same-source": "You linked two messages to one source.",
      verified: "You verified with a saved contact.",
      "followed-recovery": "You followed the second caller.",
    },
    analysis: {
      pressureBuilt: "The first caller used a deadline and a code request.",
      whyWarningLooked: "The warning quoted the same case number as the call.",
      thirdCallerNote: "The second caller repeated the same story and added no independent proof.",
      trapNotes: {
        none: "You entered neither trap.",
        first: "You shared the code in the first call.",
        second: "You trusted the second caller.",
        both: "You shared the code and then trusted the second caller.",
      },
      verifyNextTime: ["Use a contact you saved before the call.", "Check where a warning came from."],
    },
  },
  acts,
  sources: keyed(sources),
  deductions: keyed(deductions),
  deviceActions: keyed(deviceActions),
  beats: [
    {
      id: "beat.notification",
      when: [{ kind: "callClosed", callId: "call.alex" }, { kind: "notFlag", flag: "notification_delivered" }],
      effects: [{ kind: "setFlag", flag: "notification_delivered" }],
    },
  ],
};

// ---------------------------------------------------------------------------
// State builders
// ---------------------------------------------------------------------------

/** Returns a copy of `state` with the listed flags set to true. */
export function withFlags(state: ChapterState, flags: readonly FlagId[]): ChapterState {
  const next = { ...state.flags };
  for (const flag of flags) next[flag] = true;
  return { ...state, flags: next };
}

/** Returns a copy of `state` with the evidence appended in order, no duplicates. */
export function withEvidence(state: ChapterState, ids: readonly EvidenceId[]): ChapterState {
  const discovered = [...state.discovered];
  for (const id of ids) if (!discovered.includes(id)) discovered.push(id);
  return { ...state, discovered };
}

/** A `playing` state with the given fields replaced. */
export function fixtureState(partial: Partial<ChapterState> = {}): ChapterState {
  return { ...createInitialState(FIXTURE_SCENARIO), status: "playing", ...partial };
}
