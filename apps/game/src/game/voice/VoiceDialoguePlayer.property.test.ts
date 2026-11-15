import { describe, expect, it } from "vitest";

import { CHAPTER1_VOICE_BASE } from "../../config/assetPaths";
import { CORE_PROPERTY_RUNS, CORE_PROPERTY_SEED, caseSeed } from "../../test/chapterRuns";
import {
  createFakeAudioPort,
  createFakePreviewPort,
  type FakeAudioPort,
  type FakePreviewPort,
} from "../../test/fakeAudioPort";
import { createLcg, pick, randomInt } from "../../test/seededRandom";
import {
  DIALOGUE_GRAPH_IDS,
  SPEAKER_IDS,
  TONE_IDS,
  type DialogueGraphId,
  type SpeakerId,
  type Tone,
} from "../narrative/chapter1/ids";
import { CHAPTER_1_SCENARIO } from "../narrative/chapter1/scenario";
import type { StopReason } from "./audioPort";
import type { VoiceClipEntry, VoiceManifest } from "./manifestTypes";
import { VOICE_MANIFEST_SCHEMA_VERSION } from "./manifestTypes";
import {
  createVoiceDialoguePlayer,
  type VoiceDialoguePlayer,
  type VoiceSettings,
  type VoiceTarget,
} from "./VoiceDialoguePlayer";

/** Seeded property runs can exceed Vitest's 5 s default when the machine is loaded. */
const PROPERTY_TIMEOUT_MS = 60_000;

const FILE_SEED = (CORE_PROPERTY_SEED ^ 0x0a11d10e) >>> 0;
const GRAPH = DIALOGUE_GRAPH_IDS[0];
const NODE_IDS = ["n.a", "n.b", "n.c", "n.d"] as const;
const STOP_REASONS: readonly StopReason[] = [
  "node-changed",
  "call-ended",
  "hang-up",
  "page-hidden",
  "settings-changed",
  "dispose",
];
const MAX_STEPS = 60;

type Mode = "port-only" | "port-and-preview" | "preview-only";
const MODES: readonly Mode[] = ["port-only", "port-and-preview", "preview-only"];

interface Rig {
  readonly mode: Mode;
  readonly port: FakeAudioPort;
  readonly preview: FakePreviewPort | null;
  readonly player: VoiceDialoguePlayer;
  readonly next: () => number;
  readonly commands: string[];
  settings: VoiceSettings;
  /** Playbacks whose handle the player stopped (the callbacks of these are stale). */
  subscriberCalls: number;
}

function makeManifest(nodes: readonly string[]): VoiceManifest {
  const clips: VoiceClipEntry[] = nodes.map((nodeId) => ({
    clipId: nodeId,
    nodeId,
    graphId: GRAPH,
    speakerId: SPEAKER_IDS[0],
    locale: "en",
    status: "present",
    sources: [{ src: `${CHAPTER1_VOICE_BASE}/en/${nodeId}.mp3`, type: "audio/mpeg" }],
    tone: TONE_IDS[0],
    voiceNote: "test",
    origin: "tts-generated",
    credit: "test",
    sourceTextHash: "00000000",
  }));
  return { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips };
}

function makeRig(seed: number): Rig {
  const next = createLcg(seed);
  const mode = pick(next, MODES);
  const withClips = mode === "preview-only" ? [] : NODE_IDS.filter(() => next() < 0.75);
  const port = createFakeAudioPort();
  for (const nodeId of NODE_IDS) {
    port.setDuration(`${CHAPTER1_VOICE_BASE}/en/${nodeId}.mp3`, randomInt(next, 200, 3000));
  }
  const preview =
    mode === "port-only"
      ? null
      : createFakePreviewPort(next() < 0.8 ? [{ name: "Fake English", lang: "en-US" }] : []);
  const settings: VoiceSettings = {
    locale: "en",
    soundEnabled: true,
    masterVolume: 1,
    voiceVolume: 1,
    phoneFilter: true,
    englishVoiceFallback: false,
    devPreview: mode !== "port-only",
  };
  const player = createVoiceDialoguePlayer({
    manifest: makeManifest(withClips),
    port,
    preview,
    now: port.clock.now,
    setTimer: port.clock.setTimer,
    clearTimer: port.clock.clearTimer,
    log: () => undefined,
  });
  player.configure(settings);
  const rig: Rig = { mode, port, preview, player, next, commands: [], settings, subscriberCalls: 0 };
  player.subscribe(() => {
    rig.subscriberCalls += 1;
  });
  return rig;
}

