// Call history app (Requirements 5.5, 13.6).
// Lists calls with the caller name, the fictional number as plain text and the status. Each call
// that has a details action offers "Open the call details"; opening it dispatches the device
// action once (E01 for the first call, E11 for the third). The saved contact can be called only
// when the core offers it (an Independent_Channel contact is known).

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, FileText, PhoneOutgoing } from "lucide-react";
import type { CallId, ClaimId, DeviceActionId } from "../../../game/narrative/chapter1/ids";
import type { CallLogEntryView, DeviceActionView, SavedContactView } from "../../../game/narrative/selectors";
import { UI } from "../theme";

/** The device action that opens the details of each call. Calls not listed have no details. */
const CALL_DETAILS_ACTION: Readonly<Partial<Record<CallId, DeviceActionId>>> = {
  "call.alex": "dev.open-call-details",
  "call.recovery": "dev.open-recovery-details",
};

export interface CallHistoryAppProps {
  calls: readonly CallLogEntryView[];
  deviceActions: readonly DeviceActionView[];
  savedContact: SavedContactView | null;
  onDeviceAction: (id: DeviceActionId) => void;
  /** Dispatch VERIFY_CLAIM with method `saved-official-contact` for this claim. */
  onCallSavedContact: (claimId: ClaimId) => void;
  /** Return to the phone home screen. */
  onBack: () => void;
  /** False when the parent draws the Back button. Default true. */
  showBack?: boolean;
}

export const CallHistoryApp: React.FC<CallHistoryAppProps> = ({
  calls,
  deviceActions,
  savedContact,
  onDeviceAction,
  onCallSavedContact,
  onBack,
  showBack = true,
}) => {
  const { t } = useTranslation("chapter1");
  // Newest first, like a real phone. The selector returns oldest first.
  const entries = [...calls].reverse();
  const actionView = (id: DeviceActionId | undefined) =>
    id === undefined ? undefined : deviceActions.find((view) => view.id === id);

  return (
    <div className="space-y-3">
      {showBack && (
        <button type="button" className={UI.buttonSecondary} onClick={onBack}>
          <ArrowLeft className="h-4 w-4" aria-hidden="true" />
          {t("phone.calls.back")}
        </button>
      )}
      <h3 className={UI.label}>{t("phone.calls.heading")}</h3>
      {entries.length === 0 ? (
        <p className={UI.body}>{t("phone.calls.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {entries.map((entry) => {
            const actionId = CALL_DETAILS_ACTION[entry.callId];
            const view = actionView(actionId);
            return (
              <li key={entry.callId} className={`${UI.card} space-y-2`}>
                <div className="space-y-0.5">
                  <p className="text-sm font-bold text-[#f7f5ff]">{entry.displayName}</p>
                  {/* Plain text only: phone numbers are never links. */}
                  <p className="text-sm text-[#f7f5ff]">{entry.number}</p>
                  <p className={`text-xs ${entry.status === "missed" || entry.status === "declined" ? UI.textWarning : UI.textMuted}`}>
                    {entry.direction === "outgoing" ? t("phone.calls.outgoing") : t("phone.calls.incoming")}
                    {" · "}
                    {t(`phone.calls.status.${entry.status}`)}
                  </p>
                </div>
                {view !== undefined && view.done && (
                  <section className="space-y-1 border-t border-[#38344f] pt-2" aria-label={t("room.records.calls.detailsHeading")}>
                    <h4 className={UI.label}>{t("room.records.calls.detailsHeading")}</h4>
                    <p className="text-sm text-[#f7f5ff]">
                      <span className="text-[#a9a4c4]">{t("room.records.calls.callerIdLabel")}: </span>
                      {entry.number}
                    </p>
                    <p className={`flex items-center gap-1.5 text-xs font-semibold ${UI.textPositive}`}>
                      <Check className="h-3.5 w-3.5" aria-hidden="true" />
                      {t("phone.calls.recorded")}
                    </p>
                  </section>
                )}
                {view !== undefined && !view.done && view.available && actionId !== undefined && (
                  <button type="button" className={UI.buttonSecondary} onClick={() => onDeviceAction(actionId)}>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {t("room.records.calls.detailsOpen")}
                  </button>
                )}
              </li>
            );
          })}
        </ul>
      )}
      {savedContact !== null && (savedContact.available || savedContact.called) && (
        <section className={`${UI.card} space-y-2`} aria-labelledby="phone-saved-contact">
          <h4 id="phone-saved-contact" className="text-sm font-bold text-[#f7f5ff]">
            {savedContact.name}
          </h4>
          {/* Plain text only: the number is never a link. */}
          <p className="text-sm text-[#f7f5ff]">{savedContact.number}</p>
          {savedContact.called ? (
            <p className={UI.body}>{t("room.records.callSaved.called")}</p>
          ) : (
            <>
              <p className={UI.body}>{t("room.records.callSaved.hint")}</p>
              <button
                type="button"
                className={`${UI.buttonPrimary} w-full`}
                onClick={() => onCallSavedContact(savedContact.claimId)}
              >
                <PhoneOutgoing className="h-4 w-4" aria-hidden="true" />
                {t("room.records.callSaved.label")}
              </button>
            </>
          )}
        </section>
      )}
    </div>
  );
};
