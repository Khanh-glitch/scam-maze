# Kế hoạch nâng cấp Chương 1 theo chuẩn GTA / Gangstar Vegas

> **Kế hoạch thi hành (canonical).** Đi kèm [BENCHMARK_GTA_STANDARD.md](./BENCHMARK_GTA_STANDARD.md)
> (thước đo + điểm hiện tại). Tài liệu này trả lời bốn câu: **làm gì, theo thứ tự nào, làm bằng
> cách nào, và nghiệm thu ra sao.**
>
> **Ngày:** 27/11/2026 · **Nhánh:** `arena/f56eaa67-scam-maze` · **Mốc code:** `ef0acee`
> **Thứ tự owner chốt:** ① chuẩn hoá task → ② nhạc nền → ③ map rộng hơn → ④ nhiệm vụ lẻ + nhánh
> truyện. Kế hoạch giữ nguyên thứ tự này và giải thích vì sao nó đúng về mặt kỹ thuật (§1).
> **Nhãn trạng thái:** `IMPLEMENTED` / `PLANNED` / `PROPOSED` / `PENDING` / `DEPRECATED`.

---

## 0. Tóm tắt một trang

| Mốc | Nội dung | Người chơi thấy gì | Trạng thái |
|---|---|---|---|
| **M0** | Chuẩn hoá: rubric, DoD, backlog có ID, cổng đo hiệu năng, sổ bằng chứng | Không thấy gì; nhưng từ đây mọi việc có nghiệm thu | `PLANNED` |
| **M1** | Nhạc nền thích ứng (6 cue + ducking theo voice + "Radio Alex") | Menu → phòng → phố → xe buýt → kết thúc đều có nhạc; căng thẳng đổi nhạc | `PLANNED` |
| **M2** | Bản đồ liền mạch 0,35 km², 7 quận, 5 nội thất, buýt/xe ôm nối quận | Đi bộ/buýt từ nhà trọ sang Chợ Lớn, vào tiệm in, không còn "đổi route" | `PLANNED` |
| **M3** | M03–M05 + 8 nhiệm vụ lẻ + 4 hoạt động lặp + 5 kết thúc + debrief | Chương chơi trọn 72 giờ, có việc để làm mỗi phút, có kết thúc khác nhau | `PLANNED` |

Ước lượng: **22–27 phiên làm việc** (mỗi phiên = một lượt trao đổi có commit + test xanh). Không
có deadline cứng; có **cổng chất lượng** giữa các mốc (§7).

---

## 1. Vì sao thứ tự này đúng

Thứ tự owner đưa ra không phải tuỳ ý — nó khớp với quan hệ phụ thuộc kỹ thuật:

```
        ┌──────────────────────────────┐
        │  W0  Chuẩn hoá               │  định nghĩa "xong", thước đo, backlog
        │  (rubric, DoD, perf gate)    │  → mọi W sau nghiệm thu bằng cùng một thước
        └───────────────┬──────────────┘
                        │
        ┌───────────────▼──────────────┐
        │  W1  Nhạc nền                │  độc lập với hình học; rẻ; đổi cảm giác ngay
        │  (Music Director + 6 cue)    │  chạm vào phòng/phố/xe buýt nên làm trước
        └───────────────┬──────────────┘  khi các cảnh đó chưa bị đụng bởi W2
                        │
        ┌───────────────▼──────────────┐
        │  W2  Bản đồ rộng             │  tạo KHÔNG GIAN cho nội dung
        │  (7 quận, nội thất, vận tải) │  mỗi quận mới = chỗ để đặt nhiệm vụ
        └───────────────┬──────────────┘
                        │
        ┌───────────────▼──────────────┐
        │  W3  Nhiệm vụ lẻ + nhánh     │  cần địa điểm (W2) và không khí (W1)
        │  (M03–M05, 8 side, 5 ending) │  mới "đắt" đúng nghĩa
        └──────────────────────────────┘
```

Ba lý do cụ thể:

1. **W0 trước là bắt buộc:** nếu không định nghĩa "xong" trước, ba workstream sau sẽ mỗi cái xong
   theo một kiểu, và không ai so sánh được. Đây cũng là nghĩa của "chuẩn hoá task theo thứ tự".
2. **W1 trước W2:** nhạc là việc **rẻ nhất** đổi được **nhiều cảm giác nhất** (D9 từ 1 → 3), và
   phải làm khi phòng/phố còn nguyên để đo "trước/sau". Nếu làm sau W2, mọi cue phải chỉnh lại theo
   địa hình mới.
3. **W2 trước W3:** nhiệm vụ lẻ cần **địa điểm** và **thời gian di chuyển**. Viết 8 nhiệm vụ trước
   khi có 7 quận sẽ buộc phải nhét chúng vào 2 cảnh hiện có → mất chính cái "open world" mà owner
   muốn.

**Ngoại lệ có kiểm soát:** phần **thiết kế giấy** của W3 (bảng nhiệm vụ, cây nhánh, 5 kết thúc) có
thể làm song song trong lúc W2 đang thi công, vì nó không sửa code. Việc này không phá thứ tự
"ship", chỉ rút ngắn chờ đợi.

