// Feature: chapter-01-double-deception, Property: Condition-driven dialogue options are deterministic and local
// (carried over from chapter-01-voice-narrative, Property 5; rewritten for the Double Deception scenario).
//
// For any two states that agree on `flags`, `discovered`, `deductions`, `claims`, the call log
// statuses and the current node, `availableOptions` and the start node are equal (no dependence on
// `events`, `pressure`, the phone or time). For every option whose only condition is one
// `hasEvidence`, `flag` or `deductionRecorded` condition, the option is available exactly when
// that condition holds. Each authored link from an earlier choice to later dialogue (the recovery
// call start node and its deduction-driven options) changes the options or the start node.
//
// Cases are seeded (CORE_PROPERTY_RUNS = 200 per property). A failure prints the seed, the case
// index and the state that broke the property.

import { describe, expect, it } from "vitest";

import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../../test/chapterRuns";
import { createLcg, pick, randomInt } from "../../../test/seededRandom";
import {
  DEDUCTION_IDS,
  EVIDENCE_IDS,
  FLAG_IDS,
  type DeductionId,
  type EvidenceId,
  type FlagId,
} from "../chapter1/ids";
import { CHAPTER_1_SCENARIO } from "../chapter1/scenario";
import { availableOptions, resolveStartNode } from "../dialogueEngine";
import { createInitialState } from "../reducer";
import type { ChapterState, Condition, DialogueGraph, DialogueNode } from "../types";

/** Seed offset so this file's cases differ from other core property files. */
const SEED = (CORE_PROPERTY_SEED ^ 0x0105) >>> 0;

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const SCENARIO = CHAPTER_1_SCENARIO;
const GRAPHS: DialogueGraph[] = Object.values(SCENARIO.dialogues);

interface NodeRef {
  graph: DialogueGraph;
  node: DialogueNode;
}

/** Every non-end node of every graph, in a fixed order. */
const NODE_REFS: NodeRef[] = GRAPHS.flatMap((graph) =>
  Object.values(graph.nodes)
    .filter((node) => !node.end)
    .map((node) => ({ graph, node })),
);

interface Context {
  evidence: EvidenceId[];
  flags: FlagId[];
  deductions: DeductionId[];
}

/** A playing state whose current conversation sits at `ref` with the given context. */
function stateAt(ref: { graphId: DialogueGraph["id"]; nodeId: string }, context: Context): ChapterState {
  const base = createInitialState();
  const flagMap = { ...base.flags };
  for (const flag of context.flags) flagMap[flag] = true;
  return {
    ...base,
    status: "playing",
    discovered: [...context.evidence],
    deductions: [...context.deductions],
    flags: flagMap,
    conversation: { graphId: ref.graphId, nodeId: ref.nodeId, callId: null, history: [] },
  };
}

/** Random subset of `items` (each kept with probability 1/2). */
function subset<T>(next: () => number, items: readonly T[]): T[] {
  return items.filter(() => next() < 0.5);
}

function randomContext(next: () => number): Context {
  return {
    evidence: subset(next, EVIDENCE_IDS),
    flags: subset(next, FLAG_IDS),
    deductions: subset(next, DEDUCTION_IDS),
  };
}

function optionIds(state: ChapterState): string[] {
  return availableOptions(state, SCENARIO).map((option) => option.id);
}

function startNodes(state: ChapterState): string[] {
  return GRAPHS.map((graph) => resolveStartNode(state, graph, SCENARIO));
}

/** True when the single condition holds in `context`, for the three kinds this file checks. */
function holds(condition: Condition, context: Context): boolean | null {
  switch (condition.kind) {
    case "hasEvidence":
      return context.evidence.includes(condition.evidenceId);
    case "flag":
      return context.flags.includes(condition.flag);
    case "deductionRecorded":
      return context.deductions.includes(condition.deductionId);
    default:
      return null;
  }
}

/** Options at `node` whose only condition is one of the three checked kinds. */
function singleConditionOptions(node: DialogueNode): Array<{ id: string; condition: Condition }> {
  const found: Array<{ id: string; condition: Condition }> = [];
  for (const option of node.options) {
    const conditions = option.conditions ?? [];
    if (conditions.length === 1 && holds(conditions[0], { evidence: [], flags: [], deductions: [] }) !== null) {
      found.push({ id: option.id, condition: conditions[0] });
    }
  }
  return found;
}

