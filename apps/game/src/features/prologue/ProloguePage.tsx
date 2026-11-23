import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import { voiceGain } from "../../game/voice/mixPlan";
import { CharacterAssetCache } from "../player/runtime/CharacterAssetCache";
import { ChapterIntroOverlay, type IntroControlId } from "../chapter1/intro/ChapterIntroOverlay";
import { KhuphoStoryWorld } from "../khupho/KhuphoStoryWorld";
import { BUILD_STEPS, type BuildStep, type Engine as StreetEngine, type Hud, type StoryEvent } from "../khupho/world/engine";
import type { Engine as RoomEngine, UIState as RoomUI } from "../roomv2/game/engine";
import type { RoomOptions } from "../roomv2/game/outside";
import { HomeCallOverlay } from "./HomeCallOverlay";
import { DialogueOverlay } from "./DialogueOverlay";
import { Minimap, NoSignalMinimap } from "./Minimap";
import { QUEST_LIST_KEY, QUEST_PATH_KEY, QuestListButton, QuestListPanel, QuestToast, QuestTracker, useDistance } from "./QuestHud";
import { advance, chooseOption, isEnded, startDialogue, type DialogueState } from "./quest/dialogue";
import { MAI_DIALOGUE, maiStart } from "./quest/maiDialogue";
import { MAI_VOICE_BASE } from "../../config/assetPaths";
import { completeQuest, initialQuestState, markSeen, questDefinition, startQuest, STREET_END_RADIUS, trackQuest, type QuestId } from "./quest/quests";
import type { MapData } from "../khupho/world/questLayer";
import { PrologueHud, ProloguePauseMenu, PrologueTopBar } from "./PrologueHud";
import { SettingsModal } from "../menu/SettingsModal";
import type { ChapterSession } from "../../game/chapters/chapterSession";
import type { SaveGameSource } from "../../game/saves/saveGame";
import { RoomChapterLayer } from "../chapter1/room/RoomChapterLayer";
import { RoomStoryBridge } from "../chapter1/room/roomStoryBridge";
import { OutsideHud, useOutsideWorld } from "../chapter1/room/useOutsideWorld";

// The room is its own chunk, downloaded in the background while the player walks around.
const loadRoomModule = () => import("../roomv2");
const RoomV2Page = lazy(() => loadRoomModule().then((module) => ({ default: module.RoomV2Page })));

type Stage = "neighborhood" | "room";

/** Progress of building the neighborhood, shown on the chapter loading screen. */
export interface PrologueBuildProgress {
  /** 0..1 */
  fraction: number;
  step: BuildStep;
  done: boolean;
  error?: string;
}

interface ProloguePageProps {
  settings: GameSettings;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
  /** The main menu's hover blip, reused by the in-game menus. */
  onHoverSound?: () => void;
  onBackToMenu: () => void;
  /**
   * False while the chapter loading screen still covers the page: the world is built and
   * warmed up underneath, and nothing starts (no narration) until it is revealed.
   */
  revealed: boolean;
  onBuildProgress?: (progress: PrologueBuildProgress) => void;
  /**
   * The new-game session. When set, the room stage mounts the chapter layer (the intro starts the
   * chapter). Without it the room is the plain prologue room.
   */
  session?: ChapterSession;
  /** The story bridge passed to the room engine. Default: one created and kept by this page. */
  story?: RoomStoryBridge;
  /** Where the chapter layer writes checkpoints. Default: this device's local storage. */
  saveSource?: SaveGameSource;
}

/** Leaving the room by its door: the screen whites out (500 ms, see `onExitStart`) and clears again over this long in the hall. Entering has no white screen: the room plays its own entrance shot. */
const WHITE_OUT_MS = 700;
/** The room is built this long after the walk begins (and sooner when the player nears house no. 59). */
const ROOM_BUILD_DELAY_MS = 300;
/** If the room is still not ready this long after the player stepped in, the black cover is dropped and the doorway works again. */
const ROOM_WAIT_TIMEOUT_MS = 8000;

/** The neighborhood has no phone, journal or pause menu entry in the intro list yet. */
const PROLOGUE_CONTROLS: readonly IntroControlId[] = ["move", "look", "interact", "pause"];

