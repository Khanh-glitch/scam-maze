import { describe, expect, it, vi } from "vitest";
import { FIXTURE_SCENARIO, fixtureState, withFlags } from "../../../test/fixtureScenario";
import type { ChapterState } from "../../../game/narrative/types";
import {
  applyPresentation,
  LAPTOP_FRAME_KEYS,
  roomPresentation,
  type PresentationSink,
  type RoomPresentation,
} from "./roomPresentation";

const present = (state: ChapterState): RoomPresentation => roomPresentation(state, FIXTURE_SCENARIO);
const withCall = (state: ChapterState, status: ChapterState["call"]["status"]): ChapterState => ({
  ...state,
  call: { ...state.call, current: status === "idle" ? null : "call.alex", status },
});
const sink = (): PresentationSink => ({
  setPhoneMode: vi.fn(),
  ring: vi.fn(),
  setLaptopFrame: vi.fn(),
  chime: vi.fn(),
  setMood: vi.fn(),
});

describe("roomPresentation", () => {
  it("is calm and quiet on the phone when idle", () => {
    expect(present(fixtureState())).toEqual({ phoneMode: "lock", ringing: false, laptopFrame: null, mood: "calm" });
  });

  it("rings and goes tense for an incoming call", () => {
    const p = present(withCall(fixtureState(), "ringing"));
    expect(p).toMatchObject({ phoneMode: "ringing", ringing: true, mood: "tense" });
  });

  it("uses call mode without ringing for an active call", () => {
    const p = present(withCall(fixtureState(), "active"));
    expect(p).toMatchObject({ phoneMode: "call", ringing: false, mood: "tense" });
  });

  it("shows the new card until the notification is handled, then the opened card", () => {
    const fresh = withFlags(fixtureState(), ["notification_delivered"]);
    expect(present(fresh).laptopFrame).toEqual(LAPTOP_FRAME_KEYS.new);
    const handled = withFlags(fresh, ["notification_opened", "notification_handled"]);
    expect(present(handled).laptopFrame).toEqual(LAPTOP_FRAME_KEYS.opened);
  });

  it("uses a quiet mood after the ending", () => {
    expect(present(fixtureState({ status: "ended", outcome: "false-victory" })).mood).toBe("quiet");
  });

  it("is equal for equal states", () => {
    const state = withFlags(fixtureState(), ["notification_delivered"]);
    expect(present(state)).toEqual(present({ ...state }));
  });
});

describe("applyPresentation", () => {
  it("sends everything except the chime on the first call", () => {
    const commands = sink();
    applyPresentation(null, present(fixtureState()), commands);
    expect(commands.setPhoneMode).toHaveBeenCalledWith("lock");
    expect(commands.ring).toHaveBeenCalledWith(false);
    expect(commands.setLaptopFrame).toHaveBeenCalledWith(null);
    expect(commands.setMood).toHaveBeenCalledWith("calm");
    expect(commands.chime).not.toHaveBeenCalled();
  });

  it("issues nothing when nothing changed", () => {
    const commands = sink();
    const p = present(fixtureState());
    applyPresentation(p, present(fixtureState()), commands);
    for (const fn of Object.values(commands)) expect(fn).not.toHaveBeenCalled();
  });

  it("issues only the diffs when a call starts ringing", () => {
    const commands = sink();
    applyPresentation(present(fixtureState()), present(withCall(fixtureState(), "ringing")), commands);
    expect(commands.setPhoneMode).toHaveBeenCalledWith("ringing");
    expect(commands.ring).toHaveBeenCalledWith(true);
    expect(commands.setMood).toHaveBeenCalledWith("tense");
    expect(commands.setLaptopFrame).not.toHaveBeenCalled();
    expect(commands.chime).not.toHaveBeenCalled();
  });

  it("chimes once when the notification arrives, not when it is handled", () => {
    const commands = sink();
    const idle = present(fixtureState());
    const fresh = present(withFlags(fixtureState(), ["notification_delivered"]));
    applyPresentation(idle, fresh, commands);
    expect(commands.chime).toHaveBeenCalledTimes(1);
    expect(commands.setLaptopFrame).toHaveBeenCalledWith(LAPTOP_FRAME_KEYS.new);

    const handled = present(withFlags(fixtureState(), ["notification_delivered", "notification_handled"]));
    applyPresentation(fresh, handled, commands);
    expect(commands.chime).toHaveBeenCalledTimes(1);
    expect(commands.setLaptopFrame).toHaveBeenLastCalledWith(LAPTOP_FRAME_KEYS.opened);
  });
});
