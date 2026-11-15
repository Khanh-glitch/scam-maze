// Vietnamese Chapter 1 narrative overlay: the official bank line, `dlg.official-line` (task 11.2).
// The agent is calm and factual. Case ID and the official number stay unchanged.
import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const OFFICIAL_VI: NarrativeOverlay = {
  "dialogues/dlg.official-line/persona/name": "Bộ phận chăm sóc khách hàng Northgate",
  "dialogues/dlg.official-line/persona/role": "Nhân viên trên đường dây chính thức của Northgate Bank",

  // Agent lines
  "dialogues/dlg.official-line/lines/line.official.greeting":
    "Xin chào, đây là bộ phận chăm sóc khách hàng của Northgate Bank. Quý khách đã gọi số được lưu trên sao kê. Hôm nay tôi có thể giúp gì cho quý khách?",
  "dialogues/dlg.official-line/lines/line.official.agent":
    "Vâng. Xin quý khách cho biết mã hồ sơ hoặc tin nhắn quý khách đã nhận. Tôi sẽ xem tài khoản của quý khách.",
  "dialogues/dlg.official-line/lines/line.official.confirm":
    "Tôi đã kiểm tra tài khoản của quý khách. Không có hồ sơ NG-4471-X. Chúng tôi không gửi thông báo nào về hồ sơ đó. Chúng tôi cũng không có quy trình khôi phục nào thực hiện qua điện thoại. Chúng tôi không bao giờ hỏi mã trong cuộc gọi.",
  "dialogues/dlg.official-line/lines/line.official.advice":
    "Nếu có người gọi và nói họ đến từ ngân hàng, xin quý khách kết thúc cuộc gọi. Sau đó, hãy gọi cho chúng tôi theo số được lưu trên sao kê, +000 0100 0800, hoặc dùng ứng dụng ngân hàng do chính quý khách cài đặt. Đừng bao giờ đọc mã cho người gọi. Điều này áp dụng cả khi người gọi biết mã hồ sơ của quý khách.",
  "dialogues/dlg.official-line/lines/line.official.report-basic":
    "Để báo cáo việc này, xin dùng kênh chính thức của ngân hàng, như số trên sao kê hoặc mục trợ giúp trong ứng dụng ngân hàng. Hãy cho họ biết thời gian của từng cuộc gọi, các số đã gọi, và những gì họ yêu cầu quý khách làm. Đừng trả lời người gọi hay thông báo đó.",

  // Player option lines
  "dialogues/dlg.official-line/lines/line.official.opt.ask-case":
    "Tôi muốn hỏi về một cuộc gọi và một thông báo tôi đã nhận.",
  "dialogues/dlg.official-line/lines/line.official.opt.give-case": "Mã hồ sơ là NG-4471-X. Hồ sơ này có thật không?",
  "dialogues/dlg.official-line/lines/line.official.opt.advice":
    "Tôi nên làm gì nếu có người gọi cho tôi như vậy lần nữa?",
  "dialogues/dlg.official-line/lines/line.official.opt.report-call": "Tôi báo cáo những cuộc gọi này như thế nào?",
  "dialogues/dlg.official-line/lines/line.official.opt.all-done": "Vậy là đủ rồi. Cảm ơn bạn.",
  "dialogues/dlg.official-line/lines/line.official.opt.hang-up": "Tôi cúp máy đây.",

  // End lines
  "dialogues/dlg.official-line/lines/line.official.end": "Bạn kết thúc cuộc gọi với Northgate.",
  "dialogues/dlg.official-line/lines/line.official.end.hung-up": "Bạn kết thúc cuộc gọi.",
};
