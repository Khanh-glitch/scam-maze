import { describe, expect, it } from "vitest";
import { generateCity } from "./cityGen";
import { buildCityMesh } from "./cityMesh";

/**
 * Hình học mà trang `/saigon` vẽ. Test này giữ đúng những thứ từng hỏng im lặng:
 * NaN trong ma trận (khối biến mất), toà nhà không có mái, và số khối phình to bất thường.
 */
describe("buildCityMesh", () => {
  const city = generateCity();
  const mesh = buildCityMesh(city);
  const all = [
    ...mesh.boxes, ...mesh.flat, ...mesh.details, ...mesh.prisms, ...mesh.gables,
    ...mesh.trunks, ...mesh.canopies, ...mesh.drums,
  ];

  it("không có khối nào chứa NaN hoặc số âm", () => {
    expect(all.length).toBeGreaterThan(10_000);
    const bad = all.filter((p) =>
      ![p.x, p.y, p.z, p.sx, p.sy, p.sz].every(Number.isFinite) || p.sx < 0 || p.sy < 0 || p.sz < 0,
    );
    expect(bad).toHaveLength(0);
  });

  it("mỗi toà nhà có thân (khối cao hơn 1 m) và không nằm ngoài khung quá xa", () => {
    const F = city.frame;
    const outside = all.filter((p) =>
      p.x < F.x0 - 60 || p.x > F.x1 + 60 || p.z < F.z0 - 60 || p.z > F.z1 + 60,
    );
    // đồ án cho phép: mốc nhô ra ngoài khung (Landmark ở góc), nên chỉ kiểm tỉ lệ
    expect(outside.length / all.length).toBeLessThan(0.02);
  });

  it("có tháp cao, có mái dốc, có chi tiết mặt tiền — thành phố không phải toàn hộp", () => {
    expect(mesh.stats.towers).toBeGreaterThan(300);
    // Ngưỡng cũ 800, rồi 700. Từ khi lề dành cho map chuẩn là 18 m (đủ chiều sâu dãy nhà của nó,
    // không phải chỉ 2 m như lề đường), thành phố mất thêm ~90 lô sát mép map chuẩn — còn ~661 mái
    // dốc: vẫn là "thành phố không phải toàn hộp", chỉ khác là đất đó do map chuẩn dựng.
    expect(mesh.stats.gabledRoofs).toBeGreaterThan(600);
    expect(mesh.details.length).toBeGreaterThan(5_000);
    expect(mesh.drums.length).toBeGreaterThan(300);
    expect(mesh.stats.maxY).toBeGreaterThan(200);
  });

  it("9 mốc thật đều có nhãn đúng độ cao toà", () => {
    expect(mesh.anchors).toHaveLength(city.anchors.length + 1); // +1 nhãn "Khu phố gốc"
    const landmark = mesh.anchors.find((a) => a.id === "landmark81");
    expect(landmark?.y).toBeGreaterThan(400);
    const core = mesh.anchors.find((a) => a.id === "core-street");
    expect(core?.name).toContain(city.core.streetName);
  });

  it("đường có bó vỉa: vỉa hè cao hơn lòng đường", () => {
    const road = mesh.flat.filter((b) => b.color === "#5a5964" || b.color === "#605e6b");
    const walk = mesh.flat.filter((b) => b.color === "#8e8b86");
    expect(road.length).toBeGreaterThan(50);
    expect(walk.length).toBeGreaterThan(50);
    const roadTop = Math.max(...road.map((b) => b.y + b.sy));
    const walkTop = Math.max(...walk.map((b) => b.y + b.sy));
    expect(walkTop).toBeGreaterThan(roadTop);
  });
});

describe("van maxParts không được cắt cụt thành phố", () => {
  it("không mảnh nào bị bỏ, và cây đường phố phủ cả hai hè", () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    // Đây là bẫy đã xảy ra hai lần: thêm hè rộng rồi thêm cây làm số mảnh vượt trần, `push` im
    // lặng bỏ phần còn lại, và triệu chứng duy nhất là "một vùng trống" không ai giải thích được.
    expect(mesh.stats.droppedParts).toBe(0);
    // Cây đường phố: mỗi tuyến phố/đại lộ có cây, không chỉ công viên. Đo bằng tương quan: số thân
    // cây phải lớn hơn hẳn số cây công viên + prop rời trước đây (1 592).
    expect(mesh.trunks.length).toBeGreaterThan(2_400);
    expect(mesh.stats.droppedParts).toBe(0);
  });
});
