// Narration playback for the room chapter (task 10.2): the `dlg.intro` and `dlg.aftermath` beats.
// Presentation only. It reads the scenario and settings, drives its own `VoiceDialoguePlayer`
// with explicit targets, and never dispatches to the chapter store. Narration beats are linear
// nodes without options, so the sequence is played in order by index, not by the dialogue engine.
//
// - One line is current at a time. `advance` moves to the next line (stopping the clip), `skip`
//   ends the sequence. When the last line is advanced the sequence is `finished`.
// - A line without a clip (missing, other language without the English-voice fallback, audio off)
//   is subtitle only; the player reports why and never plays English audio as Vietnamese.
// - `active` false stops playback synchronously in the effect cleanup, so a call clip and a
//   narration clip never overlap (the host turns `active` off while a call is in progress).
// - Unmount stops the clip and disposes the player.
import { useCallback, useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useGameLocale } from "../../../i18n/useGameLocale";
import type { DialogueGraphId } from "../../../game/narrative/chapter1/ids";
import type { DialogueNode, ScenarioDefinition } from "../../../game/narrative/types";
import { isSpokenNode } from "../../../game/voice/buildVoiceJobs";
import { chapter1VoiceManifest } from "../../../game/voice/chapter1.manifest";
import { createDevSpeechPreview } from "../../../game/voice/devSpeechPreview";
import { effectivePauseMs } from "../../../game/voice/mixPlan";
import { createVoiceDialoguePlayer } from "../../../game/voice/VoiceDialoguePlayer";
import type { VoiceDialoguePlayer, VoiceSnapshot, VoiceTarget } from "../../../game/voice/VoiceDialoguePlayer";
import { createWebAudioEngine } from "../../../game/voice/webAudioEngine";
import { isSubtitleVisible } from "../call/callDialogueView";
import type { VoicePlaybackDeps, VoicePlaybackSettings } from "../voice/useVoicePlayback";

export interface NarrationSequence {
  graphId: DialogueGraphId;
  nodeIds: readonly string[];
}

export interface NarrationLineView {
  nodeId: string;
  speakerName: string;
  text: string;
}

export interface UseNarrationPlaybackOptions {
  /** Display scenario (the text shown) of the current language. */
  scenario: ScenarioDefinition;
  /** `null`: nothing to play. A new sequence starts again from its first line. */
  sequence: NarrationSequence | null;
  /** False stops playback at once. The host sets it false while a call is in progress. */
  active: boolean;
  /** True while an overlay is on top: the clip pauses and resumes afterwards. */
  paused?: boolean;
  settings: VoicePlaybackSettings & { subtitlesEnabled: boolean };
  /** Move to the next line when a clip ends. Default true. Playback ending never changes story state. */
  autoAdvance?: boolean;
  deps?: VoicePlaybackDeps;
}

export interface NarrationPlayback {
  index: number;
  total: number;
  /** The current line, or `null` when there is none (no sequence, empty, or finished). */
  line: NarrationLineView | null;
  finished: boolean;
  snapshot: VoiceSnapshot;
  /** `isSubtitleVisible`: the text shows when subtitles are on or nothing is audible. */
  subtitleVisible: boolean;
  /** Next line, or finish on the last one. Cuts the current clip. */
  advance: () => void;
  /** Ends the sequence now. */
  skip: () => void;
  /** Shows line `index` (clamped). Used when another component owns the stepping. */
  goTo: (index: number) => void;
}

interface Entry {
  nodeId: string;
  speakerName: string;
  text: string;
  target: VoiceTarget | null;
}

const IDLE_SNAPSHOT: VoiceSnapshot = {
  phase: "idle",
  targetKey: null,
  source: "none",
  label: "none",
  reason: null,
  muted: false,
  audible: false,
  durationMs: null,
  endedCount: 0,
};

const defaultNow = (): number => performance.now();
const defaultSetTimer = (fn: () => void, ms: number): number => window.setTimeout(fn, ms);
const defaultClearTimer = (id: number): void => window.clearTimeout(id);
const defaultLog = (message: string): void => {
  console.debug(message);
};
const noopUnsubscribe = (): void => undefined;

function buildTarget(
  graphId: DialogueGraphId,
  node: DialogueNode,
  speakerId: VoiceTarget["speakerId"] | undefined,
  lineText: string,
  reducedStress: boolean,
): VoiceTarget | null {
  if (!isSpokenNode(node) || node.tone === undefined || speakerId === undefined) return null;
  const base = effectivePauseMs(node.tone, reducedStress);
  const authored = node.pauseBeforeMs;
  const pauseBeforeMs =
    typeof authored === "number" && Number.isFinite(authored)
      ? authored + (base - effectivePauseMs(node.tone, false))
      : base;
  return {
    key: `${graphId}:${node.id}`,
    graphId,
    nodeId: node.id,
    speakerId,
    tone: node.tone,
    channel: node.speaker === "caller" ? "phone" : "face-to-face",
    lineText,
    pauseBeforeMs,
  };
}

