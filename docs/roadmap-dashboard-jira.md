# Kế hoạch nâng cấp dashboard theo hướng Jira

**Trạng thái:** Kế hoạch đề xuất  
**Cập nhật:** 09/11/2026  
**Phạm vi:** Dashboard tổng hợp công việc qua các workspace và project của Plane

## 1. Mục tiêu

Phát triển dashboard tổng từ một trang tổng quan cố định thành nơi mỗi vai trò có thể theo dõi, lọc, lưu và chia sẻ góc nhìn công việc phù hợp. Tập trung vào các nghiệp vụ quản lý CNTT: quá hạn, việc chờ xử lý, tải theo người phụ trách, tiến độ dự án và xu hướng hoàn thành.

Jira tạo dashboard từ nhiều gadget có thể thêm, cấu hình, sắp xếp và bố trí theo cột. Các gadget có thể hiển thị danh sách đã lọc, phân bổ trạng thái/ưu tiên/người phụ trách, tuổi tồn đọng, thời gian xử lý và tiến độ sprint. Dashboard có thể có nhiều bản, chia sẻ và mở ở chế độ wallboard. [Gadget Jira](https://support.atlassian.com/jira-cloud-administration/docs/use-dashboard-gadgets/) · [Tạo và sửa dashboard](https://support.atlassian.com/jira-software-cloud/docs/create-and-edit-dashboards/) · [Báo cáo Jira](https://support.atlassian.com/jira-software-cloud/docs/generate-a-report/) · [Wallboard](https://support.atlassian.com/jira-software-cloud/docs/set-up-a-wallboard/)

## 2. Hiện trạng Plane

Dashboard tổng hiện có:

- Tổng hợp issue người dùng được phép xem qua nhiều workspace/project.
- Bộ lọc workspace, project, trạng thái, người phụ trách, ưu tiên, hạn và công việc con.
- Bộ lọc được giữ trong URL; URL có thể gửi cho người khác.
- KPI tổng quan, breakdown theo trạng thái/dự án/người phụ trách, bảng công việc và phân trang.
- API xác thực quyền xem ở server; dashboard chia sẻ không được mở rộng quyền xem issue.

Tham chiếu triển khai: [giao diện dashboard](../apps/web/components/personal-dashboard/root.tsx), [các khối tổng quan](../apps/web/components/personal-dashboard/overview.tsx), [API dashboard](../apps/api/plane/app/views/user/issues.py).

Các phần còn thiếu so với mô hình dashboard Jira: lưu nhiều dashboard, lưu bộ lọc có tên, widget có thể thêm/cấu hình/sắp xếp, chọn cột cho bảng, biểu đồ xu hướng và phân quyền chia sẻ dashboard.

## 3. Nguyên tắc thiết kế

1. **Một bộ lọc dùng lại được:** saved filter là nguồn dữ liệu dùng chung cho bảng và biểu đồ; widget có thể kế thừa hoặc ghi đè một phần bộ lọc.
2. **Drill-down được:** bấm vào số liệu hoặc vùng biểu đồ sẽ mở danh sách issue tương ứng, giữ nguyên điều kiện lọc.
3. **Server luôn kiểm tra quyền:** mọi API lọc dữ liệu theo quyền hiện tại của người xem. Chia sẻ dashboard chỉ chia sẻ cấu hình, không cấp thêm quyền truy cập issue.
4. **Có metric definition:** định nghĩa rõ “quá hạn”, “đang mở”, “tuổi tồn”, “thời gian xử lý” và cách tính issue đã hủy để tránh số liệu khác nhau giữa widget.
5. **Tăng dần độ phức tạp:** trước tiên làm saved views và bảng; sau đó mới mở hệ thống widget, trend và chia sẻ nhóm.
6. **Cập nhật có giới hạn:** widget tự làm mới theo chu kỳ cấu hình, có nút làm mới thủ công và hiển thị thời điểm cập nhật cuối.

## 4. Roadmap triển khai

### Giai đoạn 1 — Saved views và bảng công việc nâng cao

**Ưu tiên:** P0 · **Độ lớn:** M

Cho phép lưu bộ lọc dashboard hiện tại thành view có tên, ví dụ “Quá hạn CNTT”, “Chờ đối tác” hoặc “Việc của huynhpt”. View cá nhân là mặc định; bước đầu có thể chia sẻ bằng URL. Bảng kết quả cho phép chọn các cột nghiệp vụ, sắp xếp và ghi nhớ cấu hình theo view.

**Công việc**

- Tạo giao diện lưu, đổi tên, nhân bản, xóa và ghim saved view.
- Lưu bộ lọc dưới dạng JSON có version, không chỉ dựa vào chuỗi URL.
- Hỗ trợ các trường hiện có: workspace, project, trạng thái, priority, assignee, due range, subtask và bucket.
- Thêm cột cho bảng: mã, tiêu đề, workspace, project, trạng thái, ưu tiên, assignee, ngày hạn, ngày tạo/cập nhật.
- Đồng bộ URL khi mở saved view; cho phép sao chép liên kết.

**Tiêu chí nghiệm thu**

- Người dùng có thể lưu và mở lại view sau khi đăng xuất/đăng nhập.
- Link view mở cùng điều kiện lọc; nếu view riêng tư thì người khác không xem được cấu hình.
- Không có view hoặc query nào làm lộ issue ngoài quyền của người truy cập.
- Cột và thứ tự cột được lưu riêng theo view.

### Giai đoạn 2 — Dashboard tùy chỉnh và widget engine

**Ưu tiên:** P1 · **Độ lớn:** L

Tạo dashboard cá nhân/nhóm với layout có thể chỉnh. Chuyển các phần hiện tại thành widget để người dùng chọn khối nào xuất hiện và sắp xếp theo công việc.

**Mô hình dữ liệu đề xuất**

- `Dashboard`: owner, tên, mô tả, layout, trạng thái mặc định/favorite, thời gian làm mới.
- `DashboardWidget`: dashboard, loại widget, cấu hình JSON có version, vị trí/thứ tự và kích thước.
- `SavedFilter`: owner, tên, điều kiện lọc JSON, visibility.
- `DashboardShare`: dashboard, đối tượng được chia sẻ, vai trò viewer/editor.

**Widget nền tảng**

1. KPI tổng quan.
2. Filter Results — bảng issue từ một saved filter.
3. Phân bổ theo trạng thái/ưu tiên/assignee.
4. Workload theo người phụ trách.
5. Issue quá hạn và sắp đến hạn.

**Tiêu chí nghiệm thu**

- Tạo nhiều dashboard, đổi tên, nhân bản, xóa mềm và chọn dashboard mặc định.
- Thêm, cấu hình, sắp xếp, đổi kích thước và xóa widget.
- Layout hỗ trợ desktop và mobile; cấu hình không làm dashboard nhảy vị trí khi tải dữ liệu.
- Lỗi của một widget không làm sập toàn bộ dashboard.

### Giai đoạn 3 — Phân tích xu hướng và tồn đọng

**Ưu tiên:** P1 · **Độ lớn:** L

Jira có các báo cáo Created vs Resolved, Average Age, Resolution Time và Cumulative Flow để nhìn xu hướng thay vì chỉ xem số liệu hiện tại. [Tài liệu báo cáo Jira](https://support.atlassian.com/jira-software-cloud/docs/generate-a-report/)

**Widget đề xuất**

- Created vs Resolved theo ngày/tuần/tháng.
- Backlog aging theo nhóm 0–7, 8–14, 15–30, trên 30 ngày.
- Thời gian hoàn thành trung bình và median.
- Thời gian issue nằm trong từng trạng thái.
- Cumulative flow theo trạng thái.
- Tỷ lệ quá hạn và xu hướng đóng việc theo workspace/project.

**Phụ thuộc dữ liệu**

- Dùng activity/state history để xác định thời điểm đổi trạng thái; không suy ra cycle time từ trạng thái hiện tại.
- Thống nhất cách tính ngày làm việc, múi giờ, issue bị reopen và issue bị hủy.
- API trả dữ liệu aggregate theo bucket thời gian để giảm tải; không tải toàn bộ issue về trình duyệt để tự tính.

**Tiêu chí nghiệm thu**

- Mỗi biểu đồ có khoảng thời gian, định nghĩa metric và link drill-down.
- Số tổng trên biểu đồ khớp truy vấn danh sách cùng bộ lọc.
- Khi thiếu lịch sử, hiển thị giới hạn dữ liệu rõ ràng thay vì đưa ra số liệu giả.

### Giai đoạn 4 — Chia sẻ, mẫu dashboard và quyền

**Ưu tiên:** P1 · **Độ lớn:** M/L

Jira cho phép chia sẻ dashboard với người dùng, nhóm, project/space hoặc người dùng đã đăng nhập; quyền xem và quyền sửa được tách riêng. Public sharing của Jira có thể làm dashboard hiển thị trên internet, vì vậy Plane nên mặc định private và không cung cấp public link cho dashboard tổng. [Quản lý dashboard dùng chung](https://support.atlassian.com/jira-cloud-administration/docs/manage-shared-dashboards/)

**Phân quyền Plane đề xuất**

- Private: chỉ chủ sở hữu.
- Workspace: thành viên workspace được chọn.
- User/group: chia sẻ trực tiếp với người hoặc nhóm.
- Viewer/editor: viewer xem và lọc; editor sửa widget/layout.
- Admin quản lý quyền và chuyển chủ sở hữu khi cần.

**Mẫu khởi tạo**

- **Portfolio CNTT:** dự án, tiến độ, quá hạn, tải theo người.
- **Vận hành:** việc khẩn cấp, blocked/paused, chưa phân công, quá hạn.
- **Theo dõi đối tác:** nhóm trạng thái chờ phản hồi, ngày chờ, owner nội bộ.
- **Dự án:** trạng thái, cycle, issue theo priority và tiến độ.

**Tiêu chí nghiệm thu**

- Chia sẻ dashboard không thay đổi ACL của workspace/project/issue.
- Viewer không thể sửa cấu hình; người mất quyền không còn xem dashboard chia sẻ.
- Mỗi widget áp dụng lại quyền của người đang xem trước khi trả dữ liệu.

### Giai đoạn 5 — Cycle reports và wallboard

**Ưu tiên:** P2 · **Độ lớn:** M/L

- Cycle/sprint burndown và burnup.
- Scope change sau khi cycle bắt đầu.
- Velocity theo nhiều cycle, nếu dữ liệu estimate đủ ổn định.
- Wallboard toàn màn hình, ẩn điều hướng, tự xoay nhiều dashboard và tự làm mới.

Jira wallboard là chế độ toàn màn hình của dashboard; có thể xoay giữa nhiều dashboard theo thời gian cấu hình. [Tài liệu wallboard Jira](https://support.atlassian.com/jira-software-cloud/docs/set-up-a-wallboard/)

**Tiêu chí nghiệm thu**

- Báo cáo chỉ xuất hiện khi project có cycle và dữ liệu estimate phù hợp.
- Wallboard không hiển thị thao tác sửa dashboard cho người chỉ có quyền xem.
- Tự làm mới không tạo request dồn dập hoặc vượt tải API.

## 5. Kiến trúc API đề xuất

- `GET/POST /api/dashboards/`: danh sách và tạo dashboard.
- `GET/PATCH/DELETE /api/dashboards/{id}/`: đọc, sửa metadata và xóa mềm.
- `GET/POST/PATCH/DELETE /api/dashboards/{id}/widgets/`: cấu hình widget.
- `GET/POST /api/saved-filters/`: lưu và đọc bộ lọc.
- `GET /api/dashboards/{id}/data/`: aggregate theo widget và filter; backend xác thực quyền cho từng request.
- Dùng cache ngắn theo dashboard, filter, viewer và khoảng thời gian; xóa cache khi issue, membership hoặc cấu hình dashboard đổi.

Không nên tạo một request nặng riêng cho mỗi widget nếu chúng dùng cùng bộ lọc. Giai đoạn đầu có thể gom aggregate theo dashboard vào một endpoint, sau đó tách widget có truy vấn riêng khi có nhu cầu hiệu năng.

## 6. Rủi ro và cách kiểm soát

| Rủi ro                                         | Kiểm soát                                                                           |
| ---------------------------------------------- | ----------------------------------------------------------------------------------- |
| Dashboard chia sẻ làm lộ issue qua aggregate   | Tính quyền ở server theo viewer; không tin dữ liệu/cache từ owner.                  |
| Dashboard nhiều widget tạo quá nhiều truy vấn  | Aggregate theo batch, giới hạn widget/request, cache ngắn và phân trang.            |
| Cycle time không chính xác do thiếu history    | Chỉ bật metric khi có đủ state history; ghi rõ ngày bắt đầu tính dữ liệu.           |
| Chỉ số giữa bảng và biểu đồ lệch nhau          | Dùng chung filter parser và metric definitions.                                     |
| Cấu hình widget cũ không đọc được sau nâng cấp | Version JSON config và migration/compatibility test.                                |
| Refresh ảnh hưởng API                          | Refresh mặc định tắt hoặc chu kỳ dài; giới hạn tần suất và hỗ trợ refresh thủ công. |

## 7. Thứ tự release được khuyến nghị

1. **Release A:** saved views, favorite, bảng có cột/sort và URL chia sẻ.
2. **Release B:** dashboard definitions, widget grid và cấu hình 5 widget nền tảng.
3. **Release C:** xu hướng Created vs Resolved, aging, thời gian xử lý và drill-down.
4. **Release D:** chia sẻ theo workspace/user/group, quyền viewer/editor, dashboard templates.
5. **Release E:** cycle/sprint reports và wallboard.

**Đề xuất bắt đầu:** Release A. Đây là phần gần nhất với Jira filter workflow, tận dụng endpoint và bộ lọc hiện có, đồng thời tạo nền để cùng một saved filter được dùng trong nhiều widget ở release sau.

## 8. Nguồn tham khảo

- [Jira Cloud — Dashboard gadgets](https://support.atlassian.com/jira-cloud-administration/docs/use-dashboard-gadgets/)
- [Jira Cloud — What is a dashboard?](https://support.atlassian.com/jira-software-cloud/docs/what-is-a-jira-dashboard/)
- [Jira Cloud — Create and edit dashboards](https://support.atlassian.com/jira-software-cloud/docs/create-and-edit-dashboards/)
- [Jira Cloud — Manage shared dashboards](https://support.atlassian.com/jira-cloud-administration/docs/manage-shared-dashboards/)
- [Jira Cloud — Generate a report](https://support.atlassian.com/jira-software-cloud/docs/generate-a-report/)
- [Jira Cloud — Set up a wallboard](https://support.atlassian.com/jira-software-cloud/docs/set-up-a-wallboard/)
