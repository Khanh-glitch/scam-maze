// The Route 06 fare, as a core transaction. Money leaving the wallet must be a real reducer action
// with a ledger line, not a number the world sim keeps to itself.
import { describe, expect, it } from "vitest";
import { LAST_SUBMISSION_SCENARIO as S } from "./lastSubmission";
import { chapterReducer, createInitialState } from "../reducer";
import type { ChapterState, CoreAction } from "../types";
/**
 * The fare is duplicated here on purpose: `game/narrative/` must not import from `features/` (a
 * boundary test enforces it), and the transit sim must not import a number the core owns. A test
 * compares the two, so they cannot drift.
 */
const FARE = 7000;

const START: CoreAction = { type: "START_CHAPTER" };

function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  let state = from;
  for (const action of actions) {
    const result = chapterReducer(state, action, S);
    expect(result.accepted, `${action.type}: ${result.reason ?? ""}`).toBe(true);
    state = result.state;
  }
  return state;
}

const start = run([START]);

describe("PAY_FARE", () => {
  it("takes the fare out of the wallet and writes exactly one ledger line", () => {
    const state = run([{ type: "PAY_FARE", amount: FARE, label: "ledger.bus-fare", counterparty: "Route 06" }], start);
    expect(state.resources.cash).toBe(2_500_000 - FARE);
    expect(state.device.ledger).toHaveLength(1);
    expect(state.device.ledger[0]).toMatchObject({
      label: "ledger.bus-fare",
      amount: -FARE,
      counterparty: "Route 06",
    });
  });

  it("is refused without the cash, and changes nothing when refused", () => {
    const poor: ChapterState = { ...start, resources: { ...start.resources, cash: 1_000 } };
    const result = chapterReducer(poor, { type: "PAY_FARE", amount: FARE, label: "ledger.bus-fare" }, S);
    expect(result.accepted).toBe(false);
    expect(result.state.resources.cash).toBe(1_000);
    expect(result.state.device.ledger).toHaveLength(0);
  });

  it("rejects a zero, negative or fractional amount before it reaches the wallet", () => {
    for (const amount of [0, -7000, 7000.5, Number.NaN, Number.POSITIVE_INFINITY]) {
      const result = chapterReducer(start, { type: "PAY_FARE", amount, label: "ledger.bus-fare" } as CoreAction, S);
      expect(result.accepted, String(amount)).toBe(false);
      expect(result.state).toBe(start);
    }
  });

  it("is a payment, not a promise: it teaches nothing about the parcel", () => {
    const state = run([{ type: "PAY_FARE", amount: FARE, label: "ledger.bus-fare" }], start);
    expect(state.persistent).toEqual(start.persistent);
    expect(state.discovered).toEqual([]);
  });
});
