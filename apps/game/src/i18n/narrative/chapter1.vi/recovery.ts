// Vietnamese Chapter 1 narrative overlay, third caller part (`dlg.recovery`, Morgan).
// Keys: `dialogues/dlg.recovery/persona/<field>` and `dialogues/dlg.recovery/lines/<lineId>`.
// Player option labels are lines too, so they use the same key format.
// Tone: incident-response desk, calm, reassuring, professional, gently pressing.
// Identifiers (case reference and phone number) stay unchanged. Missing keys fall back to English.

import type { NarrativeOverlay } from "../../../game/narrative/localize";

const P = "dialogues/dlg.recovery";

export const RECOVERY_VI: NarrativeOverlay = {
  [`${P}/persona/name`]: "Morgan",
  [`${P}/persona/role`]: "Tự nhận là nhân viên bộ phận ứng phó sự cố của Northgate",

  // Start lines: one per situation, each reads differently.
  [`${P}/lines/line.rec.start.verified`]:
    "Tôi là Morgan, bộ phận ứng phó sự cố. Tôi biết anh/chị đã nói chuyện với đường dây của ngân hàng. Đường dây đó chỉ thấy các tài khoản thông thường. Họ không thấy được hồ sơ sự cố, nên họ không thể cho anh/chị biết về hồ sơ của chúng tôi.",
  [`${P}/lines/line.rec.start.confronted`]:
    "Tôi là Morgan, bộ phận ứng phó sự cố. Có lẽ anh/chị đang thắc mắc vì sao mọi tin nhắn đều mang cùng một mã hồ sơ. Chúng tôi dùng chung mã đó có chủ ý, để các nhóm đều liên hệ được với anh/chị về cùng một hồ sơ.",
  [`${P}/lines/line.rec.start.inspected`]:
    "Tôi là Morgan, bộ phận ứng phó sự cố. Tôi thấy anh/chị đã xem kỹ thông báo. Như vậy là rất cẩn thận. Cũng chính vì vậy, tài khoản của anh/chị cần một quy trình khắc phục.",
  [`${P}/lines/line.rec.start.followed`]:
    "Tôi là Morgan, bộ phận ứng phó sự cố. Tôi thấy anh/chị đã mở mục Xem lại bảo mật. Tốt lắm. Hồ sơ của anh/chị đang chờ bên chúng tôi, và tôi sẽ giúp anh/chị hoàn tất.",
  [`${P}/lines/line.rec.start.blank`]:
    "Xin chào, tôi là Morgan, bộ phận ứng phó sự cố. Có thể anh/chị chưa kịp xem cảnh báo. Tôi gọi để hỗ trợ anh/chị xử lý một vấn đề trên tài khoản.",

  // Shared body
  [`${P}/lines/line.rec.cites-case`]:
    "Hồ sơ của anh/chị là NG-4471-X. Hồ sơ này liên quan đến cuộc gọi mà anh/chị đã từ chối lúc trước.",
  [`${P}/lines/line.rec.confirms-alex`]:
    "Người gọi đó đáng ngờ. Anh/chị đã làm đúng khi không tin ông ta. Nhóm chúng tôi được báo vì cuộc gọi đó, và bây giờ chúng ta cần bảo vệ tài khoản.",
  [`${P}/lines/line.rec.procedure`]:
    "Quy trình khắc phục khá đơn giản. Anh/chị cho phép một phiên hỗ trợ từ xa để tôi kiểm tra thiết bị. Sau đó, số dư sẽ được chuyển sang một tài khoản tạm giữ trong lúc chúng tôi xử lý hồ sơ. Tôi sẽ hướng dẫn từng bước.",
  [`${P}/lines/line.rec.pressure`]:
    "Hồ sơ sẽ còn mở cho đến khi hoàn tất quy trình, và hồ sơ còn mở thì tài khoản của anh/chị vẫn bị lộ. Xin anh/chị giữ chuyện này giữa chúng ta. Những người khác chưa được phép xem hồ sơ. Chúng ta bắt đầu nhé?",
  [`${P}/lines/line.rec.trusted`]:
    "Cảm ơn anh/chị. Anh/chị đã chọn rất cẩn thận. Tôi sẽ chuẩn bị quy trình ngay. Anh/chị cứ giữ máy và làm theo từng bước của tôi.",

  // Deflections
  [`${P}/lines/line.rec.deflects-verify`]:
    "Anh/chị muốn kiểm tra là điều dễ hiểu. Nhưng đường dây chính không thấy được hồ sơ sự cố, và việc đó có thể làm sai lệch hồ sơ. Tốt hơn hết là làm việc với tôi, nhóm đang phụ trách hồ sơ.",
  [`${P}/lines/line.rec.deflect-case`]:
    "Đúng, mã hồ sơ giống nhau. Chúng tôi dùng mã đó để gắn các tin nhắn vào cùng một hồ sơ, để anh/chị luôn được liên hệ. Điều đó không có nghĩa là các tin nhắn đến từ cùng một nơi.",
  [`${P}/lines/line.rec.deflect-number`]:
    "Số +000 0100 7771 là đường dây xử lý sự cố. Số này không có trên sao kê vì sao kê chỉ ghi đường dây chính. Với một hồ sơ như thế này, điều đó là bình thường.",

  // Player option labels
  [`${P}/lines/line.rec.opt.go-on`]: "Tôi đang nghe.",
  [`${P}/lines/line.rec.opt.hang-up`]: "Tôi cúp máy đây.",
  [`${P}/lines/line.rec.opt.what-needed`]: "Anh cần tôi làm gì?",
  [`${P}/lines/line.rec.opt.continue`]: "Anh cứ nói tiếp.",
  [`${P}/lines/line.rec.opt.ask-verify`]: "Tôi muốn xác minh với ngân hàng trước.",
  [`${P}/lines/line.rec.opt.challenge-case`]: "Alex và anh đều đưa ra cùng một mã hồ sơ. Vì sao vậy?",
  [`${P}/lines/line.rec.opt.challenge-number`]: "Số này không có trên sao kê hay trong danh bạ của tôi.",
  [`${P}/lines/line.rec.opt.trust`]: "Được rồi. Tôi sẽ làm theo quy trình của anh.",
  [`${P}/lines/line.rec.opt.still-doubt`]: "Tôi vẫn còn nghi ngờ.",
  [`${P}/lines/line.rec.opt.check-myself`]: "Tôi sẽ tự kiểm tra, bằng một số điện thoại mà tôi tin cậy.",

  // End lines (system text)
  [`${P}/lines/line.rec.end.hung-up`]: "Bạn kết thúc cuộc gọi.",
  [`${P}/lines/line.rec.end.check`]: "Bạn kết thúc cuộc gọi để tự kiểm tra thông tin.",
};
