import type en from "../../en/chapter1/debriefForensic";
import type { LocaleShape } from "../../../types";
const debriefForensic: LocaleShape<typeof en> = {
  debriefForensic: {
    heading: "Xem lại vụ việc",
    timeline: {
      heading: "Chuyện gì đã xảy ra, theo thứ tự",
      empty: "Không có sự kiện nào được ghi lại.",
      row: "{{number}}. {{text}}",
      kind: {
        call: "Cuộc gọi",
        device: "Máy tính xách tay hoặc điện thoại",
        evidence: "Bằng chứng",
        deduction: "Mối liên hệ",
        decision: "Quyết định",
        verification: "Kiểm tra",
      },
    },
    analysis: {
      heading: "Phân tích",
      pressure: "Áp lực tăng dần như thế nào",
      trust: "Vì sao lời cảnh báo trông đáng tin",
      unverified: "Những dấu hiệu chưa bao giờ được kiểm tra",
      thirdCaller: "Người gọi thứ ba",
      thirdCallerIndependent: "Người gọi thứ ba không liên quan đến hai nguồn đầu tiên.",
      thirdCallerNotIndependent: "Người gọi thứ ba có cùng nguồn gốc với hai nguồn đầu tiên.",
      trap: "Cái bẫy bạn đã rơi vào",
      trapNone: "Bạn đã không rơi vào cái bẫy.",
      verifyNext: "Lần sau cần kiểm tra điều gì",
      pressureLevel: "Áp lực đạt mức {{number}} trên 3",
    },
    cluesMissed: {
      heading: "Những manh mối bạn chưa tìm thấy",
      none: "Bạn đã tìm thấy mọi manh mối.",
      missedLabel: "Đã bỏ lỡ",
      summary_one: "Xem {{number}} manh mối đã bỏ lỡ",
      summary_other: "Xem {{number}} manh mối đã bỏ lỡ",
    },
    habit: {
      heading: "Thói quen nên giữ",
      line: "Chỉ nên tin một lời cảnh báo khi nó đến qua một kênh mà bạn đã biết từ trước khi họ liên lạc với bạn.",
    },
    evidence: {
      heading: "Bằng chứng của bạn",
      count_one: "{{number}} bằng chứng",
      count_other: "{{number}} bằng chứng",
    },
    caseReport: {
      heading: "Báo cáo vụ việc",
    },
    ending: {
      phone: "Trên điện thoại của bạn",
      laptop: "Trên máy tính xách tay của bạn",
      evidence: "Những gì bạn có trong tay",
      narration: "Lời dẫn",
      next: "Câu tiếp theo",
    },
    simulation: "Mọi thứ trong chương này đều là mô phỏng.",
    continue: "Tiếp tục",
  },
};
export default debriefForensic;
