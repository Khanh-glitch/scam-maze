# Sổ bằng chứng (evidence log)

Mỗi dòng là một lần nghiệm thu: task nào, ngày nào, đo bằng gì, kết quả ra sao. Không có dòng ở đây
thì task chưa được coi là xong. Quy ước cổng (G1–G5) ở
[UPGRADE_PLAN_MUSIC_MAP_MISSIONS.md §2](./UPGRADE_PLAN_MUSIC_MAP_MISSIONS.md#2-nguyên-tắc-nghiệm-thu-chung-dod).

Máy đo: workspace này, `pnpm@10.26.0`, Node 22, Chromium (qua Vite dev server).

---

## M0 — Chuẩn hoá

### T00 · Rubric + điểm gốc · 27/11/2026

| Việc | Lệnh / cách đo | Kết quả |
|---|---|---|
| Diện tích vùng chơi liên tục | đọc `isWithinOpenWorld` trong `apps/game/src/features/testbus/openworld/world/saigonDistricts.ts:2406-2412` | x ∈ [−25, 132], z ∈ [−356, 48] → 157 × 404 m = **0,0634 km²** |
| Số flag khai báo | `sed -n 33,122p apps/game/src/game/narrative/resources.ts \| grep -c '^  "'` | **45** |
| Flag đã được ghi | `grep -rho 'setPersistent", flag: "[a-zA-Z]*"' apps/game/src/game/narrative/chapter1/*.ts \| sort -u \| wc -l` | **37** (8 để dành) |
| Nhiệm vụ đang chạy | `apps/game/src/game/narrative/activeScenario.ts` → `LAST_SUBMISSION_SCENARIO` | M01, 2 offer, M02, parcel |
| Ending/decision trong chương đang chạy | `grep -n "decisions\|endings" apps/game/src/game/narrative/chapter1/lastSubmission.ts` | `decisions: {}`, `endings: {}` |
| Nhạc trong chương | `grep -rn "musicVolume" apps/game/src/features` | **0** kết quả; nhạc chỉ chạy khi `route === "menu"` (`app/App.tsx:504`) |
| Tài nguyên âm thanh | `find apps/game/public/assets/audio \( -name "*.mp3" -o -name "*.wav" \) \| wc -l` | **40 file / ~12 MB** |
| Tài nguyên 3D | `find apps/game/public/assets/3d -name "*.glb" \| wc -l`, `du -sh` | **41 GLB / 73 MB** |
| Bộ test hiện tại | `pnpm --filter @scammaze/game test` | 280 file / **2.526 test** xanh (đo ở commit `ef0acee`) |
| Typecheck + build | `tsc -b`, `vite build` | sạch, `✓ built in 10.12s` |

Kết luận: điểm rubric trung bình **2,2/5**. Bảng đầy đủ ở
[BENCHMARK §3](./BENCHMARK_GTA_STANDARD.md#3-hiện-trạng-điểm-và-bằng-chứng).

### T01 · Nhãn trạng thái & nguồn chuẩn · 27/11/2026

| Việc | Kết quả |
|---|---|
| Tài liệu canonical cho chất lượng | `docs/product/BENCHMARK_GTA_STANDARD.md` (mới) |
| Tài liệu canonical cho kế hoạch | `docs/product/UPGRADE_PLAN_MUSIC_MAP_MISSIONS.md` (mới) |
| Mâu thuẫn đã ghi nhận | `PRODUCT_POSITIONING.md` vẫn nói "game 3D = PLANNED, repo chỉ có landing page" — sai so với code; benchmark doc đã ghi chú, không sửa positioning (owner chưa quyết) |

### T02 · Sổ bằng chứng · 27/11/2026

| Việc | Kết quả |
|---|---|
| Tạo sổ | tài liệu này |
| Dòng đầu | T00, T01, T02 (chính nó) — mỗi dòng tái lập được bằng lệnh |

### T03 · Cổng đo tự động · `PLANNED`

Chưa làm. Khi làm: script đếm nội dung (mission/flag/POI/diện tích) + probe fps/memory, test so với
ngưỡng. Hiện các số ở T00 được đo tay, nên **chưa được dùng để tăng điểm rubric**.

### T04 · Backlog chuẩn hoá · 27/11/2026

| Việc | Kết quả |
|---|---|
| Task ID + phụ thuộc + nghiệm thu | §4–§6 của plan; 31 task (T00–T40), 5 mốc M0–M3 |
| Kiểm tra mồ côi | mỗi task có ≥ 1 dòng "Nghiệm thu"; mỗi task thuộc đúng một epic |

---

## M1 — Nhạc nền

_(chưa có dòng; sẽ thêm khi T11–T17 xong: log test director, số đo CPU, biên bản nghe 6 cue)_

## M2 — Bản đồ

_(chưa có dòng; sẽ thêm khi T20–T29 xong: hash generator, fps 3 điểm, walkthrough 12 phút)_

## M3 — Nhiệm vụ lẻ & nhánh truyện

_(chưa có dòng; sẽ thêm khi T30–T40 xong: 5 playthrough, reachability, ảnh debrief)_
