// The chapter plays to every ending with no network and no AI (Requirements 20.1 to 20.3).
// The game has no AI setting or provider today, so "AI off" is the only state: these tests make
// `fetch` throw and show that every ending is reached through the pure core, and that no
// narrative source file can reach the network.
import { readFileSync, readdirSync } from "node:fs";
import { join, relative, sep } from "node:path";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { assertInvariants, reachEndingA, reachEndingB, reachEndingC, reachEndingD } from "../../../test/chapterRuns";

const NARRATIVE_DIR = join(import.meta.dirname, "..");

describe("every ending completes with fetch stubbed to throw", () => {
  const fetchStub = vi.fn(() => {
    throw new Error("network is not available");
  });

  beforeEach(() => {
    fetchStub.mockClear();
    vi.stubGlobal("fetch", fetchStub);
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  const endings = [
    { name: "A, false-victory", outcome: "false-victory", run: () => reachEndingA() },
    { name: "B, perfect-chain", outcome: "perfect-chain", run: () => reachEndingB() },
    { name: "C, break-the-chain", outcome: "break-the-chain", run: () => reachEndingC() },
    { name: "C, break-the-chain with the case-report variant", outcome: "break-the-chain", run: () => reachEndingC({ caseReport: true }) },
    { name: "D, unfinished-case", outcome: "unfinished-case", run: () => reachEndingD() },
  ] as const;

  for (const ending of endings) {
    it(`reaches ending ${ending.name}`, () => {
      const result = ending.run();
      expect(result.final.status).toBe("finished");
      expect(result.final.outcome).toBe(ending.outcome);
      expect(assertInvariants(result.final)).toEqual([]);
      expect(fetchStub).not.toHaveBeenCalled();
    });
  }

  it("records both deductions in the case-report variant only", () => {
    const secret = reachEndingC({ caseReport: true }).final.deductions;
    expect(secret).toContain("ded.same-source");
    expect(secret).toContain("ded.third-caller-not-independent");
    expect(reachEndingC().final.deductions).not.toContain("ded.same-source");
    expect(fetchStub).not.toHaveBeenCalled();
  });
});

/** Network APIs the core must never use. Matched as code, not as a part of a longer word. */
const NETWORK_APIS: ReadonlyArray<{ name: string; pattern: RegExp }> = [
  { name: "fetch", pattern: /(?<![\w.$])fetch\s*\(|\b(?:globalThis|window|self)\s*\.\s*fetch\b/ },
  { name: "XMLHttpRequest", pattern: /\bXMLHttpRequest\b/ },
  { name: "WebSocket", pattern: /\bWebSocket\b/ },
  { name: "EventSource", pattern: /\bEventSource\b/ },
  { name: "navigator.sendBeacon", pattern: /\bsendBeacon\b/ },
];

function listSources(dir: string): string[] {
  const files: string[] = [];
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    const full = join(dir, entry.name);
    if (entry.isDirectory()) files.push(...listSources(full));
    else if (entry.isFile() && /\.tsx?$/.test(entry.name) && !/\.test\.tsx?$/.test(entry.name)) files.push(full);
  }
  return files.sort();
}

/** Strips comments so a mention in prose is not counted as use. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, "").replace(/(^|[^:])\/\/.*$/gm, "$1");
}

describe("the narrative core uses no network API", () => {
  const files = listSources(NARRATIVE_DIR);

  it("finds the narrative source files", () => {
    expect(files.length).toBeGreaterThan(10);
  });

  it("detects each network API in a fixture (self-check)", () => {
    const fixture = [
      'const a = await fetch("/x");',
      "const b = new XMLHttpRequest();",
      'const c = new WebSocket("wss://x.invalid");',
      'const d = new EventSource("/s");',
      'navigator.sendBeacon("/b", "");',
    ].join("\n");
    const hits = NETWORK_APIS.filter(({ pattern }) => pattern.test(stripComments(fixture))).map(({ name }) => name);
    expect(hits).toEqual(NETWORK_APIS.map(({ name }) => name));
    // Prose and longer identifiers are not hits.
    expect(NETWORK_APIS.some(({ pattern }) => pattern.test(stripComments("// fetch( later\nconst prefetchCount = 1;")))).toBe(false);
  });

  it("no file under game/narrative uses fetch, XMLHttpRequest, WebSocket, EventSource or navigator.sendBeacon", () => {
    const violations: string[] = [];
    for (const file of files) {
      const code = stripComments(readFileSync(file, "utf8"));
      for (const { name, pattern } of NETWORK_APIS) {
        if (pattern.test(code)) violations.push(`${relative(NARRATIVE_DIR, file).split(sep).join("/")}: ${name}`);
      }
    }
    expect(violations).toEqual([]);
  });
});
