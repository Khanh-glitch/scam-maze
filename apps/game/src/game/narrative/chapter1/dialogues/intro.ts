// Chapter 1 "Double Deception": opening narration (`dlg.intro`).
// Three short, warm beats (owner script, 2026-11-15): home at last, the rain outside, a rest. No
// exposition dump and no hint about what will happen. The presentation layer lets the player skip it. Played in order
// (`INTRO_SEQUENCE`) through the voice player with explicit targets (design Q6).
//
// Node IDs are stable and double as voice clip IDs (`intro.*`). Each beat is a terminal
// `completed` node, so the graph has no node without an exit.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  "line.intro.1": "Finally, you're home. What a long day it's been.",
  "line.intro.2": "Everything feels so peaceful here. Just the gentle sound of rain outside.",
  "line.intro.3": "There you go. Take a deep breath and make yourself comfortable. You've earned a little rest.",
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