---

## 2. Nguyên tắc nghiệm thu chung (DoD)

Một task **chỉ được đóng** khi có đủ 5 thứ, ghi vào sổ bằng chứng (§3, T02):

| # | Cổng | Nội dung | Bằng chứng |
|---|---|---|---|
| G1 | Test tự động | `pnpm --filter @scammaze/game test` xanh, có test mới cho hành vi mới | log test (số file/test) |
| G2 | Kiểu & build | `tsc -b` và `vite build` sạch | lệnh + exit code |
| G3 | Chạy thật | Preview trên dev server: bật được, không lỗi console, host preview không bị 403 | ảnh chụp + đường dẫn |
| G4 | Số đo | Chỉ số của task đạt ngưỡng trong bảng nghiệm thu riêng | log fps/bộ nhớ/thời gian |
| G5 | Nội dung | EN/VI đủ, không text cứng, không vi phạm "danh sách đỏ" (§1.2 benchmark) | `contentSafety` + `localeIndependence` test |

Quy ước đặt tên test: `<module>.test.ts` cho unit, `<module>.integration.test.tsx` cho luồng UI,
`playthroughs.test.ts` cho "chơi từ đầu đến kết thúc".

Ngân sách hiệu năng áp cho **mọi** task W2/W3 (đo trên máy dev, Chrome, 1080p):

| Chỉ số | Ngưỡng |
|---|---|
| FPS trung bình / 1% low | ≥ 60 / ≥ 45 |
| Draw call | ≤ 900 |
| Thời gian vào chơi (menu → đi được) | ≤ 15 s |
| Bộ nhớ tab | ≤ 700 MB |
| Hitch khi stream ô kế tiếp | ≤ 2 frame |

---

## 3. W0 — Chuẩn hoá task (1 phiên)

### 3.1 Việc phải làm

| ID | Việc | Phương pháp | Kết quả đầu ra | Nghiệm thu |
|---|---|---|---|---|
| **T00** | Chốt rubric 10 chiều + điểm gốc | Đo từ code như §3 benchmark; mỗi điểm kèm bằng chứng file/dòng | `docs/product/BENCHMARK_GTA_STANDARD.md` | Bảng điểm có ≥ 1 bằng chứng/chiều; trung bình 2,2/5 khớp số liệu |
| **T01** | Chuẩn hoá nhãn trạng thái & nguồn chuẩn | Rà `docs/`: tài liệu nào canonical, tài liệu nào cũ; gắn nhãn | Mục "Canonical" trong 2 tài liệu mới; sửa chỗ mâu thuẫn | Không còn 2 tài liệu cùng nhận là chuẩn cho một chủ đề |
| **T02** | Sổ bằng chứng (evidence log) | Mỗi task một dòng: ID, ngày, lệnh đã chạy, số test, số đo | `docs/product/EVIDENCE_LOG.md` | Có dòng cho T00–T02; mỗi dòng tái lập được |
| **T03** | Cổng đo tự động | Script đếm nội dung (nhiệm vụ/flag/POI/diện tích) + probe fps/memory trong dev | `apps/game/src/game/devtools/contentMetrics.ts` + test; `docs` ghi ngưỡng | Test đếm ra đúng số hiện tại (2 mission chính, 2 offer, 45 flag, 0,063 km²) |
| **T04** | Backlog chuẩn hoá | Bảng task ID + phụ thuộc + DoD + ước lượng (chính tài liệu này, §4–§6) | Tài liệu này | Mỗi task có ID, phụ thuộc, kết quả, nghiệm thu; không task nào mồ côi |

### 3.2 Định nghĩa "task" từ nay

- **Epic (W)**: một workstream có mục tiêu đo được.
- **Task (Txx)**: một việc ship được trong 1–3 phiên, có test riêng.
- **Subtask**: bước trong task, không cần nghiệm thu riêng.
- **Task không có nghiệm thu = không tồn tại.** Nếu chưa biết đo thế nào, task đó là "nghiên cứu"
  và phải có câu hỏi + thời hạn.

---

## 4. W1 — Nhạc nền (3–4 phiên)

### 4.1 Hiện trạng đo được

| Thứ | Sự thật | Bằng chứng |
|---|---|---|
| Nhạc menu | Có, phát qua Web Audio, fade in/out | `apps/game/src/app/App.tsx:238-510` |
| Nhạc trong chương | **Không có**; `masterGain` về 0 khi rời menu | `App.tsx:504` (`route === "menu" ? 1 : 0`) |
| Volume nhạc | `settings.musicVolume` **không được dùng** trong `features/` | `grep musicVolume features/` → 0 kết quả |
| Âm thanh phòng | Có: city bed, mưa, đồng hồ, gõ phím, bước chân, ringtone | `features/roomv2/game/audio.ts` (438 dòng) |
| Âm thanh phố | Có, procedural: traffic, còi, noise bed | `features/testbus/openworld/traffic/streetAudio.ts`, `openworld/room/audio.ts` |
| Móc nối cảm xúc | Đã có `setMood('calm'|'quiet'|'tense')` và `duckForVoice()` | `features/roomv2/game/outside.ts:32-80` |
| Voice | Có một phần (M02, Mai EN/VI) | `features/chapter1/voice/`, `public/assets/audio/mai.*` |

