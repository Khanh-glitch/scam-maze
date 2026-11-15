/**
 * RoomChapterLayer (base): the overlay controller of the Room v2 chapter.
 * See .kiro/specs/chapter-01-double-deception/design.md, "RoomChapterLayer responsibilities", and
 * Requirements 1.2, 2.3, 2.4, 12.6, 15.5, 15.6, 17.6, 22.2.
 *
 * It is rendered as the `overlay` of `RoomV2Page`. It owns the Chapter_Store, the overlay stack,
 * the HUD and the checkpoint saver. It reads the engine only through the `RoomStoryBridge` (the
 * engine calls the bridge; the layer attaches handlers) and writes story state only with
 * `store.dispatch`. Presentation commands come from `roomPresentation` and are sent as diffs.
 *
 * Not here (extension points for later tasks): the call UI, voice and narration playback (task
 * 10.2) and the decision panel, ending and debrief (task 10.3). Hosts add them through
 * `renderExtension` (rendered inside the overlay layer, with the store, the scenario and the stack
 * helpers), `extensionBlocking` (true while an extension overlay is open), `onOpenDecision` and
 * `onIntroBegin`.
 *
 * Timers: there are no timers for story pacing. Calls ring when `selectRingableCall` returns a
 * call and the room is free. The only delay is `ringSettleMs`, a presentation beat of a few
 * hundred milliseconds between "the room became free" and "the phone rings", so the ring does not
 * land on the same frame in which the intro or an overlay closes. It is cancelled when the room
 * stops being free, and 0 disables it.
 */
import React, { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Lightbulb, NotebookText } from "lucide-react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { ClaimId, DeductionId, DeviceActionId, EvidenceId, InteractableId, ObjectiveId } from "../../../game/narrative/chapter1/ids";
import { createInitialState } from "../../../game/narrative/reducer";
import {
  selectActiveObjectives,
  selectClaimStatuses,
  selectCombinationOptions,
  selectDecisionPanel,
  selectJournalEntries,
  selectLaptopView,
  selectPhoneMessages,
  selectPhoneRecords,
  selectRingableCall,
} from "../../../game/narrative/selectors";
import { createChapterStore, type ChapterStore } from "../../../game/narrative/store";
import type { ChapterState, CoreAction, ScenarioDefinition } from "../../../game/narrative/types";
import { createLocalStorageSaveSource, type SaveGameSource, type SavedPlayerPose } from "../../../game/saves/saveGame";
import type { AudioPort } from "../../../game/voice/audioPort";
import { voiceGain } from "../../../game/voice/mixPlan";
import { createWebAudioEngine, type WebAudioEngine } from "../../../game/voice/webAudioEngine";
import { INTRO_SEQUENCE } from "../../../game/narrative/chapter1/dialogues/intro";
import { formatNumber } from "../../../i18n/format";
import { useDisplayScenario } from "../../../i18n/narrative";
import { useGameLocale } from "../../../i18n/useGameLocale";
import type { RoomPropId } from "../../roomv2/game/outside";
import { createPhoneScreenSink, type PhoneScreenSink } from "../call/phoneScreenSink";
import { ComfortProvider } from "../comfort/ComfortProvider";
import { focusDialogStart, topDialog, trapTabKey } from "../focusTrap";
import { EvidenceNotice } from "../hud/EvidenceNotice";
import { ObjectiveToast, type ObjectiveChangeKind } from "../hud/ObjectiveToast";
import { ObjectiveTracker } from "../hud/ObjectiveTracker";
import { SaveFailureNotice } from "../hud/SaveFailureNotice";
import { SaveTrimmedNotice } from "../hud/SaveTrimmedNotice";
import { ChapterIntroOverlay } from "../intro/ChapterIntroOverlay";
import type { NarrationLine } from "../intro/useIntroNarration";
import { EvidenceJournal } from "../journal/EvidenceJournal";
import { relatedDeductionStatements } from "../journal/relatedDeductions";
import { EMPTY_OVERLAYS, isOpen, pop, push, top, type Overlay, type OverlayKind, type OverlayStack } from "../overlays";
import { PhoneOverlay } from "../phone/PhoneOverlay";
import { UI } from "../theme";
import { useChapterState } from "../useChapterState";
import { useCheckpointSaver } from "../useCheckpointSaver";
import type { VoicePlaybackDeps } from "../voice/useVoicePlayback";
import { BankApp } from "./laptop/BankApp";
import { CompareView } from "./laptop/CompareView";
import { LaptopOverlay, type LaptopExtraTab } from "./laptop/LaptopOverlay";
import { ReviewSecurityPage } from "./laptop/ReviewSecurityPage";
import { buildBankAppView, buildCompareViewModel, buildReviewSecurityView } from "./laptop/laptopView";
import {
  applyPresentation,
  roomPresentation,
  type LaptopFrameKeys,
  type PresentationSink,
  type RoomPresentation,
} from "./roomPresentation";
import { RoomCallLayer } from "./RoomCallLayer";
import { RoomEndingLayer } from "./RoomEndingLayer";
import { RoomPhoneModelLayer, detectPhoneModelSupport } from "./RoomPhoneModelLayer";
import type { RoomStoryBridge } from "./roomStoryBridge";
import { useNarrationPlayback, type NarrationSequence } from "./useNarrationPlayback";

/** Presentation beat before the first ring after the room became free. Not story pacing. */
export const DEFAULT_RING_SETTLE_MS = 600;

/** Overlays that Escape never closes. */
const ESCAPE_LOCKED: ReadonlySet<OverlayKind> = new Set(["ending", "debrief", "call"]);

