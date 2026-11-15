// Chapter 1 "Double Deception": ending narration (`dlg.aftermath`).
// Spoken narration for the four endings and the secret case-report variant. Each ending shows a
// different consequence, not the same story with other words:
// - A (`false-victory`): the player rejected Alex, then trusted the second layer.
// - B (`perfect-chain`): both layers worked on the player.
// - C (`break-the-chain`): the player verified through a saved contact and rebuilt the shared origin.
// - D (`unfinished-case`): the player refused and stopped; the case stays open, and that is valid.
//
// Linear auto-advance nodes: no options. The presentation layer plays a sequence in order
// (`AFTERMATH_SEQUENCES`) through the voice player with explicit targets (design Q6). Each beat is
// a terminal `completed` node, so the graph has no node without an exit. The graph is not
// conversation-driven: `startNodeId` only has to name a known node.
//
// Node IDs are stable and double as voice clip IDs (`after.*`). Plain English, no fear as the main
// motivator, no blame, no verdicts about safety. Case ID and names are fictional.

import type { DialogueGraph, DialogueNode } from "../../types";

const lines: Record<string, string> = {
  // Ending A: false-victory. The second layer succeeds after Alex was rejected.
  "line.after.a.1":
    "The recovery steps are done. The screen is quiet, and the case reference NG-4471-X shows as closed. You lean back. Turning Alex away feels like the right call, and the follow-up team confirmed it.",
  "line.after.a.2":
    "Then one question stays with you. Who told you that choice was right? It was the second voice, the one that called about the same case. It agreed with you at the moment you most wanted to hear it.",
  "line.after.a.3":
    "Rejecting one caller did not end the plan. The second layer worked because it sounded like relief. A voice that praises your caution still needs to be checked through a channel you chose yourself.",

  // Ending B: perfect-chain. Both layers worked.
  "line.after.b.1":
    "The first call took the code. The second call took the steps that followed. Each one made sense because the other had already happened.",
  "line.after.b.2":
    "Looking back, the notification, the follow-up team and the case ID NG-4471-X all pointed the same way. They felt like three separate confirmations, but they came from one source.",
  "line.after.b.3":
    "This is how a two-part plan is built: the first part creates the problem, and the second part offers the fix. Stopping after either call, and checking with a number you already trusted, would have broken the chain.",

  // Ending C: break-the-chain. Verified through the saved contact.
  "line.after.c.1":
    "You did not use the number on the screen. You called the contact that was already saved in your bank app, and the person there knew nothing about case NG-4471-X.",
  "line.after.c.2":
    "No recovery procedure by phone, no notification from them, no follow-up team. The official line gave you the plain answer, and the account stayed as you left it.",
  "line.after.c.3":
    "You chose the trusted channel before the pressured one. That one step is what separated the calls that came to you from the facts that you checked yourself.",
  "line.after.c.secret.1":
    "One more thing. You put the pieces side by side. Alex and the follow-up team used the same case ID. The notification carried the same reference. Three voices were pointing at one origin.",
  "line.after.c.secret.2":
    "Your case report says it plainly: these claims were not independent, and none of them was confirmed by the bank. A caller who agrees with another caller does not add proof. You wrote it down, and it is ready to share.",

  // Ending D: unfinished-case. Refused and stopped; unresolved, but a valid choice.
  "line.after.d.1":
    "You said no to the calls and left the case where it was. No code left your hands, and no steps were followed.",
  "line.after.d.2":
    "Some things are still open. You do not know why the notification appeared, or who is behind case NG-4471-X. Not knowing is allowed. Stopping is a valid choice, not a failure.",
  "line.after.d.3":
    "When you are ready, the way forward is simple: use the number saved in your bank app and ask them directly. The questions will still be there, and you can answer them at your own pace.",
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
  "after.a.1": beat("after.a.1", "line.after.a.1"),
  "after.a.2": beat("after.a.2", "line.after.a.2"),
  "after.a.3": beat("after.a.3", "line.after.a.3"),
  "after.b.1": beat("after.b.1", "line.after.b.1"),
  "after.b.2": beat("after.b.2", "line.after.b.2"),
  "after.b.3": beat("after.b.3", "line.after.b.3"),
  "after.c.1": beat("after.c.1", "line.after.c.1"),
  "after.c.2": beat("after.c.2", "line.after.c.2"),
  "after.c.3": beat("after.c.3", "line.after.c.3"),
  "after.c.secret.1": beat("after.c.secret.1", "line.after.c.secret.1"),
  "after.c.secret.2": beat("after.c.secret.2", "line.after.c.secret.2"),
  "after.d.1": beat("after.d.1", "line.after.d.1"),
  "after.d.2": beat("after.d.2", "line.after.d.2"),
  "after.d.3": beat("after.d.3", "line.after.d.3"),
};

/** Playback order per ending. The secret beats follow Ending C's three beats. */
export const AFTERMATH_SEQUENCES = {
  a: ["after.a.1", "after.a.2", "after.a.3"],
  b: ["after.b.1", "after.b.2", "after.b.3"],
  c: ["after.c.1", "after.c.2", "after.c.3"],
  "c-secret": ["after.c.1", "after.c.2", "after.c.3", "after.c.secret.1", "after.c.secret.2"],
  d: ["after.d.1", "after.d.2", "after.d.3"],
} as const;

export const AFTERMATH_DIALOGUE: DialogueGraph = {
  id: "dlg.aftermath",
  persona: {
    speakerId: "spk.narrator",
    name: "Narrator",
    role: "Tells what happened after the final decision",
    honesty: "neutral",
  },
  channel: "face-to-face",
  independentChannel: false,
  startNodeId: "after.a.1",
  lines,
  nodes,
};