Kết luận: **không thiếu hạ tầng âm thanh — thiếu một "nhạc trưởng".** Đây là lý do W1 rẻ.

### 4.2 Quyết định kiến trúc (owner chốt 27/11/2026)

**D1 — Owner tự sáng tác/thu nhạc; game là "bộ phát" đọc file qua manifest.** Phương án tổng hợp
procedural đã bị bỏ (chỉ còn là phương án dự phòng nếu sau này cần cue động).

| Phương án | Ưu | Nhược | Quyết định |
|---|---|---|---|
| A. Owner sáng tác, game phát file | Chất lượng thật, owner kiểm soát nghệ thuật | Cần thời gian sáng tác; phải chuẩn hoá file | **Chốt** |
| B. Nhạc tổng hợp (procedural) | 0 KB, thích ứng | "sang" khó, không phải nhạc của owner | Dự phòng |
| C. Loop CC0 tải về | Nhanh | Licence, không đồng bộ chất | Không |

Hệ quả kỹ thuật: **manifest là nguồn duy nhất** cho (cue → file, cảnh phát, BPM/ô nhịp, gain,
ducking, ưu tiên). Đã có:
`apps/game/src/game/audio/musicManifest.json` (dữ liệu),
`musicManifest.ts` (kiểu + tiện ích),
`musicCueSelection.ts` (chính sách chọn cue, thuần logic),
`scripts/check-music.mjs` (`pnpm --filter @scammaze/game music:check`).
Brief cho người sáng tác: [MUSIC_BRIEF.md](../gameplay/MUSIC_BRIEF.md).

Thiết kế phát: mỗi cue là **một file loop hoặc one-shot**; chuyển cue bằng crossfade 1,5–4 s theo
bảng trong manifest; có voice → duck −6 dB trong 250 ms.

### 4.3 Việc phải làm

| ID | Việc | Phương pháp | Kết quả đầu ra | Nghiệm thu |
|---|---|---|---|---|
| **T10** ✅ | Chốt kiến trúc + bảng cue + brief cho owner | Mỗi cue: cảnh phát, cảm xúc, BPM/tone, số ô, loop, chuẩn file | [MUSIC_BRIEF.md](../gameplay/MUSIC_BRIEF.md) + `musicManifest.json` | Bảng cue phủ hết 6 cảnh; test đối chiếu brief ↔ manifest xanh |
| **T11** ✅ | Manifest + chính sách chọn cue | Dữ liệu JSON một nguồn; hàm thuần `selectMusicCue` / `isTense` / `crossfadeMs`; không Web Audio trong lõi | `game/audio/{musicManifest.json,musicManifest.ts,musicCueSelection.ts}` + 2 test | Test: ưu tiên ending > radio > intro > ride > street > room.tense > room.calm; ngưỡng tense; crossfade; tên file hợp lệ |
| **T12** | Bộ kiểm tra file nhạc | Script đọc manifest: thiếu file = cảnh báo; sai tên/đuôi/dung lượng/độ dài = lỗi (dùng ffprobe nếu có) | `scripts/check-music.mjs` + script `music:check` | Chạy trên thư mục rỗng: 0 lỗi, 7 cảnh báo; thả file sai tên → exit 1 |
| **T13** ✅ | `MusicPlayer` (Web Audio, file) | Fetch + decode từng cue, cache theo cue, loop bằng `AudioBufferSourceNode`, gain theo manifest, crossfade + duck, dispose sạch | `game/audio/musicPlayer.ts` + test (AudioContext giả) | Test: không throw khi thiếu AudioContext; mute = 0; volume 0..1; duck → hồi; dispose dừng hết source |
| **T14** ✅ | Nối vào chương | `useChapterMusic`: đọc `settings.musicVolume`, `soundEnabled`, cảnh (phòng/phố/buýt/kết thúc), tín hiệu tense, `duckForVoice`; gắn vào `RoomChapterLayer` | `features/chapter1/room/useChapterMusic.ts` + test | Test: đổi mood → đổi cue; tắt sound → im; volume 0 → im; voice → duck rồi hồi; thiếu file → im, không lỗi |
| **T15** | Nhận file từ owner (đang chờ) | Owner sáng tác theo brief; chạy `music:check` đến khi 0 lỗi | 7 file trong `public/assets/audio/music/` | `music:check` 7/7, 0 lỗi; nghe tay 6 cảnh |
| **T16** | "Radio Alex" trong phone (stretch) | 3 kênh: lofi / đêm / tin tức (voice-only); app trong phone; radio thắng cue cảnh | `features/chapter1/phone/apps/RadioApp.tsx` | Mở app → chọn kênh → nhạc đổi; đóng phone → quay lại cue cảnh |
| **T17** | Trộn + accessibility + ngân sách | Kiểm tra: mute, volume, mất focus tab, headphone, CPU; đo | `EVIDENCE_LOG.md` + số đo | CPU nhạc ≤ 2% main thread; 0 yêu cầu mạng trước khi cần; im tuyệt đối khi mute |

