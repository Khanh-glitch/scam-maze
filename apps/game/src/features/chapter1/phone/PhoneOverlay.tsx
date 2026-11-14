// Phone overlay: the responsive phone frame and the app router (Requirements 5.5, 13.6).
// Below 640 CSS pixels the frame fills the viewport width; at 640 px and wider it is a phone
// frame at most 380 px wide (Tailwind `sm` breakpoint = 640 px).
// The overlay holds no game state: it renders selector views and reports intent through callbacks.
// Escape is handled by the page through the overlay stack. Calls are shown on the 3D phone in
// the world, not in this overlay.

import React, { useEffect, useRef, useState, type ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Scale, X } from "lucide-react";
import type { ClaimId, DeviceActionId, EvidenceId } from "../../../game/narrative/chapter1/ids";
import type { PhoneMessageView, PhoneRecordsView } from "../../../game/narrative/selectors";
import { UI } from "../theme";
import { CallHistoryApp } from "./CallHistoryApp";
import { MessagesApp } from "./MessagesApp";
import { PhoneHome, type PhoneAppId } from "./PhoneHome";
import { VoicemailApp } from "./VoicemailApp";

export type PhoneRoute = "home" | PhoneAppId;

export interface PhoneOverlayProps {
  /** From `selectPhoneRecords(state, scenario)`. */
  records: PhoneRecordsView;
  /** From `selectPhoneMessages(state, scenario)`. The voicemail and call summary show in Voicemail. */
  messages: readonly PhoneMessageView[];
  /** Dispatch INSPECT_EVIDENCE for this evidence item. */
  onInspectEvidence: (evidenceId: EvidenceId) => void;
  /** Dispatch DEVICE_ACTION for this phone action. */
  onDeviceAction: (id: DeviceActionId) => void;
  /** Dispatch VERIFY_CLAIM with method `saved-official-contact` for this claim. */
  onCallSavedContact: (claimId: ClaimId) => void;
  /** Dispatch CLOSE_PHONE (and pop the overlay). */
  onClose: () => void;
  /** App shown when the phone opens. Defaults to the home screen. */
  initialRoute?: PhoneRoute;
  /**
   * Opens the decision panel. Pass it only while `selectDecisionPanel(state).offered` is true;
   * the home screen then shows a "Decide" button.
   */
  onDecide?: () => void;
}

export const PhoneOverlay: React.FC<PhoneOverlayProps> = ({
  records,
  messages,
  onInspectEvidence,
  onDeviceAction,
  onCallSavedContact,
  onClose,
  initialRoute = "home",
  onDecide,
}) => {
  const { t } = useTranslation("chapter1");
  const [route, setRoute] = useState<PhoneRoute>(initialRoute);
  const headingRef = useRef<HTMLHeadingElement>(null);

  // Move focus into the phone when it opens and when the screen changes, for keyboard users.
  useEffect(() => {
    headingRef.current?.focus();
  }, [route]);

  const recordIds = new Set<string>(
    [records.voicemail, ...records.summaries].flatMap((message) => (message === null ? [] : [message.id])),
  );
  const otherMessages = messages.filter((message) => !recordIds.has(message.id));
  const unreadCount = otherMessages.filter((message) => message.unread).length;
  const goHome = () => setRoute("home");
  const title = route === "voicemail" ? t("room.records.tabs.voicemail") : t(`phone.routes.${route}`);

  let content: ReactNode;
  if (route === "messages") {
    content = <MessagesApp messages={otherMessages} onInspectEvidence={onInspectEvidence} onBack={goHome} />;
  } else if (route === "calls") {
    content = (
      <CallHistoryApp
        calls={records.calls}
        deviceActions={records.deviceActions}
        savedContact={records.savedContact}
        onDeviceAction={onDeviceAction}
        onCallSavedContact={onCallSavedContact}
        onBack={goHome}
      />
    );
  } else if (route === "voicemail") {
    content = (
      <VoicemailApp
        voicemail={records.voicemail}
        summaries={records.summaries}
        deviceActions={records.deviceActions}
        onDeviceAction={onDeviceAction}
        onBack={goHome}
      />
    );
  } else {
    const home = <PhoneHome unreadCount={unreadCount} onOpenApp={setRoute} />;
    content = onDecide ? (
      <div className="space-y-4">
        {home}
        <div className="space-y-2 border-t border-[#38344f] pt-4">
          <p className={UI.body}>{t("phone.overlay.decidePrompt")}</p>
          <button type="button" onClick={onDecide} className={`${UI.buttonPrimary} w-full`}>
            <Scale className="h-4 w-4" aria-hidden="true" />
            {t("phone.overlay.decide")}
          </button>
        </div>
      </div>
    ) : (
      home
    );
  }

  return (
    <div className="fixed inset-0 z-40 flex items-center justify-center bg-[#171521]/70 sm:p-4">
      <div
        role="dialog"
        aria-modal="true"
        aria-label={t("phone.overlay.name")}
        className="flex h-full max-h-full w-full flex-col overflow-hidden bg-[#1d1b2b] text-[#f7f5ff] shadow-xl sm:h-[min(720px,100%)] sm:max-w-[380px] sm:rounded-[2rem] sm:border-4 sm:border-[#38344f]"
        data-phone-frame
      >
        <div className="flex items-center justify-between gap-2 border-b border-[#38344f] bg-[#171521] px-4 py-3">
          <h2 ref={headingRef} tabIndex={-1} className={UI.heading}>
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label={t("phone.overlay.close")}
            className="flex items-center gap-1.5 rounded-lg px-2 py-1 text-sm font-medium text-[#a9a4c4] motion-safe:transition-colors hover:text-[#f7f5ff] focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-[#b9a5f5] cursor-pointer"
          >
            <X className="h-4 w-4" aria-hidden="true" />
            <span aria-hidden="true">{t("phone.overlay.closeLabel")}</span>
          </button>
        </div>
        <div className="flex-1 overflow-y-auto p-4">{content}</div>
      </div>
    </div>
  );
};
