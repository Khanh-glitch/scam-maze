# Brief nhạc nền — Chapter 1 "LAST SUBMISSION: 72 GIỜ CUỐI"

> **Dành cho owner (người sáng tác/thu nhạc).** Tài liệu này nói: **làm thể loại gì**, **đặt file ở
> đâu**, **file chạy ở cảnh nào**, và **phải đạt chuẩn kỹ thuật nào**. Code phía game đã có sẵn
> manifest + bộ kiểm tra để nhận file; thả file đúng tên vào là chạy, không cần sửa code.
>
> Cập nhật: 27/11/2026 · Nhánh `arena/f56eaa67-scam-maze` · Nguồn dữ liệu:
> `apps/game/src/game/audio/musicManifest.json` (một nguồn duy nhất, test đối chiếu tài liệu này).

---

## 0. Tóm tắt nhanh

- **7 file nhạc** cần làm (+ menu đã có sẵn). Tổng thời lượng ~9 phút.
- Thư mục: **`apps/game/public/assets/audio/music/`**
- Tên file: **chữ thường, gạch dưới, đúng như bảng §3** (`room_calm.mp3`, …).
- Định dạng: **MP3 320 kbps, 44.1 kHz, stereo** (hoặc OGG q6 nếu muốn nhẹ hơn).
- Nhạc **nền**, không phải nhạc phim: phải chịu được nghe 20 phút liên tục, không có cao trào
  "phá" lời thoại.
- Chỉ dùng **nhạc tự sáng tác** hoặc CC0; ghi nguồn vào `CREDITS`.
- Làm xong: chạy `pnpm --filter @scammaze/game music:check` để kiểm tên/định dạng/độ dài.

---

## 1. Nguyên tắc chung (lấy từ GTA/Gangstar)

1. **Nhạc là phông, không phải nhân vật.** Trong GTA, radio và score không bao giờ tranh chỗ với
   lời thoại; khi có thoại, nhạc tự hạ (ducking). Code sẽ duck −6 dB, nhưng file gốc cũng nên "phẳng"
   động (không có đoạn to gấp đôi).
2. **Mỗi không gian có một "nhịp" riêng.** Phòng học ≠ phố ≠ xe buýt. Người chơi phải nhận ra mình
   vừa đổi không gian mà không cần nhìn HUD.
3. **Vòng lặp không được "gãy".** Loop cue phải cắt đúng ô nhịp, không fade, không vang dài qua điểm
   nối.
4. **Không dùng motif của bài có bản quyền.** Tham chiếu chỉ để lấy "chất", giai điệu phải gốc.
5. **Thà thiếu còn hơn lệch tone.** Nếu một cue chưa làm kịp, cứ để trống — game chạy im lặng ở cue
   đó, không lỗi.

---

## 2. Vị trí file và vị trí phát

### 2.1 Vị trí file

```
apps/game/public/assets/audio/music/
  theme_alex.mp3      ← nhạc chủ đề (intro + debrief)
  room_calm.mp3       ← trong phòng, bình yên
  room_tense.mp3      ← trong phòng, căng thẳng
  street.mp3          ← ngoài phố
  ride.mp3            ← trên buýt / xe ôm
  ending_hope.mp3     ← kết thúc tốt
  ending_cost.mp3     ← kết thúc trả giá / thất bại
```

Menu dùng lại file có sẵn `public/assets/audio/menu_music.mp3` — **không cần làm lại**.

### 2.2 Cảnh nào phát nhạc nào

