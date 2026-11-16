// @vitest-environment jsdom
import { act, cleanup, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import type { GameSettings } from "@scammaze/shared-types";
import type { RoomStoryPort } from "./game/outside";

const engineState = vi.hoisted(() => ({
  emit: null as null | ((ui: Record<string, unknown>) => void),
  lastOptions: undefined as unknown,
}));

vi.mock("./game/engine", () => ({
  Engine: class {
    constructor(_el: HTMLElement, onUI: (ui: Record<string, unknown>) => void, _q: string, opts?: unknown) {
      engineState.emit = onUI;
      engineState.lastOptions = opts;
    }
    begin() {}
    lock() {}
    dispose() {}
    continueAfterEnd() {}
  },
}));

vi.mock("react-i18next", () => ({
  useTranslation: () => ({ t: (key: string) => key }),
}));

import { RoomV2Page } from "./RoomV2Page";

const settings = { graphicsQuality: "low" } as unknown as GameSettings;
const story = { label: () => null } as unknown as RoomStoryPort;
const baseUI = {
  prompt: null, anchor: null, focus: false, captions: [], inspecting: null, locked: true,
  fade: 0, ended: "answered", started: true, seated: false, cursorMode: false,
};

async function mount(props: Partial<React.ComponentProps<typeof RoomV2Page>>) {
  render(<RoomV2Page settings={settings} onBackToMenu={() => {}} {...props} />);
  await act(async () => { await new Promise((r) => setTimeout(r, 100)); });
}

describe("RoomV2Page story port", () => {
  beforeEach(() => { engineState.emit = null; engineState.lastOptions = undefined; });
  afterEach(cleanup);

  it("keeps the title card and the ending block without a story port", async () => {
    await mount({});
    expect(screen.getByText("roomv2.intro.title")).toBeTruthy();
    act(() => engineState.emit?.(baseUI));
    expect(screen.getByText("roomv2.ending.title")).toBeTruthy();
  });

  it("hides title card and ending, renders the overlay and passes the port to the engine", async () => {
    await mount({ story, overlay: <div>story-overlay</div> });
    expect(screen.queryByText("roomv2.intro.title")).toBeNull();
    expect(screen.getByText("story-overlay")).toBeTruthy();
    expect((engineState.lastOptions as { story?: unknown }).story).toBe(story);
    act(() => engineState.emit?.(baseUI));
    expect(screen.queryByText("roomv2.ending.title")).toBeNull();
  });
});
