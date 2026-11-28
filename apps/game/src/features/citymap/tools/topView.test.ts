import { describe, expect, it } from "vitest";
import { mkdirSync, writeFileSync } from "node:fs";
import sharp from "sharp";
import { generateCity } from "../cityGen";
import { buildCityMesh } from "../cityMesh";
import { renderCityTopView } from "./topView";
import { diagnosePlan } from "./planAudit";

/**
 * XUẤT ẢNH MẶT BẰNG + CHẨN ĐOÁN, từ dữ liệu hình học thật.
 *
 * Chạy: `npx vitest run src/features/citymap/tools/topView.test.ts`
 * Xuất: apps/game/docs/product/audit/city-top.png (+ .json)
 *
 * Đây là "mắt" của phiên làm việc: không có GPU, nhưng lỗi mặt bằng (đường xuyên nhà, nhà chồng
 * nhau, tuyến ngổn ngang) nhìn thấy được ngay trên ảnh này.
 */
describe("ảnh mặt bằng thành phố", () => {
  it("xuất PNG + chẩn đoán", async () => {
    const city = generateCity(undefined, { realWorld: true });
    const mesh = buildCityMesh(city);
    const view = renderCityTopView(city, mesh, { pxPerM: 1.6 });
    const out = "docs/product/audit";
    mkdirSync(out, { recursive: true });
    await sharp(Buffer.from(view.data), {
      raw: { width: view.width, height: view.height, channels: 4 },
    })
      .png()
      .toFile(`${out}/city-top.png`);

    const findings = diagnosePlan(city);
    writeFileSync(`${out}/city-top.json`, JSON.stringify(findings, null, 2));
    console.log(JSON.stringify(findings.report, null, 2));
    if (findings.worst.length) console.log("chồng nặng nhất:", JSON.stringify(findings.worst.slice(0, 6)));
    if (findings.intrudeWorst.length) console.log("lấn đường:", JSON.stringify(findings.intrudeWorst.slice(0, 6)));
    if (findings.throughAt.length) console.log("tuyến trong nhà:", findings.throughAt.slice(0, 8).join(" | "));

    // Ảnh phải thật sự có nội dung: nếu chỉ một màu thì công cụ hỏng, không phải thành phố đẹp.
    const stats = await sharp(`${out}/city-top.png`).stats();
    expect(stats.channels[0].stdev).toBeGreaterThan(8);
  });
});
