/**
 * RoomChapterPage: the Chapter 1 page for saved games and `?skip-prologue` (task 12.4).
 * See .kiro/specs/chapter-01-double-deception/design.md, "Flow", and Requirements 1.1, 1.2, 1.3,
 * 1.5, 1.6, 17.6 and 17.7.
 *
 * It embeds `RoomV2Page` (no standby: the room starts at once) with a stable `RoomStoryBridge`
 * and mounts the same `RoomChapterLayer` that the prologue mounts after the walk home. The layer
 * owns the store, the HUD, the overlays and the checkpoint saver; a session restored by the
 * loader (`session.restored`) is replayed by the layer's store. This page adds the host pause menu
 * (Escape, settings, return to menu), which it skips while a chapter overlay is open.
 */
import React, { lazy, Suspense, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useTranslation } from "react-i18next";
import type { GameSettings } from "@scammaze/shared-types";
import type { ChapterSession } from "../../../game/chapters/chapterSession";
import type { SaveGameSource } from "../../../game/saves/saveGame";
import { SettingsModal } from "../../menu/SettingsModal";
import { NoSignalMinimap } from "../../prologue/Minimap";
import { PrologueHud, ProloguePauseMenu } from "../../prologue/PrologueHud";
import type { Engine as RoomEngine, UIState as RoomUI } from "../../roomv2/game/engine";
import { AnchoredPrompt } from "../hud/AnchoredPrompt";
import { RoomChapterLayer } from "./RoomChapterLayer";
import { RoomStoryBridge } from "./roomStoryBridge";

const RoomV2Page = lazy(() => import("../../roomv2").then((module) => ({ default: module.RoomV2Page })));

export interface RoomChapterPageProps {
  session: ChapterSession;
  settings: GameSettings;
  onUpdateSettings: (updates: Partial<GameSettings>) => void;
  /** The main menu's hover blip, reused by the pause menu. */
  onHoverSound?: () => void;
  onReturnToMenu: () => void;
  /** Where checkpoints are written. Defaults to this device's local storage (the layer's default). */
  saveSource?: SaveGameSource;
}

export const RoomChapterPage: React.FC<RoomChapterPageProps> = ({
  session,
  settings,
  onUpdateSettings,
  onHoverSound,
  onReturnToMenu,
  saveSource,
}) => {
  const { t } = useTranslation("worlds");
  // One bridge per page, created once, so the engine and the layer always share the same port.
  const [bridge] = useState(() => new RoomStoryBridge());
  const [engineReady, setEngineReady] = useState(false);
  const [roomUI, setRoomUI] = useState<RoomUI | null>(null);
  const [paused, setPaused] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const engineRef = useRef<RoomEngine | null>(null);

  // The chapter happens in the apartment, whatever scene a new or old session names.
  const layerSession = useMemo<ChapterSession>(() => ({ ...session, sceneId: "apartment" }), [session]);

  useEffect(() => {
    return () => {
      bridge.commands = null;
    };
  }, [bridge]);

  const handleReady = useCallback(
    (engine: RoomEngine) => {
      engineRef.current = engine;
      bridge.commands = engine;
      setEngineReady(true);
    },
    [bridge],
  );

  const soundOn = settings.soundEnabled;
  useEffect(() => {
    engineRef.current?.audio.setMuted(!soundOn);
  }, [soundOn, engineReady]);

  const playing = engineReady && !!roomUI?.started && !roomUI.ended;

  const openPause = useCallback(() => {
    engineRef.current?.setCursorMode(false);
    if (document.pointerLockElement) document.exitPointerLock();
    setPaused(true);
  }, []);

  const resume = useCallback(() => {
    setSettingsOpen(false);
    setPaused(false);
    engineRef.current?.lock();
  }, []);

  // Escape opens and closes the host pause menu, unless a chapter overlay (or the intro) is open:
  // then the layer owns the key.
  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.repeat || event.key !== "Escape") return;
      if (settingsOpen || bridge.overlayOpen()) return;
      if (paused) {
        event.preventDefault();
        resume();
      } else if (playing) {
        event.preventDefault();
        openPause();
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [bridge, openPause, paused, playing, resume, settingsOpen]);

  const cursorMode = !!roomUI?.cursorMode;
  const showResume = playing && !paused && !roomUI?.locked && !cursorMode && !roomUI?.inspecting;

  return (
    <div className="absolute inset-0 bg-black" data-testid="room-chapter-page">
      <Suspense fallback={<div className="h-full w-full bg-black" aria-busy="true" />}>
        <RoomV2Page
          settings={settings}
          onBackToMenu={onReturnToMenu}
          embedded
          story={bridge}
          onUI={setRoomUI}
          renderPrompt={(label, anchor) => <AnchoredPrompt label={label} anchor={anchor} />}
          onReady={handleReady}
          overlay={
            <RoomChapterLayer
              session={layerSession}
              settings={settings}
              bridge={bridge}
              saveSource={saveSource}
              engineReady={engineReady}
              onReturnToMenu={onReturnToMenu}
              onHoverSound={onHoverSound}
            />
          }
        />
      </Suspense>

      {playing && !paused && (
        <PrologueHud objective={null} prompt={null} showResume={showResume} cursorMode={cursorMode} crosshair={false} minimap={<NoSignalMinimap label={t("quests.noSignal")} />} />
      )}

      {paused && !settingsOpen && (
        <ProloguePauseMenu
          onHoverSound={onHoverSound}
          onResume={resume}
          onOpenSettings={() => setSettingsOpen(true)}
          onReturnToMenu={onReturnToMenu}
          note={null}
        />
      )}
      <SettingsModal
        isOpen={settingsOpen}
        onClose={() => setSettingsOpen(false)}
        settings={settings}
        onUpdateSettings={onUpdateSettings}
      />
    </div>
  );
};
