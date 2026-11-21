import {canopyLight,driveTexture,LOOK} from "./drive-look";
import { SURVEY } from "./survey462";
import * as T from "three";
import { Reflector } from "three/addons/objects/Reflector.js";
import { canvasTexture, random } from "./scene-kit";
export type Climate = "day" | "sunset" | "rain";
export function atmosphere(scene: T.Scene, software: boolean) {
  const loader=new T.TextureLoader(), air=canopyLight(scene,loader), mask=driveTexture(loader,"pool-mask",false);mask.wrapS=mask.wrapT=T.RepeatWrapping;
  const rainGroup = new T.Group();
  scene.add(rainGroup);
  rainGroup.visible = false;
  const rng = random(38),
    pos = new Float32Array(520 * 6);
  for (let i = 0; i < pos.length; i += 6) {
    pos[i] = rng() * 28 - 14;
    pos[i + 1] = rng() * 14;
    pos[i + 2] = rng() * 34 - 17;
    pos[i + 3] = pos[i] + 0.035;
    pos[i + 4] = pos[i + 1] - 0.24;
    pos[i + 5] = pos[i + 2];
  }
  const geom = new T.BufferGeometry();
  geom.setAttribute("position", new T.BufferAttribute(pos, 3));
  const rain = new T.LineSegments(
    geom,
    new T.LineBasicMaterial({
      color: 0xafc8d5,
      transparent: true,
      opacity: 0.3,
      depthWrite: false,
    }),
  );
  rainGroup.add(rain);
  const halo = canvasTexture(64, 64, (c) => {
    const g = c.createRadialGradient(32, 32, 0, 32, 32, 32);
    g.addColorStop(0, "#ffffe8");
    g.addColorStop(0.08, "#ffd389");
    g.addColorStop(0.22, "#e9a45380");
    g.addColorStop(1, "#e7a05400");
    c.fillStyle = g;
    c.fillRect(0, 0, 64, 64);
  });
  const hm = new T.SpriteMaterial({
    map: halo,
    blending: T.AdditiveBlending,
    depthWrite: false,
    transparent: true,
  });
  for (let i = 0; i < 12; i++) {
    const z = -195 + i * 21 + 2.15;
    const glow = new T.Sprite(hm);
    glow.position.set(2.87, 6.52, z);
    glow.scale.setScalar(2.3);
    rainGroup.add(glow);
    const pool = new T.Mesh(
      new T.PlaneGeometry(6, 9),
      new T.MeshBasicMaterial({
        map: halo,
        color: 0xe9b46f,
        transparent: true,
        opacity: 0.37,
        depthWrite: false,
        blending: T.AdditiveBlending,
      }),
    );
    pool.rotation.x = -Math.PI / 2;
    pool.position.set(0, 0.015, z);
    rainGroup.add(pool);
  }
  // One reflection pass for the entire carriageway; puddle coverage varies in world space.
  const wet = new Reflector(new T.PlaneGeometry(SURVEY.width - 0.06, 294), {
    clipBias: 0.003,
    textureWidth: software ? 256 : 768,
    textureHeight: software ? 128 : 384,
    multisample: 0,
    color: 0x9297a3,
  });
  wet.rotation.x = -Math.PI / 2;
  wet.position.set(-SURVEY.width / 2, 0.009, -48);
  scene.add(wet);
  const wm = wet.material as T.ShaderMaterial;
  wm.transparent = true;
  wm.depthWrite = false;
  wm.vertexShader = wm.vertexShader
    .replace("varying vec4 vUv;", "varying vec4 vUv; varying vec2 pavement;")
    .replace(
      "vUv = textureMatrix",
      "pavement=position.xy; vUv = textureMatrix",
    );
  wm.fragmentShader = wm.fragmentShader
    .replace(
      "varying vec4 vUv;",
      "varying vec4 vUv; varying vec2 pavement; uniform float uRain,uWet; uniform sampler2D uMask;",
    )
    .replace(
      "texture2DProj( tDiffuse, vUv )",
      "texture2D(tDiffuse, vUv.xy/vUv.w + vec2(.0008*sin(pavement.y*70.+uRain),.001*sin(pavement.x*31.+uRain*.6)))",
    )
    .replace(
      "color ), 1.0",
      `color ), uWet*(.035+.68*smoothstep(.28,.73,texture2D(uMask,pavement*.073).r*.68 + texture2D(uMask,pavement*.147+.37).r*.32 + .16*smoothstep(4.7,6.4,abs(pavement.x))))`,
    );
  wm.uniforms.uRain = { value: 0 };
  wm.uniforms.uMask={value:mask};wm.uniforms.uWet={value:0};
  let reflects=true,mode:Climate="day",elapsed=0;
  // Two reused lights follow the nearest lamp fixtures, not one shadow light per pole.
  const lamps=software?[]:Array.from({length:2},()=>{const l=new T.PointLight(0xffc188,0,16,2);scene.add(l);return l;});
  let renders = 0;
  const reflect = wet.onBeforeRender.bind(wet);
  wet.onBeforeRender = (...args) => {
    if (!software || renders++ % 3 === 0) reflect(...args);
  };
  return {
    controls(shafts:boolean,reflection:boolean){reflects=reflection;air.toggle(shafts);wet.visible=reflects&&LOOK[mode].wet>0;renders=0;},
    set(c: Climate) {
      mode=c;air.set(c);wet.visible=reflects&&LOOK[c].wet>0;wm.uniforms.uWet.value=LOOK[c].wet;
      rainGroup.visible = c === "rain";for(const l of lamps)l.intensity=c==='rain'?105:c==='sunset'?22:0;
      renders = 0;
    },
    update(dt: number, cam: T.Vector3) {
      const lamp=Math.floor((cam.z+192.85)/21);
      lamps.forEach((l,i)=>l.position.set(2.87,6.48,-192.85+21*(lamp+i)));
      elapsed+=dt;air.update(elapsed,cam);
      if (!rainGroup.visible) return;
      wm.uniforms.uRain.value += dt;
      rain.position.set(cam.x, cam.y - 6, cam.z);
      for (let i = 1; i < pos.length; i += 6) {
        pos[i] -= dt * 7;
        if (pos[i] < 0) pos[i] += 14;
        pos[i + 3] = pos[i] - 0.24;
      }
      geom.attributes.position.needsUpdate = true;
    },
    dispose() {
      air.dispose();mask.dispose();wet.dispose();
      geom.dispose();
      rain.material.dispose();
      hm.dispose();
      halo.dispose();
    },
  };
}