### 4.4 Bảng cue (hợp đồng nội dung)

| Cue | Khi nào | Tempo | Cảm xúc | Lớp |
|---|---|---|---|---|
| `menu` | Menu (giữ nguyên file hiện có) | — | mời vào | bản thu |
| `theme.alex` | Intro chương, debrief | 72 | day dứt, hy vọng | pad + piano motif 4 nốt |
| `room.calm` | Học bài, viết luận, đọc mail thường | 78 | tập trung | pad + pulse nhẹ + texture mưa |
| `room.tense` | Mở offer lừa đảo, security giảm, deadline < 6 h | 92 | bất an | pulse dày + drone + tick |
| `street` | Ra phố (ngày/đêm khác nhau ở filter) | 84 | sống, hơi mệt | bass + perc nhẹ, rất thấp dưới ambience |
| `ride` | Trên buýt/xe ôm | 88 | chuyển động | rhythm bánh xe + pad |
| `ending.hope` | Kết thúc tốt | 72 | khép lại | motif `theme.alex` trưởng |
| `ending.cost` | Kết thúc trả giá / thất bại | 66 | nặng | motif thứ, không trống |

Quy tắc: **nhạc không bao giờ to hơn voice**; ambience phố luôn thấp hơn nhạc 6 dB; im lặng có
chủ đích ở cảnh căng thẳng cao nhất (dừng nhạc 2 s trước khi cuộc gọi đến) — học từ GTA.

---

## 5. W2 — Bản đồ rộng hơn (8–10 phiên)

**Quy trình thi công (phi tuyến, đọc gì, dùng gì, nghiệm thu tầng nào):**
[MAP_PROCESS_BRIEF.md](./MAP_PROCESS_BRIEF.md).

### 5.1 Nguyên tắc

1. **Một bản đồ, nhiều route test.** `/khupho`, `/testbus`, `/roomv2` giữ lại làm trang kiểm thử
   nhưng người chơi chỉ đi bằng chân/xe.
2. **Không move code cũ trong W2.** Thêm lớp hợp đồng (`mapGraph`) và adapter; việc tách package để
   sau. Rủi ro refactor lớn hơn lợi ích.
3. **Generator + thủ công.** 0,35 km² không thể đắp tay từng mét (hiện 2.500 dòng cho 0,06 km²).
   Dùng **văn phạm khối phố** sinh mặt tiền/ngõ/prop theo seed, rồi đắp tay 7 địa danh.
4. **Mật độ trước diện tích.** Không mở quận mới khi quận cũ chưa đạt "≤ 45 s giữa hai điểm tương tác".

### 5.2 Bản đồ mục tiêu (M2)

| Quận | Cá tính | Địa danh/neo | Nội thất mở được | Vai trò nhiệm vụ |
|---|---|---|---|---|
| Q10 · Nhà trọ | hẻm, nhà ống, chợ nhỏ | Nhà 59, chợ Cô Ba, tiệm tạp hoá | Phòng trọ (có) | Nhà, M01, việc làm thêm |
| Q5 · Chợ Lớn | chợ, đèn neon đỏ, đông | Chợ Lớn, tiệm in 24h, bến buýt | Tiệm in | M02, nhiệm vụ lẻ in ấn |
| Q3 · Cà phê | yên, cây, quán | Quán cà phê, văn phòng cho thuê | Quán cà phê | Ca làm, gặp Maya |
| Q1 · Tài chính | cao tầng, kính, sáng | Bitexco, ngân hàng, cổng trường | Sảnh trường | M05, nộp bài |
| Bình Thạnh | bến xe, náo | Bến xe, ký túc xá cũ | Ký túc xá | M03, tìm nhà |
| Q4 · Bến tàu | ẩm, cá, sớm | Bến tàu, chợ cá | — | Cảnh nền, nhiệm vụ lẻ |
| Q7 · Đang xây | trống, cần cẩu, bụi | Công trường, nhà mẫu | Nhà mẫu | Nhiệm vụ lẻ "nhà giá rẻ" |

Tổng: **7 quận, ~40 POI có tên, 5 nội thất, 1 vòng buýt 06 nối Q10–Q5–Q1–Bình Thạnh, 6 điểm xe ôm.**

### 5.3 Việc phải làm

