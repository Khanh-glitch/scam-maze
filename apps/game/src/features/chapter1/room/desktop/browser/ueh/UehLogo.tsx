// The UEH University wordmark: three rounded letters in dark teal and "UNIVERSITY" in orange, as
// the owner supplied it for the game. It is drawn here as a vector (paths and one text line) so it
// stays sharp at any size and needs no extra file. If the original image file is added to
// `public/assets/branding/`, it can replace this component without touching the sites.
import React from "react";

export const UEH_TEAL = "#005b69";
export const UEH_ORANGE = "#f47a38";

export interface UehLogoProps {
  /** Height in pixels; the width follows the logo's proportions (1024 by 598). */
  height?: number;
  className?: string;
}

export const UehLogo: React.FC<UehLogoProps> = ({ height = 36, className }) => (
  <svg
    role="img"
    aria-label="UEH University"
    viewBox="0 0 1024 598"
    height={height}
    width={(height * 1024) / 598}
    className={className}
    data-testid="ueh-logo"
    focusable="false"
  >
    <title>UEH University</title>
    <path
      fill={UEH_TEAL}
      d="M36,0 H110 V282 A52.5,52.5 0 0 0 215,282 V0 H289 Q325,0 325,36 V267.5 A162.5,162.5 0 0 1 0,267.5 V36 Q0,0 36,0 Z"
    />
    <path
      fill={UEH_TEAL}
      d="M404,0 H658 V93 H472 V163 H630 V258 H472 V333 H658 V394 Q658,430 622,430 H413 Q368,430 368,385 V36 Q368,0 404,0 Z"
    />
    <path
      fill={UEH_TEAL}
      d="M739,0 H808 V163 H918 V0 H1024 V385 Q1024,430 979,430 H918 V258 H808 V430 H703 V36 Q703,0 739,0 Z"
    />
    <text
      x="0"
      y="596"
      fill={UEH_ORANGE}
      fontSize="172"
      fontWeight="800"
      fontFamily="Montserrat, 'Segoe UI Black', 'Arial Black', Arial, sans-serif"
      textLength="1024"
      lengthAdjust="spacingAndGlyphs"
    >
      UNIVERSITY
    </text>
  </svg>
);
