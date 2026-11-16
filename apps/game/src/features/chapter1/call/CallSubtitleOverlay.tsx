// Subtitle_Overlay for an active call: the current caller line, the connecting text and the voice
// notice, shown outside the phone screen. Pure DOM (no three, React Three Fiber or Drei imports).
// It is rendered by `CallPresentation` as a sibling of `PhoneScreenHost`, never inside it.
// See design.md, "`CallSubtitleOverlay`", and Requirements 5.1, 5.2, 5.6 to 5.11, 6.8 and 10.5.
//
// - Root: fixed at `region` (`layout.subtitle`, bottom-left in the wide layout), `pointer-events:
//   none`, not a tab stop, anchored to the bottom of the region. It holds one bar.
// - Bar: a dark translucent panel with the line (at most `CINE.subtitleVisibleLines` visible lines,
//   then it scrolls, it is never cut), a violet speaker pill sitting on its top-left edge and a
//   small chevron-down at the right while more text is below.
// - Two persistent polite live regions (the line with the speaker, and the notice) that are never
//   remounted, so a re-render with the same line makes no new announcement.
// - Transparent, without border, when there is nothing to show.
// - The line fades in over 150 ms, keyed by `nodeKey` only, and not with reduced motion.
import React, { useCallback, useLayoutEffect, useRef, useState } from "react";
import { ChevronDown } from "lucide-react";
import { useTranslation } from "react-i18next";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { CINE, cinePanelStyle } from "../theme";
import type { SubtitleContent } from "./callDialogueView";
import type { Rect } from "./callLayout";

export interface CallSubtitleOverlayProps {
  content: SubtitleContent;
  /** `isSubtitleVisible(...)`: false hides the line and the connecting text, not the notice. */
  visible: boolean;
  notice: "none" | "autoplay-blocked" | "dev-preview" | "english-voice" | "no-audio";
  /** Region from `computeCallLayout` (`layout.subtitle`); its height is the maximum height. */
  region: Rect;
}

const NOTICE_KEYS = {
  "autoplay-blocked": "phone.call.notice.autoplayBlocked",
  "dev-preview": "phone.call.notice.devPreview",
  "english-voice": "phone.call.notice.englishVoice",
  "no-audio": "phone.call.notice.noAudio",
} as const;

const FADE_ANIMATION = `scammaze-subtitle-in ${CINE.motion.fastMs}ms ease-out both`;
const FADE_KEYFRAMES = `@keyframes scammaze-subtitle-in {
  from { opacity: 0; }
  to { opacity: 1; }
}`;

export const CallSubtitleOverlay: React.FC<CallSubtitleOverlayProps> = ({
  content,
  visible,
  notice,
  region,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();

  const showLine = visible && content.kind === "line";
  const showConnecting = visible && content.kind === "connecting";
  const showNotice = notice !== "none";
  const hasContent = showLine || showConnecting || showNotice;

  // The chevron shows while the scrolling text has more below the visible part.
  const scrollerRef = useRef<HTMLDivElement | null>(null);
  const [more, setMore] = useState(false);
  const measure = useCallback(() => {
    const el = scrollerRef.current;
    setMore(el !== null && el.scrollHeight - el.scrollTop - el.clientHeight > 1);
  }, []);
  const lineKey = showLine && content.kind === "line" ? `${content.nodeKey}:${content.text}` : "";
  useLayoutEffect(() => {
    measure();
  }, [lineKey, measure, region.width]);

  const lineHeightPx = Math.round(CINE.fontPx.subtitle * CINE.subtitle.lineHeight);

  return (
    <div
      data-testid="call-subtitle-overlay"
      role="region"
      aria-label={t("phone.subtitle.label")}
      className="flex flex-col justify-end text-left"
      style={{
        position: "fixed",
        left: region.left,
        // Anchored to the bottom edge of the region, so a short line sits at the bottom.
        bottom: `max(0px, calc(100dvh - ${region.top + region.height}px))`,
        width: region.width,
        maxHeight: region.height,
        boxSizing: "border-box",
        overflow: "visible",
        pointerEvents: "none",
      }}
    >
      {reducedMotion ? null : <style>{FADE_KEYFRAMES}</style>}

      <div
        data-testid="call-subtitle-bar"
        className={hasContent ? "relative" : "relative border border-transparent bg-transparent"}
        style={{
          ...(hasContent ? cinePanelStyle(true) : null),
          borderRadius: CINE.radiusPx.card,
          padding: hasContent ? `${CINE.subtitle.padYPx}px ${CINE.subtitle.padXPx}px` : 0,
          boxSizing: "border-box",
          pointerEvents: hasContent ? "auto" : "none",
        }}
      >
        <div aria-live="polite" aria-atomic="true" data-testid="call-subtitle-region">
          {showLine && content.kind === "line" ? (
            <React.Fragment key={content.nodeKey}>
              <p
                data-testid="call-subtitle-speaker"
                className="absolute font-semibold"
                style={{
                  left: CINE.subtitle.padXPx,
                  top: -Math.round(CINE.subtitle.pillHeightPx / 2),
                  height: CINE.subtitle.pillHeightPx,
                  lineHeight: `${CINE.subtitle.pillHeightPx}px`,
                  padding: "0 10px",
                  borderRadius: CINE.radiusPx.chip,
                  background: CINE.color.namePillBg,
                  color: CINE.color.namePillText,
                  fontSize: CINE.fontPx.small,
                }}
              >
                {content.speakerName}
              </p>
              <div
                ref={scrollerRef}
                data-testid="call-subtitle-scroller"
                onScroll={measure}
                style={{
                  // Border-box: the top padding is added so both lines stay fully visible.
                  maxHeight: lineHeightPx * CINE.subtitleVisibleLines + Math.round(CINE.subtitle.pillHeightPx / 4),
                  overflowY: "auto",
                  overflowX: "hidden",
                  overscrollBehavior: "contain",
                  paddingRight: more ? 22 : 0,
                  paddingTop: Math.round(CINE.subtitle.pillHeightPx / 4),
                }}
              >
                <div style={reducedMotion ? undefined : { animation: FADE_ANIMATION }}>
                  <p
                    data-testid="call-subtitle-line"
                    className="whitespace-normal break-words"
                    style={{ fontSize: CINE.fontPx.subtitle, lineHeight: `${lineHeightPx}px`, color: CINE.color.text }}
                  >
                    {content.text}
                  </p>
                </div>
              </div>
              {more ? (
                <ChevronDown
                  data-testid="call-subtitle-more"
                  aria-hidden="true"
                  className="absolute h-4 w-4"
                  style={{ right: CINE.subtitle.padXPx - 2, bottom: CINE.subtitle.padYPx, color: CINE.color.accentText }}
                />
              ) : null}
            </React.Fragment>          ) : showConnecting ? (
            <p className="whitespace-normal break-words text-sm leading-relaxed text-[#a9a4c4]">
              {t("phone.call.connecting")}
            </p>
          ) : null}
        </div>

        <div
          aria-live="polite"
          aria-atomic="true"
          data-testid="call-notice"
          className={showNotice ? "mt-1 text-sm leading-relaxed text-[#a9a4c4]" : undefined}
        >
          {showNotice ? t(NOTICE_KEYS[notice]) : null}
        </div>
      </div>
    </div>
  );
};