async function flush(): Promise<void> {
  for (let i = 0; i < 8; i += 1) await Promise.resolve();
}

function targetFor(rig: Rig): VoiceTarget {
  const nodeId = pick(rig.next, NODE_IDS);
  return {
    key: `${GRAPH}:${nodeId}`,
    graphId: GRAPH,
    nodeId,
    speakerId: SPEAKER_IDS[0],
    tone: TONE_IDS[0],
    channel: rig.next() < 0.5 ? "phone" : "face-to-face",
    lineText: `line ${nodeId}`,
    pauseBeforeMs: rig.next() < 0.4 ? 0 : randomInt(rig.next, 0, 600),
  };
}

/** Number of things that can be heard right now: handles with gain above zero plus live speech. */
function audibleCount(rig: Rig): number {
  const handles = rig.port.playbacks.filter((p) => p.live && p.gain > 0).length;
  const speech = rig.preview
    ? rig.preview.spoken.filter((s) => s.live && !s.paused && s.gain > 0).length
    : 0;
  return handles + speech;
}

type CommandName =
  | "show"
  | "replay"
  | "stop"
  | "pause"
  | "resume"
  | "completeLoad"
  | "fireEnded"
  | "staleEnded"
  | "advance"
  | "setMuted"
  | "configure"
  | "resumeGate"
  | "flush"
  | "settle";
const COMMANDS: readonly CommandName[] = [
  "show",
  "show",
  "show",
  "replay",
  "stop",
  "pause",
  "resume",
  "completeLoad",
  "completeLoad",
  "completeLoad",
  "advance",
  "fireEnded",
  "fireEnded",
  "staleEnded",
  "advance",
  "setMuted",
  "configure",
  "resumeGate",
  "flush",
  "settle",
  "settle",
  "settle",
];

