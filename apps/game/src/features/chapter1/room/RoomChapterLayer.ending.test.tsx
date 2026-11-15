// RoomChapterLayer ending wiring tests, task 10.3. Requirements 10.1, 10.10, 16.1, 16.2, 16.3, 16.5.
// Decision panel -> ending transition -> debrief -> replay, with a fake bridge, jsdom and the real
// scenario. No WebGL, no network, no real audio.
import { act, fireEvent, render, screen, within } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import { DEFAULT_SETTINGS } from "../../../app/settingsStorage";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import { CHAPTER_1_SCENARIO } from "../../../game/narrative/chapter1/scenario";
import { createInitialState } from "../../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { CoreAction } from "../../../game/narrative/types";
import type { SaveGameSource, SaveReadResult } from "../../../game/saves/saveGame";
import { applyLocale } from "../../../i18n";
import enOutcome from "../../../i18n/locales/en/chapter1/outcome";
import { CALL_SAVED_CONTACT, DECLINE_ALEX, reachEndingA, reachEndingC } from "../../../test/chapterRuns";
import type { RoomStoryCommands } from "../../roomv2/game/outside";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

const DECISION = enOutcome.decision;
const DEBRIEF = enOutcome.debrief;
const DECISIONS = CHAPTER_1_SCENARIO.decisions;
const ENDINGS = CHAPTER_1_SCENARIO.endings;

function fakeCommands() {
  return {
    setPhoneMode: vi.fn(),
    ring: vi.fn(),
    setLaptopFrame: vi.fn(),
    chime: vi.fn(),
    setMood: vi.fn(),
    closeInspect: vi.fn(),
    setCursorMode: vi.fn(),
  } satisfies RoomStoryCommands;
}

const SESSION: ChapterSession = { chapterId: "chapter-1", chapterNumber: 1, sceneId: "apartment", origin: "new-game" };
const START: CoreAction = { type: "START_CHAPTER" };

/** Alex and the third caller declined: Act V, decisions offered. */
const ACT_FIVE: CoreAction[] = [
  START,
  ...DECLINE_ALEX,
  { type: "DEVICE_ACTION", deviceActionId: "dev.dismiss-notification" },
  { type: "RING_CALL", callId: "call.recovery", reason: "follow-up" },
  { type: "END_CALL" },
];

interface Rig {
  store: () => ChapterStore;
  clear: ReturnType<typeof vi.fn>;
  onReturnToMenu: ReturnType<typeof vi.fn>;
}

function setup(restoreActions: readonly CoreAction[]): Rig {
  const bridge = new RoomStoryBridge();
  bridge.commands = fakeCommands();
  const clear = vi.fn(() => true);
  const saveSource: SaveGameSource = {
    read: (): SaveReadResult => ({ status: "none" }),
    write: () => true,
    clear,
  };
  const onReturnToMenu = vi.fn();
  let store: ChapterStore | null = null;

  const scratch = createChapterStore(createInitialState());
  for (const action of restoreActions) {
    const result = scratch.dispatch(action);
    if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
  }
  const session: ChapterSession = { ...SESSION, origin: "saved-game", restored: { state: scratch.getState(), pose: null } };

  render(
    <RoomChapterLayer
      session={session}
      settings={DEFAULT_SETTINGS}
      bridge={bridge}
      saveSource={saveSource}
      ringSettleMs={0}
      onReturnToMenu={onReturnToMenu}
      onStoreReady={(s) => {
        store = s;
      }}
    />,
  );
  return {
    clear,
    onReturnToMenu,
    store: () => {
      if (!store) throw new Error("store not ready");
      return store;
    },
  };
}

function finishIntro() {
  for (let i = 0; i < 12; i += 1) {
    const intro = screen.queryByTestId("chapter-intro");
    if (!intro) return;
    fireEvent.click(intro);
  }
  throw new Error("intro did not close");
}

function dispatch(rig: Rig, ...actions: CoreAction[]) {
  for (const action of actions) {
    act(() => {
      const result = rig.store().dispatch(action);
      if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    });
  }
}

const decisionDialog = () => screen.getByRole("dialog", { name: DECISION.heading });

beforeEach(() => {
  act(() => {
    applyLocale("en");
  });
});

afterEach(() => {
  document.body.innerHTML = "";
});

describe("decision panel opening", () => {
  it("opens when Act V offers decisions and the room is free, and stays closed after Close until Decide is chosen", () => {
    const rig = setup(ACT_FIVE);
    expect(screen.queryByRole("dialog", { name: DECISION.heading })).toBeNull();
    finishIntro();
    expect(rig.store().getState().outcome).toBeNull();
    expect(decisionDialog()).toBeTruthy();
    // Five decisions, all outside the phone.
    for (const id of Object.keys(DECISIONS) as Array<keyof typeof DECISIONS>) {
      expect(within(decisionDialog()).getByRole("button", { name: DECISIONS[id].label })).toBeTruthy();
    }

    fireEvent.click(within(decisionDialog()).getByRole("button", { name: DECISION.close }));
    expect(screen.queryByRole("dialog", { name: DECISION.heading })).toBeNull();

    // The journal offers "Decide" and the panel opens again.
    fireEvent.click(screen.getByRole("button", { name: /^Journal/ }));
    const journal = screen.getByRole("dialog", { name: /journal/i });
    fireEvent.click(within(journal).getByRole("button", { name: "Decide" }));
    expect(decisionDialog()).toBeTruthy();
    expect(screen.queryByRole("dialog", { name: /journal/i })).toBeNull();
  });

  it("does not open before Act V", () => {
    setup([START, ...DECLINE_ALEX]);
    finishIntro();
    expect(screen.queryByRole("dialog", { name: DECISION.heading })).toBeNull();
  });
});

