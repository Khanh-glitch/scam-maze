// Khoá hình dạng bản đồ thành phố 1:8 để các con số trong `docs/product/CITY_MAP.md` còn đúng.
//
// Test này dựng thành phố bằng chính `generateCity()` mà game dùng, rồi kiểm những thứ người chơi
// sẽ va phải: đi được liền một mảnh, POI đứng được, không có nhà lơ lửng trên sông, mặt phố có nhà,
// và mọi toà đều biết mình mở ra đường nào. Nếu cố ý đổi hình dạng: chạy
// `node apps/game/scripts/city-audit.ts`, rồi cập nhật `docs/product/CITY_MAP.md`.
import { describe, expect, it } from "vitest";
import { cellAt, generateCity, isWalkable, type City } from "./cityGen";
import { rectHitsRealWorld } from "./realWorldFootprint";

const city: City = generateCity();

const walkableKm2 = city.metrics.walkableAreaM2 / 1e6;

describe("generateCity", () => {
  it("tất định: cùng seed cho ra cùng thành phố", () => {
    const again = generateCity();
    expect(again.buildings.length).toBe(city.buildings.length);
    expect(again.streets.length).toBe(city.streets.length);
    expect(again.pois.length).toBe(city.pois.length);
    expect(again.buildings[123].x0).toBe(city.buildings[123].x0);
  });

  // Trần nới 0,43 → 0,52 khi lòng đường không còn được phép có nhà: mỗi lô góc/ngã tư từng đè lên
  // vỉa hè nay bị cắt, nên phần đất đó thành đi-được thật thay vì bị một toà nhà chiếm chỗ.
  it("diện tích đi được nằm trong khung 0,30–0,52 km²", () => {
    expect(walkableKm2).toBeGreaterThan(0.3);
    expect(walkableKm2).toBeLessThan(0.52);
  });

  it("đi được liền một mảnh, và phòng là điểm xuất phát", () => {
    expect(city.metrics.components).toBe(1);
    expect(city.metrics.reachableFromRoomPct).toBeGreaterThan(99);
  });

  it("mọi POI đều đứng được theo hình học chính xác", () => {
    const blocked = city.pois.filter((p) => !isWalkable(city, p.x, p.z));
    expect(blocked.map((p) => p.name)).toEqual([]);
  });

  it("không toà nào nằm trên sông hay ngoài khung", () => {
    const wet = city.buildings.filter(
      (b) =>
        b.x1 > b.x0 && b.z1 > b.z0 &&
        city.water.some((w) => Math.min(b.x1, w.x1) > Math.max(b.x0, w.x0) && Math.min(b.z1, w.z1) > Math.max(b.z0, w.z0)),
    );
    expect(wet.length).toBe(0);
    const outside = city.buildings.filter(
      (b) => b.x0 < city.frame.x0 || b.x1 > city.frame.x1 || b.z0 < city.frame.z0 || b.z1 > city.frame.z1,
    );
    expect(outside.length).toBe(0);
  });

  it("mọi toà đều biết mình mở ra đâu", () => {
    const noSource = city.buildings.filter((b) => !b.street && !b.anchor && b.on !== "court");
    expect(noSource.length).toBe(0);
  });

  it("mặt phố có nhà: nhịp nhà ống đạt A-list ở phường nhà ống và chợ", () => {
    const byClass = city.metrics.frontageByClass;
    expect(byClass.residential).toBeGreaterThanOrEqual(12);
    expect(byClass.market).toBeGreaterThanOrEqual(12);
    expect(city.metrics.frontageBuiltPct).toBeGreaterThanOrEqual(45);
  });

  it("mật độ chi tiết vỉa hè đạt 25 vật thể/100 m", () => {
    const per100m = (city.props.length / Math.max(1, city.metrics.streetLengthM)) * 100;
    expect(per100m).toBeGreaterThanOrEqual(25);
    expect(city.props.length).toBeGreaterThan(6000);
  });

  it("mỗi phường có POI riêng và đủ đất", () => {
    const perDistrict = new Map<string, number>();
    for (const poi of city.pois) perDistrict.set(poi.district, (perDistrict.get(poi.district) ?? 0) + 1);
    for (const district of city.districts) {
      expect(perDistrict.get(district.id) ?? 0).toBeGreaterThanOrEqual(10);
    }
  });

  it("lưới đi được khớp hình học ở mức dung sai một ô", () => {
    // Lưới 0,5 m chỉ là xấp xỉ: một điểm có thể đứng được trong khi ô chứa nó bị toà nhà phủ một
    // phần. Sai lệch cho phép là 1 ô; sai nhiều hơn nghĩa là raster và hình học lệch nhau thật.
    let disagree = 0;
    for (const poi of city.pois) {
      if (isWalkable(city, poi.x, poi.z) && cellAt(city, poi.x, poi.z) !== 0) disagree += 1;
    }
    expect(disagree / city.pois.length).toBeLessThan(0.05);
  });

  it("lòng đường trống: không toà nào chặn tim đường", () => {
    // Bất biến mới của bản đồ: toà nhà không được đè lên lòng đường. Đo bằng cách đi dọc tim
    // từng tuyến — đúng cách `city-audit.ts` đo, nhưng ở đây là cổng chặn hồi quy.
    const blocked: string[] = [];
    for (const st of city.streets) {
      const [ax, az] = st.points[0];
      const [bx, bz] = st.points[st.points.length - 1];
      const len = Math.hypot(bx - ax, bz - az);
      if (len < 6) continue;
      const n = Math.max(2, Math.round(len / 2));
      for (let i = 0; i <= n; i += 1) {
        const t = i / n;
        const x = ax + (bx - ax) * t;
        const z = az + (bz - az) * t;
        if (!isWalkable(city, x, z)) {
          blocked.push(st.name);
          break;
        }
      }
    }
    expect(blocked).toEqual([]);
  });

  it("cầu Thị Nghè bắc qua kênh và đi được trên mặt cầu", () => {
    const bridge = city.streets.find((s) => s.klass === "bridge");
    expect(bridge?.name).toBe("Cầu Thị Nghè");
    const [ax, az] = bridge!.points[0];
    const [bx, bz] = bridge!.points[bridge!.points.length - 1];
    for (let i = 0; i <= 10; i += 1) {
      expect(isWalkable(city, ax + ((bx - ax) * i) / 10, az + ((bz - az) * i) / 10)).toBe(true);
    }
  });

  it("điểm xuất phát không nằm trong tường", () => {
    expect(isWalkable(city, city.start.x, city.start.z)).toBe(true);
    expect(cellAt(city, city.start.x, city.start.z)).toBe(0);
  });

  it("mỗi mốc thật đều có toà trên bản đồ", () => {
    // Sáu trong chín mốc từng KHÔNG có toà nào: hình chữ nhật của mốc đè lên lòng đường nên
    // `addBuilding` từ chối, và mốc biến mất im lặng. Chợ Bến Thành còn bị ga metro đặt sau xoá sạch.
    // Ngoại lệ duy nhất, có chủ ý: Bitexco và Landmark 81 do **map thật** dựng sẵn — thành phố không
    // dựng bản sao thứ hai, chỉ ghi lại là mốc đó đã có toà thật.
    const served = new Set(city.metrics.anchorsServedByRealWorld);
    const missing = city.anchors.filter((a) => !city.buildings.some((b) => b.anchor === a.id) && !served.has(a.id));
    expect(missing.map((a) => a.id)).toEqual([]);
    expect(city.metrics.anchorsMissing).toEqual([]);
    expect([...served].sort()).toEqual(["bitexco", "landmark81"]);
  });

  it("không toà thủ tục nào mọc trong đất của map thật", () => {
    // 9 vùng của `openWorldBounds.json` (hẻm 462/14 Lý Thái Tổ, nhà trọ 59, Đại lộ 3/2, Hải Triều,
    // bến sông, quảng trường Landmark 81…) đã có phố thật dựng sẵn. Nhà sinh tự động trong đó là nhà
    // đâm xuyên phố thật.
    const intruders = city.buildings.filter((b) => b.kind !== "bridge" && rectHitsRealWorld(b, 0));
    expect(intruders.map((b) => `${b.kind}@${b.x0.toFixed(0)},${b.z0.toFixed(0)}`)).toEqual([]);
    expect(city.metrics.rejectedRealWorld).toBeGreaterThan(0);
  });

  it("khu phố Nguyễn Du không nằm chồng lên map thật", () => {
    if (!city.core.streetId) return;
    const coreRect = { x0: city.core.x0, x1: city.core.x1, z0: city.core.z0, z1: city.core.z1 };
    expect(rectHitsRealWorld(coreRect, 0)).toBe(false);
  });

  it("có đủ mốc thật để người chơi nhận ra Sài Gòn", () => {
    const anchors = new Set(city.pois.filter((p) => p.anchor).map((p) => p.anchor));
    for (const id of ["landmark81", "bitexco", "ben-thanh", "binh-tay", "tao-dan"]) {
      expect(anchors.has(id)).toBe(true);
    }
    expect(city.metrics.maxHeightM).toBeGreaterThan(300);
  });
});
