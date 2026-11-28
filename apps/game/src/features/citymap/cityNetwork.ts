/**
 * MẠNG ĐƯỜNG CỦA THÀNH PHỐ — dựng trên **cùng** đồ thị của `OpenWorldEngine`.
 *
 * Trước module này, `cityTraffic` chỉ lấy mỗi tuyến phố thành **hai làn** chạy hết chiều dài, hai đầu
 * cụt nối bằng cung quay đầu. Cách đó đủ để "có xe chạy trên phố thủ tục", nhưng đồ thị không có
 * **ngã tư** nào, nên:
 *
 *  - xe không bao giờ rẽ — chạy hết tuyến rồi quay đầu;
 *  - không có giao lộ để đặt đèn (mục D của `CITY_MAP_HANDOFF.md` không có chỗ bám);
 *  - Bus 06 không thể rời Lý Thái Tổ để chạy sang trục của thành phố (mục F).
 *
 * Ở đây tuyến được chia theo đúng chỗ nó **gặp tuyến khác**, và các đầu đoạn được nối bằng cung của
 * engine (`addCityLink`). Kết quả là lưới ô vuông thật: đi thẳng, rẽ, và quay đầu ở hai đầu tuyến;
 * mỗi ngã tư là một `IntersectionSpec` trong đồ thị, nên `citySignals` có chỗ đặt đèn và `BusCircuit`
 * có chỗ để nối vòng.
 *
 * Thêm một việc quan trọng: **nối vào cổng của map chuẩn**. Đồ thị gốc cụt ở năm `END_*`; đó chính
 * là chỗ phố thủ tục tiếp quản. Tuyến thành phố gần cổng nhất được cắt đúng tại hình chiếu của cổng,
 * và cổng được nối vào đó bằng cung rẽ của engine — nên xe (và Bus 06) đi thẳng từ hẻm 462/14 ra đại
 * lộ thành phố.
 *
 * Chỉ dùng API công khai của `SaigonRoadGraph` (`addCityEdge` / `addCityIntersection` / `addCityLink`
 * / `addCityTurn`): `buildNetwork()` của map chuẩn không bị chạm vào, nên `/testbus` y nguyên.
 */
import type { City, CityStreet } from "./cityGen";
import type { SaigonRoadGraph } from "../testbus/openworld/traffic/roadGraph";
import { inRealWorld, realWorldFootprintUnion } from "./realWorldFootprint";

/** Bán kính một ngã tư (m): hai đầu đoạn trong phạm vi này là cùng một giao lộ. */
const JUNCTION_REACH_M = 24;
/** Tuyến ngắn hơn chừng này không đáng đưa vào đồ thị (không đủ chỗ chạy + quay đầu). */
const MIN_CORRIDOR_LEN_M = 90;
/** Đoạn ngắn hơn chừng này bị gộp — đoạn 3 m thì không đủ chỗ đặt xe, ngã tư lại chồng lên nhau. */
const MIN_SEGMENT_M = 26;
/** Chỗ cắt ở hai đầu tuyến: chừa chỗ vòng quay đầu. */
const END_TRIM_M = 7;

export interface CityNetwork {
  corridors: number;
  /** Làn xe của thành phố (2 mỗi đoạn tuyến) — id dùng để gọi `spawnVehicle`. */
  edgeIds: string[];
  /** Ngã tư đã dựng trong đồ thị (kèm toạ độ để `citySignals` bật đèn đúng chỗ). */
  junctions: Array<{ id: string; x: number; z: number }>;
  /** Cổng của map chuẩn đã nối được vào lưới (để log và test). */
  portals: string[];
  /** Tổng chiều dài lòng đường đưa vào đồ thị (m). */
  lengthM: number;
}

/**
 * Cổng của map chuẩn: node đầu cụt, đường dẫn tới nó, và hướng đi tiếp ra ngoài map dựng tay.
 * Thứ tự/giá trị lấy từ chính đồ thị (`END_LTT_S` ở z = 46 — chỗ bắt đầu hành trình 6.07).
 */
