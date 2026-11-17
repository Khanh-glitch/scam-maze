// Turns a stream of wheel or trackpad events into single steps (-1 up, +1 down).
//
// A trackpad keeps sending small events while a swipe coasts, so one swipe must be one step: after a
// step the stepper waits for a pause in the events, a swipe the other way, or a clearly stronger new
// push. A mouse wheel notch is 100 px or more and steps at once.
export type WheelStepper = (deltaY: number, deltaMode: number, now: number) => -1 | 0 | 1;
/** Pixels of scroll that make one step (events add up until they reach it). */
const STEP_PX = 40;
/** A pause in the events longer than this ends a swipe. */
const PAUSE_MS = 130;
export function createWheelStepper(): WheelStepper {
  const w = { acc: 0, last: 0, prev: 0, abs: 0, dir: 0, locked: false };
  return (deltaY, deltaMode, now) => {
    const dy = deltaY * (deltaMode === 1 ? 16 : 1);
    const gap = now - w.prev;
    const reversed = Math.sign(dy) !== Math.sign(w.dir) && Math.abs(dy) >= 8;
    const stronger = now - w.last > 300 && Math.abs(dy) > w.abs * 1.8 && Math.abs(dy) >= 30;
    if (w.locked && (gap > PAUSE_MS || reversed || stronger)) {
      w.locked = false;
      w.acc = 0;
    }
    w.prev = now;
    w.abs = Math.abs(dy);
    if (w.locked) return 0;
    if (gap > 350) w.acc = 0;
    w.acc += dy;
    if (Math.abs(w.acc) < STEP_PX) return 0;
    const step = w.acc > 0 ? 1 : -1;
    w.dir = w.acc;
    w.acc = 0;
    w.last = now;
    w.locked = true;
    return step;
  };
}