| Cảnh trong game | Cue | Bắt đầu khi | Kết thúc/đổi khi |
|---|---|---|---|
| Menu chính | `menu_music.mp3` (có sẵn) | menu hiện ra | bấm New Game/Continue |
| Intro chương | `theme.alex` | thẻ intro mở ra | người chơi bấm bắt đầu |
| Trong phòng, không có gì gấp | `room.calm` | đứng trong phòng, đọc mail/tài liệu bình thường | mở trang lừa đảo, hoặc security thấp, hoặc gần hạn |
| Trong phòng, căng thẳng | `room.tense` | mở offer/trang lạ, `security ≤ 60`, còn `≤ 6 giờ`, có cuộc gọi đáng ngờ | hết 8 giây không còn trigger → về `room.calm` |
| Ngoài phố | `street` | bước ra khỏi cửa | lên xe / vào nhà |
| Trên buýt 06 hoặc xe ôm | `ride` | xe bắt đầu chạy | xuống xe |
| Kết thúc tốt + debrief | `ending.hope` | outcome "nộp kịp, tỉnh táo" / "gỡ được, chậm" | hết chương |
| Kết thúc trả giá + debrief | `ending.cost` | outcome "trả giá" / "false victory" / "trượt hạn" | hết chương |
| Radio trong phone (tùy chọn, làm sau) | `radio.lofi`, `radio.night` | mở app Radio | đóng app → quay lại cue cảnh |

Thứ tự ưu tiên khi nhiều điều kiện cùng đúng:
**kết thúc > radio > intro > xe > phố > phòng căng thẳng > phòng bình yên.**
(Ngưỡng "căng thẳng" nằm trong `musicManifest.json`, đổi được không cần sửa code.)

### 2.3 Chuyển nhạc (code tự làm, không cần thu)

| Chuyển từ → sang | Crossfade |
|---|---|
| phòng bình yên ↔ phòng căng thẳng | 2,5 s |
| phòng ↔ phố / xe | 1,5 s |
| bất kỳ → kết thúc / debrief | 4 s |
| mở/đóng radio | 0,8 s |

Nhạc nền luôn thấp hơn lời thoại 6 dB (ducking tự động), và ambience phố luôn to hơn nhạc phố 6 dB.

---

## 3. Brief từng cue

Ký hiệu: **BPM** = nhịp/phút · **Ô** = số ô nhịp 4/4 · **Loop** = file phải nối vòng được.

### 3.1 `theme_alex.mp3` — nhạc chủ đề của Alex

| | |
|---|---|
| Chất liệu | Piano tối giản + pad ấm + (tùy chọn) tiếng đàn tranh/đàn bầu điểm xuyết |
| Thể loại tham chiếu | Neo-classical tối giản; kiểu "main theme" của GTA IV/ending score; không phải trailer music |
| Cảm xúc | Day dứt nhưng còn hy vọng; "một người trẻ một mình ở thành phố" |
| BPM / tone | 72 · A minor (dùng được pentatonic Việt: A–C–D–E–G) |
| Độ dài | 16 ô ≈ **53 s**, không loop; có thể dài 60–75 s nếu thêm tail |
| Cấu trúc | 4 ô motif piano → 8 ô pad vào → 12 ô motif lặp có biến tấu → 16 ô lắng |
| Đừng làm | Trống mạnh, riser, drop, giai điệu "anh hùng" |

### 3.2 `room_calm.mp3` — trong phòng, bình yên

| | |
|---|---|
| Chất liệu | Trống lofi nhẹ (kick–snare dusty), Rhodes/Wurlitzer, bass mềm, vinyl noise rất nhẹ |
| Thể loại tham chiếu | Lofi hip-hop / "study beats"; nhịp độ giống radio chill trong GTA V |
| Cảm xúc | Tập trung, hơi buồn ngủ, an toàn |
| BPM / tone | 78 · D Dorian hoặc D minor |
| Độ dài | 32 ô = **98,5 s**, **loop** |
| Hoà âm | 2–4 hợp âm lặp (Dm9 – G13 – Cmaj7 – Am7), không đổi hợp âm gấp |
| Đừng làm | Giọng hát, tiếng mưa (game đã có mưa riêng), solo dài |

### 3.3 `room_tense.mp3` — trong phòng, căng thẳng

