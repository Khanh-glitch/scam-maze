// Status bar of the phone: the in-game time on the left, signal, Wi-Fi and battery on the right.
// Decorative (hidden from assistive technology). The icons are the owner-supplied status bar art
// that the call screen also uses. The Dynamic Island sits in the middle at iPhone proportions
// (126 x 37 pt on a 402 pt wide screen: 31% of the width).
import React from "react";
import { ICONS, ICON_DIR } from "../call/PhoneStatusBar";

export interface PhoneTopBarProps {
  time: string;
  /** Draws the Dynamic Island. The page draws it on the 3D phone too: the page covers the model's glass. */
  island: boolean;
}

export const PhoneTopBar: React.FC<PhoneTopBarProps> = ({ time, island }) => (
  <div
    aria-hidden="true"
    data-testid="phone-top-bar"
    className="pointer-events-none relative grid h-9 shrink-0 grid-cols-[1fr_31%_1fr] items-center px-4 pt-1 text-[#f2f7fb]"
  >
    <span data-testid="phone-top-time" className="text-[15px] font-semibold leading-none tabular-nums">
      {time}
    </span>
    <span className="flex justify-center">
      {island && <span data-testid="phone-island" className="block w-full rounded-full bg-black" style={{ aspectRatio: "126 / 37", maxHeight: 30 }} />}
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