/**
 * Chapter 1 prologue: explore the neighborhood until it gets dark and starts to rain, then walk
 * home to the apartment. This page owns the whole interface, in the chapter's style; the two
 * world pages only draw the 3D view.
 */
export const ProloguePage: React.FC<ProloguePageProps> = ({ settings, onUpdateSettings, onHoverSound, onBackToMenu, revealed, onBuildProgress, session, story, saveSource }) => {
  const { t, i18n } = useTranslation(["worlds", "loading"]);
  const [stage, setStage] = useState<Stage>("neighborhood");
  const [worldReady, setWorldReady] = useState(false);
  const [worldError, setWorldError] = useState<string | null>(null);
  const [started, setStarted] = useState(false);
  const [prompt, setPrompt] = useState<string | null>(null);
  const [streetHud, setStreetHud] = useState<Hud | null>(null);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [locked, setLocked] = useState(false);
  const [paused, setPaused] = useState(false);
  const [callOpen, setCallOpen] = useState(false);
  // Walk-around quests (the first one: meet Auntie Mai) and the conversation.
  const [quests, setQuests] = useState(initialQuestState);
  const [questListOpen, setQuestListOpen] = useState(false);
  const [dialogue, setDialogue] = useState<DialogueState | null>(null);
  const [toast, setToast] = useState<QuestId | null>(null);
  const [mapData, setMapData] = useState<MapData | null>(null);
  const [roomBuilt, setRoomBuilt] = useState(false);
  const [roomUI, setRoomUI] = useState<RoomUI | null>(null);
  /** The room is built in standby (no loop, shaders compiled) once the walk begins, and shown by its entrance shot (through the doorway of house no. 59 or by "go home"). */
  const [roomOptions, setRoomOptions] = useState<RoomOptions | null>(null);
  const [waitingRoom, setWaitingRoom] = useState(false);
  const [white, setWhite] = useState({ on: false, ms: WHITE_OUT_MS });
  // One bridge for the room engine and the chapter layer, stable for the life of the page.
  const ownBridge = useRef<RoomStoryBridge | null>(null);
  if (story === undefined && ownBridge.current === null) ownBridge.current = new RoomStoryBridge();
  const bridge = story ?? (ownBridge.current as RoomStoryBridge);
  const [roomCommands, setRoomCommands] = useState(false);
  const pendingEnter = useRef(false);
  const streetRef = useRef<StreetEngine | null>(null);
  const roomRef = useRef<RoomEngine | null>(null);
  const [roomEngine, setRoomEngine] = useState<RoomEngine | null>(null);
  const prefetchRef = useRef<Promise<void> | null>(null);
  const goneHome = useRef(false);
  const progressRef = useRef(onBuildProgress);
  progressRef.current = onBuildProgress;
  const soundRef = useRef(settings.soundEnabled);
  soundRef.current = settings.soundEnabled;

  // The chapter happens in the apartment; checkpoints name that scene.
  const layerSession = useMemo<ChapterSession>(() => ({ ...(session as ChapterSession), sceneId: "apartment" }), [session]);

  // A room that never builds must not strand the player on black: give up and let them step in again.
  useEffect(() => {
    if (!waitingRoom) return undefined;
    const timer = window.setTimeout(() => {
      pendingEnter.current = false;
      goneHome.current = false;
      streetRef.current?.setInputBlocked(false);
      setWaitingRoom(false);
    }, ROOM_WAIT_TIMEOUT_MS);
    return () => window.clearTimeout(timer);
  }, [waitingRoom]);

  // Pointer lock state, for the "click to resume" hint.
  useEffect(() => {
    const onChange = () => setLocked(document.pointerLockElement !== null);
    document.addEventListener("pointerlockchange", onChange);
    return () => document.removeEventListener("pointerlockchange", onChange);
  }, []);

  /** Downloads the room code and the first-person hands (idempotent). */
  const prefetchRoom = useCallback(() => {
    if (!prefetchRef.current) {
      prefetchRef.current = Promise.all([
        loadRoomModule(),
        CharacterAssetCache.loadArmsModel(),
      ])
        .then(() => undefined)
        // A failed prefetch is not fatal: the room asks for the same files again when it opens.
        .catch(() => undefined);
    }
    return prefetchRef.current;
  }, []);

  /** Builds the room in standby (idempotent): everything is compiled before the player needs it. */
  const mountRoom = useCallback(() => {
    setRoomOptions((current) => current ?? {
      standby: true,
      onExitStart: () => setWhite({ on: true, ms: 500 }),
      onExit: () => leaveRoomRef.current(),
    });
    void prefetchRoom();
  }, [prefetchRoom]);

  /** Swap the street for the room, which opens with its entrance shot (the room fades up from its own dark frame). False while the room is still being built. */
  const showRoom = useCallback(() => {
    const street = streetRef.current;
    const room = roomRef.current;
    if (!street || !room) return false;
    pendingEnter.current = false;
    setWaitingRoom(false);
    street.suspend();
    room.audio.setMuted(!soundRef.current);
    room.activate({ entrance: true });
    setStage("room");
    return true;
  }, []);
  const showRoomRef = useRef(showRoom);
  showRoomRef.current = showRoom;

  /** Into the room: through the white doorway of house no. 59, or by "go home" (the call, the H key). */
  const goHome = useCallback(() => {
    if (goneHome.current) return;
    goneHome.current = true;
    if (document.pointerLockElement) document.exitPointerLock();
    streetRef.current?.setInputBlocked(true);
    setCallOpen(false);
    setPaused(false);
    mountRoom();
    if (showRoomRef.current()) return;
    // Before the room was built: a plain black cover hides the street until the room reports ready.
    pendingEnter.current = true;
    setWaitingRoom(true);
  }, [mountRoom]);

  /** Out of the room by its door: the player stands in the hall outside it, the screen clears from white. */
  const leaveRoom = useCallback(() => {
    const street = streetRef.current;
    roomRef.current?.deactivate();
    setStage("neighborhood");
    setRoomUI(null);
    street?.placeAtHome();
    street?.setInputBlocked(false);
    street?.resume();
    street?.audio.setMuted(!soundRef.current);
    goneHome.current = false;
    window.setTimeout(() => street?.lock(), 150);
    window.setTimeout(() => setWhite({ on: false, ms: WHITE_OUT_MS }), 120);
  }, []);
  const leaveRoomRef = useRef(leaveRoom);
  leaveRoomRef.current = leaveRoom;

  const handleStory = useCallback((event: StoryEvent) => {
    if (event !== "callHome") return;
    setConversation(null);
    setQuestListOpen(false);
    streetRef.current?.setInputBlocked(true);
    // The call has buttons, so the pointer must be free.
    if (document.pointerLockElement) document.exitPointerLock();
    setCallOpen(true);
  }, []);

  const handleHud = useCallback((hud: Hud) => {
    setPrompt(hud.prompt);
    setStreetHud(hud);
  }, []);

  // The sound setting mutes both worlds' own audio (they do not read the settings themselves).
  const soundOn = settings.soundEnabled;
  // The street stays silent while the player is in the room: the room is often built after the
  // player went home (the room's `onReady` shows it at once), and this effect then runs again.
  const inRoom = stage === "room";
  // Story mode: the Saigon open world around the room (live through the window and the door, walkable with no cut).
  const outside = useOutsideWorld(roomEngine, !!session && inRoom);
  useEffect(() => {
    streetRef.current?.audio.setMuted(!soundOn || inRoom);
    roomRef.current?.audio.setMuted(!soundOn);
  }, [soundOn, worldReady, roomBuilt, inRoom]);
  const toggleSound = useCallback(() => onUpdateSettings({ soundEnabled: !soundOn }), [onUpdateSettings, soundOn]);

  const beginWalk = useCallback(() => {
    const engine = streetRef.current;
    if (!engine) return;
    engine.begin(true);
    setStarted(true);
    void prefetchRoom();
  }, [prefetchRoom]);

  // The room is built a moment after the walk begins, so opening its door finds it ready.
  useEffect(() => {
    if (!started) return;
    const timer = window.setTimeout(mountRoom, ROOM_BUILD_DELAY_MS);
    return () => window.clearTimeout(timer);
  }, [started, mountRoom]);

  /** The rain narration is over: the player is back in the street and the way home becomes the next quest. */
  const finishCall = useCallback(() => {
    setCallOpen(false);
    streetRef.current?.setInputBlocked(false);
    streetRef.current?.lock();
    setQuests((q) => startQuest(q, "goHome"));
  }, []);

  /** Frees the pointer and stops world input while a quest overlay is open, and takes it back after. */
  const holdWorld = useCallback((hold: boolean) => {
    const street = streetRef.current;
    if (!street) return;
    street.setInputBlocked(hold);
    if (hold) {
      if (document.pointerLockElement) document.exitPointerLock();
    } else {
      street.lock();
    }
  }, []);

  // The conversation lives in a ref as well, so a key press reads the latest state without waiting for a render.
  const dialogueRef = useRef<DialogueState | null>(null);
  const setConversation = useCallback((next: DialogueState | null) => {
    dialogueRef.current = next;
    setDialogue(next);
  }, []);
  const metMai = quests.status.meetMai === "done";

  /** E on Auntie Mai: starts the conversation. */
  const handleTalk = useCallback((npc: string) => {
    if (npc !== "mai" || dialogueRef.current) return;
    streetRef.current?.hidePath();
    setConversation(startDialogue(MAI_DIALOGUE, maiStart(metMai)));
    mountRoom();
    holdWorld(true);
  }, [holdWorld, metMai, mountRoom, setConversation]);

  /** The conversation is over. Finishing it (not leaving early) completes the quest. */
  const finishDialogue = useCallback((completed: boolean) => {
    setConversation(null);
    holdWorld(false);
    if (!completed) return;
    setQuests((q) => startQuest(completeQuest(q, "meetMai"), "walkStreet"));
    setToast("meetMai");
  }, [holdWorld, setConversation]);

  const chooseReply = useCallback((optionId: string) => {
    const current = dialogueRef.current;
    if (!current) return;
    const next = chooseOption(MAI_DIALOGUE, current, optionId);
    if (isEnded(next)) finishDialogue(true);
    else setConversation(next);
  }, [finishDialogue, setConversation]);

  const advanceLine = useCallback(() => {
    const current = dialogueRef.current;
    if (!current) return;
    const next = advance(MAI_DIALOGUE, current);
    if (isEnded(next)) finishDialogue(true);
    else setConversation(next);
  }, [finishDialogue, setConversation]);

  const closeListPanel = useCallback(() => {
    setQuestListOpen(false);
    holdWorld(false);
  }, [holdWorld]);

  const openListPanel = useCallback(() => {
    setQuests(markSeen);
    setQuestListOpen(true);
    holdWorld(true);
  }, [holdWorld]);

  /** Lights the guide trail to the tracked quest's person. */
  const showQuestPath = useCallback((id?: QuestId) => {
    const target = id ?? quests.tracked;
    if (!target) return;
    setQuests((q) => trackQuest(q, target));
    streetRef.current?.showPathTo(questDefinition(target).target);
  }, [quests.tracked]);

  const openPause = useCallback(() => {
    if (stage === "room") roomRef.current?.setCursorMode(false);
    setPaused(true);
    streetRef.current?.setPaused(true);
    if (document.pointerLockElement) document.exitPointerLock();
  }, [stage]);

  const resume = useCallback(() => {
    setSettingsOpen(false);
    setPaused(false);
    if (stage === "neighborhood") {
      streetRef.current?.setPaused(false);
      streetRef.current?.lock();
    } else {
      roomRef.current?.lock();
    }
  }, [stage]);

  const questOverlay = dialogue !== null || questListOpen;
  const playingStreet = stage === "neighborhood" && started && !callOpen && !questOverlay;
  const playingRoom = stage === "room" && roomBuilt && !!roomUI?.started && !roomUI.ended;

  // Escape opens and closes the pause menu; H heads home.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat) return;
      if (event.key === "Escape") {
        if (settingsOpen) return; // the settings dialog closes itself
        if (questListOpen) {
          event.preventDefault();
          closeListPanel();
          return;
        }
        if (dialogueRef.current) return; // the conversation closes itself
        // The chapter layer (intro, phone, laptop, journal, call, decision) owns Escape while it is open.
        if (bridge.overlayOpen()) return;
        if (paused) {
          event.preventDefault();
          resume();
        } else if (playingStreet || playingRoom) {
          event.preventDefault();
          openPause();
        }
        return;
      }
      const questKeys = stage === "neighborhood" && started && !callOpen && !paused && !settingsOpen && dialogueRef.current === null && !event.ctrlKey && !event.metaKey;
      if (questKeys && event.code === `Key${QUEST_LIST_KEY}`) {
        event.preventDefault();
        if (questListOpen) closeListPanel();
        else openListPanel();
        return;
      }
      if (questKeys && !questListOpen && event.code === `Key${QUEST_PATH_KEY}`) {
        event.preventDefault();
        showQuestPath();
        return;
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bridge, paused, settingsOpen, playingStreet, playingRoom, resume, openPause, stage, started, callOpen, questListOpen, closeListPanel, openListPanel, showQuestPath]);

  const handleProgress = useCallback((step: BuildStep, fraction: number) => {
    const index = BUILD_STEPS.indexOf(step);
    progressRef.current?.({ fraction: Math.min(0.99, (index + fraction) / BUILD_STEPS.length), step, done: false });
  }, []);

  const handleReady = useCallback((engine: StreetEngine) => {
    streetRef.current = engine;
    setMapData(engine.getMapData());
    setWorldReady(true);
    progressRef.current?.({ fraction: 1, step: "warmup", done: true });
  }, []);

  const handleError = useCallback((message: string) => {
    setWorldError(message);
    progressRef.current?.({ fraction: 1, step: "warmup", done: true, error: message });
  }, []);

  const locale = i18n.language === "vi" ? "vi" : "en";
  // Narration must stay clear over the rain: a 1.6x boost (capped at full volume) while the world is ducked below.
  const gain = Math.min(1, 1.6 * voiceGain({ soundEnabled: settings.soundEnabled, masterVolume: settings.sfxVolume, voiceVolume: settings.voiceVolume }, false));
  // Auntie Mai's voice: one clip per line, stopped when the line changes or the conversation ends.
  const maiNode = dialogue?.node ?? null;
  useEffect(() => {
    if (maiNode === null || gain <= 0) return undefined;
    const clip = new Audio(`${MAI_VOICE_BASE}.${locale}/mai.${maiNode}.mp3`);
    clip.volume = gain;
    clip.play().catch(() => undefined); // a blocked or missing clip leaves the text only
    return () => {
      clip.pause();
      clip.src = "";
    };
  }, [maiNode, locale, gain]);
  // The street sound also drops while Auntie Mai talks, so her voice stays on top.
  const narrating = stage === "neighborhood" && revealed && worldReady && (!started || callOpen || dialogue !== null);
  useEffect(() => {
    streetRef.current?.audio.setDuck(narrating);
  }, [narrating, worldReady]);

  // Auntie Mai's icon: the quest mark while the quest is open, emphasized while talking.
  const maiOpen = quests.status.meetMai === "active";
  useEffect(() => {
    const street = streetRef.current;
    if (!street || !started) return;
    street.setNpcMarker("mai", dialogue ? "active" : maiOpen ? "quest" : null);
  }, [dialogue, maiOpen, started, worldReady]);
  // The "quest complete" notice stays a few seconds.
  useEffect(() => {
    if (!toast) return;
    const timer = window.setTimeout(() => setToast(null), 4200);
    return () => window.clearTimeout(timer);
  }, [toast]);
  // A new quest: its tracker pops up with a "new quest" label and the guide trail lights at once (hiding it
  // after a while is automatic; the player lights it again with Q or by pressing the quest).
  const [fresh, setFresh] = useState<QuestId | null>(null);
  const announced = useRef<QuestId | null>("meetMai");
  useEffect(() => {
    const id = quests.tracked;
    if (!id || announced.current === id || quests.status[id] !== "active") return;
    announced.current = id;
    setFresh(id);
    const timer = window.setTimeout(() => showQuestPath(id), 500);
    return () => window.clearTimeout(timer);
  }, [quests, showQuestPath]);
  useEffect(() => {
    if (!fresh || toast) return undefined;
    const timer = window.setTimeout(() => setFresh(null), 6000);
    return () => window.clearTimeout(timer);
  }, [fresh, toast]);
  const trackedTarget = quests.tracked ? questDefinition(quests.tracked).target : null;
  const distance = useDistance(() => {
    const street = streetRef.current;
    const pose = street?.getPlayerPose();
    const at = trackedTarget && street ? street.targetPosition(trackedTarget) : null;
    return pose && at ? Math.hypot(at.x - pose.x, at.z - pose.z) : null;
  }, stage === "neighborhood" && started && trackedTarget !== null);
  const getPose = useCallback(() => streetRef.current?.getPlayerPose() ?? null, []);
  const getTarget = useCallback(() => (trackedTarget ? streetRef.current?.targetPosition(trackedTarget) ?? null : null), [trackedTarget]);

  // Story pacing: the clock crawls while Auntie Mai talks (and no story beat fires), and the rain waits until
  // the player has walked the street.
  const walkDone = quests.status.walkStreet === "done";
  useEffect(() => {
    streetRef.current?.setStoryPacing(dialogue !== null, !walkDone);
  }, [dialogue, walkDone, worldReady]);

  // Reaching the end of the street, and stepping into house no. 59, finish their quests.
  const walkActive = quests.status.walkStreet === "active";
  const homeActive = quests.status.goHome === "active";
  useEffect(() => {
    if (stage !== "neighborhood" || !started || callOpen || (!walkActive && !homeActive)) return undefined;
    const timer = window.setInterval(() => {
      const street = streetRef.current;
      const pose = street?.getPlayerPose();
      if (!street || !pose) return;
      if (walkActive) {
        const at = street.targetPosition("streetEnd");
        if (!at || Math.hypot(at.x - pose.x, at.z - pose.z) > STREET_END_RADIUS) return;
        setQuests((q) => completeQuest(q, "walkStreet"));
        setToast("walkStreet");
        street.hidePath();
      } else if (street.insideHome()) {
        setQuests((q) => startQuest(completeQuest(q, "goHome"), "goUp"));
        setToast("goHome");
        street.hidePath();
      }
    }, 300);
    return () => window.clearInterval(timer);
  }, [stage, started, callOpen, walkActive, homeActive]);

  const streetCursor = !!streetHud?.cursorMode;
  const roomCursor = !!roomUI?.cursorMode;
  const showResume =
    !paused &&
    ((playingStreet && !locked && !streetCursor) || (playingRoom && !roomUI?.locked && !roomCursor && !roomUI?.inspecting));
  const clock = streetHud
    ? { time: streetHud.time, detail: [streetHud.weather, streetHud.loc].filter(Boolean).join(" · "), raining: streetHud.rain > 0.3 }
    : null;
  const inGame = (stage === "neighborhood" && revealed && worldReady && started) || (stage === "room" && roomBuilt);

  return (
    <div className="absolute inset-0 bg-black">
      {/* The street stays mounted (stopped while the player is in the room), so coming back needs no rebuild. */}
      <KhuphoStoryWorld
        settings={settings}
        onProgress={handleProgress}
        onReady={handleReady}
        onHud={handleHud}
        onStory={handleStory}
        onError={handleError}
        onNearHome={mountRoom}
        onEnterHome={goHome}
        onTalk={handleTalk}
      />
      {stage === "neighborhood" && (
        <>
          {revealed && worldReady && !started && (
            <ChapterIntroOverlay
              ready
              mode="begin"
              voiceGain={gain}
              onBegin={beginWalk}
              controlIds={PROLOGUE_CONTROLS}
            />
          )}
          {revealed && worldReady && started && !callOpen && !paused && !dialogue && (
            <PrologueHud
              objective={null}
              prompt={prompt}
              showResume={showResume}
              cursorMode={streetCursor}
              clock={clock}
              questKeys
              minimap={
                <div className="relative shrink-0">
                  <Minimap getPose={getPose} getTarget={getTarget} map={mapData} label={t("worlds:quests.minimap")} north={t("worlds:quests.north")} />
                  <QuestListButton state={quests} onOpen={openListPanel} onHoverSound={onHoverSound} className="absolute -bottom-7 -left-10" />
                </div>
              }
              questArea={
                toast ? (
                  <QuestToast questId={toast} />
                ) : quests.tracked ? (
                  <QuestTracker questId={quests.tracked} distance={distance} fresh={fresh === quests.tracked} onShowPath={() => showQuestPath()} onHoverSound={onHoverSound} />
                ) : null
              }
            />
          )}
          {dialogue && (
            <DialogueOverlay
              graph={MAI_DIALOGUE}
              state={dialogue}
              speaker={t("worlds:quests.dialogue.speakerMai")}
              onChoose={chooseReply}
              onAdvance={advanceLine}
              onClose={() => finishDialogue(false)}
              onHoverSound={onHoverSound}
            />
          )}
          {questListOpen && !callOpen && (
            <QuestListPanel
              state={quests}
              onClose={closeListPanel}
              onShowPath={(id) => {
                closeListPanel();
                showQuestPath(id);
              }}
              onHoverSound={onHoverSound}
            />
          )}
          {callOpen && <HomeCallOverlay locale={locale} voiceGain={gain} onDone={finishCall} />}
          {revealed && worldError && (
            <div role="alert" className="absolute inset-0 z-[70] grid place-items-center bg-[#171521] p-8 text-center text-[#f7f5ff]">
              <div className="max-w-md space-y-4">
                <p>{t("worlds:khupho.game.story.worldError")}</p>
                <button type="button" onClick={onBackToMenu} className="rounded-xl border border-[#38344f] px-4 py-2 text-sm hover:border-[#7654d6]">
                  {t("worlds:khupho.game.story.returnToMenu")}
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {roomOptions && (
        // Built in standby and kept: hidden, not removed, so it keeps its size and its compiled shaders.
        <div className={`absolute inset-0 z-30 ${stage === "room" ? "" : "invisible pointer-events-none"}`}>
          <Suspense fallback={null}>
            <RoomV2Page
              settings={settings}
              onBackToMenu={onBackToMenu}
              embedded
              options={roomOptions}
              story={session ? bridge : undefined}
              overlay={
                session && stage === "room" && !!roomUI?.started ? (
                  <RoomChapterLayer
                    session={layerSession}
                    settings={settings}
                    bridge={bridge}
                    saveSource={saveSource}
                    engineReady={roomCommands}
                    onReturnToMenu={onBackToMenu}
                    onHoverSound={onHoverSound}
                    onOpenSettings={openPause}
                    outsideDoor={outside.ready}
                  />
                ) : undefined
              }
              onUI={setRoomUI}
              onReady={(engine) => {
                roomRef.current = engine;
                setRoomEngine(engine);
                if (session) bridge.commands = engine;
                setRoomCommands(true);
                setRoomBuilt(true);
                if (pendingEnter.current) showRoomRef.current();
              }}
            />
          </Suspense>
        </div>
      )}
      {stage === "room" && playingRoom && !paused && <OutsideHud state={outside} />}
      {stage === "room" && playingRoom && !paused && <PrologueHud objective={null} prompt={null} showResume={showResume} cursorMode={roomCursor} crosshair={false} minimap={session ? undefined : <NoSignalMinimap label={t("worlds:quests.noSignal")} />} />}

      {inGame && !callOpen && !paused && !(session && stage === "room") && (
        <PrologueTopBar soundEnabled={soundOn} onToggleSound={toggleSound} onOpenSettings={openPause} onHoverSound={onHoverSound} />
      )}

      {paused && !settingsOpen && <ProloguePauseMenu note={session && stage === "room" ? null : undefined} onHoverSound={onHoverSound} onResume={resume} onOpenSettings={() => setSettingsOpen(true)} onReturnToMenu={onBackToMenu} />}
      <SettingsModal isOpen={settingsOpen} onClose={() => setSettingsOpen(false)} settings={settings} onUpdateSettings={onUpdateSettings} />

      <div aria-hidden="true" data-testid="prologue-white-out" className="pointer-events-none absolute inset-0 z-[72] bg-white" style={{ opacity: white.on ? 1 : 0, transition: `opacity ${white.ms}ms ease` }} />

      {waitingRoom && <div data-testid="prologue-room-wait" aria-hidden="true" className="pointer-events-none absolute inset-0 z-[70] bg-black" />}
    </div>
  );
};
