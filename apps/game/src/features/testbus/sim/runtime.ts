import {LOOK} from "./drive-look";
import { surveyCamera } from "./survey462";
import { optics } from "./optics";
import { castStreet } from "./residents";
import { atmosphere, type Climate } from "./atmosphere";
export type Lens = "director" | "walk" | "passenger" | "driver";
import * as T from "three";
import {
  BusBoardingController,
  distance,
  DOOR_IDS,
  BUS_DOORS,
  EYE,
  floorAt,
  inDoorArc,
  seatBase,
  seats,
  START,
  STOP_SIGN,
  ROUTE_BOARD,
  VALIDATOR,
  type PassengerSeat,
} from "./boarding";
import { buildBus } from "./bus";
import { asset, canvasTexture, disposeScene, random } from "./scene-kit";
import { TransitAudio } from "./sound";
import { buildStreet } from "./street";
import {
  BusRouteController,
  clamp,
  damp,
  formatClock,
  ROUTE,
  type DoorId,
  type Phase,
  type TransitHost,
} from "./transit";

export interface Prompt {
  label: string;
  detail: string;
  key: "E" | "F";
}
type Action =
  | { type: "route" | "pay" | "stand" | "depart" }
  | { type: "door"; door: DoorId }
  | { type: "sit"; seat: PassengerSeat };
export interface Hud {
  phase: Phase;
  clock: string;
  cash: number;
  progress: number;
  onboard: boolean;
  seated: boolean;
  paid: boolean;
  onTime: boolean;
  nearStop: boolean;
  objective: string;
  prompt: Prompt | null;
  secondary: Prompt | null;
  notice: string;
}

export const initialHud: Hud = {
  phase: "waiting",
  clock: "08:00",
  cash: ROUTE.initialCash,
  progress: 0,
  onboard: false,
  seated: false,
  paid: false,
  onTime: true,
  nearStop: true,
  objective: "Catch Route 06 to Chợ Lớn",
  prompt: null,
  secondary: null,
  notice: "",
};

interface Callbacks {
  onHud: (hud: Hud) => void;
  onPanel: (panel: "route" | "pause") => void;
  onReady?: () => void;
  onError?: (message: string) => void;
}

const moveKeys = new Set([
  "KeyW",
  "KeyS",
  "KeyA",
  "KeyD",
  "KeyC",
  "ArrowLeft",
  "ArrowRight",
  "ArrowUp",
  "ArrowDown",
  "ShiftLeft",
  "ShiftRight",
]);
const angleDifference = (a: number, b: number) =>
  Math.atan2(Math.sin(b - a), Math.cos(b - a));

function skyEnvironment(scene: T.Scene, renderer: T.WebGLRenderer) {
  const texture = canvasTexture(512, 256, (ctx) => {
    const sky = ctx.createLinearGradient(0, 0, 0, 256);
    sky.addColorStop(0, "#72a5c0");
    sky.addColorStop(0.37, "#b6cdd1");
    sky.addColorStop(0.5, "#cdd1c7");
    sky.addColorStop(0.63, "#575b4f");
    sky.addColorStop(1, "#353a31");
    ctx.fillStyle = sky;
    ctx.fillRect(0, 0, 512, 256);
    const cloud = (
      x: number,
      y: number,
      w: number,
      h: number,
      alpha: number,
    ) => {
      ctx.save();
      ctx.translate(x, y);
      ctx.scale(w, h);
      const gradient = ctx.createRadialGradient(0, 0, 0.02, 0, 0, 1);
      gradient.addColorStop(0, `rgba(253,245,218,${alpha})`);
      gradient.addColorStop(1, "rgba(245,235,208,0)");
      ctx.fillStyle = gradient;
      ctx.fillRect(-1, -1, 2, 2);
      ctx.restore();
    };
    const rng = random(4009);
    for (let i = 0; i < 42; i++)
      cloud(
        rng() * 512,
        39 + rng() * 90,
        18 + rng() * 59,
        2 + rng() * 16,
        0.25 + rng() * 0.29,
      );
    cloud(355, 65, 85, 33, 0.6);
    cloud(355, 65, 17, 13, 0.91);
    for (let i = 0; i < 68; i++) {
      const x = rng() * 512,
        y = 103 + rng() * 44,
        w = 3 + rng() * 11,
        r = 86 + Math.floor(rng() * 60);
      ctx.fillStyle = `rgba(${r},${r + 3},${r - 8},0.44)`;
      ctx.fillRect(x, y, w, 37);
    }
  });
  texture.mapping = T.EquirectangularReflectionMapping;
  scene.background = texture;
  scene.backgroundIntensity = 0.94;
  const pmrem = new T.PMREMGenerator(renderer);
  const light = pmrem.fromEquirectangular(texture);
  scene.environment = light.texture;
  scene.environmentIntensity = 0.86;
  scene.environmentRotation.y = 0.9;
  pmrem.dispose();
  return {
    light: light.texture,
    release() {
      texture.dispose();
      light.dispose();
    },
  };
}

