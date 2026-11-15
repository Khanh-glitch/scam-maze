// Vietnamese Chapter 1 narrative overlay, phone part (spec chapter-01-double-deception, task 11.4).
// Keys: `phone/messages/*`, `phone/contacts/*` and `phone/bankApp/*`. Phone numbers, the case ID and
// the reserved domain stay unchanged. Contact keys use the phone number.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const PHONE_VI: NarrativeOverlay = {
  "phone/messages/msg.alex-voicemail/from": "Thư thoại từ người gọi lạ",
  "phone/messages/msg.alex-voicemail/body":
    "Nội dung thư thoại: “Xin chào, tôi là Alex ở bộ phận an ninh của Northgate Bank. Hồ sơ của anh/chị là NG-4471-X. Có người đã thử dùng tài khoản của anh/chị. Xin gọi lại cho tôi sớm theo số +000 0100 2200. Chúng tôi sẽ gửi cho anh/chị một mã để xác nhận đúng là anh/chị. Xin đừng bỏ qua tin nhắn này.”",
  "phone/messages/msg.alex-summary/from": "Tóm tắt cuộc gọi",
  "phone/messages/msg.alex-summary/body":
    "Tóm tắt cuộc gọi, do điện thoại của bạn ghi lại. Người gọi nói tên là Alex, ở bộ phận an ninh của Northgate Bank. Người gọi đưa mã hồ sơ NG-4471-X. Người gọi yêu cầu một mã gửi đến điện thoại của bạn. Người gọi nói một nhóm xử lý sự cố sẽ gọi cho bạn sau.",

  "phone/contacts/+000 0100 0800/name": "Northgate Bank (đã lưu)",

  "phone/bankApp/title": "Northgate Mobile",
  "phone/bankApp/screens/home/title": "Trang chủ",
  "phone/bankApp/screens/home/body":
    "Chào mừng bạn trở lại.\nTài khoản thanh toán: số dư hiển thị ở trang tài khoản.\nMở mục Hoạt động để xem các khoản thanh toán gần đây.\nMở mục Liên hệ để xem ngân hàng liên lạc với bạn bằng cách nào.",
  "phone/bankApp/screens/activity/title": "Hoạt động",
  "phone/bankApp/screens/activity/body":
    "Hoạt động gần đây\nCửa hàng tạp hóa: 18.40\nThẻ đi lại: 30.00\nĐăng ký nghe nhạc: 9.99\nKhông có khoản thanh toán nào bị đánh dấu. Không có thông báo bảo mật nào đang mở trên tài khoản này.",
  "phone/bankApp/screens/contacts/title": "Liên hệ",
  "phone/bankApp/screens/contacts/body":
    "Liên hệ với chúng tôi\nĐường dây khách hàng: +000 0100 0800\nTrang web: northgate-bank.example\nNgân hàng cho biết sẽ không bao giờ yêu cầu bạn đọc mã xác thực một lần hay chuyển tiền sang tài khoản khác.",
  "phone/bankApp/screens/messages/title": "Tin nhắn",
  "phone/bankApp/screens/messages/body": "Bạn không có tin nhắn bảo mật nào.",
};
