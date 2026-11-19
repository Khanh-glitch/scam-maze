// Integration tests for the Checkpoint_Saver hook (re-enabled in task 12.4 with the rebuilt scenario).
// Requirements 17.6 and 17.7 of chapter-01-double-deception (checkpoints and restore).
//
// The hook runs against a real Chapter_Store and an in-memory SaveGameSource, so every write
// goes through `encodeProgress` and can be replayed with `restoreProgress`.

import { act, renderHook } from "@testing-library/react";
import { describe, expect, it, vi } from "vitest";
import { createInitialState } from "../../game/narrative/reducer";
import { createChapterStore, type ChapterStore } from "../../game/narrative/store";
import { reachEndingA } from "../../test/chapterRuns";
import type { CoreAction } from "../../game/narrative/types";
import { restoreProgress } from "../../game/saves/chapterProgress";
import {
  SAVE_FORMAT_VERSION_V3,
  type SaveGameSource,
  type SaveReadResult,
  type SavedGameV3,
  type SavedPlayerPose,
} from "../../game/saves/saveGame";
import { DEBRIEF_CHECKPOINT_ID, objectiveCheckpointId, useCheckpointSaver } from "./useCheckpointSaver";

/** A complete accepted run of the rebuilt chapter: START_CHAPTER ... FINISH_CHAPTER. */
const RUN: readonly CoreAction[] = reachEndingA().actions;
const START: CoreAction = { type: "START_CHAPTER" };
const RING_ALEX: CoreAction = { type: "RING_CALL", callId: "call.alex", reason: "first-interaction" };

/** In-memory save source. `setWritable(false)` makes writes fail like blocked storage. */
function createMemorySaveSource() {
  let saved: SavedGameV3 | null = null;
  let writable = true;
  const source = {
    read: vi.fn((): SaveReadResult => (saved ? { status: "valid", save: saved } : { status: "none" })),
    write: vi.fn((save: SavedGameV3) => {
      if (!writable) return false;
      saved = save;
      return true;
    }),
    clear: vi.fn(() => {
      saved = null;
      return true;
    }),
  } satisfies SaveGameSource;
  return {
    source,
    saved: () => saved,
    setWritable: (value: boolean) => {
      writable = value;
    },
  };
}

function setup(pose: SavedPlayerPose | null = null) {
  const store = createChapterStore(createInitialState());
  const memory = createMemorySaveSource();
  const onWriteFailure = vi.fn();
  const poseGetterRef = { current: pose ? () => pose : null };
  const hook = renderHook(() =>
    useCheckpointSaver({
      store,
      saveSource: memory.source,
      poseGetterRef,
      chapterId: "chapter-1",
      sceneId: "apartment",
      onWriteFailure,
    }),
  );
  return { store, memory, onWriteFailure, hook };
}

function dispatchAll(store: ChapterStore, actions: readonly CoreAction[]) {
  act(() => {
    for (const action of actions) {
      const result = store.dispatch(action);
      if (!result.accepted) throw new Error(`Rejected ${JSON.stringify(action)}: ${result.reason}`);
    }
  });
}

const writeCount = (memory: ReturnType<typeof createMemorySaveSource>) => memory.source.write.mock.calls.length;
const lastWrite = (memory: ReturnType<typeof createMemorySaveSource>) => {
  const call = memory.source.write.mock.calls.at(-1);
  if (!call) throw new Error("Nothing was written");
  return call[0];
};
const callInProgress = (store: ChapterStore) => {
  const status = store.getState().call.status;
  return status === "ringing" || status === "active";
};

