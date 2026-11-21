// Scenario validator: checks Scenario_Data for broken references, unreachable dialogue and
// conditions that can never be true.
// Pure TypeScript: no React, Three.js, R3F, Drei, Rapier, Zustand or Dexie imports.
// See design.md, "Content validator" (checks V1, V3 static part, V4 static part), and
// Requirements 9.8, 9.9, 9.10, 12.6, 13.
//
// `validateScenarioIssues` returns structured issues `{ check, where, message }`.
// `validateScenario` returns the same issues as one message string each; an empty array means
// the data passed every check. Neither function throws on bad input, so tests can feed broken
// fixtures.
//
// Checks implemented here:
// - V1 References: every reference exists, node IDs are unique across graphs, option IDs are
//   unique, Spoken_Nodes have a tone and a known speaker, `pauseBeforeMs` is 0 to 3000, acts
//   reference known objectives and conditions.
// - V3 Shape (static part): no node that cannot reach an end (this also covers every cycle without
//   an exit), every pressure node reaches an end within three option steps, no node has more than
//   four unconditional options.
// - V4 Impossible conditions (static part): a flag no effect sets, evidence with no discovery, a
//   claim status nothing produces, `callEnded` or `callRang` for a call without a graph.
// - Double-deception rules (design.md "Validator and reachability"):
//   V1 every reference in sources, deductions, device actions, beats, ring rules, objectives,
//      decisions and endings exists; `setClaimStatus` only in `independentChannel` graphs or in
//      deduction effects with status `inconclusive`; a deduction basis holds against the source
//      identifiers of its inputs.
//   V3 beats settle within `MAX_BEAT_PASSES` passes; no dialogue node needs a harmful option to
//      reach an end and at least one decision is harmless (no layer needs harm to advance);
//      endings are total over decisions; every objective has a non-empty `completeWhen`.
//   V4 no evidence is discoverable only after a deduction that needs it; every incoming call has a
//      `ringWhen` alternative that can hold.
// The solver-based parts of V2, V3 and V4 live in `reachability.ts`.

import { MAX_BEAT_PASSES } from "./beats";
import { validateDeviceContent } from "./device";
import { validateWorldContent } from "./world";
import {
  ACT_IDS,
  FLAG_IDS,
  SPEAKER_IDS,
  TONE_IDS,
  VERIFY_METHODS,
} from "./chapter1/ids";
import type {
  Condition,
  DialogueGraph,
  DialogueNode,
  DiscoveryCondition,
  Effect,
  NpcDef,
  ScenarioDefinition,
} from "./types";

/** Option ID the dialogue engine adds when a node has no available option (Requirement 9.4). */
export const FALLBACK_OPTION_ID = "__fallback.end";

/** The static checks of this module. */
export type ValidatorCheck = "V1" | "V3" | "V4";

export interface ScenarioIssue {
  check: ValidatorCheck;
  /** The place of the problem, for example `Dialogue graph "dlg.scam-call" node "scam.open"`. */
  where: string;
  /** The full sentence, including the place. */
  message: string;
}

/** Highest `pauseBeforeMs` the validator accepts. */
export const MAX_PAUSE_BEFORE_MS = 3000;
/** Most unconditional options a node may have. */
export const MAX_UNCONDITIONAL_OPTIONS = 4;
/** A pressure node must reach an end within this many option steps. */
export const MAX_PRESSURE_STEPS_TO_END = 3;

const KNOWN_FLAGS: ReadonlySet<string> = new Set(FLAG_IDS);
const KNOWN_VERIFY_METHODS: ReadonlySet<string> = new Set(VERIFY_METHODS);
const KNOWN_SPEAKERS: ReadonlySet<string> = new Set(SPEAKER_IDS);
const KNOWN_TONES: ReadonlySet<string> = new Set(TONE_IDS);
const KNOWN_ACTS: ReadonlySet<string> = new Set(ACT_IDS);

/** Flags the reducer sets itself, outside any scenario effect (declining or hanging up call.alex). */
const ENGINE_FLAGS: ReadonlySet<string> = new Set(["first_call_rejected"]);
/** Claim statuses the reducer sets itself (bank-app verification), as `claimId|status`. */
const ENGINE_CLAIM_STATUSES: ReadonlySet<string> = new Set(["claim.recovery-needed|inconclusive"]);

/** Flags that record a harmful player choice. An option or decision that sets one is harmful. */
export const HARMFUL_FLAGS: ReadonlySet<string> = new Set(["code_shared", "second_caller_trusted", "money_moved"]);

const SOURCE_IDENTIFIER_KEYS: ReadonlySet<string> = new Set(["case", "contact", "domain", "app", "callerId"]);

interface RefSets {
  evidence: ReadonlySet<string>;
  claims: ReadonlySet<string>;
  objects: ReadonlySet<string>;
  calls: ReadonlySet<string>;
  messages: ReadonlySet<string>;
  decisions: ReadonlySet<string>;
  dialogues: ReadonlySet<string>;
  npcs: ReadonlySet<string>;
  objectives: ReadonlySet<string>;
  sources: ReadonlySet<string>;
  deductions: ReadonlySet<string>;
  deviceActions: ReadonlySet<string>;
}

/** What can produce each condition input, built once from the whole scenario. */
interface Producers {
  flags: ReadonlySet<string>;
  /** `claimId|status` pairs that an effect or the reducer can produce. */
  claimStatuses: ReadonlySet<string>;
  evidence: ReadonlySet<string>;
  /** Calls that exist and have a dialogue graph. */
  callsWithGraph: ReadonlySet<string>;
}

type Issues = ScenarioIssue[];

export function validateScenario(scenario: ScenarioDefinition): string[] {
  return validateScenarioIssues(scenario).map((issue) => issue.message);
}

export function validateScenarioIssues(scenario: ScenarioDefinition): ScenarioIssue[] {
  const issues: Issues = [];
  try {
    runChecks(issues, scenario);
    for (const message of validateWorldContent(scenario)) add(issues, "V1", "World", message);
    for (const message of validateDeviceContent(scenario)) add(issues, "V1", "Device", message);
  } catch (error) {
    // Bad input must produce an issue, never an exception.
    add(
      issues,
      "V1",
      "Scenario",
      `Scenario could not be validated: ${error instanceof Error ? error.message : String(error)}.`,
    );
  }
  return issues;
}

function add(issues: Issues, check: ValidatorCheck, where: string, message: string): void {
  issues.push({ check, where, message });
}

/** Collections a playable scenario cannot be without (non-empty records, plus a non-empty `acts` list). */
const REQUIRED_RECORDS = ["objectives", "dialogues", "decisions", "endings"] as const;

function isPlainRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

/**
 * Root shape. Without it a junk value (`{}`, `[]`, `"x"`, `42`) produced no issue at all and
 * passed as a valid scenario (found by the scenario-validation properties, Requirement 3.1).
 * Returns false when nothing else can be checked.
 */
