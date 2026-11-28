# KẾ HOẠCH — làm thành phố "đúng như thật", không còn hình nhân tạo

Cập nhật: 2026-11-28 · nhánh `arena/3d9c58b4-scam-maze` · trạng thái: **đang chạy**

## 0. Triết lí làm việc (bắt buộc, áp cho mọi bước)

1. **Một kế hoạch trước mọi hành động.** Không sửa file nào mà chưa có dòng kế hoạch + lý do đo được.
2. **Một bước nghiên cứu trước mọi hành động.** Nghiên cứu = đọc code trong repo **và** nguồn mở
   bên ngoài (clone/đọc source, không phỏng đoán từ ảnh).
3. **Xem kết quả bằng mắt + bằng số.** Dựng công cụ render nhìn từ trên xuống từ **chính dữ liệu
   hình học** của repo → PNG, đọc bằng mắt, đối chiếu số đo. Không suy luận từ ảnh chụp màn hình cũ.
4. **Không dừng trước khi xong. Không nói "không được".** Gặp chặn thì đổi đường (clone nguồn mở,
   tự dựng công cụ đo) rồi đi tiếp.
5. **Lý Thái Tổ là luật, không phải cảm hứng.** Xe/người/đèn/vạch của LTT (`simulation/street.ts`,
   `traffic/roadGraph.ts`) là hợp đồng. Thành phố thủ tục phải *sinh ra dữ liệu khớp hợp đồng đó*,
   không được vẽ lại luật mới, không "mix" hai hệ.

## 1. Lỗi người dùng báo — và giả thuyết kỹ thuật phải chứng minh

| # | triệu chứng | giả thuyết ban đầu (phải chứng minh bằng code/số) |
| --- | --- | --- |
| L1 | đường đâm xuyên công trình | `cityGen` sinh tuyến **trước** rồi mới đặt nhà, không kiểm tra hình học tuyến; hoặc nhà đặt theo lưới ô độc lập với tuyến |
| L2 | công trình dính chùm | chia lô (`blocks`) không trừ lộ giới; nhiều khối chồng nhau khi `insideBlock` |
| L3 | đèn đặt sai chỗ | `signalPlacement` tính cột theo nhánh vào nhưng hình học ngã tư thành phố khác LTT (lệch tâm/hộp) |
| L4 | xe đi lùi / đi ngược chiều | làn A/B: `start`/`end` của cạnh + `carLaneOffsets` lệch dấu; hoặc `axis` sai so với vector tuyến |
| L5 | xe dừng đèn đỏ vô lí | `TrafficSignalController` không có `IntersectionSpec` cho ngã tư mới ⇒ `getAxisState` trả green 99; hoặc stop line = đầu cạnh nằm giữa ngã tư |
| L6 | tuyến đường ngổn ngang, thiếu nguyên tắc | sinh tuyến bằng chọn ngẫu nhiên 24 tuyến trong 139, không phân cấp (đại lộ/phố/hẻm), không khớp lưới |
| L7 | NPC dùng "đồ giả" | cần kiểm: NPC nào là model thật, NPC nào là hình khối tự dựng |

## 2. Thứ tự bước (mỗi bước commit riêng, mỗi bước phải có ảnh + số)

- [ ] **B0 — Công cụ nhìn.** `tools/cityTopView.ts`: raster hoá **dữ liệu thật** (`CityMesh` parts,
      `CityStreet`, `city.buildings`, vị trí xe/ped/đèn theo thời gian) ra PNG nhìn từ trên xuống,
      nhiều tỉ lệ, có chế độ ảnh động (nhiều frame → dải ảnh). Đây là "mắt" của phiên làm việc.
- [ ] **B1 — Nghiên cứu.**
  - Trong repo: `cityGen.ts` (sinh tuyến/lô/nhà), `cityNetwork.ts`, `cityTraffic.ts`,
    `signalPlacement.ts`, `roadGraph.buildNetwork()` (đường LTT đặt làn/stop line thế nào),
    `trafficManager` (IDM/ACC, dừng đèn), `street.ts` (LTT đặt đèn/vạch/gờ).
  - Ngoài repo (clone/đọc): sinh đô thị thủ tục có kiểm soát lưới — Parish & Müller 2001
    (L-system + block subdivision), CityEngine rule-based zoning, `probable-train`/`city-generator`
    nguồn mở; làn xe: IDM (Treiber 2000), MOBIL (Kesting 2007). Ghi lại kết luận vào §4.
- [ ] **B2 — Hình học đường & nhà (L1, L2, L6).** Sinh lưới có phân cấp (đại lộ 21,2 m → phố 12,8 m
      → hẻm 7,2 m) theo lưới trực giao có nhịp, cắt tuyến theo **lộ giới**, đặt nhà **sau khi** có
      tuyến, mỗi nhà cách tim đường ≥ lộ giới + hè, không chồng khối.
- [ ] **B3 — Đèn (L3, L5).** Đặt cột/stop line theo đúng `deriveSignalApproaches` + hình học hộp
      ngã tư; mọi ngã tư có đèn phải có `IntersectionSpec` trong bộ điều khiển.
- [ ] **B4 — Xe (L4, L5).** Một chiều = một làn đúng phía (phải), hướng cạnh khớp vector tuyến, dừng
      ở vạch dừng trước hộp ngã tư, không lùi, không đè vạch.
- [ ] **B5 — NPC thật (L7).** Chỉ dùng model có trong `public/assets/testbus/ow/models`, không
      hình khối thay thế.
- [ ] **B6 — Đo lại toàn bộ**: `perStepMs`, draw calls, mảnh, ảnh top-view trước/sau.

## 3. Bất biến (không được phá)

1. Chỉ `cityLayer` cấy hình vào scene `OpenWorldEngine`; không engine/đèn/trời thứ hai.
2. Khổ đường 12,8 / 7,2 / 21,2 m; cao độ nhựa 0,0 · hè 0,24 · `CURB_HEIGHT` 0,16 · nền −0,12.
3. Mọi thay đổi engine là **tham số tuỳ chọn, mặc định giữ hành vi cũ** ⇒ `/testbus` y nguyên.
4. `perStepMs < 0,5` (test nới 1,5 trên sandbox), draw calls < 260.
5. Không headless browser/Chromium. Ảnh phải sinh từ **dữ liệu hình học của repo**.

## 4. Kết luận nghiên cứu (điền dần)

_(trống — điền ở B1)_