| ID | Việc | Phương pháp | Kết quả đầu ra | Nghiệm thu |
|---|---|---|---|---|
| **T20** | Hợp đồng bản đồ (`mapGraph`) | Định nghĩa: ô 160 m, quận = tập ô, POI, cạnh đi bộ/xe, toạ độ 1 đơn vị = 1 m, gốc tại Q10 | `apps/game/src/game/world/mapGraph.ts` + test | Test: graph liên thông; mọi POI thuộc đúng quận; mọi venue có ≥ 1 cạnh; không ô nào chồng nhau |
| **T21** | Văn phạm khối phố | Sinh theo seed: đường (mặt cắt, vỉa hè), lô nhà ống, hẻm, prop preset, biển hiệu; tất định | `game/world/districtGrammar.ts` + snapshot test | Cùng seed → cùng geometry (hash); bất biến: nhà không đè đường, vỉa hè đủ rộng, không lô rỗng |
| **T22** | Dựng 5 quận mới | Chạy grammar + đắp tay địa danh; tái dùng PBR/ánh sáng hiện có | `features/testbus/openworld/world/districts/*.ts` | Đi bộ qua 5 quận không thấy chỗ trống; mỗi quận có ≥ 6 POI; ảnh so sánh trước/sau |
| **T23** | Streaming theo ô | `WorldStreamer` mở rộng: nạp/bỏ theo ô + khoảng cách, ngân sách mỗi frame, ưu tiên ô đang đứng | `game/world/streamingBudget.ts` + test | Test: ô hiện tại không bao giờ bị bỏ; quá ngân sách thì hoãn; hitch ≤ 2 frame khi đi bộ và khi đi buýt |
| **T24** | Hệ thống "venue" (cửa mở được) | Cửa = interactable → nội thất chạy bằng engine phòng (đã có `RoomOptions`/`RoomStoryPort`), preload standby | `game/world/venueRegistry.ts`, `features/venues/*` | Mở 5 cửa: vào/ra < 1 s sau lần đầu; state nhiệm vụ giữ nguyên; không rò engine sau khi ra |
| **T25** | Vận tải nối quận | Buýt 06 vòng lặp có giờ; xe ôm có giá/thời gian; đi bộ tốn phút trong game | `openworld/simulation/transit.ts` mở rộng + `game/narrative/resources.ts` | Đi Q10 → Q1 bằng buýt ≤ 3 phút thực; đồng hồ game trừ đúng; không kẹt xe vô hạn; bảng giá khớp GDD |
| **T26** | Lịch sinh hoạt theo quận/giờ | `humanPresence` + `storyNpcs` nhận lịch: sáng chợ đông, trưa Q1, tối Q3; mật độ mục tiêu | `openworld/simulation/schedules.ts` + test | Test: mật độ trong ngưỡng theo giờ; NPC không xuất hiện trong toà nhà; 60 fps giữ |
| **T27** | Bản đồ & minimap | `SaigonMinimap` mở rộng: tên quận, POI, blip nhiệm vụ, "bạn ở đây"; bản đồ lớn trong phone | `features/hud/SaigonMinimap.tsx`, `chapter1/phone/apps/MapApp.tsx` | Mở bản đồ thấy 7 quận + 40 POI; blip khớp vị trí thật (test toạ độ) |
| **T28** | Cổng hiệu năng bản đồ | Đo fps/memory/load ở 3 điểm: nhà, giữa Chợ Lớn, Q1; ghi log | `EVIDENCE_LOG.md` | Đạt bảng ngân sách §2; fps 1% low ≥ 45 tại cả 3 điểm |
| **T29** | Nghiệm thu "đi xuyên thành phố" | Biên bản chơi tay: đi bộ Q10 → Q1, đi buýt về; chụp ảnh 6 mốc | `docs/gameplay/MAP_WALKTHROUGH.md` | Không seam/loading nhìn thấy; ≤ 12 phút đi bộ; ≥ 12 tương tác dọc đường |

### 5.4 Kỹ thuật then chốt: văn phạm khối phố

Hiện tại mỗi quận là một hàm dài hàng nghìn dòng. Để lên 0,35 km² mà không nổ code:

```
DistrictSpec (dữ liệu)  →  districtGrammar(seed)  →  GeometryBundle (mesh + solid + POI + light)
   │                             │
   ├── roadProfile (mặt cắt)     ├── lô nhà ống (chiều rộng, chiều sâu, số tầng)
   ├── blockTemplate (ô phố)     ├── prop preset (xe, cây, biển, dây điện)
   ├── facadeSet (mặt tiền)      └── collision (solid) + điểm tương tác
   └── densityBudget
```

Bất biến kiểm bằng test (không phải mắt người): không chồng lấn, vỉa hè tối thiểu 1,2 m, mỗi lô có
mặt tiền nhìn ra đường, tổng diện tích lô ≤ 85% ô, seed cố định → hash cố định.

---

## 6. W3 — Nhiệm vụ lẻ & nhánh truyện (10–12 phiên)

### 6.1 Hiện trạng

- Chương đang chạy: `LAST_SUBMISSION_SCENARIO` (`game/narrative/activeScenario.ts`) — M01, 2 offer,
  M02, parcel slice.
