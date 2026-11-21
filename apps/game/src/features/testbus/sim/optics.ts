import {LOOK} from "./drive-look";
import type {Climate} from "./atmosphere";
import * as T from "three";
import { EffectComposer } from "three/addons/postprocessing/EffectComposer.js";
import { RenderPass } from "three/addons/postprocessing/RenderPass.js";
import { ShaderPass } from "three/addons/postprocessing/ShaderPass.js";
import { UnrealBloomPass } from "three/addons/postprocessing/UnrealBloomPass.js";
import { OutputPass } from "three/addons/postprocessing/OutputPass.js";
import { SMAAPass } from "three/addons/postprocessing/SMAAPass.js";
// Depth-aware lens kernel in linear HDR, followed by bright-pass bloom, ACES and SMAA.
export function optics(
  renderer: T.WebGLRenderer,
  scene: T.Scene,
  camera: T.PerspectiveCamera,
) {
  const target = new T.WebGLRenderTarget(1, 1, { type: T.HalfFloatType });
  target.depthTexture = new T.DepthTexture(1, 1, T.UnsignedIntType);
  const chain = new EffectComposer(renderer, target);
  chain.addPass(new RenderPass(scene, camera));
  const lens = new ShaderPass({
    uniforms: {
      tDiffuse: { value: null },
      depth: { value: null },
      pixel: { value: new T.Vector2() },
      focus: { value: 6 },
      clip:{value:new T.Vector2()},ao:{value:1},film:{value:1},sat:{value:1},frame:{value:0},
      inv: { value: new T.Matrix4() },
      previous: { value: new T.Matrix4() },
    },
    vertexShader: `varying vec2 uv0;void main(){uv0=uv;gl_Position=projectionMatrix*modelViewMatrix*vec4(position,1.);}`,
    fragmentShader: `uniform sampler2D tDiffuse,depth;uniform vec2 pixel,clip;uniform float focus,ao,film,sat,frame;uniform mat4 inv,previous;varying vec2 uv0;
 float viewZ(vec2 uv){float z=texture2D(depth,clamp(uv,0.,1.)).r;return clip.x*clip.y/(clip.y-z*(clip.y-clip.x));}
 void main(){float z=texture2D(depth,uv0).r,m=viewZ(uv0);vec4 w=inv*vec4(uv0*2.-1.,z*2.-1.,1.);vec4 p=previous*(w/w.w);
 vec2 motion=clamp((uv0-(p.xy/max(.001,p.w)*.5+.5))*.20,-2.5*pixel,2.5*pixel)*film;
 float blur=min(1.3,abs(m-focus)/max(m,1.)*.85)*film; vec3 c=texture2D(tDiffuse,uv0).rgb*2.;float occ=0.;
 for(int i=0;i<6;i++){float a=float(i)*1.0472;vec2 axis=vec2(cos(a),sin(a));c+=texture2D(tDiffuse,uv0+pixel*axis*blur-motion*float(i)/5.).rgb;
 if(ao>.5){float d=m-viewZ(uv0+pixel*axis*clamp(120./max(.1,m),2.,13.));occ+=smoothstep(.025,.18,d)*(1.-smoothstep(.23,.88,d));}}
 c=c*.125*(1.-ao*.39*occ/6.);float lum=dot(c,vec3(.2126,.7152,.0722));vec2 r=uv0-.5;
 c=mix(vec3(lum),c,mix(1.,sat,film));c*=1.-film*.32*dot(r,r);float grain=fract(sin(dot(gl_FragCoord.xy+mod(frame,61.),vec2(12.9898,78.233)))*43758.5453)-.5;
 gl_FragColor=vec4(max(c*(1.+.026*grain*film),vec3(0.)),1.);}`,

  });
  chain.addPass(lens);
  const glow = new UnrealBloomPass(new T.Vector2(1, 1), 0.19, 0.45, 1.12);
  chain.addPass(glow);
  chain.addPass(new OutputPass());
  chain.addPass(new SMAAPass(1, 1));
  const vp = new T.Matrix4();
  let initial = true;
  return {
    render(focus:number,climate:Climate,q:{ao:boolean;film:boolean}) {
      const look=LOOK[climate];glow.strength=look.bloom;glow.threshold=look.threshold;
      lens.uniforms.clip.value.set(camera.near,camera.far);lens.uniforms.ao.value=Number(q.ao);lens.uniforms.film.value=Number(q.film);lens.uniforms.sat.value=look.saturation;lens.uniforms.frame.value++;
      camera.updateMatrixWorld();
      vp.multiplyMatrices(camera.projectionMatrix, camera.matrixWorldInverse);
      lens.uniforms.inv.value.copy(vp).invert();
      if (initial) {
        lens.uniforms.previous.value.copy(vp);
        initial = false;
      }
      lens.uniforms.focus.value = focus;
      lens.uniforms.depth.value = chain.readBuffer.depthTexture;
      chain.render();
      lens.uniforms.previous.value.copy(vp);
    },
    resize(w: number, h: number) {
      chain.setPixelRatio(renderer.getPixelRatio());
      chain.setSize(w, h);
      lens.uniforms.pixel.value.set(
        1 / (w * renderer.getPixelRatio()),
        1 / (h * renderer.getPixelRatio()),
      );
      initial = true;
    },
    dispose() {
      chain.passes.forEach((p) => p.dispose());
      chain.dispose();
    },
  };
}
