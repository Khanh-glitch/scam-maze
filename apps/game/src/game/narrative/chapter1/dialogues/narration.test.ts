import { describe, expect, it } from "vitest";
import { AFTERMATH_DIALOGUE, AFTERMATH_SEQUENCES } from "./aftermath";
import { INTRO_DIALOGUE, INTRO_SEQUENCE } from "./intro";

const AFTERMATH_IDS = [
  "after.a.1", "after.a.2", "after.a.3",
  "after.b.1", "after.b.2", "after.b.3",
  "after.c.1", "after.c.2", "after.c.3",
  "after.c.secret.1", "after.c.secret.2",
  "after.d.1", "after.d.2", "after.d.3",
];
const INTRO_IDS = ["intro.1", "intro.2", "intro.3"];

const graphs = [
  { name: "dlg.aftermath", graph: AFTERMATH_DIALOGUE, ids: AFTERMATH_IDS },
  { name: "dlg.intro", graph: INTRO_DIALOGUE, ids: INTRO_IDS },
];

describe.each(graphs)("$name narration", ({ name, graph, ids }) => {
  it("has the exact node set and graph id", () => {
    expect(graph.id).toBe(name);
    expect(Object.keys(graph.nodes).sort()).toEqual([...ids].sort());
    expect(graph.nodes[graph.startNodeId]).toBeDefined();
    for (const [key, node] of Object.entries(graph.nodes)) expect(node.id).toBe(key);
  });

  it("uses the narrator, a tone, a known line and no options", () => {
    for (const node of Object.values(graph.nodes)) {
      expect(node.speaker, node.id).toBe("npc");
      expect(node.speakerId ?? graph.persona.speakerId, node.id).toBe("spk.narrator");
      expect(node.tone, node.id).toBeDefined();
      expect(node.options, node.id).toEqual([]);
      expect(graph.lines[node.lineId], node.id).toBeTruthy();
    }
  });

  it('never says "safe" and never uses an emoji', () => {
    for (const text of Object.values(graph.lines)) {
      expect(text).not.toMatch(/\bsafe/i);
      expect(text).not.toMatch(/\p{Extended_Pictographic}/u);
    }
  });
});

describe("narration sequences", () => {
  it("point only at existing nodes", () => {
    for (const seq of Object.values(AFTERMATH_SEQUENCES)) {
      for (const id of seq) expect(AFTERMATH_DIALOGUE.nodes[id], id).toBeDefined();
    }
    for (const id of INTRO_SEQUENCE) expect(INTRO_DIALOGUE.nodes[id], id).toBeDefined();
  });

  it("gives each ending different text", () => {
    const texts = ["a", "b", "c", "d"].map((k) =>
      AFTERMATH_SEQUENCES[k as "a" | "b" | "c" | "d"].map((id) => AFTERMATH_DIALOGUE.lines[AFTERMATH_DIALOGUE.nodes[id].lineId]).join(" "),
    );
    expect(new Set(texts).size).toBe(4);
  });

  it("states that Ending D is valid and not a failure", () => {
    const d = AFTERMATH_SEQUENCES.d.map((id) => AFTERMATH_DIALOGUE.lines[AFTERMATH_DIALOGUE.nodes[id].lineId]).join(" ");
    expect(d).toMatch(/valid choice, not a failure/);
  });
});
