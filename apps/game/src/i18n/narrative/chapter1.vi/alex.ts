// Vietnamese Chapter 1 narrative overlay: the first call, `dlg.alex` (task 11.2).
// Keys: `dialogues/dlg.alex/persona/<field>` and `dialogues/dlg.alex/lines/<lineId>`.
// Alex sounds plausible and pushy. The case ID stays unchanged.
import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const ALEX_VI: NarrativeOverlay = {
  "dialogues/dlg.alex/persona/name": "Alex",
  "dialogues/dlg.alex/persona/role": "Tự nhận là nhân viên xử lý hồ sơ tại Bộ phận An ninh Northgate",

  // Caller lines
  "dialogues/dlg.alex/lines/line.alex.open":
    "Xin chào, tôi là Alex ở Bộ phận An ninh Northgate. Chúng tôi phát hiện hoạt động bất thường liên quan đến tài khoản của anh/chị. Tôi đang nói chuyện với chủ tài khoản phải không?",
  "dialogues/dlg.alex/lines/line.alex.who":
    "Tôi là Alex, nhân viên xử lý hồ sơ. Mã hồ sơ của anh/chị là NG-4471-X. Tôi có thể giúp anh/chị việc này. Nhưng tôi cần vài thông tin để tiếp tục.",
  "dialogues/dlg.alex/lines/line.alex.defend":
    "Tôi hiểu vì sao anh/chị cẩn thận. Số trên màn hình của anh/chị là đường dây riêng cho hồ sơ đặc biệt. Đó không phải số in trên thẻ. Với hồ sơ an ninh, điều này là bình thường.",
  "dialogues/dlg.alex/lines/line.alex.details":
    "Tôi không thể nói hết chi tiết trên đường dây mở. Tiền có thể sớm rời khỏi tài khoản của anh/chị. Nếu chúng ta cùng xử lý hồ sơ NG-4471-X, chúng ta có thể chặn được.",
  "dialogues/dlg.alex/lines/line.alex.callback":
    "Xin đừng gọi lại. Tổng đài chính không xem được hồ sơ này, và phải chờ rất lâu. Anh/chị cứ ở lại với tôi. Tôi là người duy nhất giúp được việc này.",
  "dialogues/dlg.alex/lines/line.alex.proof":
    "Tất nhiên rồi. Mã hồ sơ là NG-4471-X. Anh/chị cũng sẽ nhận được một thông báo trên máy tính xách tay về hồ sơ này. Sau cuộc gọi, một nhóm theo dõi sẽ liên lạc để hoàn tất thủ tục.",
  "dialogues/dlg.alex/lines/line.alex.pressure":
    "Để bảo vệ tài khoản, tôi cần mã xác minh vừa gửi đến điện thoại của anh/chị. Xin đọc mã đó cho tôi. Đừng kể cuộc gọi này với ai khác. Họ không có quyền xem hồ sơ.",
  "dialogues/dlg.alex/lines/line.alex.refused":
    "Đó là một sai lầm. Không có mã thì tôi không thể đóng hồ sơ NG-4471-X. Một thông báo sẽ đến máy tính xách tay của anh/chị, và nhóm theo dõi sẽ gọi. Xin hãy làm việc với họ, đừng gọi tổng đài chính.",
  "dialogues/dlg.alex/lines/line.alex.code-taken":
    "Cảm ơn anh/chị. Như vậy là tốt. Nhóm theo dõi sẽ liên lạc để hướng dẫn các bước tiếp theo. Đến lúc đó, xin đừng nói chuyện này với ai.",

  // Player option lines
  "dialogues/dlg.alex/lines/line.alex.opt.ask-who": "Anh là ai, và tại sao anh gọi cho tôi?",
  "dialogues/dlg.alex/lines/line.alex.opt.challenge-number": "Đây không phải số in trên thẻ của tôi.",
  "dialogues/dlg.alex/lines/line.alex.opt.ask-details": "Tài khoản của tôi gặp vấn đề gì?",
  "dialogues/dlg.alex/lines/line.alex.opt.hang-up": "Tôi cúp máy đây.",
  "dialogues/dlg.alex/lines/line.alex.opt.ask-details-next": "Anh nói rõ hơn về vấn đề đó đi.",
  "dialogues/dlg.alex/lines/line.alex.opt.keep-challenging": "Tôi vẫn không tin số này.",
  "dialogues/dlg.alex/lines/line.alex.opt.accept": "Được rồi. Anh cần gì ở tôi?",
  "dialogues/dlg.alex/lines/line.alex.opt.ask-proof": "Làm sao tôi biết anh thật sự là người của ngân hàng?",
  "dialogues/dlg.alex/lines/line.alex.opt.call-back": "Tôi sẽ tự gọi lại cho ngân hàng.",
  "dialogues/dlg.alex/lines/line.alex.opt.go-on": "Anh nói tiếp đi.",
  "dialogues/dlg.alex/lines/line.alex.opt.then-what": "Vậy anh cần gì?",
  "dialogues/dlg.alex/lines/line.alex.opt.continue": "Tôi hiểu. Anh cứ tiếp tục.",
  "dialogues/dlg.alex/lines/line.alex.opt.share-code": "Đọc mã cho người gọi.",
  "dialogues/dlg.alex/lines/line.alex.opt.refuse-code": "Không. Tôi sẽ không đọc mã cho anh.",
  "dialogues/dlg.alex/lines/line.alex.opt.check-myself": "Tôi sẽ tự kiểm tra, bằng một số mà tôi tin tưởng.",

  // End lines
  "dialogues/dlg.alex/lines/line.alex.end.hung-up": "Bạn kết thúc cuộc gọi.",
  "dialogues/dlg.alex/lines/line.alex.end.check": "Bạn kết thúc cuộc gọi để tự kiểm tra thông tin đó.",
};