- **M03–M05 chưa có.** `decisions: {}`, `endings: {}`, `decisionNotes: {}`, debrief rỗng.
- **Vì sao ending không bao giờ mở:** `reducer.ts:1088` chỉ chọn outcome khi `next.decision !== null`,
  mà `LAST_SUBMISSION_SCENARIO` không có `DecisionDef` nào ⇒ `outcome` luôn `null` ⇒
  `RoomEndingLayer` không có gì để hiện. Thêm nữa `selectOutcome` (`outcome.ts:22`) mặc định
  `scenario = CHAPTER_1_SCENARIO` (chương cũ) — nếu quên truyền scenario sẽ chấm ending bằng dữ liệu
  legacy. T34 phải sửa cả hai: thêm decision cho chương mới **và** bỏ default legacy (bắt buộc truyền
  scenario).
- 45 flag, 37 đã ghi, 8 để dành: `backupSecured`, `safeHousing`, `identityDocumentsExposed`,
  `housingDepositLost`, `minhTrustsAlex`, `researchSavedChannelIncluded`, `draftSourcesChecked`,
  `findingsReconciled`.
- Bản mẫu để học: chương cũ `chapter1/{decisions,endings,debrief}.ts` + `scenario.ts` (vẫn còn, có
  test) — dùng làm khuôn, không dùng lại nội dung.

### 6.2 Hợp đồng nhiệm vụ v2

Mở rộng `MissionDef` **theo hướng tương thích ngược** (thêm field optional), không đổi field cũ:

```ts
type MissionKind = "main" | "side" | "activity";

interface MissionExtras {
  kind?: MissionKind;          // mặc định "main"
  venue?: string;              // POI nơi nhiệm vụ diễn ra (W2)
  marker?: { x: number; z: number };
  window?: { from: number; to: number };   // phút kể từ Thứ Ba 17:00
  expiresTo?: string;          // nhiệm vụ/biến thể thay thế khi hết hạn
  repeat?: { cooldownMinutes: number; maxTimes?: number };
  reward?: { cash?: number; support?: number; evidence?: string[] };
  requires?: Condition[];      // điều kiện mở
}
```

Quy tắc nội dung (lấy từ GDD, không tự thêm): nhiệm vụ lẻ **tốn thời gian thật**, **có thể tốn
tiền**, **không dán nhãn tốt/xấu**, và phải có ích cho cốt truyện chính theo ít nhất một cách
(tiền, quan hệ, bằng chứng hoặc phương án dự phòng).

### 6.3 Nhiệm vụ chính còn thiếu

| ID | Nhiệm vụ | Thời điểm | Nhánh chính | Flag khoá |
|---|---|---|---|---|
| **M03** | Rời ký túc xá, tìm nhà | Thứ Năm 08:00 | đặt cọc mù / xem nhà / ở tạm | `safeHousing`, `housingDepositLost` |
| **M04** | Voice Minh giả + Maya | Thứ Năm 20:00 | gửi tiền / gọi lại kênh cũ / nhờ người thật | `minhTrustsAlex`, `identityDocumentsExposed` |
| **M05** | Recovery scam + nộp bài 16:32 | Thứ Sáu 14:00–17:00 | trả phí cứu dữ liệu / tự phục hồi / nhờ trường | `backupSecured`, `researchSavedChannelIncluded`, `draftSourcesChecked`, `findingsReconciled` |

### 6.4 Tám nhiệm vụ lẻ (side)

| # | Tên | Quận | Bài học lừa đảo | Chi phí | Thưởng | Mở khi |
|---|---|---|---|---|---|---|
| S1 | Giao hàng 22.000đ | Q10 | phí ship trả trước | 30 phút | 40.000đ | từ đầu |
| S2 | Việc nhẹ lương cao (biến thể) | Q10 | tuyển dụng đòi cọc | 45 phút | 0 (hoặc mất cọc) | sau M01 |
| S3 | Ca cà phê | Q3 | hợp đồng, giữ lương | 90 phút | 120.000đ | từ đầu |
| S4 | In ấn 24h | Q5 | báo giá đội giá | 20 phút | bản in | sau M01 |
| S5 | Phòng trọ ưng ý | Q7 | cọc giữ chỗ | 60 phút | nhà / mất cọc | sau M03 mở |
| S6 | Sửa laptop | Q5 | tráo linh kiện, lấy dữ liệu | 40 phút | dữ liệu / mất dữ liệu | sau M01 |
| S7 | Học bổng & lệ phí | Q1 | phí hồ sơ giả | 50 phút | học bổng / mất phí | sau M02 |
| S8 | Người lạ mượn điện thoại | Bình Thạnh | OTP/social engineering | 15 phút | an toàn / lộ OTP | từ đầu |

Mỗi nhiệm vụ: 3–6 bước, 2–3 lựa chọn, 1–3 flag, có test reachability; không nhiệm vụ nào là "nút
GOOD/BAD".

### 6.5 Hoạt động lặp (4)

| # | Hoạt động | Cơ chế | Thời gian game |
|---|---|---|---|
| A1 | Ca cà phê | ca 90 phút, trả theo ca, nghỉ muộn bị trừ | 90 phút/lần |
| A2 | Giao hàng | chọn đơn gần/xa, giá theo quãng | 20–40 phút |
| A3 | Trông xe / bán hàng chợ | ca ngắn, thu nhập thấp | 60 phút |
| A4 | Chạy xe ôm (sau M02) | chở khách theo điểm, có rủi ro | 25 phút/chuyến |

