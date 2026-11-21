// Addresses of the in-game browser. Pure string handling: nothing here fetches, loads or follows an
// address. The browser only ever shows pages that the game itself ships (see `sites.ts`); every other
// address ends on an error page. Only reserved example domains are used by the story.

export const NEW_TAB_URL = "about:newtab";
export const HISTORY_URL = "about:history";

export function isInternalUrl(url: string): boolean {
  return url === NEW_TAB_URL || url === HISTORY_URL;
}

export interface ParsedAddress {
  /** The canonical address: lower-case scheme and host, a path that starts with `/`, no fragment. */
  url: string;
  host: string;
  path: string;
}

const SCHEME = /^[a-z][a-z0-9+.-]*:/i;

/**
 * Turns what the player typed or a mail link holds into a canonical address, or null when it cannot
 * be one (empty, spaces inside, a scheme other than http and https, no host). A host written without a
 * scheme gets `https://`. Never throws.
 */
export function parseAddress(input: string): ParsedAddress | null {
  const raw = input.trim();
  if (raw === "" || /\s/.test(raw)) return null;
  if (isInternalUrl(raw.toLowerCase())) return null;
  const withScheme = SCHEME.test(raw) ? raw : `https://${raw}`;
  if (!/^https?:\/\//i.test(withScheme)) return null;
  let parsed: URL;
  try {
    parsed = new URL(withScheme);
  } catch {
    return null;
  }
  const host = parsed.hostname.toLowerCase();
  if (host === "" || !host.includes(".") || parsed.username !== "" || parsed.password !== "") return null;
  const path = parsed.pathname === "" ? "/" : parsed.pathname;
  const port = parsed.port === "" ? "" : `:${parsed.port}`;
  return { url: `${parsed.protocol}//${host}${port}${path}${parsed.search}`, host, path };
}

/** The address to store for what the player typed: internal pages and valid addresses are canonical, anything else is kept as typed. */
export function canonicalAddress(input: string): string {
  const raw = input.trim();
  const lower = raw.toLowerCase();
  if (isInternalUrl(lower)) return lower;
  return parseAddress(raw)?.url ?? raw;
}

/** What the address bar shows: nothing for the New Tab page, the address otherwise. */
export function displayAddress(url: string): string {
  return url === NEW_TAB_URL ? "" : url;
}