const PORTALS: ReadonlyArray<{ node: string; edge: string; heading: { x: number; z: number }; axis: "ew" | "ns" }> = [
  { node: "END_LTT_S", edge: "LTT_S_SB", heading: { x: 0, z: 1 }, axis: "ns" },
  { node: "END_D32_E", edge: "D32_W_EB", heading: { x: 1, z: 0 }, axis: "ew" },
  { node: "END_DBP_E", edge: "DBP_E_EB", heading: { x: 1, z: 0 }, axis: "ew" },
  { node: "END_HT_N", edge: "HT_N_NB", heading: { x: 0, z: -1 }, axis: "ns" },
  { node: "END_VH_E", edge: "VH_EB", heading: { x: 1, z: 0 }, axis: "ew" },
];

interface Line {
  st: CityStreet;
  i: number;
  ax: number;
  az: number;
  bx: number;
  bz: number;
  len: number;
  tx: number;
  tz: number;
}

interface Cut {
  /** Vị trí dọc tuyến (m). */
  s: number;
  /** Giao lộ mà chỗ cắt này thuộc về — cũng chính là node hai đoạn kề nhau dùng. */
  junction: string;
  /** Nửa chiều rộng hộp giao lộ: mỗi đoạn kề bị cắt vào chừng này. */
  pad: number;
  /** Đầu cụt của cả tuyến (chỉ nối cung quay đầu). */
  end: boolean;
}

const lengthOf = (st: CityStreet): number => {
  let len = 0;
  for (let i = 1; i < st.points.length; i += 1) {
    len += Math.hypot(st.points[i][0] - st.points[i - 1][0], st.points[i][1] - st.points[i - 1][1]);
  }
  return len;
};

/**
 * Phần của đoạn thẳng nằm **ngoài** đất map chuẩn.
 *
 * Phố thủ tục được sinh trước map dựng tay, nên lưới của nó chạy xuyên qua đất ấy. Cắt (thay vì bỏ cả
 * tuyến) giữ được những trục quan trọng: Lý Thái Tổ x = 0 còn đoạn bắc z ≥ 48 nối thẳng vào cổng
 * `END_LTT_S`, Bùi Thị Xuân x = 120 còn đoạn bắc và nam. Cắt bằng tham số hoá 1 chiều vì lưới này
 * trực giao — mọi tuyến đều song song một trục.
 */
function clipOutsideFootprint(
  ax: number,
  az: number,
  bx: number,
  bz: number,
  rect: { x0: number; x1: number; z0: number; z1: number },
): Array<{ ax: number; az: number; bx: number; bz: number }> {
  const pad = 2; // chừa mép: đường của map chuẩn đã có ở trong đất ấy
  const x0 = rect.x0 - pad;
  const x1 = rect.x1 + pad;
  const z0 = rect.z0 - pad;
  const z1 = rect.z1 + pad;
  const len = Math.hypot(bx - ax, bz - az);
  if (len < 1) return [];
  const tx = (bx - ax) / len;
  const tz = (bz - az) / len;
  // Khoảng tham số (mét) bị đất map chiếm.
  let enter = -Infinity;
  let leave = Infinity;
  for (const [p, d, lo, hi] of [
    [ax, tx, x0, x1],
    [az, tz, z0, z1],
  ] as const) {
    if (Math.abs(d) < 1e-6) {
      if (p < lo || p > hi) return [{ ax, az, bx, bz }]; // song song và ngoài dải: giữ nguyên
      continue;
    }
    const t1 = (lo - p) / d;
    const t2 = (hi - p) / d;
    enter = Math.max(enter, Math.min(t1, t2));
    leave = Math.min(leave, Math.max(t1, t2));
  }
  if (!(leave > 0 && enter < len && enter < leave)) return [{ ax, az, bx, bz }];
  const out: Array<{ ax: number; az: number; bx: number; bz: number }> = [];
  const aEnd = Math.max(0, Math.min(enter, len));
  const bStart = Math.max(0, Math.min(leave, len));
  if (aEnd > 1) out.push({ ax, az, bx: ax + tx * aEnd, bz: az + tz * aEnd });
  if (bStart < len - 1) out.push({ ax: ax + tx * bStart, az: az + tz * bStart, bx, bz });
  return out;
}

