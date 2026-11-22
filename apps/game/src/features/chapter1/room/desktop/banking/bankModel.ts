// Pure helpers of the Banking app: the transaction list (what happened and what was blocked), the
// records that belong to a transaction, and the evidence that can be saved for it. No React, no
// i18n, no game state. It reads views the core made and never invents an amount: every number is
// from the ledger or from a blocked transfer of the scenario.
import type { LedgerEntryView } from "../../../../../game/narrative/device";
import type { BlockedTransfer } from "../../../../../game/narrative/blocked";

export type TxStatus = "completed" | "blocked";
export type TxKind = "payment" | "deposit" | "transfer" | "income";

export interface BankTx {
  /** `tx-<seq>` for a ledger line, `blocked-<event id>` for a blocked transfer. */
  id: string;
  status: TxStatus;
  /** Ledger order (0, 1, 2...), or -1 for a blocked transfer. Breaks ties between lines of the same minute. */
  seq: number;
  atMinute: number;
  label: string;
  /** Negative for money out, positive for money in, VND. A blocked transfer keeps its amount; no money moved. */
  amount: number;
  counterparty: string | null;
  category: LedgerEntryView["category"];
  kind: TxKind;
  /** A reference shown to the player, from the ledger order. Fictional. */
  reference: string;
  /** The item action that made the line (the payment page, a platform), if any. */
  itemId: string | null;
  /** For a transfer made by an event: its order among such transfers (1, 2, 3), else null. */
  transferIndex: number | null;
  /** Ids of device items (mail, messages, pages) that the player can compare this transaction with. */
  relatedItemIds: string[];
  /** Ids of saved files (evidence, reports) that belong to this transaction. */
  relatedEvidenceIds: string[];
  /** The bank statement action that saves a record of this transaction, if it has one. */
  saveAction: { itemId: string; actionId: string; evidenceId: string } | null;
}

const STATEMENT = "bank.statement";

/** Items that go with the payment of the confirmation fee: the email that asked for it and the page that took it. */
const FEE_RELATED_ITEMS = ["mail.clearance"] as const;
const FEE_EVIDENCE = ["file.email-record", "file.address-record", "file.fee-record", "file.portal-status", "file.office-confirmation"] as const;
const TRANSFER_EVIDENCE = ["file.transfer-record", "file.bank-report"] as const;

function kindOf(entry: LedgerEntryView): TxKind {
  if (entry.category === "locked") return "deposit";
  if (entry.itemId === null && entry.amount < 0) return "transfer";
  return entry.amount >= 0 ? "income" : "payment";
}

function reference(prefix: string, order: number): string {
  return `${prefix}-${String(order).padStart(4, "0")}`;
}

/**
 * The transaction list, newest first: ledger lines (what happened) and blocked transfers (what the
 * bank stopped, which are not in the ledger and cost nothing). `ledger` is newest first, as the
 * device view gives it.
 */
export function buildTransactions(ledger: readonly LedgerEntryView[], blocked: readonly BlockedTransfer[]): BankTx[] {
  const oldestFirst = [...ledger].sort((a, b) => a.seq - b.seq);
  const transferOrder = new Map<number, number>();
  oldestFirst.filter((entry) => kindOf(entry) === "transfer").forEach((entry, index) => transferOrder.set(entry.seq, index + 1));

  const completed: BankTx[] = oldestFirst.map((entry) => {
    const kind = kindOf(entry);
    const transferIndex = transferOrder.get(entry.seq) ?? null;
    const isFee = entry.itemId === "page.fee" && entry.actionId === "enter-code";
    return {
      id: `tx-${entry.seq}`,
      status: "completed",
      seq: entry.seq,
      atMinute: entry.atMinute,
      label: entry.label,
      amount: entry.amount,
      counterparty: entry.counterparty,
      category: entry.category,
      kind,
      reference: reference("TX", entry.seq + 1),
      itemId: entry.itemId,
      transferIndex,
      relatedItemIds: isFee ? [...FEE_RELATED_ITEMS, "page.fee"] : transferIndex !== null ? [`msg.bank-alert-${transferIndex}`] : entry.itemId !== null ? [entry.itemId] : [],
      relatedEvidenceIds: isFee ? [...FEE_EVIDENCE] : transferIndex !== null ? [...TRANSFER_EVIDENCE] : [],
      saveAction: isFee
        ? { itemId: STATEMENT, actionId: "save-fee-record", evidenceId: "file.fee-record" }
        : transferIndex !== null
          ? { itemId: STATEMENT, actionId: "save-transfer-record", evidenceId: "file.transfer-record" }
          : null,
    };
  });

  const stopped: BankTx[] = blocked.map((transfer, index) => ({
    id: `blocked-${transfer.eventId}`,
    status: "blocked",
    seq: -1,
    atMinute: transfer.atMinute,
    label: transfer.label,
    amount: -transfer.amountVnd,
    counterparty: transfer.counterparty,
    category: null,
    kind: "transfer",
    reference: reference("BL", index + 1),
    itemId: null,
    transferIndex: null,
    relatedItemIds: [],
    relatedEvidenceIds: ["file.bank-report"],
    saveAction: null,
  }));

  return [...completed, ...stopped].sort((a, b) => b.atMinute - a.atMinute || b.seq - a.seq);
}

export function filterTransactions(list: readonly BankTx[], filter: "all" | TxStatus): BankTx[] {
  return filter === "all" ? [...list] : list.filter((tx) => tx.status === filter);
}

/** A short excerpt of a message body for the "related records" list. */
export function excerpt(body: string, max = 160): string {
  const text = body.replace(/\s+/g, " ").trim();
  return text.length <= max ? text : `${text.slice(0, max - 1).trimEnd()}\u2026`;
}
