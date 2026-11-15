/**
 * Pure helpers for the story-mode (`options.story`) interaction tweaks of the room: a forgiving
 * laptop hit area, the one-press laptop open and the short laptop camera move. No three.js here,
 * so the rules are unit-testable. Standalone `/roomv2` never uses them.
 */

/** One raycast hit in distance order, reduced to what the picking rule needs. */
export interface HoverHit {
  id: string;
  /** True for the invisible widened hit area (never a visible mesh). */
  proxy: boolean;
  distance: number;
}

/** How far behind the proxy another real prop may sit and still win over the proxy (metres). */
export const PROXY_YIELD_DEPTH = 0.25;

/**
 * Chooses the hovered prop id from hits sorted by distance.
 * A normal hit wins as is. When the nearest hit is a hit proxy, a real hit on the same prop wins
 * (the player aims straight at it), then a different real prop just behind the proxy (so the
 * proxy never steals the note or receipts), and only then the proxy's own prop.
 */
export function pickHoverId(hits: readonly HoverHit[]): string | null {
  const first = hits[0];
  if (!first) return null;
  if (!first.proxy) return first.id;
  if (hits.some((h) => !h.proxy && h.id === first.id)) return first.id;
  const other = hits.find((h) => !h.proxy && h.id !== first.id && h.distance <= first.distance + PROXY_YIELD_DEPTH);
  return other ? other.id : first.id;
}

export interface HitBoxSize {
  width: number;
  height: number;
  depth: number;
  /** Centre height above the laptop base. */
  centerY: number;
}

/** Size of the widened laptop hit box: the laptop body plus `margin` on every horizontal side and on top. */
export function laptopHitBox(bodyWidth: number, bodyDepth: number, lidHeight: number, margin: number): HitBoxSize {
  const height = lidHeight + margin;
  return { width: bodyWidth + margin * 2, depth: bodyDepth + margin * 2, height, centerY: height / 2 - 0.01 };
}

export type LaptopRoute = 'inspect' | 'sit';

/**
 * What pressing the interact key on the laptop does. With a story host the laptop opens straight
 * from standing; without one it keeps the original two steps (sit down, then look).
 */
export function laptopInteractRoute(hasStoryPort: boolean, seat: 'none' | 'sitting' | 'seated' | 'standing'): LaptopRoute {
  if (hasStoryPort || seat === 'seated') return 'inspect';
  return 'sit';
}

/** Seconds the camera takes to reach an inspect pose (dir 1) or to return from it (dir -1). */
export function inspectDurationSec(hasStoryPort: boolean, id: string, dir: 1 | -1): number {
  if (dir === -1) return 0.9;
  return hasStoryPort && id === 'laptop' ? 0.8 : 1.15;
}
