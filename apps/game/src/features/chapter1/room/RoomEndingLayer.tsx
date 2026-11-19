/**
 * RoomEndingLayer: the decision panel, the ending transition and the debrief of the room chapter.
 * See .kiro/specs/chapter-01-double-deception/design.md (decisions, endings, debrief, aftermath)
 * and Requirements 10.1, 10.10, 16.1, 16.2, 16.3, 16.5.
 *
 * It is mounted by `RoomChapterLayer` and works only through the Chapter_Store and the overlay
 * helpers of the layer:
 * - The decision panel opens once when Act V offers decisions and the room is free (no call, no
 *   overlay). Closing it does not reopen it by itself; the journal "Decide" button asks again.
 *   Choices stay outside the phone.
 * - When an Outcome exists the ending transition shows the aftermath (phone and laptop text,
 *   evidence summary, consequence) and plays the aftermath narration. Continue dispatches
 *   `FINISH_CHAPTER` and opens the debrief.
 * - Replay clears the saved progress, replaces the state with a fresh one and starts the chapter
 *   again, without reloading the page.
 * Narration and text are presentation only; nothing here decides an outcome.
 */
import React, { useCallback, useEffect, useMemo, useRef } from "react";
import type { GameSettings } from "@scammaze/shared-types";
import { AFTERMATH_SEQUENCES } from "../../../game/narrative/chapter1/dialogues/aftermath";
import { buildDebrief } from "../../../game/narrative/debrief";
import { ACTIVE_SCENARIO } from "../../../game/narrative/activeScenario";
import { createInitialState } from "../../../game/narrative/reducer";
import { selectDecisionPanel } from "../../../game/narrative/selectors";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, ScenarioDefinition } from "../../../game/narrative/types";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { DebriefScreen } from "../debrief/DebriefScreen";
import { DecisionPanel } from "../decision/DecisionPanel";
import { EndingTransition } from "../ending/EndingTransition";
import { isOpen, type Overlay, type OverlayKind, type OverlayStack } from "../overlays";
import { useChapterState } from "../useChapterState";
import type { VoicePlaybackDeps } from "../voice/useVoicePlayback";
import { useNarrationPlayback, type NarrationSequence } from "./useNarrationPlayback";

export interface RoomEndingLayerProps {
  store: ChapterStore;
  /** Display scenario for the current language. */
  scenario: ScenarioDefinition;
  settings: GameSettings;
  overlays: OverlayStack;
  openOverlay: (overlay: Overlay, options?: { stack?: boolean }) => boolean;
  removeOverlay: (kind: OverlayKind) => void;
  /** True while the room is free: no intro, no overlay, no inspect pose, no call. */
  free: boolean;
  /** Changes each time the player asks to decide (journal "Decide"). */
  decideRequest: number;
  /** Voice player dependencies for the aftermath narration (a non-owning port). */
  narrationDeps?: VoicePlaybackDeps;
  /** Where Replay clears the saved progress. */
  saveSource: SaveGameSource;
  onReturnToMenu?: () => void;
}

const NO_OP = (): void => undefined;

function callBusy(state: ChapterState): boolean {
  return state.call.status === "ringing" || state.call.current !== null;
}

