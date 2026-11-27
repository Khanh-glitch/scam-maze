# Chuẩn chất lượng GTA / Gangstar Vegas — đánh giá hiện trạng SCAMMAZE

> **Tài liệu chuẩn (canonical) cho "chất lượng kiểu GTA".** Owner chốt ngày 27/11/2026: lấy
> **GTA (nhiều thời kỳ), GTA-like và Gangstar Vegas** làm thước đo cố định cho đồ hoạ, quy mô thế
> giới, độ dày hệ thống/logic và độ "chơi được" của game. Mọi hạng mục ship sau này phải được so
> với chuẩn này và ghi lại điểm trước/sau.
>
> **Trạng thái:** sống, cập nhật mỗi milestone. **Ngày đo:** 27/11/2026, commit `ef0acee`.
> **Nhãn trạng thái:** `IMPLEMENTED`, `PLANNED`, `PROPOSED`, `PENDING`, `DEPRECATED` theo
> [OVERVIEW.md §1](../architecture/OVERVIEW.md#1-status-legend).
> **Kế hoạch thi hành:** [UPGRADE_PLAN_MUSIC_MAP_MISSIONS.md](./UPGRADE_PLAN_MUSIC_MAP_MISSIONS.md).
> **Bối cảnh sản phẩm:** [PRODUCT_POSITIONING.md](./PRODUCT_POSITIONING.md) (định vị), nhưng phần
> mô tả code trong tài liệu đó đã cũ; hiện trạng đúng nằm ở tài liệu này và trong code.

---

## 0. Cách đọc tài liệu này

Ba câu hỏi, ba phần:

1. **Chuẩn là gì, đo bằng gì?** → §1 (thước đo), §2 (rubric 10 chiều).
2. **Mình đang ở đâu?** → §3 (điểm hiện tại + bằng chứng trong code), §4 (bảng dịch GTA → SCAMMAZE).
3. **Còn thiếu gì, vá ở đâu?** → §5 (khoảng trống gắn với task ID), §6 (mục tiêu số cho Chương 1),
   §7 (cách đo lại).

Không có phần nào được viết theo cảm tính: mỗi điểm số phải kèm **bằng chứng đo được** (file,
số liệu, test). Nếu một chiều chưa đo được, ghi `PENDING`, không cho điểm.

---

## 1. Chuẩn so sánh

### 1.1 Số liệu công bố

| Game | Năm | Diện tích bản đồ | Khối lượng nhiệm vụ | Vai trò trong so sánh |
|---|---|---|---|---|
| GTA: Vice City | 2002 | 9,11 km² | ~60 nhiệm vụ chính | Mốc "open-world đầu tiên đủ dày" |
| GTA: San Andreas | 2004 | 38,2 km² | 100+ nhiệm vụ, 3 thành phố | Mốc "thế giới rộng + nhiều hệ thống sinh hoạt" |
| GTA IV | 2008 | 16,14 km² | ~90 nhiệm vụ + hoạt động phụ | Mốc "mật độ và vật lý thay cho diện tích" |
| GTA V | 2013 | 75,84 km² | 69 nhiệm vụ chính + 60+ nhiệm vụ phụ/ngẫu nhiên | Mốc "chuẩn công nghiệp" hiện đại |
| **Gangstar Vegas** | 2013 | **~9 km²** | **80+ nhiệm vụ**, mini-event, đua xe, mua bất động sản | **Mốc "mobile/open-world cỡ vừa" — mốc gần mình nhất** |

Nguồn: bảng tổng hợp diện tích GTA ([freecash](https://freecash.com/academy/de/gaming/gta-maps-size-comparison),
[u7buy](https://www.u7buy.com/blog/how-big-is-gta-5-map/)), Gangstar Vegas ~9 km² và 80+ nhiệm vụ
([Grokipedia](https://grokipedia.com/page/Gangstar_Vegas), [Sportskeeda](https://www.sportskeeda.com/esports/10-open-world-games-mobile-phones-massive-engaging)).

**Đối chiếu hiện tại:** vùng đi bộ liên tục của SCAMMAZE đo từ `isWithinOpenWorld`
(`apps/game/src/features/testbus/openworld/world/saigonDistricts.ts:2406-2412`) là
**x ∈ [−25, 132], z ∈ [−356, 48]** → **157 m × 404 m ≈ 0,063 km²**.

| So với | Tỉ lệ diện tích | Nói thẳng |
|---|---|---|
| Vice City (9,11 km²) | **1/144** | Nhỏ hơn ~2 bậc độ lớn |
| Gangstar Vegas (~9 km²) | **1/142** | Cùng khoảng cách |
| GTA V (75,84 km²) | **1/1.203** | Không cùng hạng |

Nhưng **diện tích không phải thứ để đua**. GTA IV nhỏ hơn San Andreas 2,4 lần mà vẫn "đã" hơn vì
mật độ. Vì vậy chuẩn của mình là **mật độ + độ liền mạch + số thứ để làm**, không phải km².

### 1.2 Học gì, không học gì

| Học (craft) | Không học (nội dung/business) |
|---|---|
| Thế giới liền mạch, không màn hình loading giả | Bạo lực, tội phạm có thật, súng ống |
| Mỗi 30–60 giây lại có thứ để nhìn/chạm | Nội dung 18+, gambling, casino |
| Nhiệm vụ chính + nhiệm vụ lẻ + hoạt động lặp lại | Microtransaction, tiền tệ thật |
| Nhân vật có lịch sinh hoạt, phản ứng với người chơi | Trộm cắp/thương vụ hắc ám |
| Hệ quả tích luỹ, nhiều kết thúc | Cốt truyện tội phạm |
| Âm thanh dẫn dắt cảm xúc (radio, ambience, nhạc theo cảnh) | Nhạc bản quyền |

Câu một dòng: **học cách Rockstar/Gameloft làm cho thế giới "có người ở", không học cái thế giới
của họ kể.**

---

## 2. Rubric 10 chiều (0–5)

Thang điểm chung, dùng cho mọi chiều:

| Điểm | Nghĩa | Kiểm chứng bằng |
|---|---|---|
| 0 | Không có | Không tìm thấy code/asset |
| 1 | Khung sườn | Có class/dữ liệu nhưng người chơi không thấy |
| 2 | Prototype chơi được | Chạy được, thô, thiếu lớp |
| 3 | Mức indie ship được | Hoàn chỉnh trong phạm vi nhỏ, không lỗi rõ |
| 4 | Ngang GTA thời kỳ đầu (VC/IV) | Đủ lớp, đủ phản ứng, không "giả" |
| 5 | Ngang GTA V / chuẩn công nghiệp | Không phải mục tiêu của dự án |

| # | Chiều | Đo bằng |
|---|---|---|
| D1 | Quy mô & liền mạch thế giới | diện tích, số quận, có streaming, thời gian đi xuyên bản đồ |
| D2 | Mật độ & chi tiết môi trường | số prop/mặt tiền/ánh sáng trên 100 m đường, mức PBR, biển hiệu |
| D3 | Sinh hoạt & AI | số NPC hoạt động, lịch trình, giao thông, phản ứng với người chơi |
| D4 | Di chuyển & phương tiện | đi/chạy/xe máy/xe buýt/ô tô, camera, va chạm, tốc độ hợp lý |
| D5 | Địa điểm vào được | số nội thất riêng, số cửa mở được, chất lượng nội thất |
| D6 | Cấu trúc nhiệm vụ | main + side + hoạt động lặp, cửa sổ thời gian, mật độ nhiệm vụ/giờ |
| D7 | Hệ quả & phân nhánh | flag ghi/đọc, decision, ending, debrief, không soft-lock |
| D8 | Công cụ trong game | phone/PC app, bản đồ, journal, evidence, ngân hàng, lịch |
| D9 | Âm thanh & nhạc | nhạc nền theo cảnh, ambience, mix, voice, ducking |
| D10 | Hình ảnh & hiệu năng | chất lượng hình, fps, thời gian load, bộ nhớ |
| D11 | "Độ chơi được" (fun loop) | số hoạt động trong 10 phút, mật độ quyết định, lý do quay lại |

(D11 không nằm trong 10 chiều kỹ thuật nhưng là chiều quyết định; giữ tách riêng để không tự lừa
mình bằng điểm kỹ thuật cao.)

---

## 3. Hiện trạng: điểm và bằng chứng

### 3.1 Bảng điểm

| # | Chiều | Điểm | Thanh | Bằng chứng chính |
|---|---|---|---|---|
| D1 | Quy mô & liền mạch | **2** | ██░░░░░░░░ | 0,063 km²; 1 vùng liên tục; `khupho`, `testbus`, `roomv2` vẫn là **route riêng**, chưa nối thành một bản đồ |
| D2 | Mật độ môi trường | **3** | ███░░░░░░░ | PBR thật (`pbrTextures.ts`), biển hiệu neon, mưa ướt, Chợ Lớn, Landmark 81, Bitexco; nhưng mặt tiền lặp mẫu |
| D3 | Sinh hoạt & AI | **3** | ███░░░░░░░ | Traffic manager + làn xe, `humanPresence`, `storyNpcs`, phản ứng va chạm; thiếu lịch trình theo giờ/ quận |
| D4 | Di chuyển & phương tiện | **3** | ███░░░░░░░ | đi/chạy, xe máy Q9, buýt 06, xe ôm; camera & đèn tốt; thiếu ô tô tự lái trong chương, physics va chạm nông |
| D5 | Địa điểm vào được | **2** | ██░░░░░░░░ | Phòng trọ (roomv2) rất chi tiết; ngoài ra chủ yếu là mặt tiền, rất ít nội thất mở được |
| D6 | Cấu trúc nhiệm vụ | **1** | █░░░░░░░░░ | Chỉ M01 + M02 + 2 offer (`mission01Offers.ts`); M03–M05 **chưa tồn tại**; không có lớp hoạt động lặp |
| D7 | Hệ quả & phân nhánh | **1** | █░░░░░░░░░ | 45 flag (37 ghi, 8 để dành); nhưng `LAST_SUBMISSION_SCENARIO` có `decisions: {}`, `endings: {}` → `RoomEndingLayer` không bao giờ mở |
| D8 | Công cụ trong game | **3** | ███░░░░░░░ | phone/laptop, mail, bank, calendar, evidence, journal, journal notes; app chưa "thật" ở mức tra cứu chéo |
| D9 | Âm thanh & nhạc | **1** | █░░░░░░░░░ | Có 40 file audio (12 MB), nhạc **chỉ ở menu** (`menu_music.mp3`, `menu_ambient.mp3`); trong chương `musicVolume` không được dùng; có SFX phòng, ringtone, ambience phố, voice M02 |
| D10 | Hình ảnh & hiệu năng | **3** | ███░░░░░░░ | 41 GLB/73 MB, LOD/batcher/quality probe; chưa có cổng đo fps/memory tự động |
| D11 | Độ chơi được | **2** | ██░░░░░░░░ | Cảnh lừa đảo viết tốt, nhưng nhịp thưa: nhiều phút không có gì để làm ngoài đọc |

**Trung bình 10 chiều kỹ thuật: 2,2/5.** Mục tiêu Chương 1: **≥ 3,1/5** (xem §6).

### 3.2 Vì sao điểm này, không phải cao hơn

- **D1 = 2, không phải 3:** thế giới liền mạch *trong* một cụm, nhưng ba thế giới mạnh nhất
  (`khupho`, `testbus`, `roomv2`) vẫn mở bằng ba URL khác nhau. Người chơi "dịch chuyển" bằng
  route, không bằng chân. GTA không bao giờ làm vậy.
- **D6 = 1, không phải 2:** có 2 nhiệm vụ chính + 2 nhiệm vụ lẻ là **nội dung thật**, nhưng thiếu
  hẳn lớp "hoạt động" (việc làm thêm, giao hàng, sửa máy) — thứ chiếm 70% thời lượng trong
  Gangstar/GTA. Và M03–M05 của chính GDD chưa có.
- **D7 = 1:** flag nhiều nhưng **không có kết thúc**: `reducer.ts:1088` chỉ chọn outcome khi có
  `decision`, mà chương đang chạy không có `DecisionDef` nào. Một chương không có ending thì mọi lựa
  chọn đều là trang trí; đây là lỗ hổng nặng nhất về "logic" so với chuẩn. (Thêm một bẫy: `outcome.ts:22`
  mặc định dùng scenario legacy.)
- **D9 = 1:** không có nhạc trong chương. Với GTA, nhạc là **50% cảm giác thế giới**; thiếu nhạc
  làm mọi cảnh "phẳng" dù hình đẹp.

### 3.3 Điểm mạnh đang có (đừng làm mất)

| Thứ đã tốt | Ở đâu | Giữ bằng cách nào |
|---|---|---|
| Hình ảnh PBR + mưa ướt + neon Sài Gòn | `openworld/world/pbrTextures.ts`, `AtmosphereSystem.ts`, `KhuphoRain.ts` | Mọi thay đổi map phải giữ quality probe hiện tại |
| Giao thông & đám đông có phản ứng | `traffic/`, `simulation/humanPresence.ts` | Tái dùng, chỉ thêm lịch trình; không viết lại |
| Cấu trúc dữ liệu nhiệm vụ tất định | `game/narrative/*`, `mission01Offers.ts` | Mọi nhiệm vụ mới phải là `MissionDef` thuần dữ liệu |
| Bộ kiểm thử nội dung | 280 file / 2.526 test | Mỗi nhiệm vụ mới kèm test reachability + content |
| Điện thoại/laptop có app thật | `chapter1/phone`, `deviceActions` | Mở rộng app, không thay bằng UI giả |
| Task tracker + task list + marker (kiểu GTA) | `features/chapter1/hud/{TaskTracker,TaskListPanel,TaskMarker}.tsx` | Chỉ cần mở rộng marker ra ngoài trời, không viết HUD mới |

---

## 4. Bảng dịch: GTA làm gì → mình làm gì

Đây là phần "học GTA" cụ thể nhất. Cột phải là thứ sẽ được ship, không phải mong ước.

| Hệ thống trong GTA | Vì sao nó hiệu quả | Tương đương trong SCAMMAZE | Giai đoạn |
|---|---|---|---|
| Bản đồ liền mạch, đi bộ/xe xuyên quận | Cảm giác "thành phố thật", không bị cắt cảnh | Một bản đồ Sài Gòn nối `roomv2` ↔ `khupho` ↔ `testbus` bằng đường bộ; route chỉ còn để test | W2 |
| Quận có cá tính riêng (kinh tế, ánh sáng, âm thanh) | Người chơi nhớ "chỗ nào ra chỗ nào" | Q10 (khu trọ, chợ), Q5 (Chợ Lớn), Q1 (tài chính, Bitexco), Q3 (cà phê/văn phòng), Bình Thạnh (bến xe) | W2 |
| Nhiệm vụ chính có mốc thời gian | Tạo áp lực, dạy cách ưu tiên | 72 giờ, M01–M05 theo GDD, mỗi mốc là một cửa sổ | W3 |
| Strangers & Freaks (người lạ nhờ việc) | Nội dung phụ xuất hiện tự nhiên, không cần menu | 8 nhiệm vụ lẻ gắn địa điểm: giao hàng, in ấn, cà phê, phòng trọ, sửa laptop… | W3 |
| Hoạt động lặp (đua, taxi, golf) | Luôn có thứ làm khi rảnh | Việc làm thêm theo ca (cà phê, giao hàng, trông xe), mỗi ca tốn giờ trong game và trả tiền | W3 |
| Radio + nhạc theo cảnh | Thế giới có "nhịp", cảm xúc dẫn dắt | Music Director thích ứng (calm/quiet/tense) + "Radio Alex" 3 kênh trong phone | W1 |
| Safehouse | Nơi nghỉ, nơi lưu game | Phòng trọ = safehouse; ngủ để qua giờ, đổi cảnh | W2 |
| Cửa hàng, tiệm, chợ | Điểm tương tác dày | Tiệm in, quán cà phê, chợ Chợ Lớn, tiệm sửa laptop — mở cửa được | W2 |
| Taxi/buýt làm điểm dịch chuyển | Dạy người chơi bản đồ | Buýt 06 + xe ôm có giá và thời gian thật; đi xe tốn tiền, đi bộ tốn giờ | W2 |
| Wanted level | Hệ quả nhìn thấy được | "Mức rủi ro" (security) hiển thị trên HUD và trong điện thoại, tăng khi lộ OTP/giấy tờ | W3 |
| Nhiệm vụ phân nhánh theo lịch sử | Chơi lại thấy khác | Decision + ending theo flag (5 kết thúc), debrief kể lại đánh đổi | W3 |
| Bản đồ minimap có tên đường/quận | Định hướng | `SaigonMinimap` mở rộng: tên quận, POI, nhiệm vụ đang mở | W2 |

---

## 5. Khoảng trống → task

| Khoảng trống | Chiều | Việc vá (task trong plan) |
|---|---|---|
| Không có nhạc trong chương; `musicVolume` chết | D9 | T10–T17 |
| Ba thế giới rời rạc, 0,063 km² | D1, D5 | T20–T23 |
| Mặt tiền lặp, thiếu điểm vào | D2, D5 | T21–T24 |
| Thiếu lịch sinh hoạt theo giờ/quận | D3 | T25 |
| Không có lớp nhiệm vụ lẻ/hoạt động | D6, D11 | T30–T38 |
| Chương không có ending/debrief | D7 | T35, T39 |
| HUD nhiệm vụ chưa có waypoint ngoài trời | D6, D8 | T31 |
| Không có cổng đo hiệu năng | D10 | T03, T27 |
| Nhịp chơi thưa | D11 | T36–T39 |

---

## 6. Mục tiêu số cho Chương 1 ("Gangstar-lite")

Không đặt mục tiêu 9 km². Đặt mục tiêu **mật độ ngang Gangstar trong một diện tích nhỏ hơn**:

| Chỉ số | Hiện tại | M1 (sau W1) | M2 (sau W2) | M3 (sau W3) |
|---|---|---|---|---|
| Diện tích liên tục | 0,063 km² | 0,063 | **0,35 km²** (≈ 5,5×) | 0,35 |
| Quận liên tục | 2 (Q10, Q1) + Chợ Lớn | 2 | **7** | 7 |
| Địa điểm vào được (nội thất) | 1 (phòng trọ) | 1 | **5** | 5 |
| Điểm tương tác có tên (POI) | ~12 | 12 | **40** | 55 |
| Nhiệm vụ chính chơi được | 2 | 2 | 2 | **5** |
| Nhiệm vụ lẻ | 2 offer | 2 | 2 | **8** |
| Hoạt động lặp | 0 | 0 | 0 | **4** |
| Kết thúc | 0 | 0 | 0 | **5** (3 hảo + 1 xấu + 1 "trả giá") |
| Câu nhạc thích ứng | 1 (menu) | **6** | 8 | 10 |
| Thời gian đi bộ xuyên bản đồ | ~4 phút | 4 | **≤ 12 phút** | 12 |
| Thời gian đi buýt xuyên bản đồ | — | — | **≤ 3 phút** | 3 |
| Thời gian giữa hai điểm tương tác | > 60 s | > 60 s | **≤ 45 s** | ≤ 30 s |
| FPS mục tiêu (desktop, high) | chưa đo | ≥ 60 | ≥ 60 | ≥ 60 |
| Thời gian vào chơi được | ~10–15 s | ≤ 12 s | ≤ 15 s | ≤ 15 s |
| Điểm rubric trung bình | 2,2 | **2,4** | **2,7** | **3,2** |

Điểm mục tiêu theo từng chiều (để con số trung bình kiểm được, không phải cảm tính):

| Chiều | Hiện tại | M1 | M2 | M3 | Đổi ở đâu |
|---|---|---|---|---|---|
| D1 Quy mô & liền mạch | 2 | 2 | **3** | 3 | W2: 7 quận nối bằng đường bộ |
| D2 Mật độ môi trường | 3 | 3 | **4** | 4 | W2: generator + 7 địa danh thủ công |
| D3 Sinh hoạt & AI | 3 | 3 | 3 | 3 | W2 có lịch sinh hoạt, chưa đủ để lên 4 |
| D4 Di chuyển & phương tiện | 3 | 3 | 3 | 3 | W2 thêm buýt/xe ôm nối quận |
| D5 Địa điểm vào được | 2 | 2 | **3** | 3 | W2: 5 nội thất |
| D6 Cấu trúc nhiệm vụ | 1 | 1 | 1 | **3** | W3: 5 main + 8 side + 4 activity |
| D7 Hệ quả & phân nhánh | 1 | 1 | 1 | **3** | W3: decision + 5 ending + debrief |
| D8 Công cụ trong game | 3 | 3 | 3 | 3 | — |
| D9 Âm thanh & nhạc | 1 | **3** | 3 | 3 | W1: 6 cue + ducking |
| D10 Hình ảnh & hiệu năng | 3 | 3 | 3 | 3 | gate perf, chưa lên 4 |
| D11 Độ chơi được | 2 | 2 | 2 | **3** | W3: hoạt động lặp |

Ghi chú: 0,35 km² là **590 m × 590 m** — vẫn chỉ bằng **1/26** Gangstar Vegas, nhưng gấp 5,5 lần
hiện tại và đủ chỗ cho 7 quận + 5 nội thất. Muốn hơn nữa thì phải có generator (T21) chạy ổn định
trước; không hứa trước.

---

## 7. Cách đo lại (để điểm không phải ý kiến)

| Chỉ số | Công cụ | Ghi chú |
|---|---|---|
| Diện tích, số quận, POI | script đếm từ dữ liệu map (`docs` + `world` test) | T03 |
| Số nhiệm vụ, flag, ending | test đếm từ `LAST_SUBMISSION_SCENARIO` | đã có tiền lệ trong `journey.test.ts` |
| FPS, thời gian load, memory | quality probe + `performance.now()` log trong dev | T03/T27 |
| Nhạc: cue nào đang phát | `MusicDirector` expose `currentCue()` + test | T11 |
| Nhịp chơi | biên bản chơi tay (10 phút) ghi số tương tác | mỗi milestone |

**Quy tắc:** không có số đo thì không tăng điểm. Bảng §6 là hợp đồng, không phải ước mơ.

---

## 8. Rủi ro của việc lấy GTA làm chuẩn

| Rủi ro | Dấu hiệu | Cách chặn |
|---|---|---|
| Đua diện tích, loãng nội dung | Bản đồ rộng mà 40% là mặt tiền trống | Cổng mật độ: ≤ 45 s giữa hai điểm tương tác; không mở quận mới khi quận cũ chưa đạt |
| Bắt chước nội dung | Xuất hiện bạo lực/trộm cắp | §1.2 là danh sách đỏ; review nội dung theo `contentSafety.property.test.ts` |
| Vỡ hiệu năng web | fps tụt khi thêm quận | Ngân sách perf từ T03, gate ở T27 |
| Asset bản quyền | nhạc/3D lạ không rõ nguồn | Chỉ dùng asset tự tạo, CC0 hoặc đã có trong repo |
| Kỳ vọng "AAA" | so sánh với GTA V | Ngôn ngữ công khai: *"Gangstar-lite trong browser"*, không phải "GTA bản Việt" |