describe("decision, ending, debrief and replay", () => {
  it("runs the verify route to the break-the-chain ending, the debrief and a fresh replay", () => {
    const rig = setup([...ACT_FIVE, CALL_SAVED_CONTACT[0]]);
    finishIntro();

    // Pre-step: calls the saved number. The panel gives way to the call and returns afterwards.
    fireEvent.click(within(decisionDialog()).getByRole("button", { name: DECISIONS["verify-independently"].preStep!.label }));
    expect(rig.store().getState().call.current).toBe("call.official");
    expect(screen.queryByRole("dialog", { name: DECISION.heading })).toBeNull();
    dispatch(rig, ...CALL_SAVED_CONTACT.slice(2));
    expect(rig.store().getState().call.current).toBeNull();
    fireEvent.click(within(decisionDialog()).getByRole("button", { name: DECISIONS["verify-independently"].label }));
    fireEvent.click(within(screen.getByRole("dialog", { name: DECISION.confirmHeading })).getByRole("button", { name: DECISION.confirm }));
    expect(rig.store().getState().outcome).toBe("break-the-chain");

    // Ending transition with the aftermath of this ending.
    const ending = screen.getByTestId("ending-transition");
    const aftermath = ENDINGS["break-the-chain"].aftermath;
    expect(screen.queryByRole("dialog", { name: DECISION.heading })).toBeNull();
    expect(within(ending).getByText(aftermath.phone)).toBeTruthy();
    expect(within(ending).getByText(aftermath.laptop)).toBeTruthy();
    expect(within(ending).getByText(aftermath.evidenceSummary)).toBeTruthy();
    expect(within(ending).getByTestId("ending-aftermath-consequence").textContent).toBe(aftermath.consequence);
    // Narration shows the first aftermath line while it plays.
    const firstLine = CHAPTER_1_SCENARIO.dialogues["dlg.aftermath"].lines["line.after.c.1"];
    expect(within(ending).getByTestId("ending-narration").textContent).toContain(firstLine);

    fireEvent.click(within(ending).getByRole("button", { name: enOutcome.ending.continue }));
    expect(rig.store().getState().status).toBe("finished");
    expect(screen.queryByTestId("ending-transition")).toBeNull();
    const debrief = screen.getByTestId("debrief-screen");
    expect(debrief.getAttribute("data-outcome")).toBe("break-the-chain");
    expect(within(debrief).getByTestId("debrief-timeline")).toBeTruthy();
    expect(within(debrief).getByTestId("debrief-analysis")).toBeTruthy();
    // No case report without the secret variant.
    expect(within(debrief).queryByTestId("debrief-case-report")).toBeNull();

    // Replay: fresh state, chapter started, saved progress cleared, no page reload.
    fireEvent.click(within(debrief).getByRole("button", { name: DEBRIEF.replay }));
    expect(rig.clear).toHaveBeenCalledTimes(1);
    expect(screen.queryByTestId("debrief-screen")).toBeNull();
    const fresh = rig.store().getState();
    expect(fresh.status).toBe("playing");
    expect(fresh.outcome).toBeNull();
    expect(fresh.decision).toBeNull();
    expect(fresh.discovered).toEqual([]);
    expect(fresh.events[0].action).toEqual(START);
    expect(fresh.events.map((entry) => entry.action.type)).toEqual(["START_CHAPTER", "RING_CALL"]);
    // The first call rings again from the start of the chapter.
    expect(fresh.call.status).toBe("ringing");
    expect(fresh.call.current).toBe("call.alex");
  });

  it("Return to menu calls the host", () => {
    const rig = setup(reachEndingA().actions);
    fireEvent.click(within(screen.getByTestId("debrief-screen")).getByRole("button", { name: DEBRIEF.returnToMenu }));
    expect(rig.onReturnToMenu).toHaveBeenCalledTimes(1);
  });

  it("a finished run restores straight to the debrief", () => {
    const rig = setup(reachEndingA().actions);
    expect(screen.queryByTestId("chapter-intro")).toBeNull();
    expect(screen.queryByTestId("ending-transition")).toBeNull();
    expect(screen.getByTestId("debrief-screen").getAttribute("data-outcome")).toBe("false-victory");
    expect(rig.store().getState().status).toBe("finished");
  });

  it("shows the case report in the secret variant only", () => {
    setup(reachEndingC({ caseReport: true }).actions);
    const debrief = screen.getByTestId("debrief-screen");
    expect(within(debrief).getByTestId("debrief-case-report").textContent).toBe(ENDINGS["break-the-chain"].aftermath.caseReport);
  });

  it("an ended run restores to the ending transition and Continue opens the debrief", () => {
    const run = reachEndingA();
    const withoutFinish = run.actions.slice(0, -1);
    const rig = setup(withoutFinish);
    expect(rig.store().getState().status).toBe("ended");
    finishIntro();
    const ending = screen.getByTestId("ending-transition");
    expect(ending.getAttribute("data-outcome")).toBe("false-victory");
    fireEvent.click(within(ending).getByRole("button", { name: enOutcome.ending.continue }));
    expect(screen.getByTestId("debrief-screen")).toBeTruthy();
  });
});
