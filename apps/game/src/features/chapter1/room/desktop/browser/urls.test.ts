import { describe, expect, it } from "vitest";
import { HISTORY_URL, NEW_TAB_URL, canonicalAddress, displayAddress, isInternalUrl, parseAddress } from "./urls";

describe("parseAddress", () => {
  it("makes a canonical address: lower-case host, a path, no fragment", () => {
    expect(parseAddress("HTTPS://Student.UEH.edu.VN")?.url).toBe("https://student.ueh.edu.vn/");
    expect(parseAddress("https://a.example/x/y?q=1#top")?.url).toBe("https://a.example/x/y?q=1");
  });

  it("adds https to a bare host", () => {
    expect(parseAddress("lib.ueh.edu.vn/hours")).toMatchObject({ url: "https://lib.ueh.edu.vn/hours", host: "lib.ueh.edu.vn", path: "/hours" });
  });

  it("rejects text that cannot be an address, other schemes and credentials", () => {
    for (const bad of ["", "   ", "hello world", "javascript:alert(1)", "ftp://a.example/", "file:///etc/passwd", "https://user:pw@a.example/", "https://localhost/", "about:newtab"]) {
      expect(parseAddress(bad)).toBeNull();
    }
  });
});

describe("canonicalAddress and display", () => {
  it("keeps internal pages, canonical addresses, and what cannot be parsed as typed", () => {
    expect(canonicalAddress(" ABOUT:HISTORY ")).toBe(HISTORY_URL);
    expect(canonicalAddress("A.Example")).toBe("https://a.example/");
    expect(canonicalAddress("not an address")).toBe("not an address");
  });

  it("shows nothing for the New Tab page", () => {
    expect(displayAddress(NEW_TAB_URL)).toBe("");
    expect(displayAddress("https://a.example/")).toBe("https://a.example/");
    expect(isInternalUrl(NEW_TAB_URL)).toBe(true);
    expect(isInternalUrl("https://a.example/")).toBe(false);
  });
});
