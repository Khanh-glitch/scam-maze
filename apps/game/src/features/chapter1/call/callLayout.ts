/**
 * Pure layout, pose and projection math for the call presentation.
 *
 * This module imports nothing from three, React or i18n, so the DOM components and the tests
 * can use it without a WebGL context. All rectangles are in CSS pixels, measured from the
 * top-left corner of the viewport. Poses are in camera space (meters): +x right, +y up, and the
 * camera looks down -z.
 */

/** Viewport size in CSS pixels. */
export interface Viewport {
  width: number;
  height: number;
}

/** Axis-aligned rectangle in CSS pixels. */
export interface Rect {
  left: number;
  top: number;
  width: number;
  height: number;
}

export interface CallLayout {
  /** `narrow` when the viewport is narrower than `NARROW_BREAKPOINT`. */
  kind: "narrow" | "wide";
  /** Target rectangle of the phone screen. */
  screen: Rect;
  /** Region for the choice overlay (its maximum size). */
  choice: Rect;
  /** Region for the caller subtitle overlay (its maximum size), apart from screen and choice. */
  subtitle: Rect;
  /** Screen corner radius in CSS pixels: `SCREEN_CORNER_RATIO * screen.width`. */
  screenCornerRadius: number;
}

/** Camera-space position (meters) of the screen center. `z` is negative (in front). */
export interface ScreenPose {
  x: number;
  y: number;
  z: number;
}

/** Width of the `OLED` screen primitive of the phone model, in meters. */
export const SCREEN_WIDTH_M = 0.0668;
/** Height of the `OLED` screen primitive of the phone model, in meters. */
export const SCREEN_HEIGHT_M = 0.1449;
/** Width divided by height of the phone screen (about 0.4610). */
export const SCREEN_ASPECT = SCREEN_WIDTH_M / SCREEN_HEIGHT_M;
/** Corner radius divided by width: 0.01174 m / 0.0668 m. */
export const SCREEN_CORNER_RATIO = 0.176;
/** Viewports narrower than this use the narrow layout (same as Tailwind `sm`). */
export const NARROW_BREAKPOINT = 640;
/** The phone screen is never taller than this, in CSS pixels. */
export const MAX_SCREEN_HEIGHT = 720;
/** The wide layout keeps at least this width for the choice region, in CSS pixels. */
export const MIN_CHOICE_WIDTH = 280;
/** The wide subtitle region (speaker name plus about five lines) is never taller than this, in CSS pixels. */
export const SUBTITLE_MAX_HEIGHT = 200;
/** The narrow layout never gives the subtitle more than this, in CSS pixels (a long line scrolls). */
export const NARROW_SUBTITLE_MAX_HEIGHT = 180;
/** The narrow layout gives the subtitle at least this height when room allows, in CSS pixels. */
export const SUBTITLE_MIN_HEIGHT = 56;
/** Share of the space below the screen that the narrow layout offers to the subtitle. */
export const SUBTITLE_NARROW_SHARE = 0.3;

const NARROW_MARGIN = 12;
const WIDE_MARGIN = 24;
const NARROW_MIN_SCREEN_HEIGHT = 288;
/**
 * The phone takes less than half of a narrow viewport so the reply list (up to 4 options) gets
 * the rest of the height. The reply region still scrolls when the replies do not fit.
 */
const NARROW_SCREEN_HEIGHT_RATIO = 0.45;
/** Leaves room above and below the glass so the whole phone body and its frame are visible. */
export const WIDE_SCREEN_HEIGHT_RATIO = 0.82;
/** The wide subtitle ends this far above the bottom edge (clear of the Ctrl/Esc footer strip), in CSS pixels. */
export const WIDE_BOTTOM_INSET = 56;
/** Gap between the response cards and the subtitle region, in CSS pixels. */
export const CHOICE_SUBTITLE_GAP = 12;
/** The wide choice region starts at this share of the height (or lower), so 4 cards always fit. */
export const WIDE_CHOICE_TOP_RATIO = 0.22;
/** Height of 4 cards (60 px, gap 8 px) plus the list padding (8 px), in CSS pixels. */
export const FOUR_CARDS_HEIGHT = 4 * 60 + 3 * 8 + 8;
/** Largest width of the response cards, from `CINE.widthPx.choice` (kept literal: this module imports nothing). */
export const MAX_CHOICE_WIDTH = 640;
/** Largest width of the bottom-left subtitle, from `CINE.widthPx.subtitle`. */
export const MAX_SUBTITLE_WIDTH = 760;
/** The wide layout keeps the cards and the subtitle this share of the width from the left edge. */
export const WIDE_LEFT_INSET_RATIO = 0.06;
/** Share of the width that the response cards and the subtitle try to use (about half). */
export const CHOICE_WIDTH_RATIO = 0.5;
export const SUBTITLE_WIDTH_RATIO = 0.5;
/** The wide layout leaves this share of the width to the right of the phone. */
export const WIDE_RIGHT_INSET_RATIO = 0.06;
/** Guard so the screen anchor can never reach the camera near plane (0.05 m). */
const MIN_POSE_DISTANCE_M = 0.06;

