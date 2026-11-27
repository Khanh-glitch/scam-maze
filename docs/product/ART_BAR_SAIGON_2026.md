# Chuẩn thẩm mỹ & độ thật — Sài Gòn 2026, ngang tầm GTA

> **Vì sao có file này:** tiêu chí cũ ("đẹp, thật, usable, không lỗi") vẫn cho phép một đầu ra là
> **những khối ô rời rạc có chữ** — và đúng là bản đồ audit hôm trước trông như vậy. File này tách
> hai thứ ra, rồi đặt chuẩn riêng cho từng thứ. Chuẩn thẩm mỹ lấy **GTA VI (ra 19/11/2026)** làm mốc;
> độ thật lấy **Sài Gòn 2026** đã kiểm chứng bằng nguồn, không lấy ký ức.

---

## 0. Hai đầu ra khác nhau — đừng chấm chung

| | **Bản đồ đo** (ảnh plan hôm trước) | **Thế giới người chơi thấy** |
|---|---|---|
| Nó là gì | Bản vẽ kỹ thuật: chỗ nào đi được, chỗ nào chặn | Mesh, vật liệu, ánh sáng, âm thanh, người, xe |
| Trông thế nào | **Đúng là ô chữ nhật có nhãn** — và phải như vậy | Không được có một ô chữ nhật nào nhìn ra được |
| Chuẩn để chấm | Liền mạch, đúng diện tích, không tường vô hình | GTA: mật độ, tỷ lệ, dấu vết, ánh sáng |
| Ai chấm | Script + test (đã có) | Mắt người, trên máy owner |

Nói thẳng: ảnh plan là **bản vẽ thi công**, không phải sản phẩm. Nếu game trông giống bản vẽ thi công
thì đó là lỗi — nhưng sửa nó không phải bằng cách vẽ đẹp hơn cái plan, mà bằng cách dựng hình học.

---

## 1. Sáu cơ chế làm map GTA "thật" — và cái nào mình dùng được

GTA không thật vì poly cao. Nó thật vì sáu thứ, xếp theo mức ảnh hưởng:

1. **Mật độ vi mô phân dạng (fractal density).** Ở Los Santos, máy lạnh trên mái nhà trọ, graffiti
   trong hẻm, tủ kem trong tiệm tạp hoá — chi tiết ở *mọi* tỷ lệ, không có mảng phẳng nào "để trống".
   Một mod cộng 20.000 vật thể + 300 biển giao thông đã đổi hẳn cảm giác thành phố.
2. **Nén không gian có chủ đích, giữ đúng nhịp cảm xúc.** Los Santos nén LA 500 dặm² thành ~127 km²,
   nhưng vẫn để bạn *nhìn thấy* đài thiên văn từ sân bay dù ngoài đời cách 20 dặm. Tức là: cắt diện
   tích, **không cắt sightline**.
3. **Địa hình = tầng xã hội.** GTA V đọc được giàu/nghèo bằng vật liệu, độ bẩn, mật độ biển hiệu,
   cây xanh — trước khi đọc một dòng hội thoại nào.
4. **Nội thất, không chỉ mặt tiền.** GTA VI công bố "nhiều nội thất hơn một bậc độ lớn", làm tay,
   không procedural; lý do họ nêu: khi hình ảnh đã thật, người chơi không tha cho sự giả ở tầng hệ thống.
5. **Mật độ người là tính năng bản đồ**, không phải trang trí: đông người đổi cách bạn trốn, chạy, phạm tội.
6. **Nhịp sáng theo giờ + thời tiết** đổi cả cách đọc không gian (đêm ở GTA không chỉ tối hơn).

**Cái mình không copy được / không nên copy:** mật độ xe hơi. Sài Gòn là thành phố **xe máy**
(~70–80 % lưu lượng). Đường, bãi đỗ, tiếng ồn, cách NPC né nhau đều phải thiết kế lại — copy GTA là
copy sai thành phố.

---

## 2. Chuẩn GTA, quy ra số để chấm

Các ngưỡng dưới đây là **hợp đồng**, không phải ước lượng. Mỗi ngưỡng đều đếm được bằng script hoặc
bằng một lần đi bộ trong game.

