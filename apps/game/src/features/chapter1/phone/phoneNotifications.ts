// Notifications of the lock screen, derived from what the phone already holds: unread device items
// (mail, chats, listings, jobs), unread phone messages and a voicemail or call summary that has not
// been opened yet. Pure TypeScript: nothing is stored, so a notification disappears as soon as the
// thing it points to is read. A notification never marks anything as safe or unsafe.
import type { DeviceActionView, PhoneMessageView, PhoneRecordsView } from "../../../game/narrative/selectors";
import type { DeviceView } from "../../../game/narrative/device";
import type { EvidenceId } from "../../../game/narrative/chapter1/ids";
import type { PhoneRoute } from "./phoneRoutes";
import { isWebPageItem } from "../room/desktop/mailModel";

export type PhoneNotification =
  | {
      kind: "device";
      id: string;
      route: PhoneRoute;
      /** Key of the app (`mail`, `housing`, ...), used for the label and the theme. */
      app: string;
      itemId: string;
      title: string;
      sender: string | null;
    }
  | {
      kind: "message";
      id: string;
      route: "messages";
      app: "messages";
      messageId: string;
      evidenceId: EvidenceId;
      evidenceRecorded: boolean;
      title: string;
      preview: string;
    }
  | {
      kind: "voicemail";
      id: string;
      route: "voicemail";
      app: "voicemail";
      /** True for a call summary instead of a voicemail. */
      summary: boolean;
      title: string;
    };

const ALEX_RECORD_ACTION = "dev.open-alex-record";

export interface NotificationInput {
  records: PhoneRecordsView;
  /** Phone messages that are not the voicemail or the summaries. */
  messages: readonly PhoneMessageView[];
  device?: DeviceView;
}

function recordOpen(view: DeviceActionView | undefined): boolean {
  // A scenario without the record action shows the text at once, so nothing is waiting to be opened.
  return view !== undefined && !view.done && view.available;
}

export function buildNotifications({ records, messages, device }: NotificationInput): PhoneNotification[] {
  const list: PhoneNotification[] = [];
  const recordAction = records.deviceActions.find((action) => action.id === ALEX_RECORD_ACTION);
  if (recordOpen(recordAction)) {
    if (records.voicemail !== null) {
      list.push({ kind: "voicemail", id: `voicemail:${records.voicemail.id}`, route: "voicemail", app: "voicemail", summary: false, title: records.voicemail.from });
    }
    for (const summary of records.summaries) {
      list.push({ kind: "voicemail", id: `voicemail:${summary.id}`, route: "voicemail", app: "voicemail", summary: true, title: summary.from });
    }
  }
  for (const message of messages) {
    if (!message.unread) continue;
    list.push({
      kind: "message",
      id: `message:${message.id}`,
      route: "messages",
      app: "messages",
      messageId: message.id,
      evidenceId: message.evidenceId,
      evidenceRecorded: message.evidenceRecorded,
      title: message.from,
      preview: message.body,
    });
  }
  if (device !== undefined) {
    const items = Object.values(device.apps)
      .flat()
      .filter((item) => item.tracksUnread && !item.read && !isWebPageItem(item))
      .sort((a, b) => b.arrivedAtMinute - a.arrivedAtMinute || (a.id < b.id ? -1 : a.id > b.id ? 1 : 0));
    for (const item of items) {
      list.push({
        kind: "device",
        id: `device:${item.app}:${item.id}`,
        route: item.app === "messages" ? "messages" : `device:${item.app}`,
        app: item.app,
        itemId: item.id,
        title: item.title,
        sender: item.from,
      });
    }
  }
  return list;
}
