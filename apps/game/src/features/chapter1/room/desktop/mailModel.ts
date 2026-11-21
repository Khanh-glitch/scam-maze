// Pure helpers of the Mail app: sender parsing, previews, link splitting and folders. No React, no
// i18n, no game state. Nothing here judges a message: it only reports what is written in it.
import type { DeviceItemView } from "../../../../game/narrative/device";

export interface SenderInfo {
  /** The name shown as the sender. */
  name: string;
  /** The address inside `<...>`, or an address written alone; null when there is none. */
  address: string | null;
  /** Everything after the `@` of the address, lower case; null without an address. */
  domain: string | null;
  /** One or two letters for the avatar. */
  initials: string;
}

const ADDRESS_ONLY = /^[^\s<>@]+@[^\s<>@]+$/;

export function parseSender(from: string | null): SenderInfo {
  const raw = (from ?? "").trim();
  if (raw === "") return { name: "", address: null, domain: null, initials: "?" };
  let name = raw;
  let address: string | null = null;
  const angle = /^(.*?)\s*<([^<>]+)>\s*$/.exec(raw);
  if (angle) {
    name = angle[1].trim().replace(/^"|"$/g, "");
    address = angle[2].trim();
  } else if (ADDRESS_ONLY.test(raw)) {
    address = raw;
    name = raw.split("@")[0];
  }
  const at = address === null ? -1 : address.lastIndexOf("@");
  const domain = address !== null && at >= 0 ? address.slice(at + 1).toLowerCase() : null;
  if (name === "") name = address ?? raw;
  return { name, address, domain, initials: initialsOf(name) };
}

function initialsOf(name: string): string {
  const words = name.split(/\s+/).filter((word) => /\p{L}/u.test(word));
  if (words.length === 0) return "?";
  const first = Array.from(words[0])[0] ?? "?";
  const last = words.length > 1 ? (Array.from(words[words.length - 1])[0] ?? "") : "";
  return (first + last).toUpperCase();
}

/** A one-line preview: the body without line breaks and without the greeting line, cut at `max` characters. */
export function mailPreview(body: string, max = 96): string {
  const lines = body.split(/\r?\n/).map((line) => line.trim()).filter((line) => line !== "");
  const withoutGreeting = lines.length > 1 && /^(dear|hello|hi|xin chào|kính gửi|chào)\b.*[,!]?$/i.test(lines[0]) && lines[0].length < 40 ? lines.slice(1) : lines;
  const text = withoutGreeting.join(" ").replace(/\s+/g, " ");
  if (text.length <= max) return text;
  return `${text.slice(0, max - 1).trimEnd()}\u2026`;
}

export type BodySegment = { kind: "text"; text: string } | { kind: "link"; url: string };

const URL_PATTERN = /https?:\/\/[^\s<>"']+/g;
const TRAILING_PUNCTUATION = /[.,;:!?)\]]+$/;

/** Splits a message body into plain text and addresses. An address is never turned into an `<a href>`. */
export function splitBody(body: string): BodySegment[] {
  const segments: BodySegment[] = [];
  let last = 0;
  for (const match of body.matchAll(URL_PATTERN)) {
    const start = match.index ?? 0;
    const url = match[0].replace(TRAILING_PUNCTUATION, "");
    if (start > last) segments.push({ kind: "text", text: body.slice(last, start) });
    segments.push({ kind: "link", url });
    last = start + url.length;
  }
  if (last < body.length) segments.push({ kind: "text", text: body.slice(last) });
  return segments;
}

export function linksOf(body: string): string[] {
  return splitBody(body).flatMap((segment) => (segment.kind === "link" ? [segment.url] : []));
}

/** The host part of an address, lower case (`pay.example/confirm` gives `pay.example`), or null. */
export function hostOf(url: string): string | null {
  const match = /^https?:\/\/([^/\s:?#]+)/i.exec(url.trim());
  return match ? match[1].toLowerCase() : null;
}

/**
 * Pages of the web live in the mail app's data (they arrive when a link is opened) but are not
 * messages. By convention their item id starts with `page.`; the Browser shows them, the inbox does not.
 */
export function isWebPageItem(item: Pick<DeviceItemView, "id">): boolean {
  return item.id.startsWith("page.");
}

export const MAIL_ALL = "all";

/** Folders that hold at least one message, in the order they first appear. */
export function mailFolders(messages: readonly Pick<DeviceItemView, "folder">[]): string[] {
  const seen: string[] = [];
  for (const message of messages) {
    if (message.folder !== null && !seen.includes(message.folder)) seen.push(message.folder);
  }
  return seen;
}

export function messagesIn(messages: readonly DeviceItemView[], folder: string): DeviceItemView[] {
  return folder === MAIL_ALL ? [...messages] : messages.filter((message) => message.folder === folder);
}

export function unreadCount(messages: readonly Pick<DeviceItemView, "read" | "tracksUnread">[]): number {
  return messages.filter((message) => message.tracksUnread && !message.read).length;
}
