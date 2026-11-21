// Mission 01 side missions: EASY MONEY and THE GOLDEN PLATFORM. Uses the real scenario.
import { describe, expect, it } from "vitest";
import { encodeProgress, restoreProgress } from "../saves/chapterProgress";
import { LAST_SUBMISSION_SCENARIO } from "../narrative/chapter1/lastSubmission";
import { MISSION_01_OFFERS_CONFIG as C } from "../narrative/chapter1/mission01Offers";
import { selectDeviceView, validateDeviceContent } from "../narrative/device";
import { chapterReducer, createInitialState } from "../narrative/reducer";
import type { ChapterState, CoreAction } from "../narrative/types";
import { validateScenario } from "../narrative/validateScenario";
import { selectOpenMissions, validateWorldContent } from "../narrative/world";

const S = LAST_SUBMISSION_SCENARIO;
const START: CoreAction = { type: "START_CHAPTER" };
const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const to = (minute: number, from: ChapterState): CoreAction => ({ type: "ADVANCE_TIME", minutes: Math.max(1, minute - (S.initial!.resources.timeMinutes - from.resources.timeMinutes)) });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });
const P = "job.platform";
const G = "page.golden";

function step(state: ChapterState, action: CoreAction): ChapterState {
  const result = chapterReducer(state, action, S);
  expect(result.accepted, `${action.type} ${JSON.stringify(action)}: ${result.reason ?? ""}`).toBe(true);
  return result.state;
}
const run = (actions: CoreAction[], from: ChapterState = createInitialState(S)) => actions.reduce(step, from);
const rejection = (state: ChapterState, action: CoreAction) => chapterReducer(state, action, S).reason;
const itemView = (state: ChapterState, id: string) =>
  (["phone", "laptop"] as const).flatMap((device) => Object.values(selectDeviceView(state, S, device).apps).flat()).find((item) => item.id === id)!;
const figures = (state: ChapterState, id: string) => Object.fromEntries(itemView(state, id).figures!.map((figure) => [figure.kind, figure.amountVnd]));
const status = (state: ChapterState, id: string) => state.world.missions[id].status;
const actionIds = (state: ChapterState, id: string) => itemView(state, id).actions.map((action) => action.id);

/** Tuesday 19:30: Linh's message has arrived. */
const afterEasyOffer = (): ChapterState => {
  const state = run([START]);
  return step(state, to(C.easyMoneyAtMinute, state));
};
const WORKING: CoreAction[] = [use("msg.easy-money", "open-link"), use(P, "do-task-1")];
const FIRST_DEPOSIT: CoreAction[] = [...WORKING, use(P, "try-withdraw-1"), use(P, "deposit-1")];
const ALL_DEPOSITS: CoreAction[] = [
  ...FIRST_DEPOSIT,
  use(P, "do-task-2"),
  use(P, "try-withdraw-2"),
  use(P, "deposit-2"),
  use(P, "do-task-3"),
  use(P, "try-withdraw-3"),
];

const afterGoldenOffer = (): ChapterState => {
  const state = run([START]);
  return step(state, to(C.goldenPlatformAtMinute, state));
};
const INVESTED: CoreAction[] = [use("msg.golden-friend", "open-link"), use(G, "invest")];

