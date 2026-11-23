import * as T from 'three';
import {asset, canvasTexture, random} from './scene-kit';
export type Climate = "day" | "sunset" | "rain";

// Calibrated from the Drive noon/sunset/night presets for the photographic skies.
export const LOOK = {
 day:{sun:0xffefd2,power:3.35,sky:0xc6ddff,ground:0x938573,fill:1.36,fog:0xc2d2dd,haze:.009,exposure:1.02,bloom:.23,threshold:1.08,wet:0,shafts:.06,saturation:1.06},
 sunset:{sun:0xffaa63,power:3.9,sky:0xffc7a0,ground:0x715649,fill:1.04,fog:0xe9b395,haze:.013,exposure:1.08,bloom:.39,threshold:.86,wet:.34,shafts:.19,saturation:1.10},
 rain:{sun:0x829cfa,power:.74,sky:0x879dc7,ground:0x39344a,fill:1.05,fog:0x273249,haze:.019,exposure:1.18,bloom:.51,threshold:.7,wet:1,shafts:0,saturation:1.05},
} as const;
export function driveTexture(loader:T.TextureLoader,name:string,color=true,x=1,y=1){
 const t=loader.load(asset(`drive-look/${name}.webp`));if(color)t.colorSpace=T.SRGBColorSpace;
 t.anisotropy=4;if(x!==1||y!==1){t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.set(x,y);}return t;
}
export function driveSurface(loader:T.TextureLoader,kind:string,normal:boolean,x=1,y=1,rough=false){
 const m=new T.MeshStandardMaterial({map:driveTexture(loader,kind+'-map',true,x,y),normalMap:normal?driveTexture(loader,kind+'-normal',false,x,y):null,roughnessMap:rough?driveTexture(loader,kind+'-rough',false,x,y):null,roughness:.91});m.normalScale.setScalar(.48);return m;
}
// Suspended dust and shafts under the canopy: a single instanced draw for all beams.
export function canopyLight(scene:T.Scene,loader:T.TextureLoader){
 const beam=new T.MeshBasicMaterial({map:driveTexture(loader,'light-beam'),color:0xffdbac,transparent:true,depthWrite:false,blending:T.AdditiveBlending,side:T.DoubleSide,forceSinglePass:true});
 const rays=new T.InstancedMesh(new T.PlaneGeometry(1,1),beam,54),dummy=new T.Object3D(),rng=random(607);
 for(let i=0;i<54;i++){const s=i%2?1:-1;dummy.position.set(s>0?1.4:-13,4.35,-174+i*4.6+rng()*2);dummy.rotation.set(.22,s*.54,s*.47);dummy.scale.set(1+rng()*1.3,8+rng()*2,1);dummy.updateMatrix();rays.setMatrixAt(i,dummy.matrix);}scene.add(rays);
 const geom=new T.BufferGeometry(),positions=new Float32Array(180*3);for(let i=0;i<positions.length;i+=3){positions[i]=rng()*17-8.5;positions[i+1]=rng()*7;positions[i+2]=rng()*17-8.5;}geom.setAttribute('position',new T.BufferAttribute(positions,3));
 const dust=new T.Points(geom,new T.PointsMaterial({size:.022,color:0xffdfb6,transparent:true,opacity:.28,depthWrite:false}));scene.add(dust);
 let amount=0,enabled=true;
 const sync=()=>{rays.visible=dust.visible=enabled&&amount>0;beam.opacity=amount;dust.material.opacity=.10+amount;};
 return {dispose(){dust.material.dispose();geom.dispose();rays.dispose()},set(c:Climate){amount=LOOK[c].shafts;sync()},toggle(v:boolean){enabled=v;sync()},update(t:number,cam:T.Vector3){dust.position.set(cam.x+Math.sin(t*.3)*.4,cam.y-2+(Math.sin(t*.5)*.34),cam.z);}};
}
// Small recycled plume, left in world coordinates as the bus pulls away.
export function exhaust(scene:T.Scene){
 const tex=canvasTexture(64,64,c=>{const g=c.createRadialGradient(32,32,1,32,32,31);g.addColorStop(0,'rgba(174,168,153,.7)');g.addColorStop(1,'rgba(174,168,153,0)');c.fillStyle=g;c.fillRect(0,0,64,64)});
 const puffs=Array.from({length:12},()=>{const s=new T.Sprite(new T.SpriteMaterial({map:tex,transparent:true,depthWrite:false}));s.visible=false;scene.add(s);return {s,age:2};});let acc=0,idx=0;
 return {update(dt:number,root:T.Group,speed:number,accel:number){acc+=dt*(speed>.2?1.4+Math.max(0,accel)*1.8:.6);if(acc>=1){acc%=1;const p=puffs[idx++%puffs.length];p.age=0;p.s.position.set(-.82,.42,5.54).applyAxisAngle(T.Object3D.DEFAULT_UP,root.rotation.y).add(root.position);p.s.visible=true;}
 for(const p of puffs){if(!p.s.visible)continue;p.age+=dt;p.s.position.y+=dt*.38;p.s.position.x+=dt*.19;p.s.position.z+=dt*.36;p.s.scale.setScalar(.14+p.age*.74);p.s.material.opacity=.19*Math.max(0,1-p.age/1.8);p.s.visible=p.age<1.8;}},dispose(){tex.dispose();for(const p of puffs)p.s.material.dispose();}};
}

// Thin backlit skin on the HumanBody mesh only (not clothes, eyes or hair).
export function warmSkin(m:T.MeshStandardMaterial){
 if(m.userData.warmSkin)return;m.userData.warmSkin=true;
 const old=m.onBeforeCompile;m.onBeforeCompile=function(shader,renderer){old.call(m,shader,renderer);shader.fragmentShader=shader.fragmentShader.replace('#include <opaque_fragment>',`
#if NUM_DIR_LIGHTS > 0
 vec3 n=normalize(normal); float through=pow(max(0.,dot(-n,directionalLights[0].direction)),1.6); float edge=pow(1.-max(0.,dot(n,normalize(vViewPosition))),2.5); outgoingLight += diffuseColor.rgb*directionalLights[0].color*vec3(.34,.10,.055)*(through*.46+edge*.09);
#endif
#include <opaque_fragment>`);};m.customProgramCacheKey=()=>'drive-skin-v1';m.needsUpdate=true;
}
