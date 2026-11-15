// Phone-owned content of the 3D phone call screen. DOM only: no three, React Three Fiber or Drei
// imports. The same instance is shown on the 3D phone model and on the 2D fallback screen
// (PhoneScreenHost keeps it mounted across modes).
//
// Ringing: avatar, "Incoming call", caller name, number, Decline and Accept.
// Active: avatar, "Call in progress", caller name, number, mm:ss timer, a row of round buttons
// (Mute, Speaker, Replay) with visible labels, and a red End call button.
// The phone shows no sentences: the caller line, the connecting text and the voice notice live in
// CallSubtitleOverlay, and player choices live in PlayerChoiceOverlay. The number is plain text
// (no link, no `tel:`, no tab stop).
import React from "react";
import type { ReactNode, Ref } from "react";
import { useTranslation } from "react-i18next";
import {
  Phone,
  PhoneIncoming,
  PhoneOff,
  RotateCcw,
  Speaker,
  User,
  Volume2,
  VolumeX,
} from "lucide-react";
import { usePrefersReducedMotion } from "../../../components/ui/usePrefersReducedMotion";
import { UI } from "../theme";
import { PhoneStatusBar } from "./PhoneStatusBar";
import { formatCallDuration } from "./callTimer";
import type { PhoneCallView } from "./callDialogueView";

/** Voice state for the active call. */
export interface CallControlsView {
  durationSeconds: number;
  muted: boolean;
  speakerOn: boolean;
  /** False when sound is off, volume is 0 or there is no clip and no preview. */
  replayEnabled: boolean;
  /** True when the screen height is below 360 CSS px. */
  compact: boolean;
}

export interface PhoneCallScreenProps {
  view: PhoneCallView;
  /** Absent: the active screen shows End call only and no timer. */
  controls?: CallControlsView;
  /** True while the page is paused; disables every call button. */
  disabled: boolean;
  /** 2D avatar wobble; true only in fallback mode while ringing. Reduced motion turns it off. */
  vibrateIcon: boolean;
  onToggleMute?: () => void;
  onToggleSpeaker?: () => void;
  onReplay?: () => void;
  onAccept: () => void;
  onDecline: () => void;
  onHangUp: () => void;
  acceptRef?: Ref<HTMLButtonElement>;
  hangUpRef?: Ref<HTMLButtonElement>;
}

const VIBRATE_ANIMATION = "scammaze-call-screen-vibrate 1.4s ease-in-out infinite";
// A small rotation wobble with a rest between bursts, so it stays subtle.
const VIBRATE_KEYFRAMES = `@keyframes scammaze-call-screen-vibrate {
  0%, 40%, 100% { transform: rotate(0deg); }
  5%, 15%, 25% { transform: rotate(-8deg); }
  10%, 20%, 30% { transform: rotate(8deg); }
}`;

// Every text is at least `text-sm` (14 CSS px).
const NAME_CLASS = "text-xl font-bold break-words text-[#f7f5ff]";
const NUMBER_CLASS = "whitespace-nowrap text-sm leading-relaxed text-[#a9a4c4]";
const STATUS_BASE_CLASS = "text-sm font-semibold uppercase tracking-wider";
const AVATAR_CLASS =
  "flex shrink-0 items-center justify-center rounded-full border border-[#7654d6]/50 bg-[#171521] text-[#b9a5f5]";
const ROUND_BASE_CLASS =
  "flex shrink-0 items-center justify-center rounded-full border text-[#f7f5ff] motion-safe:transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] disabled:cursor-not-allowed disabled:border-[#38344f] disabled:bg-[#38344f] disabled:text-[#a9a4c4] cursor-pointer";
/** Big round accept, decline and end-call buttons: a colored disc with the label below it, inside one button. */
// No focus ring: Accept takes focus when the call rings, and a ring around the label looked wrong on the phone glass.
const CALL_BUTTON_CLASS =
  "group flex shrink-0 cursor-pointer flex-col items-center gap-1.5 rounded-xl outline-none disabled:cursor-not-allowed";
const CALL_DISC_CLASS =
  "flex h-16 w-16 items-center justify-center rounded-full motion-safe:transition-colors group-disabled:bg-[#38344f] group-disabled:text-[#a9a4c4]";