export const RoomEndingLayer: React.FC<RoomEndingLayerProps> = ({
  store,
  scenario,
  settings,
  overlays,
  openOverlay,
  removeOverlay,
  free,
  decideRequest,
  narrationDeps,
  saveSource,
  onReturnToMenu,
}) => {
  const panelSelector = useCallback((state: ChapterState) => selectDecisionPanel(state, scenario), [scenario]);
  const panel = useChapterState(store, panelSelector);
  const outcome = useChapterState(store, (state) => state.outcome);
  const status = useChapterState(store, (state) => state.status);
  const busy = useChapterState(store, callBusy);

  // --- Decision panel: open once per offering, again after a pre-step call or a "Decide" request ---
  const autoOpenedRef = useRef(false);
  const reopenRef = useRef(false);
  const lastRequestRef = useRef(decideRequest);

  useEffect(() => {
    if (!panel.offered) {
      autoOpenedRef.current = false;
      reopenRef.current = false;
    }
  }, [panel.offered]);

  useEffect(() => {
    if (decideRequest === lastRequestRef.current) return;
    lastRequestRef.current = decideRequest;
    if (!panel.offered) return;
    removeOverlay("journal");
    openOverlay({ kind: "decision" });
  }, [decideRequest, openOverlay, panel.offered, removeOverlay]);

  useEffect(() => {
    if (!panel.offered || !free) return;
    if (autoOpenedRef.current && !reopenRef.current) return;
    if (openOverlay({ kind: "decision" })) {
      autoOpenedRef.current = true;
      reopenRef.current = false;
    }
  }, [free, openOverlay, panel.offered]);

  // --- Ending and debrief overlays follow the Outcome and the status ------------------------------
  useEffect(() => {
    if (outcome === null) return;
    removeOverlay("decision");
    if (status === "ended") {
      if (!isOpen(overlays, "ending")) openOverlay({ kind: "ending" }, { stack: true });
    } else if (status === "finished") {
      removeOverlay("ending");
      if (!isOpen(overlays, "debrief")) openOverlay({ kind: "debrief" }, { stack: true });
    }
  }, [openOverlay, outcome, overlays, removeOverlay, status]);

  const endingOpen = isOpen(overlays, "ending");
  const debriefOpen = isOpen(overlays, "debrief");

  // --- Data for the ending and the debrief --------------------------------------------------------
  const chapterState = useChapterState(store);
  const debrief = useMemo(
    () => (outcome === null ? null : buildDebrief(chapterState, scenario)),
    [chapterState, outcome, scenario],
  );
  const ending = outcome !== null && Object.hasOwn(scenario.endings, outcome) ? scenario.endings[outcome] : null;
  const secretVariant = debrief?.outcome.consequence?.id === "case-report";

  const sequence = useMemo<NarrationSequence | null>(() => {
    if (!endingOpen || ending === null) return null;
    const nodeIds = secretVariant ? AFTERMATH_SEQUENCES["c-secret"] : ending.aftermath.narrationNodeIds;
    return { graphId: "dlg.aftermath", nodeIds };
  }, [ending, endingOpen, secretVariant]);

  const narration = useNarrationPlayback({
    scenario,
    sequence,
    active: endingOpen && !busy,
    settings: {
      soundEnabled: settings.soundEnabled,
      sfxVolume: settings.sfxVolume,
      voiceVolume: settings.voiceVolume,
      phoneVoiceFilter: false,
      englishVoiceFallback: settings.englishVoiceFallback,
      reducedStress: settings.reducedStress,
      subtitlesEnabled: settings.subtitlesEnabled,
    },
    deps: narrationDeps,
  });

  // --- Handlers -----------------------------------------------------------------------------------
  const closeDecision = useCallback(() => removeOverlay("decision"), [removeOverlay]);

  const handleContinue = useCallback(() => {
    const result = store.dispatch({ type: "FINISH_CHAPTER" });
    if (!result.accepted) return;
    removeOverlay("ending");
    openOverlay({ kind: "debrief" }, { stack: true });
  }, [openOverlay, removeOverlay, store]);

  const handleReplay = useCallback(() => {
    saveSource.clear?.();
    removeOverlay("debrief");
    removeOverlay("ending");
    removeOverlay("decision");
    autoOpenedRef.current = false;
    reopenRef.current = false;
    store.replace(createInitialState(ACTIVE_SCENARIO));
    store.dispatch({ type: "START_CHAPTER" });
  }, [removeOverlay, saveSource, store]);

  if (decisionOverlayOpen(overlays)) {
    return (
      <DecisionPanel
        panel={panel}
        onStartPreStep={(preStep) => {
          const result = store.dispatch({ type: "VERIFY_CLAIM", claimId: preStep.claimId, method: preStep.method });
          if (!result.accepted) return;
          // The call UI takes over; the panel comes back when the call ends.
          reopenRef.current = true;
          closeDecision();
        }}
        onDecide={(decisionId) => {
          // The outcome effect above replaces the panel with the ending transition.
          store.dispatch({ type: "MAKE_DECISION", decision: decisionId });
        }}
        onClose={closeDecision}
      />
    );
  }

  if (endingOpen && debrief !== null && ending !== null) {
    return (
      <EndingTransition
        outcome={debrief.outcome}
        aftermath={{
          consequence: ending.aftermath.consequence,
          phone: ending.aftermath.phone,
          laptop: ending.aftermath.laptop,
          evidenceSummary: ending.aftermath.evidenceSummary,
        }}
        narration={{
          speakerName: narration.line?.speakerName ?? null,
          text: narration.line?.text ?? null,
          visible: narration.subtitleVisible,
          finished: narration.finished,
          onAdvance: narration.advance,
        }}
        onContinue={handleContinue}
      />
    );
  }

  if (debriefOpen && debrief !== null) {
    return (
      <DebriefScreen
        view={debrief}
        caseReport={ending?.aftermath.caseReport}
        onReplay={handleReplay}
        onReturnToMenu={onReturnToMenu ?? NO_OP}
      />
    );
  }

  return null;
};

function decisionOverlayOpen(overlays: OverlayStack): boolean {
  return isOpen(overlays, "decision");
}
