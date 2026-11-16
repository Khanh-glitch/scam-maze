// Interaction prompt drawn next to the aimed prop: a key-cap pill with the key and the verb label.
// The engine projects the prop's world point to container pixels (`UIState.anchor`); this
// component only places a small box beside it (`placePrompt`, pure). Presentation only.
import React from "react";
import { placePrompt } from "../../roomv2/game/screenProjection";
import { CINE, CINE_KEYCAP_STYLE, cinePanelStyle } from "../theme";
import { useViewport } from "../call/useViewport";

export interface AnchoredPromptProps {
  /** Verb label of the aimed prop, for example "Use the laptop". Already translated. */
  label: string;
  /** Projected world point of the prop, in pixels from the top-left of the room view. */
  anchor: { x: number; y: number };
  /** The key that runs the interaction. */
  keyLabel?: string;
}

export const AnchoredPrompt: React.FC<AnchoredPromptProps> = ({ label, anchor, keyLabel = "E" }) => {
  const viewport = useViewport();
  const { offsetPx, marginPx, boxWidthPx, boxHeightPx } = CINE.prompt;
  const { left, top } = placePrompt(anchor.x, anchor.y, viewport.width, viewport.height, boxWidthPx, boxHeightPx, offsetPx, marginPx);
  return (
    <div
      data-testid="anchored-prompt"
      className="pointer-events-none absolute flex items-center gap-2 whitespace-nowrap px-2 py-1"
      style={{
        ...cinePanelStyle(),
        borderRadius: CINE.radiusPx.chip,
        fontSize: CINE.fontPx.small,
        left,
        top,
        maxWidth: boxWidthPx,
      }}
    >
      <kbd aria-hidden="true" className="inline-flex items-center justify-center font-mono" style={CINE_KEYCAP_STYLE}>
        {keyLabel}
      </kbd>
      <span>{label}</span>
    </div>
  );
};
