// Small branching dialogue runner for street conversations. Pure TypeScript: no React, no three, no
// text. The graph names nodes and options by id; the UI looks the text up in i18n with
// `lineKey(prefix, node)` and `optionKey(prefix, option)`.

export interface DialogueOption {
  id: string;
  /** Node to go to; null ends the conversation. */
  next: string | null;
  /** Shown only after every one of these nodes was visited. */
  showIfVisited?: readonly string[];
  /** Hidden once any of these nodes was visited. */
  hideIfVisited?: readonly string[];
}

export interface DialogueNode {
  id: string;
  /** Player replies. With none, the line has a single "continue" that goes to `next`. */
  options?: readonly DialogueOption[];
  /** Where "continue" leads when there are no options; null ends the conversation. */
  next?: string | null;
}

export interface DialogueGraph {
  /** i18n key prefix, for example `worlds:quests.mai`. */
  prefix: string;
  nodes: Readonly<Record<string, DialogueNode>>;
}

export interface DialogueState {
  /** Current node, or null when the conversation has ended. */
  node: string | null;
  /** Nodes shown so far, in order. */
  visited: readonly string[];
}

export const lineKey = (graph: DialogueGraph, node: string) => `${graph.prefix}.lines.${node}`;
export const optionKey = (graph: DialogueGraph, option: string) => `${graph.prefix}.options.${option}`;

export function startDialogue(graph: DialogueGraph, start: string): DialogueState {
  if (!graph.nodes[start]) throw new Error(`Unknown dialogue node "${start}"`);
  return { node: start, visited: [start] };
}

/** The replies the player can pick at the current node (empty at a "continue" line or when ended). */
export function visibleOptions(graph: DialogueGraph, state: DialogueState): DialogueOption[] {
  if (state.node === null) return [];
  const node = graph.nodes[state.node];
  return (node.options ?? []).filter(
    (o) => (o.showIfVisited ?? []).every((n) => state.visited.includes(n)) && !(o.hideIfVisited ?? []).some((n) => state.visited.includes(n)),
  );
}

function go(graph: DialogueGraph, state: DialogueState, next: string | null | undefined): DialogueState {
  if (next === null || next === undefined) return { node: null, visited: state.visited };
  if (!graph.nodes[next]) throw new Error(`Unknown dialogue node "${next}"`);
  return { node: next, visited: state.visited.includes(next) ? state.visited : [...state.visited, next] };
}

/** Picks a reply. An id that is not currently offered changes nothing. */
export function chooseOption(graph: DialogueGraph, state: DialogueState, optionId: string): DialogueState {
  const option = visibleOptions(graph, state).find((o) => o.id === optionId);
  return option ? go(graph, state, option.next) : state;
}

/** Moves on from a line that has no replies. Does nothing while replies are offered. */
export function advance(graph: DialogueGraph, state: DialogueState): DialogueState {
  if (state.node === null || visibleOptions(graph, state).length > 0) return state;
  return go(graph, state, graph.nodes[state.node].next);
}

export const isEnded = (state: DialogueState) => state.node === null;