| | |
|---|---|
| Chất liệu | Drone synth tối + pulse đều như nhịp tim + tick nhẹ (như đồng hồ) + texture giấy/điện |
| Thể loại tham chiếu | Ambient tension trong mission heist của GTA V; score kiểu *Sicario* nhưng bớt "phim" |
| Cảm xúc | Có gì đó không ổn; thời gian đang trôi |
| BPM / tone | 92 (cảm nhận như pulse) · D Phrygian |
| Độ dài | 24 ô = **62,6 s**, **loop** |
| Cấu trúc | Không giai điệu; 3 lớp: bed (drone) – pulse – texture. Nếu làm stem, tách 3 file cùng độ dài |
| Đừng làm | Trống dance, bass line rõ, giai điệu nhớ được |

### 3.4 `street.mp3` — ngoài phố Sài Gòn

| | |
|---|---|
| Chất liệu | Guitar riff nhẹ (clean/chorus), bass, trống nhẹ, (tùy chọn) kèn/sax rất xa |
| Thể loại tham chiếu | City-pop/funk-lite; indie rock instrumental; chất "Sài Gòn" của nhạc Việt thập niên 90–2000 |
| Cảm xúc | Thành phố sống, hơi nóng, hơi mệt; không hào hứng |
| BPM / tone | 84 · G major / E minor |
| Độ dài | 32 ô = **91,4 s**, **loop** |
| Mix | **Nhỏ và tối**: phố đã có tiếng xe/còi riêng, nhạc phải chui xuống dưới |
| Đừng làm | Nhạc "quảng cáo", tiếng người, tiếng còi trong file (game tự sinh) |

### 3.5 `ride.mp3` — trên buýt 06 / xe ôm

| | |
|---|---|
| Chất liệu | Trip-hop/downtempo: break nhẹ, bass sâu, pad, (tùy chọn) tiếng bánh xe rất nhẹ |
| Thể loại tham chiếu | Trip-hop kiểu Massive Attack; nhạc "ngồi xe ngắm phố" |
| Cảm xúc | Lơ đễnh, suy nghĩ, chuyển động |
| BPM / tone | 88 · A minor |
| Độ dài | 32 ô = **87,3 s**, **loop** |
| Đừng làm | Tiếng động cơ/phanh (game tự sinh), nhạc quá nhanh |

### 3.6 `ending_hope.mp3` — kết thúc tốt

| | |
|---|---|
| Chất liệu | Piano + dây (string pad thật hoặc tổng hợp ấm), motif lấy từ `theme.alex` nhưng chuyển trưởng |
| Thể loại tham chiếu | Ending score của GTA IV/V (phần "kết thúc yên" ) |
| Cảm xúc | Khép lại, nhẹ nhõm có giá |
| BPM / tone | 72 · A major |
| Độ dài | 20 ô ≈ **66,7 s**, không loop |
| Cấu trúc | 4 ô piano → 8 ô dây vào → 16 ô motif trưởng → 20 ô lắng, không fade đột ngột |

### 3.7 `ending_cost.mp3` — kết thúc trả giá / thất bại

| | |
|---|---|
| Chất liệu | Piano thưa, room tone, (tùy chọn) cello rất nhẹ |
| Thể loại tham chiếu | Score kết thúc buồn tối giản, kiểu *The Last of Us* phần lặng |
| Cảm xúc | Mất mát, không bi kịch hoá |
| BPM / tone | 66 · A minor |
| Độ dài | 16 ô ≈ **58 s**, không loop |
| Đừng làm | Trống tang lễ, hợp âm "phim kinh dị", im lặng hoàn toàn (phải có nhạc để debrief có nền) |

### 3.8 (Tùy chọn, làm sau) `radio_lofi.mp3`, `radio_night.mp3`

Chỉ làm nếu owner muốn "Radio Alex" trong điện thoại. Mỗi file 60–120 s, loop, cùng chuẩn kỹ thuật.
Kênh tin tức không cần nhạc (chỉ voice).

---

## 4. Chuẩn kỹ thuật bắt buộc

