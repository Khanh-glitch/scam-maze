import { describe, expect, it } from "vitest";
import { OFFICIAL_LINE_DIALOGUE as G } from "./officialLine";
import { ALEX_DIALOGUE } from "./alex";
import { OFFICIAL_NUMBER } from "../sources";

const nodes = Object.values(G.nodes);
const nonEnd = nodes.filter((n) => n.end === undefined);

describe("dlg.official-line structure", () => {
  it("is an independent, trusted graph with node ids equal to keys", () => {
    expect(G.id).toBe("dlg.official-line");
    expect(G.independentChannel).toBe(true);
    expect(G.persona.speakerId).toBe("spk.northgate-agent");
    expect(G.persona.honesty).toBe("trusted");
    for (const [key, node] of Object.entries(G.nodes)) expect(node.id).toBe(key);
    expect(G.nodes[G.startNodeId]).toBeDefined();
    expect(nodes.length).toBeGreaterThanOrEqual(7);
  });

  it("gives every spoken node the agent speaker and a tone", () => {
    for (const node of nodes.filter((n) => n.speaker === "caller")) {
      expect(node.tone, node.id).toBeDefined();
      expect(node.speakerId, node.id).toBe("spk.northgate-agent");
    }
  });

  it("uses at most four options and lets the player hang up at every non-end node", () => {
    for (const node of nodes) expect(node.options.length, node.id).toBeLessThanOrEqual(4);
    for (const node of nonEnd) {
      const hangs = node.options.some(
        (o) => o.next === "off.end.hung-up" || (typeof o.next !== "string" && o.next.end === "hang-up"),
      );
      expect(hangs, node.id).toBe(true);
    }
  });

  it("references only defined lines and existing nodes, with unique option ids", () => {
    const ids = new Set<string>();
    for (const node of nodes) {
      expect(G.lines[node.lineId], node.id).toBeTruthy();
      for (const o of node.options) {
        expect(G.lines[o.lineId], o.id).toBeTruthy();
        expect(ids.has(o.id), o.id).toBe(false);
        ids.add(o.id);
        expect(o.id.startsWith("off.opt."), o.id).toBe(true);
        if (typeof o.next === "string") expect(G.nodes[o.next], o.id).toBeDefined();
      }
    }
  });

  it("discovers E09, contradicts all four claims and sets the flag only at off.confirm", () => {
    const effects = G.nodes["off.confirm"].onEnter ?? [];
    expect(effects).toContainEqual({ kind: "discoverEvidence", evidenceId: "ev.official-confirmation" });
    expect(effects).toContainEqual({ kind: "setFlag", flag: "official_channel_verified" });
    const claims = effects.flatMap((e) => (e.kind === "setClaimStatus" ? [e] : []));
    expect(claims.map((e) => e.claimId).sort()).toEqual(
      ["claim.alex-identity", "claim.claims-independent", "claim.notification-genuine", "claim.recovery-needed"],
    );
    for (const c of claims) expect(c.status).toBe("contradicted");
    for (const node of nodes) {
      if (node.id === "off.confirm") continue;
      const all = [...(node.onEnter ?? []), ...node.options.flatMap((o) => o.effects ?? [])];
      expect(all.filter((e) => e.kind === "setClaimStatus"), node.id).toEqual([]);
    }
  });

  it("is the only Chapter 1 call graph here that sets claim statuses", () => {
    const alexEffects = Object.values(ALEX_DIALOGUE.nodes).flatMap((n) => [
      ...(n.onEnter ?? []),
      ...n.options.flatMap((o) => o.effects ?? []),
    ]);
    expect(alexEffects.some((e) => e.kind === "setClaimStatus")).toBe(false);
  });

  it("states what the bank did not send, uses the official number, and never says safe", () => {
    const all = Object.values(G.lines).join("\n");
    expect(all).not.toMatch(/\bsafe/i);
    expect(all).not.toMatch(/an toàn/i);
    expect(all).not.toMatch(/\p{Extended_Pictographic}/u);
    expect(all).not.toMatch(/\b(minutes?|seconds?|countdown|hours?)\b/i);
    expect(G.lines["line.official.confirm"]).toMatch(/no case/);
    expect(G.lines["line.official.confirm"]).toMatch(/did not send/);
    expect(G.lines["line.official.confirm"]).toMatch(/recovery/);
    expect(G.lines["line.official.advice"]).toContain(OFFICIAL_NUMBER);
  });
});
