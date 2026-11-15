---
inclusion: auto
name: architecture
description: "Current SCAMMAZE repository architecture (verified 2026-11-13; Chapter 1 flow, core and saves updated 2026-11-16): apps, routes, rendering hosts per map, narrative core, saves, loading, shared player/vehicle modules and known duplication. Use before changing structure, adding a map or a system, or deciding where code belongs."
---

# Architecture (current, verified against the code on 2026-11-13)

Status words follow `docs/architecture/OVERVIEW.md`: IMPLEMENTED exists in code; PLANNED or
PROPOSED does not. OVERVIEW.md predates the world routes; this file covers them. If code and this
file disagree, trust the code and update this file.

## Repository (IMPLEMENTED)

- pnpm 10 monorepo, Node >= 22.12. `apps/landing` (marketing site, GitHub Pages), `apps/game`
  (the game, Vite 8, dev port 5174), `packages/shared-types` (pure TS contracts such as
  `GameSettings`, `GameLocale`, `GraphicsQuality`).
- Gates: `pnpm typecheck` (`tsc -b`), `pnpm test` (Vitest 5 + jsdom, game only), `pnpm build`.
  No lint script. CI (`.github/workflows/ci.yml`) runs the same three.

## Game app layout (`apps/game/src`)

| Area | Path | Notes |
|---|---|---|
| App shell, routes | `app/App.tsx` | No router library. `getAppRoute()` reads the path/hash: `menu` (default), `/testmove`, `/ueh`, `/hue`, `/mientay` (lazy chunk). Menu screen machine: `menu` -> `chapter-loading` -> `prologue` (new game) or `chapter` (saved game, `?skip-prologue`). Menu music and ambience live here. |
| Narrative core | `game/narrative/` | Pure, framework-free (enforced by `boundaries.test.ts`). 16 Core_Action kinds, deductions, device actions, beats. See `gameplay-rules.md`. |
| Chapter 1 data | `game/narrative/chapter1/` | `CHAPTER_1_SCENARIO` (the double-deception story): ids, sources, evidence, deductions, device actions, beats, decisions, dialogues, endings, acts. |
| Saves | `game/saves/` | localStorage, envelope v3 (`scammaze_save_v3`, `contentVersion`), replay of the action log through the reducer. v1 and v2 saves are `incompatible`, not migrated. No Dexie yet (PLANNED). |
| Loading | `game/loading/`, `game/chapters/chapterRegistry.ts`, `features/loading/` | Chapter asset list, verification, device checks, loading screens. Only the menu/chapter flow uses it. |
| Voice | `game/voice/`, `features/chapter1/voice/` | Manifest-driven clips, `VoiceDialoguePlayer`, Web Audio engine. |
| Chapter 1 UI | `features/chapter1/` | Host: `room/RoomChapterPage` (embeds Room v2) and `room/RoomChapterLayer` (overlays, calls, ending), `room/laptop/` (notification, bank app, compare view, Review Security), `phone/` (records), `journal/`, `call/` (call UI, 3D phone), `decision/`, `ending/`, `debrief/`, intro narration. `RoomStoryBridge` connects it to the Room v2 `RoomStoryPort`. |
| Parked street chapter | `legacy/urgent-call-street/` | DEPRECATED. The old street chapter (neighbor Sam, `ChapterOnePage`, `ChapterOneCanvas`) with its scenario. Excluded from `tsc` and Vitest, not maintained. Do not import from it. |
| Menu | `features/menu/`, `game/core/GameCanvas.tsx`, `game/scenes/MainMenuScene/` | R3F street scene behind the menu; the menu canvas stays mounted (frameloop "never") under Chapter 1. |
| Worlds | `features/{testmove,ueh,hue,mientay,khupho,roomv2}/` | Showcase maps, see below. `khupho` (neighborhood prologue) and `roomv2` (apartment) are also the story path of Chapter 1: new game, prologue, house no. 59, Room v2. |
| Shared player | `features/player/` | `CharacterRuntime` (imperative), `FirstPersonPlayer` (R3F wrapper), `usePlayerControls` (pointer lock, keys), `GameWorldAdapter` interface, `seating`, arms viewmodel. |
| Shared vehicle | `features/vehicle/` | `vehiclePhysics`, `lexusRig`, `LexusVehicle` (R3F), `vehicleAudio`, `turnSignal`. Hue has its own `HueVehicle`. |
| i18n | `i18n/` | i18next, en + vi dictionaries typed by `LocaleShape`. |

## Rendering hosts (IMPLEMENTED)

Two styles coexist on purpose; do not force one onto the other without a spec.

- R3F `<Canvas>`: menu (`GameCanvas`), `/testmove`, `/ueh`, and the optional 3D phone overlay of Chapter 1 (`RoomPhoneModelLayer`, DPR 1 to 1.5, context-loss listener). The parked street chapter had its own canvas (`ChapterOneCanvas`).
  DPR tiers by `graphicsQuality` (1.0 / 1.25 / 1.5) on the menu.
- Imperative engine classes owning a `THREE.WebGLRenderer`: the Room v2 engine (`features/roomv2/game/engine.ts`, the Chapter 1 host, driven by the narrative core through `RoomStoryPort`), the neighborhood engine (`features/khupho/world/engine.ts`), `HueWorldEngine` (`/hue`, chunk
  streaming of six monuments, adaptive pixel ratio, no post-processing) and `MekongWorldEngine`
  (`/mientay`, EffectComposer with N8AO and bloom, cascaded shadows, `mergeStaticMeshes`,
  `spatialChunking`, staged build with progress, adaptive render scale 0.7-1.0).
- Assets: Meshopt + WebP GLBs (`config/assetPaths.ts`); no KTX2/Draco. Street GLB via
  `StreetGLTFLoader` (byte progress); each `StreetEnvironment` renders its own clone of the cached
  scene (one three.js object has one parent; two canvases use it).

## Known duplication (measured by reading code, not yet refactored)

Renderer setup exists six times with different exposure values; DPR logic is copied in two R3F
canvases and custom in both engines; sky, water and grass exist per map; resize/visibility and
dispose traversals are near copies in Hue and Mekong; Meshopt loader setup exists in three or four
places; seven or more `AudioContext`s. This is the subject of `.kiro/specs/shared-world-engine`.
Each map's look is intentional: share infrastructure, not art direction.

## Not implemented (do not describe as existing)

Backend/API, database (`DATABASE_DECISION = PENDING`), auth, AI layer, Zustand, Dexie, Rapier
physics, PWA, a shared world engine, a shared audio manager, real-GPU performance measurements.
