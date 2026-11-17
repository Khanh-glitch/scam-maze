import { describe, expect, it } from "vitest";
import { advance, chooseOption, isEnded, startDialogue, visibleOptions, type DialogueGraph } from "./dialogue";
import { MAI_DIALOGUE, maiStart } from "./maiDialogue";
import { completeQuest, hasNewQuest, initialQuestState, markSeen, questsWith, startQuest, trackQuest } from "./quests";

/** Every way through the graph: returns the set of (node, visited) states reached. */
function explore(graph: DialogueGraph, start: string) {
  const seen = new Set<string>();
  const ended: string[][] = [];
  const queue = [startDialogue(graph, start)];
  while (queue.length) {
    const s = queue.pop()!;
    const key = `${s.node}|${[...s.visited].sort().join(",")}`;
    if (seen.has(key)) continue;
    seen.add(key);
    if (isEnded(s)) { ended.push([...s.visited]); continue; }
    const opts = visibleOptions(graph, s);
    if (opts.length) for (const o of opts) queue.push(chooseOption(graph, s, o.id));
    else queue.push(advance(graph, s));
  }
  return { states: seen.size, ended };
}

describe("Mai dialogue graph", () => {
  it("refers only to nodes that exist", () => {
    for (const node of Object.values(MAI_DIALOGUE.nodes)) {
      for (const o of node.options ?? []) if (o.next !== null) expect(MAI_DIALOGUE.nodes[o.next], `${node.id}.${o.id}`).toBeDefined();
      if (node.next) expect(MAI_DIALOGUE.nodes[node.next], node.id).toBeDefined();
    }
  });
  it("always offers a way forward and always ends", () => {
    const { ended } = explore(MAI_DIALOGUE, "greet");
    expect(ended.length).toBeGreaterThan(0);
    for (const node of Object.values(MAI_DIALOGUE.nodes)) {
      // Every node either has replies or a continue target, so the player is never stuck.
      expect((node.options?.length ?? 0) > 0 || node.next !== undefined, node.id).toBe(true);
    }
  });
  it("lets the player skip the scam details and still reach goodbye", () => {
    let s = startDialogue(MAI_DIALOGUE, "greet");
    s = chooseOption(MAI_DIALOGUE, s, "busy");
    expect(s.node).toBe("work");
    s = advance(MAI_DIALOGUE, s);
    expect(s.node).toBe("scams");
    s = chooseOption(MAI_DIALOGUE, s, "leave");
    expect(s.node).toBe("bye");
    s = chooseOption(MAI_DIALOGUE, s, "goodbye");
    expect(isEnded(s)).toBe(true);
    expect(s.visited).not.toContain("otp");
    expect(s.visited).not.toContain("police");
  });
  it("tells both scam stories when the player asks, and summarizes them", () => {
    let s = startDialogue(MAI_DIALOGUE, "scams");
    s = chooseOption(MAI_DIALOGUE, s, "kinds");
    s = chooseOption(MAI_DIALOGUE, s, "otp");
    expect(visibleOptions(MAI_DIALOGUE, s).map((o) => o.id)).toEqual(["policeToo", "gotItOtp"]);
    s = chooseOption(MAI_DIALOGUE, s, "policeToo");
    expect(visibleOptions(MAI_DIALOGUE, s).map((o) => o.id)).toEqual(["gotItPolice"]);
    s = chooseOption(MAI_DIALOGUE, s, "gotItPolice");
    expect(s.node).toBe("wrap");
    expect(s.visited).toEqual(expect.arrayContaining(["otp", "police", "wrap"]));
  });
  it("goes straight to goodbye after one story", () => {
    let s = startDialogue(MAI_DIALOGUE, "kinds");
    s = chooseOption(MAI_DIALOGUE, s, "police");
    s = chooseOption(MAI_DIALOGUE, s, "gotItPolice");
    expect(s.node).toBe("bye");
  });
  it("ignores a reply that is not offered, and 'continue' while replies are offered", () => {
    const s = startDialogue(MAI_DIALOGUE, "greet");
    expect(chooseOption(MAI_DIALOGUE, s, "otp")).toBe(s);
    expect(advance(MAI_DIALOGUE, s)).toBe(s);
  });
  it("starts with the short greeting once the player has met her", () => {
    expect(maiStart(false)).toBe("greet");
    expect(maiStart(true)).toBe("again");
  });
});

describe("quest state", () => {
  it("starts with Meet Mai active, tracked and unseen", () => {
    const s = initialQuestState();
    expect(questsWith(s, "active")).toEqual(["meetMai"]);
    expect(s.tracked).toBe("meetMai");
    expect(hasNewQuest(s)).toBe(true);
    expect(hasNewQuest(markSeen(s))).toBe(false);
  });
  it("completing a quest moves it to done and clears the tracker", () => {
    const s = completeQuest(initialQuestState(), "meetMai");
    expect(questsWith(s, "done")).toEqual(["meetMai"]);
    expect(s.tracked).toBeNull();
    expect(completeQuest(s, "meetMai")).toBe(s);
  });
  it("only tracks an active quest", () => {
    const done = completeQuest(initialQuestState(), "meetMai");
    expect(trackQuest(done, "meetMai").tracked).toBeNull();
    expect(trackQuest(initialQuestState(), null).tracked).toBeNull();
  });
  it("starts the next quest as tracked and new, once", () => {
    const seen = markSeen(completeQuest(initialQuestState(), "meetMai"));
    const next = startQuest(seen, "walkStreet");
    expect(next.tracked).toBe("walkStreet");
    expect(questsWith(next, "active")).toEqual(["walkStreet"]);
    expect(hasNewQuest(next)).toBe(true);
    expect(startQuest(next, "walkStreet")).toBe(next);
  });
});
