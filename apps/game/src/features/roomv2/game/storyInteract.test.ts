import { describe, expect, it } from 'vitest';
import {
  PROXY_YIELD_DEPTH,
  inspectDurationSec,
  laptopHitBox,
  laptopInteractRoute,
  pickHoverId,
  type HoverHit,
} from './storyInteract';

const hit = (id: string, distance: number, proxy = false): HoverHit => ({ id, proxy, distance });

describe('pickHoverId', () => {
  it('returns null without hits', () => {
    expect(pickHoverId([])).toBeNull();
  });

  it('returns the nearest normal hit unchanged', () => {
    expect(pickHoverId([hit('note', 1), hit('laptop', 1.2, true)])).toBe('note');
  });

  it('returns the laptop when only the proxy is hit (aim in the margin)', () => {
    expect(pickHoverId([hit('laptop', 1.5, true)])).toBe('laptop');
  });

  it('returns the laptop when the proxy and the real laptop are both hit', () => {
    expect(pickHoverId([hit('laptop', 1.5, true), hit('laptop', 1.6)])).toBe('laptop');
  });

  it('lets a real prop just behind the proxy win, so the proxy never steals the note', () => {
    expect(pickHoverId([hit('laptop', 1.5, true), hit('note', 1.5 + PROXY_YIELD_DEPTH / 2)])).toBe('note');
  });

  it('keeps the laptop when the other prop is far behind the proxy', () => {
    expect(pickHoverId([hit('laptop', 1.5, true), hit('fridge', 1.5 + PROXY_YIELD_DEPTH + 1)])).toBe('laptop');
  });
});

describe('laptopHitBox', () => {
  it('is larger than the laptop by the margin on both sides', () => {
    const box = laptopHitBox(0.32, 0.22, 0.23, 0.06);
    expect(box.width).toBeCloseTo(0.44);
    expect(box.depth).toBeCloseTo(0.34);
    expect(box.height).toBeCloseTo(0.29);
    expect(box.width).toBeGreaterThan(0.32);
  });
});

describe('laptopInteractRoute', () => {
  it('opens straight from standing when a story host is present', () => {
    expect(laptopInteractRoute(true, 'none')).toBe('inspect');
  });

  it('keeps the sit step without a story host', () => {
    expect(laptopInteractRoute(false, 'none')).toBe('sit');
  });

  it('inspects when already seated, with or without a host', () => {
    expect(laptopInteractRoute(false, 'seated')).toBe('inspect');
    expect(laptopInteractRoute(true, 'seated')).toBe('inspect');
  });
});

describe('inspectDurationSec', () => {
  it('shortens only the story laptop approach', () => {
    expect(inspectDurationSec(true, 'laptop', 1)).toBeLessThan(inspectDurationSec(false, 'laptop', 1));
    expect(inspectDurationSec(true, 'note', 1)).toBe(inspectDurationSec(false, 'note', 1));
  });

  it('keeps the return duration', () => {
    expect(inspectDurationSec(true, 'laptop', -1)).toBe(inspectDurationSec(false, 'laptop', -1));
  });
});