/** Room props that run an authored interaction with `INTERACT_OBJECT`. */
const PROP_TO_OBJECT: Partial<Record<RoomPropId, InteractableId>> = {
  note: "obj.note",
  receipts: "obj.receipts",
  calendar: "obj.calendar",
};

const INTRO_CONTROLS = ["move", "look", "interact", "journal"] as const;

export interface RoomLayerApi {
  store: ChapterStore;
  /** Display scenario for the current language. */
  scenario: ScenarioDefinition;
  overlays: OverlayStack;
  /** Pushes an overlay. Refused (false) while another overlay is open, unless `stack` is true. */
  openOverlay: (overlay: Overlay, options?: { stack?: boolean }) => boolean;
  removeOverlay: (kind: OverlayKind) => void;
  closeTop: () => void;
  /** Writes a checkpoint now (only while playing and no call is in progress). */
  saveNow: () => boolean;
  introOpen: boolean;
}

export interface RoomChapterLayerProps {
  session: ChapterSession;
  settings: GameSettings;
  /** The bridge that was passed to the engine as `RoomOptions.story`. */
  bridge: RoomStoryBridge;
  /** Where checkpoints are written. Defaults to this device's local storage. */
  saveSource?: SaveGameSource;
  /**
   * True once `bridge.commands` is set (the host's `onReady`). The intro waits for it, and the
   * presentation is sent in full when it turns true.
   */
  engineReady?: boolean;
  /** See the file comment. Default `DEFAULT_RING_SETTLE_MS`. */
  ringSettleMs?: number;
  /** Called once with the store (hosts and tests use it to read state). */
  onStoreReady?: (store: ChapterStore) => void;
  /** Called when the player begins, after `START_CHAPTER` (task 10.2 unlocks audio here). */
  onIntroBegin?: () => void;
  /** Called when the player asks to decide from the journal. The layer opens the decision panel itself. */
  onOpenDecision?: () => void;
  /** Called by "Return to menu" on the debrief. */
  onReturnToMenu?: () => void;
  /** True while an extension overlay (call, decision, ending, debrief) is open. Blocks rings. */
  extensionBlocking?: boolean;
  /** Rendered inside the overlay layer. */
  renderExtension?: (api: RoomLayerApi) => React.ReactNode;
  /**
   * Test seam for the voice player (call voice and narration). When set, no Web Audio engine is
   * created and the call sounds are off. Default: one shared Web Audio engine per mount.
   */
  voiceDeps?: VoicePlaybackDeps;
  /**
   * Task 10.4: the 3D phone model may show the call screen. Default: true only when WebGL 2
   * starts and the model did not fail earlier in this session; false uses the 2D screen. A model
   * load failure or a lost WebGL context switches it off for the call regardless of this prop.
   */
  modelAllowed?: boolean;
  /** Task 10.4: the sink the 3D phone layer publishes to. Default: a private sink. */
  phoneScreenSink?: PhoneScreenSink;
}

const INTRO_NARRATION: NarrationSequence = { graphId: "dlg.intro", nodeIds: INTRO_SEQUENCE };

/** A port view whose `dispose` does nothing, so a second player can share an engine it does not own. */
function nonOwningPort(port: AudioPort): AudioPort {
  return {
    get supported() {
      return port.supported;
    },
    resume: () => port.resume(),
    load: (url) => port.load(url),
    start: (clip, options) => port.start(clip, options),
    dispose: () => undefined,
  };
}

type Announcement =
  | { key: number; kind: "notification" }
  | { key: number; kind: "evidence"; evidenceId: EvidenceId }
  | { key: number; kind: "deduction"; deductionId: DeductionId };

interface ToastItem {
  key: number;
  kind: ObjectiveChangeKind;
  objectiveId: ObjectiveId;
}

interface NoticeItem {
  key: number;
  evidenceId: EvidenceId;
}

/** True while a call rings or is active and the chapter has no outcome yet. */
function callInProgress(state: ChapterState): boolean {
  if (state.outcome !== null) return false;
  return state.call.status === "ringing" || state.call.current !== null;
}

function isTypingTarget(target: EventTarget | null): boolean {
  return (
    target instanceof HTMLInputElement ||
    target instanceof HTMLTextAreaElement ||
    target instanceof HTMLSelectElement ||
    (target instanceof HTMLElement && target.isContentEditable)
  );
}

/**
 * Collects objective changes, new evidence, new deductions and the notification delivery since the
 * last seen state. Starts at the current state, so restored history is not announced again.
 */
