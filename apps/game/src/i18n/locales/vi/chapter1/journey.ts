import type en from "../../en/chapter1/journey";
import type { LocaleShape } from "../../../types";

const journey: LocaleShape<typeof en> = {
  journey: {
    badge: "Bản đồ hành trình",
    back: "Về menu",
    intro:
      "Trang này được dựng từ dữ liệu chương lúc chạy. Nhiệm vụ, nhánh, bước, sự kiện theo giờ, lịch hẹn, tài nguyên và cờ trạng thái đều đọc từ đúng kịch bản mà trò chơi đang chạy, nên bản đồ không thể lệch khỏi bản dựng.",
    legend: {
      mission: "Nhiệm vụ chính",
      optional: "Lời mời tùy chọn",
      planned: "Đã dự kiến, chưa có dữ liệu",
      event: "Sự kiện theo giờ",
      appointment: "Lịch hẹn",
    },
    counts: {
      missions: "Nhiệm vụ",
      optional: "Tùy chọn",
      events: "Sự kiện theo giờ",
      planned: "Dự kiến",
      written: "Cờ đã ghi",
      reserved: "Cờ để dành",
    },
    sections: {
      timeline: "72 giờ",
      timelineBody:
        "Từ 17:00 thứ Ba đến 17:00 thứ Sáu. Mỗi thanh chạy từ lúc nhiệm vụ mở đến hạn của nó; chấm tròn là sự kiện theo giờ hoặc lịch hẹn.",
      now: "Người chơi làm được gì ngay bây giờ",
      nowBody:
        "Toàn bộ nhiệm vụ trong kịch bản. Mỗi thẻ liệt kê các nhánh theo thứ tự ưu tiên và những bước mà bảng nhiệm vụ hiển thị.",
      planned: "Để dành cho các nhiệm vụ sau",
      plannedBody:
        "Phần nền đã khai báo các cờ này và đã đặt sẵn dàn nhân vật, nhưng kịch bản chưa có dữ liệu nhiệm vụ cho chúng. Mốc giờ lấy từ các bài kiểm tra đồng hồ, dàn nhân vật lấy từ sổ đăng ký nhân vật.",
      cast: "Người chơi gặp ai",
      castBody:
        "Mười nhân vật của câu chuyện, số nhiệm vụ của họ, và việc họ đứng trong phố 3D hay chỉ liên lạc qua điện thoại.",
      devices: "Câu chuyện diễn ra ở đâu",
      devicesBody: "Số mục trên từng ứng dụng, các vật tương tác trong phòng, và nhiệm vụ khóa luận làm bản thảo tiến lên.",
      resources: "Trạng thái xuất phát",
      resourcesBody:
        "Các giá trị chương bắt đầu. Chỉ thời gian, tiến độ khóa luận và tiền mặt là do bản thiết kế nêu; phần còn lại là giá trị tạm có thể chỉnh.",
      flags: "Hệ quả",
      flagsBody: "Những cờ có nơi ghi lại ngay hôm nay, và những cờ mà các nhiệm vụ sau sẽ đọc.",
      code: "Mã nào phụ trách phần nào",
      codeBody: "Mọi đường dẫn dưới đây đều được test kiểm tra, nên bản đồ không thể trỏ tới tệp không tồn tại.",
    },
    labels: {
      opens: "Mở",
      deadline: "Hạn",
      noDeadline: "Không có hạn",
      optional: "Tùy chọn",
      path: "Nhánh",
      steps: "Các bước",
      objective: "Mục tiêu",
      onFail: "Nếu trượt",
      eventWhen: "Thời điểm",
      afterAction: "Sau một hành động",
      responses: "Cách trả lời",
      auto: "Tự kết thúc khi tới",
      urgent: "Ngắt cả phiên viết",
      start: "Bắt đầu",
      inStreet: "Trong phố",
      phoneOnly: "Chỉ qua điện thoại",
      cast: "Nhân vật",
      reads: "Đọc cờ",
      items: "Số mục",
      noSteps: "Không có bước: đây là một lựa chọn, không phải danh sách việc.",
      minutes: "{{value}} phút",
      gain: "+{{value}}%",
      thesisLabel: "Nhiệm vụ khóa luận",
      timeLeft: "Thời gian còn lại",
      thesis: "Khóa luận",
      evidence: "Bằng chứng",
      hours: "{{value}} giờ",
      interactables: "Vật tương tác",
      plannedTitle: {
        m3: "TIỀN VÀ CHỖ Ở",
        m4: "MỘT NGƯỜI QUEN QUA MẠNG",
        m5: "LỜI MỜI CỨU HỘ",
      },
      plannedNote: {
        m3: "Tiền mất vào việc online hoặc đầu tư, nợ và tiền đặt cọc nhà trọ: các cờ đã có, nhiệm vụ thì chưa.",
        m4: "Maya được đăng ký là người quen qua mạng cho nhiệm vụ này. Chưa có mục, sự kiện hay bước nào.",
        m5: "Một lời mời cứu hộ có thể nhắc tới khoản đã mất, ba giờ trước hạn nộp, với Phòng Đào tạo là kênh chính thức.",
      },
    },
  },
};

export default journey;
