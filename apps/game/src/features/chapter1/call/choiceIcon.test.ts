import { describe, expect, it } from "vitest";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { choiceIconKind } from "./choiceIcon";

describe("choiceIconKind", () => {
  it("maps the engine fallback option to the hang-up icon", () => {
    expect(choiceIconKind({ id: "fallback", fallback: true })).toBe("hang-up");
  });

  it.each([
    ["alex.opt.pressure.refuse-code", "hang-up"],
    ["off.opt.confirm.all-done", "hang-up"],
    ["alex.opt.open.ask-who", "challenge"],
    ["alex.opt.open.challenge-number", "challenge"],
    ["alex.opt.details.ask-proof", "challenge"],
    ["rec.opt.pressure.ask-verify", "challenge"],
    ["rec.opt.deflects-verify.check-myself", "challenge"],
    ["alex.opt.callback.call-back", "challenge"],
    ["alex.opt.defend.keep-challenging", "challenge"],
    ["alex.opt.open.ask-details", "reply"],
    ["alex.opt.defend.accept", "reply"],
    ["rec.opt.deflects-verify.trust", "reply"],
  ] as const)("%s -> %s", (id, kind) => {
    expect(choiceIconKind({ id })).toBe(kind);
  });

  it("does not read the graph or node part of the id, only the last segment", () => {
    // `callback` is a node name here, the option itself only continues the talk.
    expect(choiceIconKind({ id: "alex.opt.callback.then-what" })).toBe("reply");
  });

  it("is deterministic and covers every authored option id", () => {
    const kinds = new Set<string>();
    for (const graph of Object.values(CHAPTER_1_SCENARIO.dialogues)) {
      for (const node of Object.values(graph.nodes)) {
        for (const option of node.options) {
          const first = choiceIconKind({ id: option.id });
          expect(choiceIconKind({ id: option.id })).toBe(first);
          kinds.add(first);
        }
      }
    }
    expect([...kinds].sort()).toEqual(["challenge", "hang-up", "reply"]);
  });
});
