#!/usr/bin/env node
/**
 * Chụp **khung hình thật** của trang `/saigon` bằng Chromium chạy trong sandbox (SwiftShader —
 * WebGL2 bằng phần mềm), rồi lưu ảnh. Dùng khi cần *nhìn* trang game chứ không chỉ nhìn mesh:
 * vân mặt tiền, bóng đổ, sương, nhãn POI, HUD — những thứ `city-mesh-preview.ts` không dựng.
 *
 * Cách dựng môi trường (không có sẵn trong repo, ~75 MB, cài ở thư mục ngoài repo):
 *   mkdir -p /tmp/shot && npm i --prefix /tmp/shot @sparticuz/chromium puppeteer-core
 *   node -e "…"   # giải nén @sparticuz/chromium/bin/*.br → /tmp/chr (xem README của gói)
 *   LD_LIBRARY_PATH=/tmp/al2023-x/lib:/tmp/chr /tmp/chr/chromium --version
 * Gói `@sparticuz/chromium` mang sẵn Chromium headless + thư viện SwiftShader, chạy được trên ảnh
 * Debian tối giản (không cần apt). Sau khi giải nén phải chép libEGL/libGLESv2 ra CẠNH binary.
 *
 * Dùng:
 *   node scripts/city-shot.mjs --url="http://127.0.0.1:4173/saigon?t=-250,-33.9&ty=2&r=10&yaw=-1.5708&pitch=-0.06&fov=56" \
 *        --out=../../docs/product/audit/_g-street.jpg --w=1152 --h=720 --wait=12000
 *
 * Tham số QA có sẵn trên trang: t=x,z · ty · r · yaw · pitch · fov · noshadow · sun · hemi · expo.
 */
import { mkdirSync } from "node:fs";
import { dirname } from "node:path";

const arg = (k, d) => {
  const hit = process.argv.find((a) => a.startsWith(`--${k}=`));
  return hit ? hit.slice(k.length + 3) : d;
};
const url = arg("url");
const out = arg("out");
if (!url || !out) {
  console.error("cần --url=... và --out=...");
  process.exit(1);
}
const W = Number(arg("w", 1152));
const H = Number(arg("h", 720));
const wait = Number(arg("wait", 12000));
const chrome = process.env.CHROME_PATH || "/tmp/chr/chromium";
const libs = process.env.CHROME_LIBS || "/tmp/al2023-x/lib:/tmp/chr";
const puppeteerEntry = process.env.PUPPETEER_CORE || "/tmp/shot/node_modules/puppeteer-core/lib/esm/puppeteer/puppeteer-core.js";

const { default: puppeteer } = await import(puppeteerEntry);
const browser = await puppeteer.launch({
  executablePath: chrome,
  headless: "shell",
  protocolTimeout: 1_800_000,
  args: [
    "--no-sandbox", "--disable-dev-shm-usage",
    "--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader",
    `--window-size=${W},${H}`,
  ],
  env: { ...process.env, LD_LIBRARY_PATH: libs },
  defaultViewport: { width: W, height: H, deviceScaleFactor: 1 },
});
const page = await browser.newPage();
page.on("pageerror", (e) => console.error("[pageerror]", e.message.slice(0, 300)));
await page.goto(url, { waitUntil: "domcontentloaded", timeout: 180_000 });
await page.waitForSelector("canvas", { timeout: 240_000 }).catch(() => console.error("không thấy canvas"));
await new Promise((r) => setTimeout(r, wait));
mkdirSync(dirname(out), { recursive: true });
const t0 = Date.now();
await page.screenshot({ path: out, type: out.endsWith(".png") ? "png" : "jpeg", quality: 90, captureBeyondViewport: false });
console.log(`chụp ${Date.now() - t0} ms → ${out}`);
await browser.close();