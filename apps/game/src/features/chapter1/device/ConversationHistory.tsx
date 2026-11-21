// The history of a conversation on a contact (the Training Office, the bank): every line said so
// far, in order, as subtitles. Each line has an optional Listen button that reads it with the
// browser's computer voice. The text is always shown, so the conversation never depends on audio.
import React, { useEffect, useState } from "react";
import { Square, Volume2 } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { ConversationLineView } from "../../../game/narrative/device";
import { useGameLocale } from "../../../i18n/useGameLocale";
import { UI } from "../theme";
import { canSpeakSynthetic, speakSynthetic, stopSynthetic } from "./speakSynthetic";
import { formatWhen, type Tx } from "./deviceFormat";

export interface ConversationHistoryProps {
  lines: readonly ConversationLineView[];
  /** Name of the other side, shown before their lines. */
  otherName: string;
}

export const ConversationHistory: React.FC<ConversationHistoryProps> = ({ lines, otherName }) => {
  const { t: translate } = useTranslation("chapter1");
  const t = translate as unknown as Tx;
  const locale = useGameLocale();
  const [playing, setPlaying] = useState<string | null>(null);
  const [noVoice, setNoVoice] = useState(false);
  const speechAvailable = canSpeakSynthetic();

  useEffect(() => () => stopSynthetic(), []);

  const toggle = (line: ConversationLineView) => {
    if (playing === line.key) {
      stopSynthetic();
      setPlaying(null);
      return;
    }
    setNoVoice(false);
    const started = speakSynthetic(line.text, locale, () => setPlaying((current) => (current === line.key ? null : current)));
    if (started) setPlaying(line.key);
    else setNoVoice(true);
  };

  return (
    <section aria-labelledby="conversation-heading" data-testid="conversation-history" className={UI.card}>
      <h4 id="conversation-heading" className={UI.label}>
        {t("device.conversation.heading")}
      </h4>
      <ol className="mt-2 space-y-2">
        {lines.map((line) => (
          <li key={line.key} className="space-y-1" data-testid={`conversation-line-${line.key}`} data-speaker={line.speaker}>
            <p className="text-xs text-[#a9a4c4]">
              {line.speaker === "alex" ? t("device.conversation.you") : otherName} · {formatWhen(t, line.atMinute)}
            </p>
            <p className={`${UI.body} text-[#f7f5ff]`}>{line.text}</p>
            {speechAvailable && (
              <button type="button" className={UI.buttonSecondary} aria-pressed={playing === line.key} onClick={() => toggle(line)}>
                {playing === line.key ? <Square className="h-4 w-4" aria-hidden="true" /> : <Volume2 className="h-4 w-4" aria-hidden="true" />}
                <span>{playing === line.key ? t("device.conversation.stop") : t("device.conversation.listen")}</span>
              </button>
            )}
          </li>
        ))}
      </ol>
      {speechAvailable && <p className="mt-2 text-xs text-[#a9a4c4]">{t("device.conversation.synthetic")}</p>}
      {noVoice && (
        <p className="mt-1 text-xs text-[#a9a4c4]" role="status">
          {t("device.conversation.noVoice")}
        </p>
      )}
    </section>
  );
};