function useHudNotices(store: ChapterStore) {
  const [toasts, setToasts] = useState<ToastItem[]>([]);
  const [notices, setNotices] = useState<NoticeItem[]>([]);
  const [announcements, setAnnouncements] = useState<Announcement[]>([]);
  const [completed, setCompleted] = useState<ObjectiveId | null>(null);

  useEffect(() => {
    const initial = store.getState();
    let seenEvents = initial.events.length;
    let seenEvidence = initial.discovered.length;
    let seenDeductions = initial.deductions.length;
    let delivered = initial.flags.notification_delivered === true;
    let nextKey = 0;

    return store.subscribe(() => {
      const state = store.getState();
      // `replace` (restart) can shorten the log: drop queued items and count again from there.
      if (state.events.length < seenEvents || state.discovered.length < seenEvidence) {
        seenEvents = Math.min(seenEvents, state.events.length);
        seenEvidence = Math.min(seenEvidence, state.discovered.length);
        seenDeductions = Math.min(seenDeductions, state.deductions.length);
        delivered = state.flags.notification_delivered === true;
        setToasts([]);
        setNotices([]);
        setAnnouncements([]);
        setCompleted(null);
      }

      const newToasts: ToastItem[] = [];
      for (const event of state.events.slice(seenEvents)) {
        for (const id of event.derived.objectivesCompleted) newToasts.push({ key: nextKey++, kind: "completed", objectiveId: id });
        for (const id of event.derived.objectivesActivated) newToasts.push({ key: nextKey++, kind: "activated", objectiveId: id });
      }
      seenEvents = state.events.length;

      const newEvidence = state.discovered.slice(seenEvidence);
      seenEvidence = state.discovered.length;
      const newDeductions = state.deductions.slice(seenDeductions);
      seenDeductions = state.deductions.length;
      const nowDelivered = state.flags.notification_delivered === true;
      const batch: Announcement[] = [];
      if (nowDelivered && !delivered) batch.push({ key: nextKey++, kind: "notification" });
      delivered = nowDelivered;
      for (const evidenceId of newEvidence) batch.push({ key: nextKey++, kind: "evidence", evidenceId });
      for (const deductionId of newDeductions) batch.push({ key: nextKey++, kind: "deduction", deductionId });

      if (newToasts.length > 0) {
        setToasts((queue) => [...queue, ...newToasts]);
        const lastCompleted = [...newToasts].reverse().find((toast) => toast.kind === "completed");
        if (lastCompleted) setCompleted(lastCompleted.objectiveId);
      }
      if (newEvidence.length > 0) setNotices((queue) => [...queue, ...newEvidence.map((evidenceId) => ({ key: nextKey++, evidenceId }))]);
      if (batch.length > 0) setAnnouncements(batch);
    });
  }, [store]);

  const dismissToast = useCallback(() => setToasts((queue) => queue.slice(1)), []);
  const dismissNotice = useCallback(() => setNotices((queue) => queue.slice(1)), []);
  return { toast: toasts[0] ?? null, notice: notices[0] ?? null, announcements, completed, dismissToast, dismissNotice };
}

/** What the engine asks for every frame or event. Rebuilt on state, overlay and language changes only. */
interface PortCache {
  labels: Record<string, string | null>;
  actions: Record<string, Array<{ key: string; label: string }> | null>;
  inspect: Record<string, string[] | null>;
  leave: Record<string, boolean>;
  doorLocked: boolean;
  overlayOpen: boolean;
}

const EMPTY_CACHE: PortCache = { labels: {}, actions: {}, inspect: {}, leave: {}, doorLocked: false, overlayOpen: false };

function lookup<T>(record: Record<string, T>, id: string, fallback: T): T {
  return Object.hasOwn(record, id) ? record[id] : fallback;
}

