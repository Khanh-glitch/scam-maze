// The laptop's Thesis window: a white page on a soft gray desk, like a word processor. The content is
// the same thesis panel and actions as before (work sessions, rest, tasks); only the look is new.
import React from "react";
import { ThesisPanel, type ThesisPanelProps } from "../../../world/ThesisPanel";

export const ThesisWindow: React.FC<Omit<ThesisPanelProps, "tone">> = (props) => (
  <div className="h-full overflow-y-auto overscroll-contain p-4" data-testid="thesis-window" style={{ background: "#e9edf3" }} onWheel={(event) => event.stopPropagation()}>
    <div className="mx-auto max-w-xl rounded-md bg-white p-6" style={{ boxShadow: "0 1px 3px rgba(31,41,55,0.18), 0 8px 18px -10px rgba(31,41,55,0.25)" }}>
      <ThesisPanel {...props} tone="paper" />
    </div>
  </div>
);
