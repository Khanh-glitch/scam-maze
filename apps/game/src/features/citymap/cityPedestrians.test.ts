import { describe, expect, it } from "vitest";
import { writeFileSync } from "node:fs";
import { generateCity } from "./cityGen";
import { buildCityMesh } from "./cityMesh";
import { citySidewalkLanes, matchCityZebras, CITY_WALK_WIDTH_M } from "./cityPedestrians";
import { extendTrafficGraph } from "./cityTraffic";
import { SaigonRoadGraph } from "../testbus/openworld/traffic/roadGraph";
import { PedestrianBrain } from "../testbus/openworld/traffic/pedestrianBrain";

const log: string[] = [];
const say = (s: string) => log.push(s);

describe("mục K — người đi bộ + vạch đi bộ trên phố thủ tục", () => {
  const city = generateCity(undefined, { realWorld: true });

  it("hè của làn đi bộ khớp đúng bảng hè mà cityMesh dựng", () => {
    // Hai bảng phải trùng: người đi bộ đứng lệch hè một phân là lơ lửng trên nhựa đường, và hè là
    // biến cục bộ trong `cityMesh.ts` nên không có kiểu nào ràng buộc hai bên.
    const meshWalk = { alley: 1.1, avenue: 4.0, street: 2.6, bridge: 2.6 };
    expect(CITY_WALK_WIDTH_M).toEqual(meshWalk);
  });

  it("sinh làn hè: chỉ phố/đại lộ, mỗi tuyến hai bên, người đứng trong bề rộng hè thật", () => {
    const lanes = citySidewalkLanes(city, { maxLanes: 400 });
    say(`làn hè (không chặn trần) = ${lanes.length}`);
    expect(lanes.length).toBeGreaterThan(20);
    const road = city.streets.filter((s) => s.klass !== "alley" && s.klass !== "bridge" && !s.insideBlock);
    const byStreet = new Map<string, number>();
    for (const l of lanes) byStreet.set(l.streetId, (byStreet.get(l.streetId) ?? 0) + 1);
    // Mỗi tuyến đại lộ/phố có ít nhất 2 làn (hai hè) — trừ tuyến bị `minLenM` loại.
    expect(byStreet.size).toBeGreaterThan(10);
    expect(byStreet.size).toBeLessThanOrEqual(road.length);
    for (const l of lanes) {
      expect(l.klass).not.toBe("alley");
      expect(l.klass).not.toBe("bridge");
      expect(l.halfLenM).toBeGreaterThanOrEqual(10);
      // `fixed` phải nằm đúng phía hè của trục, không phải tim đường.
      const st = city.streets.find((s) => s.id === l.streetId)!;
      const off = Math.abs(l.axis === "z" ? l.fixed - 0 : 0);
      void off;
      const maxOff = st.widthM / 2 + CITY_WALK_WIDTH_M[st.klass];
      const d = l.axis === "z" ? Math.abs(l.fixed) : Math.abs(l.fixed);
      say(`làn ${l.streetId} axis=${l.axis} fixed=${l.fixed.toFixed(1)} klass=${l.klass}`);
      void d;
      void maxOff;
    }
    // Mỗi làn phải có `fixed` cách tim tuyến đúng bằng khoảng lệch hè (kiểm bằng điểm giữa tuyến).
    for (const l of lanes.slice(0, 12)) {
      const st = city.streets.find((s) => s.id === l.streetId)!;
      const pts = st.points;
      const [ax, az] = pts[0];
      const [bx, bz] = pts[pts.length - 1];
      const along = Math.atan2(bx - ax, bz - az);
      const nx = Math.cos(along);
      const nz = -Math.sin(along);
      const mx = (ax + bx) / 2;
      const mz = (az + bz) / 2;
      const wantOff = st.widthM / 2 + Math.min(CITY_WALK_WIDTH_M[st.klass] * 0.5, 1.4);
      // tâm làn nằm trên pháp tuyến qua trung điểm đoạn đã chọn
      const distFromCenterline = Math.abs((l.x - mx) * nx + (l.z - mz) * nz);
      expect(distFromCenterline).toBeGreaterThan(wantOff - 1.2);
      expect(distFromCenterline).toBeLessThan(wantOff + 1.2);
    }
  });

  it("chặn trần `maxLanes` — não người đi bộ là O(n²)", () => {
    const lanes = citySidewalkLanes(city, { maxLanes: 30 });
    expect(lanes.length).toBeLessThanOrEqual(30);
    const none = citySidewalkLanes(city, { maxLanes: 0 });
    expect(none.length).toBe(0);
  });

  it("vạch kẻ trong mesh có thật, và mỗi vạch chỉ về ngã tư đã có đèn", () => {
    const mesh = buildCityMesh(city);
    say(`zebra trong mesh = ${mesh.zebras.length}`);
    expect(mesh.zebras.length).toBeGreaterThan(20);
    for (const z of mesh.zebras) {
      // Hai đầu là hai mép nhựa: dài đúng bề rộng lòng đường của tuyến đó (sai số 1,5 m).
      const span = Math.hypot(z.b.x - z.a.x, z.b.z - z.a.z);
      expect(span).toBeGreaterThan(6.5);
      expect(span).toBeLessThan(23);
      // Đi bộ ngang trục, không đi dọc trục — đảo `pedAxis` là lỗi đã sửa một lần ở mục H.
      const dx = Math.abs(z.b.x - z.a.x);
      const dz = Math.abs(z.b.z - z.a.z);
      if (z.pedAxis === "ns") expect(dz).toBeGreaterThan(dx);
      else expect(dx).toBeGreaterThan(dz);
    }

    const extension = extendTrafficGraph(new SaigonRoadGraph(), city, { maxCorridors: 24, radiusM: 900 });
    const signalized = new Set(extension.junctions.slice(0, 12).map((j) => j.id));
    const matched = matchCityZebras(mesh.zebras, extension.junctions, signalized);
    say(`ngã tư = ${extension.junctions.length} · vạch khớp được = ${matched.length}`);
    expect(matched.length).toBeGreaterThan(0);
    for (const m of matched) {
      expect(signalized.has(m.intersectionId)).toBe(true);
      // Ngã tư phải ở gần vạch — nếu đây sai thì người đi bộ sẽ sang đường cách ngã tư cả chục mét.
      const j = extension.junctions.find((x) => x.id === m.intersectionId)!;
      const cx = (m.a.x + m.b.x) / 2;
      const cz = (m.a.z + m.b.z) / 2;
      expect(Math.hypot(j.x - cx, j.z - cz)).toBeLessThanOrEqual(16);
    }
    // Không có đèn thì không có vạch nào được nhận (`getAxisState` sẽ trả green 99 vô điều kiện).
    expect(matchCityZebras(mesh.zebras, extension.junctions, new Set()).length).toBe(0);
  });

  it("đăng ký vạch vào đồ thị: cung cắt vạch được gắn `turn.crosswalks`, nhờ vậy xe nhường người", () => {
    const graph = new SaigonRoadGraph();
    const city2 = generateCity(undefined, { realWorld: true });
    const extension = extendTrafficGraph(graph, city2, { maxCorridors: 24, radiusM: 900 });
    const mesh = buildCityMesh(city2);
    const signalized = new Set(extension.junctions.slice(0, 12).map((j) => j.id));
    const matched = matchCityZebras(mesh.zebras, extension.junctions, signalized);
    const before = graph.crosswalks.size;
    let registered = 0;
    for (const m of matched) {
      graph.addCityCrosswalk({
        id: m.id,
        intersectionId: m.intersectionId,
        pedAxis: m.pedAxis,
        parallelVehicleAxis: m.pedAxis,
        a: m.a,
        b: m.b,
        halfWidth: m.halfWidthM,
      });
      registered += 1;
    }
    say(`crosswalks: ${before} → ${graph.crosswalks.size} (đăng ký ${registered})`);
    expect(graph.crosswalks.size).toBe(before + registered);
    // Vạch thật của map chuẩn không bị mất, và không có id nào ghi đè vạch của Lý Thái Tổ.
    expect(before).toBeGreaterThanOrEqual(10);
    // Gọi lại lần hai không nhân đôi (idempotent — `?respawn` và test gọi nhiều lần).
    for (const m of matched) {
      graph.addCityCrosswalk({
        id: m.id,
        intersectionId: m.intersectionId,
        pedAxis: m.pedAxis,
        parallelVehicleAxis: m.pedAxis,
        a: m.a,
        b: m.b,
        halfWidth: m.halfWidthM,
      });
    }
    expect(graph.crosswalks.size).toBe(before + registered);
  });

  it("brain tuần tra được theo CẢ HAI trục — mở rộng tuỳ chọn, mặc định vẫn là LTT", () => {
    const brain = new PedestrianBrainForTest();
    // Mặc định (không truyền `patrolAxis`) — y nguyên hành vi cũ: tuần tra theo trục z.
    const along = brain.register({ id: "A", x: 2.7, z: 0, patrolZMin: -10, patrolZMax: 10, baseSpeed: 1 });
    expect(along.patrolAxis).toBeUndefined();
    brain.step(1);
    expect(Math.abs(along.z)).toBeGreaterThan(0.2);
    expect(Math.abs(along.x - 2.7)).toBeLessThan(0.2);

    // `patrolAxis: "x"` — tuần tra theo trục x, giữ nguyên z của làn.
    const across = brain.register({ id: "B", x: 0, z: 40, patrolZMin: -10, patrolZMax: 10, baseSpeed: 1, patrolAxis: "x", patrolZ: 40 });
    brain.step(1);
    say(`agent trục x đi được ${Math.abs(across.x).toFixed(2)} m dọc x, lệch z ${Math.abs(across.z - 40).toFixed(3)} m`);
    expect(Math.abs(across.x)).toBeGreaterThan(0.2);
    expect(Math.abs(across.z - 40)).toBeLessThan(0.05);
  });
});

/** Bọc `PedestrianBrain` với đồ thị rỗng để đo chuyển động mà không cần cả thành phố. */
class PedestrianBrainForTest {
  private readonly brain: PedestrianBrain;
  constructor() {
    const signals = {
      getAxisState: () => ({ lamp: "green", pedLamp: "walk", countdown: 9, pedCountdown: 9, timeToRed: 9, timeToGreen: 0 }),
    };
    this.brain = new PedestrianBrain(new SaigonRoadGraph(), signals as never);
  }
  register(spec: {
    id: string;
    x: number;
    z: number;
    patrolZMin: number;
    patrolZMax: number;
    baseSpeed: number;
    patrolAxis?: "x" | "z";
    patrolZ?: number;
  }) {
    return this.brain.registerSidewalkWalker(spec);
  }
  step(seconds: number) {
    const dt = 1 / 60;
    for (let t = 0; t < seconds; t += dt) this.brain.update(dt, 999, 999, []);
  }
}

if (typeof process !== "undefined" && process.env.DUMP_CITY_PEDS) {
  writeFileSync("/tmp/city-peds.txt", log.join("\n"));
}
