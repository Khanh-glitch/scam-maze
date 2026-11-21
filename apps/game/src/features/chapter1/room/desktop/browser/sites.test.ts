import { describe, expect, it } from "vitest";
import { VIRTUAL_PAGES, canonicalPageUrl, defaultBookmarks, isKnownPage, resolveRoute } from "./sites";
import { parseAddress } from "./urls";

describe("virtual sites", () => {
  it("lists only canonical addresses on reserved example domains", () => {
    for (const page of VIRTUAL_PAGES) {
      expect(parseAddress(page.url)?.url).toBe(page.url);
      expect(new URL(page.url).hostname.endsWith(".example")).toBe(true);
    }
    expect(new Set(VIRTUAL_PAGES.map((page) => page.id)).size).toBe(VIRTUAL_PAGES.length);
    expect(new Set(VIRTUAL_PAGES.map((page) => page.url)).size).toBe(VIRTUAL_PAGES.length);
  });

  it("routes internal pages, known pages and errors", () => {
    expect(resolveRoute("about:newtab")).toEqual({ type: "internal", id: "newtab" });
    expect(resolveRoute("about:history")).toEqual({ type: "internal", id: "history" });
    expect(resolveRoute("https://library.university.example/hours")).toMatchObject({ type: "page", page: { id: "library" } });
    expect(resolveRoute("https://nowhere.example/")).toEqual({ type: "error", reason: "unreachable", url: "https://nowhere.example/" });
    expect(resolveRoute("hello world")).toEqual({ type: "error", reason: "invalid", url: "hello world" });
  });

  it("treats a trailing slash, a query string and a bare host as the same page", () => {
    const url = "https://library.university.example/hours";
    expect(canonicalPageUrl("https://library.university.example/hours/")).toBe(url);
    expect(canonicalPageUrl("https://library.university.example/hours?ref=mail")).toBe(url);
    expect(canonicalPageUrl("https://portal.university.example")).toBe("https://portal.university.example/");
  });

  it("does not follow a real-looking domain: an address outside the game is just an error", () => {
    expect(resolveRoute("https://www.google.com/")).toMatchObject({ type: "error", reason: "unreachable" });
    expect(isKnownPage("https://www.google.com/")).toBe(false);
  });

  it("starts with the saved portal and the library bookmarked", () => {
    expect(defaultBookmarks()).toEqual(["https://portal.university.example/", "https://library.university.example/hours"]);
  });
});
