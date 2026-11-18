// Choice_Overlay for an active call: the player's reply options, shown outside the phone screen as
// compact cinematic response cards (lower-left in the wide layout). Pure DOM (no three, React Three
// Fiber or Drei imports). It is rendered by `CallPresentation` as a sibling of `PhoneScreenHost`,
// never inside it (Requirement 3.2).
// See design.md, "`PlayerChoiceOverlay.tsx` (DOM only)", and Requirements 3, 4 and 7.10.
//
// - Same look as the street conversation (`prologue/DialogueOverlay`): replies are pills in their own
//   list on the left, apart from the caller's line. The highlighted pill shows the mouse icon, the F key
//   cap and a pointer that slides gently; its light background sweeps in from the left.
// - Root: fixed at `region` (from `computeCallLayout`), `maxHeight: region.height`, vertical
//   scroll only. The root has no panel of its own.
// - A screen-reader-only label from `dialogue.optionsLabel` names the option list (`aria-labelledby`);
//   it takes no visible row.
// - Optional narration paragraph (a non-caller line, labeled with `dialogue.systemSpeaker`).
// - `ol > li > button` per option, wrapped text, and `dialogue.fallbackOption` for fallback options;
//   `dialogue.noOptions` and no list when empty. The list scrolls only when it really overflows the
//   region (measured), and then a hint says so. The hang-up option is pinned at the bottom of the
//   scroller. No option is ever dropped.
// - While the caller line is still typing (`waiting`), nothing is shown here; the replies appear as
//   soon as the line is fully revealed. There is no "continue" step.
// - The cards exist only at a decision point. After a pick they leave at once (until the node
//   changes), so a reply cannot be picked twice.
// - Keys: Up and Down (or the mouse wheel / trackpad) move the highlight, with the hover sound; F picks
//   the highlighted reply. Enter and Space still work on a focused button. The overlay holds no dialogue
//   state and only reports the chosen option ID.
import React, { useCallback, useEffect, useId, useLayoutEffect, useRef, useState } from "react";
import { MessageCircle } from "lucide-react";
import { useTranslation } from "react-i18next";
import { createWheelStepper } from "../../../components/ui/wheelStep";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";
import type { DialogueView } from "../../../game/narrative/selectors";
import { CINE, CINE_KEYFRAMES, UI, cinePanelStyle } from "../theme";
import { useDialogueOptionKeys } from "../dialogue/useDialogueOptionKeys";
import type { Rect } from "./callLayout";
import { choiceIconKind } from "./choiceIcon";

const ICON_CHAT = "/assets/ui/hud/scammaze-chat-icon-512.png";
const ICON_MOUSE = "/assets/ui/hud/mouse.webp";

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
  /** True while the caller line is still typing: replies are hidden until it is fully revealed. */
  waiting?: boolean;
  /** Plays the hover sound when the highlight moves. */
  onHoverSound?: () => void;
}

/** Layout and state classes of a response pill. Colors are set by the active state. */
export const CHOICE_CARD_CLASS =
  "relative flex min-w-0 flex-1 items-center gap-3 overflow-hidden rounded-full border px-6 py-3 text-left text-lg font-medium leading-snug whitespace-normal break-words cursor-pointer outline-none transition-colors duration-200 delay-100 disabled:cursor-not-allowed disabled:opacity-60";