export function createSimulation(
  mount: HTMLDivElement,
  callbacks: Callbacks,
  host?: TransitHost,
  studio = false,
) {
  const safe = new URLSearchParams(location.search).has("safe");
  const renderer = new T.WebGLRenderer({
    antialias: false,
    alpha: false,
    powerPreference: "high-performance",
  });
  const probe = renderer.getContext();
  const extension = probe.getExtension("WEBGL_debug_renderer_info");
  const software =
    safe ||
    (!!extension &&
      /swiftshader|llvmpipe|software/i.test(
        String(probe.getParameter(extension.UNMASKED_RENDERER_WEBGL)),
      ));
  renderer.outputColorSpace = T.SRGBColorSpace;
  renderer.toneMapping = T.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  const gl = renderer.getContext() as WebGL2RenderingContext;
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = T.PCFShadowMap;
  renderer.shadowMap.autoUpdate = false;
  const canvas = renderer.domElement;
  canvas.tabIndex = 0;
  canvas.style.cssText = "display:block;width:100%;height:100%;outline:none;touch-action:none";
  canvas.setAttribute("aria-label", "First-person Saigon bus and street scene");
  mount.appendChild(canvas);

  const scene = new T.Scene();
  scene.fog = new T.Fog(0xb2c0b9, 34, 108);
  const camera = new T.PerspectiveCamera(57, 1, 0.045, 188);
  camera.rotation.order = "YXZ";
  const environment = skyEnvironment(scene, renderer);
  const sky = new T.HemisphereLight(0xe3eff2, 0x939189, software ? 2.0 : 1.58);
  scene.add(sky);
  const sun = new T.DirectionalLight(0xffebc5, 2.38);
  sun.castShadow = true;
  const shadowSide = software ? 1024 : 2048;
  sun.shadow.mapSize.set(shadowSide, shadowSide);
  sun.shadow.camera.left = -18;
  sun.shadow.camera.right = 18;
  sun.shadow.camera.top = 18;
  sun.shadow.camera.bottom = -18;
  sun.shadow.camera.near = 0.5;
  sun.shadow.camera.far = 68;
  sun.shadow.normalBias = 0.032;
  sun.shadow.bias = -0.00012;
  sun.shadow.radius = 2.1;
  scene.add(sun, sun.target);
  const route = new BusRouteController(host);
  const streamStart = performance.now();
  let streetReady = false,
    castReady = false;
  const textureQueue = new T.LoadingManager(() => {
    streetReady = true;
    needsPaint = true;
  });
  const street = buildStreet(scene, software, textureQueue);
  const bus = buildBus(scene, route, !software);
  if (software)
    bus.root.traverse((mesh) => {
      if (
        !(mesh instanceof T.Mesh) ||
        !(mesh.material instanceof T.MeshPhysicalMaterial)
      )
        return;
      mesh.material.envMap = environment.light;
    });
  const player = new BusBoardingController(
    route,
    street.solids,
    street.trafficClear,
  );
  let lens: Lens = studio ? "director" : "walk",
    weather: Climate = "day",
    dwell = 0,
    directTime = new URLSearchParams(location.search).has("tram") ? 15 : new URLSearchParams(location.search).has("viahe") ? 9 : 0,
    cycles = 0;
  const cast = castStreet(
    scene,
    bus.root,
    route,
    () => {
      renderer.shadowMap.needsUpdate = true;
      needsPaint = true;
    },
    () => {
      castReady = true;
    },
    street.solids,
  );
  const climate = atmosphere(scene, software);
  const skies: Partial<Record<Climate, T.Texture>> = {};
  let released = false;
  for (const c of ["day", "sunset", "rain"] as const) {
    new T.TextureLoader().load(
      asset(`sky-${c}.jpg`),
      (tex) => {
        if (released) {
          tex.dispose();
          return;
        }
        tex.colorSpace = T.SRGBColorSpace;
        tex.mapping = T.EquirectangularReflectionMapping;
        skies[c] = tex;
        if (weather === c){scene.background=tex;if(!software)scene.environment=tex;needsPaint=true;}
      },
    );
  }
  let quality={ao:true, film:true, shafts:true, reflections:true, exposure:1};
  const setWeather = (c: Climate) => {
    weather = c;
    if(skies[c]){scene.background=skies[c]!;if(!software)scene.environment=skies[c]!;}
    const l=LOOK[c],night=c==='rain';sun.color.setHex(l.sun);sun.intensity=l.power;
    sky.color.setHex(l.sky);sky.groundColor.setHex(l.ground);sky.intensity=l.fill;
    renderer.toneMappingExposure=l.exposure*quality.exposure;
    scene.backgroundIntensity=night?.48:c==='sunset'?.93:1.03;
    scene.environmentIntensity=night?.39:c==='sunset'?.78:.86;
    scene.fog=new T.FogExp2(l.fog,l.haze);
    street.wet(night,l.wet);bus.night(night);
    climate.set(c);
    shadowZ = Infinity;
    needsPaint = true;
  };
  if (studio) {
    route.wait();
    route.update(7, { front: false, rear: false }, false);
    bus.update(0);
  }
  const audio = new TransitAudio();
  const keys = new Set<string>();
  const virtual = new Set<string>();
  let yaw: number = START.yaw,
    pitch = 0.025;
  let eyeHeight = EYE + 0.16;
  let feet = 0;
  let paused = false,
    lost = false,
    destroyed = false;
  let time = 0,
    last = performance.now(),
    frame = 0,
    lastHud = -1,
    lastHudJSON = "";
  let focus: Action | null = null,
    notification = "",
    shownUntil = 0,
    ready = false;
  let dragId: number | null = null,
    dragX = 0,
    dragY = 0,
    hadLock = false;
  let ignoreFirstLookUntil = 0;
  let needsPaint = true,
    initialNotice = false;
  let seatTransition = 0;
  let velocityX = 0,
    velocityZ = 0;
  let shadowZ = Infinity,
    shadowBus = Infinity,
    shadowDoors = -5;
  setWeather("day");
  const diagnostics =
    import.meta.env.DEV && new URLSearchParams(location.search).has("qa");
  let queuedFrame: WebGLSync | null = null;
  const viewDirection = { x: 0, z: 0 };
  camera.position.set(START.x, eyeHeight, START.z);
  camera.rotation.set(pitch, yaw, 0);

  const pipeline =
    !safe &&
    (!software || new URLSearchParams(location.search).has("cinema")) &&
    !!gl.getExtension("EXT_color_buffer_float")
      ? optics(renderer, scene, camera)
      : null;
  const renderView = () =>
    pipeline
      ? pipeline.render(lens === "driver" ? 16 : lens === "passenger" ? 3.5 : 7, weather, quality)
      : renderer.render(scene, camera);
  const resize = () => {
    const width = Math.max(1, mount.clientWidth),
      height = Math.max(1, mount.clientHeight);
    renderer.setPixelRatio(
      software
        ? Math.min(
            1,
            (diagnostics ? 368 : 1080) / width,
            (diagnostics ? 259 : 650) / height,
          )
        : Math.min(Math.max(1.12, window.devicePixelRatio), 1.42),
    );
    renderer.setSize(width, height, false);
    pipeline?.resize(width, height);
    camera.aspect = width / height;
    camera.fov = width / height < 0.95 ? 65 : studio ? 49 : 57;
    camera.updateProjectionMatrix();
    needsPaint = true;
  };
  const observer = new ResizeObserver(resize);
  observer.observe(mount);
  resize();

  function tell(text: string, seconds = 3.7) {
    notification = text;
    shownUntil = time + seconds;
    lastHud = -1;
  }

  function nearStop() {
    const local = {
      x: player.position.x,
      z:
        player.position.z -
        (route.phase === "arrived" || route.phase === "complete"
          ? ROUTE.destinationZ
          : 0),
    };
    return (
      player.position.x >= 0.22 &&
      (distance(local, STOP_SIGN) < 3.65 || distance(local, ROUTE_BOARD) < 2.5)
    );
  }

  function approachFocus(): [Action | null, Prompt | null] {
    if (player.seat)
      return [
        { type: "stand" },
        { key: "E", label: "Stand up", detail: `Seat ${player.seat.id}` },
      ];
    const p = player.local;
    if (
      route.phase === "boarding" ||
      route.phase === "arrived" ||
      route.phase === "complete"
    ) {
      for (const id of DOOR_IDS) {
        const door = BUS_DOORS[id],
          dz = Math.abs((door.max + door.min) / 2 - p.z);
        const close = p.x > 0.6 && p.x < 2.94 && dz < 0.94;
        if (close) {
          const actuator = route.doors[id];
          const name = id === "front" ? "front" : "rear";
          const hint = actuator.target
            ? player.onboard
              ? "Step down to the sidewalk"
              : "Walk through the entrance"
            : id === "rear"
              ? "Cửa xuống / Rear entrance"
              : "Cửa lên / Boarding entrance";
          return [
            { type: "door", door: id },
            {
              key: "E",
              label: `${actuator.target ? "Close" : "Open"} ${name} doors`,
              detail: hint,
            },
          ];
        }
      }
    }
    if (player.onboard) {
      if (route.phase === "boarding" && distance(p, VALIDATOR) < 1.28) {
        if (!route.paid)
          return [
            { type: "pay" },
            {
              key: "E",
              label: "Validate fare",
              detail: "One-way ticket / 7,000 ₫",
            },
          ];
        if (p.z < -3.43)
          return [
            { type: "depart" },
            {
              key: "E",
              label: "Signal the driver",
              detail: "Ticket validated",
            },
          ];
      }
      let best: PassengerSeat | null = null,
        score = Infinity;
      for (const seat of seats) {
        if (Math.abs(p.x) > 0.38 || Math.abs(seat.aisleZ - p.z) > 0.78)
          continue;
        const d = distance(p, seat);
        const localYaw = yaw - route.yaw;
        const looking =
          ((seat.x - p.x) * -Math.sin(localYaw) +
            (seat.z - p.z) * -Math.cos(localYaw)) /
          Math.max(0.1, d);
        if (d > 1.42 || (looking < 0.12 && d > 0.85)) continue;
        const s =
          looking > 0.975
            ? (1 - looking) * 18 + d * 0.2 - 1
            : d - looking * 0.85;
        if (s < score) {
          best = seat;
          score = s;
        }
      }
      if (best)
        return [
          { type: "sit", seat: best },
          { key: "E", label: "Sit down", detail: `Passenger seat ${best.id}` },
        ];
    } else if (nearStop()) {
      return [
        { type: "route" },
        {
          key: "E",
          label: "Inspect route board",
          detail:
            route.phase === "arrived" || route.phase === "complete"
              ? "Chợ Lớn / District 5"
              : "Lý Thái Tổ / District 3",
        },
      ];
    }
    return [null, null];
  }

  function publish(force = false) {
    const [action, prompt] = approachFocus();
    focus = action;
    if (!force && lastHud >= 0 && time - lastHud < 0.095) return;
    const objective =
      route.phase === "waiting"
        ? initialHud.objective
        : route.phase === "approaching"
          ? "Wait for Route 06 to stop"
          : route.phase === "boarding"
            ? !player.onboard
              ? "Board Route 06"
              : !route.paid
                ? "Validate your fare"
                : "Signal the driver"
            : route.phase === "departing"
              ? "Stand clear of the doors"
              : route.phase === "driving"
                ? "Ride to Chợ Lớn"
                : route.phase === "arrived"
                  ? "Get off at Chợ Lớn"
                  : "District 5 reached";
    const secondary: Prompt | null =
      route.phase === "waiting" && nearStop()
        ? { key: "F", label: "Wait for the bus", detail: "" }
        : route.phase === "boarding" && player.onboard && route.paid
          ? { key: "F", label: "Signal departure", detail: "" }
          : null;
    const hud: Hud = {
      phase: route.phase,
      clock: formatClock(route.clock),
      cash: route.balance,
      progress: Math.round(route.progress * 100) / 100,
      onboard: player.onboard,
      seated: !!player.seat,
      paid: route.paid,
      nearStop: nearStop(),
      onTime: route.onTime,
      objective,
      prompt,
      secondary,
      notice: time < shownUntil ? notification : "",
    };
    lastHud = time;
    const signature = JSON.stringify(hud);
    if (signature !== lastHudJSON) {
      lastHudJSON = signature;
      callbacks.onHud(hud);
    }
  }

  function waitForBus() {
    if (!nearStop()) return false;
    if (!route.wait()) return false;
    tell("Route 06 is pulling in. Keep clear of the roadway.");
    publish(true);
    return true;
  }

  function requestAction() {
    if (paused) return;
    if (route.phase === "waiting") {
      waitForBus();
    } else if (route.phase === "boarding" && player.onboard) {
      if (!route.paid)
        tell("Validate your ticket at the reader by the front door.");
      else if (
        !route.depart(
          true,
          DOOR_IDS.some((id) => inDoorArc(player.local, id)),
        )
      )
        tell("Step away from the doorway before departure.");
      else {
        if (!route.doors.front.sealed || !route.doors.rear.sealed)
          audio.burst("door");
        tell("Doors closing. Remain aboard for Chợ Lớn.");
      }
    }
    publish(true);
  }

  function interact() {
    if (paused) return;
    focus = approachFocus()[0];
    if (!focus) return;
    switch (focus.type) {
      case "route":
        callbacks.onPanel("route");
        break;
      case "door": {
        const wasOpen = route.doors[focus.door].target > 0;
        if (route.toggleDoor(focus.door, inDoorArc(player.local, focus.door)))
          audio.burst("door");
        else if (wasOpen)
          tell("The doorway is occupied. Step back before closing.");
        break;
      }
      case "pay":
        if (route.pay(player.onboard)) {
          audio.chime("fare");
          tell("Ticket validated. Signal departure when ready.");
        } else tell("Insufficient cash. The fare is 7,000 ₫.");
        break;
      case "depart":
        requestAction();
        break;
      case "stand":
        player.stand();
        seatTransition = 0.33;
        break;
      case "sit":
        if (player.sit(focus.seat)) {
          yaw += angleDifference(yaw, route.yaw) * 0.88;
          pitch = 0.012;
          seatTransition = 0.4;
        }
        break;
    }
    publish(true);
  }

  function update(dt: number) {
    time += dt;
    if (studio && lens !== "walk") {
      if (route.phase === "boarding") {
        dwell += dt;
        if (dwell > 2 && dwell < 16 && !route.doors.front.target) {
          route.toggleDoor("front", false);
          audio.burst("door");
        }
        if (dwell > 24) {
          route.pay(true);
          route.depart(true, false);
          audio.burst("door");
        }
      } else if (route.phase === "arrived") {
        dwell += dt;
        if (dwell > 32) {
          Object.assign(route, new BusRouteController(host));
          route.wait();
          dwell = 0;
          cycles++;
        }
      }
    }
    const insideBefore = player.onboard;
    const old = player.local,
      previousPhase = route.phase,
      previousYaw = route.yaw;
    const safetyHold =
      !player.onboard && Math.abs(old.x) < 1.5 && old.z < -2.7 && old.z > -13.3;
    route.update(
      dt,
      { front: inDoorArc(old, "front"), rear: inDoorArc(old, "rear") },
      safetyHold,
    );
    if (route.phase !== previousPhase) {
      if (route.phase === "boarding" && previousPhase === "approaching")
        tell("Route 06 has stopped. Approach the front doors.");
      if (route.phase === "arrived") {
        audio.chime("arrival");
        audio.burst("door");
        tell("Chợ Lớn, District 5. Please exit onto the sidewalk.", 5.2);
      }
    } else if (
      route.phase === "approaching" &&
      safetyHold &&
      time > shownUntil
    ) {
      tell("The bus is yielding. Return to the sidewalk.");
    }
    if (insideBefore) {
      player.carry(old);
      yaw += route.yaw - previousYaw;
    }
    const down = (key: string) =>
      lens === "walk" && (keys.has(key) || virtual.has(key));
    yaw +=
      ((down("ArrowLeft") ? 1 : 0) - (down("ArrowRight") ? 1 : 0)) * dt * 1.82;
    pitch = clamp(
      pitch +
        ((down("ArrowUp") ? 1 : 0) - (down("ArrowDown") ? 1 : 0)) * dt * 1.26,
      -1.19,
      1.19,
    );
    viewDirection.x = -Math.sin(yaw);
    viewDirection.z = -Math.cos(yaw);
    const f = (down("KeyW") ? 1 : 0) - (down("KeyS") ? 1 : 0);
    const r = (down("KeyD") ? 1 : 0) - (down("KeyA") ? 1 : 0);
    const pace = down("KeyC")
      ? 0.6
      : player.onboard
        ? 1.53
        : down("ShiftLeft") || down("ShiftRight")
          ? 3.25
          : 2.02;
    const scale = pace / Math.max(1, Math.hypot(f, r));
    const oldPos = player.position;
    velocityX = damp(
      velocityX,
      player.seat ? 0 : (viewDirection.x * f - viewDirection.z * r) * scale,
      player.onboard ? 19 : 14,
      dt,
    );
    velocityZ = damp(
      velocityZ,
      player.seat ? 0 : (viewDirection.z * f + viewDirection.x * r) * scale,
      player.onboard ? 19 : 14,
      dt,
    );
    player.move(velocityX * dt, velocityZ * dt);
    if (
      insideBefore !== player.onboard &&
      player.onboard &&
      route.phase === "boarding" &&
      !route.paid
    )
      tell("Boarded Route 06. The fare reader is just inside.");
    const moved = distance(oldPos, player.position);
    const oldFeet = Math.floor(feet);
    feet += moved * 1.72;
    if (Math.floor(feet) !== oldFeet) audio.burst("footstep");
    const elevation = player.seat
      ? seatBase(player.seat.z) + 1.19
      : floorAt(player.position, player.local) + EYE;
    const bob = player.seat
      ? 0
      : Math.sin(feet * Math.PI * 2) *
        clamp(moved / Math.max(dt, 0.001) / 2.2) *
        0.021;
    eyeHeight = damp(eyeHeight, elevation, player.seat ? 10 : 13, dt);
    if (seatTransition > 0) {
      seatTransition = Math.max(0, seatTransition - dt);
      camera.position.x = damp(camera.position.x, player.position.x, 16, dt);
      camera.position.z = damp(camera.position.z, player.position.z, 16, dt);
    } else {
      camera.position.x = player.position.x;
      camera.position.z = player.position.z;
    }
    camera.position.y = eyeHeight + bob;
    camera.rotation.x = damp(camera.rotation.x, pitch, 28, dt);
    camera.rotation.y +=
      angleDifference(camera.rotation.y, yaw) * (1 - Math.exp(-25 * dt));
    camera.rotation.z = damp(
      camera.rotation.z,
      Math.sin(feet * Math.PI) * Math.min(0.008, moved * 0.22),
      13,
      dt,
    );
    bus.update(dt);
    if (studio && lens !== "walk") director(dt);
    alignReference();
    street.update(dt, camera.position, time);
    cast.update(dt, time, camera.position);
    climate.update(dt, camera.position);
    audio.update(route.speed, distance(camera.position, route), player.onboard || studio && (lens==='driver'||lens==='passenger'),weather==='rain');
    publish();
  }

  const aimPoint = new T.Vector3();
  function director(dt: number) {
    const z = route.z,
      x = route.x;
    if (lens === "director") {
      directTime += dt;
      const a = directTime % 70;
      if (a < 9) {
        surveyCamera(camera, 1, a * 0.075);
        return;
      }
      if (a < 15) {
        camera.position.set(-2.65, 2.05, -24 - (a - 9) * 0.37);
        aimPoint.set(4.9, 3.7, -38.6 - (a - 9) * 0.18);
      } else if (a < 24) {
        camera.position.set(
          2.6 + 0.22 * Math.sin(a * 0.12),
          1.86 + 0.05 * Math.cos(a * 0.2),
          z - 9.72 + a * 0.018,
        );
        aimPoint.set(x + 0.3, 1.65, z - 3.3);
      } else if (a < 38) {
        camera.position.set(3.7, 2.15, z - 8.1);
        aimPoint.set(x - 0.48, 1.56, z - 4.3);
      } else if (a < 50) {
        camera.position.set(-4.45, 0.86, z - 7.9);
        aimPoint.set(x, 0.94, z - 3.85);
      } else {
        // Drive-style descending crane along the avenue; keep the route vehicle as subject.
        const u=(a-50)/20,e=u*u*(3-2*u);
        camera.position.set(-7.6+5.1*e,15-11.3*e,z-24+12*e);
        aimPoint.set(x+.55,1.6,z-2.4);
      }
    } else if (lens === "driver") {
      camera.position.set(x - 0.65, 1.94, z - 4.91);
      aimPoint.set(x - 0.36, 1.22, z - 22);
    } else {
      camera.position.set(x + 0.78, 1.88, z + 2.43);
      aimPoint.set(x + 1.65, 1.49, z - 4.1);
    }
    camera.lookAt(aimPoint);
  }
  if (studio) {
    director(0);
    street.update(0, camera.position, 0);
  }
  let refAngle: number | null = null;
  const refPosition = new T.Vector3(),
    refRotation = new T.Quaternion();
  function alignReference() {
    if (refAngle === null) return;
    surveyCamera(camera, refAngle);
  }
  function repaint() {
    alignReference();
    const snap = Math.round(camera.position.z * 2) * 0.5;
    const door = route.doors.front.amount + 2 * route.doors.rear.amount;
    if (
      Math.abs(snap - shadowZ) > (software ? 8 : 3.5) ||
      Math.abs(route.z - shadowBus) > (software ? 4.0 : 0.9) ||
      Math.abs(door - shadowDoors) > (software ? 0.91 : 0.45)
    ) {
      sun.target.position.set(-3.1, 0.4, snap);
      sun.position.set(
        weather === "sunset" ? -14 : 4.6,
        weather === "sunset" ? 9.5 : 17.5,
        snap - 14.5,
      );
      renderer.shadowMap.needsUpdate = true;
      shadowZ = snap;
      shadowBus = route.z;
      shadowDoors = door;
    }
    renderView();
    if (software) {
      queuedFrame = gl.fenceSync(gl.SYNC_GPU_COMMANDS_COMPLETE, 0);
      gl.flush();
    }
    if (diagnostics) {
      canvas.dataset.drawCalls = String(renderer.info.render.calls);
      canvas.dataset.triangles = String(renderer.info.render.triangles);
    }
    needsPaint = false;
  }

  function loop(now: number) {
    if (destroyed) return;
    frame = requestAnimationFrame(loop);
    const dt = Math.min(0.5, Math.max(0, (now - last) / 1000));
    last = now;
    if (lost) return;
    if (!paused && ready) {
      const parts = Math.max(1, Math.ceil(dt / 0.035));
      for (let i = 0; i < parts; i++) update(dt / parts);
    }
    if (diagnostics)
      canvas.dataset.pose = JSON.stringify({
        ...player.position,
        yaw,
        pitch,
        eye: eyeHeight,
        local: player.local,
        time,
        opened: route.doors.front.amount,
      });
    // Do not queue up new draws behind a saturated software GPU. Input and simulation still tick.
    if (
      queuedFrame &&
      gl.clientWaitSync(queuedFrame, 0, 0) !== gl.TIMEOUT_EXPIRED
    ) {
      gl.deleteSync(queuedFrame);
      queuedFrame = null;
    }
    if ((!paused || needsPaint) && !queuedFrame) repaint();
    if (
      !ready &&
      (!studio || (streetReady && castReady) || now - streamStart > 7000)
    ) {
      ready = true;
      needsPaint = true;
      callbacks.onReady?.();
    }
    if (!initialNotice && !paused) {
      initialNotice = true;
      tell(
        window.matchMedia("(pointer: coarse)").matches
          ? "Drag the scene to look around. Use the arrows to walk."
          : "Click the scene to look around, or use the arrow keys.",
        5,
      );
      publish(true);
    }
  }

  function look(dx: number, dy: number, factor = 0.00235) {
    if (paused) return;
    yaw -= dx * factor;
    pitch = clamp(pitch - dy * factor, -1.19, 1.19);
  }

  function keydown(event: KeyboardEvent) {
    if (event.altKey || event.ctrlKey || event.metaKey) return;
    if (paused) return;
    if (studio && lens !== "walk" && event.code !== "Escape") return;
    if (moveKeys.has(event.code)) {
      event.preventDefault();
      keys.add(event.code);
      return;
    }
    if (event.repeat) return;
    if (event.code === "KeyE") {
      event.preventDefault();
      interact();
    }
    if (event.code === "KeyF") {
      event.preventDefault();
      requestAction();
    }
    if (event.code === "KeyM") {
      event.preventDefault();
      callbacks.onPanel("route");
    }
    if (event.code === "Escape") {
      event.preventDefault();
      callbacks.onPanel("pause");
    }
  }
  const keyup = (event: KeyboardEvent) => {
    keys.delete(event.code);
  };
  const blur = () => {
    keys.clear();
    virtual.clear();
    velocityX = velocityZ = 0;
  };
  const releasePointer = () => {
    if (document.pointerLockElement === canvas) document.exitPointerLock();
  };
  const lockChange = () => {
    if (destroyed) return;
    const locked = document.pointerLockElement === canvas;
    if (!locked && hadLock && !paused) {
      blur();
      callbacks.onPanel("pause");
    }
    if (locked && !hadLock) ignoreFirstLookUntil = performance.now() + 80;
    hadLock = locked;
  };
  const pointerDown = (event: PointerEvent) => {
    if (paused || event.button !== 0 || lens !== "walk") return;
    canvas.focus({ preventScroll: true });
    if (document.pointerLockElement === canvas) return;
    dragId = event.pointerId;
    dragX = event.clientX;
    dragY = event.clientY;
    canvas.setPointerCapture(event.pointerId);
    if (event.pointerType === "mouse" && canvas.requestPointerLock) {
      try {
        void canvas.requestPointerLock()?.catch(() => {});
      } catch {
        /* Drag look remains available. */
      }
    }
  };
  const pointerMove = (event: PointerEvent) => {
    if (document.pointerLockElement === canvas) {
      if (performance.now() >= ignoreFirstLookUntil)
        look(event.movementX, event.movementY);
    } else if (dragId === event.pointerId) {
      look(
        event.clientX - dragX,
        event.clientY - dragY,
        event.pointerType === "touch" ? 0.0039 : 0.0031,
      );
      dragX = event.clientX;
      dragY = event.clientY;
    }
  };
  const pointerUp = (event: PointerEvent) => {
    if (dragId === event.pointerId) dragId = null;
  };
  const contextLost = (event: Event) => {
    event.preventDefault();
    lost = true;
    callbacks.onError?.(
      studio
        ? "Mất kết nối WebGL. Hãy thử lại hoặc chạy chế độ nhẹ."
        : "The browser lost the 3D renderer. Restart the simulation to recover it.",
    );
  };

  document.addEventListener("keydown", keydown);
  document.addEventListener("keyup", keyup);
  document.addEventListener("pointerlockchange", lockChange);
  window.addEventListener("blur", blur);
  canvas.addEventListener("pointerdown", pointerDown);
  canvas.addEventListener("pointermove", pointerMove);
  canvas.addEventListener("pointerup", pointerUp);
  canvas.addEventListener("pointercancel", pointerUp);
  canvas.addEventListener("webglcontextlost", contextLost);
  frame = requestAnimationFrame(loop);

  return {
    interact,
    requestAction,
    waitForBus,
    setWeather,
    hasHDR:!!pipeline,
    nextShot(){if(lens!=="director")return;directTime=[9,15,24,38,50,70].find(t=>t>directTime%70+.01)??0;director(0);street.update(0,camera.position,time);needsPaint=true;},
    setQuality(q:typeof quality){quality={...q};renderer.toneMappingExposure=LOOK[weather].exposure*q.exposure;climate.controls(q.shafts,q.reflections);needsPaint=true;},
    setLens(next: Lens) {
      if (next !== "walk" && document.pointerLockElement === canvas) {
        hadLock = false;
        releasePointer();
      }
      if (next !== lens) directTime = 0;
      lens = next;
      keys.clear();
      virtual.clear();
      if (next !== "walk") director(0);
      else {
        camera.rotation.set(pitch, yaw, 0);
        if (
          studio &&
          !player.onboard &&
          Math.abs(route.z - player.position.z) > 38
        ) {
          player.position = { x: 2.45, z: route.z - 8.65 };
        }
      }
      needsPaint = true;
    },
    setReference(n: number | null) {
      if (refAngle === null && n !== null) {
        refPosition.copy(camera.position);
        refRotation.copy(camera.quaternion);
      } else if (n === null && refAngle !== null) {
        camera.position.copy(refPosition);
        camera.quaternion.copy(refRotation);
      }
      refAngle = n;
      alignReference();
      needsPaint = true;
    },
    telemetry() {
      return {
        time,
        cycles,
        z: route.z,
        cameraZ: camera.position.z,
        heading: (360 + T.MathUtils.radToDeg(-camera.rotation.y)) % 360,
      };
    },
    capture() {
      renderView();
      return canvas.toDataURL("image/png");
    },
    setMuted(muted: boolean) {
      audio.enable(muted);
    },
    setInput(key: string, held: boolean) {
      if (held && !paused) virtual.add(key);
      else virtual.delete(key);
    },
    setPaused(value: boolean) {
      paused = value;
      if (paused) {
        blur();
        releasePointer();
      }
      audio.pause(value);
    },
    dispose() {
      destroyed = true;
      cancelAnimationFrame(frame);
      observer.disconnect();
      releasePointer();
      audio.dispose();
      document.removeEventListener("keydown", keydown);
      document.removeEventListener("keyup", keyup);
      document.removeEventListener("pointerlockchange", lockChange);
      window.removeEventListener("blur", blur);
      canvas.removeEventListener("pointerdown", pointerDown);
      canvas.removeEventListener("pointermove", pointerMove);
      canvas.removeEventListener("pointerup", pointerUp);
      canvas.removeEventListener("pointercancel", pointerUp);
      canvas.removeEventListener("webglcontextlost", contextLost);
      if (queuedFrame) gl.deleteSync(queuedFrame);
      bus.dispose();street.dispose();
      released = true;
      pipeline?.dispose();
      cast.dispose();
      climate.dispose();
      Object.values(skies).forEach((s) => s.dispose());
      environment.release();
      disposeScene(scene);
      sun.shadow.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
      canvas.remove();
    },
  };
}

export type Simulation = ReturnType<typeof createSimulation>;