function fail(name: string, seed: number, index: number, detail: string): never {
  throw new Error(`${name} failed (seed ${seed}, case ${index}): ${detail}`);
}

describe("Condition-driven dialogue options are deterministic and local", () => {
  it("options and start nodes depend only on flags, evidence, deductions, claims, call log and node", () => {
    // Feature: chapter-01-double-deception, Property: Condition-driven dialogue options are deterministic and local
    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED, index);
      const next = createLcg(seed);
      const { graph, node } = pick(next, NODE_REFS);
      const context = randomContext(next);
      const where = `${graph.id}/${node.id} ${JSON.stringify(context)}`;

      const a = stateAt({ graphId: graph.id, nodeId: node.id }, context);
      // Twin: same flags, evidence, deductions, claims, call log statuses and node; different
      // pressure, event log, phone state and visited interactables.
      const b: ChapterState = {
        ...a,
        pressure: randomInt(next, 0, 3) as ChapterState["pressure"],
        events: [
          {
            seq: 0,
            action: { type: "OPEN_PHONE" },
            derived: { evidence: [], flags: [], resources: {}, persistent: [], objectivesActivated: [], objectivesCompleted: [], debriefTags: [] },
          },
        ],
        phone: { ...a.phone, open: !a.phone.open },
        interacted: [...a.interacted, "obj.note"],
      };

      if (JSON.stringify(availableOptions(a, SCENARIO)) !== JSON.stringify(availableOptions(b, SCENARIO))) {
        fail("conditionedOptions", seed, index, `availableOptions differ between twins at ${where}`);
      }
      if (JSON.stringify(startNodes(a)) !== JSON.stringify(startNodes(b))) {
        fail("conditionedOptions", seed, index, `start nodes differ between twins at ${where}`);
      }
      // Determinism: repeated calls agree.
      if (JSON.stringify(optionIds(a)) !== JSON.stringify(optionIds(a))) {
        fail("conditionedOptions", seed, index, `availableOptions is not repeatable at ${where}`);
      }
    }
  }, PROPERTY_TIMEOUT_MS);

  it("an option with one evidence, flag or deduction condition is available exactly when it holds", () => {
    // Feature: chapter-01-double-deception, Property: Condition-driven dialogue options are deterministic and local
    const conditionedNodes = NODE_REFS.filter(({ node }) => singleConditionOptions(node).length > 0);
    // Guard against a vacuous pass: the scenario must author such options.
    expect(conditionedNodes.length).toBeGreaterThanOrEqual(3);

    for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
      const seed = caseSeed(SEED ^ 0x77, index);
      const next = createLcg(seed);
      const { graph, node } = pick(next, conditionedNodes);
      const context = randomContext(next);
      const state = stateAt({ graphId: graph.id, nodeId: node.id }, context);
      const listed = new Set(optionIds(state));
      for (const { id, condition } of singleConditionOptions(node)) {
        const expected = holds(condition, context);
        if (listed.has(id) !== expected) {
          fail(
            "conditionedOptions",
            seed,
            index,
            `${graph.id}/${node.id} option ${id}: listed=${listed.has(id)} but ${JSON.stringify(condition)} holds=${String(expected)}`,
          );
        }
      }
    }
  }, PROPERTY_TIMEOUT_MS);
});

// ---------------------------------------------------------------------------
// Links from earlier choices to later dialogue (the recovery call)
// ---------------------------------------------------------------------------

interface Link {
  name: string;
  /** What is added to the context. */
  add: Partial<Context>;
  /** A readable observation of what the link changes, from a context. */
  observe: (context: Context) => string;
  /** Evidence, flags and deductions the random context must never contain (they would hide the change). */
  exclude: Partial<Context>;
}

function optionsAt(graphId: DialogueGraph["id"], nodeId: string) {
  return (context: Context): string => JSON.stringify(optionIds(stateAt({ graphId, nodeId }, context)));
}

function startNodeOf(graphId: DialogueGraph["id"]) {
  return (context: Context): string =>
    resolveStartNode(
      stateAt({ graphId, nodeId: SCENARIO.dialogues[graphId].startNodeId }, context),
      SCENARIO.dialogues[graphId],
      SCENARIO,
    );
}