const CARD_ON = "border-white/80 text-[#171521]";
const CARD_OFF = "border-white/30 bg-black/55 text-zinc-100";
/** Leading icon of a response pill: the chat icon only, inverted on the light highlighted pill. Decorative. */
const OptionIcon: React.FC<{ selected: boolean }> = ({ selected }) => (
  <img data-testid="choice-icon" src={ICON_CHAT} alt="" aria-hidden="true" width={26} height={26} draggable={false} className={`relative h-[26px] w-[26px] shrink-0 transition-[filter] duration-300 ${selected ? "invert" : ""}`} />
);
/** The light layer of a highlighted pill: sweeps in from the left, fades out when the pill is left. */
const Sweep: React.FC<{ on: boolean; reducedMotion: boolean }> = ({ on, reducedMotion }) => (
  <span
    aria-hidden="true"
    className="pointer-events-none absolute inset-0 origin-left bg-white/90"
    style={{
      transform: on ? "scaleX(1)" : "scaleX(0)",
      opacity: on ? 1 : 0,
      transition: reducedMotion ? "none" : on ? "transform 380ms cubic-bezier(0.22,1,0.36,1), opacity 120ms" : "opacity 220ms ease-out, transform 0s linear 220ms",
    }}
  />
);
export const PlayerChoiceOverlay: React.FC<PlayerChoiceOverlayProps> = ({
  view,
  narration,
  disabled,
  onSelectOption,
  region,
  waiting = false,
  onHoverSound,
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

  const { setOptionRef, focusFirst } = useDialogueOptionKeys({
    options,
    onSelectOption: handleSelect,
    disabled: disabled || picked,
    numberKeys: false,
    autoFocus: !waiting && !picked,
    nodeKey,
  });

  const wasWaiting = useRef(false);
  useEffect(() => {
    // The line just finished typing: move focus to the first option.
    if (!waiting && wasWaiting.current) focusFirst();
    wasWaiting.current = waiting;
  }, [waiting, focusFirst]);

  const optionButtons = useRef<Array<HTMLButtonElement | null>>([]);
  const canAct = !waiting && !picked && !disabled && options.length > 0;
  // Moves the highlight (and the focus, so Enter and Space act on it) with the hover sound.
  const move = useCallback(
    (delta: number) => {
      if (options.length < 2) return;
      const next = (activeIndex + delta + options.length) % options.length;
      setActiveIndex(next);
      optionButtons.current[next]?.focus({ preventScroll: true });
      optionButtons.current[next]?.scrollIntoView?.({ block: "nearest" });
      onHoverSound?.();
    },
    [activeIndex, options.length, onHoverSound],
  );
  const stepper = useRef(createWheelStepper());
  useEffect(() => {
    if (!canAct) return undefined;
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.altKey || event.ctrlKey || event.metaKey) return;
      if (event.key === "ArrowDown") {
        event.preventDefault();
        move(1);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        move(-1);
      } else if (event.code === "KeyF") {
        event.preventDefault();
        const option = options[Math.min(activeIndex, options.length - 1)];
        if (option) handleSelect(option.id);
      }
    };
    const onWheel = (event: WheelEvent) => {
      const step = stepper.current(event.deltaY, event.deltaMode, performance.now());
      if (step !== 0) move(step);
    };
    window.addEventListener("keydown", onKey);
    window.addEventListener("wheel", onWheel, { passive: true });
    return () => {
      window.removeEventListener("keydown", onKey);
      window.removeEventListener("wheel", onWheel);
    };
  }, [canAct, move, options, activeIndex, handleSelect]);
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
          <div className="px-3.5 py-2.5" style={{ ...cinePanelStyle(true), fontSize: CINE.fontPx.subtitle }}>
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

      {showCards ? (
        // Names the list for assistive technology; it takes no visible row.
        <p id={labelId} className="sr-only">
          {t("dialogue.optionsLabel")}
        </p>
      ) : null}

      {!showCards ? null : options.length === 0 ? (
        <p className="px-1" style={{ fontSize: CINE.fontPx.subtitle, color: CINE.color.textMuted }}>
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
            {options.map((option, index) => {
              const on = index === activeIndex && !disabled;
              return (
                <li
                  key={option.id}
                  data-pinned={index === pinnedIndex ? "true" : undefined}
                  className="flex items-center gap-2"
                  style={{
                    ...(index === pinnedIndex ? { position: "sticky", bottom: 0, zIndex: 1 } : null),
                    ...(reducedMotion
                      ? null
                      : {
                          animation: `scammaze-cine-slide-in ${CINE.motion.slideMs}ms ${CINE.motion.ease} both`,
                          animationDelay: `${Math.min(index, 3) * 40}ms`,
                        }),
                  }}
                >
                  <span aria-hidden="true" data-testid="choice-hint" className={`flex shrink-0 items-center gap-1.5 transition-opacity duration-300 ${on ? "opacity-100" : "opacity-0"}`}>
                    {options.length > 1 ? <img src={ICON_MOUSE} alt="" width={24} height={38} draggable={false} className="h-[38px] w-6 shrink-0 opacity-85" /> : null}
                    <kbd className="inline-flex min-w-[1.8rem] items-center justify-center bg-white px-1.5 py-[0.2rem] font-mono text-sm font-semibold text-[#171521]">F</kbd>
                    <span className="dialogue-nudge text-base leading-none text-white">&#9654;</span>
                  </span>
                  <button
                    type="button"
                    ref={(element) => {
                      optionButtons.current[index] = element;
                      setOptionRef(index)(element);
                    }}
                    data-testid={`dialogue-option-${option.id}`}
                    data-selected={index === activeIndex ? "true" : "false"}
                    className={`${CHOICE_CARD_CLASS} ${on ? CARD_ON : CARD_OFF}`}
                    disabled={disabled}
                    onClick={() => handleSelect(option.id)}
                    onPointerEnter={() => {
                      if (index !== activeIndex) onHoverSound?.();
                      setActiveIndex(index);
                    }}
                    onFocus={(event) => {
                      setActiveIndex(index);
                      event.currentTarget.scrollIntoView?.({ block: "nearest" });
                    }}
                  >
                    <Sweep on={on} reducedMotion={reducedMotion} />
                    <OptionIcon selected={on} />
                    <span className="relative min-w-0 flex-1 whitespace-normal break-words">{option.fallback ? t("dialogue.fallbackOption") : option.text}</span>
                  </button>
                </li>
              );
            })}
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