function checkRoot(errors: Issues, scenario: unknown): boolean {
  if (!isPlainRecord(scenario)) {
    const kind = scenario === null ? "null" : Array.isArray(scenario) ? "an array" : typeof scenario;
    add(errors, "V1", "Scenario", `Scenario must be an object, got ${kind}.`);
    return false;
  }
  for (const key of REQUIRED_RECORDS) {
    const value = scenario[key];
    if (!isPlainRecord(value) || Object.keys(value).length === 0) {
      add(errors, "V1", "Scenario", `Scenario has no ${key}; it needs at least one.`);
    }
  }
  if (!Array.isArray(scenario.acts) || scenario.acts.length === 0) {
    add(errors, "V1", "Scenario", "Scenario has no acts; it needs at least one.");
  }
  return true;
}

function runChecks(errors: Issues, scenario: ScenarioDefinition): void {
  if (!checkRoot(errors, scenario)) return;
  const dialogues = scenario.dialogues ?? {};
  const graphs = Object.values(dialogues);
  const refs: RefSets = {
    evidence: new Set(Object.keys(scenario.evidence ?? {})),
    claims: new Set(Object.keys(scenario.claims ?? {})),
    objects: new Set(Object.keys(scenario.interactables ?? {})),
    calls: new Set(Object.keys(scenario.calls ?? {})),
    messages: new Set(Object.keys(scenario.phone?.messages ?? {})),
    decisions: new Set(Object.keys(scenario.decisions ?? {})),
    dialogues: new Set(Object.keys(dialogues)),
    npcs: new Set(Object.keys(scenario.npcs ?? {})),
    objectives: new Set(Object.keys(scenario.objectives ?? {})),
    sources: new Set(Object.keys(scenario.sources ?? {})),
    deductions: new Set(Object.keys(scenario.deductions ?? {})),
    deviceActions: new Set(Object.keys(scenario.deviceActions ?? {})),
  };
  const producers = collectProducers(scenario, refs);
  // A tag counts as having text only when its decision note is a non-empty string.
  const debriefTags = new Set(
    Object.entries(scenario.debrief?.decisionNotes ?? {})
      .filter(([, text]) => typeof text === "string" && text.trim().length > 0)
      .map(([tag]) => tag),
  );

  // Record keys must match the item `id`.
  checkRecordKeys(errors, "objective", scenario.objectives);
  checkRecordKeys(errors, "interactable", scenario.interactables);
  checkRecordKeys(errors, "claim", scenario.claims);
  checkRecordKeys(errors, "evidence", scenario.evidence);
  checkRecordKeys(errors, "warning sign", scenario.warningSigns);
  checkRecordKeys(errors, "call", scenario.calls);
  checkRecordKeys(errors, "NPC", scenario.npcs);
  checkRecordKeys(errors, "dialogue graph", scenario.dialogues);
  checkRecordKeys(errors, "message", scenario.phone?.messages);
  checkRecordKeys(errors, "decision", scenario.decisions);
  checkRecordKeys(errors, "ending", scenario.endings);
  checkRecordKeys(errors, "source", scenario.sources);
  checkRecordKeys(errors, "deduction", scenario.deductions);
  checkRecordKeys(errors, "device action", scenario.deviceActions);

  // Duplicate IDs in arrays.
  checkDuplicates(errors, "journal note", (scenario.journalNotes ?? []).map((n) => n.id));
  checkDuplicates(errors, "bank app screen", (scenario.phone?.bankApp?.screens ?? []).map((s) => s.id));
  for (const ending of Object.values(scenario.endings ?? {})) {
    checkDuplicates(errors, `ending "${ending.id}" variant`, (ending.variants ?? []).map((v) => v.id));
  }

  // Interactables.
  for (const item of Object.values(scenario.interactables ?? {})) {
    const where = `Interactable "${item.id}"`;
    for (const evidenceId of item.reveals ?? []) {
      if (!refs.evidence.has(evidenceId)) {
        add(errors, "V1", where, `${where} reveals unknown evidence "${evidenceId}".`);
      }
    }
    if (item.produces?.type === "TALK_TO_NPC" && !refs.npcs.has(item.produces.npcId)) {
      add(errors, "V1", where, `${where} talks to unknown NPC "${item.produces.npcId}".`);
    }
  }

  // Evidence.
  const allNodeIds = new Set<string>();
  for (const graph of graphs) {
    for (const nodeId of Object.keys(graph.nodes ?? {})) allNodeIds.add(nodeId);
  }
  const warningSigns = new Set(Object.keys(scenario.warningSigns ?? {}));
  for (const item of Object.values(scenario.evidence ?? {})) {
    const where = `Evidence "${item.id}"`;
    checkDiscovery(errors, where, item, refs, producers, allNodeIds, scenario);
    if (!refs.sources.has(item.sourceId)) {
      add(errors, "V1", where, `${where} references unknown source "${String(item.sourceId)}".`);
    }
    for (const relation of item.relations ?? []) {
      if (!refs.claims.has(relation.claimId)) {
        add(errors, "V1", where, `${where} relates to unknown claim "${relation.claimId}".`);
      }
    }
    for (const sign of item.warningSigns ?? []) {
      if (!warningSigns.has(sign)) {
        add(errors, "V1", where, `${where} references unknown warning sign "${sign}".`);
      }
    }
  }

  // Journal notes.
  for (const note of scenario.journalNotes ?? []) {
    for (const evidenceId of note.requires ?? []) {
      if (!refs.evidence.has(evidenceId)) {
        const where = `Journal note "${note.id}"`;
        add(errors, "V1", where, `${where} requires unknown evidence "${evidenceId}".`);
      }
    }
  }

  // Calls and NPCs.
  for (const call of Object.values(scenario.calls ?? {})) {
    if (!refs.dialogues.has(call.graphId)) {
      const where = `Call "${call.id}"`;
      add(errors, "V1", where, `${where} uses unknown dialogue graph "${call.graphId}".`);
    }
  }
  for (const npc of Object.values(scenario.npcs ?? {}) as NpcDef[]) {
    const where = `NPC "${npc.id}"`;
    if (!refs.objects.has(npc.interactableId)) {
      add(errors, "V1", where, `${where} uses unknown object "${npc.interactableId}".`);
    }
    if (!refs.dialogues.has(npc.graphId)) {
      add(errors, "V1", where, `${where} uses unknown dialogue graph "${npc.graphId}".`);
    }
  }

  // Phone messages.
  for (const message of Object.values(scenario.phone?.messages ?? {})) {
    if (!refs.evidence.has(message.evidenceId)) {
      const where = `Message "${message.id}"`;
      add(errors, "V1", where, `${where} records unknown evidence "${message.evidenceId}".`);
    }
  }

  // Node IDs must be unique across all graphs: voice clip IDs are node IDs.
  const nodeOwners = new Map<string, string>();
  for (const graph of graphs) {
    for (const key of Object.keys(graph.nodes ?? {})) {
      const owner = nodeOwners.get(key);
      if (owner !== undefined) {
        const where = `Dialogue node "${key}"`;
        add(errors, "V1", where, `Duplicate dialogue node ID "${key}" (in graphs "${owner}" and "${graph.id}").`);
      } else {
        nodeOwners.set(key, graph.id);
      }
    }
  }

  // Dialogue graphs. Option IDs must be unique across all graphs, because
  // SELECT_DIALOGUE_OPTION names an option by ID only.
  const optionOwners = new Map<string, string>();
  for (const graph of graphs) {
    validateGraph(errors, graph, refs, producers, debriefTags, optionOwners);
  }

  // Decisions.
  for (const decision of Object.values(scenario.decisions ?? {})) {
    const where = `Decision "${decision.id}"`;
    checkConditions(errors, where, decision.requires ?? [], refs, producers);
    checkEffects(errors, where, decision.effects ?? [], "none", refs);
    if (decision.preStep) {
      checkConditions(errors, `${where} pre-step`, decision.preStep.requires ?? [], refs, producers);
      if (!refs.claims.has(decision.preStep.claimId)) {
        add(errors, "V1", where, `${where} pre-step references unknown claim "${decision.preStep.claimId}".`);
      }
      if (!KNOWN_VERIFY_METHODS.has(decision.preStep.method)) {
        add(errors, "V1", where, `${where} pre-step uses unknown verify method "${decision.preStep.method}".`);
      }
    }
    checkDebriefTag(errors, where, decision.debriefTag, debriefTags);
  }

  // Endings and debrief.
  for (const ending of Object.values(scenario.endings ?? {})) {
    for (const variant of ending.variants ?? []) {
      checkConditions(errors, `Ending "${ending.id}" variant "${variant.id}"`, variant.when ?? [], refs, producers);
    }
    checkConditions(errors, `Ending "${ending.id}" selection`, ending.selectWhen ?? [], refs, producers);
    checkConditions(errors, `Ending "${ending.id}" unlock`, ending.unlockWhen ?? [], refs, producers);
  }
  const outcomeIds = new Set(Object.keys(scenario.endings ?? {}));
  const outcomeSummaries = scenario.debrief?.outcomeSummaries ?? {};
  for (const outcomeId of Object.keys(outcomeSummaries)) {
    if (!outcomeIds.has(outcomeId)) {
      add(errors, "V1", `Debrief outcome summary "${outcomeId}"`, `Debrief outcome summary "${outcomeId}" has no ending.`);
    }
  }
  for (const outcomeId of outcomeIds) {
    if (!(outcomeId in outcomeSummaries)) {
      add(errors, "V1", `Ending "${outcomeId}"`, `Ending "${outcomeId}" has no debrief outcome summary.`);
    }
  }

  checkActs(errors, scenario, refs, producers);
  checkObjectives(errors, scenario, refs, producers);
  checkSources(errors, scenario);
  checkDeductions(errors, scenario, refs, producers, debriefTags);
  checkDeviceActions(errors, scenario, refs, producers, debriefTags);
  checkBeats(errors, scenario, refs, producers);
  checkRingRules(errors, scenario, refs, producers);
  checkEvidenceGating(errors, scenario);
  checkNoHarmRequired(errors, scenario);
  checkEndingsTotal(errors, scenario, refs);
}

