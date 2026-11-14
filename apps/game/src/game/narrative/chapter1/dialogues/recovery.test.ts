import { describe, expect, it } from "vitest";
import { RECOVERY_DIALOGUE } from "./recovery";

const nodes = Object.values(RECOVERY_DIALOGUE.nodes);
const spoken = nodes.filter((n) => n.speaker === "caller");
const nonEnd = nodes.filter((n) => n.end === undefined);
const options = nodes.flatMap((n) => n.options);

/** Longest simple path, in option steps, from `key` to an end (hang-up option counts as 1). */
function longest(key: string, seen: ReadonlySet<string> = new Set()): number {
  const node = RECOVERY_DIALOGUE.nodes[key];
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

describe("dlg.recovery structure", () => {
  it("keeps node ids equal to their keys and references existing lines and nodes", () => {
    for (const [key, node] of Object.entries(RECOVERY_DIALOGUE.nodes)) {
      expect(node.id).toBe(key);
      expect(RECOVERY_DIALOGUE.lines[node.lineId], key).toBeTruthy();
    }
    for (const option of options) {
      expect(RECOVERY_DIALOGUE.lines[option.lineId], option.id).toBeTruthy();
      if (typeof option.next === "string") expect(RECOVERY_DIALOGUE.nodes[option.next], option.id).toBeDefined();
    }
    expect(new Set(options.map((o) => o.id)).size).toBe(options.length);
  });

  it("selects five start nodes in the design priority order", () => {
    const order = (RECOVERY_DIALOGUE.startNodeWhen ?? []).map((s) => s.nodeId);
    expect(order).toEqual(["rec.start.verified", "rec.start.confronted", "rec.start.inspected", "rec.start.followed"]);
    expect(RECOVERY_DIALOGUE.startNodeId).toBe("rec.start.blank");
    const [verified, confronted, inspected, followed] = RECOVERY_DIALOGUE.startNodeWhen ?? [];
    expect(verified.when).toEqual([{ kind: "flag", flag: "official_channel_verified" }]);
    expect(confronted.when).toEqual([{ kind: "deductionRecorded", deductionId: "ded.same-source" }]);
    expect(inspected.when).toEqual([{ kind: "flag", flag: "notification_origin_inspected" }]);
    expect(followed.when).toEqual([{ kind: "flag", flag: "review_security_opened" }]);
  });

  it("gives every spoken node the recovery speaker and a tone", () => {
    for (const node of spoken) {
      expect(node.tone, node.id).toBeDefined();
      expect(node.speakerId ?? RECOVERY_DIALOGUE.persona.speakerId, node.id).toBe("spk.recovery");
    }
  });

  it("allows at most four options per node and offers hang-up everywhere", () => {
    for (const node of nodes) expect(node.options.length, node.id).toBeLessThanOrEqual(4);
    for (const node of nonEnd) {
      const hangs = node.options.some(
        (o) => o.next === "rec.end.hung-up" || (typeof o.next !== "string" && o.next.end === "hang-up"),
      );
      expect(hangs, node.id).toBe(true);
    }
  });

  it("gates the challenge options on the right deductions", () => {
    const gate = (id: string) =>
      options.filter((o) => o.id === id).flatMap((o) => o.conditions ?? []);
    expect(gate("rec.challenge-case")).toEqual([{ kind: "deductionRecorded", deductionId: "ded.same-source" }]);
    expect(gate("rec.number-not-on-statement")).toEqual([
      { kind: "deductionRecorded", deductionId: "ded.notification-mismatch" },
    ]);
    for (const o of options.filter((x) => x.next === "rec.deflect-case")) {
      expect(o.conditions, o.id).toContainEqual({ kind: "deductionRecorded", deductionId: "ded.same-source" });
    }
    for (const o of options.filter((x) => x.next === "rec.deflect-number")) {
      expect(o.conditions, o.id).toContainEqual({
        kind: "deductionRecorded",
        deductionId: "ded.notification-mismatch",
      });
    }
  });

  it("sets second_caller_trusted only on explicit trust options, and rec.trust is one", () => {
    const trusting = options.filter((o) =>
      (o.effects ?? []).some((e) => e.kind === "setFlag" && e.flag === "second_caller_trusted"),
    );
    expect(trusting.map((o) => o.id)).toContain("rec.trust");
    for (const o of trusting) expect(o.next).toBe("rec.trusted");
  });

  it("discovers E08 at rec.cites-case and sets recovery_instruction_known at rec.procedure", () => {
    expect(RECOVERY_DIALOGUE.nodes["rec.cites-case"].onEnter).toContainEqual({
      kind: "discoverEvidence",
      evidenceId: "ev.recovery-statement",
    });
    expect(RECOVERY_DIALOGUE.nodes["rec.procedure"].onEnter).toContainEqual({
      kind: "setFlag",
      flag: "recovery_instruction_known",
    });
  });

  it("ends every path within 6 option steps, and pressure nodes within 3", () => {
    for (const node of nonEnd) expect(longest(node.id), node.id).toBeLessThanOrEqual(6);
    for (const node of nonEnd.filter((n) => n.pressure === true)) {
      expect(longest(node.id), node.id).toBeLessThanOrEqual(3);
    }
  });

  it("avoids safe wording, timers and emoji, and cites the case number", () => {
    const all = Object.values(RECOVERY_DIALOGUE.lines).join("\n");
    expect(all).not.toMatch(/\bsafe/i);
    expect(all).not.toMatch(/an toàn/i);
    expect(all).not.toMatch(/\b(minutes?|seconds?|countdown|hours?|timer)\b/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(RECOVERY_DIALOGUE.lines["line.rec.cites-case"]).toContain("NG-4471-X");
    expect(RECOVERY_DIALOGUE.lines["line.rec.deflect-number"]).toContain("+000 0100 7771");
  });
});