function screenRectOfHeight(height: number, left: number, top: number): Rect {
  return { left, top, width: height * SCREEN_ASPECT, height };
}

/** The held phone (P) stays clear of the bottom-right chip row by this much, in CSS pixels. */
export const HELD_BOTTOM_INSET = 72;
/** Height of the held phone's screen as a share of the viewport height, and its maximum in CSS pixels. */
export const HELD_SCREEN_HEIGHT_RATIO = 0.74;
export const HELD_MAX_SCREEN_HEIGHT = 700;
/** Center of the held phone's screen as a share of the viewport width. */
export const HELD_CENTER_X_RATIO = 0.58;

/**
 * Where the held phone's screen goes (the phone brought up with P, like in GTA): low, right of center,
 * clear of the chip row, so the room stays visible. Narrow viewports keep the call layout's screen.
 */
export function heldPhoneLayout(viewport: Viewport): CallLayout {
  const call = computeCallLayout(viewport);
  if (call.kind === "narrow") return call;
  const W = viewport.width;
  const H = viewport.height;
  const height = Math.min(HELD_SCREEN_HEIGHT_RATIO * H, HELD_MAX_SCREEN_HEIGHT, H - HELD_BOTTOM_INSET - WIDE_MARGIN);
  const width = height * SCREEN_ASPECT;
  // Where the right hand holds a phone in front of the player: right of center, not at the edge (owner).
  const left = Math.min(W - WIDE_MARGIN - width, HELD_CENTER_X_RATIO * W - width / 2);
  const screen = screenRectOfHeight(height, left, H - HELD_BOTTOM_INSET - height);
  return { ...call, screen, screenCornerRadius: SCREEN_CORNER_RATIO * width };
}

/** Computes the target phone screen rectangle and the choice region for a viewport. */
export function computeCallLayout(viewport: Viewport): CallLayout {
  const W = viewport.width;
  const H = viewport.height;

  if (W < NARROW_BREAKPOINT) {
    const m = NARROW_MARGIN;
    const height = Math.min(
      Math.max(NARROW_SCREEN_HEIGHT_RATIO * H, NARROW_MIN_SCREEN_HEIGHT),
      MAX_SCREEN_HEIGHT,
      (W - 2 * m) / SCREEN_ASPECT,
    );
    const width = height * SCREEN_ASPECT;
    const screen = screenRectOfHeight(height, (W - width) / 2, m);
    const screenBottom = screen.top + screen.height;
    // Space for subtitle + gap + choice, below the screen.
    const remaining = Math.max(0, H - screenBottom - 2 * m);
    const subtitleHeight = Math.min(
      remaining,
      NARROW_SUBTITLE_MAX_HEIGHT,
      Math.max(SUBTITLE_MIN_HEIGHT, Math.round(SUBTITLE_NARROW_SHARE * remaining)),
    );
    const subtitle: Rect = {
      left: m,
      top: screenBottom + m,
      width: W - 2 * m,
      height: subtitleHeight,
    };
    const choiceTop = subtitle.top + subtitleHeight + (subtitleHeight > 0 ? m : 0);
    const choice: Rect = {
      left: m,
      top: choiceTop,
      width: W - 2 * m,
      height: Math.max(0, H - m - choiceTop),
    };
    return {
      kind: "narrow",
      screen,
      choice,
      subtitle,
      screenCornerRadius: SCREEN_CORNER_RATIO * screen.width,
    };
  }

  // Cinematic framing: the phone sits right of center and large, and the left of the room stays
  // visible. The subtitle (name pill plus a bar) stands bottom-left with its left edge at 6
  // percent of the width. The response cards stand above it in the lower-left, bottom-anchored.
  const m = WIDE_MARGIN;
  const rightInset = Math.max(m, Math.round(WIDE_RIGHT_INSET_RATIO * W));
  const leftInset = Math.max(m, Math.round(WIDE_LEFT_INSET_RATIO * W));
  const height = Math.min(
    WIDE_SCREEN_HEIGHT_RATIO * H,
    MAX_SCREEN_HEIGHT,
    (W - leftInset - m - rightInset - MIN_CHOICE_WIDTH) / SCREEN_ASPECT,
  );
  const width = height * SCREEN_ASPECT;
  const screen = screenRectOfHeight(height, W - rightInset - width, (H - height) / 2);
  const freeWidth = screen.left - m - leftInset;

  const subtitleHeight = Math.min(SUBTITLE_MAX_HEIGHT, Math.max(0, H / 2 - 2 * m));
  const subtitleWidth = Math.min(freeWidth, MAX_SUBTITLE_WIDTH, Math.max(MIN_CHOICE_WIDTH, SUBTITLE_WIDTH_RATIO * W));
  // The subtitle ends WIDE_BOTTOM_INSET above the bottom edge, clear of the Ctrl/Esc footer strip.
  const subtitle: Rect = {
    left: leftInset,
    top: H - WIDE_BOTTOM_INSET - subtitleHeight,
    width: subtitleWidth,
    height: subtitleHeight,
  };
  // The cards stand right above the subtitle and may start high: room for 4 cards and narration.
  const choiceBottom = subtitle.top - CHOICE_SUBTITLE_GAP;
  const choiceTop = Math.min(choiceBottom, Math.max(m, Math.round(WIDE_CHOICE_TOP_RATIO * H)));
  const choice: Rect = {
    left: leftInset,
    top: choiceTop,
    width: Math.min(freeWidth, MAX_CHOICE_WIDTH, Math.max(MIN_CHOICE_WIDTH, CHOICE_WIDTH_RATIO * W)),
    height: Math.max(0, choiceBottom - choiceTop),
  };
  return {
    kind: "wide",
    screen,
    choice,
    subtitle,
    screenCornerRadius: SCREEN_CORNER_RATIO * screen.width,
  };
}