// ---------------------------------------------------------------------------
// Producers (V4 static)
// ---------------------------------------------------------------------------

function collectProducers(scenario: ScenarioDefinition, refs: RefSets): Producers {
  const flags = new Set<string>(ENGINE_FLAGS);
  const claimStatuses = new Set<string>(ENGINE_CLAIM_STATUSES);
  const evidence = new Set<string>();

  // Every claim starts as "unverified".
  for (const claimId of refs.claims) claimStatuses.add(`${claimId}|unverified`);

  const visit = (effects: Effect[] | undefined): void => {
    for (const effect of effects ?? []) {
      if (effect.kind === "setFlag") flags.add(effect.flag);
      else if (effect.kind === "setClaimStatus") claimStatuses.add(`${effect.claimId}|${effect.status}`);
      else if (effect.kind === "discoverEvidence") evidence.add(effect.evidenceId);
    }
  };
  for (const graph of Object.values(scenario.dialogues ?? {})) {
    for (const node of Object.values(graph.nodes ?? {})) {
      visit(node.onEnter);
      for (const option of node.options ?? []) visit(option.effects);
    }
  }
  for (const deduction of Object.values(scenario.deductions ?? {})) visit(deduction.effects);
  for (const action of Object.values(scenario.deviceActions ?? {})) {
    visit(action.effects);
    for (const id of action.reveals ?? []) evidence.add(id);
  }
  for (const beat of scenario.beats ?? []) visit(beat.effects);
  for (const decision of Object.values(scenario.decisions ?? {})) visit(decision.effects);
  for (const item of Object.values(scenario.interactables ?? {})) {
    for (const id of item.reveals ?? []) evidence.add(id);
  }
  for (const message of Object.values(scenario.phone?.messages ?? {})) evidence.add(message.evidenceId);
  // Evidence with a resolvable discovery rule of its own can be discovered by the reducer.
  const nodeIds = new Set<string>();
  for (const graph of Object.values(scenario.dialogues ?? {})) {
    for (const nodeId of Object.keys(graph.nodes ?? {})) nodeIds.add(nodeId);
  }
  for (const item of Object.values(scenario.evidence ?? {})) {
    const d = item.discovery;
    if (!d) continue;
    if (
      d.via === "inspect" ||
      (d.via === "interact" && refs.objects.has(d.objectId)) ||
      (d.via === "dialogue-node" && nodeIds.has(d.nodeId)) ||
      (d.via === "verify" && KNOWN_VERIFY_METHODS.has(d.method))
    ) {
      evidence.add(item.id);
    }
  }

  const callsWithGraph = new Set<string>();
  for (const call of Object.values(scenario.calls ?? {})) {
    if (refs.dialogues.has(call.graphId)) callsWithGraph.add(call.id);
  }
  return { flags, claimStatuses, evidence, callsWithGraph };
}

// ---------------------------------------------------------------------------
// Graphs
// ---------------------------------------------------------------------------

