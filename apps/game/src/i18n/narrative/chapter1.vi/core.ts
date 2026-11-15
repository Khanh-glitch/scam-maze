// Vietnamese Chapter 1 narrative overlay, core part (spec chapter-01-double-deception, task 11.4).
// Keys: `title`, `subtitle`, `acts/*`, `objectives/*`, `interactables/*`, `claims/*`,
// `warningSigns/*`, `journalNotes/*`, `calls/*`, `prompts/*`. Missing keys fall back to English.
// These texts appear before the debrief, so they avoid the words "lừa đảo" and "giả".
// Identifiers, phone numbers and domains stay unchanged.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const CORE_VI: NarrativeOverlay = {
  title: "Cuộc gọi khẩn cấp",
  subtitle: "Chiến thắng ảo",

  "acts/act.1/title": "Cái bẫy lộ liễu",
  "acts/act.2/title": "Lựa chọn khiến bạn yên tâm",
  "acts/act.3/title": "Điều mâu thuẫn",
  "acts/act.4/title": "Giọng nói thứ ba",
  "acts/act.5/title": "Chiến thắng ảo",

  "objectives/obj.answer-or-decline/text": "Xử lý cuộc gọi đến.",
  "objectives/obj.answer-or-decline/hint": "Điện thoại đang nằm trên bàn. Bạn quyết định có nghe máy hay không.",
  "objectives/obj.check-laptop/text": "Xem tin nhắn mới trên máy tính xách tay.",
  "objectives/obj.check-laptop/hint": "Màn hình máy tính xách tay đã thay đổi sau cuộc gọi. Bạn cũng có thể nhìn quanh phòng.",
  "objectives/obj.investigate/text": "Tìm ra các tin nhắn và cuộc gọi thật sự đến từ đâu.",
  "objectives/obj.investigate/hint":
    "Hãy xem máy tính xách tay, các giấy tờ trên bàn và những thứ bạn vẫn giữ trong phòng. Có thể sẽ có thêm một cuộc gọi.",
  "objectives/obj.answer-recovery/text": "Xử lý cuộc gọi mới.",
  "objectives/obj.answer-recovery/hint": "Hãy nghe người gọi này nói gì, rồi so với những điều bạn đã tìm thấy.",
  "objectives/obj.decide/text": "Quyết định bạn sẽ làm gì với tài khoản của mình.",
  "objectives/obj.decide/hint": "Hãy nghĩ xem bạn đã tự liên hệ với nguồn nào, và nguồn nào đã tìm đến bạn.",
  "objectives/obj.review/text": "Xem lại những gì đã xảy ra.",

  "interactables/obj.note/label": "Mẩu ghi chú tự tay bạn viết",
  "interactables/obj.note/actionLabel": "đọc",
  "interactables/obj.note/inspectionText":
    "Một mẩu ghi chú bằng chữ của chính bạn, ghim gần bàn. Trên đó viết: “Ngân hàng của tôi liên lạc với tôi qua ứng dụng Northgate Mobile. Khi cần gọi, hãy dùng số in ở mặt sau thẻ và trên sao kê: +000 0100 0800. Tôi không bao giờ dùng số do người khác đưa.” Bạn viết nó sau khi một người bạn gặp chuyện không hay. Ghi chú không nói tin nhắn nào hôm nay là sai. Nó chỉ cho biết ngân hàng của bạn vẫn luôn liên lạc theo cách nào.",
  "interactables/obj.receipts/label": "Tờ sao kê ngân hàng gấp lại",
  "interactables/obj.receipts/actionLabel": "xem",
  "interactables/obj.receipts/inspectionText":
    "Một tờ sao kê giấy gấp lẫn trong đống hóa đơn của bạn. Ở cuối trang đầu, ngân hàng in số liên hệ của mình: +000 0100 0800. Tờ giấy này được in từ trước hôm nay. Nó cho bạn một số để đối chiếu với bất kỳ số nào đến với bạn lúc này.",
  "interactables/obj.calendar/label": "Cuốn lịch treo tường",
  "interactables/obj.calendar/actionLabel": "xem",
  "interactables/obj.calendar/inspectionText":
    "Cuốn lịch treo tường của bạn. Ngày có sao kê tiếp theo được đánh dấu gần cuối tháng. Không có ngày nào ghi cuộc hẹn với nhóm bảo mật của ngân hàng. Đây là một chi tiết nhỏ. Nó khớp với những gì bạn nhớ, nhưng một ô trống thì tự nó không chứng minh được điều gì.",

  "claims/claim.alex-identity/text": "Người gọi đầu tiên là Alex ở bộ phận an ninh của Northgate Bank.",
  "claims/claim.notification-genuine/text": "Thông báo trên máy tính xách tay đến từ ngân hàng của bạn.",
  "claims/claim.recovery-needed/text": "Tài khoản của bạn cần một quy trình khôi phục ngay lúc này.",
  "claims/claim.claims-independent/text": "Cuộc gọi và thông báo xác nhận cho nhau như hai nguồn riêng biệt.",

  "warningSigns/ws.unverified-sender/label": "Người gửi bạn chưa kiểm tra",
  "warningSigns/ws.unverified-sender/description":
    "Người gửi, địa chỉ hoặc ứng dụng này không phải thứ bạn đã thiết lập hay lưu từ trước hôm nay.",
  "warningSigns/ws.urgency/label": "Thúc ép phải hành động sớm",
  "warningSigns/ws.urgency/description":
    "Tin nhắn muốn bạn hành động sớm để bạn có ít thời gian hơn để suy nghĩ và kiểm tra.",
  "warningSigns/ws.caller-id-spoof/label": "Số hiển thị không hợp lý",
  "warningSigns/ws.caller-id-spoof/description":
    "Người gọi có thể tự đặt số hiện trên màn hình. Ở đây màn hình hiện số của chính bạn, điều mà không ngân hàng nào làm khi gọi.",
  "warningSigns/ws.self-supplied-contact/label": "Thông tin liên hệ do người gửi đưa",
  "warningSigns/ws.self-supplied-contact/description":
    "Tin nhắn tự đưa ra số để bạn gọi. Một số do người gửi đưa không cho biết người gửi là ai.",
  "warningSigns/ws.shared-case-id/label": "Cùng một mã hồ sơ ở nhiều liên hệ khác nhau",
  "warningSigns/ws.shared-case-id/description":
    "Hai liên hệ trông như riêng biệt lại dùng cùng một mã. Chúng có thể đến từ một nguồn, nên không xác nhận được cho nhau.",
  "warningSigns/ws.validates-your-doubt/label": "Đồng tình với nỗi nghi ngờ của bạn",
  "warningSigns/ws.validates-your-doubt/description":
    "Người gọi khen bạn cẩn thận, rồi yêu cầu bạn làm theo các bước của họ. Sự đồng tình không phải là bằng chứng.",
  "warningSigns/ws.code-request/label": "Yêu cầu đọc mã",
  "warningSigns/ws.code-request/description":
    "Bạn bị yêu cầu đọc ra một mã xác thực một lần đã gửi cho bạn. Mã đó chỉ dành cho riêng bạn.",
  "warningSigns/ws.move-funds/label": "Yêu cầu chuyển tiền",
  "warningSigns/ws.move-funds/description":
    "Bạn bị yêu cầu chuyển tiền đến một nơi bạn không tự chọn, với lý do để bảo vệ tiền.",
  "warningSigns/ws.discourages-verification/label": "Ngăn bạn kiểm tra",
  "warningSigns/ws.discourages-verification/description":
    "Người gọi nói rằng việc kiểm tra với ngân hàng là chậm, vô ích hoặc không được phép.",

  "journalNotes/note.own-number/text":
    "Màn hình hiện số của chính bạn. Chuyện này lạ, nhưng một chi tiết lạ chỉ là lý do để kiểm tra, chưa phải câu trả lời.",
  "journalNotes/note.same-case-reference/text":
    "Thông báo và người gọi đầu tiên dùng cùng một mã hồ sơ, và thông báo tự đưa ra số của riêng nó. Chúng có thể đến từ một nguồn. Hãy thử ghép các manh mối này lại.",
  "journalNotes/note.contact-differs-paper/text":
    "Số trong thông báo không phải số in trên sao kê của bạn. Hãy so sánh hai số, rồi nghĩ xem bạn đã tin số nào từ trước hôm nay.",
  "journalNotes/note.contact-differs-app/text":
    "Số trong thông báo không phải số đã lưu trong ứng dụng ngân hàng của bạn. Hồ sơ của chính bạn chỉ đến một số liên hệ khác.",
  "journalNotes/note.two-paths/text":
    "Sao kê giấy và ứng dụng ngân hàng cho cùng một số. Hai hồ sơ bạn giữ từ trước hôm nay khớp với nhau.",
  "journalNotes/note.third-call-origin/text":
    "Người gọi thứ ba dùng số mà thông báo đã đưa ra. Người gọi đầu tiên, thông báo và người gọi thứ ba có thể là một chuỗi.",
  "journalNotes/note.third-call-repeat/text":
    "Người gọi thứ ba lặp lại mã hồ sơ của hai liên hệ trước. Lặp lại một chi tiết không tạo thêm một người làm chứng mới.",
  "journalNotes/note.confirmed/text":
    "Đường dây ngân hàng bạn đã lưu từ trước hôm nay không có hồ sơ nào như vậy. Đây là xác nhận đến từ bên ngoài chuỗi.",

  "calls/call.alex/displayName": "Người gọi lạ",
  "calls/call.recovery/displayName": "Bộ phận Phản hồi Hồ sơ",
  "calls/call.official/displayName": "Northgate Bank (đã lưu)",

  "prompts/obj.note": "Đọc mẩu ghi chú của bạn",
  "prompts/obj.receipts": "Xem tờ sao kê ngân hàng gấp lại",
  "prompts/obj.calendar": "Xem cuốn lịch treo tường",
};
