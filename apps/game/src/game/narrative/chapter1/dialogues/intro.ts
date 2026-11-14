// Chapter 1 "Double Deception": opening narration (`dlg.intro`).
// Three short, calm beats: the time (22:47), the rain, the apartment. No exposition dump and no
// hint about what will happen. The presentation layer lets the player skip it. Played in order
// (`INTRO_SEQUENCE`) through the voice player with explicit targets (design Q6).
//
// Node IDs are stable and double as voice clip IDs (`intro.*`). Each beat is a terminal
// `completed` node, so the graph has no node without an exit.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  "line.intro.1": "It is 22:47. Rain taps on the window, steady and slow.",
  "line.intro.2": "The apartment is quiet. A lamp is on, and the street below is empty.",
  "line.intro.3": "Your phone rests on the table. The evening is almost over.",
};

const beat = (id: string, lineId: string): DialogueNode => ({
  id,
  speaker: "npc",
  speakerId: "spk.narrator",
  tone: "reassuring",
  lineId,
  options: [],
  end: { kind: "completed" },
});

const nodes: Record<string, DialogueNode> = {
  "intro.1": beat("intro.1", "line.intro.1"),
  "intro.2": beat("intro.2", "line.intro.2"),
  "intro.3": beat("intro.3", "line.intro.3"),
};

export const INTRO_SEQUENCE = ["intro.1", "intro.2", "intro.3"] as const;

export const INTRO_DIALOGUE: DialogueGraph = {
  id: "dlg.intro",
  persona: {
    speakerId: "spk.narrator",
    name: "Narrator",
    role: "Sets the scene at the start of the chapter",
    honesty: "neutral",
  },
  channel: "face-to-face",
  independentChannel: false,
  startNodeId: "intro.1",
  lines,
  nodes,
};
