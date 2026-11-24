// Route 06 on the chapter's clock. The demo world has its own accelerated clock so /testbus is a
// 40-second loop; the chapter's world must not, or the mission's 11:30 deadline means nothing.
import { describe, expect, it } from "vitest";
import { BusRouteController, ROUTE } from "./transit";

/** A clock the test owns, standing in for the chapter's own. */
function storyHost(startSeconds = 8 * 3600) {
  const clock = { seconds: startSeconds };
  const payments: number[] = [];
  return {
    clock,
    payments,
    host: {
      clock: {
        read: () => clock.seconds,
        advance: (seconds: number) => {
          clock.seconds += seconds;
        },
      },
      wallet: {
        read: () => 50_000,
        debit: (amount: number) => {
          payments.push(amount);
          return true;
        },
      },
    },
  };
}

const idleDoors = { front: false, rear: false };

describe("Route 06 on the chapter clock", () => {
  it("charges the fare the core's own fare test documents", () => {
    // The core cannot import this file (a boundary test forbids it), so the number is checked from
    // this side instead. If either copy moves, this fails.
    expect(ROUTE.fare).toBe(7000);
  });

  it("does not fast-forward while waiting: four minutes of waiting is four minutes", () => {
    const { host, clock } = storyHost();
    const route = new BusRouteController(host);
    const start = clock.seconds;
    route.wait();
    expect(clock.seconds).toBe(start);
    expect(route.phase).toBe("approaching");
  });

  it("advances one second per second, with no 12x or 5x accelerator", () => {
    const { host, clock } = storyHost();
    const route = new BusRouteController(host);
    route.wait();
    const start = clock.seconds;
    // Approaching: the demo clock would have added 5 s per second here.
    for (let i = 0; i < 10; i += 1) route.update(1, idleDoors, false);
    const spent = clock.seconds - start;
    expect(spent).toBeGreaterThan(0);
    expect(spent).toBeLessThanOrEqual(10);
  });

  it("charges the fare through the host, once", () => {
    const { host, payments } = storyHost();
    const route = new BusRouteController(host);
    route.wait();
    // Arrive at the stop.
    route.update(10, idleDoors, false);
    expect(route.phase).toBe("boarding");
    expect(route.pay(true)).toBe(true);
    expect(payments).toEqual([ROUTE.fare]);
    // A second payment is a no-op: the ticket is already bought.
    expect(route.pay(true)).toBe(true);
    expect(payments).toEqual([ROUTE.fare]);
  });

  it("lands the ride 34 minutes after departure", () => {
    const { host, clock } = storyHost();
    const route = new BusRouteController(host);
    route.wait();
    route.update(10, idleDoors, false);
    route.pay(true);
    route.depart(true, false);
    const departure = clock.seconds;
    // Step until the bus arrives; 1 s of simulated time per step is the worst case.
    for (let i = 0; i < 4000 && route.phase !== "arrived"; i += 1) route.update(1, idleDoors, false);
    expect(route.phase).toBe("arrived");
    const minutes = (clock.seconds - departure) / 60;
    expect(minutes).toBeCloseTo(ROUTE.rideMinutes, 0);
  });

  it("keeps the demo world's own clock when no host is given", () => {
    const route = new BusRouteController();
    // No host: the wait is compressed, so the demo still reaches the stop instantly.
    route.wait();
    expect(route.phase).toBe("approaching");
    const before = route.clock;
    route.update(1, idleDoors, false);
    expect(route.clock).toBeGreaterThan(before + 1);
  });
});
