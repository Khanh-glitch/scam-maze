# Chợ Lớn: cái đã có, cái còn thiếu

Ghi lại sau vòng dựng mặt tiền + tháp cổng, để vòng sau không phải phát hiện lại
và không lặp lại lỗi "xây chồng lên thứ đã có".

## Đã có (đo được)

| Hạng mục | Số đo | Kiểm chứng |
|---|---|---|
| Dãy nhà ống sau chợ | 15 căn, cao 7,3–11,3 m, tường đôi 0,2 m | ảnh `choLon/07` |
| Mặt tiền chợ | hàng cột 3,05 m, 2 cổng phụ, 1 cổng chính | ảnh `final/03` |
| Tháp cổng | 13,1 m, 3 tầng mái, 4 mặt đồng hồ, phù điêu rồng | ảnh `gate3/01` |
| Mặt tiền chụp thật | `createRealSaigonShophousePBR` shop3/shop5, tint riêng | có |
| Ghế đẩu + xe máy | model GLB thật, collider từ `propSize` | `choLon.furniture.test.ts` |
| Khe sáng giữa hai mái | 1,4 m, nón sáng additive | ảnh `final/02` |
| Cây phố | trưởng thành, trồng ở khoảng trống `z −136` | ảnh `final/03` |

**Cổng đo:** 0/20.023 đỉnh trên lòng đường · 14 ô chồng · đỉnh đông `−19,00` ·
257 file / 2316 test · tsc sạch · build sạch.

## Còn thiếu — và vì sao

1. **Sân trong trung tâm + đền thờ Quách Đàm.**
   Thật: 2.500 m². Chợ ta: 336 m² toàn bộ. Sân trong thật **lớn hơn cả chợ 7 lần**.
   Không thể làm ở tỷ lệ này. *Cái thay thế được:* khe sáng giữa hai mái — đã làm.

2. **Mái ngói âm dương đỏ-xanh trên toàn dãy.**
   Thật: mái hai tầng phủ toàn bộ 2,5 ha. Chợ ta dùng **mái hiên vải** vì đây là
   chợ vỉa hè dưới hiên, không phải chợ có tường. Hai kiểu công trình khác nhau.
   *Quyết định:* giữ hiên vải — nó đúng với loại chợ này và với ảnh tham chiếu.

3. **Tầng trên có cầu thang đá.**
   Thật: 748 sạp tầng trên, 2 cầu thang đá rộng. Chợ ta **không có tầng trên** —
   sâu 7 m, không đủ chỗ cho cầu thang + sàn.
   *Cái thay thế được:* khe sáng (đã làm) tạo cảm giác không gian có chiều cao.

4. **12 cổng phụ.**
   Đã làm **2**, theo tỷ lệ chứ không copy số. Lý do ở commit `cd8fedd`.

## Bài học về quy trình

Ba lần trong vòng này tôi xây chồng lên thứ đã có:
- dãy nhà ống thứ hai lên vỉa hè phố (vòng 27)
- vỉa hè đá lên vỉa hè phố đã lát
- đồ đạc chợ lên 96 vật của phố

**Quy tắc rút ra: trước khi đặt bất cứ thứ gì, quét ô 1 m ở đúng toạ độ đó trước.**
`street-collision.test.ts` bắt được cả ba, nhưng chỉ sau khi tôi đã dựng xong.
