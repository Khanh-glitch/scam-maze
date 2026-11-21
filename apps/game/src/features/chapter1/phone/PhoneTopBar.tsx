// Status bar of the phone: the in-game time on the left, signal, Wi-Fi and battery on the right.
// Decorative (hidden from assistive technology). The icons are the owner-supplied status bar art
// that the call screen also uses. On the flat phone frame a small island marks the camera.
import React from "react";
import { ICONS, ICON_DIR } from "../call/PhoneStatusBar";

export interface PhoneTopBarProps {
  time: string;
  /** Draws the camera island. Off on the 3D phone, whose model already has one. */
  island: boolean;
}

export const PhoneTopBar: React.FC<PhoneTopBarProps> = ({ time, island }) => (
  <div
    aria-hidden="true"
    data-testid="phone-top-bar"
    className="pointer-events-none relative grid h-9 shrink-0 grid-cols-[1fr_30%_1fr] items-center px-4 pt-1 text-[#f2f7fb]"
  >
    <span data-testid="phone-top-time" className="text-[15px] font-semibold leading-none tabular-nums">
      {time}
    </span>
    <span className="flex justify-center">
      {island && <span className="block h-[18px] w-[60px] rounded-full bg-[#05090f]" />}
    </span>
    <span className="flex items-center justify-end gap-1.5">
      {ICONS.map((icon) => (
        <img
          key={icon.file}
          src={`${ICON_DIR}/${encodeURIComponent(icon.file)}`}
          alt=""
          width={icon.w}
          height={icon.h}
          draggable={false}
          style={{ width: icon.w, height: icon.h }}
        />
      ))}
    </span>
  </div>
);
