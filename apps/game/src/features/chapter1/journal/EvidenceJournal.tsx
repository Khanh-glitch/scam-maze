// Evidence journal: discovered evidence in discovery order, the claim list with status text and a
// "Decide" button while the decision panel is offered.
// See .kiro/specs/chapter-01-the-urgent-call/design.md, "Rendering layer", and Requirements
// 11.7-11.9, 13.1 and 17.6. Props only: the page passes selector output and callbacks.
// Escape is handled by the page through the overlay stack; this panel only offers Close.
// Chrome comes from `chapter1:journal.*`. Stance, claim status and source are rendered by their
// codes, not by the core's English `stanceText` / `statusText`; narrative text (titles, notes,
// claims) comes from the scenario the page passes to the selectors.

import React, { useEffect, useRef, useState } from "react";
import { Lightbulb, Link2, Scale, NotebookText, X } from "lucide-react";
import { useTranslation } from "react-i18next";
import { REASONS } from "../../../game/narrative/reducer";
import type { ClaimStatusView, CombinationOptionsView, JournalEntry } from "../../../game/narrative/selectors";
import type { ClaimStatus, EvidenceItem, Stance } from "../../../game/narrative/types";
import type { EvidenceId } from "../../../game/narrative/chapter1/ids";
import enStory from "../../../i18n/locales/en/chapter1/story";
import { UI } from "../theme";

export interface EvidenceJournalProps {
  /** From `selectJournalEntries(state)`: discovered evidence in discovery order. */
  entries: readonly JournalEntry[];
  /** From `selectClaimStatuses(state)`: every Claim with its status text. */
  claims: readonly ClaimStatusView[];
  /** From `selectDecisionPanel(state).offered`. */
  decisionOffered: boolean;
  onDecide: () => void;
  onClose: () => void;
  /** From `selectCombinationOptions(state)`. Omit to hide the Combine control. */
  combination?: CombinationOptionsView;
  /** Dispatches COMBINE_EVIDENCE and returns the action result (`accepted`, `reason`). */
  onCombine?: (evidenceIds: EvidenceId[]) => { accepted: boolean; reason?: string };
  /** Statements of recorded deductions per evidence ID (`relatedDeductionStatements`). */
  relatedDeductions?: Readonly<Record<string, readonly string[]>>;
  /** The current objective's `hint`, or `null`. Shown only after the player turns hints on. */
  hint?: string | null;
}

type CombineResult = "accepted" | "rejected" | "alreadyRecorded" | "notAvailable";

/** Maps the core rejection reason to a neutral message key. It never says what would match. */
function combineResultFor(result: { accepted: boolean; reason?: string }): CombineResult {
  if (result.accepted) return "accepted";
  if (result.reason === REASONS.deductionAlreadyRecorded) return "alreadyRecorded";
  if (result.reason === REASONS.evidenceNotAvailable) return "notAvailable";
  return "rejected";
}

const MAX_SELECTION = 3;
const MIN_SELECTION = 2;

/**
 * English source text of the journal chrome (`chapter1:journal.*`). The panel renders through
 * `t`; this export stays for tests and callers that compare against the English text.
 */
export const EVIDENCE_JOURNAL_TEXT = enStory.journal;

/** English source text for each Evidence_Item source (`chapter1:journal.source.*`). */
export const EVIDENCE_SOURCE_TEXT: Record<EvidenceItem["source"], string> = enStory.journal.source;

/** Text color per Stance. Always shown with the stance text, never alone. */
const STANCE_CLASS: Record<Stance, string> = {
  supports: UI.textMuted,
  contradicts: UI.textWarning,
  inconclusive: UI.textMuted,
  "needs-verification": UI.textWarning,
};

/** Text color per Claim status. Always shown with the status text, never alone. */
const CLAIM_STATUS_CLASS: Record<ClaimStatus, string> = {
  unverified: UI.textMuted,
  supported: UI.textMuted,
  contradicted: UI.textWarning,
  inconclusive: UI.textMuted,
};

