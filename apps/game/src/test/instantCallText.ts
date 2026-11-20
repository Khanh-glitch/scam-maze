import { afterEach, beforeEach, vi } from "vitest";

/**
 * Registers hooks that turn on "reduce motion" for the tests of the file. The in-room call types the
 * caller line out and shows the replies when it is complete; with reduced motion the line is complete
 * at once, so tests that are not about typing can pick a reply right away.
 */
export function useInstantCallText(): void {
  beforeEach(() => {
    vi.stubGlobal(
      "matchMedia",
      (query: string) =>
        ({
          matches: query.includes("prefers-reduced-motion"),
          media: query,
          addEventListener: () => {},
          removeEventListener: () => {},
        }) as unknown as MediaQueryList,
    );
  });
  afterEach(() => {
    vi.unstubAllGlobals();
  });
}