| Hạng mục | Yêu cầu | Lý do |
|---|---|---|
| Định dạng | MP3 **320 kbps CBR**, 44,1 kHz, stereo | Safari/iOS đọc tốt; CBR dễ loop chính xác |
| (Thay thế) | OGG Vorbis q6 **nếu** có bản MP3 song song | Firefox/Chrome thích OGG, Safari cần MP3 |
| Loudness | Loop: **−18 LUFS** tích hợp · One-shot: **−16 LUFS** | Để code chỉ cần cân bằng tương đối, không phải nén từng file |
| True peak | **≤ −1,5 dBTP** | Tránh clipping khi cộng với ambience/voice |
| Loop | Cắt **đúng mép ô nhịp**; **không fade in/out** ở hai đầu; reverb tail ≤ 300 ms | Nối vòng không "thở", không "cụt" |
| Intro im lặng | Không được có khoảng lặng đầu file | Trễ cảm giác khi vào cảnh |
| Dung lượng | ≤ **3 MB/file** | Tải nhanh, không phình repo |
| Tên file | chữ thường, `[a-z0-9_]+.(mp3|ogg)` | Bộ kiểm tra tự đọc |
| Metadata | Có thể để trống; **không nhúng ảnh bìa** | Nhẹ file |
| Stem (tùy chọn) | `room_tense.bed.wav`, `room_tense.pulse.wav`, cùng độ dài | Cho phép mix động sau này |

**Về loop và reverb:** nếu muốn vang dài, hãy "wrap" phần đuôi vào đầu file (render vòng khép kín)
thay vì để đuôi cắt ở cuối. Cách đơn giản nhất: giữ reverb ngắn (≤ 300 ms) cho các cue loop.

---

## 5. Cách giao file & kiểm tra

1. Thả file vào `apps/game/public/assets/audio/music/`.
2. Chạy:
   ```bash
   pnpm --filter @scammaze/game music:check
   ```
   Lệnh này đọc `musicManifest.json`, kiểm: file có tồn tại, đúng tên, đúng đuôi, dung lượng, và
   (nếu máy có `ffprobe`) độ dài/bitrate/kênh. File thiếu chỉ bị **cảnh báo**, không làm hỏng build.
3. Chạy game (`pnpm dev:game`), vào `/roomv2` hoặc chơi chương, nghe thử chuyển cảnh.
4. Ghi nguồn vào `CREDITS` nếu không phải tự sáng tác.

Trạng thái hiện tại của từng file (điền khi có):

| File | Trạng thái | Ngày | Ghi chú |
|---|---|---|---|
| `theme_alex.mp3` | ⬜ chưa có | | |
| `room_calm.mp3` | ⬜ chưa có | | |
| `room_tense.mp3` | ⬜ chưa có | | |
| `street.mp3` | ⬜ chưa có | | |
| `ride.mp3` | ⬜ chưa có | | |
| `ending_hope.mp3` | ⬜ chưa có | | |
| `ending_cost.mp3` | ⬜ chưa có | | |

---

## 6. Nghiệm thu phía game (để owner biết sẽ bị kiểm gì)

| # | Tiêu chí | Cách kiểm |
|---|---|---|
| A1 | Đủ 7 file đúng tên, đúng thư mục | `music:check` |
| A2 | Đúng định dạng/độ dài/loop theo brief | `music:check` (ffprobe nếu có) |
| A3 | Không có file lạ trong thư mục | `music:check` |
| A4 | Vào cảnh nào ra cue đó, đúng ưu tiên | test `musicCueSelection.test.ts` |
| A5 | Chuyển cảnh mượt, không click/pop | nghe tay + log crossfade |
| A6 | Có thoại thì nhạc hạ 6 dB rồi hồi | test + nghe |
| A7 | Tắt sound / volume 0 → im tuyệt đối | test |
| A8 | Không tải file khi chưa cần (lazy) và không lỗi khi thiếu file | test + xem Network |

---

## 7. Ghi chú bản quyền

- Chỉ nhận: (a) owner tự sáng tác/thu, (b) CC0/Public Domain, (c) CC-BY **kèm** ghi công.
- Không nhận: nhạc có bản quyền, "beat" mua nhưng không có giấy phép phân phối lại, nhạc AI mà
  điều khoản không cho dùng thương mại.
- Ghi vào `CREDITS`: tên file, tác giả, giấy phép, link nguồn.
