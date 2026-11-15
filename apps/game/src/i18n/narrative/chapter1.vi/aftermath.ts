// Vietnamese Chapter 1 narrative overlay: ending narration, `dlg.aftermath` (task 11.2).
// Calm narrator, no blame, no fear as the main motivator. The case ID stays unchanged.
import type { NarrativeOverlay } from "../../../game/narrative/localize";

export const AFTERMATH_VI: NarrativeOverlay = {
  "dialogues/dlg.aftermath/persona/name": "Người dẫn chuyện",
  "dialogues/dlg.aftermath/persona/role": "Kể lại điều đã xảy ra sau quyết định cuối cùng",

  // Ending A: false-victory
  "dialogues/dlg.aftermath/lines/line.after.a.1":
    "Các bước khôi phục đã xong. Màn hình yên lặng, và mã hồ sơ NG-4471-X hiện là đã đóng. Bạn ngả người ra sau. Việc từ chối Alex có vẻ là quyết định đúng, và nhóm theo dõi cũng xác nhận điều đó.",
  "dialogues/dlg.aftermath/lines/line.after.a.2":
    "Rồi một câu hỏi cứ ở lại trong đầu bạn. Ai đã nói rằng lựa chọn đó là đúng? Đó là giọng nói thứ hai, người gọi về cùng hồ sơ. Người đó đồng ý với bạn đúng lúc bạn muốn nghe điều ấy nhất.",
  "dialogues/dlg.aftermath/lines/line.after.a.3":
    "Từ chối một người gọi không làm kế hoạch dừng lại. Lớp thứ hai có hiệu quả vì nó nghe như sự nhẹ nhõm. Một giọng nói khen bạn cẩn thận vẫn cần được kiểm tra qua một kênh do chính bạn chọn.",

  // Ending B: perfect-chain
  "dialogues/dlg.aftermath/lines/line.after.b.1":
    "Cuộc gọi đầu tiên lấy mã. Cuộc gọi thứ hai lấy các bước tiếp theo. Mỗi cuộc gọi nghe hợp lý vì cuộc gọi kia đã xảy ra trước.",
  "dialogues/dlg.aftermath/lines/line.after.b.2":
    "Nhìn lại, thông báo, nhóm theo dõi và mã hồ sơ NG-4471-X đều chỉ cùng một hướng. Chúng giống ba lời xác nhận riêng biệt, nhưng đều đến từ một nguồn.",
  "dialogues/dlg.aftermath/lines/line.after.b.3":
    "Kế hoạch hai phần được dựng như vậy: phần đầu tạo ra vấn đề, phần hai đưa ra cách giải quyết. Dừng lại sau một trong hai cuộc gọi, rồi kiểm tra bằng một số bạn đã tin tưởng từ trước, có thể đã cắt đứt chuỗi này.",

  // Ending C: break-the-chain
  "dialogues/dlg.aftermath/lines/line.after.c.1":
    "Bạn không dùng số trên màn hình. Bạn gọi liên hệ đã được lưu sẵn trong ứng dụng ngân hàng, và người ở đó không biết gì về hồ sơ NG-4471-X.",
  "dialogues/dlg.aftermath/lines/line.after.c.2":
    "Không có quy trình khôi phục qua điện thoại, không có thông báo từ họ, không có nhóm theo dõi. Đường dây chính thức cho bạn câu trả lời rõ ràng, và tài khoản vẫn như bạn đã để lại.",
  "dialogues/dlg.aftermath/lines/line.after.c.3":
    "Bạn chọn kênh đáng tin trước kênh đang gây áp lực. Chính bước đó tách những cuộc gọi tìm đến bạn khỏi những sự thật bạn tự kiểm tra.",
  "dialogues/dlg.aftermath/lines/line.after.c.secret.1":
    "Còn một điều nữa. Bạn đã đặt các mảnh ghép cạnh nhau. Alex và nhóm theo dõi dùng cùng một mã hồ sơ. Thông báo cũng mang cùng mã tham chiếu đó. Ba giọng nói cùng chỉ về một nguồn.",
  "dialogues/dlg.aftermath/lines/line.after.c.secret.2":
    "Báo cáo hồ sơ của bạn nói rõ: các lời khẳng định này không độc lập, và ngân hàng không xác nhận lời nào. Một người gọi đồng ý với một người gọi khác không phải là bằng chứng. Bạn đã ghi lại điều đó, và báo cáo đã sẵn sàng để chia sẻ.",

  // Ending D: unfinished-case
  "dialogues/dlg.aftermath/lines/line.after.d.1":
    "Bạn từ chối các cuộc gọi và để hồ sơ nằm nguyên chỗ cũ. Không có mã nào rời khỏi tay bạn, và bạn không làm theo bước nào.",
  "dialogues/dlg.aftermath/lines/line.after.d.2":
    "Một số điều vẫn còn bỏ ngỏ. Bạn chưa biết vì sao thông báo xuất hiện, hay ai đứng sau hồ sơ NG-4471-X. Không biết là điều được phép. Dừng lại là một lựa chọn hợp lệ, không phải thất bại.",
  "dialogues/dlg.aftermath/lines/line.after.d.3":
    "Khi bạn sẵn sàng, cách tiếp theo rất đơn giản: dùng số đã lưu trong ứng dụng ngân hàng và hỏi thẳng họ. Những câu hỏi vẫn ở đó, và bạn có thể trả lời theo nhịp của mình.",
};
