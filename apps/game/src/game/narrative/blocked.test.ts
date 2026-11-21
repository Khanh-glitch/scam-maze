// Blocked transfers: derived from the scenario and the state, shown only after the bank blocked them.
import { describe, expect, it } from "vitest";
import { selectBlockedTransfers } from "./blocked";
import { LAST_SUBMISSION_SCENARIO as S } from "./chapter1/lastSubmission";
import { MISSION_01_CONFIG } from "./chapter1/mission01";
import { selectDeviceView } from "./device";
import { chapterReducer, createInitialState } from "./reducer";
import type { ChapterState, CoreAction } from "./types";

const advance = (minutes: number): CoreAction => ({ type: "ADVANCE_TIME", minutes });
const use = (itemId: string, actionId: string): CoreAction => ({ type: "USE_DEVICE_ITEM", itemId, actionId });

function run(actions: CoreAction[], from: ChapterState = createInitialState(S)): ChapterState {
  return actions.reduce((state, action) => {
    const result = chapterReducer(state, action, S);
    expect(result.accepted, `${action.type} ${JSON.stringify(action)}: ${result.reason ?? ""}`).toBe(true);
    return result.state;
  }, from);
}

const CODE_GIVEN: CoreAction[] = [
  { type: "START_CHAPTER" },
  advance(10),
  { type: "OPEN_DEVICE_ITEM", itemId: "mail.clearance" },
  use("mail.clearance", "open-link"),
  use("page.fee", "sign-in"),
  use("page.fee", "pay-card"),
  use("page.fee", "enter-code"),
];
const REPORT: CoreAction[] = [use("contact.bank", "call"), use("contact.bank", "report-fraud")];
const [T1, T2, T3] = MISSION_01_CONFIG.unauthorizedTransfers;

describe("selectBlockedTransfers", () => {
  it("is empty before anything went wrong", () => {
    expect(selectBlockedTransfers(run([{ type: "START_CHAPTER" }]), S)).toEqual([]);
  });

  it("does not reveal transfers that are still planned: before the report nothing is listed", () => {
    expect(selectBlockedTransfers(run(CODE_GIVEN), S)).toEqual([]);
  });

  it("lists the transfers the bank stopped once the report is done in time, and they cost nothing", () => {
    const state = run([...CODE_GIVEN, ...REPORT]);
    const blocked = selectBlockedTransfers(state, S);
    expect(blocked.map((transfer) => transfer.amountVnd)).toEqual([T1.amountVnd, T2.amountVnd, T3.amountVnd]);
    expect(blocked.map((transfer) => transfer.eventId)).toEqual(["m01.transfer-1", "m01.transfer-2", "m01.transfer-3"]);
    expect(blocked[0].atMinute).toBeLessThan(blocked[1].atMinute);
    expect(blocked[0].label).toBe("Transfer to an unknown recipient");
    // They never reached the ledger: only the fee is there.
    const ledger = selectDeviceView(state, S, "laptop").bank.ledger;
    expect(ledger).toHaveLength(1);
    expect(ledger[0].itemId).toBe("page.fee");
  });

  it("separates what happened from what was blocked when the report comes after the first transfer", () => {
    const state = run([...CODE_GIVEN, advance(T1.afterMinutes + 1), ...REPORT]);
    const ledger = selectDeviceView(state, S, "laptop").bank.ledger;
    const transfers = ledger.filter((entry) => entry.itemId === null);
    expect(transfers).toHaveLength(1);
    expect(transfers[0].category).toBe("loss");
    const blocked = selectBlockedTransfers(state, S);
    expect(blocked.map((transfer) => transfer.eventId)).toEqual(["m01.transfer-2", "m01.transfer-3"]);
    // Nothing is counted twice: the money that left is the fee and the first transfer only.
    expect(selectDeviceView(state, S, "laptop").bank.finance.financialLoss).toBe(MISSION_01_CONFIG.clearanceFeeVnd + transfers[0].amount * -1);
  });

  it("lists nothing when the transfers all happened before the report", () => {
    const state = run([...CODE_GIVEN, advance(T3.afterMinutes + 5), ...REPORT]);
    expect(selectBlockedTransfers(state, S)).toEqual([]);
  });

  it("does not change the state it reads", () => {
    const state = run([...CODE_GIVEN, ...REPORT]);
    const copy = JSON.stringify(state);
    selectBlockedTransfers(state, S);
    expect(JSON.stringify(state)).toBe(copy);
  });
});
