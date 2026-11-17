import React, { useEffect, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import { KEYCAP, SHADOW, stop } from "./PrologueHud";
import { lineKey, optionKey, visibleOptions, type DialogueGraph, type DialogueState } from "./quest/dialogue";

const ICON_CHAT = "/assets/ui/hud/scammaze-chat-icon-512.png";
const ICON_MOUSE = "/assets/ui/hud/mouse.webp";

export interface DialogueOverlayProps {
  graph: DialogueGraph;
  state: DialogueState;
  /** Name shown over the line, already translated. */
  speaker: string;
  onChoose: (optionId: string) => void;
  /** Move on from a line that has no replies. */
  onAdvance: () => void;
  /** Leave the conversation early (Escape). */
  onClose: () => void;
  onHoverSound?: () => void;
}

/**
 * Street conversation in the style of an action game: a dark band at the bottom with the speaker's
 * name and line, and the player's replies as a separate list on the right. The highlighted reply
 * shows the F key and a pointer that slides gently. A line with no replies shows "continue".
 *
 * Keys: Up and Down move the highlight; F picks the highlighted reply (or continues); Escape leaves. A click anywhere continues a line without replies.
 */
export const DialogueOverlay: React.FC<DialogueOverlayProps> = ({ graph, state, speaker, onChoose, onAdvance, onClose, onHoverSound }) => {
  const { t } = useTranslation("worlds");
  const text = (key: string) => (t as unknown as (k: string) => string)(key.replace(/^worlds:/, ""));
  const options = visibleOptions(graph, state);
  const [active, setActive] = useState(0);
  const lastNode = useRef<string | null>(null);
  const first = useRef<HTMLButtonElement | null>(null);
  const node = state.node;

  // A new line starts with the first reply highlighted.
  useEffect(() => {
    if (lastNode.current !== node) {
      lastNode.current = node;
      setActive(0);
    }
    first.current?.focus({ preventScroll: true });
  }, [node]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.key === "Escape") {
        event.preventDefault();
        event.stopPropagation();
        onClose();
        return;
      }
      const confirm = event.code === "KeyF";
      if (options.length === 0) {
        if (confirm) {
          event.preventDefault();
          onAdvance();
        }
        return;
      }
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setActive((i) => (i + 1) % options.length);
      } else if (event.key === "ArrowUp") {
        event.preventDefault();
        setActive((i) => (i + options.length - 1) % options.length);
      } else if (confirm) {
        event.preventDefault();
        onChoose(options[Math.min(active, options.length - 1)].id);
      }
    };
    // Capture phase: the page's own Escape handling must not also open the pause menu.
    window.addEventListener("keydown", onKey, true);
    return () => window.removeEventListener("keydown", onKey, true);
  }, [options, active, onChoose, onAdvance, onClose]);

  if (node === null) return null;
  const line = text(lineKey(graph, node));

  return (
    <div className="absolute inset-0 z-[64] select-none" onMouseDown={stop} onClick={(event) => {
      stop(event);
      // A line with no replies: a click anywhere moves on.
      if (options.length === 0) onAdvance();
    }}>
      <div aria-hidden="true" className="pointer-events-none absolute inset-x-0 bottom-0 h-[46%] bg-gradient-to-t from-black/85 via-black/55 to-transparent" />
      {options.length > 0 && (
        <ul aria-label={text("quests.dialogue.replies")} className="absolute bottom-[26%] right-[clamp(1rem,7vw,8rem)] flex w-full max-w-md flex-col items-stretch gap-2">
          {options.map((option, index) => {
            const on = index === active;
            return (
              <li key={option.id} className="flex items-center gap-2">
                <span aria-hidden="true" className={`flex shrink-0 items-center gap-1.5 ${on ? "" : "invisible"}`}>
                  {options.length > 1 && <img src={ICON_MOUSE} alt="" width={20} height={32} draggable={false} className="h-8 w-5 shrink-0 opacity-85" />}
                  <kbd className={`${KEYCAP} !bg-white !text-[#171521]`}>F</kbd>
                  <span className="dialogue-nudge text-sm leading-none text-white">&#9654;</span>
                </span>
                <button
                  ref={index === 0 ? first : undefined}
                  type="button"
                  onClick={() => onChoose(option.id)}
                  onPointerEnter={() => {
                    if (!on) onHoverSound?.();
                    setActive(index);
                  }}
                  className={`flex min-w-0 flex-1 items-center gap-3 rounded-full border px-4 py-2 text-left outline-none transition-colors cursor-pointer ${on ? "border-white/80 bg-white/90 text-[#171521]" : "border-white/30 bg-black/55 text-zinc-100"}`}
                >
                  <img src={ICON_CHAT} alt="" width={22} height={22} draggable={false} className={`h-[22px] w-[22px] shrink-0 ${on ? "invert" : ""}`} />
                  <span className="text-base font-medium leading-snug">{text(optionKey(graph, option.id))}</span>
                </button>
              </li>
            );
          })}
        </ul>
      )}
      <div role="dialog" aria-labelledby="dialogue-speaker" aria-describedby="dialogue-line" className="absolute inset-x-0 bottom-0 px-[clamp(1rem,8vw,9rem)] pb-[clamp(1.5rem,6vh,4rem)]">
        <div className={`mx-auto max-w-4xl ${SHADOW}`}>
          <p id="dialogue-speaker" className="font-menu text-2xl font-bold uppercase tracking-[0.08em] text-[#f3c969]">
            {speaker}
          </p>
          <div aria-hidden="true" className="mt-1 h-px w-full bg-gradient-to-r from-[#f3c969]/80 via-[#f3c969]/30 to-transparent" />
          <p id="dialogue-line" aria-live="polite" className="mt-2 text-xl leading-relaxed text-[#f3efe4]">
            {line}
          </p>
          {options.length === 0 && (
            <p className="mt-3 font-menu text-sm font-semibold uppercase tracking-[0.14em] text-zinc-200">
              {text("quests.dialogue.continue")}
            </p>
          )}
        </div>
      </div>
    </div>
  );
};
