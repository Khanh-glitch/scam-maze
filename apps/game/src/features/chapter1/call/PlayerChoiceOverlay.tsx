// Choice_Overlay for an active call: the player's reply options, shown outside the phone screen as
// compact cinematic response cards (lower-left in the wide layout). Pure DOM (no three, React Three
// Fiber or Drei imports). It is rendered by `CallPresentation` as a sibling of `PhoneScreenHost`,
// never inside it (Requirement 3.2).
// See design.md, "`PlayerChoiceOverlay.tsx` (DOM only)", and Requirements 3, 4 and 7.10.
//
// - Root: fixed at `region` (from `computeCallLayout`), `maxHeight: region.height`, vertical
//   scroll only. The root has no panel of its own; each card is a translucent charcoal surface
//   from the `CINE` tokens.
// - A screen-reader-only label from `dialogue.optionsLabel` names the option list (`aria-labelledby`);
//   it takes no visible row.
// - Optional narration paragraph (a non-caller line, labeled with `dialogue.systemSpeaker`).
// - `ol > li > button` per option with a key-cap hint (1-9), wrapped text, and
//   `dialogue.fallbackOption` for fallback options; `dialogue.noOptions` and no list when empty.
//   The list scrolls only when it really overflows the region (measured), and then a hint says so.
//   The hang-up option is pinned at the bottom of the scroller. No option is ever dropped.
// - The cards exist only at a decision point. After a pick they leave at once (until the node
//   changes), so a reply cannot be picked twice.
// - Keyboard logic comes from `useDialogueOptionKeys` (number keys, arrows and auto focus). Enter
//   and Space use the native button activation. The overlay holds no dialogue state and only
//   reports the chosen option ID.
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle, PhoneOff, ShieldQuestion } from "lucide-react";
import { useTranslation } from "react-i18next";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import type { DialogueView } from "../../../game/narrative/selectors";
import { CINE, CINE_KEYCAP_STYLE, CINE_KEYFRAMES, UI, cinePanelStyle } from "../theme";
import { useDialogueOptionKeys } from "../dialogue/useDialogueOptionKeys";
import type { Rect } from "./callLayout";
import { choiceIconKind, type ChoiceIconKind } from "./choiceIcon";

const ICONS: Record<ChoiceIconKind, React.ComponentType<{ className?: string; "aria-hidden"?: boolean | "true" | "false" }>> = {
  "hang-up": PhoneOff,
  challenge: ShieldQuestion,
  reply: MessageCircle,
};

export interface PlayerChoiceOverlayProps {
  /** Call-linked view from `selectDialogueView`. */
  view: DialogueView;
  /** Non-caller line text shown above the options, or null. */
  narration: string | null;
  /** True while the page is paused: every option is disabled. */
  disabled: boolean;
  /** The page's `handleSelectOption`. */
  onSelectOption: (optionId: string) => void;
  /** Region from `computeCallLayout` (`layout.choice`); its height is the maximum height. */
  region: Rect;
  /** True while the caller is still speaking: replies are hidden until the wait ends. */
  waiting?: boolean;
  /** Ends the wait early ("Show replies now"). */
  onSkipWait?: () => void;
}

/** Layout and state classes of a response card. Colors come from `CINE` through inline styles. */
export const CHOICE_CARD_CLASS =
  "flex w-full items-center gap-3 px-3 py-[7px] text-left font-medium leading-snug whitespace-normal break-words cursor-pointer focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:text-[#a9a4c4]";

/** Leading icon of a response card, in a round holder. Decorative. */
const OptionIcon: React.FC<{ kind: ChoiceIconKind; selected: boolean }> = ({ kind, selected }) => {
  const Icon = ICONS[kind];
  return (
    <span
      aria-hidden="true"
      data-testid="choice-icon"
      data-icon={kind}
      className="inline-flex shrink-0 items-center justify-center"
      style={{
        width: CINE.iconCirclePx,
        height: CINE.iconCirclePx,
        borderRadius: 999,
        background: selected ? CINE.color.iconCircleSelectedBg : CINE.color.iconCircleBg,
        color: selected ? CINE.color.text : CINE.color.accentText,
      }}
    >
      <Icon className="h-4 w-4" aria-hidden="true" />
    </span>
  );
};