const DECLINE_DISC_CLASS = "bg-[#c93c47] text-white group-hover:bg-[#b3343e]";
const ACCEPT_DISC_CLASS = "bg-[#4fd1b5] text-[#171521] group-hover:bg-[#6ee0c7]";
const ROUND_OFF_CLASS = "border-[#38344f] bg-[#171521] hover:border-[#7654d6] hover:bg-[#26233a]";
const ROUND_ON_CLASS = "border-[#7654d6] bg-[#7654d6] hover:bg-[#8b6be8]";

interface RoundButtonProps {
  testId: string;
  label: string;
  ariaLabel?: string;
  pressed?: boolean;
  disabled: boolean;
  compact: boolean;
  onClick?: () => void;
  icon: ReactNode;
}

// One cell of the button row: a round button with its visible label below. The label becomes
// screen-reader-only below a 200 px container; the accessible name stays.
const RoundButton: React.FC<RoundButtonProps> = ({
  testId,
  label,
  ariaLabel,
  pressed,
  disabled,
  compact,
  onClick,
  icon,
}) => (
  <div className="flex min-w-0 flex-col items-center gap-1">
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      aria-pressed={pressed}
      aria-label={ariaLabel ?? label}
      data-testid={testId}
      className={`${ROUND_BASE_CLASS} ${pressed ? ROUND_ON_CLASS : ROUND_OFF_CLASS} ${
        compact ? "h-11 w-11" : "h-14 w-14"
      } @max-[200px]:h-10 @max-[200px]:w-10`}
    >
      {icon}
    </button>
    <span
      aria-hidden="true"
      className="max-w-full break-words text-sm leading-tight text-[#f7f5ff] @max-[200px]:sr-only"
    >
      {label}
    </span>
  </div>
);