describe("useCheckpointSaver", () => {
  it("starts from a run that begins with START_CHAPTER and ends with FINISH_CHAPTER", () => {
    expect(RUN[0]).toEqual(START);
    expect(RUN.at(-1)).toEqual({ type: "FINISH_CHAPTER" });
  });

  it("writes nothing before START_CHAPTER", () => {
    const { store, memory } = setup();
    // A rejected action does not notify; a replace to the initial state does.
    act(() => {
      store.dispatch({ type: "END_CALL" });
      store.replace(createInitialState());
    });
    expect(writeCount(memory)).toBe(0);
  });

  it("writes a replayable Checkpoint on START_CHAPTER", () => {
    const { store, memory } = setup();
    dispatchAll(store, [START]);
    expect(writeCount(memory)).toBe(1);
    const first = lastWrite(memory);
    expect(first).toMatchObject({ formatVersion: SAVE_FORMAT_VERSION_V3, chapterId: "chapter-1", sceneId: "apartment" });
    expect(first.progress.checkpointId).toBe(objectiveCheckpointId(store.getState()));
    const restored = restoreProgress(first.progress);
    if (!restored.ok) throw new Error(restored.reason);
    expect(restored.state.objectives).toEqual(store.getState().objectives);
  });

  it("never writes during a call, and the last Checkpoint matches the objectives once the call is over", () => {
    const { store, memory } = setup();
    let writesDuringCalls = 0;
    for (const action of RUN.slice(0, -1)) {
      const before = writeCount(memory);
      dispatchAll(store, [action]);
      if (callInProgress(store)) {
        writesDuringCalls += writeCount(memory) - before;
        continue;
      }
      const restored = restoreProgress(lastWrite(memory).progress);
      if (!restored.ok) throw new Error(restored.reason);
      // The deferred difference of a call is written as soon as the call is over.
      expect(restored.state.objectives).toEqual(store.getState().objectives);
    }
    expect(writesDuringCalls).toBe(0);
    expect(writeCount(memory)).toBeGreaterThan(1);
  });

  it('writes checkpoint "debrief" once after FINISH_CHAPTER', () => {
    const { store, memory } = setup();
    dispatchAll(store, RUN.slice(0, -1));
    const before = writeCount(memory);

    dispatchAll(store, RUN.slice(-1));
    expect(writeCount(memory)).toBe(before + 1);
    expect(lastWrite(memory).progress.checkpointId).toBe(DEBRIEF_CHECKPOINT_ID);
    const restored = restoreProgress(lastWrite(memory).progress);
    expect(restored.ok && restored.state.status).toBe("finished");

    // Further notifications in the finished state do not write again.
    act(() => store.replace(store.getState()));
    expect(writeCount(memory)).toBe(before + 1);
  });

  it("reports a write failure once per failure streak and keeps going", () => {
    const { store, memory, onWriteFailure } = setup();
    memory.setWritable(false);
    dispatchAll(store, [START]);
    expect(writeCount(memory)).toBe(1);
    expect(onWriteFailure).toHaveBeenCalledTimes(1);
    expect(store.getState().status).toBe("playing");

    // A success ends the streak; the next failure is reported again.
    memory.setWritable(true);
    dispatchAll(store, RUN.slice(1, -1));
    expect(memory.saved()).not.toBeNull();
    expect(onWriteFailure).toHaveBeenCalledTimes(1);

    memory.setWritable(false);
    dispatchAll(store, RUN.slice(-1));
    expect(onWriteFailure).toHaveBeenCalledTimes(2);
  });

  it("saveNow writes the current state and pose only while playing with no call in progress", () => {
    const pose: SavedPlayerPose = { position: [1, 0, 2], yaw: 0.5 };
    const { store, memory, hook } = setup(pose);

    expect(hook.result.current.saveNow()).toBe(false);
    expect(writeCount(memory)).toBe(0);

    dispatchAll(store, [START]);
    const before = writeCount(memory);
    let ok = false;
    act(() => {
      ok = hook.result.current.saveNow();
    });
    expect(ok).toBe(true);
    expect(writeCount(memory)).toBe(before + 1);
    expect(lastWrite(memory).progress.checkpointId).toBe(objectiveCheckpointId(store.getState()));
    expect(lastWrite(memory).progress.playerPose?.yaw).toBe(0.5);

    dispatchAll(store, [RING_ALEX]);
    expect(hook.result.current.saveNow()).toBe(false);
    expect(writeCount(memory)).toBe(before + 1);
  });
});

describe("free-roam saves", () => {
  const TICK: CoreAction = { type: "ADVANCE_TIME", minutes: 5 };

  it("saves about every 15 simulated minutes of free roam, not on every tick", () => {
    const { store, memory } = setup();
    // The first tick leaves the 15-minute window of the start time, so it saves once.
    dispatchAll(store, [START, TICK]);
    const base = writeCount(memory);
    expect(base).toBeGreaterThan(0);
    dispatchAll(store, [TICK, TICK]);
    expect(writeCount(memory)).toBe(base);
    dispatchAll(store, [TICK, TICK, TICK]);
    expect(writeCount(memory)).toBe(base + 1);
    const restored = restoreProgress(memory.saved()!.progress);
    expect(restored.ok && restored.state.resources.timeMinutes).toBe(72 * 60 - 20); // the state at the last automatic save
  });

  it("saves the latest state when the room is left, so Continue keeps the time that passed", () => {
    const { store, memory, hook } = setup();
    dispatchAll(store, [START, TICK]);
    const before = writeCount(memory);
    hook.unmount();
    expect(writeCount(memory)).toBe(before + 1);
    const restored = restoreProgress(memory.saved()!.progress);
    expect(restored.ok && restored.state.resources.timeMinutes).toBe(72 * 60 - 5);
  });

  it("writes nothing on leaving before the chapter started", () => {
    const { memory, hook } = setup();
    hook.unmount();
    expect(writeCount(memory)).toBe(0);
  });
});