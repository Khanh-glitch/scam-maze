# Lộ trình: từ hẻm trọ 462/14 ra đường lớn tới Chợ Lớn

Mọi con số dưới đây lấy từ toạ độ trong code, không phải ước lượng.

## Điểm xuất phát

Phòng 6.07, tầng 2, **KHU TRỌ 462/14 LÝ THÁI TỔ**.

- `ROOM_ANCHOR = (22.0, 3.2, −16.8)` — `boardingHouse.ts:34`
- Cổng sắt khu trọ ở `x = 13.25`, `z ∈ [−12.5, −10.0]`
- Sân trong ở `y = 0.16` (cao độ vỉa hè)

## Đường lớn

**Lý Thái Tổ** chạy bắc–nam, `z ∈ [−195, 99]`, dài khoảng 294 m.

- Lòng xe: `x −12.56 .. −0.24` (rộng **12.32 m** — đo từ toạ độ, không phải `WIDTH = 12.8`)
- Mép vỉa hè phía đông: `x = −1.54` (`ROUTE.curbX`)
- Nhà phía tây xây tới `x = −18.00`

## Chợ Lớn

Toạ độ: `x −25.78 .. −19.06`, `z −104 .. −152` (dài 48 m).

Điểm vào chợ có hai lối:
- **Đường nhỏ trước chợ** ở `LANE_X = −27.8`, chạy dọc hết chiều dài chợ
- **Hẻm dịch vụ** ở `ALLEY_Z = −132`, rộng 3.1 m, cắt ngang khối chợ

## Lộ trình

| Bước | Hành động | Khoảng cách |
|---|---|---|
| 1 | Xuống tầng 2, qua sân trong, ra cổng sắt 462/14 | ~12 m trong khu trọ |
| 2 | Ra hẻm **462/14**, đi về hướng tây ra Lý Thái Tổ | **~14.8 m** |
| 3 | Ra tới vỉa hè Lý Thái Tổ, rẽ **trái (về phía nam)** | — |
| 4 | Đi dọc vỉa hè phía đông Lý Thái Tổ | **~93 m** |
| 5 | Tới `z ≈ −104` là đầu chợ, băng qua đường | **~12.32 m** |
| 6 | Vào chợ qua đường nhỏ trước chợ | — |

**Tổng: khoảng 120 m, 3–4 phút đi bộ.**

## Chi tiết người Sài Gòn thật sẽ làm

1. **Không băng qua đường ở chỗ không có vạch.** Từ hẻm ra, đi bộ tới ngã tư/vạch kẻ gần nhất.
2. **Xe buýt 06** chạy trên Lý Thái Tổ — nếu đi xa thì bắt nó. Trạm ở `route.x/route.z`.
3. Chiều nam (bước 3–4) là **cùng chiều xe chạy**, nên vỉa hè phía đông là bên thuận.
4. Vào chợ thì phải **băng qua lòng đường 12.32 m** — ở Sài Gòn việc này người ta làm bằng cách đi chậm và giơ tay, xe máy sẽ vòng.

## Kiểm chứng bằng code

Xem `choLon.route.test.ts` — nó đo lại toàn bộ các con số trên từ hình học thật
của `buildChoLon` và `buildStreet`. Nếu ai đổi toạ độ chợ hay hẻm, test sẽ đỏ.
