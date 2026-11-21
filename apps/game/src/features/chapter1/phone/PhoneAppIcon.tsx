// A rounded app tile with a line icon on the app's own gradient. One tile per app, the same on the
// lock screen, the home screen and the app header. Decorative: the label is always next to it.
import React from "react";
import {
  Briefcase,
  CalendarDays,
  FolderOpen,
  Globe,
  Home,
  Landmark,
  Mail,
  MapPin,
  MessageSquare,
  Phone,
  Voicemail,
  type LucideIcon,
} from "lucide-react";
import { PHONE_COLORS, phoneThemeFor, tileBackground } from "./phoneTheme";

const ICONS: Readonly<Record<string, LucideIcon>> = {
  messages: MessageSquare,
  calls: Phone,
  voicemail: Voicemail,
  browser: Globe,
  mail: Mail,
  bank: Landmark,
  map: MapPin,
  calendar: CalendarDays,
  housing: Home,
  jobs: Briefcase,
  files: FolderOpen,
};

export interface PhoneAppTileProps {
  /** Route key of the app: `messages`, `calls`, `voicemail`, `mail`, `bank`, ... */
  app: string;
  /** Tile size in logical px. */
  size: number;
}

export const PhoneAppTile: React.FC<PhoneAppTileProps> = ({ app, size }) => {
  const Icon = Object.hasOwn(ICONS, app) ? ICONS[app] : Mail;
  return (
    <span
      aria-hidden="true"
      className="flex shrink-0 items-center justify-center text-white"
      style={{
        width: size,
        height: size,
        borderRadius: Math.round(size * 0.28),
        background: tileBackground(phoneThemeFor(app)),
        boxShadow: PHONE_COLORS.tileShadow,
      }}
    >
      <Icon width={Math.round(size * 0.5)} height={Math.round(size * 0.5)} strokeWidth={2} />
    </span>
  );
};
