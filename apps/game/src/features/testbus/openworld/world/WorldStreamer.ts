import * as T from "three";
import { ROOM_ANCHOR, STAIR } from "./boardingHouse";
import { ROOM } from "../room/apartment";

export interface StreamChunk {
  id: string;
  name: string;
  district: string;
  cx: number;
  cz: number;
  near: T.Object3D;
  lod?: T.Object3D;
  nearDist: number;
  lodDist: number;
  alwaysVisible?: boolean;
  state?: "near" | "lod" | "culled";
  hydrate?: () => Promise<void>;
  hydrated?: boolean;
  hydrating?: boolean;
}

export interface StreamingStats {
  zone: string;
  district: string;
  activeNear: number;
  activeLod: number;
  culled: number;
  totalChunks: number;
  landmarksReady: number;
}

export class WorldStreamer {
  private chunks: StreamChunk[] = [];
  private hysteresis = 10;
  public landmarksReady = 0;

  register(chunk: StreamChunk) {
    chunk.state = "culled";
    this.chunks.push(chunk);
  }

  getZone(x: number, y: number, z: number): { zone: string; district: string } {
    const rx0 = ROOM_ANCHOR.x + ROOM.x0;
    const rx1 = ROOM_ANCHOR.x + ROOM.x1;
    const rz0 = ROOM_ANCHOR.z + ROOM.z0;
    const rz1 = ROOM_ANCHOR.z + ROOM.z1;

    if (y >= 2.8 && x >= rx0 - 0.15 && x <= rx1 + 0.15 && z >= rz0 - 0.15 && z <= rz1 + 0.15) {
      return { zone: "Phòng 6.07", district: "Dãy Trọ 462/14 · Q.10" };
    }
    if (x >= STAIR.xBottom - 0.4 && x <= STAIR.xTop + 0.3 && z >= STAIR.z0 - 0.2 && z <= STAIR.z1 + 0.2 && y > 0.35 && y < 3.08) {
      return { zone: "Cầu Thang Dãy Trọ", district: "Dãy Trọ 462/14 · Q.10" };
    }
    if (y >= 2.8 && x >= 13.0 && x <= 32.0 && z >= -19.5 && z <= -12.0) {
      return { zone: "Hành Lang Lầu 1", district: "Dãy Trọ 462/14 · Q.10" };
    }
    if (x >= 13.0 && x <= 32.0 && z >= -19.5 && z <= -6.4) {
      return { zone: "Sân Khu Trọ 462/14", district: "Quận 10" };
    }
    if (x >= 4.8 && x < 13.2 && z >= -12.7 && z <= -9.8) {
      return { zone: "Hẻm 462/14 Lý Thái Tổ", district: "Quận 10" };
    }
    if (Math.hypot(x - 94, z + 186) < 58) {
      return { zone: "Quảng Trường Bitexco Tower", district: "Quận 1 · Trung Tâm" };
    }
    if (Math.hypot(x - 26, z + 356) < 76) {
      return { zone: "Công Viên Bờ Sông Landmark 81", district: "Bình Thạnh" };
    }
    if (x > 12 && Math.abs(z + 76) < 22) {
      return { zone: "Đại Lộ Hàm Nghi — Đường 3/2", district: "Kết Nối Q.10 → Q.1" };
    }
    if (x > 12 && Math.abs(z + 147) < 22) {
      return { zone: "Đại Lộ Điện Biên Phủ", district: "Kết Nối Q.1 → Bình Thạnh" };
    }
    if (Math.abs(z) < 12 && x >= -14 && x <= 7) {
      return { zone: "Trạm Xe Buýt Lý Thái Tổ", district: "Quận 10" };
    }
    if (Math.abs(z + 128) < 18 && x >= -16 && x <= 8) {
      return { zone: "Trạm Chợ Lớn", district: "Quận 5" };
    }
    if (z < -190) {
      return { zone: "Đại Lộ Ven Sông Sài Gòn", district: "Bình Thạnh" };
    }
    return { zone: "Đường Lý Thái Tổ", district: "Quận 10 · TP.HCM" };
  }

  update(px: number, py: number, pz: number, software: boolean): StreamingStats {
    let activeNear = 0;
    let activeLod = 0;
    let culled = 0;
    const scale = software ? 0.68 : 1.0;

    for (const c of this.chunks) {
      const dist = Math.hypot(px - c.cx, pz - c.cz);
      const nearThreshold = c.nearDist * scale;
      const lodThreshold = c.lodDist * (software ? 0.85 : 1.0);

      // Stream async chunk assets smoothly on approach (zero loading screen!)
      if (c.hydrate && !c.hydrated && !c.hydrating && dist < lodThreshold + 80) {
        c.hydrating = true;
        void c.hydrate().then(() => {
          c.hydrated = true;
          c.hydrating = false;
        });
      }

      if (c.alwaysVisible) {
        c.state = "near";
        c.near.visible = true;
        if (c.lod) c.lod.visible = false;
        activeNear++;
        continue;
      }

      const prev = c.state ?? "culled";
      let next: "near" | "lod" | "culled" = prev;

      if (prev === "near") {
        if (dist > nearThreshold + this.hysteresis) {
          next = dist < lodThreshold ? "lod" : "culled";
        }
      } else if (prev === "lod") {
        if (dist < nearThreshold - this.hysteresis) {
          next = "near";
        } else if (dist > lodThreshold + this.hysteresis) {
          next = "culled";
        }
      } else {
        if (dist < nearThreshold) next = "near";
        else if (dist < lodThreshold) next = "lod";
      }

      c.state = next;
      if (next === "near") {
        c.near.visible = true;
        if (c.lod) c.lod.visible = false;
        activeNear++;
      } else if (next === "lod") {
        c.near.visible = !c.lod; // if no separate LOD proxy, keep visible
        if (c.lod) c.lod.visible = true;
        activeLod++;
      } else {
        c.near.visible = false;
        if (c.lod) c.lod.visible = false;
        culled++;
      }
    }

    const { zone, district } = this.getZone(px, py, pz);
    return {
      zone,
      district,
      activeNear,
      activeLod,
      culled,
      totalChunks: this.chunks.length,
      landmarksReady: this.landmarksReady,
    };
  }
}