### 6.6 Năm kết thúc

| Kết thúc | Điều kiện chính | Cảm giác |
|---|---|---|
| **Nộp kịp, tỉnh táo** | thesis 100% trước hạn, không mất tiền oan, evidence đủ | thành tựu có giá |
| **Nộp kịp, trả giá** | nộp được nhưng mất tiền/nhà/niềm tin | "thắng" nhưng nặng |
| **False victory** | nộp được, tài khoản bị xâm phạm, không biết | day dứt (kế thừa tên chương cũ) |
| **Trượt hạn** | thesis < 100% lúc 17:00 | mất mát |
| **Gỡ được, chậm** | phục hồi sau sự cố, nộp muộn có xin phép | nhẹ nhõm có điều kiện |

Debrief: timeline theo ledger + decision + flag, chỉ ra **dấu hiệu đã bỏ lỡ** và **nơi có thể tìm
thấy**; không chấm điểm đạo đức.

### 6.7 Việc phải làm

| ID | Việc | Phương pháp | Kết quả đầu ra | Nghiệm thu |
|---|---|---|---|---|
| **T30** | Mission v2 | Thêm field optional vào `types.ts`; `reducer`/`selectors` hiểu kind/window/repeat; `validateScenario` kiểm mới | `game/narrative/types.ts`, `selectors.ts`, `validateScenario.ts` + test | Test: scenario cũ vẫn chạy nguyên; mission v2 thiếu venue bị validator bắt; window/repeat hoạt động |
| **T31** | Waypoint ngoài trời cho task tracker | Đã có `TaskTracker` + `TaskListPanel` + `TaskMarker` (chỉ trỏ laptop/phone trong phòng). Tổng quát hoá marker sang POI ngoài trời + blip minimap; không viết HUD mới | `features/chapter1/hud/TaskMarker.tsx`, `game/world/objectiveMarkers.ts`, `hud/SaigonMinimap.tsx` | Marker trỏ đúng venue; ẩn khi xong; blip khớp toạ độ; test toạ độ→màn hình; tracker giữ nguyên hành vi cũ |
| **T32** | M03 | Dữ liệu `MissionDef` + event + device items + ledger; 3 nhánh; tiêu 6 giờ | `game/narrative/chapter1/mission03.ts` + locale | Chơi được 3 nhánh; flag ghi đúng; không soft-lock; EN/VI đủ |
| **T33** | M04 | Như M03 + voice call giả (dùng lại hạ tầng voice M02) | `mission04.ts` + `voice/mission04Voice.ts` | Voice phát đúng; nhánh "gọi lại kênh cũ" mở; security đổi đúng |
| **T34** | M05 + 5 ending + debrief (+ gỡ default legacy) | Cuối chương: 28 phút cuối, recovery scam, nộp bài; thêm `DecisionDef` để `reducer` chọn được outcome; bỏ `scenario = CHAPTER_1_SCENARIO` mặc định trong `outcome.ts` | `mission05.ts`, `endings.ts`, `decisions.ts`, `debrief.ts`, sửa `lastSubmission.ts`, `outcome.ts` | 5 ending đều mở được bằng playthrough fixture; `outcome` khác `null` khi kết thúc; debrief khác nhau giữa các lượt; `RoomEndingLayer` mở; test: quên scenario → lỗi kiểu, không âm thầm dùng legacy |
| **T35** | 4 nhiệm vụ lẻ đợt 1 (S1, S3, S4, S8) | Dùng hợp đồng v2; đặt tại Q10/Q3/Q5/Bình Thạnh | `game/narrative/chapter1/side/*.ts` | Mỗi nhiệm vụ chơi được từ map, có ≥ 2 lựa chọn, ≥ 1 flag; không ảnh hưởng soft-lock |
| **T36** | 4 nhiệm vụ lẻ đợt 2 (S2, S5, S6, S7) | Như trên, gắn điều kiện mở sau M01/M02/M03 | `side/*.ts` | Điều kiện mở đúng; nhiệm vụ hết hạn có biến thể thay thế |
| **T37** | 4 hoạt động lặp | Ca làm + giao hàng + trông xe + xe ôm; trả tiền theo thời gian game | `game/narrative/chapter1/activities.ts` | Làm 3 lần liên tiếp không lỗi; tiền/giờ đúng; có cooldown |
| **T38** | Test reachability & phân nhánh | Sinh đồ thị mission/flag; kiểm mọi ending đều có đường; không trạng thái chết | `game/narrative/reachability.test.ts` mở rộng | 100% ending reachable; 0 dangling flag; 0 vòng lặp vô hạn |
| **T39** | Cân bằng & nhịp | Chơi thử 3 lượt (vội / cẩn thận / hỗn hợp), ghi thời gian & số tương tác | `docs/gameplay/BALANCE_NOTES.md` | Mỗi lượt 60–90 phút; ≥ 1 tương tác/45 s; không lượt nào bất khả thi |
| **T40** | Nghiệm thu chương | Chạy 5 playthrough tự động + 1 lượt tay từ đầu đến debrief | `playthroughs.test.ts` | 5 kết thúc khác nhau; test xanh; screenshot debrief |