describe("the content", () => {
  it("is consistent and the offers are optional missions", () => {
    expect(validateWorldContent(S)).toEqual([]);
    expect(validateDeviceContent(S)).toEqual([]);
    expect(validateScenario(S).filter((message) => !/needs at least one/.test(message))).toEqual([]);
    expect(S.missions!.filter((mission) => mission.optional).map((mission) => mission.id)).toEqual(["m01.easy-money", "m01.golden-platform"]);
  });

  it("never calls an offer or a page safe, unsafe or a scam, and shows no score", () => {
    const full = run([...ALL_DEPOSITS, use(P, "deposit-3")], afterEasyOffer());
    const views = JSON.stringify([selectDeviceView(full, S, "phone"), selectDeviceView(full, S, "laptop")]);
    expect(views).not.toMatch(/\bsafe\b|unsafe|scam|phish|fake|\bscore\b/i);
    // Only the words the player reads: ids and flag names are internal.
    const texts = JSON.stringify(
      S.deviceItems!
        .filter((item) => /job|golden|easy-money|authority/.test(item.id))
        .map((item) => [item.title, item.from, item.detail, item.body, ...(item.actions ?? []).flatMap((action) => [action.label, ...(action.transcript ?? []).map((line) => line.text)])]),
    );
    expect(texts).not.toMatch(/\bsafe\b|unsafe|scam|phish|\bfake\b|\bscore\b|https?:\/\//i);
  });
});

describe("EASY MONEY", () => {
  it("arrives on Tuesday 19:30 while Alex writes, as an optional mission that does not touch the main one", () => {
    const early = run([START]);
    expect(Object.hasOwn(early.device.items, "msg.easy-money")).toBe(false);
    const state = afterEasyOffer();
    expect(Object.hasOwn(state.device.items, "msg.easy-money")).toBe(true);
    expect(status(state, "m01.easy-money")).toBe("open");
    expect(selectOpenMissions(state, S).find((mission) => mission.id === "m01.easy-money")!.optional).toBe(true);
    expect(status(state, "m01.missing-access")).toBe("open");
    expect(state.resources.cash).toBe(2_500_000);
  });

  it("lets the player ask, and asking costs time and gives evidence without money", () => {
    const state = afterEasyOffer();
    const asked = step(state, use("msg.easy-money", "ask-linh"));
    expect(state.resources.timeMinutes - asked.resources.timeMinutes).toBe(C.easyMoney.minutes.ask);
    expect(asked.resources.evidence).toBe(1);
    expect(asked.resources.cash).toBe(2_500_000);
    expect(itemView(asked, "msg.easy-money").conversation.map((line) => line.speaker)).toEqual(["alex", "other"]);
  });

  it("lets the player check the company: it costs time, gives evidence and a saved document", () => {
    const state = run([...[], use("msg.easy-money", "open-link")], afterEasyOffer());
    const checked = step(state, use(P, "check-company"));
    expect(state.resources.timeMinutes - checked.resources.timeMinutes).toBe(C.easyMoney.minutes.check);
    expect(checked.resources.evidence).toBe(1);
    expect(Object.hasOwn(checked.device.items, "file.company-check")).toBe(true);
    expect(checked.persistent.lostMoneyToScam).toBe(false);
  });

  it("lets the player say no: nothing is lost and the mission ends", () => {
    const declined = step(afterEasyOffer(), use("msg.easy-money", "decline"));
    expect(status(declined, "m01.easy-money")).toBe("completed");
    expect(declined.resources.cash).toBe(2_500_000);
    expect(declined.persistent).toMatchObject({ lostMoneyToScam: false, easyMoneyDeposited: false, recoveryOfferEligible: false, debtFromScam: false });
    expect(Object.hasOwn(declined.device.items, P)).toBe(false);
  });

  it("pays a small reward for the first tasks: the page shows a balance, nothing is withdrawable, no money moves", () => {
    const state = run(WORKING, afterEasyOffer());
    expect(figures(state, P)).toEqual({ real: 2_500_000, shown: C.easyMoney.shownVnd[0], withdrawable: 0, locked: 0 });
    expect(state.resources.cash).toBe(2_500_000);
    expect(state.device.ledger).toEqual([]);
    expect(state.persistent.lostMoneyToScam).toBe(false);
    expect(actionIds(state, P)).toEqual(expect.arrayContaining(["try-withdraw-1", "deposit-1", "stop"]));
  });

  it("asks for a deposit to go on, and a deposit takes real money while the balance only grows on the page", () => {
    const state = run(FIRST_DEPOSIT, afterEasyOffer());
    expect(state.resources.cash).toBe(2_500_000 - C.easyMoney.depositsVnd[0]);
    expect(state.device.ledger.map((entry) => [entry.label, entry.amount])).toEqual([["ledger.job-deposit-1", -C.easyMoney.depositsVnd[0]]]);
    expect(figures(state, P)).toEqual({ real: state.resources.cash, shown: C.easyMoney.shownVnd[1], withdrawable: 0, locked: C.easyMoney.depositsVnd[0] });
    expect(state.persistent).toMatchObject({ lostMoneyToScam: true, easyMoneyDeposited: true, recoveryOfferEligible: true, debtFromScam: false });
    expect(status(state, "m01.easy-money")).toBe("open");
    expect(state.world.missions["m01.easy-money"].path).toBe("deposited");
  });

  it("every withdrawal attempt is answered with a new demand and nothing is ever withdrawable", () => {
    const state = run(ALL_DEPOSITS, afterEasyOffer());
    ["msg.job-minimum", "msg.job-verify", "msg.job-tax"].forEach((id) => expect(Object.hasOwn(state.device.items, id)).toBe(true));
    expect(figures(state, P).withdrawable).toBe(0);
    expect(figures(state, P).shown).toBe(C.easyMoney.shownVnd[4]);
  });

  it("with enough cash the last deposit uses it; with too little the player can only borrow, which records debt", () => {
    const afterTax = run(ALL_DEPOSITS, afterEasyOffer());
    expect(actionIds(afterTax, P)).toContain("deposit-3");
    expect(actionIds(afterTax, P)).not.toContain("deposit-3-borrow");
    const own = step(afterTax, use(P, "deposit-3"));
    expect(own.persistent.debtFromScam).toBe(false);
    expect(own.resources.cash).toBe(2_500_000 - C.easyMoney.depositsVnd.reduce((sum, value) => sum + value, 0));
    // After a loss at the bank, the same step offers a loan instead of the player's own cash.
    const broke: ChapterState = { ...afterTax, resources: { ...afterTax.resources, cash: 100_000 } };
    expect(actionIds(broke, P)).not.toContain("deposit-3");
    expect(rejection(broke, use(P, "deposit-3"))).toBe("This action is not available now.");
    const borrowed = step(broke, use(P, "deposit-3-borrow"));
    expect(borrowed.resources.cash).toBe(100_000 - C.easyMoney.depositsVnd[2]);
    expect(borrowed.resources.cash).toBeLessThan(0);
    expect(borrowed.persistent.debtFromScam).toBe(true);
    expect(figures(borrowed, P).locked).toBe(C.easyMoney.depositsVnd.reduce((sum, value) => sum + value, 0));
  });

  it("cannot take a deposit without cash, and never gives money back", () => {
    const state = run(FIRST_DEPOSIT, afterEasyOffer());
    const poor: ChapterState = { ...state, resources: { ...state.resources, cash: 10_000 } };
    const next = run([use(P, "do-task-2"), use(P, "try-withdraw-2")], poor);
    expect(rejection(next, use(P, "deposit-2"))).toBe("There is not enough cash for this.");
    let walk = run(ALL_DEPOSITS, afterEasyOffer());
    let cash = walk.resources.cash;
    for (let i = 0; i < 40; i += 1) {
      walk = step(walk, { type: "ADVANCE_TIME", minutes: 60 });
      expect(walk.resources.cash).toBeLessThanOrEqual(cash);
      cash = walk.resources.cash;
    }
  });

  it("pushes with a deadline 30 minutes after the first deposit, unless the player went on or stopped before", () => {
    const state = run(FIRST_DEPOSIT, afterEasyOffer());
    const depositedAt = state.device.items[P].doneAt!["deposit-1"];
    const later = step(state, { type: "ADVANCE_TIME", minutes: 120 });
    expect(later.world.events["m01.job-pressure"].firedAtMinute).toBe(depositedAt + C.easyMoney.pressureAfterMinutes);
    expect(later.device.items["msg.job-countdown"].arrivedAtMinute).toBe(depositedAt + C.easyMoney.pressureAfterMinutes);
    const stopped = run([use(P, "stop"), { type: "ADVANCE_TIME", minutes: 120 } as CoreAction], state);
    expect(Object.hasOwn(stopped.world.events, "m01.job-pressure")).toBe(false);
  });

  it("lets the player stop at any point: time lost, no more money lost, and the mission ends", () => {
    const state = run(FIRST_DEPOSIT, afterEasyOffer());
    const stopped = step(state, use(P, "stop"));
    expect(status(stopped, "m01.easy-money")).toBe("completed");
    expect(stopped.resources.cash).toBe(state.resources.cash);
    expect(stopped.resources.timeMinutes).toBe(state.resources.timeMinutes - C.easyMoney.minutes.stop);
    // The loss stays for the later missions.
    expect(stopped.persistent).toMatchObject({ lostMoneyToScam: true, recoveryOfferEligible: true });
  });

  it("the tasks use the time Alex needs for the thesis", () => {
    const base = afterEasyOffer();
    const state = run(ALL_DEPOSITS, base);
    expect(base.resources.timeMinutes - state.resources.timeMinutes).toBeGreaterThanOrEqual(3 * C.easyMoney.minutes.task);
  });

  it("saving the records gives evidence and a saved file and sets the flag", () => {
    const state = run([...WORKING, use(P, "try-withdraw-1"), use(P, "save-records")], afterEasyOffer());
    expect(state.resources.evidence).toBe(1);
    expect(state.persistent.scamEvidenceSaved).toBe(true);
    expect(Object.hasOwn(state.device.items, "file.job-records")).toBe(true);
  });
});

describe("THE GOLDEN PLATFORM", () => {
  it("arrives on Tuesday 21:30 as an optional mission", () => {
    const state = afterGoldenOffer();
    expect(Object.hasOwn(state.device.items, "msg.golden-friend")).toBe(true);
    expect(status(state, "m01.golden-platform")).toBe("open");
    expect(state.resources.cash).toBe(2_500_000);
  });

  it("can be checked with the official office: time, a two-turn conversation and evidence, no money", () => {
    const state = afterGoldenOffer();
    expect(actionIds(state, "contact.authority")).toEqual(["call"]);
    const checked = run([use("contact.authority", "call"), use("contact.authority", "ask-platform")], state);
    expect(state.resources.timeMinutes - checked.resources.timeMinutes).toBe(C.goldenPlatform.minutes.authorityCall + C.goldenPlatform.minutes.authorityAsk);
    expect(checked.resources.evidence).toBe(1);
    expect(checked.resources.cash).toBe(2_500_000);
    expect(itemView(checked, "contact.authority").conversation).toHaveLength(4);
  });

  it("can be declined at no cost", () => {
    const declined = step(afterGoldenOffer(), use("msg.golden-friend", "decline"));
    expect(status(declined, "m01.golden-platform")).toBe("completed");
    expect(declined.persistent).toMatchObject({ lostMoneyToScam: false, investmentFundsLocked: false, recoveryOfferEligible: false });
  });

  it("shows profit that is only a figure on the page, and locks the money that was sent", () => {
    const state = run([...INVESTED, use(G, "check-dashboard")], afterGoldenOffer());
    expect(state.resources.cash).toBe(2_500_000 - C.goldenPlatform.investVnd);
    expect(figures(state, G)).toEqual({ real: state.resources.cash, shown: C.goldenPlatform.shownVnd[1], withdrawable: 0, locked: C.goldenPlatform.investVnd });
    expect(state.persistent).toMatchObject({ lostMoneyToScam: true, investmentFundsLocked: true, recoveryOfferEligible: true });
    expect(state.device.ledger.map((entry) => entry.label)).toEqual(["ledger.invest-1"]);
  });

  it("asks for a new fee at every withdrawal and the fees only add to the loss", () => {
    const state = run([...INVESTED, use(G, "check-dashboard"), use(G, "withdraw-1"), use(G, "pay-fee-1"), use(G, "withdraw-2"), use(G, "pay-fee-2"), use(G, "withdraw-3"), use(G, "pay-fee-3"), use(G, "withdraw-4")], afterGoldenOffer());
    const paid = C.goldenPlatform.investVnd + C.goldenPlatform.feesVnd.reduce((sum, fee) => sum + fee, 0);
    expect(state.resources.cash).toBe(2_500_000 - paid);
    expect(state.device.ledger.map((entry) => entry.label)).toEqual(["ledger.invest-1", "ledger.invest-fee-1", "ledger.invest-fee-2", "ledger.invest-fee-3"]);
    expect(figures(state, G).withdrawable).toBe(0);
    ["msg.golden-fee-1", "msg.golden-fee-2", "msg.golden-fee-3", "msg.golden-frozen"].forEach((id) => expect(Object.hasOwn(state.device.items, id)).toBe(true));
    expect(state.world.missions["m01.golden-platform"].path).toBe("locked");
  });

  it("does not list a fee before the withdrawal that asks for it, and cannot be paid without cash", () => {
    const state = run([...INVESTED, use(G, "check-dashboard")], afterGoldenOffer());
    expect(rejection(state, use(G, "pay-fee-1"))).toBe("This action is not available now.");
    const asked = step(state, use(G, "withdraw-1"));
    const poor: ChapterState = { ...asked, resources: { ...asked.resources, cash: 50_000 } };
    expect(rejection(poor, use(G, "pay-fee-1"))).toBe("There is not enough cash for this.");
  });

  it("lets the player leave at any time; the locked money stays locked and the loss is kept", () => {
    const state = run([...INVESTED, use(G, "check-dashboard"), use(G, "withdraw-1")], afterGoldenOffer());
    const left = step(state, use(G, "leave"));
    expect(status(left, "m01.golden-platform")).toBe("completed");
    expect(left.resources.cash).toBe(state.resources.cash);
    expect(left.persistent.investmentFundsLocked).toBe(true);
    expect(figures(left, G).locked).toBe(C.goldenPlatform.investVnd);
  });

  it("sends a profit notice an hour after the investment at that minute, unless the player left before", () => {
    const state = run(INVESTED, afterGoldenOffer());
    const at = state.device.items[G].doneAt!.invest;
    const later = step(state, { type: "ADVANCE_TIME", minutes: 200 });
    expect(later.world.events["m01.golden-profit-notice"].firedAtMinute).toBe(at + C.goldenPlatform.profitNoticeAfterMinutes);
    const left = run([use(G, "leave"), { type: "ADVANCE_TIME", minutes: 200 } as CoreAction], state);
    expect(Object.hasOwn(left.world.events, "m01.golden-profit-notice")).toBe(false);
  });
});

describe("closing a platform", () => {
  it("stops every step of the job page after Stop, and keeps only the checks and the records", () => {
    const state = run([...FIRST_DEPOSIT, use(P, "stop")], afterEasyOffer());
    const shown = actionIds(state, P);
    expect(shown).toEqual(expect.arrayContaining(["check-company", "save-records", "stop"]));
    for (const gone of ["do-task-1", "do-task-2", "try-withdraw-1", "deposit-1", "deposit-2"]) expect(shown).not.toContain(gone);
    expect(rejection(state, use(P, "do-task-2"))).toBe("This action is not available now.");
    expect(rejection(state, use(P, "deposit-2"))).toBe("This action is not available now.");
    // Nothing is taken after the account is closed.
    expect(step(state, advance(600)).resources.cash).toBe(state.resources.cash);
  });

  it("stops every step of the investment page after Leave", () => {
    const state = run([...INVESTED, use(G, "check-dashboard"), use(G, "withdraw-1"), use(G, "leave")], afterGoldenOffer());
    const shown = actionIds(state, G);
    for (const gone of ["invest-more", "pay-fee-1", "withdraw-2", "invest"]) expect(shown).not.toContain(gone);
    expect(shown).toEqual(expect.arrayContaining(["save-records", "leave"]));
    expect(rejection(state, use(G, "pay-fee-1"))).toBe("This action is not available now.");
    expect(rejection(state, use(G, "invest-more"))).toBe("This action is not available now.");
  });

  it("does not take away the steps before the player stops, or the records after", () => {
    const state = run([...WORKING, use(P, "try-withdraw-1")], afterEasyOffer());
    expect(actionIds(state, P)).toEqual(expect.arrayContaining(["deposit-1", "stop"]));
    const stopped = run([use(P, "stop"), use(P, "save-records")], state);
    expect(stopped.persistent.scamEvidenceSaved).toBe(true);
  });
});

describe("consequences for the later missions", () => {
  it("keep the loss, the debt and the saved records, and say nothing when the player avoided both", () => {
    const clean = run([START, { type: "ADVANCE_TIME", minutes: 2000 } as CoreAction]);
    expect(clean.persistent).toMatchObject({ lostMoneyToScam: false, easyMoneyDeposited: false, investmentFundsLocked: false, debtFromScam: false, scamEvidenceSaved: false, recoveryOfferEligible: false });
    const lost = run([...FIRST_DEPOSIT, ...[]], afterEasyOffer());
    const both = run([use("msg.golden-friend", "open-link"), use(G, "invest")], step(lost, { type: "ADVANCE_TIME", minutes: 200 }));
    expect(both.persistent).toMatchObject({ lostMoneyToScam: true, easyMoneyDeposited: true, investmentFundsLocked: true, recoveryOfferEligible: true });
    // The ledger keeps every amount for the recovery offer.
    expect(both.device.ledger.map((entry) => entry.label)).toEqual(["ledger.job-deposit-1", "ledger.invest-1"]);
  });

  it("do not depend on the Security Breach or the Training Office and do not change them", () => {
    const state = run([...FIRST_DEPOSIT], afterEasyOffer());
    expect(state.persistent).toMatchObject({ loginCredentialsExposed: false, accountCompromised: false, schoolAccessVerified: false });
    expect(state.resources.digitalSecurity).toBe(100);
    expect(status(state, "m01.security-breach")).toBe("locked");
  });

  it("are restored from a save exactly, with the figures", () => {
    const state = run([...ALL_DEPOSITS, use(P, "save-records"), use(P, "deposit-3"), { type: "REST", mode: "nap" } as CoreAction], afterEasyOffer());
    const restored = restoreProgress(JSON.parse(JSON.stringify(encodeProgress(state, null, "start"))), S);
    expect(restored.ok && restored.state).toEqual(state);
    expect(restored.ok && figures(restored.state, P)).toEqual(figures(state, P));
  });

  it("are deterministic", () => {
    expect(run(ALL_DEPOSITS, afterEasyOffer())).toEqual(run(ALL_DEPOSITS, afterEasyOffer()));
  });
});
