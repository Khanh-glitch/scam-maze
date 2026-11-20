// Transfers that the bank blocked. Pure and read-only: it derives them from the state and the
// scenario and never writes anything.
//
// An unauthorized transfer is a scheduled event (`afterAction` plus `cancelledBy`). When the bank
// report finishes at or before its minute, the event never fires: no ledger line, no money moved.
// The bank app can then show it as "blocked" (it did not happen), apart from the transfers that did
// happen (the ledger). Before the report nothing is shown, so the bank never reveals a transfer
// that has not happened yet.
import type { DeviceState, EventState, GameEventDef, ScenarioDefinition } from "./types";

/** The parts of the state that the derivation reads, so a caller can pass slices. */
export interface BlockedTransferInput {
  device: Pick<DeviceState, "items">;
  world: { events: Readonly<Record<string, EventState>> };
}

export interface BlockedTransfer {
  eventId: string;
  /** The simulated minute the transfer was due. */
  atMinute: number;
  /** The amount the transfer would have taken, in VND (a positive number). */
  amountVnd: number;
  /** Text of the transfer, from the ledger labels. */
  label: string;
  counterparty: string | null;
}

function doneAt(state: BlockedTransferInput, itemId: string, actionId: string): number | undefined {
  if (!Object.hasOwn(state.device.items, itemId)) return undefined;
  const record = state.device.items[itemId].doneAt;
  return record !== undefined && Object.hasOwn(record, actionId) ? record[actionId] : undefined;
}

function moneyOut(event: GameEventDef): { label: string; amountVnd: number; counterparty: string | null } | null {
  for (const effect of event.onFire ?? []) {
    if (effect.kind === "recordTransaction" && effect.amount < 0) {
      return { label: effect.label, amountVnd: -effect.amount, counterparty: effect.counterparty ?? null };
    }
  }
  return null;
}

export function selectBlockedTransfers(state: BlockedTransferInput, scenario: ScenarioDefinition): BlockedTransfer[] {
  const blocked: BlockedTransfer[] = [];
  for (const event of scenario.events ?? []) {
    const trigger = event.trigger;
    const after = trigger.afterAction;
    const stops = trigger.cancelledBy ?? [];
    const money = moneyOut(event);
    if (after === undefined || stops.length === 0 || money === null) continue;
    if (Object.hasOwn(state.world.events, event.id)) continue;
    const started = doneAt(state, after.itemId, after.actionId);
    if (started === undefined) continue;
    const due = started + after.minutes;
    const stopped = stops.some((stop) => {
      const at = doneAt(state, stop.itemId, stop.actionId);
      return at !== undefined && at <= due;
    });
    if (!stopped) continue;
    const labels = scenario.ledgerLabels;
    blocked.push({
      eventId: event.id,
      atMinute: due,
      amountVnd: money.amountVnd,
      label: labels !== undefined && Object.hasOwn(labels, money.label) ? labels[money.label] : money.label,
      counterparty: money.counterparty,
    });
  }
  return blocked.sort((a, b) => a.atMinute - b.atMinute);
}
