/**
 * RoomPhoneModelLayer (task 10.4): an optional 3D phone for the call screen of the room chapter.
 *
 * A transparent React Three Fiber canvas (`frameloop="demand"`) that exists only while a call is
 * shown and the model is allowed. It renders the unchanged `PhoneModel3D`, which publishes the
 * projected screen rectangle to the `PhoneScreenSink`; `CallPresentation` follows that sink and
 * keeps its own 200 ms fallback to the 2D screen. The canvas draws no room, no light and no
 * post-processing, it is `aria-hidden` and has `pointer-events: none`, so the room and the HTML
 * overlays still receive input.
 *
 * Lifetime: R3F disposes the renderer when the canvas unmounts. The context-loss listeners are
 * removed in an effect cleanup, and `PhoneModel3D` disposes its own materials and publishes
 * `null` when it unmounts. This layer does not touch story state.
 *
 * Frames: with `frameloop="demand"` a frame is drawn on mount, on resize and when the model
 * finishes loading. While the phone rings, and during the entry slide, the driver asks for the
 * next frame, so the motion plays; otherwise the canvas is idle.
 */
import React, { Suspense, useEffect, useState } from "react";
import { Canvas, useFrame, useThree } from "@react-three/fiber";
import { CALL_PHONE_GLB } from "../../../config/assetPaths";
import { probeWebGL2 } from "../../../game/loading/deviceCapabilities";
import { PhoneModel3D, PhoneModelBoundary } from "../call/PhoneModel3D";
import { hasPhoneModelFailed, reportPhoneModelFailure } from "../call/phoneModelStatus";
import type { PhoneScreenSink } from "../call/phoneScreenSink";
import { useReducedMotion } from "../../../components/ui/useReducedMotion";

/** Frames are requested for this long after the call opens, so the entry slide plays. */
const ENTRY_FRAME_WINDOW_MS = 900;
/** The 3D phone has its own camera; the DOM screen follows what this camera draws. */
const PHONE_CAMERA_FOV_DEG = 50;

/**
 * True when the 3D phone may be tried: WebGL 2 starts and the model did not fail earlier in this
 * page session. Allocates (and releases) one throwaway context, so call it once.
 */
export function detectPhoneModelSupport(): boolean {
  if (hasPhoneModelFailed()) return false;
  return probeWebGL2().ok;
}

export interface RoomPhoneModelLayerProps {
  /** True while a call is shown (ringing or active). The canvas exists only then. */
  active: boolean;
  /** Switch: false means the 2D screen is used and nothing is mounted. */
  modelAllowed: boolean;
  ringing: boolean;
  screenSink: PhoneScreenSink;
  /** The model could not be loaded or decoded. The host turns `modelAllowed` off. */
  onModelError?: (error: unknown) => void;
  /** Called with true on webglcontextlost and false on webglcontextrestored. */
  onContextChange?: (lost: boolean) => void;
}

/** Requests the next frame only while the phone moves (ring, entry slide). */
const FrameDriver: React.FC<{ ringing: boolean; reducedMotion: boolean; openedAt: number }> = ({
  ringing,
  reducedMotion,
  openedAt,
}) => {
  useFrame((state) => {
    const entering = performance.now() - openedAt < ENTRY_FRAME_WINDOW_MS;
    if ((ringing && !reducedMotion) || entering) state.invalidate();
  });
  return null;
};

/** Reports context loss and restoration; removes its listeners on unmount. */
const ContextWatcher: React.FC<{ onChange: (lost: boolean) => void }> = ({ onChange }) => {
  const canvas = useThree((state) => state.gl.domElement);
  const invalidate = useThree((state) => state.invalidate);
  useEffect(() => {
    const onLost = (event: Event) => {
      event.preventDefault();
      onChange(true);
    };
    const onRestored = () => {
      onChange(false);
      invalidate();
    };
    canvas.addEventListener("webglcontextlost", onLost, false);
    canvas.addEventListener("webglcontextrestored", onRestored, false);
    return () => {
      canvas.removeEventListener("webglcontextlost", onLost, false);
      canvas.removeEventListener("webglcontextrestored", onRestored, false);
    };
  }, [canvas, invalidate, onChange]);
  return null;
};

const PhoneCanvas: React.FC<Omit<RoomPhoneModelLayerProps, "active" | "modelAllowed">> = ({
  ringing,
  screenSink,
  onModelError,
  onContextChange,
}) => {
  const reducedMotion = useReducedMotion();
  const [openedAt] = useState(() => performance.now());

  const handleError = (error: unknown) => {
    reportPhoneModelFailure(CALL_PHONE_GLB, error);
    screenSink.publish(null);
    onModelError?.(error);
  };
  const handleContext = (lost: boolean) => {
    if (lost) screenSink.publish(null);
    onContextChange?.(lost);
  };

  return (
    <div className="pointer-events-none fixed inset-0 z-30" aria-hidden="true" data-testid="room-phone-model-layer">
      <Canvas
        frameloop="demand"
        dpr={[1, 1.5]}
        gl={{ alpha: true, antialias: true, powerPreference: "default" }}
        camera={{ fov: PHONE_CAMERA_FOV_DEG, near: 0.01, far: 50, position: [0, 0, 0] }}
        style={{ pointerEvents: "none", background: "transparent" }}
        aria-hidden="true"
      >
        <ContextWatcher onChange={handleContext} />
        <FrameDriver ringing={ringing} reducedMotion={reducedMotion} openedAt={openedAt} />
        <PhoneModelBoundary onError={handleError}>
          <Suspense fallback={null}>
            <PhoneModel3D ringing={ringing} reducedMotion={reducedMotion} openedAt={openedAt} screenSink={screenSink} />
          </Suspense>
        </PhoneModelBoundary>
      </Canvas>
    </div>
  );
};

export const RoomPhoneModelLayer: React.FC<RoomPhoneModelLayerProps> = ({ active, modelAllowed, ...rest }) => {
  if (!active || !modelAllowed) return null;
  return <PhoneCanvas {...rest} />;
};
