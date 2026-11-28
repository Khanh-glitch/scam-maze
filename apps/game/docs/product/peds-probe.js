/**
 * ĐO THẬT TRÊN TRÌNH DUYỆT (chạy trong console của `/saigon`).
 *
 * Không dùng headless browser được (sandbox không GPU), nên con số "có người đi bộ thật trên hè"
 * phải lấy từ chính trang đang chạy. Dán cả file này vào console, nó đọc `window.__saigonEngine`.
 *
 * Điều nó chứng minh: người đi bộ **di chuyển** (không đứng yên ở gốc toạ độ), đi **trên hè**
 * (y = 0,24 chứ không phải 0), và con số khớp với `__saigonEngine.peds`.
 */
(() => {
  const dbg = window.__saigonEngine;
  if (!dbg) return console.warn("chưa có __saigonEngine — trang chưa dựng xong");
  const scene = dbg.scene;
  const roots = [];
  scene.traverse((o) => {
    if (o.name && o.name.startsWith("city-ped-")) roots.push(o);
  });
  if (!roots.length) return console.warn("không thấy city-ped-* trong scene");

  const snap = () => roots.map((r) => ({ x: r.position.x, y: r.position.y, z: r.position.z }));

  // Bảng 1: vị trí + cao độ ngay bây giờ.
  const a = snap();
  const onSidewalk = a.filter((p) => Math.abs(p.y - 0.24) < 0.05).length;
  const movedFromOrigin = a.filter((p) => Math.hypot(p.x, p.z) > 10).length;
  const visible = roots.filter((r) => r.visible).length;
  console.table({
    "số NPC": roots.length,
    "đăng ký trong brain": dbg.peds,
    "đứng đúng cao độ hè (y≈0,24)": onSidewalk,
    "cách gốc toạ độ > 10 m": movedFromOrigin,
    "đang hiển thị": visible,
    "vạch đi bộ đã đăng ký": dbg.zebras,
    "làn hè": dbg.pedestrianLanes,
  });

  // Bảng 2: sau 2 giây, người đi bộ có **thật sự bước đi** không (so vị trí)?
  const t0 = performance.now();
  setTimeout(() => {
    const b = snap();
    const dt = (performance.now() - t0) / 1000;
    let moved = 0;
    let maxD = 0;
    let sum = 0;
    for (let i = 0; i < a.length; i += 1) {
      const d = Math.hypot(b[i].x - a[i].x, b[i].z - a[i].z);
      if (d > 0.15) moved += 1;
      maxD = Math.max(maxD, d);
      sum += d;
    }
    console.table({
      "thời gian đo (s)": +dt.toFixed(2),
      "số NPC đã bước đi": moved,
      "quãng đường trung bình (m)": +(sum / a.length).toFixed(2),
      "quãng đường xa nhất (m)": +maxD.toFixed(2),
      "tốc độ trung bình (m/s)": +(sum / a.length / dt).toFixed(2),
    });
    console.info(
      moved > roots.length * 0.5
        ? "✅ đa số người đi bộ đang di chuyển"
        : "⚠️ ít người di chuyển — kiểm tra `canCross`/`patrolZMin/Max` của làn",
    );
  }, 2000);
})();