/** Runs one random command. `allowStop` is false for the property that drives `stop` itself. */
async function runCommand(rig: Rig, name: CommandName, onStop: (r: StopReason) => Promise<void>): Promise<string> {
  const { player, port, next } = rig;
  switch (name) {
    case "show": {
      const t = targetFor(rig);
      player.show(t);
      return `show(${t.nodeId}, ${t.channel}, pause ${t.pauseBeforeMs})`;
    }
    case "replay":
      player.replay();
      return "replay()";
    case "stop": {
      const reason = pick(next, STOP_REASONS);
      await onStop(reason);
      return `stop(${reason})`;
    }
    case "pause":
      player.pause();
      return "pause()";
    case "resume":
      player.resume();
      return "resume()";
    case "completeLoad": {
      const pending = port.pendingLoads;
      if (pending.length === 0) return "completeLoad(none pending)";
      const url = pick(next, pending);
      port.completeLoad(url);
      return `completeLoad(${url})`;
    }
    case "fireEnded": {
      const live = port.playbacks.filter((p) => p.live);
      if (live.length > 0) {
        const pb = pick(next, live);
        port.fireEnded(pb.id);
        return `fireEnded(${pb.id})`;
      }
      if (rig.preview) {
        rig.preview.fireEnded();
        return "preview.fireEnded()";
      }
      return "fireEnded(none live)";
    }
    case "staleEnded": {
      // A handle the player stopped may still report its end late. That must change nothing.
      const stopped = port.playbacks.filter((p) => !p.live && p.stopCount > 0);
      if (stopped.length === 0) return "staleEnded(none stopped)";
      const pb = pick(next, stopped);
      const before = player.getSnapshot();
      pb.onEnded();
      const after = player.getSnapshot();
      if (after !== before) {
        throw new Error(`stale ended callback of ${pb.id} changed the snapshot ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);
      }
      return `staleEnded(${pb.id})`;
    }
    case "advance": {
      const ms = pick(next, [0, 50, 300, 700, 1600, 2500]);
      port.clock.advance(ms);
      return `advance(${ms})`;
    }
    case "setMuted": {
      const m = next() < 0.5;
      player.setMuted(m);
      return `setMuted(${m})`;
    }
    case "configure": {
      rig.settings = {
        ...rig.settings,
        soundEnabled: next() < 0.9,
        voiceVolume: pick(next, [0, 0.5, 1, 1, 1, 1]),
        masterVolume: pick(next, [0.5, 1]),
        phoneFilter: next() < 0.5,
      };
      player.configure(rig.settings);
      return `configure(${JSON.stringify(rig.settings)})`;
    }
    case "resumeGate":
      if (next() < 0.5) {
        port.refuseResume();
        return "refuseResume()";
      }
      port.allowResume();
      return "allowResume()";
    case "flush":
      await flush();
      return "flush()";
    case "settle": {
      // Loads finish in a random order, then the pause elapses: lets lines reach playback.
      const urls = [...port.pendingLoads];
      while (urls.length > 0) {
        const i = randomInt(next, 0, urls.length - 1);
        port.completeLoad(urls[i]);
        urls.splice(i, 1);
      }
      await flush();
      port.clock.advance(pick(next, [0, 300, 650]));
      await flush();
      return "settle()";
    }
  }
}

function fail(seed: number, run: number, step: number, rig: Rig, message: string): never {
  const prefix = rig.commands.slice(0, step + 1).map((c, i) => `  ${i + 1}. ${c}`).join("\n");
  throw new Error(
    `seed=${seed} case=${run} mode=${rig.mode} failed at step ${step + 1}: ${message}\nshortest failing prefix:\n${prefix}`,
  );
}

describe("voice dialogue player properties", () => {
  // Feature: chapter-01-voice-narrative, Property 10: At most one clip is audible
  it(
    "keeps at most one audible playback and ignores stale callbacks",
    async () => {
      let totalStarted = 0;
      let totalSpeech = 0;
      let totalStale = 0;
      for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
        const seed = caseSeed(FILE_SEED, run);
        const rig = makeRig(seed);
        const steps = randomInt(rig.next, 10, MAX_STEPS);
        for (let step = 0; step < steps; step += 1) {
          const name = pick(rig.next, COMMANDS);
          try {
            rig.commands.push(
              await runCommand(rig, name, (reason) => {
                rig.player.stop(reason);
                return Promise.resolve();
              }),
            );
          } catch (error) {
            rig.commands.push(`${name} (threw)`);
            fail(seed, run, step, rig, error instanceof Error ? error.message : String(error));
          }
          // Most steps let promise callbacks run; the rest leave them pending (random interleaving).
          if (rig.next() < 0.8) await flush();
          const audible = audibleCount(rig);
          if (audible > 1) fail(seed, run, step, rig, `${audible} audible playbacks at once`);
          if (rig.port.maxConcurrentPlaybacks > 1) {
            fail(seed, run, step, rig, `maxConcurrentPlaybacks=${rig.port.maxConcurrentPlaybacks}`);
          }
          if (rig.port.concurrencyLog.some((n) => n > 1)) {
            fail(seed, run, step, rig, `concurrencyLog=${JSON.stringify(rig.port.concurrencyLog)}`);
          }
          if (rig.preview && rig.preview.liveUtterances > 1) {
            fail(seed, run, step, rig, `${rig.preview.liveUtterances} live utterances`);
          }
        }
        totalStarted += rig.port.playbacks.length;
        totalSpeech += rig.preview ? rig.preview.spoken.length : 0;
        totalStale += rig.commands.filter((c) => c.startsWith("staleEnded(pb-")).length;
        rig.player.dispose();
      }
      // The generator must actually reach playback, speech and stale callbacks.
      expect(totalStarted).toBeGreaterThan(100);
      expect(totalSpeech).toBeGreaterThan(10);
      expect(totalStale).toBeGreaterThan(10);
    },
    PROPERTY_TIMEOUT_MS,
  );

  // Feature: chapter-01-voice-narrative, Property 11: Stopping is immediate and releases everything
  it(
    "stop leaves no live handle before it returns and dispose leaves no handle, timer or listener",
    async () => {
      let totalStopChecks = 0;
      let totalStarted = 0;
      for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
        const seed = caseSeed(FILE_SEED ^ 0x11, run);
        const rig = makeRig(seed);
        const steps = randomInt(rig.next, 10, MAX_STEPS);
        let step = 0;
        let stopChecks = 0;
        const checkStop = async (reason: StopReason): Promise<void> => {
          rig.player.stop(reason);
          // Immediate: no await has happened since the call.
          if (rig.port.liveHandles !== 0) throw new Error(`liveHandles=${rig.port.liveHandles} right after stop(${reason})`);
          if (rig.port.listeners !== 0) throw new Error(`listeners=${rig.port.listeners} right after stop(${reason})`);
          if (rig.port.timers !== 0) throw new Error(`timers=${rig.port.timers} right after stop(${reason})`);
          if (rig.preview && rig.preview.liveUtterances !== 0) {
            throw new Error(`liveUtterances=${rig.preview.liveUtterances} right after stop(${reason})`);
          }
          if (audibleCount(rig) !== 0) throw new Error(`audible after stop(${reason})`);
          stopChecks += 1;
          // Late work from before the stop must not bring anything back.
          const startedBefore = rig.port.playbacks.length;
          const speechBefore = rig.preview ? rig.preview.spoken.length : 0;
          await flush();
          while (rig.port.pendingLoads.length > 0) rig.port.completeLoad();
          await flush();
          rig.port.clock.advance(5000);
          await flush();
          if (rig.port.playbacks.length !== startedBefore) throw new Error("a playback started after stop");
          if (rig.preview && rig.preview.spoken.length !== speechBefore) throw new Error("speech started after stop");
          if (rig.port.liveHandles !== 0 || rig.port.timers !== 0 || rig.port.listeners !== 0) {
            throw new Error(
              `after stop and late callbacks: handles=${rig.port.liveHandles} timers=${rig.port.timers} listeners=${rig.port.listeners}`,
            );
          }
        };
        for (; step < steps; step += 1) {
          // Bias towards stop so that every case checks it at least once or twice.
          const name: CommandName = rig.next() < 0.1 ? "stop" : pick(rig.next, COMMANDS);
          try {
            rig.commands.push(await runCommand(rig, name, checkStop));
          } catch (error) {
            rig.commands.push(`${name} (threw)`);
            fail(seed, run, step, rig, error instanceof Error ? error.message : String(error));
          }
          if (rig.next() < 0.8) await flush();
        }

        // Dispose from whatever state the case ended in.
        rig.commands.push("dispose()");
        try {
          rig.player.dispose();
          if (rig.port.liveHandles !== 0) throw new Error(`liveHandles=${rig.port.liveHandles} after dispose`);
          if (rig.port.timers !== 0) throw new Error(`timers=${rig.port.timers} after dispose`);
          if (rig.port.listeners !== 0) throw new Error(`listeners=${rig.port.listeners} after dispose`);
          if (rig.preview && rig.preview.liveUtterances !== 0) throw new Error("live utterance after dispose");
          if (!rig.port.disposed) throw new Error("port was not disposed");
          if (rig.preview && !rig.preview.disposed) throw new Error("preview port was not disposed");

          // Every later command is a no-op.
          const snapshot = rig.player.getSnapshot();
          const calls = rig.subscriberCalls;
          const loads = rig.port.loadRequests.length;
          const started = rig.port.playbacks.length;
          const resumes = rig.port.resumeCalls;
          const spoken = rig.preview ? rig.preview.spoken.length : 0;
          const lateListener = { calls: 0 };
          const unsubscribe = rig.player.subscribe(() => {
            lateListener.calls += 1;
          });
          rig.player.show(targetFor(rig));
          rig.player.replay();
          rig.player.pause();
          rig.player.resume();
          rig.player.setMuted(true);
          rig.player.setMuted(false);
          rig.player.configure({ ...rig.settings, soundEnabled: true, voiceVolume: 1 });
          rig.player.prefetch(NODE_IDS.map((nodeId) => ({ graphId: GRAPH, nodeId })));
          rig.player.stop("hang-up");
          await rig.player.unlock();
          rig.player.dispose();
          await flush();
          rig.port.clock.advance(5000);
          await flush();
          unsubscribe();
          if (rig.player.getSnapshot() !== snapshot) throw new Error("snapshot changed after dispose");
          if (rig.subscriberCalls !== calls) throw new Error("a subscriber was called after dispose");
          if (lateListener.calls !== 0) throw new Error("a listener added after dispose was called");
          if (rig.port.loadRequests.length !== loads) throw new Error("a load was requested after dispose");
          if (rig.port.playbacks.length !== started) throw new Error("a playback started after dispose");
          if (rig.port.resumeCalls !== resumes) throw new Error("the port was resumed after dispose");
          if (rig.preview && rig.preview.spoken.length !== spoken) throw new Error("speech started after dispose");
          if (rig.port.liveHandles !== 0 || rig.port.timers !== 0 || rig.port.listeners !== 0) {
            throw new Error("handles, timers or listeners appeared after dispose");
          }
        } catch (error) {
          fail(seed, run, steps, rig, error instanceof Error ? error.message : String(error));
        }
        totalStopChecks += stopChecks;
        totalStarted += rig.port.playbacks.length;
      }
      expect(totalStopChecks).toBeGreaterThan(CORE_PROPERTY_RUNS);
      // This property stops often on purpose, so fewer lines reach playback than in Property 10.
      expect(totalStarted).toBeGreaterThan(50);
    },
    PROPERTY_TIMEOUT_MS,
  );
});

// ---- Property 15: the real Chapter 1 graphs ----

interface SpokenNode {
  readonly graphId: DialogueGraphId;
  readonly nodeId: string;
  readonly speakerId: SpeakerId;
  readonly tone: Tone;
  readonly channel: "phone" | "face-to-face";
  readonly url: string;
}

const P15_GRAPHS: readonly DialogueGraphId[] = [
  "dlg.alex",
  "dlg.recovery",
  "dlg.official-line",
  "dlg.intro",
  "dlg.aftermath",
];

/** Every non-player node of the call graphs plus the narration graphs. */
function collectSpokenNodes(): SpokenNode[] {
  const nodes: SpokenNode[] = [];
  for (const graphId of P15_GRAPHS) {
    const graph = CHAPTER_1_SCENARIO.dialogues[graphId];
    for (const node of Object.values(graph.nodes)) {
      if (node.speaker === "player") continue;
      nodes.push({
        graphId,
        nodeId: node.id,
        speakerId: node.speakerId ?? graph.persona.speakerId,
        tone: node.tone ?? "professional",
        channel: graph.channel,
        url: `${CHAPTER1_VOICE_BASE}/en/${graphId}.${node.id}.mp3`,
      });
    }
  }
  return nodes;
}

const P15_NODES = collectSpokenNodes();

function p15Target(n: SpokenNode, pauseBeforeMs: number): VoiceTarget {
  return {
    key: `${n.graphId}:${n.nodeId}`,
    graphId: n.graphId,
    nodeId: n.nodeId,
    speakerId: n.speakerId,
    tone: n.tone,
    channel: n.channel,
    lineText: `line ${n.nodeId}`,
    pauseBeforeMs,
  };
}

describe("voice playback over the Chapter 1 graphs", () => {
  // Feature: chapter-01-double-deception, Property 15: Voice playback never overlaps and always cleans up
  it(
    "never overlaps, stops on node change and hang-up, replays only the current node, mutes without stopping and disposes cleanly",
    async () => {
      expect(P15_NODES.some((n) => n.graphId === "dlg.alex")).toBe(true);
      expect(P15_NODES.some((n) => n.graphId === "dlg.recovery")).toBe(true);
      expect(P15_NODES.some((n) => n.graphId === "dlg.official-line")).toBe(true);
      expect(P15_NODES.some((n) => n.speakerId === "spk.narrator")).toBe(true);

      const base = (CORE_PROPERTY_SEED ^ 0x15f00d15) >>> 0;
      let totalStarts = 0;
      let totalMissing = 0;
      let totalMutes = 0;
      let totalReplays = 0;
      let totalHangUps = 0;

      for (let run = 0; run < CORE_PROPERTY_RUNS; run += 1) {
        const seed = caseSeed(base, run);
        const next = createLcg(seed);
        const withClip = new Set<string>(P15_NODES.filter(() => next() < 0.7).map((n) => n.url));
        const port = createFakeAudioPort({ autoLoad: true });
        for (const n of P15_NODES) port.setDuration(n.url, randomInt(next, 200, 3000));
        const clips: VoiceClipEntry[] = P15_NODES.filter((n) => withClip.has(n.url)).map((n) => ({
          clipId: `${n.graphId}.${n.nodeId}`,
          nodeId: n.nodeId,
          graphId: n.graphId,
          speakerId: n.speakerId,
          locale: "en",
          status: "present",
          sources: [{ src: n.url, type: "audio/mpeg" }],
          tone: n.tone,
          voiceNote: "test",
          origin: "tts-generated",
          credit: "test",
          sourceTextHash: "00000000",
        }));
        const player = createVoiceDialoguePlayer({
          manifest: { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips },
          port,
          preview: null,
          now: port.clock.now,
          setTimer: port.clock.setTimer,
          clearTimer: port.clock.clearTimer,
          log: () => undefined,
        });
        player.configure({
          locale: "en",
          soundEnabled: true,
          masterVolume: 1,
          voiceVolume: 1,
          phoneFilter: true,
          englishVoiceFallback: false,
          devPreview: false,
        });

        const log: string[] = [];
        const check = (condition: boolean, message: string): void => {
          if (condition) return;
          throw new Error(
            `seed=${seed} case=${run} failed after ${log.length} commands: ${message}\ncommands:\n${log
              .map((c, i) => `  ${i + 1}. ${c}`)
              .join("\n")}`,
          );
        };
        const settle = async (): Promise<void> => {
          await flush();
          port.clock.advance(700);
          await flush();
        };

        let current: SpokenNode | null = null;
        let active = false; // a line was shown or replayed and has neither been stopped nor ended
        let muted = false;
        const steps = randomInt(next, 8, 40);

        for (let step = 0; step < steps; step += 1) {
          const roll = next();
          const startsBefore = port.playbacks.length;
          if (roll < 0.35) {
            const n = pick(next, P15_NODES);
            log.push(`show(${n.graphId}:${n.nodeId}, clip=${withClip.has(n.url)})`);
            player.show(p15Target(n, next() < 0.4 ? 0 : randomInt(next, 0, 600)));
            current = n;
            active = true;
            check(port.liveHandles === 0, "the previous clip was still live right after a node change");
          } else if (roll < 0.5) {
            log.push("hang-up");
            player.stop("hang-up");
            active = false;
            totalHangUps += 1;
            check(port.liveHandles === 0, "a clip was live right after hang-up");
            check(port.timers === 0, "a timer was pending right after hang-up");
            check(player.getSnapshot().phase === "idle", "phase is not idle right after hang-up");
          } else if (roll < 0.65) {
            log.push("replay");
            player.replay();
            totalReplays += 1;
            if (current) {
              active = true;
              muted = false;
              check(player.getSnapshot().targetKey === `${current.graphId}:${current.nodeId}`, "replay targets another node");
            }
            check(port.liveHandles === 0, "the previous clip was still live right after replay");
          } else if (roll < 0.8) {
            const m = next() < 0.5;
            log.push(`setMuted(${m})`);
            const live = port.liveHandles;
            const phase = player.getSnapshot().phase;
            player.setMuted(m);
            muted = m;
            totalMutes += 1;
            check(port.liveHandles === live, "mute changed the number of live clips");
            check(player.getSnapshot().phase === phase, "mute changed the playback phase");
            check(player.getSnapshot().muted === m, "snapshot muted flag is wrong");
            const lastLive = port.playbacks.filter((p) => p.live);
            for (const p of lastLive) check(p.gain === (m ? 0 : 1), `gain is ${p.gain} after setMuted(${m})`);
          } else if (roll < 0.9) {
            const live = port.playbacks.filter((p) => p.live);
            log.push(live.length > 0 ? `fireEnded(${live[0].id})` : "fireEnded(none)");
            if (live.length > 0) {
              port.fireEnded(live[0].id);
              active = false;
            }
          } else {
            log.push("settle");
          }

          if (next() < 0.75 || roll >= 0.9) {
            await settle();
            const snap = player.getSnapshot();
            if (active && current) {
              const key = `${current.graphId}:${current.nodeId}`;
              check(snap.targetKey === key, `snapshot targets ${snap.targetKey}, expected ${key}`);
              if (withClip.has(current.url)) {
                const last = port.last();
                check(snap.phase === "playing", `phase is ${snap.phase}, expected playing`);
                check(port.liveHandles === 1, `${port.liveHandles} live clips, expected 1`);
                check(last?.clip.id === current.url, `playing ${last?.clip.id}, expected ${current.url}`);
                check(last?.gain === (muted ? 0 : 1), "playing gain does not match the mute state");
                check(snap.audible === !muted, "audible flag does not match the mute state");
              } else {
                check(snap.phase === "unavailable" && snap.reason === "missing", `missing clip gave ${snap.phase}/${snap.reason}`);
                check(!snap.audible && port.liveHandles === 0, "audio exists for a missing clip");
                check(port.playbacks.length === startsBefore, "a missing clip started playback");
                totalMissing += 1;
              }
            }
          }
          check(port.liveHandles <= 1, `${port.liveHandles} live clips at once`);
          check(port.maxConcurrentPlaybacks <= 1, `maxConcurrentPlaybacks=${port.maxConcurrentPlaybacks}`);
          check(port.concurrencyLog.every((c) => c <= 1), "concurrency log exceeds 1");
        }

        totalStarts += port.playbacks.length;
        // Replay restarts exactly the current node: every started clip belongs to a node that was shown.
        player.dispose();
        check(port.liveHandles === 0, "a clip is live after dispose");
        check(port.timers === 0, "a timer is pending after dispose");
        check(port.listeners === 0, "a listener is attached after dispose");
        check(port.disposed, "the port was not disposed");
        const started = port.playbacks.length;
        player.show(p15Target(pick(next, P15_NODES), 0));
        await settle();
        check(port.playbacks.length === started, "a clip started after dispose");
      }

      expect(totalStarts).toBeGreaterThan(200);
      expect(totalMissing).toBeGreaterThan(20);
      expect(totalMutes).toBeGreaterThan(100);
      expect(totalReplays).toBeGreaterThan(50);
      expect(totalHangUps).toBeGreaterThan(50);
    },
    PROPERTY_TIMEOUT_MS,
  );

  // Feature: chapter-01-double-deception, Property 15: Voice playback never overlaps and always cleans up
  it("replay starts a new clip of the current node only and one new playback per replay", async () => {
    const node = P15_NODES.find((n) => n.graphId === "dlg.official-line");
    if (!node) throw new Error("dlg.official-line has no spoken node");
    const other = P15_NODES.find((n) => n.graphId === "dlg.alex");
    if (!other) throw new Error("dlg.alex has no spoken node");
    const port = createFakeAudioPort({ autoLoad: true });
    const clips: VoiceClipEntry[] = [node, other].map((n) => ({
      clipId: `${n.graphId}.${n.nodeId}`,
      nodeId: n.nodeId,
      graphId: n.graphId,
      speakerId: n.speakerId,
      locale: "en",
      status: "present",
      sources: [{ src: n.url, type: "audio/mpeg" }],
      tone: n.tone,
      voiceNote: "test",
      origin: "tts-generated",
      credit: "test",
      sourceTextHash: "00000000",
    }));
    const player = createVoiceDialoguePlayer({
      manifest: { schemaVersion: VOICE_MANIFEST_SCHEMA_VERSION, chapterId: "chapter-1", clips },
      port,
      preview: null,
      now: port.clock.now,
      setTimer: port.clock.setTimer,
      clearTimer: port.clock.clearTimer,
      log: () => undefined,
    });
    player.show(p15Target(other, 0));
    port.clock.advance(0);
    await flush();
    player.show(p15Target(node, 0));
    port.clock.advance(0);
    await flush();
    player.replay();
    port.clock.advance(0);
    await flush();
    expect(port.playbacks.map((p) => p.clip.id)).toEqual([other.url, node.url, node.url]);
    expect(port.maxConcurrentPlaybacks).toBe(1);
    player.dispose();
  });
});
