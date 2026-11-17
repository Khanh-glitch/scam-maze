// The call UI of the room chapter (task 10.2). Mounts the unchanged `CallPresentation` with the
// voice hooks and the per-call Speaker toggle (the Notes chip lives in the HUD chip row of
// `RoomChapterLayer`). Presentation only: the only
// writes are the three dispatches the call UI already needs (ANSWER_CALL, END_CALL,
// SELECT_DIALOGUE_OPTION). Voice and audio never change story state.
//
// While a call rings or is active the room engine's phone mode and ring come from
// `roomPresentation`; this component draws the caller info and controls (the phone screen) and,
// outside the phone, the caller subtitle and the player's replies.
import React, { useCallback, useEffect, useMemo, useState } from "react";
import type { GameSettings } from "@scammaze/shared-types";
import type { ChapterStore } from "../../../game/narrative/store";
import type { ScenarioDefinition } from "../../../game/narrative/types";
import type { WebAudioEngine } from "../../../game/voice/webAudioEngine";
import { CallPresentation } from "../call/CallPresentation";
import { createPhoneScreenSink, type PhoneScreenSink } from "../call/phoneScreenSink";
import { useChapterState } from "../useChapterState";
import { useCallAudio } from "../voice/useCallAudio";
import { useCallDuration } from "../voice/useCallDuration";
import { useVoicePlayback, type VoicePlaybackDeps } from "../voice/useVoicePlayback";

export interface RoomCallLayerProps {
  store: ChapterStore;
  /** Display scenario for the current language. */
  scenario: ScenarioDefinition;
  settings: GameSettings;
  /** True while an overlay (the journal) is on top: voice pauses and the call controls are disabled. */
  paused: boolean;
  /** The 3D phone model may show the screen (task 10.4). Default false: the 2D screen is used. */
  modelAllowed?: boolean;
  /** Shared with the 3D phone layer when there is one. Default: a private sink. */
  screenSink?: PhoneScreenSink;
  /** Shared Web Audio engine for the call sounds, or null (tests, no audio support). */
  engine: WebAudioEngine | null;
  voiceDeps?: VoicePlaybackDeps;
  /** Plays the hover sound when the reply highlight moves. */
  onHoverSound?: () => void;
}

/**
 * The call sounds of the room: the connect click and the tension drone. The ringtone and the
 * ambience belong to the room engine (it rings with `RoomStoryCommands.ring` and has its own
 * ambience), so they are left out here to avoid a doubled sound.
 */
export function roomCallSounds(engine: WebAudioEngine | null): WebAudioEngine | null {
  if (engine === null) return null;
  return {
    get supported() {
      return engine.supported;
    },
    resume: () => engine.resume(),
    load: (url) => engine.load(url),
    start: (clip, options) => engine.start(clip, options),
    dispose: () => undefined,
    setMasterGain: (value) => engine.setMasterGain(value),
    playConnectClick: () => engine.playConnectClick(),
    setTension: (level, reducedStress) => engine.setTension(level, reducedStress),
    startRingtone: () => undefined,
    stopRingtone: () => undefined,
    startAmbience: () => undefined,
    setAmbienceInCall: () => undefined,
    stopAmbience: () => undefined,
  };
}

export const RoomCallLayer: React.FC<RoomCallLayerProps> = ({
  store,
  scenario,
  settings,
  paused,
  modelAllowed = false,
  screenSink: screenSinkProp,
  engine,
  voiceDeps,
  onHoverSound,
}) => {
  const call = useChapterState(store, (state) => state.call);
  const [ownSink] = useState(createPhoneScreenSink);
  const screenSink = screenSinkProp ?? ownSink;

  // Session-only Speaker override. It never writes the saved setting and resets on each new call.
  const [speakerOverride, setSpeakerOverride] = useState<boolean | null>(null);
  const speakerOn = speakerOverride ?? settings.phoneVoiceFilter;
  useEffect(() => {
    setSpeakerOverride(null);
  }, [call.current]);

  const voice = useVoicePlayback({
    store,
    scenario,
    settings: {
      soundEnabled: settings.soundEnabled,
      sfxVolume: settings.sfxVolume,
      voiceVolume: settings.voiceVolume,
      phoneVoiceFilter: speakerOn,
      englishVoiceFallback: settings.englishVoiceFallback,
      reducedStress: settings.reducedStress,
    },
    paused,
    deps: voiceDeps,
  });
  const callSounds = useMemo(() => roomCallSounds(engine), [engine]);
  useCallAudio({
    store,
    engine: callSounds,
    paused,
    reducedStress: settings.reducedStress,
    masterGain: settings.soundEnabled ? settings.sfxVolume : 0,
  });
  const durationSeconds = useCallDuration(call.status === "active", paused, call.current);

  const handleAnswer = useCallback(() => void store.dispatch({ type: "ANSWER_CALL" }), [store]);
  /** Declines a ringing call or hangs up an active one. */
  const handleEnd = useCallback(() => void store.dispatch({ type: "END_CALL" }), [store]);
  const handleSelectOption = useCallback(
    (optionId: string) => void store.dispatch({ type: "SELECT_DIALOGUE_OPTION", optionId }),
    [store],
  );
  const handleToggleSpeaker = useCallback(() => setSpeakerOverride(!speakerOn), [speakerOn]);
  const speaker = useMemo(() => ({ on: speakerOn, onToggle: handleToggleSpeaker }), [handleToggleSpeaker, speakerOn]);

  const callOpen = call.status === "ringing" || call.status === "active";
  if (!callOpen) return null;

  return (
    <>
      <CallPresentation
        store={store}
        scenario={scenario}
        paused={paused}
        modelAllowed={modelAllowed}
        screenSink={screenSink}
        onAnswer={handleAnswer}
        onEnd={handleEnd}
        onSelectOption={handleSelectOption}
        voice={voice}
        durationSeconds={durationSeconds}
        subtitlesEnabled={settings.subtitlesEnabled}
        speaker={speaker}
        onHoverSound={onHoverSound}
      />
    </>
  );
};
