// The device apps that sit on top of the shared device state: which apps each device shows, with
// an icon, a label and an unread badge. The phone shows Messages and Contacts inside its own
// Messages and Calls apps; every other app is a home-screen app. The laptop shows them as tabs.
import {
  Briefcase,
  CalendarDays,
  FolderOpen,
  Home,
  Landmark,
  Mail,
  MapPin,
  type LucideIcon,
} from "lucide-react";
import type { DeviceAppId, DeviceKind } from "../../../game/narrative/types";
import type { DeviceView } from "../../../game/narrative/device";
import type { Tx } from "./deviceFormat";

export const APP_ICONS: Readonly<Record<DeviceAppId, LucideIcon>> = {
  mail: Mail,
  messages: Mail,
  contacts: Mail,
  bank: Landmark,
  map: MapPin,
  calendar: CalendarDays,
  housing: Home,
  jobs: Briefcase,
  files: FolderOpen,
};

/** Apps shown on the phone home screen. Messages and Contacts live inside the existing phone apps. */
const PHONE_HOME_APPS: readonly DeviceAppId[] = ["mail", "bank", "map", "calendar", "housing", "jobs", "files"];
/** Apps shown as laptop tabs. */
const LAPTOP_APPS: readonly DeviceAppId[] = ["mail", "bank", "calendar", "housing", "jobs", "files"];

export interface DeviceAppEntry {
  app: DeviceAppId;
  label: string;
  icon: LucideIcon;
  badge: number;
}

export function deviceAppEntries(view: DeviceView, device: DeviceKind, t: Tx): DeviceAppEntry[] {
  const apps = device === "phone" ? PHONE_HOME_APPS : LAPTOP_APPS;
  // The bank, calendar and files apps show their own facts even without items.
  const always: readonly DeviceAppId[] = ["bank", "calendar", "files"];
  return apps
    .filter((app) => view.available.includes(app) || always.includes(app))
    .map((app) => ({ app, label: t(`device.apps.${app}`), icon: APP_ICONS[app], badge: view.unread[app] }));
}