import { describe, expect, it } from "vitest";
import { createLcg, pick } from "../../../test/seededRandom";
import { deriveUiMode, type UiModeInput } from "./uiMode";

const base: UiModeInput = { callStatus: "idle", hasReplyOptions: false, overlayKind: null, inspecting: null };

describe("deriveUiMode", () => {
  it("is exploration when nothing is open", () => {
    expect(deriveUiMode(base)).toBe("exploration");
  });

  it("stays exploration for the journal and for inspecting a note", () => {
    expect(deriveUiMode({ ...base, overlayKind: "journal" })).toBe("exploration");
    expect(deriveUiMode({ ...base, inspecting: "note" })).toBe("exploration");
  });

  it("is call while the phone rings or the caller speaks", () => {
    expect(deriveUiMode({ ...base, callStatus: "ringing" })).toBe("call");
    expect(deriveUiMode({ ...base, callStatus: "active" })).toBe("call");
  });

  it("is decision only for an active call with reply options", () => {
    expect(deriveUiMode({ ...base, callStatus: "active", hasReplyOptions: true })).toBe("decision");
    expect(deriveUiMode({ ...base, callStatus: "ringing", hasReplyOptions: true })).toBe("call");
    expect(deriveUiMode({ ...base, callStatus: "idle", hasReplyOptions: true })).toBe("exploration");
  });

  it("is investigation for the laptop and the phone records, by overlay or by inspect pose", () => {
    expect(deriveUiMode({ ...base, overlayKind: "laptop" })).toBe("investigation");
    expect(deriveUiMode({ ...base, overlayKind: "phone" })).toBe("investigation");
    expect(deriveUiMode({ ...base, inspecting: "laptop" })).toBe("investigation");
  });

  it("a call wins over a device overlay", () => {
    expect(deriveUiMode({ ...base, callStatus: "active", overlayKind: "laptop" })).toBe("call");
  });

  it("property: total and deterministic over seeded inputs", () => {
    const seed = 0x0c1ae001;
    const next = createLcg(seed);
    for (let i = 0; i < 200; i += 1) {
      const input: UiModeInput = {
        callStatus: pick(next, ["idle", "ringing", "active", "ended"]),
        hasReplyOptions: next() < 0.5,
        overlayKind: pick(next, [null, "journal", "laptop", "phone", "decision"]),
        inspecting: pick(next, [null, "laptop", "phone", "note"]),
      };
      const mode = deriveUiMode(input);
      const label = `seed ${seed.toString(16)} case ${i} ${JSON.stringify(input)}`;
      expect(["exploration", "call", "decision", "investigation"], label).toContain(mode);
      expect(deriveUiMode({ ...input }), label).toBe(mode);
      if (mode === "decision") expect(input.callStatus === "active" && input.hasReplyOptions, label).toBe(true);
    }
  });
});