/** Area of the intersection of two rectangles; 0 when they only touch or are apart. */
export function rectsIntersectArea(a: Rect, b: Rect): number {
  const overlapX = Math.min(a.left + a.width, b.left + b.width) - Math.max(a.left, b.left);
  const overlapY = Math.min(a.top + a.height, b.top + b.height) - Math.max(a.top, b.top);
  if (overlapX <= 0 || overlapY <= 0) return 0;
  return overlapX * overlapY;
}

/** Half of the visible height (meters) at distance 1 for a vertical field of view in degrees. */
function tanHalfFov(fovDeg: number): number {
  return Math.tan((fovDeg * Math.PI) / 360);
}

/**
 * Camera-space position (meters) of the screen center so it projects onto `target`.
 *
 * The distance is `d = SCREEN_HEIGHT_M / (2 · tan(fov/2) · target.height / H)`, clamped to at
 * least 0.06 m as a guard (the clamp never applies to layouts from `computeCallLayout` with a
 * field of view from 60 to 85 degrees).
 */
export function solveScreenPose(target: Rect, viewport: Viewport, fovDeg: number): ScreenPose {
  const W = viewport.width;
  const H = viewport.height;
  const t = tanHalfFov(fovDeg);
  const d = Math.max(SCREEN_HEIGHT_M / ((2 * t * target.height) / H), MIN_POSE_DISTANCE_M);
  const halfHeightM = d * t;
  const halfWidthM = halfHeightM * (W / H);
  const centerX = target.left + target.width / 2;
  const centerY = target.top + target.height / 2;
  const ndcX = (centerX / W) * 2 - 1;
  const ndcY = 1 - (centerY / H) * 2;
  return { x: ndcX * halfWidthM, y: ndcY * halfHeightM, z: -d };
}

/** Pinhole projection of the screen anchor corners for a pose; the inverse of `solveScreenPose`. */
export function projectScreenRect(pose: ScreenPose, viewport: Viewport, fovDeg: number): Rect {
  const W = viewport.width;
  const H = viewport.height;
  const d = -pose.z;
  const halfHeightM = d * tanHalfFov(fovDeg);
  const pxPerMeter = H / 2 / halfHeightM;
  const centerX = W / 2 + pose.x * pxPerMeter;
  const centerY = H / 2 - pose.y * pxPerMeter;
  const width = SCREEN_WIDTH_M * pxPerMeter;
  const height = SCREEN_HEIGHT_M * pxPerMeter;
  return { left: centerX - width / 2, top: centerY - height / 2, width, height };
}