export const RoomChapterLayer: React.FC<RoomChapterLayerProps> = ({
  session,
  settings,
  bridge,
  saveSource: saveSourceProp,
  engineReady = true,
  ringSettleMs = DEFAULT_RING_SETTLE_MS,
  onStoreReady,
  onIntroBegin,
  onOpenDecision,
  onReturnToMenu,
  extensionBlocking = false,
  renderExtension,
  voiceDeps: voiceDepsProp,
  modelAllowed: modelAllowedProp,
  phoneScreenSink,
}) => {
  const { t } = useTranslation("chapter1");
  const locale = useGameLocale();
  const scenario = useDisplayScenario();
  const text = t as unknown as (key: string, options?: Record<string, unknown>) => string;

  const [defaultSaveSource] = useState(() => createLocalStorageSaveSource());
  const saveSource = saveSourceProp ?? defaultSaveSource;

  // Created once per mount: a fresh chapter or the state replayed by the loader.
  const [store] = useState(() => createChapterStore(session.restored?.state ?? createInitialState()));
  const onStoreReadyRef = useRef(onStoreReady);
  onStoreReadyRef.current = onStoreReady;
  useEffect(() => {
    onStoreReadyRef.current?.(store);
  }, [store]);

  const status = useChapterState(store, (state) => state.status);
  const discoveredCount = useChapterState(store, (state) => state.discovered.length);

  // --- Intro --------------------------------------------------------------------------------
  // A restored run that already ended has no intro (the ending and debrief belong to task 10.3).
  const [introOpen, setIntroOpen] = useState(() => {
    const state = store.getState();
    return state.status === "not-started" || state.status === "playing";
  });
  const [introMode] = useState<"begin" | "continue">(() => (store.getState().status === "not-started" ? "begin" : "continue"));
  const introOpenRef = useRef(introOpen);
  introOpenRef.current = introOpen;

  const introLines = useMemo<NarrationLine[] | undefined>(() => {
    if (!Object.hasOwn(scenario.dialogues, "dlg.intro")) return undefined;
    const graph = scenario.dialogues["dlg.intro"];
    const lines: NarrationLine[] = [];
    for (const nodeId of INTRO_SEQUENCE) {
      if (!Object.hasOwn(graph.nodes, nodeId)) continue;
      const lineId = graph.nodes[nodeId].lineId;
      if (Object.hasOwn(graph.lines, lineId)) lines.push({ text: graph.lines[lineId], src: null });
    }
    return lines;
  }, [scenario]);

  const handleBegin = useCallback(() => {
    if (store.getState().status === "not-started") {
      const result = store.dispatch({ type: "START_CHAPTER" });
      if (!result.accepted) return;
    }
    setIntroOpen(false);
    onIntroBegin?.();
  }, [onIntroBegin, store]);

  // --- Overlay stack ------------------------------------------------------------------------
  const [overlays, setOverlays] = useState<OverlayStack>(EMPTY_OVERLAYS);
  const overlaysRef = useRef<OverlayStack>(EMPTY_OVERLAYS);
  const openersRef = useRef(new Map<OverlayKind, HTMLElement>());
  const overlayLayerRef = useRef<HTMLDivElement>(null);
  const [inspecting, setInspecting] = useState<RoomPropId | null>(null);
  const inspectingRef = useRef<RoomPropId | null>(null);
  // A call that rings or is active blocks the room like any overlay (its UI is mounted below).
  const callOpen = useChapterState(store, (state) => state.call.status === "ringing" || state.call.status === "active");
  const blocking = extensionBlocking || callOpen;

  // --- 3D phone model (task 10.4): one sink shared by the model layer and the call screen.
  const [ownPhoneSink] = useState(createPhoneScreenSink);
  const callSink = phoneScreenSink ?? ownPhoneSink;
  const [detectedModelSupport] = useState(() => (modelAllowedProp === undefined ? detectPhoneModelSupport() : false));
  const [modelFailed, setModelFailed] = useState(false);
  const [contextLost, setContextLost] = useState(false);
  const modelAllowed = (modelAllowedProp ?? detectedModelSupport) && !modelFailed && !contextLost;
  const callRinging = useChapterState(store, (state) => state.call.status === "ringing");
  const handleModelError = useCallback(() => setModelFailed(true), []);
  // A lost context unmounts the canvas, so no restore event can arrive: try again on the next call.
  useEffect(() => {
    if (!callOpen) setContextLost(false);
  }, [callOpen]);
  const extensionBlockingRef = useRef(blocking);
  extensionBlockingRef.current = blocking;

  // --- Audio: one Web Audio engine per mount, shared by the call voice, the call sounds and the
  // narration. Created in an effect (so a development double mount gets a live engine) and
  // disposed on unmount. Tests pass `voiceDeps` instead; then there is no engine. Audio never
  // dispatches to the store.
  const engineRef = useRef<WebAudioEngine | null>(null);
  const [engine, setEngine] = useState<WebAudioEngine | null>(null);
  useEffect(() => {
    if (voiceDepsProp !== undefined) return undefined;
    const created = (engineRef.current ??= createWebAudioEngine());
    setEngine(created);
    return () => {
      created.dispose();
      if (engineRef.current === created) engineRef.current = null;
      setEngine((current) => (current === created ? null : current));
    };
  }, [voiceDepsProp]);
  const voiceDeps = useMemo<VoicePlaybackDeps>(
    () => voiceDepsProp ?? { createPort: () => (engineRef.current ??= createWebAudioEngine()) },
    [voiceDepsProp],
  );
  // The narration player shares the port but must not dispose it: the call player owns it.
  const narrationDeps = useMemo<VoicePlaybackDeps>(
    () => ({
      ...voiceDeps,
      createPort: () => nonOwningPort((voiceDeps.createPort ?? createWebAudioEngine)()),
    }),
    [voiceDeps],
  );

  // --- Intro narration through the voice player. The intro overlay owns the stepping (a click
  // reveals the line, the next click moves on) and reports the line index; a call stops it.
  const narration = useNarrationPlayback({
    scenario,
    sequence: INTRO_NARRATION,
    active: introOpen && introMode === "begin" && engineReady && !callOpen,
    paused: overlays.length > 0,
    autoAdvance: false,
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
  const goToIntroLine = narration.goTo;

  // --- Port cache (the bridge reads it on every hover frame) --------------------------------
  const cacheRef = useRef<PortCache>(EMPTY_CACHE);
  const latestRef = useRef({ text, scenario });
  latestRef.current = { text, scenario };

  const rebuildCache = useCallback(() => {
    const state = store.getState();
    const { text: tr, scenario: sc } = latestRef.current;
    const ringing = state.call.status === "ringing";
    const busy = callInProgress(state);
    const overlayOpen = introOpenRef.current || overlaysRef.current.length > 0 || extensionBlockingRef.current;
    const cache: PortCache = {
      labels: {
        door: state.status !== "finished" ? tr("room.prompt.doorLocked") : null,
        phone: busy && !ringing ? null : ringing ? tr("room.prompt.phoneRinging") : tr("room.prompt.phoneRecords"),
        laptop: tr("room.prompt.laptopUse"),
      },
      actions: {
        phone: ringing
          ? [
              { key: "F", label: tr("room.prompt.phoneRinging") },
              { key: "R", label: tr("room.prompt.phoneDecline") },
            ]
          : null,
      },
      inspect: {},
      leave: { phone: !busy && !overlayOpen, laptop: !overlayOpen },
      doorLocked: state.status !== "finished",
      overlayOpen,
    };
    for (const [prop, objectId] of Object.entries(PROP_TO_OBJECT)) {
      if (objectId && Object.hasOwn(sc.interactables, objectId)) cache.inspect[prop] = [sc.interactables[objectId].inspectionText];
    }
    cacheRef.current = cache;
  }, [store]);

  const updateOverlays = useCallback(
    (change: (stack: OverlayStack) => OverlayStack) => {
      const next = change(overlaysRef.current);
      if (next === overlaysRef.current) return;
      overlaysRef.current = next;
      setOverlays(next);
      rebuildCache();
    },
    [rebuildCache],
  );

  const openOverlay = useCallback(
    (overlay: Overlay, options?: { stack?: boolean }): boolean => {
      const stack = overlaysRef.current;
      if (introOpenRef.current) return false;
      if (stack.length > 0 && !options?.stack && !isOpen(stack, overlay.kind)) return false;
      const active = document.activeElement;
      if (active instanceof HTMLElement && active !== document.body) openersRef.current.set(overlay.kind, active);
      else openersRef.current.delete(overlay.kind);
      updateOverlays((current) => push(current, overlay));
      return true;
    },
    [updateOverlays],
  );

  /** Closing the laptop or the phone leaves the inspect pose too. */
  const leaveInspect = useCallback(
    (kind: OverlayKind) => {
      if (kind === "laptop" || kind === "phone") bridge.commands?.closeInspect();
    },
    [bridge],
  );

  const removeOverlay = useCallback(
    (kind: OverlayKind) => {
      if (!isOpen(overlaysRef.current, kind)) return;
      updateOverlays((stack) => Object.freeze(stack.filter((entry) => entry.kind !== kind)));
      leaveInspect(kind);
    },
    [leaveInspect, updateOverlays],
  );

  const closeTop = useCallback(() => {
    const current = top(overlaysRef.current);
    if (!current) return;
    updateOverlays((stack) => pop(stack));
    leaveInspect(current.kind);
  }, [leaveInspect, updateOverlays]);

  const canClose = useCallback((overlay: Overlay) => !ESCAPE_LOCKED.has(overlay.kind), []);

  // --- Checkpoints --------------------------------------------------------------------------
  // `useCheckpointSaver` writes when the active or completed objectives change and no call is in
  // progress. Each act starts with an objective change and the decision completes `obj.decide`, so
  // this covers "each act start and after each decision". A change during a call is written when
  // the call ends (the saver's own rule). The room has no player pose, so the pose getter is null.
  const [saveFailed, setSaveFailed] = useState(false);
  const poseGetterRef = useRef<(() => SavedPlayerPose) | null>(null);
  const handleWriteFailure = useCallback(() => setSaveFailed(true), []);
  const { saveNow } = useCheckpointSaver({
    store,
    saveSource,
    poseGetterRef,
    chapterId: session.chapterId,
    sceneId: session.sceneId,
    onWriteFailure: handleWriteFailure,
  });
  const [saveTrimmedOpen, setSaveTrimmedOpen] = useState(() => session.saveTrimmed === true);

  // --- Dispatch helpers ---------------------------------------------------------------------
  const dispatch = useCallback((action: CoreAction) => store.dispatch(action), [store]);
  const dispatchVoid = useCallback((action: CoreAction) => void store.dispatch(action), [store]);

  // --- Bridge handlers ----------------------------------------------------------------------
  useEffect(() => {
    rebuildCache();
    return store.subscribe(rebuildCache);
  }, [rebuildCache, store, scenario, text]);

  useEffect(() => {
    rebuildCache();
  }, [blocking, introOpen, rebuildCache]);

  useEffect(() => {
    const canOpenDevice = (): boolean => {
      const state = store.getState();
      return !introOpenRef.current && state.status === "playing" && state.outcome === null;
    };
    bridge.attach({
      onProp(id, phase) {
        if (phase === "inspect-ready") {
          inspectingRef.current = id;
          setInspecting(id);
          if (!canOpenDevice()) return;
          if (id === "laptop") openOverlay({ kind: "laptop" });
          else if (id === "phone" && !callInProgress(store.getState())) openOverlay({ kind: "phone" });
        } else if (phase === "inspect-end") {
          if (inspectingRef.current === id) {
            inspectingRef.current = null;
            setInspecting(null);
          }
          // The engine left the pose by itself: the overlay that belonged to it goes too.
          if (id === "laptop" || id === "phone") {
            if (isOpen(overlaysRef.current, id)) {
              updateOverlays((stack) => Object.freeze(stack.filter((entry) => entry.kind !== id)));
            }
          }
        } else if (phase === "interact") {
          const objectId = Object.hasOwn(PROP_TO_OBJECT, id) ? PROP_TO_OBJECT[id] : undefined;
          if (objectId && !introOpenRef.current) store.dispatch({ type: "INTERACT_OBJECT", objectId });
        }
      },
      onInspectKey(id, key) {
        if (id !== "phone" || introOpenRef.current) return false;
        const state = store.getState();
        if (state.call.status !== "ringing") return false;
        const upper = key.toUpperCase();
        if (upper === "F") return store.dispatch({ type: "ANSWER_CALL" }).accepted;
        if (upper === "R") return store.dispatch({ type: "END_CALL" }).accepted;
        return false;
      },
      label: (id) => lookup(cacheRef.current.labels, id, null),
      inspectLines: (id) => lookup(cacheRef.current.inspect, id, null),
      actions: (id) => lookup(cacheRef.current.actions, id, null),
      canLeaveInspect: (id) => lookup(cacheRef.current.leave, id, true),
      doorLocked: () => cacheRef.current.doorLocked,
      overlayOpen: () => cacheRef.current.overlayOpen,
    });
    return () => bridge.detach();
  }, [bridge, openOverlay, store, updateOverlays]);

  // --- Presentation commands (diffs) --------------------------------------------------------
  const sinkRef = useRef<PresentationSink | null>(null);
  sinkRef.current = {
    setPhoneMode: (mode) => bridge.commands?.setPhoneMode(mode),
    ring: (on) => bridge.commands?.ring(on),
    setLaptopFrame: (frame: LaptopFrameKeys | null) =>
      bridge.commands?.setLaptopFrame(frame ? { badge: text(frame.badgeKey), headline: text(frame.headlineKey) } : null),
    chime: () => bridge.commands?.chime(),
    setMood: (mood) => bridge.commands?.setMood(mood),
  };
  const presentationRef = useRef<RoomPresentation | null>(null);
  const appliedLocaleRef = useRef(locale);

  useEffect(() => {
    if (!engineReady) return;
    presentationRef.current = null;
    const apply = () => {
      const next = roomPresentation(store.getState(), scenario);
      if (sinkRef.current) applyPresentation(presentationRef.current, next, sinkRef.current);
      presentationRef.current = next;
    };
    apply();
    return store.subscribe(apply);
  }, [engineReady, scenario, store]);

  // The laptop card text is drawn as given, so a language change sends it again.
  useEffect(() => {
    if (appliedLocaleRef.current === locale) return;
    appliedLocaleRef.current = locale;
    const frame = presentationRef.current?.laptopFrame ?? null;
    if (engineReady && frame) sinkRef.current?.setLaptopFrame(frame);
  }, [engineReady, locale]);

  // --- Cursor mode while a layer is open ----------------------------------------------------
  const anyOverlay = introOpen || overlays.length > 0 || blocking;
  const cursorAppliedRef = useRef(false);
  useEffect(() => {
    if (!engineReady || cursorAppliedRef.current === anyOverlay) return;
    cursorAppliedRef.current = anyOverlay;
    bridge.commands?.setCursorMode?.(anyOverlay);
  }, [anyOverlay, bridge, engineReady]);

  // --- Rings: only while the room is free ---------------------------------------------------
  const ringableSelector = useCallback((state: ChapterState) => selectRingableCall(state, scenario), [scenario]);
  const ringable = useChapterState(store, ringableSelector);
  const free = engineReady && !introOpen && overlays.length === 0 && inspecting === null && !blocking;

  useEffect(() => {
    if (!free || ringable === null) return;
    const ring = () => {
      // The reducer checks the ring rules again; a rejected ring changes nothing.
      store.dispatch({ type: "RING_CALL", callId: ringable, reason: ringable === "call.alex" ? "first-interaction" : "follow-up" });
    };
    if (ringSettleMs <= 0) {
      ring();
      return;
    }
    const id = window.setTimeout(ring, ringSettleMs);
    return () => window.clearTimeout(id);
  }, [free, ringable, ringSettleMs, store]);

  // --- Keys: Escape (capture), J, Tab trap --------------------------------------------------
  const [decideRequest, setDecideRequest] = useState(0);
  const handleDecide = useCallback(() => {
    onOpenDecision?.();
    setDecideRequest((count) => count + 1);
  }, [onOpenDecision]);

  const [journalSeen, setJournalSeen] = useState(() => store.getState().discovered.length);

  const toggleJournal = useCallback(() => {
    if (introOpenRef.current || store.getState().status !== "playing") return;
    const stack = overlaysRef.current;
    if (stack.length === 0) {
      if (openOverlay({ kind: "journal" })) setJournalSeen(store.getState().discovered.length);
    } else if (top(stack)?.kind === "journal") {
      closeTop();
    }
  }, [closeTop, openOverlay, store]);

  /** The Notes control of a call: opens the journal on top of the call. The call keeps going. */
  const openJournal = useCallback(() => {
    if (introOpenRef.current || store.getState().status !== "playing" || overlaysRef.current.length > 0) return;
    if (openOverlay({ kind: "journal" })) setJournalSeen(store.getState().discovered.length);
  }, [openOverlay, store]);

  useEffect(() => {
    // Capture phase: the layer sees Escape before the laptop overlay's own handler and before the
    // engine, and stops it, so one press closes exactly one overlay.
    const onEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape" || introOpenRef.current) return;
      const current = top(overlaysRef.current);
      if (!current) return;
      event.preventDefault();
      event.stopImmediatePropagation();
      if (!event.repeat && canClose(current)) closeTop();
    };
    const onKeyDown = (event: KeyboardEvent) => {
      if (event.repeat || isTypingTarget(event.target) || introOpenRef.current) return;
      if (event.ctrlKey || event.metaKey || event.altKey) return;
      if (event.code === "KeyJ") {
        event.preventDefault();
        toggleJournal();
      }
    };
    const onTab = (event: KeyboardEvent) => {
      if (event.key !== "Tab" || overlaysRef.current.length === 0) return;
      // The laptop overlay traps Tab by itself.
      if (top(overlaysRef.current)?.kind === "laptop") return;
      const dialog = topDialog(overlayLayerRef.current);
      if (dialog) trapTabKey(dialog, event);
    };
    window.addEventListener("keydown", onEscape, true);
    window.addEventListener("keydown", onKeyDown);
    window.addEventListener("keydown", onTab);
    return () => {
      window.removeEventListener("keydown", onEscape, true);
      window.removeEventListener("keydown", onKeyDown);
      window.removeEventListener("keydown", onTab);
    };
  }, [canClose, closeTop, toggleJournal]);

  // Focus returns to the element that opened the overlay when it closes (Requirement 22.1).
  const previousOverlaysRef = useRef<OverlayStack>(EMPTY_OVERLAYS);
  useEffect(() => {
    const previous = previousOverlaysRef.current;
    previousOverlaysRef.current = overlays;
    const closed = top(previous);
    if (!closed || isOpen(overlays, closed.kind)) return;
    const opener = openersRef.current.get(closed.kind) ?? null;
    openersRef.current.delete(closed.kind);
    const dialog = topDialog(overlayLayerRef.current);
    if (dialog) {
      if (opener?.isConnected && dialog.contains(opener)) opener.focus({ preventScroll: true });
      else focusDialogStart(dialog);
    } else if (opener?.isConnected) {
      opener.focus({ preventScroll: true });
    }
  }, [overlays]);

  // --- HUD state ----------------------------------------------------------------------------
  const activeObjectivesSelector = useCallback((state: ChapterState) => selectActiveObjectives(state, scenario), [scenario]);
  const laptopViewSelector = useCallback((state: ChapterState) => selectLaptopView(state, scenario), [scenario]);
  const phoneRecordsSelector = useCallback((state: ChapterState) => selectPhoneRecords(state, scenario), [scenario]);
  const phoneMessagesSelector = useCallback((state: ChapterState) => selectPhoneMessages(state, scenario), [scenario]);
  const journalEntriesSelector = useCallback((state: ChapterState) => selectJournalEntries(state, scenario), [scenario]);
  const claimStatusesSelector = useCallback((state: ChapterState) => selectClaimStatuses(state, scenario), [scenario]);
  const combinationSelector = useCallback((state: ChapterState) => selectCombinationOptions(state, scenario), [scenario]);
  const decisionPanelSelector = useCallback((state: ChapterState) => selectDecisionPanel(state, scenario), [scenario]);

  const activeObjectives = useChapterState(store, activeObjectivesSelector);
  const laptopView = useChapterState(store, laptopViewSelector);
  const phoneRecords = useChapterState(store, phoneRecordsSelector);
  const phoneMessages = useChapterState(store, phoneMessagesSelector);
  const journalEntries = useChapterState(store, journalEntriesSelector);
  const claimStatuses = useChapterState(store, claimStatusesSelector);
  const combination = useChapterState(store, combinationSelector);
  const decisionPanel = useChapterState(store, decisionPanelSelector);
  const chapterState = useChapterState(store);
  const relatedDeductions = useMemo(() => relatedDeductionStatements(chapterState, scenario), [chapterState, scenario]);

  const { toast, notice, announcements, completed, dismissToast, dismissNotice } = useHudNotices(store);
  const [hintOn, setHintOn] = useState(false);
  const currentHint = activeObjectives.find((objective) => objective.hint !== undefined)?.hint ?? null;

  // --- Overlay content ----------------------------------------------------------------------
  const closeLaptop = useCallback(() => removeOverlay("laptop"), [removeOverlay]);
  const closePhone = useCallback(() => removeOverlay("phone"), [removeOverlay]);
  const closeJournal = useCallback(() => removeOverlay("journal"), [removeOverlay]);

  const laptopTabs = useMemo<LaptopExtraTab[]>(
    () => [
      { id: "bank", label: text("laptop.apps.bank"), content: <BankApp view={buildBankAppView(laptopView)} dispatch={dispatchVoid} /> },
      { id: "compare", label: text("laptop.apps.compare"), content: <CompareView view={buildCompareViewModel(laptopView)} dispatch={dispatchVoid} /> },
      {
        id: "security",
        label: text("laptop.apps.security"),
        content: <ReviewSecurityPage view={buildReviewSecurityView(laptopView)} dispatch={dispatchVoid} />,
      },
    ],
    [dispatchVoid, laptopView, text],
  );

  const renderOverlay = (overlay: Overlay): React.ReactNode => {
    switch (overlay.kind) {
      case "laptop":
        return <LaptopOverlay key="laptop" view={laptopView} dispatch={dispatchVoid} onClose={closeLaptop} extraTabs={laptopTabs} />;
      case "phone":
        return (
          <PhoneOverlay
            key="phone"
            records={phoneRecords}
            messages={phoneMessages}
            onInspectEvidence={(evidenceId: EvidenceId) => dispatchVoid({ type: "INSPECT_EVIDENCE", evidenceId })}
            onDeviceAction={(deviceActionId: DeviceActionId) => dispatchVoid({ type: "DEVICE_ACTION", deviceActionId })}
            onCallSavedContact={(claimId: ClaimId) => dispatchVoid({ type: "VERIFY_CLAIM", claimId, method: "saved-official-contact" })}
            onClose={closePhone}
          />
        );
      case "journal":
        return (
          <EvidenceJournal
            key="journal"
            entries={journalEntries}
            claims={claimStatuses}
            decisionOffered={decisionPanel.offered}
            onDecide={handleDecide}
            onClose={closeJournal}
            combination={combination}
            onCombine={(evidenceIds) => dispatch({ type: "COMBINE_EVIDENCE", evidenceIds })}
            relatedDeductions={relatedDeductions}
            hint={currentHint}
          />
        );
      default:
        // `call`, `decision`, `ending`, `debrief` come from `renderExtension` (tasks 10.2, 10.3).
        return null;
    }
  };

  const api: RoomLayerApi = {
    store,
    scenario,
    overlays,
    openOverlay,
    removeOverlay,
    closeTop,
    saveNow,
    introOpen,
  };

  const stopMouseDown = useCallback((event: React.MouseEvent) => event.stopPropagation(), []);
  const hudVisible = !introOpen && status === "playing";
  const journalUnread = Math.max(0, discoveredCount - journalSeen);
  const objectiveText = (id: ObjectiveId): string => (Object.hasOwn(scenario.objectives, id) ? scenario.objectives[id].text : id);

  const announcementText = (item: Announcement): string => {
    if (item.kind === "notification") return text("room.announce.notification");
    if (item.kind === "evidence") {
      const title = Object.hasOwn(scenario.evidence, item.evidenceId) ? scenario.evidence[item.evidenceId].title : item.evidenceId;
      return text("room.announce.evidence", { title });
    }
    const statement = Object.hasOwn(scenario.deductions, item.deductionId) ? scenario.deductions[item.deductionId].statement : item.deductionId;
    return text("room.announce.deduction", { statement });
  };

  return (
    <ComfortProvider settings={settings}>
      <div data-testid="room-chapter-layer" className="contents">
        {/* Polite live region: new notification, new evidence, recorded deduction (Requirement 22.2). */}
        <div role="status" aria-live="polite" aria-atomic="false" className="sr-only" data-testid="room-live-region">
          {announcements.map((item) => (
            <p key={item.key}>{announcementText(item)}</p>
          ))}
        </div>

        {hudVisible && (
          <>
            <div className="pointer-events-none absolute left-4 top-4 z-10">
              <ObjectiveTracker
                objectives={activeObjectives}
                store={store}
                scenario={scenario}
                announcement={completed === null ? null : text("room.objectiveToast.done", { objective: objectiveText(completed) })}
              />
            </div>

            {/* Visual only: the live region above announces the same events once. */}
            <div aria-hidden="true" className="pointer-events-none absolute left-1/2 top-4 z-10 flex -translate-x-1/2 flex-col items-center gap-2">
              {toast && <ObjectiveToast key={toast.key} kind={toast.kind} text={objectiveText(toast.objectiveId)} onDismiss={dismissToast} />}
              {notice && (
                <EvidenceNotice
                  key={notice.key}
                  title={Object.hasOwn(scenario.evidence, notice.evidenceId) ? scenario.evidence[notice.evidenceId].title : notice.evidenceId}
                  onDismiss={dismissNotice}
                />
              )}
            </div>

            <div className="absolute right-4 top-4 z-10 flex flex-col items-end gap-2" onMouseDown={stopMouseDown}>
              <div className="flex gap-3">
                <button
                  type="button"
                  className={`${UI.buttonSecondary} relative`}
                  aria-pressed={isOpen(overlays, "journal")}
                  aria-keyshortcuts="J"
                  onClick={toggleJournal}
                >
                  <NotebookText className="h-4 w-4" aria-hidden="true" />
                  <span>{text("hud.journal")}</span>
                  <kbd aria-hidden="true" className="rounded border border-[#38344f] px-1.5 font-mono text-xs text-[#a9a4c4]">
                    J
                  </kbd>
                  {journalUnread > 0 && (
                    <>
                      <span
                        aria-hidden="true"
                        className="absolute -right-2 -top-2 min-w-5 rounded-full bg-[#f2b24b] px-1.5 text-center text-xs font-bold leading-5 text-[#171521]"
                      >
                        {journalUnread}
                      </span>
                      <span className="sr-only">
                        {text("hud.newEntries", { count: journalUnread, number: formatNumber(locale, journalUnread) })}
                      </span>
                    </>
                  )}
                </button>
                <button type="button" className={UI.buttonSecondary} aria-pressed={hintOn} onClick={() => setHintOn((on) => !on)}>
                  <Lightbulb className="h-4 w-4" aria-hidden="true" />
                  <span>{hintOn ? text("room.hints.hide") : text("room.hints.show")}</span>
                </button>
              </div>
              {hintOn && (
                <p className={`${UI.hudPanel} max-w-xs`} role="note" aria-label={text("room.hud.hintPanelLabel")} data-testid="room-hint">
                  <span className={UI.label}>{text("room.hints.heading")}</span>
                  <span className="mt-1 block">{currentHint ?? text("room.hints.none")}</span>
                </p>
              )}
            </div>
          </>
        )}

        <div ref={overlayLayerRef} onMouseDown={stopMouseDown}>
          {/* Before the overlays in the DOM, so the journal opened from a call is the top dialog. */}
          <RoomPhoneModelLayer
            active={callOpen}
            modelAllowed={modelAllowed}
            ringing={callRinging}
            screenSink={callSink}
            onModelError={handleModelError}
            onContextChange={setContextLost}
          />
          <RoomCallLayer
            store={store}
            scenario={scenario}
            settings={settings}
            paused={overlays.length > 0}
            modelAllowed={modelAllowed}
            screenSink={callSink}
            engine={engine}
            voiceDeps={voiceDeps}
            onOpenNotes={openJournal}
          />
          {overlays.map((overlay) => (
            <React.Fragment key={overlay.kind}>{renderOverlay(overlay)}</React.Fragment>
          ))}
          {renderExtension?.(api)}
          <RoomEndingLayer
            store={store}
            scenario={scenario}
            settings={settings}
            overlays={overlays}
            openOverlay={openOverlay}
            removeOverlay={removeOverlay}
            free={free && !callOpen}
            decideRequest={decideRequest}
            narrationDeps={narrationDeps}
            saveSource={saveSource}
            onReturnToMenu={onReturnToMenu}
          />
        </div>

        {saveFailed && (
          <div className="absolute right-4 top-20 z-50" onMouseDown={stopMouseDown}>
            <SaveFailureNotice onDismiss={() => setSaveFailed(false)} />
          </div>
        )}

        {saveTrimmedOpen && !introOpen && (
          <div className="absolute left-1/2 top-20 z-50 -translate-x-1/2" onMouseDown={stopMouseDown}>
            <SaveTrimmedNotice onDismiss={() => setSaveTrimmedOpen(false)} />
          </div>
        )}

        {introOpen && (
          <ChapterIntroOverlay
            ready={engineReady}
            mode={introMode}
            lines={introLines}
            onLineChange={goToIntroLine}
            controlIds={INTRO_CONTROLS}
            voiceGain={voiceGain(
              { soundEnabled: settings.soundEnabled, masterVolume: settings.sfxVolume, voiceVolume: settings.voiceVolume },
              false,
            )}
            onBegin={handleBegin}
          />
        )}
      </div>
    </ComfortProvider>
  );
};