export const PhoneCallScreen: React.FC<PhoneCallScreenProps> = ({
  view,
  controls,
  disabled,
  vibrateIcon,
  onToggleMute,
  onToggleSpeaker,
  onReplay,
  onAccept,
  onDecline,
  onHangUp,
  acceptRef,
  hangUpRef,
}) => {
  const { t } = useTranslation("chapter1");
  const reducedMotion = usePrefersReducedMotion();
  const ringing = view.status === "ringing";
  const vibrating = ringing && vibrateIcon && !reducedMotion;
  const compact = controls?.compact === true;
  const duration = controls ? formatCallDuration(controls.durationSeconds) : null;

  const avatarSize = compact ? "h-14 w-14" : "h-20 w-20";
  const avatarIconSize = compact ? "h-7 w-7" : "h-10 w-10";
  const groupGap = compact ? "gap-3" : "gap-6";
  const iconClass = "h-6 w-6 shrink-0";

  const avatar = (
    <div className={`${AVATAR_CLASS} ${avatarSize}`} data-testid="call-screen-avatar">
      <User className={avatarIconSize} aria-hidden="true" />
    </div>
  );

  return (
    <section
      aria-label={t("phone.callPresentation.screenLabel")}
      data-testid={ringing ? "incoming-call-screen" : "call-screen"}
      className={`relative flex h-full w-full flex-col overflow-hidden rounded-[13.7%/6.3%] px-4 pb-6 pt-[15%] text-center text-[#f7f5ff] ${groupGap}`}
      style={{ background: "linear-gradient(180deg, #1d1a33 0%, #0e0c18 100%)" }}
    >
      {vibrating ? <style>{VIBRATE_KEYFRAMES}</style> : null}
      {/* Dynamic Island: a black pill at the top of the glass (iPhone 17 Pro: 126 x 37 pt on a 402 x 874 pt screen). */}
      <div
        aria-hidden="true"
        data-testid="dynamic-island"
        className="pointer-events-none absolute left-1/2 top-[1.25%] h-[4.2%] w-[31%] -translate-x-1/2 rounded-full bg-black"
      />

      <PhoneStatusBar />

      {ringing ? (
        <>
          <div
            className={`flex min-h-0 flex-1 flex-col items-center justify-center ${
              compact ? "gap-2" : "gap-4"
            }`}
          >
            <p className={`${STATUS_BASE_CLASS} flex items-center gap-1.5 text-[#b9a5f5]`}>
              <PhoneIncoming className="h-4 w-4 shrink-0" aria-hidden="true" />
              <span>{t("phone.incomingCall.caption")}</span>
            </p>
            <div
              data-testid="incoming-call-icon"
              data-vibrating={vibrating ? "true" : "false"}
              style={vibrating ? { animation: VIBRATE_ANIMATION } : undefined}
              aria-hidden="true"
            >
              {avatar}
            </div>
            <div className="min-w-0 max-w-full">
              <p className={NAME_CLASS} data-testid="incoming-call-name">
                {view.callerName}
              </p>
              <p className={`${NUMBER_CLASS} mt-1`} dir="ltr" data-testid="incoming-call-number">
                {view.number}
              </p>
            </div>
          </div>

          <div className="flex w-full shrink-0 items-start justify-around">
            <button
                type="button"
                className={CALL_BUTTON_CLASS}
                onClick={onDecline}
                disabled={disabled}
                data-testid="incoming-call-decline"
            >
              <span className={`${CALL_DISC_CLASS} ${DECLINE_DISC_CLASS}`}>
                <PhoneOff className="h-7 w-7 shrink-0" aria-hidden="true" />
              </span>
              <span className="text-sm text-[#f7f5ff]">{t("phone.incomingCall.decline")}</span>
            </button>
            <button
                ref={acceptRef}
                type="button"
                className={CALL_BUTTON_CLASS}
                onClick={onAccept}
                disabled={disabled}
                data-testid="incoming-call-accept"
            >
              <span className={`${CALL_DISC_CLASS} ${ACCEPT_DISC_CLASS}`}>
                <Phone className="h-7 w-7 shrink-0" aria-hidden="true" />
              </span>
              <span className="text-sm text-[#f7f5ff]">{t("phone.incomingCall.accept")}</span>
            </button>
          </div>
        </>
      ) : (
        <>
          <header className={`flex shrink-0 flex-col items-center ${compact ? "gap-2" : "gap-3"}`}>
            <div aria-hidden="true">{avatar}</div>
            <p className={`${STATUS_BASE_CLASS} ${UI.textPositive}`}>{t("phone.call.status")}</p>
            <div className="min-w-0 max-w-full">
              <p className={NAME_CLASS}>{view.callerName}</p>
              <p className={NUMBER_CLASS} dir="ltr" data-testid="call-screen-number">
                {view.number}
              </p>
            </div>
            {controls && duration ? (
              <time
                role="timer"
                aria-label={t("phone.call.duration")}
                dateTime={duration.iso}
                data-testid="call-duration"
                className="block text-lg tabular-nums text-[#f7f5ff]"
              >
                {duration.text}
              </time>
            ) : null}
          </header>

          <div className="min-h-0 flex-1" />

          {controls ? (
            <div className="grid w-full shrink-0 grid-cols-3 gap-3">
              <RoundButton
                testId="call-screen-mute"
                label={controls.muted ? t("phone.call.unmute") : t("phone.call.mute")}
                pressed={controls.muted}
                disabled={disabled}
                compact={compact}
                onClick={onToggleMute}
                icon={
                  controls.muted ? (
                    <VolumeX className={iconClass} aria-hidden="true" />
                  ) : (
                    <Volume2 className={iconClass} aria-hidden="true" />
                  )
                }
              />
              <RoundButton
                testId="call-screen-speaker"
                label={t("phone.call.speaker")}
                pressed={controls.speakerOn}
                disabled={disabled}
                compact={compact}
                onClick={onToggleSpeaker}
                icon={<Speaker className={iconClass} aria-hidden="true" />}
              />
              <RoundButton
                testId="call-screen-replay"
                label={t("phone.call.replay")}
                ariaLabel={t("phone.call.replayAria")}
                disabled={disabled || !controls.replayEnabled}
                compact={compact}
                onClick={onReplay}
                icon={<RotateCcw className={iconClass} aria-hidden="true" />}
              />
            </div>
          ) : null}

          <button
            ref={hangUpRef}
            type="button"
            className={`${CALL_BUTTON_CLASS} mx-auto`}
            onClick={onHangUp}
            disabled={disabled}
            data-testid="call-screen-hang-up"
          >
            <span className={`${CALL_DISC_CLASS} ${DECLINE_DISC_CLASS}`}>
              <PhoneOff className="h-7 w-7 shrink-0" aria-hidden="true" />
            </span>
            <span className="text-sm text-[#f7f5ff]">{t("phone.call.hangUp")}</span>
          </button>
        </>
      )}
    </section>
  );
};