export const PlayerChoiceOverlay: React.FC<PlayerChoiceOverlayProps> = ({
  view,
  narration,
  disabled,
  onSelectOption,
  region,
  waiting = false,
  onSkipWait,
}) => {
  const { t } = useTranslation("chapter1");
  const text = t as unknown as (key: string) => string;
  const reducedMotion = useReducedMotion();
  const labelId = useId();
  const options = view.options;
  const nodeKey = `${view.graphId}:${view.nodeId}`;

  // The node whose reply was just picked: its cards stay hidden until the node changes.
  const [pickedKey, setPickedKey] = useState<string | null>(null);
  const picked = pickedKey === nodeKey;
  const [activeIndex, setActiveIndex] = useState(0);
  useEffect(() => {
    setActiveIndex(0);
  }, [nodeKey]);
  useEffect(() => {
    // A pick that changed nothing (refused action) brings the cards back instead of a dead end.
    if (!picked) return undefined;
    const id = window.setTimeout(() => setPickedKey(null), CINE.motion.slideMs + CINE.choiceRecoverMs);
    return () => window.clearTimeout(id);
  }, [picked]);

  const handleSelect = useCallback(
    (optionId: string) => {
      if (picked) return;
      setPickedKey(nodeKey);
      onSelectOption(optionId);
    },
    [nodeKey, onSelectOption, picked],
  );

  const { setOptionRef, onOptionKeyDown, focusFirst } = useDialogueOptionKeys({
    options,
    onSelectOption: handleSelect,
    disabled: disabled || picked,
    numberKeys: !waiting && !picked,
    autoFocus: !waiting && !picked,
    nodeKey,
  });

  const skipRef = useRef<HTMLButtonElement | null>(null);
  const wasWaiting = useRef(false);
  useEffect(() => {
    if (waiting) {
      skipRef.current?.focus();
    } else if (wasWaiting.current) {
      // The wait just ended: move focus from the removed button to the first option.
      focusFirst();
    }
    wasWaiting.current = waiting;
  }, [waiting, focusFirst]);

  // Selected or hovered: a clear violet border and a soft violet glow. The others are darker with a hairline border.
  const cardStyle = (selected: boolean): React.CSSProperties => ({
    ...cinePanelStyle(true),
    borderRadius: CINE.radiusPx.card,
    fontSize: CINE.fontPx.body,
    background: selected ? CINE.color.selectedBg : CINE.color.cardBg,
    border: `1px solid ${selected ? CINE.color.selectedBorder : CINE.color.cardBorder}`,
    boxShadow: selected ? CINE.color.selectedGlow : "none",
    transition: reducedMotion
      ? "none"
      : `background ${CINE.motion.fastMs}ms ${CINE.motion.ease}, border-color ${CINE.motion.fastMs}ms ${CINE.motion.ease}, box-shadow ${CINE.motion.fastMs}ms ${CINE.motion.ease}`,
  });

  const showCards = !waiting && !picked;

  // The list scrolls only when it really overflows its box. The hang-up exit stays pinned at the
  // bottom of the scroller (sticky), so it is never hidden.
  const listRef = useRef<HTMLOListElement | null>(null);
  const [scrolls, setScrolls] = useState(false);
  useLayoutEffect(() => {
    const el = listRef.current;
    if (!el || !showCards) {
      setScrolls(false);
      return undefined;
    }
    const measure = () => setScrolls(el.scrollHeight - el.clientHeight > 1);
    measure();
    if (typeof ResizeObserver === "undefined") return undefined;
    const observer = new ResizeObserver(measure);
    observer.observe(el);
    return () => observer.disconnect();
  }, [showCards, options.length, region.height, region.width, nodeKey]);
  let pinnedIndex = -1;
  options.forEach((option, index) => {
    if (choiceIconKind(option) === "hang-up") pinnedIndex = index;
  });

  return (
    <div
      data-testid="player-choice-overlay"
      className="flex flex-col gap-2"
      style={{
        position: "fixed",
        left: region.left,
        // Anchored to the bottom of the region: the cards sit right above the subtitle.
        bottom: `max(0px, calc(100dvh - ${region.top + region.height}px))`,
        width: region.width,
        maxHeight: region.height,
        // The list inside scrolls (it shrinks first); the root itself never hides a card.
        overflow: "hidden",
        // Room for the focus outline (2 px + 2 px offset) of the cards at the edges.
        padding: 4,
        boxSizing: "border-box",
        // The dim layer above the room never swallows clicks outside the cards.
        pointerEvents: "none",
      }}
    >
      {reducedMotion ? null : <style>{CINE_KEYFRAMES}</style>}
      {/* Persistent polite region, so a new narration line is announced once. */}
      <div aria-live="polite" aria-atomic="true" data-testid="choice-narration" style={{ pointerEvents: "auto", marginTop: "auto" }}>
        {narration ? (
          <div className="px-3.5 py-2.5" style={{ ...cinePanelStyle(true), fontSize: CINE.fontPx.body }}>
            <p className={`${UI.label} flex items-center gap-1.5`}>
              <MessageCircle className="h-3.5 w-3.5 shrink-0" aria-hidden="true" />
              <span>{t("dialogue.systemSpeaker")}</span>
            </p>
            <p className="mt-1.5 whitespace-normal break-words leading-relaxed" style={{ color: CINE.color.text }}>
              {narration}
            </p>
          </div>
        ) : null}
      </div>

      {waiting ? (
        <div className="flex flex-col gap-2" data-testid="choice-waiting" style={{ pointerEvents: "auto" }}>
          <p role="status" className="px-1" style={{ fontSize: CINE.fontPx.body, color: CINE.color.textMuted }}>
            {t("phone.call.listening")}
          </p>
          <button
            type="button"
            ref={skipRef}
            data-testid="choice-skip-wait"
            className={CHOICE_CARD_CLASS}
            style={cardStyle(false)}
            disabled={disabled}
            onClick={() => onSkipWait?.()}
          >
            <span className="min-w-0 flex-1 whitespace-normal break-words">{t("phone.call.showReplies")}</span>
          </button>
        </div>
      ) : null}

      {showCards ? (
        // Names the list for assistive technology; it takes no visible row.
        <p id={labelId} className="sr-only">
          {t("dialogue.optionsLabel")}
        </p>
      ) : null}

      {!showCards ? null : options.length === 0 ? (
        <p className="px-1" style={{ fontSize: CINE.fontPx.body, color: CINE.color.textMuted }}>
          {t("dialogue.noOptions")}
        </p>
      ) : (
        <>
          <ol
            aria-labelledby={labelId}
            data-testid="choice-list"
            data-scrolls={scrolls ? "true" : "false"}
            ref={listRef}
            className="flex flex-col gap-1.5"
            style={{
              pointerEvents: "auto",
              padding: 4,
              minHeight: 0,
              overflowY: "auto",
              overflowX: "hidden",
              overscrollBehavior: "contain",
            }}
          >
            {options.map((option, index) => (
              <li
                key={option.id}
                data-pinned={index === pinnedIndex ? "true" : undefined}
                style={{
                  ...(index === pinnedIndex ? { position: "sticky", bottom: 0, zIndex: 1, background: CINE.color.laptopDock, borderRadius: CINE.radiusPx.card } : null),
                  ...(reducedMotion
                    ? null
                    : {
                        animation: `scammaze-cine-slide-in ${CINE.motion.slideMs}ms ${CINE.motion.ease} both`,
                        animationDelay: `${Math.min(index, 3) * 40}ms`,
                      }),
                }}
              >
                <button
                  type="button"
                  ref={setOptionRef(index)}
                  data-testid={`dialogue-option-${option.id}`}
                  data-selected={index === activeIndex ? "true" : "false"}
                  className={CHOICE_CARD_CLASS}
                  style={cardStyle(index === activeIndex && !disabled)}
                  disabled={disabled}
                  onClick={() => handleSelect(option.id)}
                  onKeyDown={(event) => onOptionKeyDown(event, index)}
                  onMouseEnter={() => setActiveIndex(index)}
                  onFocus={(event) => {
                    setActiveIndex(index);
                    event.currentTarget.scrollIntoView?.({ block: "nearest" });
                  }}
                >
                  <OptionIcon kind={choiceIconKind(option)} selected={index === activeIndex && !disabled} />
                  <span className="min-w-0 flex-1 whitespace-normal break-words">
                    {option.fallback ? t("dialogue.fallbackOption") : option.text}
                  </span>
                  {index < 9 ? (
                    <kbd aria-hidden="true" className="mt-px inline-flex shrink-0 items-center justify-center font-mono" style={CINE_KEYCAP_STYLE}>
                      {index + 1}
                    </kbd>
                  ) : null}
                </button>
              </li>
            ))}
          </ol>
          {scrolls ? (
            <p className="px-1" data-testid="choice-more" style={{ fontSize: CINE.fontPx.small, color: CINE.color.textMuted, pointerEvents: "auto", flexShrink: 0 }}>
              {text("room.call.moreReplies")}
            </p>
          ) : null}
        </>
      )}
    </div>
  );
};