export const EvidenceJournal: React.FC<EvidenceJournalProps> = ({
  entries,
  claims,
  decisionOffered,
  onDecide,
  onClose,
  combination,
  onCombine,
  relatedDeductions,
  hint = null,
}) => {
  const { t } = useTranslation("chapter1");
  const headingRef = useRef<HTMLHeadingElement>(null);
  const [selected, setSelected] = useState<EvidenceId[]>([]);
  const [result, setResult] = useState<CombineResult | null>(null);
  const [tooMany, setTooMany] = useState(false);
  const [hintOn, setHintOn] = useState(false);
  const sourceLabels = new Map<string, string>();
  for (const item of combination?.items ?? []) if (item.sourceLabel) sourceLabels.set(item.id, item.sourceLabel);
  // Only items that are still in the journal count as selected.
  const validSelected = selected.filter((id) => combination?.items.some((item) => item.id === id));

  const toggle = (id: EvidenceId) => {
    setResult(null);
    if (validSelected.includes(id)) {
      setTooMany(false);
      setSelected(validSelected.filter((other) => other !== id));
    } else if (validSelected.length >= MAX_SELECTION) {
      setTooMany(true);
    } else {
      setTooMany(false);
      setSelected([...validSelected, id]);
    }
  };

  const submit = () => {
    if (!onCombine || validSelected.length < MIN_SELECTION || validSelected.length > MAX_SELECTION) return;
    const outcome = combineResultFor(onCombine([...validSelected]));
    setResult(outcome);
    if (outcome === "accepted") setSelected([]);
  };

  useEffect(() => {
    headingRef.current?.focus();
  }, []);

  return (
    <div className={UI.backdrop}>
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="evidence-journal-heading"
        className={`${UI.panel} flex max-h-[calc(100dvh-2rem)] max-w-2xl flex-col gap-4`}
      >
        <h2
          id="evidence-journal-heading"
          ref={headingRef}
          tabIndex={-1}
          className={`${UI.heading} flex items-center gap-2`}
        >
          <NotebookText className="h-5 w-5 text-[#b9a5f5]" aria-hidden="true" />
          {t("journal.title")}
        </h2>

        <div className="min-h-0 flex-1 space-y-5 overflow-y-auto pr-1">
          <section aria-labelledby="evidence-journal-evidence-heading" className="space-y-2">
            <h3 id="evidence-journal-evidence-heading" className={UI.label}>
              {t("journal.evidenceHeading")}
            </h3>
            {entries.length === 0 ? (
              <p className={UI.body}>{t("journal.emptyState")}</p>
            ) : (
              <ol className="space-y-3">
                {entries.map((entry) => (
                  <li key={entry.id} className={`${UI.card} space-y-2`}>
                    <h4 className="text-sm font-bold text-[#f7f5ff]">{entry.title}</h4>
                    <p className={UI.body}>{entry.description}</p>
                    <dl className="grid grid-cols-[auto_1fr] gap-x-3 gap-y-1 text-xs">
                      <dt className="font-semibold text-[#b9a5f5]">{t("journal.sourceLabel")}</dt>
                      <dd className="text-[#f7f5ff]">
                        {t(`journal.source.${entry.source}`)}
                        {sourceLabels.has(entry.id) ? `: ${sourceLabels.get(entry.id)}` : ""}
                      </dd>
                      <dt className="font-semibold text-[#b9a5f5]">{t("journal.locationLabel")}</dt>
                      <dd className="text-[#f7f5ff]">{entry.location}</dd>
                    </dl>
                    {entry.stances.length > 0 && (
                      <ul className="space-y-1.5">
                        {entry.stances.map((stance) => (
                          <li key={stance.claimId} className="text-xs leading-relaxed">
                            <span className="text-[#a9a4c4]">{stance.claimText}</span>{" "}
                            <span className={`font-semibold ${STANCE_CLASS[stance.stance]}`}>
                              {t(`journal.stance.${stance.stance}`)}.
                            </span>{" "}
                            {stance.note && <span className="text-[#a9a4c4]">{stance.note}</span>}
                          </li>
                        ))}
                      </ul>
                    )}
                    {(relatedDeductions?.[entry.id]?.length ?? 0) > 0 && (
                      <div className="space-y-1 border-t border-[#38344f] pt-2">
                        <h5 className={UI.label}>{t("journalCombine.related.heading")}</h5>
                        <ul className="space-y-1">
                          {relatedDeductions?.[entry.id]?.map((statement) => (
                            <li key={statement} className="text-xs leading-relaxed text-[#f7f5ff]">
                              {statement}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                    {entry.notes.length > 0 && (
                      <div className="space-y-1 border-t border-[#38344f] pt-2">
                        <h5 className={UI.label}>{t("journal.notesHeading")}</h5>
                        <ul className="space-y-1">
                          {entry.notes.map((note) => (
                            <li key={note} className="text-xs leading-relaxed text-[#f7f5ff]">
                              {note}
                            </li>
                          ))}
                        </ul>
                      </div>
                    )}
                  </li>
                ))}
              </ol>
            )}
          </section>

          {combination && (
            <section aria-labelledby="evidence-journal-combine-heading" className="space-y-2">
              <h3 id="evidence-journal-combine-heading" className={`${UI.label} flex items-center gap-2`}>
                <Link2 className="h-4 w-4" aria-hidden="true" />
                {t("journalCombine.heading")}
              </h3>
              <p className={UI.body}>{t("journalCombine.intro")}</p>
              {combination.items.length > 0 && (
                <ul className="space-y-1.5" aria-label={t("journalCombine.selectPrompt")}>
                  {combination.items.map((item) => {
                    const on = validSelected.includes(item.id);
                    return (
                      <li key={item.id}>
                        <button
                          type="button"
                          aria-pressed={on}
                          onClick={() => toggle(item.id)}
                          className={`${on ? UI.buttonPrimary : UI.buttonSecondary} w-full justify-start text-left`}
                        >
                          {item.title}
                          {item.sourceLabel ? ` (${item.sourceLabel})` : ""}
                        </button>
                      </li>
                    );
                  })}
                </ul>
              )}
              <p className="text-xs text-[#a9a4c4]" role="status">
                {tooMany
                  ? t("journalCombine.tooMany")
                  : t("journalCombine.selectedCount", { count: validSelected.length, number: validSelected.length })}
                {!tooMany && validSelected.length < MIN_SELECTION ? ` ${t("journalCombine.needTwo")}` : ""}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={submit}
                  disabled={validSelected.length < MIN_SELECTION || !onCombine}
                  className={UI.buttonPrimary}
                >
                  {t("journalCombine.submit")}
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setSelected([]);
                    setTooMany(false);
                    setResult(null);
                  }}
                  disabled={validSelected.length === 0}
                  className={UI.buttonSecondary}
                >
                  {t("journalCombine.clear")}
                </button>
              </div>
              <p className={UI.body} role="status" data-testid="combine-result">
                {result ? t(`journalCombine.result.${result}`) : ""}
              </p>
              <h4 className={UI.label}>{t("journalCombine.deduction.heading")}</h4>
              {combination.recorded.length === 0 ? (
                <p className={UI.body}>{t("journalCombine.deduction.empty")}</p>
              ) : (
                <ul className="space-y-2">
                  {combination.recorded.map((deduction) => (
                    <li key={deduction.id} className={`${UI.card} space-y-1`}>
                      <p className="text-xs font-semibold text-[#b9a5f5]">{t("journalCombine.deduction.statementLabel")}</p>
                      <p className={UI.body}>{deduction.statement}</p>
                    </li>
                  ))}
                </ul>
              )}
            </section>
          )}

          {hint && (
            <section aria-labelledby="evidence-journal-hint-heading" className="space-y-2">
              <h3 id="evidence-journal-hint-heading" className={UI.label}>
                {t("journalCombine.hint.heading")}
              </h3>
              <button
                type="button"
                aria-pressed={hintOn}
                onClick={() => setHintOn((on) => !on)}
                className={UI.buttonSecondary}
              >
                <Lightbulb className="h-4 w-4" aria-hidden="true" />
                {hintOn ? t("journalCombine.hint.hide") : t("journalCombine.hint.show")}
              </button>
              {hintOn && <p className={UI.body}>{hint}</p>}
            </section>
          )}

          <section aria-labelledby="evidence-journal-claims-heading" className="space-y-2">            <h3 id="evidence-journal-claims-heading" className={UI.label}>
              {t("journal.claimsHeading")}
            </h3>
            <ul className="space-y-2">
              {claims.map((claim) => (
                <li key={claim.id} className={`${UI.card} space-y-1`}>
                  <h4 className="text-sm font-semibold text-[#f7f5ff]">{claim.text}</h4>
                  <p className="text-xs">
                    <span className="font-semibold text-[#b9a5f5]">{t("journal.statusLabel")}: </span>
                    <span className={`font-semibold ${CLAIM_STATUS_CLASS[claim.status]}`}>{t(`journal.claimStatus.${claim.status}`)}</span>
                  </p>
                  {claim.evidence.length === 0 ? (
                    <p className="text-xs text-[#a9a4c4]">{t("journal.noClaimEvidence")}</p>
                  ) : (
                    <ul className="space-y-0.5">
                      {claim.evidence.map((item) => (
                        <li key={item.evidenceId} className="text-xs text-[#a9a4c4]">
                          {item.title}:{" "}
                          <span className={`font-semibold ${STANCE_CLASS[item.stance]}`}>{t(`journal.stance.${item.stance}`)}</span>
                        </li>
                      ))}
                    </ul>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </div>

        <div className="flex flex-wrap items-center justify-end gap-3">
          {decisionOffered && (
            <>
              <p className={`${UI.body} mr-auto`}>{t("journal.decidePrompt")}</p>
              <button type="button" onClick={onDecide} className={UI.buttonPrimary}>
                <Scale className="h-4 w-4" aria-hidden="true" />
                {t("journal.decide")}
              </button>
            </>
          )}
          <button type="button" onClick={onClose} className={UI.buttonSecondary}>
            <X className="h-4 w-4" aria-hidden="true" />
            {t("journal.close")}
          </button>
        </div>
      </div>
    </div>
  );
};