function validateGraph(
  errors: Issues,
  graph: DialogueGraph,
  refs: RefSets,
  producers: Producers,
  debriefTags: ReadonlySet<string>,
  optionOwners: Map<string, string>,
): void {
  const g = `Dialogue graph "${graph.id}"`;
  const nodes = graph.nodes ?? {};
  const lines = graph.lines ?? {};
  const hasNode = (id: string): boolean => Object.prototype.hasOwnProperty.call(nodes, id);
  const hasLine = (id: string): boolean => Object.prototype.hasOwnProperty.call(lines, id);

  checkRecordKeys(errors, `${g} node`, nodes);

  // Start references (Requirement 9.8).
  if (!hasNode(graph.startNodeId)) {
    add(errors, "V1", g, `${g} start node "${graph.startNodeId}" does not exist.`);
  }
  for (const entry of graph.startNodeWhen ?? []) {
    if (!hasNode(entry.nodeId)) {
      add(errors, "V1", g, `${g} conditional start node "${entry.nodeId}" does not exist.`);
    }
    checkConditions(errors, `${g} conditional start "${entry.nodeId}"`, entry.when ?? [], refs, producers);
  }

  for (const [key, node] of Object.entries(nodes)) {
    const n = `${g} node "${key}"`;
    const options = node.options ?? [];
    // Approved line IDs (Requirement 9.10).
    if (!hasLine(node.lineId)) add(errors, "V1", n, `${n} uses unknown line "${node.lineId}".`);
    checkSpokenNode(errors, n, node, graph);
    checkEffects(errors, n, node.onEnter ?? [], graphClaimPolicy(graph), refs);
    if (node.end) {
      checkDebriefTag(errors, n, node.end.debriefTag, debriefTags);
      if (options.length > 0) add(errors, "V1", n, `${n} is an end node but has options.`);
    }

    const unconditional = options.filter((option) => (option.conditions ?? []).length === 0).length;
    if (unconditional > MAX_UNCONDITIONAL_OPTIONS) {
      add(
        errors,
        "V3",
        n,
        `${n} has ${unconditional} unconditional options; the most allowed is ${MAX_UNCONDITIONAL_OPTIONS}.`,
      );
    }

    for (const option of options) {
      const o = `${g} option "${option.id}"`;
      if (option.id === FALLBACK_OPTION_ID) {
        add(errors, "V1", o, `${o} uses the reserved fallback option ID.`);
      }
      const owner = optionOwners.get(option.id);
      if (owner !== undefined) {
        add(
          errors,
          "V1",
          o,
          `Duplicate option ID "${option.id}" (in ${owner} and node "${key}" of "${graph.id}").`,
        );
      } else {
        optionOwners.set(option.id, `node "${key}" of "${graph.id}"`);
      }
      if (!hasLine(option.lineId)) add(errors, "V1", o, `${o} uses unknown line "${option.lineId}".`);
      if (typeof option.next === "string" && !hasNode(option.next)) {
        add(errors, "V1", o, `${o} points to unknown node "${option.next}".`);
      }
      checkConditions(errors, o, option.conditions ?? [], refs, producers);
      checkEffects(errors, o, option.effects ?? [], graphClaimPolicy(graph), refs);
      checkDebriefTag(errors, o, option.debriefTag, debriefTags);
    }
  }

  // Nodes from which no end is reachable (Requirement 9.9). An end node, or an option that ends
  // the conversation directly, counts as an end. Conditions are ignored: this is a static check.
  // A cycle with no exit is exactly a set of nodes that cannot reach an end, so this one check
  // reports both failures.
  const canEnd = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, node] of Object.entries(nodes)) {
      if (canEnd.has(key)) continue;
      const ends =
        node.end !== undefined ||
        (node.options ?? []).some((option) =>
          typeof option.next === "string" ? canEnd.has(option.next) : true,
        );
      if (ends) {
        canEnd.add(key);
        changed = true;
      }
    }
  }
  for (const key of Object.keys(nodes)) {
    if (!canEnd.has(key)) {
      const n = `${g} node "${key}"`;
      add(errors, "V3", n, `${n} cannot reach an end node.`);
    }
  }

  // Pressure nodes reach an end within three option steps (shortest static path).
  const steps = stepsToEnd(nodes);
  for (const [key, node] of Object.entries(nodes)) {
    if (node.pressure !== true || !canEnd.has(key)) continue;
    const count = steps.get(key);
    if (count !== undefined && count > MAX_PRESSURE_STEPS_TO_END) {
      const n = `${g} node "${key}"`;
      add(
        errors,
        "V3",
        n,
        `${n} is a pressure node that needs ${count} option steps to reach an end; the most allowed is ${MAX_PRESSURE_STEPS_TO_END}.`,
      );
    }
  }
}

/** Fewest option steps from each node to an end. An end node needs 0, a hang-up option needs 1. */
function stepsToEnd(nodes: Record<string, DialogueNode>): Map<string, number> {
  const steps = new Map<string, number>();
  for (const [key, node] of Object.entries(nodes)) {
    if (node.end !== undefined) steps.set(key, 0);
  }
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, node] of Object.entries(nodes)) {
      let best = steps.get(key) ?? Infinity;
      for (const option of node.options ?? []) {
        const via = typeof option.next === "string" ? (steps.get(option.next) ?? Infinity) + 1 : 1;
        if (via < best) best = via;
      }
      if (best !== (steps.get(key) ?? Infinity)) {
        steps.set(key, best);
        changed = true;
      }
    }
  }
  return steps;
}

function checkSpokenNode(errors: Issues, where: string, node: DialogueNode, graph: DialogueGraph): void {
  if (node.pauseBeforeMs !== undefined) {
    const p = node.pauseBeforeMs;
    if (typeof p !== "number" || !Number.isFinite(p) || p < 0 || p > MAX_PAUSE_BEFORE_MS) {
      add(
        errors,
        "V1",
        where,
        `${where} has pauseBeforeMs ${String(p)}; it must be a number from 0 to ${MAX_PAUSE_BEFORE_MS}.`,
      );
    }
  }
  if (node.speakerId !== undefined && !KNOWN_SPEAKERS.has(node.speakerId)) {
    add(errors, "V1", where, `${where} references unknown speaker "${node.speakerId}".`);
  }
  if (node.speaker !== "caller" && node.speaker !== "npc") return;
  // Spoken_Node from here on.
  if (node.tone === undefined) {
    add(errors, "V1", where, `${where} is spoken but has no tone.`);
  } else if (!KNOWN_TONES.has(node.tone)) {
    add(errors, "V1", where, `${where} references unknown tone "${node.tone}".`);
  }
  const effective = node.speakerId ?? graph.persona?.speakerId;
  if (effective === undefined || !KNOWN_SPEAKERS.has(effective)) {
    add(errors, "V1", where, `${where} has no known speaker (speakerId "${String(effective)}").`);
  }
}

// ---------------------------------------------------------------------------
// Acts
// ---------------------------------------------------------------------------

