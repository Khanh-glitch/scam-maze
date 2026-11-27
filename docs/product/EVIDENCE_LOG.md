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

### T10 · Kiến trúc + brief cho owner · 27/11/2026

| Việc | Kết quả |
|---|---|
| Owner chốt | Owner tự sáng tác/thu; game là bộ phát file (phương án procedural bị bỏ) |
| Brief | `docs/gameplay/MUSIC_BRIEF.md`: 7 cue, thể loại, BPM/tone, số ô, vị trí file, chuẩn kỹ thuật, nghiệm thu A1–A8 |
| Manifest | `apps/game/src/game/audio/musicManifest.json`: 7 cue; loop length lần lượt 98,5 s / 62,6 s / 91,4 s / 87,3 s; one-shot 53–75 s, 60–90 s, 55–80 s; ngưỡng tense `security ≤ 60`, `≤ 360 phút`; duck −6 dB; crossfade 1,5 / 2,5 / 4 / 0,8 s |

### T11 · Manifest + chọn cue · 27/11/2026

| Việc | Lệnh | Kết quả |
|---|---|---|
| Test module nhạc | `vitest run src/game/audio` | **19 test** xanh (manifest 8, chọn cue/tense/crossfade 11) |
| Đồng bộ brief ↔ manifest | test `keeps the composers' brief in sync with the manifest` | Brief chứa đủ 7 id + 7 tên file + thư mục + loudness |
| Bất biến dữ liệu | test manifest | Không trùng file/priority; loop = đúng số ô; one-shot có cửa sổ độ dài; gain 0..1 |

### T13 · `MusicPlayer` · 27/11/2026

| Việc | Lệnh | Kết quả |
|---|---|---|
| Player đọc file theo manifest | `vitest run src/game/audio/musicPlayer.test.ts` | **8 test**: loop đúng cue, không khởi động lại cue đang phát, crossfade dừng source cũ đúng thời điểm, one-shot không loop, volume/mute/duck, file thiếu = im và không fetch lại, dispose dừng + đóng context |
| Không có AudioContext (jsdom) | test `stays silent without an audio context` | Không throw; `currentCue()` vẫn ghi nhận cue; `isSilent()` = true |
| Tải file | `fetch(url)` → `decodeAudioData`; cache theo cue; lỗi 404 chỉ cảnh báo một lần | Không có request lặp lại mỗi frame |

### T14 · Nối vào chương · 27/11/2026

| Việc | Lệnh | Kết quả |
|---|---|---|
| Hook chọn cue | `vitest run src/features/chapter1/room/useChapterMusic.test.ts` | **7 test**: phòng yên/căng, phố, buýt, kết thúc (fade 4 s), menu = dừng, duck theo voice, mute/volume |
| Nối vào layer | `RoomChapterLayer.music.test.tsx` | **4 test**: intro → theme; ra phố → street; lên buýt → ride; `engineReady=false` → không phát; settings đi qua đúng |
| Gắn dữ liệu thật | `state.resources.digitalSecurity`, `state.resources.timeMinutes`, `callOpen`, `alexVoice`, `lineVoiceActive` | Ngưỡng tense lấy từ manifest (`security ≤ 60`, `timeMinutes ≤ 360`) |
| Nguồn cảnh | `outdoors` + `onBus` (mới thêm vào `OutsideWorldState`, tuỳ chọn) | Buýt 06 dùng cue `ride` |
| Cổng chung | `vitest run` · `tsc -b` · `vite build` | **285 file / 2.567 test** xanh · tsc sạch · build 10,26 s |
| Nghe thật | — | **Chưa** (chưa có file nhạc). A5–A7 sẽ nghiệm thu khi owner giao file |

### T12 · Bộ kiểm tra file · 27/11/2026

| Việc | Lệnh | Kết quả |
|---|---|---|
| Thư mục rỗng | `pnpm --filter @scammaze/game music:check` | `0/7 file có mặt · 0 lỗi · 7 cảnh báo`, exit 0 |
| ffprobe | — | Không có trong môi trường → script tự ghi chú và bỏ qua kiểm độ dài/bitrate/kênh |
| Cổng chung | `vitest run` · `tsc -b` · `vite build` | **282 file / 2.545 test** xanh · tsc sạch · build sạch |

## M2 — Bản đồ

_(chưa có dòng; sẽ thêm khi T20–T29 xong: hash generator, fps 3 điểm, walkthrough 12 phút)_

## M3 — Nhiệm vụ lẻ & nhánh truyện

_(chưa có dòng; sẽ thêm khi T30–T40 xong: 5 playthrough, reachability, ảnh debrief)_
