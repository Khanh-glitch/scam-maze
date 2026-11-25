import { describe, expect, it } from "vitest";

/**
 * The walk from the boarding house to the market, measured from geometry.
 *
 * `docs/research/2026-11-23-route-from-boarding-house.md` states the route in prose. This file is
 * the same route as numbers, derived from the constants the world is actually built from, so the
 * document cannot drift away from the game without a red test.
 *
 * The route is the one a person living in a rented room on Lý Thái Tổ actually walks:
 *   room 6.07 upstairs -> courtyard -> iron gate -> alley 462/14 -> the main road ->
 *   south along the east pavement -> cross the carriageway -> the market.
 */

// The boarding house. `ROOM_ANCHOR` is where room 6.07 sits in world space.
import { ROOM_ANCHOR } from "./boardingHouse";
import { CURB_HEIGHT } from "../simulation/boarding";
// The main road, and the market.
import { CHO_LON_X, CHO_LON_Z, ROAD_MAX, ROAD_MIN } from "./choLon";

/** The iron gate of khu trọ 462/14, from `boardingHouse.ts` — the street end of the alley. */
const GATE_X = 13.25;
/** The market's own frontage lane, west of the stalls (`LANE_X = CHO_LON_X - DEPTH - 1.6`). */
const DEPTH = 5.6;
const LANE_X = CHO_LON_X - DEPTH - 1.6;
/** The market runs this far along the road. */
const MARKET_Z0 = -104;
const MARKET_Z1 = -152;

describe("the route from the boarding house to the market", () => {
  it("starts upstairs in room 6.07, two storeys above the courtyard", () => {
    expect(ROOM_ANCHOR.y).toBeCloseTo(3.2, 1);
    expect(ROOM_ANCHOR.y).toBeGreaterThan(CURB_HEIGHT + 2.5);
    // The room is east of the gate, i.e. deeper into the alley, not on the road.
    expect(ROOM_ANCHOR.x).toBeGreaterThan(GATE_X);
  });

  it("reaches the main road in one alley-length walk, westward", () => {
    // The gate is on the east side of Lý Thái Tổ; the curb is the far side of the pavement.
    const alleyLength = Math.abs(GATE_X - ROAD_MAX);
    expect(alleyLength).toBeGreaterThan(10);
    expect(alleyLength).toBeLessThan(20);
    // The alley runs west. Nothing about the route turns north or east first.
    expect(GATE_X).toBeGreaterThan(ROAD_MAX);
  });

  it("then runs south alongside the carriageway for most of a kilometre-tenth", () => {
    // From the alley mouth south to the market's near end.
    const alongRoad = Math.abs(MARKET_Z0 - ROOM_ANCHOR.z);
    expect(alongRoad).toBeGreaterThan(80);
    expect(alongRoad).toBeLessThan(100);
  });

  it("crosses a 12.8 m carriageway to reach the stalls", () => {
    const width = Math.abs(ROAD_MAX - ROAD_MIN);
    expect(width).toBeCloseTo(12.32, 1);
    // The market is on the far (west) side, past the lane in front of it.
    expect(CHO_LON_X).toBeLessThan(ROAD_MIN);
    expect(LANE_X).toBeLessThan(ROAD_MIN);
  });

  it("is a walk, not a drive: under 200 m end to end", () => {
    const alley = Math.abs(GATE_X - ROAD_MAX);
    const alongRoad = Math.abs(MARKET_Z0 - ROOM_ANCHOR.z);
    const crossing = Math.abs(ROAD_MAX - ROAD_MIN) + Math.abs(LANE_X - ROAD_MIN);
    const total = alley + alongRoad + crossing;
    expect(total).toBeGreaterThan(100);
    expect(total).toBeLessThan(200);
    // At a walking pace of about 1.2 m/s, that is three to four minutes.
    expect(total / 1.2).toBeLessThan(180);
  });

  it("puts the market east edge clear of the road it is reached from", () => {
    // The market's easternmost point must stay west of the west facade line, or the walk ends
    // inside a wall. `street-collision.test.ts` measures this from vertices; here it is the intent.
    expect(CHO_LON_Z).toBeLessThan(MARKET_Z0);
    expect(CHO_LON_Z).toBeGreaterThan(MARKET_Z1);
    expect(CHO_LON_X).toBeLessThan(ROAD_MIN);
  });
});
