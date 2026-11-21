import { describe, expect, it } from "vitest";
import {
  appStatus,
  desktopEscape,
  desktopReducer,
  INITIAL_DESKTOP_STATE,
  isDesktopState,
  isRunning,
  type DesktopAction,
  type DesktopState,
} from "./desktopState";

function run(actions: DesktopAction[], from: DesktopState = INITIAL_DESKTOP_STATE): DesktopState {
  return actions.reduce(desktopReducer, from);
}

describe("desktopReducer", () => {
  it("starts on the home screen with nothing running", () => {
    expect(INITIAL_DESKTOP_STATE.activeId).toBeNull();
    expect(INITIAL_DESKTOP_STATE.windows).toHaveLength(0);
  });

  it("opens an app once and makes it the active window", () => {
    const state = run([{ type: "open", id: "mail" }, { type: "open", id: "mail" }]);
    expect(state.windows).toEqual([{ id: "mail", minimized: false }]);
    expect(state.activeId).toBe("mail");
  });

  it("switches between apps and keeps the others running", () => {
    const state = run([{ type: "open", id: "mail" }, { type: "open", id: "files" }]);
    expect(state.activeId).toBe("files");
    expect(isRunning(state, "mail")).toBe(true);
    expect(appStatus(state, "mail")).toBe("open");
    expect(appStatus(state, "files")).toBe("active");
    expect(appStatus(state, "bank")).toBe("closed");
  });

  it("goes back to the desktop without closing the app", () => {
    const state = run([{ type: "open", id: "mail" }, { type: "home" }]);
    expect(state.activeId).toBeNull();
    expect(appStatus(state, "mail")).toBe("open");
  });

  it("minimizes to the taskbar and restores on open", () => {
    const minimized = run([{ type: "open", id: "mail" }, { type: "minimize", id: "mail" }]);
    expect(minimized.activeId).toBeNull();
    expect(appStatus(minimized, "mail")).toBe("minimized");
    const restored = desktopReducer(minimized, { type: "open", id: "mail" });
    expect(appStatus(restored, "mail")).toBe("active");
  });

  it("closing removes the app, and closing another app leaves the active one", () => {
    const state = run([{ type: "open", id: "mail" }, { type: "open", id: "files" }, { type: "close", id: "mail" }]);
    expect(state.windows.map((w) => w.id)).toEqual(["files"]);
    expect(state.activeId).toBe("files");
    const none = desktopReducer(state, { type: "close", id: "files" });
    expect(none.activeId).toBeNull();
    expect(none.windows).toHaveLength(0);
  });

  it("returns the same object for changes that do nothing", () => {
    const state = run([{ type: "open", id: "mail" }]);
    expect(desktopReducer(state, { type: "close", id: "bank" })).toBe(state);
    expect(desktopReducer(state, { type: "minimize", id: "bank" })).toBe(state);
    expect(desktopReducer(INITIAL_DESKTOP_STATE, { type: "home" })).toBe(INITIAL_DESKTOP_STATE);
    expect(desktopReducer(state, { type: "sync", validIds: ["mail"] })).toBe(state);
  });

  it("drops windows of apps that left the laptop", () => {
    const state = run([{ type: "open", id: "mail" }, { type: "open", id: "bank" }, { type: "sync", validIds: ["mail"] }]);
    expect(state.windows.map((w) => w.id)).toEqual(["mail"]);
    expect(state.activeId).toBeNull();
  });

  it("never mutates the state it was given", () => {
    const state = run([{ type: "open", id: "mail" }]);
    const copy = JSON.parse(JSON.stringify(state)) as DesktopState;
    desktopReducer(state, { type: "minimize", id: "mail" });
    desktopReducer(state, { type: "close", id: "mail" });
    expect(state).toEqual(copy);
  });
});

describe("desktopEscape", () => {
  it("leaves an open app for the desktop and uses the key", () => {
    const state = run([{ type: "open", id: "mail" }]);
    const result = desktopEscape(state);
    expect(result.consumed).toBe(true);
    expect(result.state.activeId).toBeNull();
    expect(isRunning(result.state, "mail")).toBe(true);
  });

  it("is not used on the desktop, so the laptop closes", () => {
    const result = desktopEscape(INITIAL_DESKTOP_STATE);
    expect(result.consumed).toBe(false);
    expect(result.state).toBe(INITIAL_DESKTOP_STATE);
  });
});

describe("isDesktopState", () => {
  it("accepts its own states and rejects other values", () => {
    expect(isDesktopState(INITIAL_DESKTOP_STATE)).toBe(true);
    expect(isDesktopState(run([{ type: "open", id: "mail" }]))).toBe(true);
    expect(isDesktopState(null)).toBe(false);
    expect(isDesktopState({ windows: [{ id: 1, minimized: false }], activeId: null })).toBe(false);
    expect(isDesktopState({ windows: [], activeId: 3 })).toBe(false);
  });
});
