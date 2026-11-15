// Voicemail and call summary app (Requirements 5.5, 13.6).
// Alex's record is the voicemail text or the call summary. Opening it dispatches
// `dev.open-alex-record` once (E07). The text is plain text; numbers and domains are never links.

import React from "react";
import { useTranslation } from "react-i18next";
import { ArrowLeft, Check, FileText } from "lucide-react";
import type { DeviceActionId } from "../../../game/narrative/chapter1/ids";
import type { DeviceActionView, PhoneMessageView } from "../../../game/narrative/selectors";
import { UI } from "../theme";

const ALEX_RECORD_ACTION: DeviceActionId = "dev.open-alex-record";

export interface VoicemailAppProps {
  voicemail: PhoneMessageView | null;
  summaries: readonly PhoneMessageView[];
  deviceActions: readonly DeviceActionView[];
  onDeviceAction: (id: DeviceActionId) => void;
  /** Return to the phone home screen. */
  onBack: () => void;
}

export const VoicemailApp: React.FC<VoicemailAppProps> = ({
  voicemail,
  summaries,
  deviceActions,
  onDeviceAction,
  onBack,
}) => {
  const { t } = useTranslation("chapter1");
  const records: Array<{ message: PhoneMessageView; label: string }> = [];
  if (voicemail !== null) records.push({ message: voicemail, label: t("room.records.voicemail.summary") });
  for (const summary of summaries) records.push({ message: summary, label: t("room.records.calls.summaryLabel") });

  const view = deviceActions.find((item) => item.id === ALEX_RECORD_ACTION);
  // Without a record action in the scenario the text is simply shown.
  const showText = view === undefined || view.done;

  return (
    <div className="space-y-3">
      <button type="button" className={UI.buttonSecondary} onClick={onBack}>
        <ArrowLeft className="h-4 w-4" aria-hidden="true" />
        {t("room.records.back")}
      </button>
      <h3 className={UI.label}>{t("room.records.voicemail.heading")}</h3>
      {records.length === 0 ? (
        <p className={UI.body}>{t("room.records.voicemail.empty")}</p>
      ) : (
        <ul className="space-y-2">
          {records.map(({ message, label }) => (
            <li key={message.id} className={`${UI.card} space-y-2`}>
              <p className={UI.label}>{label}</p>
              <p className="text-sm font-bold text-[#f7f5ff]">{message.from}</p>
              {showText ? (
                <p className="whitespace-pre-line break-words text-sm leading-relaxed text-[#f7f5ff]">{message.body}</p>
              ) : (
                view !== undefined &&
                view.available && (
                  <button type="button" className={UI.buttonSecondary} onClick={() => onDeviceAction(ALEX_RECORD_ACTION)}>
                    <FileText className="h-4 w-4" aria-hidden="true" />
                    {t("room.records.voicemail.recordOpen")}
                  </button>
                )
              )}
              {view?.done === true && (
                <p className={`flex items-center gap-1.5 text-xs font-semibold ${UI.textPositive}`}>
                  <Check className="h-3.5 w-3.5" aria-hidden="true" />
                  {t("phone.calls.recorded")}
                </p>
              )}
            </li>
          ))}
        </ul>
      )}
    </div>
  );
};
