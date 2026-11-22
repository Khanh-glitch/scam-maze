import { describe, expect, it } from "vitest";
import type { BlockedTransfer } from "../../../../../game/narrative/blocked";
import type { LedgerEntryView } from "../../../../../game/narrative/device";
import { buildTransactions, excerpt, filterTransactions } from "./bankModel";

function line(seq: number, extra: Partial<LedgerEntryView> = {}): LedgerEntryView {
  return { seq, atMinute: seq * 10, label: `line ${seq}`, amount: -1000, counterparty: null, category: null, itemId: null, actionId: null, ...extra };
}

const blocked: BlockedTransfer = { eventId: "m01.transfer-2", atMinute: 55, amountVnd: 500000, label: "Transfer", counterparty: "Unknown recipient" };

describe("buildTransactions", () => {
  it("lists newest first, with completed lines and blocked transfers apart", () => {
    // The device view gives the ledger newest first.
    const ledger = [line(2, { itemId: "page.fee", actionId: "enter-code", category: "loss" }), line(1), line(0, { amount: 5000 })];
    const list = buildTransactions(ledger, [blocked]);
    expect(list.map((tx) => tx.id)).toEqual(["blocked-m01.transfer-2", "tx-2", "tx-1", "tx-0"]);
    expect(list.find((tx) => tx.id === "blocked-m01.transfer-2")).toMatchObject({ status: "blocked", amount: -500000, kind: "transfer", reference: "BL-0001" });
    expect(list.find((tx) => tx.id === "tx-2")?.status).toBe("completed");
  });

  it("classifies lines: payment, money sent to a platform, event transfer and money received", () => {
    const ledger = [
      line(3, { amount: 2000 }),
      line(2, { category: "locked", itemId: "msg.job", actionId: "deposit-1" }),
      line(1),
      line(0, { itemId: "page.fee", actionId: "enter-code", category: "loss" }),
    ];
    const kinds = Object.fromEntries(buildTransactions(ledger, []).map((tx) => [tx.id, tx.kind]));
    expect(kinds).toEqual({ "tx-3": "income", "tx-2": "deposit", "tx-1": "transfer", "tx-0": "payment" });
  });

  it("links the fee to its email, page and evidence, and each transfer to its own alert", () => {
    const ledger = [line(2), line(1), line(0, { itemId: "page.fee", actionId: "enter-code", category: "loss" })];
    const list = buildTransactions(ledger, []);
    const fee = list.find((tx) => tx.id === "tx-0")!;
    expect(fee.relatedItemIds).toEqual(["mail.clearance", "page.fee"]);
    expect(fee.relatedEvidenceIds).toContain("file.email-record");
    expect(fee.saveAction).toEqual({ itemId: "bank.statement", actionId: "save-fee-record", evidenceId: "file.fee-record" });
    const first = list.find((tx) => tx.id === "tx-1")!;
    const second = list.find((tx) => tx.id === "tx-2")!;
    expect(first.relatedItemIds).toEqual(["msg.bank-alert-1"]);
    expect(second.relatedItemIds).toEqual(["msg.bank-alert-2"]);
    expect(first.saveAction?.actionId).toBe("save-transfer-record");
  });

  it("breaks ties between lines of the same minute by ledger order, newest first", () => {
    const list = buildTransactions([line(1, { atMinute: 30 }), line(0, { atMinute: 30 })], []);
    expect(list.map((tx) => tx.id)).toEqual(["tx-1", "tx-0"]);
  });

  it("filters by status", () => {
    const list = buildTransactions([line(0)], [blocked]);
    expect(filterTransactions(list, "blocked").map((tx) => tx.status)).toEqual(["blocked"]);
    expect(filterTransactions(list, "completed").map((tx) => tx.status)).toEqual(["completed"]);
    expect(filterTransactions(list, "all")).toHaveLength(2);
  });
});

describe("excerpt", () => {
  it("collapses white space and cuts with an ellipsis", () => {
    expect(excerpt("a\n\n b")).toBe("a b");
    expect(excerpt("x".repeat(40), 10)).toBe(`${"x".repeat(9)}\u2026`);
  });
});