---

## 7. Mốc, cổng và thứ tự ship

| Mốc | Task | Cổng qua mốc | Demo cho owner |
|---|---|---|---|
| M0 | T00–T04 | 2 tài liệu + sổ bằng chứng + script đếm nội dung | Bảng điểm + backlog |
| M1 | T10–T17 | 6 cue nghe được; test director xanh; CPU ≤ 2%; mute im | Video 60 s: menu → phòng → căng thẳng → phố → buýt → kết |
| M2 | T20–T29 | 0,35 km²; 7 quận; 5 nội thất; fps đạt; walkthrough 12 phút | Đi bộ Q10 → Q5 → buýt → Q1, vào tiệm in |
| M3 | T30–T40 | 5 main + 8 side + 4 activity + 5 ending; reachability xanh | Chơi 20 phút từ đầu, kết thúc + debrief |

Giữa các mốc **không mở việc mới** ngoài danh sách, trừ khi owner đổi ưu tiên; nếu đổi, ghi vào
tài liệu này và cập nhật §0.

---

## 8. Bản đồ file (tạo mới / sửa)

```
apps/game/src/
  game/audio/                     ← W1 (mới)
    musicDirector.ts  musicScore.ts  musicSynth.ts  cues/*.ts
  game/world/                     ← W2 (mới, cạnh world lifecycle hiện có)
    mapGraph.ts  districtGrammar.ts  venueRegistry.ts  streamingBudget.ts
    objectiveMarkers.ts
  game/narrative/chapter1/        ← W3
    mission03.ts  mission04.ts  mission05.ts
    side/*.ts  activities.ts  endings.ts  debrief.ts   (sửa lastSubmission.ts)
  features/chapter1/room/useChapterMusic.ts          ← W1
  features/chapter1/hud/{TaskMarker,SaigonMinimap}.tsx ← W3 (mở rộng, không viết HUD mới)
  features/chapter1/phone/apps/{RadioApp,MapApp}.tsx  ← W1/W2
  features/venues/*                                    ← W2
  features/testbus/openworld/world/districts/*.ts     ← W2 (mở rộng, không move)
docs/product/
  BENCHMARK_GTA_STANDARD.md  UPGRADE_PLAN_MUSIC_MAP_MISSIONS.md  EVIDENCE_LOG.md
docs/gameplay/
  MAP_WALKTHROUGH.md  BALANCE_NOTES.md
```

Không đụng: `game/narrative/{reducer,selectors,world,device,resources}.ts` chỉ sửa khi T30 yêu cầu,
và luôn kèm test hồi quy.

---

## 9. Rủi ro & cách chặn

| Rủi ro | Xác suất | Tác động | Chặn |
|---|---|---|---|
| W2 phình to, 0,35 km² vẫn loãng | Cao | Mất niềm tin | Cổng mật độ ở mỗi quận; generator trước, đắp tay sau |
| Nhạc procedural nghe "rẻ" | Trung bình | D9 không lên | Làm 2 vòng: cue tối giản → tinh chỉnh; nếu vẫn kém, chuyển sang stem CC0 (D1-B) |
| Vỡ test cũ khi sửa narrative core | Trung bình | Chậm | Chỉ thêm field optional; chạy toàn bộ suite mỗi task |
| Suite test đã 460 s, sẽ lâu hơn | Cao | Vòng lặp chậm | Chạy test theo thư mục khi đang làm; full suite ở cổng mốc |
| Nội dung lệch giáo dục | Trung bình | Sai sứ mệnh | `contentSafety.property.test.ts` + danh sách đỏ §1.2 benchmark |
| Asset bản quyền | Thấp | Pháp lý | Chỉ asset tự sinh, CC0 hoặc có sẵn trong repo |

---

## 10. Quyết định cần owner xác nhận (mặc định tôi đã chọn)

| # | Câu hỏi | Mặc định tôi chọn | Đổi được không |
|---|---|---|---|
| D1 | Nhạc: ai làm, bằng cách nào? | **Owner sáng tác, game phát file qua manifest** (chốt 27/11/2026) | Đã chốt |
| D2 | Quy mô map đích của Chương 1 | **0,35 km² / 7 quận / 5 nội thất** (không đua 9 km²) | Có, trước T21 |
| D3 | Số nhiệm vụ lẻ | **8 side + 4 hoạt động lặp** | Có, trước T35 |
| D4 | Có làm "Radio Alex" không | **Có, nhưng là stretch sau T15** | Có |
| D5 | Có mở app mobile không | **Không** trong đợt này; chỉ desktop browser | Có |

Nếu owner không phản hồi, tôi thi hành theo mặc định và ghi vào sổ bằng chứng.
