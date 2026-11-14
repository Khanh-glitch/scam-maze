import { describe, expect, it } from "vitest";
import { ALEX_DIALOGUE } from "./alex";

const nodes = Object.values(ALEX_DIALOGUE.nodes);
const spoken = nodes.filter((n) => n.speaker === "caller");
const nonEnd = nodes.filter((n) => n.end === undefined);

/** Longest simple path, in option steps, from `key` to an end (hang-up option counts as 1). */
function longest(key: string, seen: ReadonlySet<string> = new Set()): number {
  const node = ALEX_DIALOGUE.nodes[key];
  if (node.end !== undefined) return 0;
  let best = 0;
  for (const option of node.options) {
    if (typeof option.next !== "string") {
      best = Math.max(best, 1);
    } else if (!seen.has(option.next)) {
      best = Math.max(best, 1 + longest(option.next, new Set([...seen, key])));
    }
  }
  return best;
}

describe("dlg.alex structure", () => {
  it("keeps node ids equal to their keys and starts at a known node", () => {
    for (const [key, node] of Object.entries(ALEX_DIALOGUE.nodes)) expect(node.id).toBe(key);
    expect(ALEX_DIALOGUE.nodes[ALEX_DIALOGUE.startNodeId]).toBeDefined();
    expect(nodes.length).toBeGreaterThanOrEqual(10);
  });

  it("gives every spoken node the Alex speaker and a tone", () => {
    expect(spoken.length).toBeGreaterThan(0);
    for (const node of spoken) {
      expect(node.tone, node.id).toBeDefined();
      expect(node.speakerId ?? ALEX_DIALOGUE.persona.speakerId, node.id).toBe("spk.alex");
    }
  });

  it("allows at most four options per node", () => {
    for (const node of nodes) expect(node.options.length, node.id).toBeLessThanOrEqual(4);
  });

  it("offers a hang-up option on every non-end node", () => {
    for (const node of nonEnd) {
      const hangs = node.options.some(
        (o) => o.next === "alex.end.hung-up" || (typeof o.next !== "string" && o.next.end === "hang-up"),
      );
      expect(hangs, node.id).toBe(true);
    }
  });

  it("has a single harmful option, alex.share-code", () => {
    const harmful = nodes.flatMap((n) =>
      n.options.filter((o) => (o.effects ?? []).some((e) => e.kind === "setFlag" && e.flag === "code_shared")),
    );
    expect(harmful.map((o) => o.id)).toEqual(["alex.share-code"]);
  });

  it("ends every path within 6 option steps", () => {
    for (const node of nonEnd) expect(longest(node.id), node.id).toBeLessThanOrEqual(6);
    expect(longest(ALEX_DIALOGUE.startNodeId)).toBeLessThanOrEqual(6);
  });

  it("references only defined lines and existing nodes", () => {
    for (const node of nodes) {
      expect(ALEX_DIALOGUE.lines[node.lineId], node.id).toBeTruthy();
      for (const option of node.options) {
        expect(ALEX_DIALOGUE.lines[option.lineId], option.id).toBeTruthy();
        if (typeof option.next === "string") expect(ALEX_DIALOGUE.nodes[option.next], option.id).toBeDefined();
      }
    }
  });

  it("avoids safe wording, timers and emoji, and names the case ID", () => {
    const all = Object.values(ALEX_DIALOGUE.lines).join("\n");
    expect(all).not.toMatch(/\bsafe/i);
    expect(all).not.toMatch(/an toàn/i);
    expect(all).not.toMatch(/\b(minutes?|seconds?|countdown|hours?)\b/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).toContain("NG-4471-X");
    expect(ALEX_DIALOGUE.lines["line.alex.proof"]).toMatch(/notification/);
    expect(ALEX_DIALOGUE.lines["line.alex.refused"]).toMatch(/follow-up team/);
  });
});
