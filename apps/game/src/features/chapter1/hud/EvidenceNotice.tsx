// Short notice when an Evidence_Item is discovered (Requirement 11.6).
// A compact cinematic toast in the upper-right column, below the Journal button. It is a polite
// status region, fades in and out by itself and disappears after `durationMs`. Remount (new
// `key`) to restart. Motion is off with reduced motion.

import React, { useEffect, useRef, useState } from "react";
import { CircleCheck, FileText } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import { CINE, CINE_KEYFRAMES, cinePanelStyle } from "../theme";

export interface EvidenceNoticeProps {
  /** Evidence_Item title from the scenario. */
  title: string;
  onDismiss?: () => void;
  durationMs?: number;
}

export const EvidenceNotice: React.FC<EvidenceNoticeProps> = ({ title, onDismiss, durationMs = CINE.motion.toastMs }) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = useReducedMotion();
  const [leaving, setLeaving] = useState(false);
  // Latest callback without restarting the timer when the parent passes a new function.
  const onDismissRef = useRef(onDismiss);
  useEffect(() => {
    onDismissRef.current = onDismiss;
  }, [onDismiss]);

  useEffect(() => {
    const fadeAt = Math.max(0, durationMs - CINE.motion.baseMs);
    const fadeId = window.setTimeout(() => setLeaving(true), fadeAt);
    const id = window.setTimeout(() => onDismissRef.current?.(), durationMs);
    return () => {
      window.clearTimeout(fadeId);
      window.clearTimeout(id);
    };
  }, [durationMs]);

  return (
    <div
      role="status"
      aria-live="polite"
      data-testid="evidence-notice"
      data-leaving={leaving ? "true" : "false"}
      className="pointer-events-none flex items-center gap-3 px-3 py-2.5"
      style={{
        ...cinePanelStyle(true),
        width: CINE.widthPx.toast,
        maxWidth: "100%",
        fontSize: CINE.fontPx.body,
        opacity: leaving && !reducedMotion ? 0 : 1,
        transition: reducedMotion ? "none" : `opacity ${CINE.motion.baseMs}ms ${CINE.motion.ease}`,
        animation: reducedMotion ? undefined : `scammaze-cine-rise-in ${CINE.motion.slideMs}ms ${CINE.motion.ease} both`,
      }}
    >
      {reducedMotion ? null : <style>{CINE_KEYFRAMES}</style>}
      <FileText className="h-5 w-5 shrink-0" style={{ color: CINE.color.accentText }} aria-hidden="true" />
      <span className="min-w-0 flex-1 leading-snug">
        <span className="block font-bold">{t("notice.newEvidence")}</span>
        <span data-testid="evidence-notice-title" className="block break-words" style={{ color: CINE.color.textMuted }}>
          {title}
        </span>
        <span className="block" style={{ fontSize: CINE.fontPx.small, color: CINE.color.textMuted }}>
          {t("notice.addedToJournal")}
        </span>
      </span>
      <CircleCheck className="h-5 w-5 shrink-0" style={{ color: CINE.color.success }} aria-hidden="true" />
    </div>
  );
};