/**
 * Dựng mạng đường thành phố vào đồ thị của engine.
 *
 * `near` + `radiusM` giữ quy mô trong ngân sách: bộ mô phỏng duyệt **mọi** cung mỗi khung, mà thành
 * phố có 139 tuyến. Mười tuyến gần map chuẩn nhất là đủ để lưới có ngã tư thật.
 */
export function buildCityNetwork(
  graph: SaigonRoadGraph,
  city: City,
  options: { maxCorridors?: number; near?: { x: number; z: number }; radiusM?: number } = {},
): CityNetwork {
  const maxCorridors = options.maxCorridors ?? 10;
  const near = options.near ?? { x: 0, z: 0 };
  const radius = options.radiusM ?? 520;

  // 1. Tuyến đưa vào đồ thị. Đại lộ được cộng ưu thế (trục chính của thành phố), còn lại xếp theo
  //    khoảng cách tới map chuẩn.
  const score = (c: { dist: number; st: CityStreet }) => c.dist - (c.st.klass === "avenue" ? 140 : 0);
  const candidates = city.streets
    .filter((st) => (st.klass === "avenue" || st.klass === "street") && !st.insideBlock)
    .map((st) => {
      const [ax, az] = st.points[0];
      const [bx, bz] = st.points[st.points.length - 1];
      return { st, len: lengthOf(st), dist: Math.hypot((ax + bx) / 2 - near.x, (az + bz) / 2 - near.z) };
    })
    .filter((c) => c.len >= MIN_CORRIDOR_LEN_M && c.dist <= radius)
    // Tuyến **nằm trọn** trong đất map chuẩn bị bỏ (đường đó đã có trong đồ thị gốc, thêm nữa là hai
    // bộ luật chồng nhau). Nhưng tuyến chỉ **đi ngang qua** thì giữ: bước 2 cắt nó ở mép đất, và phần
    // còn lại chính là con phố ngay cổng — thiếu nó thì phố thủ tục không nối được vào map dựng tay.
    .filter((c) => {
      const [ax, az] = c.st.points[0];
      const [bx, bz] = c.st.points[c.st.points.length - 1];
      return !(inRealWorld(ax, az, 6) && inRealWorld(bx, bz, 6) && inRealWorld((ax + bx) / 2, (az + bz) / 2, 6));
    })
    // Điểm xếp hạng: gần map chuẩn là chính, đại lộ được cộng ưu thế. Xếp "đại lộ trước" tuyệt đối
    // thì mười suất bị các đại lộ xa (Triệu Quang Phục z = 325, Tôn Đức Thắng x = 660) chiếm hết, và
    // lưới quanh map chỉ còn vài tuyến — không đủ để thành lưới có ngã tư.
    .sort((a, b) => score(a) - score(b))
    .slice(0, maxCorridors);

  // 2. CẮT THEO ĐẤT MAP CHUẨN. Lưới phố thủ tục chạy xuyên qua đất của map dựng tay (nó được sinh
  //    ra trước), nên tuyến phải bị cắt ở mép đất ấy thay vì bị bỏ cả tuyến. Nhờ vậy trục Lý Thái Tổ
  //    của thành phố (x = 0) vẫn còn đoạn phía bắc z ≥ 48 — đúng chỗ cổng `END_LTT_S` (z = 46) nằm,
  //    và xe đi thẳng từ 6.07 ra đại lộ mà không phải quay đầu.
  const footprint = realWorldFootprintUnion();
  const lines: Line[] = [];
  for (const { st } of candidates) {
    const [ax, az] = st.points[0];
    const [bx, bz] = st.points[st.points.length - 1];
    for (const part of clipOutsideFootprint(ax, az, bx, bz, footprint)) {
      const len = Math.hypot(part.bx - part.ax, part.bz - part.az);
      if (len < MIN_CORRIDOR_LEN_M * 0.35) continue;
      lines.push({
        st,
        i: lines.length,
        ax: part.ax,
        az: part.az,
        bx: part.bx,
        bz: part.bz,
        len,
        tx: (part.bx - part.ax) / len,
        tz: (part.bz - part.az) / len,
      });
    }
  }
  const horizontal = (l: Line) => Math.abs(l.bz - l.az) >= Math.abs(l.bx - l.ax);
  const lineOf = new Map(lines.map((l) => [l.i, l]));

  // 2. Chỗ cắt: hai đầu tuyến (quay đầu) + giao điểm với tuyến vuông góc.
  const cuts = new Map<number, Cut[]>();
  for (const l of lines) {
    cuts.set(l.i, [
      { s: 0, junction: `CTYEND_${l.i}_W`, pad: END_TRIM_M, end: true },
      { s: l.len, junction: `CTYEND_${l.i}_E`, pad: END_TRIM_M, end: true },
    ]);
  }
  for (let p = 0; p < lines.length; p += 1) {
    for (let q = p + 1; q < lines.length; q += 1) {
      const a = lines[p];
      const b = lines[q];
      // Chỉ cặp vuông góc: hai tuyến song song sát nhau là hai chiều của cùng một con phố.
      if (horizontal(a) === horizontal(b)) continue;
      const den = a.tx * b.tz - a.tz * b.tx;
      if (Math.abs(den) < 1e-6) continue;
      const ox = b.ax - a.ax;
      const oz = b.az - a.az;
      // `t` và `u` là **mét** dọc tuyến (vector chỉ phương đã chuẩn hoá).
      const t = (ox * b.tz - oz * b.tx) / den;
      const u = (ox * a.tz - oz * a.tx) / den;
      if (t <= 0 || u <= 0 || t >= a.len || u >= b.len) continue;
      const x = a.ax + a.tx * t;
      const z = a.az + a.tz * t;
      // Chỗ nối nằm trong đất map chuẩn thì bỏ: ở đó là giao lộ thật của map dựng tay.
      if (inRealWorld(x, z, 8)) continue;
      // Ngã tư quá sát đầu tuyến thì bỏ, đừng tạo đoạn 3 m.
      if (t < MIN_SEGMENT_M || a.len - t < MIN_SEGMENT_M) continue;
      if (u < MIN_SEGMENT_M || b.len - u < MIN_SEGMENT_M) continue;
      const junction = `CTYJ_${Math.min(a.i, b.i)}_${Math.max(a.i, b.i)}`;
      // Nửa hộp ngã tư: đủ rộng cho cung Bezier, đủ hẹp để không ăn mất đoạn phố.
      const pad = Math.min(JUNCTION_REACH_M / 2, Math.min(a.st.widthM, b.st.widthM) * 0.9);
      cuts.get(a.i)!.push({ s: t, junction, pad, end: false });
      cuts.get(b.i)!.push({ s: u, junction, pad, end: false });
    }
  }

  // 3. Cổng của map chuẩn (`END_*`): nối ở bước 6, sau khi đã có đầu đoạn thật để so khoảng cách.
  const portals: string[] = [];
  const portalLinks: Array<{ node: string; edge: string; out: string; back: string }> = [];

  // 4. Đoạn đường: giữa hai chỗ cắt liên tiếp, hai làn ngược chiều, node hai đầu là giao lộ.
  const edgeIds: string[] = [];
  const segments: Array<{ edgeId: string; corridor: number; lane: "A" | "B"; from: string; to: string }> = [];
  /** Toạ độ thật của hai đầu từng đoạn — để nối cổng vào đúng đầu gần nhất. */
  const endpoints: Array<{ node: string; edgeId: string; atStart: boolean; x: number; z: number }> = [];
  let totalLen = 0;
  for (const l of lines) {
    const ordered = [...cuts.get(l.i)!].sort((p, q) => p.s - q.s);
    const rx = -l.tz;
    const rz = l.tx;
    // Bề rộng cả mặt đường (hai chiều chung), và nửa-bề-rộng của **một chiều** để đặt làn.
    const carriage = Math.max(3.2, l.st.widthM); // = 12,8 cho phố, 21,2 cho đại lộ
    const speed = l.st.klass === "avenue" ? 13.9 : 11.1;
    const axis = horizontal(l) ? "ew" : "ns";

    for (let k = 0; k < ordered.length - 1; k += 1) {
      const a = ordered[k];
      const b = ordered[k + 1];
      const s0 = a.s + a.pad;
      const s1 = b.s - b.pad;
      if (s1 - s0 < 12) continue;
      for (const dir of ["A", "B"] as const) {
        const sign = dir === "A" ? 1 : -1;
        // TÂM ĐƯỜNG = TIM TUYẾN, KHÔNG PHẢI TIM *NỬA* ĐƯỜNG.
        //
        // Bản trước đặt hai cạnh cách tim tuyến `widthM / 4` (≈3,2 m cho phố 12,8 m), tức hai làn
        // cách nhau 6,4 m và mang bề rộng `carriage = widthM / 2 - 0,6` — biến cả con phố 12,8 m
        // thành **hai con phố 5,8 m** nằm cạnh nhau, giữa là 6,4 m đất trống. Đó là "tuyến đường
        // ngổn ngang, thiếu nguyên tắc" và cũng là lý do nhìn từ trên xuống thấy xe chạy hai bên
        // hè khác nhau.
        //
        // Giờ: mỗi cạnh là **một chiều** của cùng mặt đường, tâm cạnh = tim tuyến, bề rộng = cả
        // `carriage`; làn xe lệch ±`carriage / 4` quanh tim, đúng khổ 12,8 m của `roadSpec`.
        const near0 = { x: l.ax + l.tx * s0, z: l.az + l.tz * s0 };
        const near1 = { x: l.ax + l.tx * s1, z: l.az + l.tz * s1 };
        const id = `CTY_${l.i}_${k}_${dir}`;
        graph.addCityEdge({
          id,
          streetName: l.st.name,
          // Làn A đi theo chiều tăng dọc tuyến, làn B ngược lại; node đầu/cuối là giao lộ tương ứng,
          // nên `deriveSignalApproaches` thấy được nhánh vào của mọi ngã tư.
          fromNode: dir === "A" ? a.junction : b.junction,
          toNode: dir === "A" ? b.junction : a.junction,
          axis,
          start: dir === "A" ? near0 : near1,
          end: dir === "A" ? near1 : near0,
          width: carriage,
          speedLimit: speed,
          // Làn gán ngay sau `addCityEdge` (cần `r` đã dựng xong) — xem khối ngay dưới.
          carLaneOffsets: [0, 0],
          motoLatRange: [0, 0],
        });
        // LÀN XE: MỘT CHIỀU = MỘT NỬA ĐƯỜNG, PHÍA BÊN PHẢI HƯỚNG ĐI.
        //
        // `addCityEdge` tự tính `r = normalize(−t.z, t.x)` từ `start/end`. Với cạnh dọc tuyến z,
        // `_A` có `r = (−1, 0)` còn `_B` có `r = (+1, 0)` — nên "cùng một công thức dấu" không thể
        // đúng cho cả hai. Điều cần là: làn nằm ở nửa đường bên phải hướng đi, tức **phía `+r` của
        // chính cạnh đó**. Vì `_A` và `_B` có `r` trái dấu, hai dòng xe tự động ra hai nửa đường
        // ngược nhau — đối xứng qua tim tuyến, đúng quy ước đi bên phải.
        //
        // Lệch lớn nhất là 0,46 × bề rộng xe chạy (≈5,9 m cho phố 12,8 m) < nửa bề rộng (6,4 m),
        // nên không làn nào tràn sang hè.
        // LÀN XE: MỘT CHIỀU = MỘT NỬA ĐƯỜNG — và dấu phải **GIỐNG NHAU** cho cả hai chiều.
        //
        // Đo bằng xe thật chạy (test `laneSide`, đọc `latOffset` sau khi spawn): hai cạnh `_A` và `_B`
        // của cùng một tuyến có pháp tuyến `r` **ngược dấu nhau** (A: `r = (−1,0)`, B: `r = (+1,0)` với
        // phố chạy theo z), vì `addCityEdge` tự suy `r` từ `start → end` của từng cạnh. Nên cùng một
        // giá trị `lat` dương đặt A và B ở **hai nửa đường khác nhau**.
        //
        // Lịch sử: tôi đã hai lần thêm `× sign` (theo `dir`, rồi theo `r`) và cả hai lần đều đẩy hai
        // dòng xe về **một bên** vỉa — A ở −6,78 m, B ở −7,67 m, hai dòng xe chồng lên nhau. Đó
        // đúng là "xe đi ngược chiều" nhìn thấy trên ảnh. Bản đúng là KHÔNG nhân dấu gì cả.
        //
        // Lệch lớn nhất 0,46 × bề rộng xe chạy ≤ 5,9 m cho phố 12,8 m (< nửa bề rộng 6,4 m), nên
        // không làn nào tràn sang hè.
        const built = graph.edges.get(id);
        if (built) {
          built.carLaneOffsets = [carriage * 0.16, carriage * 0.32];
          // Xe máy đi sát bó vỉa phía phải hơn ô tô — thói quen Sài Gòn.
          built.motoLatRange = [carriage * 0.26, carriage * 0.46];
        }
        const from = dir === "A" ? a.junction : b.junction;
        const to = dir === "A" ? b.junction : a.junction;
        segments.push({ edgeId: id, corridor: l.i, lane: dir, from, to });
        const p0 = dir === "A" ? near0 : near1;
        const p1 = dir === "A" ? near1 : near0;
        endpoints.push({ node: from, edgeId: id, atStart: true, x: p0.x, z: p0.z });
        endpoints.push({ node: to, edgeId: id, atStart: false, x: p1.x, z: p1.z });
        edgeIds.push(id);
        totalLen += s1 - s0;
      }
    }
  }

  // 5. Giao lộ: gom nhánh vào/ra rồi nối những cặp "đi tiếp" (tích vô hướng > 0). Ở đầu cụt của cả
  //    tuyến thì nối thêm cung quay đầu, nên xe không bao giờ biến mất ở cuối đường.
  const junctionIds = new Set<string>();
  for (const list of cuts.values()) for (const c of list) junctionIds.add(c.junction);
  const position = new Map<string, { x: number; z: number; n: number }>();
  for (const s of segments) {
    const edge = graph.edges.get(s.edgeId);
    if (!edge) continue;
    for (const [node, point] of [
      [s.from, edge.start],
      [s.to, edge.end],
    ] as const) {
      const cur = position.get(node);
      if (cur) {
        cur.x += point.x;
        cur.z += point.z;
        cur.n += 1;
      } else {
        position.set(node, { x: point.x, z: point.z, n: 1 });
      }
    }
  }

  const junctions: Array<{ id: string; x: number; z: number }> = [];
  for (const node of junctionIds) {
    const pos = position.get(node);
    if (!pos) continue;
    const incoming = segments.filter((s) => s.to === node);
    const outgoing = segments.filter((s) => s.from === node);
    if (!incoming.length || !outgoing.length) continue;
    const isEnd = node.startsWith("CTYEND_");
    const centre = { x: pos.x / pos.n, z: pos.z / pos.n, n: pos.n };
    const streetName = lineOf.get(segments.find((s) => s.to === node || s.from === node)?.corridor ?? 0)?.st.name ?? "";
    graph.addCityIntersection({
      id: node,
      name: isEnd ? `${streetName} (quay đầu)` : `${streetName} (ngã tư)`,
      center: { x: centre.x, z: centre.z },
      signalized: false,
      phaseOffset: 0,
      nsGreenSec: 16,
      ewGreenSec: 14,
      amberSec: 3,
      allRedSec: 1.8,
    });
    let linked = 0;
    for (const from of incoming) {
      const fromEdge = graph.edges.get(from.edgeId);
      if (!fromEdge) continue;
      for (const to of outgoing) {
        const toEdge = graph.edges.get(to.edgeId);
        if (!toEdge) continue;
        const dot = fromEdge.tx * toEdge.tx + fromEdge.tz * toEdge.tz;
        if (from.corridor === to.corridor) {
          // Cùng con phố: đi tiếp qua hộp ngã tư, hoặc quay đầu ở đầu cụt.
          if (dot > 0.5) {
            if (graph.addCityLink(node, from.edgeId, to.edgeId, "straight")) linked += 1;
          } else if (isEnd && dot < -0.5) {
            if (graph.addCityLink(node, from.edgeId, to.edgeId, "uturn")) linked += 1;
          }
          continue;
        }
        // Hai con phố khác nhau: đây là **rẽ**. Phân loại theo dấu tích có hướng để engine dùng đúng
        // tốc độ vào cua (`right` 5,8 m/s, `left` 6,6 m/s) thay vì chạy thẳng băng qua ngã tư.
        // Hướng (1,0) sang (0,1) là rẽ phải trong hệ trục +Z nam (lái bên phải).
        if (dot < -0.85) continue; // hai chiều đối nhau: đó là chỗ quay đầu, không phải cung rẽ
        const cross = fromEdge.tx * toEdge.tz - fromEdge.tz * toEdge.tx;
        const kind = Math.abs(cross) < 0.35 ? "straight" : cross > 0 ? "right" : "left";
        if (graph.addCityLink(node, from.edgeId, to.edgeId, kind)) linked += 1;
      }
    }
    if (!linked) {
      graph.intersections.delete(node);
      continue;
    }
    junctions.push({ id: node, x: centre.x, z: centre.z });
  }

  // 6. NỐI CỔNG CỦA MAP CHUẨN VÀO LƯỚI.
  //
  //    Đồ thị gốc cụt ở năm `END_*` — đó chính là chỗ phố thủ tục tiếp quản đường. Tuyến thành phố gần
  //    cổng nhất, cùng trục và cùng chiều, nhận cung nối vào; làn ngược lại nhận cung quay về. Khoảng
  //    cách thường chỉ vài mét (`END_LTT_S` z = 46 với đầu tuyến Lý Thái Tổ z = 57 sau khi cắt ở mép
  //    đất map), nên cung Bezier gần như thẳng — đúng cảnh rời hẻm 462/14 ra đại lộ.
  //
  //    Nối bằng cung của engine (không thêm hình học nào), nên xe buýt 06 và xe thành phố dùng chung
  //    luật: đèn, nhường đường, ACC/IDM+.
  for (const portal of PORTALS) {
    if (!graph.intersections.has(portal.node)) continue;
    const anchor = graph.edges.get(portal.edge);
    if (!anchor) continue;
    const centre = anchor.toNode === portal.node ? anchor.end : anchor.start;
    let out: { edgeId: string; dist: number } | null = null;
    let back: { edgeId: string; dist: number } | null = null;
    for (const ep of endpoints) {
      const edge = graph.edges.get(ep.edgeId);
      if (!edge) continue;
      const ahead = (ep.x - centre.x) * portal.heading.x + (ep.z - centre.z) * portal.heading.z;
      if (ahead < 0) continue; // đầu đoạn nằm sau cổng: không nối
      const dist = Math.hypot(ep.x - centre.x, ep.z - centre.z);
      if (dist > 40) continue;
      const along = edge.tx * portal.heading.x + edge.tz * portal.heading.z;
      if (along > 0.9 && (!out || dist < out.dist)) out = { edgeId: ep.edgeId, dist };
      else if (along < -0.9 && (!back || dist < back.dist)) back = { edgeId: ep.edgeId, dist };
    }
    if (!out || !back) continue;
    portals.push(portal.node);
    portalLinks.push({ node: portal.node, edge: portal.edge, out: out.edgeId, back: back.edgeId });
  }

  /** Chiều ngược của một làn (`_NB` ↔ `_SB`, `_EB` ↔ `_WB`). */
  const twinOf = (id: string) =>
    id.endsWith("_EB")
      ? id.replace(/_EB$/, "_WB")
      : id.endsWith("_WB")
        ? id.replace(/_WB$/, "_EB")
        : id.endsWith("_NB")
          ? id.replace(/_NB$/, "_SB")
          : id.replace(/_SB$/, "_NB");

  for (const link of portalLinks) {
    // Ra khỏi map chuẩn: xe (và Bus 06) đi tiếp vào làn `out` của phố thành phố.
    graph.addCityLink(link.node, link.edge, link.out, "straight");
    // Về map chuẩn: làn `back` chạy về cổng, rồi nhập vào chiều ngược của đường dẫn tới cổng.
    graph.addCityLink(link.node, link.back, link.edge, "straight");
    const twin = twinOf(link.edge);
    if (graph.edges.has(twin)) graph.addCityLink(link.node, link.back, twin, "straight");
  }

  return { corridors: candidates.length, edgeIds, junctions, portals, lengthM: totalLen };
}
