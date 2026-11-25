# Nghiên cứu ngoài repo: nhà ống Sài Gòn & Chợ Lớn

Vòng trước tôi chỉ đọc repo của mình — đó là tự kiểm tra, không phải nghiên cứu.
Tài liệu này là các nguồn **bên ngoài**, và cái chúng đòi hỏi phải sửa.

## 1. Nhà ống (tube house) — số đo thật

| Nguồn | Bề ngang | Chiều sâu | Tầng |
|---|---|---|---|
| Kien 2008, *Tube House & Neo Tube House in Hanoi* | 2.5–3 m (nhà cổ), **4 m** (nhà mới) | 35 m (cổ), **20 m** (mới) | 1–2 (cổ), **3–5** (mới) |
| *Towards a sustainable plan for new tube houses* | 2–4 m | **20–60 m** | 2 (cổ) |
| i Tour Vietnam | 2.5–5 m | **5–8× bề ngang** | tới 4 |
| Kim Ban Jang Interior (2026) | 3.5–6 m | 12–20 m | 4–7 |

**Điểm hội tụ:** bề ngang 3–5 m; **chiều sâu 15–40 m**, tức 5–8 lần bề ngang; nhà mới 3–5 tầng.
Đặc điểm bắt buộc khác: **giếng trời / sân trong** (lấy sáng và thông gió — nhà ống chỉ có một mặt
tiền), tường gạch 110–200 mm trát vữa, khung bê tông.

Lý do lịch sử: thuế tính theo **bề ngang mặt tiền**, nên dân chia nhỏ mặt tiền và làm sâu vào trong.

## 2. Chợ Bình Tây (Chợ Lớn) — số đo thật

- Diện tích sàn ~2.5 ha; mặt tiền **108.6 m**; tháp đồng hồ **13.1 m**; xây 1928–1930.
- **~1 446 sạp** (698 tầng trệt, 748 tầng trên).
- Bố cục chữ U quanh **sân trong**; mái ngói đỏ; tường vàng; cột đá; đền thờ Quách Đàm ở giữa.
- Khu ăn uống ở **phía sau chợ**, "**seating on low stools and counters**".
- **90%+ sạp lớn nhận QR** để trả tiền.

## 3. Đối chiếu với `choLon.ts`

Chúng ta xây: `BAY = 3.05 m` (✅ đúng ngang nhà ống), `DEPTH = 5.6 m` (❌), `wallH = 7.6 m`,
tường sau là **một khối hộp 0.92 m × 7.6 m × 48 m**.

| Hạng mục | Chúng ta | Nghiên cứu | |
|---|---|---|---|
| Bề ngang bay | 3.05 m | 2.5–5 m | ✅ |
| Chiều sâu | **5.6 m** | **15–40 m** | ❌ nông hơn 3× |
| Chiều cao | 7.6 m = **2 tầng** | nhà mới 3–5 tầng | ⚠️ |
| Giếng trời | **không có** | bắt buộc | ❌ |
| Dãy nhà | **1 khối liền** | từng nhà ống riêng, khác nhau | ❌ |
| Mặt tiền | 1 khối phẳng | `createRealSaigonShophousePBR` + `addVietnameseShophouseRelief` có sẵn | ❌ chưa dùng |
| Ghế đẩu thấp | ✅ (vừa sửa) | "low stools" | ✅ |
| Trả tiền QR | ? | 90%+ | chưa kiểm |
| Sân trong chợ | ? | chữ U quanh sân | chưa kiểm |

## 4. Kết luận

Bức tường sau chợ là **một cái hộp 48 mét**. Nó không phải nhà ống: nhà ống là
**từng căn riêng, sâu 15–40 m, 3–5 tầng, có giếng trời, mỗi căn một khác**.

Repo đã có sẵn hai hàm dựng đúng thứ đó (`createRealSaigonShophousePBR`,
`addVietnameseShophouseRelief` — plinth, parapet, mái hiên di động, ban công, cục nóng máy lạnh),
và `choLon.ts` **không dùng cái nào**. Đây chính là "khối hộp" còn sót lại.
