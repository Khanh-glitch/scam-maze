// A 3D phone that is already loaded and compiled (the room mounts it on entry) does not flash the
// 2D screen while it draws its first frame; a cold or failed model still falls back quickly.
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { createChapterStore } from "../../../game/narrative/store";
import { getDisplayScenario } from "../../../i18n/narrative";
import { generateCallState } from "../../../test/callStates";
import { CallPresentation } from "./CallPresentation";
import { createPhoneScreenSink, type PhoneScreenSink } from "./phoneScreenSink";

/** A seed that brings a call onto the phone; the mode logic does not depend on which one. */
const SEED = 0x3d9c_0104;

function mount(sink: PhoneScreenSink, modelAllowed = true) {
  const generated = generateCallState(SEED);
  const element = (allowed: boolean) => (
    <CallPresentation
      store={createChapterStore(generated.state)}
      scenario={getDisplayScenario(generated.locale)}
      paused={false}
      modelAllowed={allowed}
      screenSink={sink}
      onAnswer={() => undefined}
      onEnd={() => undefined}
      onSelectOption={() => undefined}
    />
  );
  const utils = render(element(modelAllowed));
  return { rerender: (allowed: boolean) => utils.rerender(element(allowed)) };
}
const mode = () => screen.getByTestId("phone-screen-host").dataset.mode;

describe("CallPresentation with a warm 3D phone", () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => {
    cleanup();
    vi.useRealTimers();
  });

  it("falls back to the 2D screen after 200 ms when the model is not ready", () => {
    mount(createPhoneScreenSink());
    expect(mode()).toBe("pending");
    act(() => void vi.advanceTimersByTime(199));
    expect(mode()).toBe("pending");
    act(() => void vi.advanceTimersByTime(1));
    expect(mode()).toBe("fallback");
  });

  it("keeps waiting for a warm phone, and shows it as soon as its first frame arrives", () => {
    const sink = createPhoneScreenSink();
    sink.setWarm(true);
    mount(sink);
    act(() => void vi.advanceTimersByTime(600));
    expect(mode()).toBe("pending");
    act(() => sink.publish({ left: 10, top: 20, width: 200, height: 420 }));
    expect(mode()).toBe("model");
  });

  it("still falls back at once when a warm model is switched off (failure or context loss)", () => {
    const sink = createPhoneScreenSink();
    sink.setWarm(true);
    const view = mount(sink);
    act(() => view.rerender(false));
    expect(mode()).toBe("fallback");
  });

  it("gives up on a warm phone that never draws", () => {
    const sink = createPhoneScreenSink();
    sink.setWarm(true);
    mount(sink);
    act(() => void vi.advanceTimersByTime(1500));
    expect(mode()).toBe("fallback");
  });
});