| # | Hạng mục | Ngưỡng | Cách kiểm |
|---|---|---|---|
| A1 | Đơn vị kinh doanh trên 100 m mặt phố | ≥ 12 đơn vị, **≥ 6 chức năng khác nhau** | đếm trong `venues.json` |
| A2 | Biến thể kiến trúc trên 100 m | ≥ 6 tổ hợp (màu cửa cuốn × mái × ban công × tầng lửng) | so 2 đơn vị liền nhau: không trùng tổ hợp |
| A3 | Vật thể vỉa hè trên 100 m | ≥ 25 (ghế nhựa, xe máy dựng, thùng xốp, cây, bảng, dây, bơm xe) | đếm instance |
| A4 | Chi tiết trên 10 m tường (0–3 m) | ≥ 8 (dây điện, ống nước, ổ khoá, vết ố, tờ rơi, móc treo, số nhà, chuông) | đi bộ sát tường, đếm |
| A5 | Tỷ lệ đơn vị tầng trệt **vào được** | ≥ 30 % ở lõi (Chợ Lớn/Q1), ≥ 12 % ngoại vi | `venues.json` có `interior: true` |
| A6 | Người nhìn thấy trong 60 m phố | 12–25 (trục chính, ban ngày); 3–6 (hẻm) | đứng yên đếm |
| A7 | Tỷ lệ phương tiện | **70–80 % xe máy**, 15–20 % ô tô, 3–5 % buýt/xe tải | cấu hình spawn |
| A8 | Mảng phẳng vô cớ | **0** mảng > 2 m² chỉ một màu, không lý do | soi vật liệu |
| A9 | Mặt tiền trống | **0** đoạn > 60 m không có gì để nhìn/chạm | audit + mắt |
| A10 | Lớp âm thanh | ≥ 5 lớp (xe máy, còi, loa kẹo kéo/quảng cáo, quạt nước, công trường) | nghe, tắt từng lớp |

**Ba tầng "đẹp" phải đạt cùng lúc:**

1. **Silhouette** — nhìn 100 m: mái tôn so le, bảng hiệu nhô ra, dây điện, tum nhà. Không có đường
   chân trời phẳng.
2. **Surface** — nhìn 3 m: vật liệu đúng tỷ lệ (gạch 200 mm, tôn 1 m, cửa cuốn 3 m), 3 lớp bẩn.
3. **Story** — nhìn 30 giây: biết ai sống ở đây. Không có chữ nào vẫn hiểu.

Thiếu tầng 1 thì đẹp kiểu "model"; thiếu tầng 3 thì là phông nền. **Cả ba cùng đạt mới gọi là xong.**

---

## 3. Sài Gòn 2026 — bảy lớp sự thật phải có trong map

Đây là phần trả lời "hàng thật". Mỗi mục đều có nguồn ở §6, và mỗi mục đều **đổi gameplay**, không chỉ
đổi hình.

### 3.1 Hành chính: **không còn "quận"** — map đang ghi sai

Từ 1/7/2025, TP.HCM chỉ còn hai cấp **phường/xã** (168 đơn vị). Nhãn `Quận 10 → Quận 1` trong game là
**sai thời sự 2026**:

| Khu cũ | Phường 2026 |
|---|---|
| Q10 (khu phòng trọ 6.07) | **Vườn Lài**, Diên Hồng, Hòa Hưng |
| Q5 (Chợ Lớn) | **Chợ Lớn**, An Đông, Chợ Quán |
| Q1 (Bitexco) | **Sài Gòn**, Bến Thành, Tân Định, Cầu Ông Lãnh |
| Bình Thạnh (Landmark 81) | **Thạnh Mỹ Tây**, Gia Định, Bình Thạnh, Bình Lợi Trung, Bình Quới |

→ Đổi nhãn sang phường. Và dùng luôn làm chất liệu: **công an phường** thay công an quận, trụ sở
phường, bảng "UBND phường Vườn Lài" — chi tiết nhỏ, độ thật lớn.

### 3.2 Metro: công trường ngay cạnh nhà

- **Metro số 1** đang chạy: 14 ga (3 ngầm), 52.000–64.000 lượt khách/ngày.
- **Metro số 2 Bến Thành – Tham Lương**: khởi công 15/1/2026, 11 ga, có **ga Hòa Hưng (ST04)** — cách
  khu Q10 vài trăm mét. Tường vây sâu 41 m, rào tôn xanh, cần cẩu, hố đào.