export function useNarrationPlayback(options: UseNarrationPlaybackOptions): NarrationPlayback {
  const { scenario, sequence, active, settings, deps } = options;
  const paused = options.paused ?? false;
  const autoAdvance = options.autoAdvance ?? true;
  const locale = useGameLocale();
  const depsRef = useRef(deps);
  depsRef.current = deps;

  // --- One player per mount (created in an effect, so a development double mount works) ----------
  const [player, setPlayer] = useState<VoiceDialoguePlayer | null>(null);
  const devPreviewRef = useRef(false);
  useEffect(() => {
    const d = depsRef.current;
    const preview = (d?.createPreview ?? createDevSpeechPreview)();
    devPreviewRef.current = preview !== null;
    const created = createVoiceDialoguePlayer({
      manifest: d?.manifest ?? chapter1VoiceManifest,
      port: (d?.createPort ?? createWebAudioEngine)(),
      preview,
      now: d?.now ?? defaultNow,
      setTimer: d?.setTimer ?? defaultSetTimer,
      clearTimer: d?.clearTimer ?? defaultClearTimer,
      log: d?.log ?? defaultLog,
    });
    setPlayer(created);
    return () => {
      created.stop("dispose");
      created.dispose();
      setPlayer((current) => (current === created ? null : current));
    };
  }, []);

  const { soundEnabled, sfxVolume, voiceVolume, phoneVoiceFilter, englishVoiceFallback, reducedStress } = settings;
  useEffect(() => {
    if (player === null) return;
    player.configure({
      locale,
      soundEnabled,
      masterVolume: sfxVolume,
      voiceVolume,
      phoneFilter: phoneVoiceFilter,
      englishVoiceFallback,
      devPreview: devPreviewRef.current,
    });
  }, [player, locale, soundEnabled, sfxVolume, voiceVolume, phoneVoiceFilter, englishVoiceFallback]);

  // --- The lines -------------------------------------------------------------------------------
  const entries = useMemo<Entry[]>(() => {
    if (sequence === null || !Object.hasOwn(scenario.dialogues, sequence.graphId)) return [];
    const graph = scenario.dialogues[sequence.graphId];
    const result: Entry[] = [];
    for (const nodeId of sequence.nodeIds) {
      if (!Object.hasOwn(graph.nodes, nodeId)) continue;
      const node = graph.nodes[nodeId];
      if (!Object.hasOwn(graph.lines, node.lineId)) continue;
      const text = graph.lines[node.lineId];
      result.push({
        nodeId,
        speakerName: graph.persona.name,
        text,
        target: buildTarget(graph.id, node, node.speakerId ?? graph.persona.speakerId, text, reducedStress),
      });
    }
    return result;
  }, [scenario, sequence, reducedStress]);

  const sequenceKey = sequence === null ? "" : `${sequence.graphId}|${sequence.nodeIds.join(",")}`;
  const [state, setState] = useState<{ key: string; index: number; finished: boolean }>({
    key: sequenceKey,
    index: 0,
    finished: false,
  });
  // A new sequence starts again from its first line.
  let current = state;
  if (state.key !== sequenceKey) {
    current = { key: sequenceKey, index: 0, finished: false };
    setState(current);
  }
  const total = entries.length;
  const index = Math.min(current.index, Math.max(0, total - 1));
  const finished = current.finished || total === 0;
  const entry: Entry | null = finished ? null : (entries[index] ?? null);
  const target = entry?.target ?? null;
  const targetKey = target?.key ?? null;
  const targetRef = useRef(target);
  targetRef.current = target;

  // --- Playback: the cleanup stops the clip, so `active` false and unmount are synchronous ------
  useEffect(() => {
    const t = targetRef.current;
    if (player === null || !active || t === null) return undefined;
    player.show(t);
    return () => player.stop("node-changed");
  }, [player, active, targetKey, locale]);

  useEffect(() => {
    if (player === null) return;
    if (paused) player.pause();
    else player.resume();
  }, [player, paused]);

  // --- Snapshot --------------------------------------------------------------------------------
  const subscribe = useCallback(
    (listener: () => void) => (player === null ? noopUnsubscribe : player.subscribe(listener)),
    [player],
  );
  const getSnapshot = useCallback(() => (player === null ? IDLE_SNAPSHOT : player.getSnapshot()), [player]);
  const snapshot = useSyncExternalStore(subscribe, getSnapshot, getSnapshot);

  // --- Stepping --------------------------------------------------------------------------------
  const lastIndex = total - 1;
  const advance = useCallback(() => {
    setState((s) => {
      const base = s.key === sequenceKey ? s : { key: sequenceKey, index: 0, finished: false };
      if (base.finished) return base;
      if (base.index >= lastIndex) return { ...base, finished: true };
      return { ...base, index: base.index + 1 };
    });
  }, [lastIndex, sequenceKey]);
  const skip = useCallback(() => {
    setState((s) => ({ key: sequenceKey, index: s.key === sequenceKey ? s.index : 0, finished: true }));
  }, [sequenceKey]);
  const goTo = useCallback(
    (next: number) => {
      const clamped = Math.max(0, Math.min(Math.max(0, lastIndex), Math.floor(next)));
      setState((s) => (s.key === sequenceKey && s.index === clamped && !s.finished ? s : { key: sequenceKey, index: clamped, finished: false }));
    },
    [lastIndex, sequenceKey],
  );

  // A clip that ended on the current line moves on. Lines without a clip wait for the player.
  const endedHandledRef = useRef(0);
  useEffect(() => {
    if (!autoAdvance || !active || targetKey === null) return;
    if (snapshot.targetKey !== targetKey || snapshot.phase !== "ended") return;
    if (endedHandledRef.current === snapshot.endedCount) return;
    endedHandledRef.current = snapshot.endedCount;
    advance();
  }, [advance, active, autoAdvance, snapshot.endedCount, snapshot.phase, snapshot.targetKey, targetKey]);

  const line: NarrationLineView | null = entry === null ? null : { nodeId: entry.nodeId, speakerName: entry.speakerName, text: entry.text };
  return {
    index,
    total,
    line,
    finished,
    snapshot,
    subtitleVisible: isSubtitleVisible({ subtitlesEnabled: settings.subtitlesEnabled, audible: snapshot.audible }),
    advance,
    skip,
    goTo,
  };
}
