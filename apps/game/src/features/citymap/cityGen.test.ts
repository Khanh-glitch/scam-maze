// Khoá hình dạng bản đồ thành phố 1:8 để các con số trong `docs/product/CITY_MAP.md` còn đúng.
//
// Test này dựng thành phố bằng chính `generateCity()` mà game dùng, rồi kiểm những thứ người chơi
// sẽ va phải: đi được liền một mảnh, POI đứng được, không có nhà lơ lửng trên sông, mặt phố có nhà,
// và mọi toà đều biết mình mở ra đường nào. Nếu cố ý đổi hình dạng: chạy
// `node apps/game/scripts/city-audit.ts`, rồi cập nhật `docs/product/CITY_MAP.md`.
import { describe, expect, it } from "vitest";
import { cellAt, generateCity, isWalkable, type City } from "./cityGen";

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

  it("diện tích đi được nằm trong khung 0,30–0,43 km²", () => {
    expect(walkableKm2).toBeGreaterThan(0.3);
    expect(walkableKm2).toBeLessThan(0.43);
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
    expect(city.metrics.frontageBuiltPct).toBeGreaterThanOrEqual(55);
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

  it("có đủ mốc thật để người chơi nhận ra Sài Gòn", () => {
    const anchors = new Set(city.pois.filter((p) => p.anchor).map((p) => p.anchor));
    for (const id of ["landmark81", "bitexco", "ben-thanh", "binh-tay", "tao-dan"]) {
      expect(anchors.has(id)).toBe(true);
    }
    expect(city.metrics.maxHeightM).toBeGreaterThan(300);
  });
});