function checkActs(errors: Issues, scenario: ScenarioDefinition, refs: RefSets, producers: Producers): void {
  const acts = scenario.acts ?? [];
  checkDuplicates(errors, "act", acts.map((a) => a.id));
  const owners = new Map<string, string[]>();
  acts.forEach((act, index) => {
    const where = `Act "${act.id}"`;
    if (!KNOWN_ACTS.has(act.id)) add(errors, "V1", where, `${where} is not a known act ID.`);
    if (typeof act.title !== "string" || act.title.trim().length === 0) {
      add(errors, "V1", where, `${where} has no title.`);
    }
    checkConditions(errors, `${where} enter`, act.enterWhen ?? [], refs, producers);
    checkConditions(errors, `${where} exit`, act.exitWhen ?? [], refs, producers);
    for (const objectiveId of act.objectives ?? []) {
      if (!refs.objectives.has(objectiveId)) {
        add(errors, "V1", where, `${where} references unknown objective "${objectiveId}".`);
      }
      owners.set(objectiveId, [...(owners.get(objectiveId) ?? []), act.id]);
    }
    const next = acts[index + 1];
    if (next && JSON.stringify(act.exitWhen ?? []) !== JSON.stringify(next.enterWhen ?? [])) {
      add(errors, "V1", where, `${where} exit conditions differ from the enter conditions of "${next.id}".`);
    }
  });
  if (acts.length === 0) return;
  for (const objectiveId of refs.objectives) {
    const list = owners.get(objectiveId) ?? [];
    if (list.length !== 1) {
      const where = `Objective "${objectiveId}"`;
      add(errors, "V1", where, `${where} belongs to ${list.length} acts; it must belong to exactly one.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Conditions, effects, discovery
// ---------------------------------------------------------------------------

function checkConditions(
  errors: Issues,
  where: string,
  conditions: Condition[],
  refs: RefSets,
  producers: Producers,
): void {
  for (const cond of conditions) {
    switch (cond.kind) {
      case "hasEvidence":
        checkRef(errors, where, "evidence", cond.evidenceId, refs.evidence);
        checkProducible(errors, where, `evidence "${cond.evidenceId}"`, refs.evidence.has(cond.evidenceId), producers.evidence.has(cond.evidenceId), "has no way to be discovered");
        break;
      case "hasAnyEvidence":
        for (const id of cond.evidenceIds) checkRef(errors, where, "evidence", id, refs.evidence);
        break;
      case "evidenceCountAtLeast": {
        for (const id of cond.evidenceIds) checkRef(errors, where, "evidence", id, refs.evidence);
        const distinct = new Set(cond.evidenceIds).size;
        if (cond.count > distinct) {
          add(
            errors,
            "V4",
            where,
            `${where} needs ${cond.count} evidence items but lists only ${distinct}, so it can never be true.`,
          );
        }
        break;
      }
      case "flag":
        checkRef(errors, where, "flag", cond.flag, KNOWN_FLAGS);
        checkProducible(errors, where, `flag "${cond.flag}"`, KNOWN_FLAGS.has(cond.flag), producers.flags.has(cond.flag), "is never set by any effect");
        break;
      case "notFlag":
        checkRef(errors, where, "flag", cond.flag, KNOWN_FLAGS);
        break;
      case "deductionRecorded":
        checkRef(errors, where, "deduction", cond.deductionId, refs.deductions);
        break;
      case "decisionIs":
        checkRef(errors, where, "decision", cond.decision, refs.decisions);
        break;
      case "callEnded":
      case "callRang":
      case "callClosed":
        checkRef(errors, where, "call", cond.callId, refs.calls);
        if (refs.calls.has(cond.callId) && !producers.callsWithGraph.has(cond.callId)) {
          add(
            errors,
            "V4",
            where,
            `${where} uses ${cond.kind} for call "${cond.callId}", which has no dialogue graph, so it can never be true.`,
          );
        }
        break;
      case "claimStatus":
        checkRef(errors, where, "claim", cond.claimId, refs.claims);
        checkProducible(
          errors,
          where,
          `claim "${cond.claimId}" status "${cond.status}"`,
          refs.claims.has(cond.claimId),
          producers.claimStatuses.has(`${cond.claimId}|${cond.status}`),
          "is never produced by any effect",
        );
        break;
      case "objectiveCompleted":
        checkRef(errors, where, "objective", cond.objectiveId, refs.objectives);
        break;
      case "outcomeSet":
        break;
      default:
        add(errors, "V1", where, `${where} has unknown condition kind "${(cond as { kind: string }).kind}".`);
    }
  }
}

/** Reports an impossible condition (V4) only when the reference itself exists (V1 covers the rest). */
function checkProducible(
  errors: Issues,
  where: string,
  what: string,
  referenceExists: boolean,
  producible: boolean,
  reason: string,
): void {
  if (referenceExists && !producible) {
    add(errors, "V4", where, `${where} requires ${what}, which ${reason}, so it can never be true.`);
  }
}

/**
 * Who may set a claim status (Requirement 12.6, design D7): `any` in an independent-channel
 * graph, `graph` for other dialogue graphs (never allowed), `inconclusive` for deduction effects
 * (only that status), `none` for device actions, beats and decisions.
 */
type ClaimPolicy = "any" | "graph" | "inconclusive" | "none";

function graphClaimPolicy(graph: DialogueGraph): ClaimPolicy {
  return graph.independentChannel ? "any" : "graph";
}

function checkEffects(
  errors: Issues,
  where: string,
  effects: Effect[],
  policy: ClaimPolicy,
  refs: RefSets,
): void {
  for (const effect of effects ?? []) {
    switch (effect.kind) {
      case "setFlag":
        checkRef(errors, where, "flag", effect.flag, KNOWN_FLAGS);
        break;
      case "discoverEvidence":
        checkRef(errors, where, "evidence", effect.evidenceId, refs.evidence);
        break;
      case "addPressure":
        if (policy === "inconclusive") {
          add(errors, "V1", where, `${where} adds pressure; a deduction must not change pressure.`);
        }
        break;
      case "setClaimStatus":
        // Requirement 12.6: claim statuses change only through an independent channel, or as
        // `inconclusive` through a deduction.
        if (policy === "graph") {
          add(
            errors,
            "V1",
            where,
            `${where} sets claim "${effect.claimId}" status outside an independent-channel graph.`,
          );
        } else if (policy === "none") {
          add(
            errors,
            "V1",
            where,
            `${where} sets claim "${effect.claimId}" status; only independent-channel graphs and deductions may.`,
          );
        } else if (policy === "inconclusive" && effect.status !== "inconclusive") {
          add(
            errors,
            "V1",
            where,
            `${where} sets claim "${effect.claimId}" status to "${effect.status}"; a deduction may only set "inconclusive".`,
          );
        }
        checkRef(errors, where, "claim", effect.claimId, refs.claims);
        break;
      case "recordDecision":
        checkRef(errors, where, "decision", effect.decision, refs.decisions);
        break;
      case "deliverMessage":
        checkRef(errors, where, "message", effect.messageId, refs.messages);
        break;
      default:
        add(errors, "V1", where, `${where} has unknown effect kind "${(effect as { kind: string }).kind}".`);
    }
  }
}

function checkDiscovery(
  errors: Issues,
  where: string,
  item: { id: string; discovery: DiscoveryCondition },
  refs: RefSets,
  producers: Producers,
  allNodeIds: ReadonlySet<string>,
  scenario: ScenarioDefinition,
): void {
  const discovery = item.discovery;
  switch (discovery?.via) {
    case "device":
      checkRef(errors, where, "device action", discovery.deviceActionId, refs.deviceActions);
      if (
        refs.deviceActions.has(discovery.deviceActionId) &&
        !(scenario.deviceActions[discovery.deviceActionId].reveals ?? []).includes(item.id as never)
      ) {
        add(
          errors,
          "V1",
          where,
          `${where} is discovered through device action "${discovery.deviceActionId}", which does not list it in reveals.`,
        );
      }
      break;
    case "interact":
      checkRef(errors, where, "object", discovery.objectId, refs.objects);
      break;
    case "inspect":
      checkConditions(errors, where, discovery.requires ?? [], refs, producers);
      break;
    case "dialogue-node":
      checkRef(errors, where, "dialogue node", discovery.nodeId, allNodeIds);
      break;
    case "verify":
      checkRef(errors, where, "verify method", discovery.method, KNOWN_VERIFY_METHODS);
      break;
    default:
      add(errors, "V1", where, `${where} has unknown discovery kind "${String((discovery as { via?: string } | undefined)?.via)}".`);
  }
}

function checkRef(
  errors: Issues,
  where: string,
  kind: string,
  id: string,
  known: ReadonlySet<string>,
): void {
  if (!known.has(id)) add(errors, "V1", where, `${where} references unknown ${kind} "${id}".`);
}

function checkDebriefTag(
  errors: Issues,
  where: string,
  tag: string | undefined,
  known: ReadonlySet<string>,
): void {
  if (tag === undefined) return;
  if (!known.has(tag)) {
    add(errors, "V1", where, `${where} uses debrief tag "${tag}" with no decision note text.`);
  }
}

function checkRecordKeys(
  errors: Issues,
  kind: string,
  record: Record<string, { id: string }> | undefined,
): void {
  for (const [key, item] of Object.entries(record ?? {})) {
    if (item.id !== key) {
      add(errors, "V1", `The ${kind} "${key}"`, `The ${kind} stored under key "${key}" has id "${item.id}".`);
    }
  }
}

function checkDuplicates(errors: Issues, kind: string, ids: string[]): void {
  const seen = new Set<string>();
  for (const id of ids) {
    if (seen.has(id)) add(errors, "V1", `${kind} "${id}"`, `Duplicate ${kind} ID "${id}".`);
    seen.add(id);
  }
}

// ---------------------------------------------------------------------------
// Double-deception rules: objectives, sources, deductions, device actions, beats, ring rules
// ---------------------------------------------------------------------------

function asList<T>(value: T[] | undefined): T[] {
  return Array.isArray(value) ? value : [];
}

/** Every objective checks its conditions, and `completeWhen` must not be empty. */
function checkObjectives(errors: Issues, scenario: ScenarioDefinition, refs: RefSets, producers: Producers): void {
  for (const objective of Object.values(scenario.objectives ?? {})) {
    const where = `Objective "${objective.id}"`;
    checkConditions(errors, `${where} activation`, asList(objective.activateWhen), refs, producers);
    checkConditions(errors, `${where} completion`, asList(objective.completeWhen), refs, producers);
    if (asList(objective.completeWhen).length === 0) {
      add(errors, "V3", where, `${where} has no completion conditions, so it would complete as soon as it is active.`);
    }
  }
}

function checkSources(errors: Issues, scenario: ScenarioDefinition): void {
  for (const source of Object.values(scenario.sources ?? {})) {
    const where = `Source "${source.id}"`;
    const seen = new Set<string>();
    for (const identifier of asList(source.identifiers)) {
      if (!SOURCE_IDENTIFIER_KEYS.has(identifier.key)) {
        add(errors, "V1", where, `${where} has unknown identifier key "${String(identifier.key)}".`);
      }
      if (seen.has(identifier.key)) {
        add(errors, "V1", where, `${where} lists identifier key "${identifier.key}" twice.`);
      }
      seen.add(identifier.key);
    }
  }
}

/** Evidence sets a deduction can be recorded with: its inputs, plus each `inputsAnyOf` member in turn. */
function deductionEvidenceSets(deduction: ScenarioDefinition["deductions"][keyof ScenarioDefinition["deductions"]]): string[][] {
  const inputs = asList(deduction.inputs) as string[];
  const anyOf = asList(deduction.inputsAnyOf) as string[];
  if (deduction.inputsAnyOf === undefined) return [inputs];
  return anyOf.map((id) => (inputs.includes(id) ? inputs : [...inputs, id]));
}

function checkDeductions(
  errors: Issues,
  scenario: ScenarioDefinition,
  refs: RefSets,
  producers: Producers,
  debriefTags: ReadonlySet<string>,
): void {
  for (const deduction of Object.values(scenario.deductions ?? {})) {
    const where = `Deduction "${deduction.id}"`;
    for (const id of [...asList(deduction.inputs), ...asList(deduction.inputsAnyOf)]) {
      checkRef(errors, where, "evidence", id, refs.evidence);
    }
    const size = asList(deduction.inputs).length + (deduction.inputsAnyOf === undefined ? 0 : 1);
    if (size < 2 || size > 3) {
      add(errors, "V1", where, `${where} combines ${size} evidence items; it needs 2 or 3.`);
    }
    checkConditions(errors, where, asList(deduction.requires), refs, producers);
    checkEffects(errors, where, asList(deduction.effects), "inconclusive", refs);
    checkDebriefTag(errors, where, deduction.debriefTag, debriefTags);
    checkDeductionBasis(errors, where, deduction, scenario);
  }
}

/** The basis of a deduction must hold in the source identifiers of its input evidence. */
function checkDeductionBasis(
  errors: Issues,
  where: string,
  deduction: ScenarioDefinition["deductions"][keyof ScenarioDefinition["deductions"]],
  scenario: ScenarioDefinition,
): void {
  const basis = deduction.basis;
  if (!basis || (basis.kind !== "shared-identifier" && basis.kind !== "conflicting-identifier")) {
    add(errors, "V1", where, `${where} has an unknown basis.`);
    return;
  }
  if (!SOURCE_IDENTIFIER_KEYS.has(basis.key)) {
    add(errors, "V1", where, `${where} basis uses unknown identifier key "${String(basis.key)}".`);
    return;
  }
  const evidence = scenario.evidence ?? {};
  const sources = scenario.sources ?? {};
  for (const set of deductionEvidenceSets(deduction)) {
    // Skip sets with a dangling reference: the reference check already reports them.
    if (set.some((id) => !Object.hasOwn(evidence, id) || !Object.hasOwn(sources, evidence[id as keyof typeof evidence].sourceId))) {
      continue;
    }
    const values: Array<string | undefined> = set.map((id) => {
      const source = sources[evidence[id as keyof typeof evidence].sourceId];
      return asList(source.identifiers).find((identifier) => identifier.key === basis.key)?.value;
    });
    const label = set.join(", ");
    if (basis.kind === "shared-identifier") {
      const missing = values.some((value) => value === undefined);
      if (missing || new Set(values).size !== 1) {
        add(
          errors,
          "V1",
          where,
          `${where} claims a shared "${basis.key}" identifier, but the sources of [${label}] do not all carry the same value.`,
        );
      }
    } else {
      const present = values.filter((value): value is string => value !== undefined);
      if (new Set(present).size < 2) {
        add(
          errors,
          "V1",
          where,
          `${where} claims conflicting "${basis.key}" identifiers, but the sources of [${label}] do not carry two different values.`,
        );
      }
    }
  }
}

function checkDeviceActions(
  errors: Issues,
  scenario: ScenarioDefinition,
  refs: RefSets,
  producers: Producers,
  debriefTags: ReadonlySet<string>,
): void {
  for (const action of Object.values(scenario.deviceActions ?? {})) {
    const where = `Device action "${action.id}"`;
    checkConditions(errors, where, asList(action.requires), refs, producers);
    checkEffects(errors, where, asList(action.effects), "none", refs);
    for (const id of asList(action.reveals)) checkRef(errors, where, "evidence", id, refs.evidence);
    checkDebriefTag(errors, where, action.debriefTag, debriefTags);
  }
}

/** Beats: references, unique IDs, and a settle depth within `MAX_BEAT_PASSES` passes. */
function checkBeats(errors: Issues, scenario: ScenarioDefinition, refs: RefSets, producers: Producers): void {
  const beats = asList(scenario.beats);
  checkDuplicates(errors, "beat", beats.map((beat) => beat.id));
  for (const beat of beats) {
    const where = `Beat "${beat.id}"`;
    checkConditions(errors, where, asList(beat.when), refs, producers);
    checkEffects(errors, where, asList(beat.effects), "none", refs);
  }

  // A beat B depends on beat A when B waits for a flag or evidence item that A produces. In one
  // pass the beats run in list order, so a dependency listed after its dependent costs one pass.
  const produces = beats.map((beat) => {
    const keys = new Set<string>();
    for (const effect of asList(beat.effects)) {
      if (effect.kind === "setFlag") keys.add(`flag:${effect.flag}`);
      else if (effect.kind === "discoverEvidence") keys.add(`evidence:${effect.evidenceId}`);
    }
    return keys;
  });
  const waitsFor = beats.map((beat) => {
    const keys = new Set<string>();
    for (const condition of asList(beat.when)) {
      if (condition.kind === "flag") keys.add(`flag:${condition.flag}`);
      else if (condition.kind === "hasEvidence") keys.add(`evidence:${condition.evidenceId}`);
    }
    return keys;
  });
  const passes = new Map<number, number>();
  const visiting = new Set<number>();
  const passesFor = (index: number): number => {
    const known = passes.get(index);
    if (known !== undefined) return known;
    if (visiting.has(index)) return 1; // A dependency cycle: those beats wait for each other and never fire.
    visiting.add(index);
    let result = 1;
    for (let other = 0; other < beats.length; other += 1) {
      if (other === index) continue;
      const depends = [...waitsFor[index]].some((key) => produces[other].has(key));
      if (!depends) continue;
      result = Math.max(result, passesFor(other) + (index < other ? 1 : 0));
    }
    visiting.delete(index);
    passes.set(index, result);
    return result;
  };
  beats.forEach((beat, index) => {
    const needed = passesFor(index);
    if (needed > MAX_BEAT_PASSES) {
      const where = `Beat "${beat.id}"`;
      add(
        errors,
        "V3",
        where,
        `${where} needs ${needed} passes to settle; the most allowed is ${MAX_BEAT_PASSES}.`,
      );
    }
  });
}

/** True when the conditions can hold together, judged from the producers alone. Returns the reason if not. */
function conditionsCannotHold(conditions: Condition[], producers: Producers, refs: RefSets): string | null {
  const flagsWanted = new Set<string>();
  const flagsForbidden = new Set<string>();
  const claimWanted = new Map<string, string>();
  const decisionsWanted = new Set<string>();
  for (const cond of conditions) {
    switch (cond.kind) {
      case "flag":
        if (KNOWN_FLAGS.has(cond.flag) && !producers.flags.has(cond.flag)) return `flag "${cond.flag}" is never set`;
        flagsWanted.add(cond.flag);
        break;
      case "notFlag":
        flagsForbidden.add(cond.flag);
        break;
      case "hasEvidence":
        if (refs.evidence.has(cond.evidenceId) && !producers.evidence.has(cond.evidenceId)) {
          return `evidence "${cond.evidenceId}" can never be discovered`;
        }
        break;
      case "claimStatus": {
        if (refs.claims.has(cond.claimId) && !producers.claimStatuses.has(`${cond.claimId}|${cond.status}`)) {
          return `claim "${cond.claimId}" is never "${cond.status}"`;
        }
        const earlier = claimWanted.get(cond.claimId);
        if (earlier !== undefined && earlier !== cond.status) {
          return `claim "${cond.claimId}" cannot be both "${earlier}" and "${cond.status}"`;
        }
        claimWanted.set(cond.claimId, cond.status);
        break;
      }
      case "callEnded":
      case "callRang":
      case "callClosed":
        if (refs.calls.has(cond.callId) && !producers.callsWithGraph.has(cond.callId)) {
          return `call "${cond.callId}" has no dialogue graph`;
        }
        break;
      case "evidenceCountAtLeast":
        if (cond.count > new Set(cond.evidenceIds).size) return "an evidence count is above the evidence listed";
        break;
      case "decisionIs":
        decisionsWanted.add(cond.decision);
        break;
      default:
        break;
    }
  }
  for (const flag of flagsWanted) {
    if (flagsForbidden.has(flag)) return `flag "${flag}" is both required and forbidden`;
  }
  if (decisionsWanted.size > 1) return "it needs two different decisions at once";
  return null;
}

/** Every incoming call needs at least one `ringWhen` alternative that can hold. */
function checkRingRules(errors: Issues, scenario: ScenarioDefinition, refs: RefSets, producers: Producers): void {
  for (const call of Object.values(scenario.calls ?? {})) {
    const where = `Call "${call.id}"`;
    const alternatives = Array.isArray(call.ringWhen) ? call.ringWhen : [];
    alternatives.forEach((all, index) => {
      checkConditions(errors, `${where} ringWhen alternative ${index + 1}`, asList(all), refs, producers);
    });
    if (call.direction !== "incoming") continue;
    if (alternatives.length === 0) {
      add(errors, "V4", where, `${where} is incoming but has no ringWhen alternative, so it can never ring.`);
      continue;
    }
    const reasons = alternatives.map((all) => conditionsCannotHold(asList(all), producers, refs));
    if (reasons.every((reason) => reason !== null)) {
      add(
        errors,
        "V4",
        where,
        `${where} has no ringWhen alternative that can hold (${reasons.join("; ")}), so it can never ring.`,
      );
    }
  }
}

// ---------------------------------------------------------------------------
// Evidence gating (no evidence only after a deduction that needs it)
// ---------------------------------------------------------------------------

interface Gate {
  /** All of these must hold. */
  deductions: string[];
  evidence: string[];
  /** Each inner list needs at least one member. */
  anyEvidence: string[][];
}

function gateOf(conditions: Condition[] | undefined): Gate {
  const gate: Gate = { deductions: [], evidence: [], anyEvidence: [] };
  for (const cond of asList(conditions)) {
    if (cond.kind === "deductionRecorded") gate.deductions.push(cond.deductionId);
    else if (cond.kind === "hasEvidence") gate.evidence.push(cond.evidenceId);
    else if (cond.kind === "hasAnyEvidence") gate.anyEvidence.push(cond.evidenceIds);
  }
  return gate;
}

/**
 * Finds evidence that can only be discovered after a deduction (or other evidence) that itself
 * needs that evidence. It solves the dependencies as a fixed point: evidence is obtainable when
 * it has an ungated route or its gate holds, a deduction is recordable when its inputs are
 * obtainable and its own gate holds.
 */
function checkEvidenceGating(errors: Issues, scenario: ScenarioDefinition): void {
  const evidence = scenario.evidence ?? {};
  const deductions = scenario.deductions ?? {};
  const actions = scenario.deviceActions ?? {};

  // Routes with no dependency on evidence or deductions.
  const ungated = new Set<string>();
  for (const item of Object.values(scenario.interactables ?? {})) for (const id of asList(item.reveals)) ungated.add(id);
  for (const message of Object.values(scenario.phone?.messages ?? {})) ungated.add(message.evidenceId);
  const addEffects = (effects: Effect[] | undefined): void => {
    for (const effect of asList(effects)) if (effect.kind === "discoverEvidence") ungated.add(effect.evidenceId);
  };
  for (const graph of Object.values(scenario.dialogues ?? {})) {
    for (const node of Object.values(graph.nodes ?? {})) {
      addEffects(node.onEnter);
      for (const option of asList(node.options)) addEffects(option.effects);
    }
  }
  for (const beat of asList(scenario.beats)) addEffects(beat.effects);

  const gateOfEvidence = (id: string): Gate => {
    const item = evidence[id as keyof typeof evidence];
    const discovery = item?.discovery;
    if (discovery?.via === "inspect") return gateOf(discovery.requires);
    if (discovery?.via === "device" && Object.hasOwn(actions, discovery.deviceActionId)) {
      return gateOf(actions[discovery.deviceActionId].requires);
    }
    return { deductions: [], evidence: [], anyEvidence: [] };
  };

  const obtainable = new Set<string>();
  const recordable = new Set<string>();
  const holds = (gate: Gate): boolean =>
    gate.deductions.every((id) => !Object.hasOwn(deductions, id) || recordable.has(id)) &&
    gate.evidence.every((id) => !Object.hasOwn(evidence, id) || obtainable.has(id)) &&
    gate.anyEvidence.every((list) => list.length === 0 || list.some((id) => !Object.hasOwn(evidence, id) || obtainable.has(id)));

  let changed = true;
  while (changed) {
    changed = false;
    for (const id of Object.keys(evidence)) {
      if (obtainable.has(id)) continue;
      if (ungated.has(id) || holds(gateOfEvidence(id))) {
        obtainable.add(id);
        changed = true;
      }
    }
    for (const [id, deduction] of Object.entries(deductions)) {
      if (recordable.has(id)) continue;
      const inputsOk = asList(deduction.inputs).every((input) => obtainable.has(input) || !Object.hasOwn(evidence, input));
      const anyOf = asList(deduction.inputsAnyOf);
      const anyOk = deduction.inputsAnyOf === undefined || anyOf.some((input) => obtainable.has(input) || !Object.hasOwn(evidence, input));
      if (inputsOk && anyOk && holds(gateOf(deduction.requires))) {
        recordable.add(id);
        changed = true;
      }
    }
  }

  for (const id of Object.keys(evidence)) {
    if (obtainable.has(id)) continue;
    const gate = gateOfEvidence(id);
    const blockingDeduction = gate.deductions.find((d) => Object.hasOwn(deductions, d) && !recordable.has(d));
    const where = `Evidence "${id}"`;
    if (blockingDeduction !== undefined) {
      add(
        errors,
        "V4",
        where,
        `${where} can only be discovered after deduction "${blockingDeduction}", which cannot be recorded without it.`,
      );
    } else {
      add(errors, "V4", where, `${where} can only be discovered after evidence that can never be discovered.`);
    }
  }
}

// ---------------------------------------------------------------------------
// Harm is never the only way forward; endings are total
// ---------------------------------------------------------------------------

function isHarmful(effects: Effect[] | undefined): boolean {
  return asList(effects).some((effect) => effect.kind === "setFlag" && HARMFUL_FLAGS.has(effect.flag));
}

/**
 * No node may need a harmful option to reach an end, and at least one decision must be harmless
 * (Requirement 11.4). Conditions are ignored: this is a static check.
 */
function checkNoHarmRequired(errors: Issues, scenario: ScenarioDefinition): void {
  for (const graph of Object.values(scenario.dialogues ?? {})) {
    const nodes = graph.nodes ?? {};
    const canEnd = reachEnd(nodes, false);
    const canEndHarmless = reachEnd(nodes, true);
    for (const key of Object.keys(nodes)) {
      if (canEnd.has(key) && !canEndHarmless.has(key)) {
        const n = `Dialogue graph "${graph.id}" node "${key}"`;
        add(errors, "V3", n, `${n} needs a harmful option to reach an end; a harmless way forward must exist.`);
      }
    }
  }
  const decisions = Object.values(scenario.decisions ?? {});
  if (decisions.length > 0 && decisions.every((decision) => isHarmful(decision.effects))) {
    add(errors, "V3", "Decisions", "Every decision has a harmful effect; a harmless decision must exist.");
  }
}

/** Nodes that reach an end, optionally without taking a harmful option. */
function reachEnd(nodes: Record<string, DialogueNode>, harmlessOnly: boolean): Set<string> {
  const reached = new Set<string>();
  let changed = true;
  while (changed) {
    changed = false;
    for (const [key, node] of Object.entries(nodes)) {
      if (reached.has(key)) continue;
      const ends =
        node.end !== undefined ||
        asList(node.options).some(
          (option) =>
            !(harmlessOnly && isHarmful(option.effects)) &&
            (typeof option.next === "string" ? reached.has(option.next) : true),
        );
      if (ends) {
        reached.add(key);
        changed = true;
      }
    }
  }
  return reached;
}

/** Endings must be total over decisions: every decision can select some ending. */
function checkEndingsTotal(errors: Issues, scenario: ScenarioDefinition, refs: RefSets): void {
  const endings = Object.values(scenario.endings ?? {});
  if (endings.length === 0) return;
  if (endings.some((ending) => asList(ending.selectWhen).length === 0)) return;
  for (const decisionId of refs.decisions) {
    const selectable = endings.some((ending) => {
      const wanted = new Set(
        asList(ending.selectWhen).flatMap((cond) => (cond.kind === "decisionIs" ? [cond.decision] : [])),
      );
      return wanted.size === 0 || (wanted.size === 1 && wanted.has(decisionId as never));
    });
    if (!selectable) {
      const where = `Decision "${decisionId}"`;
      add(errors, "V3", where, `${where} selects no ending: no ending can match it and none is unconditional.`);
    }
  }
}