const VERIFIED: FlagId = "official_channel_verified";

const LINKS: Link[] = [
  {
    name: "ded.same-source shows the case challenge at rec.cites-case",
    add: { deductions: ["ded.same-source"] },
    observe: optionsAt("dlg.recovery", "rec.cites-case"),
    exclude: { deductions: ["ded.same-source"] },
  },
  {
    name: "ded.notification-mismatch shows the number challenge at rec.cites-case",
    add: { deductions: ["ded.notification-mismatch"] },
    observe: optionsAt("dlg.recovery", "rec.cites-case"),
    exclude: { deductions: ["ded.notification-mismatch"] },
  },
  {
    name: "ded.same-source shows the case challenge at rec.procedure",
    add: { deductions: ["ded.same-source"] },
    observe: optionsAt("dlg.recovery", "rec.procedure"),
    exclude: { deductions: ["ded.same-source"] },
  },
  {
    name: "ded.notification-mismatch shows the number challenge at rec.pressure",
    add: { deductions: ["ded.notification-mismatch"] },
    observe: optionsAt("dlg.recovery", "rec.pressure"),
    exclude: { deductions: ["ded.notification-mismatch"] },
  },
  {
    name: "official_channel_verified changes the recovery start node",
    add: { flags: [VERIFIED] },
    observe: startNodeOf("dlg.recovery"),
    exclude: { flags: [VERIFIED] },
  },
  {
    name: "ded.same-source changes the recovery start node",
    add: { deductions: ["ded.same-source"] },
    observe: startNodeOf("dlg.recovery"),
    exclude: { deductions: ["ded.same-source"], flags: [VERIFIED] },
  },
  {
    name: "notification_origin_inspected changes the recovery start node",
    add: { flags: ["notification_origin_inspected"] },
    observe: startNodeOf("dlg.recovery"),
    exclude: { deductions: ["ded.same-source"], flags: [VERIFIED, "notification_origin_inspected"] },
  },
  {
    name: "review_security_opened changes the recovery start node",
    add: { flags: ["review_security_opened"] },
    observe: startNodeOf("dlg.recovery"),
    exclude: {
      deductions: ["ded.same-source"],
      flags: [VERIFIED, "notification_origin_inspected", "review_security_opened"],
    },
  },
];

describe("Condition-driven dialogue options: links from earlier choices to later dialogue", () => {
  it("adding the named flag or deduction changes the options or the start node, in any context", () => {
    // Feature: chapter-01-double-deception, Property: Condition-driven dialogue options are deterministic and local
    expect(LINKS.length).toBeGreaterThanOrEqual(8);
    for (const [linkIndex, link] of LINKS.entries()) {
      const contextFlags = FLAG_IDS.filter((id) => !(link.exclude.flags ?? []).includes(id));
      const contextDeductions = DEDUCTION_IDS.filter((id) => !(link.exclude.deductions ?? []).includes(id));
      const contextEvidence = EVIDENCE_IDS.filter((id) => !(link.exclude.evidence ?? []).includes(id));
      for (let index = 0; index < CORE_PROPERTY_RUNS; index += 1) {
        const seed = caseSeed((SEED ^ Math.imul(linkIndex + 1, 0x1f1f)) >>> 0, index);
        const next = createLcg(seed);
        const context: Context = {
          evidence: subset(next, contextEvidence),
          flags: subset(next, contextFlags),
          deductions: subset(next, contextDeductions),
        };
        const added: Context = {
          evidence: [...context.evidence, ...(link.add.evidence ?? [])],
          flags: [...context.flags, ...(link.add.flags ?? [])],
          deductions: [...context.deductions, ...(link.add.deductions ?? [])],
        };
        const before = link.observe(context);
        const after = link.observe(added);
        if (before === after) {
          fail(
            "conditionedOptions",
            seed,
            index,
            `link "${link.name}" changed nothing (${before}); context ${JSON.stringify(context)}`,
          );
        }
        // Determinism: the same inputs give the same observation.
        if (link.observe(context) !== before) {
          fail("conditionedOptions", seed, index, `link "${link.name}" is not deterministic`);
        }
      }
    }
  }, PROPERTY_TIMEOUT_MS);
});