- Tuyến Bến Thành – Thủ Thiêm khởi công 29/4/2026; Bến Thành – Cần Giờ động thổ 12/2025.

→ **Một công trường metro trong bản đồ** là thứ GTA-grade rẻ nhất: rào tôn, đèn nháy, bùn, tiếng khoan,
đường bị chặn. Gameplay: lối tắt, chỗ trốn, "nhà thầu giả" đòi tiền — đúng chủ đề lừa đảo.

### 3.3 Vỉa hè: chiến dịch dọn vỉa hè 2026

Năm 2026 TP.HCM ra quân mạnh: hơn **24.000 lượt tuần tra**, xử lý **33.000 trường hợp**, phạt hơn
**28 tỷ đồng**; đề xuất **"thẻ bán hàng rong gắn mã QR"**; chủ trương "chuyển đổi sinh kế" — dồn người
bán vào chợ đêm/khu tập trung.

→ Đây là **cơ chế xã hội trong game**: hàng rong bị đuổi, công an phường đi tuần, thẻ QR giả, "phí
duy trì chỗ ngồi". Vừa thật, vừa là đất diễn cho scam.

### 3.4 Thương mại: chuỗi thật đang thắng và đang chết

- Cà phê: **Highlands > 1.000 điểm bán**, **Phúc Long 237 → ~250**, **Katinat ~120**, **The Coffee
  House co lại dưới 100 cửa hàng**.
- Tiện lợi: FamilyMart, Circle K, GS25, WinMart+, Co.op Food, Co.opSmile, 7-Eleven, B's Mart, Ministop.

→ Mặt phố 2026 là **cuộc chiến chuỗi**: một bên là biển hiệu đồng bộ, máy lạnh, kính; một bên là tiệm
tạp hoá, cầm đồ, sửa xe, quán cóc. **The Coffee House đóng cửa** là loại chi tiết kể chuyện hay nhất:
mặt bằng trống, decal bong, cho thuê — và là chỗ để mở "văn phòng" lừa đảo.

### 3.5 Tiền: QR và ví điện tử là mặc định

Thanh toán không tiền mặt đã phổ cập (VietQR, MoMo, ZaloPay), kể cả **thu phí vỉa hè qua app** ở phường.

→ Với game về lừa đảo, đây là **cơ chế lõi**: mọi giao dịch là QR + tài khoản. Câu chuyện "chuyển
khoản rồi bị chặn" thật hơn hẳn "đưa phong bì". Đồng thời: biển "NHẬN CHUYỂN KHOẢN", mã QR dán trên
quầy, điện thoại cũ bán lại — đều là prop thật, đọc được.

### 3.6 Phương tiện & giao hàng

Xe công nghệ (Grab/Be/Xanh SM) và ship đồ ăn là cảnh quan đường phố, không phải ngoại lệ: áo đồng
phục, thùng sau, đứng chờ ở quán, tấp lề.

→ Đây là **NPC có nghề**: shipper là nguồn thông tin, là người giao "hàng", cũng là người có thể bị lừa.

### 3.7 Khí hậu & ánh sáng

Nắng gắt 11–14 h (bóng cứng, bê tông cháy trắng), mưa chiều 16–18 h (đường bóng, áo mưa, kẹt xe),
đêm ẩm + neon. Ba chế độ này phải **đổi cả gameplay** (tầm nhìn, tiếng, ai đứng đâu), không chỉ đổi filter.

---

## 4. "Hàng thật" — làm đến đâu là hợp pháp và hợp lý

Ba mức, chọn theo mức chịu rủi ro của owner:

| Mức | Làm gì | Rủi ro | Đề xuất |
|---|---|---|---|
| **1. Hành vi thật** | Loại hàng, giá thật (bánh mì 15–25k, cơm tấm 35–45k, cà phê sữa 25–35k), cách bày, kiểu chữ trên biển, số nhà, giấy dán tường | Không | **Bắt buộc** |
| **2. Thương hiệu nhại** | Tên na ná theo logic tiếng Việt ("Cà phê Phố Long", "VinMart +" → "WinMart −"), logo khác, màu gần giống | Thấp (GTA làm đúng cách này: Burger Shot, Cluckin' Bell) | **Mặc định** |
| **3. Thương hiệu thật** | Dùng logo/tên thật của Highlands, Circle K… | Cao: vi phạm nhãn hiệu, có thể bị gỡ store | Chỉ khi owner chấp nhận, và chỉ ở dạng "có thật ở Sài Gòn" chứ không dùng logo |

Điểm quan trọng: **cái làm nên "thật" là hành vi và tỷ lệ, không phải logo.** Một quán cà phê vỉa hè
đúng giá, đúng ghế nhựa, đúng ly, đúng cách nói — thật hơn một cái biển Highlands sai bối cảnh.

---

## 5. Cách chứng minh (không hứa)

Không thể nói "cả 0,35 km² sẽ đạt chuẩn GTA" trước khi dựng được **một** khối đạt chuẩn đó.

**Vertical slice — 1 khối, 60 × 60 m, làm tới cùng:** hẻm 462/14 Lý Thái Tổ + mặt tiền Lý Thái Tổ
(đoạn có phòng trọ 6.07). Đây là nơi người chơi bắt đầu, nên nó phải là nơi đẹp nhất.

Điều kiện nghiệm thu của khối này:

- Đạt **A1–A10** ở §2, đếm được.
- Có ≥ 3 nội thất vào được (phòng trọ, tiệm tạp hoá, quán cà phê cóc).
- Đứng ở 4 khoảng cách (0,5 m / 3 m / 15 m / 60 m): mỗi khoảng cách có ≥ 5 thứ đáng nhìn.
- Bật 4 chế độ (trưa / 17 h / đêm / mưa): 4 ảnh khác nhau rõ rệt.
- 60 fps trên máy owner ở chế độ này.
- Xoá hết chữ: vẫn biết đây là hẻm lao động Sài Gòn, không phải hẻm Thái/Bali/Nhật.

Đạt → nhân bản có kiểm soát (generator + tay). Không đạt → sửa khối đó, **không mở rộng**.

---

## 6. Nguồn

- Hành chính 2025–2026: [HTV — nhận diện phường mới](https://htv.vn/nhan-dien-phuong-cua-tphcm-moi-qua-hinh-anh-truc-quan-22225070514435747.htm),
  [Bình Thạnh sau sáp nhập](https://ghiensaigon.com/quan-binh-thanh-sau-sap-nhap/).
- Metro: [9 tuyến metro 2026–2027](https://adongland.vn/9-tuyen-metro-tphcm-2026-2027/),
  [Tuổi Trẻ — metro số 2 làm cả 11 ga](https://tuoitre.vn/metro-ben-thanh-tham-luong-cuoi-nam-2026-lam-ca-11-nha-ga-1002610221731207.htm).
- Vỉa hè 2026: [Tuổi Trẻ — lập lại trật tự vỉa hè](https://tuoitre.vn/tp-hcm-manh-tay-lap-lai-trat-tu-via-he-nhieu-noi-da-thong-thoang-2026011908090235.htm),
  [SGGP — theo hướng bền vững](https://dttc.sggp.org.vn/tphcm-lap-lai-trat-tu-via-he-theo-huong-ben-vung-post133960.html),
  [Tuổi Trẻ — thẻ bán hàng rong gắn QR](https://tuoitre.vn/nld/via-he-hang-rong-va-sinh-ke-196260204201532858.htm).
- Chuỗi F&B/bán lẻ 2026: [CafeBiz](https://cafebiz.vn/con-chua-day-100-cua-hang-the-coffee-house-sap-bi-katinat-vuot-mat-tut-xuong-hang-cuoi-trong-cuoc-dua-chuoi-ca-phe-176260520085718643.chn),
  [Top chuỗi tiện lợi TP.HCM](https://mytour.vn/vi/blog/bai-viet/top-11-chuoi-cua-hang-tien-loi-tai-tphcm.html).
- GTA: [GTA VI — handmade density, nội thất](https://news.quantosei.com/2026/10/29/grand-theft-auto-vi-inside-the-massive-leonida-world/),
  [GTA VI — mật độ vs diện tích](https://www.gtalab.gg/en/news/gta-6-map-density-vs-size-leonida-open-world),
  [Los Santos vs LA — nén không gian, sightline](https://archup.net/comparing-los-santos-map-los-angeles/),
  [mod 20.000 vật thể + 300 biển](https://www.gamefront.com/games/gamingtoday/article/this-impressive-gta-v-mod-completely-overhauls-los-santos-with-insane-detail).
