import * as THREE from 'three';
import { describe, expect, it } from 'vitest';
import { mergeStaticCity } from './cityMerge';

const basic = (color: number, extra: THREE.MeshBasicMaterialParameters = {}) => new THREE.MeshBasicMaterial({ color, ...extra });

describe('mergeStaticCity', () => {
  it('merges unlit meshes of one look into one mesh, with their colors as vertex colors', () => {
    const city = new THREE.Group();
    const a = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0xff0000));
    const b = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0x00ff00));
    b.position.set(5, 0, 0);
    city.add(a, b);
    const { before, after } = mergeStaticCity(city);
    expect(before).toBe(2);
    expect(after).toBe(1);
    const merged = city.children[0] as THREE.Mesh;
    const material = merged.material as THREE.MeshBasicMaterial;
    expect(material.vertexColors).toBe(true);
    expect(material.color.getHex()).toBe(0xffffff);
    const color = merged.geometry.attributes.color;
    expect([color.getX(0), color.getY(0)]).toEqual([1, 0]);
    expect([color.getX(color.count - 1), color.getY(color.count - 1)]).toEqual([0, 1]);
    // The second plane keeps its place in city space.
    const pos = merged.geometry.attributes.position;
    const xs = Array.from({ length: pos.count }, (_, i) => pos.getX(i));
    expect(Math.max(...xs)).toBeCloseTo(5.5);
  });

  it('bakes a texture offset and repeat into the UVs, so clones of one image share a material', () => {
    const image = new THREE.Texture();
    const t1 = image.clone(); t1.repeat.set(2, 1);
    const t2 = image.clone(); t2.offset.set(0.5, 0);
    const city = new THREE.Group();
    city.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0xffffff, { map: t1 })), new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0xffffff, { map: t2 })));
    mergeStaticCity(city);
    expect(city.children).toHaveLength(1);
    const merged = city.children[0] as THREE.Mesh;
    const map = (merged.material as THREE.MeshBasicMaterial).map!;
    expect(map.repeat.toArray()).toEqual([1, 1]);
    expect(map.offset.toArray()).toEqual([0, 0]);
    const uv = merged.geometry.attributes.uv;
    const us = Array.from({ length: uv.count }, (_, i) => uv.getX(i));
    expect(Math.max(...us.slice(0, uv.count / 2))).toBeCloseTo(2);
    expect(Math.max(...us.slice(uv.count / 2))).toBeCloseTo(1.5);
  });

  it('leaves dynamic objects, groups, lit materials and a look that occurs once', () => {
    const city = new THREE.Group();
    const blinking = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0xff0000));
    blinking.userData.dynamic = true;
    const car = new THREE.Group();
    car.add(new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0xff0000)));
    const lit = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), new THREE.MeshStandardMaterial());
    const lone = new THREE.Mesh(new THREE.PlaneGeometry(1, 1), basic(0xff0000, { transparent: true, blending: THREE.AdditiveBlending }));
    city.add(blinking, car, lit, lone);
    mergeStaticCity(city);
    expect(city.children).toEqual([blinking, car, lit, lone]);
  });

  it('splits a box with several materials by face group, and keeps a box whose unique face cannot merge', () => {
    const side = basic(0x111111);
    const front = basic(0xffffff, { transparent: true });
    const city = new THREE.Group();
    const merged = [0, 1].map(() => new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [side, side, side, side, front, side]));
    const unique = new THREE.Mesh(new THREE.BoxGeometry(1, 1, 1), [side, side, side, side, basic(0xffffff, { side: THREE.DoubleSide }), side]);
    city.add(...merged, unique);
    mergeStaticCity(city);
    // Sides of the two boxes in one mesh, their fronts in another, and the third box as it was.
    expect(city.children).toContain(unique);
    expect(city.children.filter((c) => c.name === 'MergedCity')).toHaveLength(2);
    expect(city.children).toHaveLength(3);
  });

  it('joins lines of one material into one line set', () => {
    const material = new THREE.LineBasicMaterial();
    const city = new THREE.Group();
    for (let i = 0; i < 3; i++) city.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(i, 0, 0), new THREE.Vector3(i, 1, 0), new THREE.Vector3(i, 2, 0)]), material));
    mergeStaticCity(city);
    expect(city.children).toHaveLength(1);
    const set = city.children[0] as THREE.LineSegments;
    expect(set.isLineSegments).toBe(true);
    expect(set.geometry.attributes.position.count).toBe(12);
  });
});
