# Rà soát tiếng Việt và hướng nâng cấp Plane

Ngày rà soát: 21/10/2026. Phạm vi: `apps/web`, `apps/admin`, `apps/space`, `apps/live`, `apps/api`, `packages/blocks`, `packages/editor`, `packages/i18n`, cấu hình build và Docker. Đây là danh sách ưu tiên dựa trên quét mã và đối chiếu thủ công; số lượng ứng viên từ biểu thức tìm kiếm không phải số lỗi dịch đã xác nhận.

## Kết quả chính

- `vi-VN` có đủ 28 namespace và 3.915 khóa tương ứng với `en` sau khi bổ sung nhãn Analytics và thanh bên. Kiểm tra đồng bộ khóa và render ICU đều đạt. Điều này chỉ kiểm tra các chuỗi đã đưa vào i18n; nội dung viết trực tiếp trong JSX, toast, API và email vẫn xuất hiện bằng tiếng Anh.
- Ở thời điểm quét ban đầu có 46 giá trị `vi-VN` giống hệt `en`, phần lớn là tên riêng, URL, địa chỉ email, định dạng tệp và thuật ngữ đã chủ ý giữ nguyên (`Epic`, `Plane AI`, `GitHub`, `CSV`). Cần duyệt theo ngữ cảnh, không dịch hàng loạt.
- Quét sơ bộ tìm được 121 tệp TSX có mẫu văn bản JSX tiếng Anh, 91 tệp Python có mẫu `error`/`message` tiếng Anh và 12 mẫu email. Các phép đếm có thể gồm dương tính giả và bỏ sót chuỗi viết theo dạng khác.
- `DEFAULT_LANGUAGE` là `vi-VN` nhưng `FALLBACK_LANGUAGE` là `en` trong `packages/i18n/src/constants/language.ts`; khóa chưa được dịch sẽ hiện tiếng Anh. Không nên đổi fallback trước khi xử lý nguồn chuỗi và kiểm tra khóa.

## Vị trí đã xác nhận

| Ưu tiên | Khu vực                                | Dấu vết                                                                                                                                                                                       | Cần làm                                                                                                                                                                 |
| ------- | -------------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| P1      | Mật khẩu/đăng nhập                     | `packages/blocks/src/auth/password/helper.tsx`, `packages/utils/src/auth.ts`, `packages/blocks/src/auth/password/password-input.tsx`, `apps/space/components/account/auth-forms/password.tsx` | Chuyển thông báo độ mạnh, 5 tiêu chí mật khẩu, placeholder và lỗi xác nhận sang khóa i18n; hai ứng dụng dùng chung component cần cùng kết quả.                          |
| P1      | Thao tác trang                         | `apps/web/hooks/use-page-operations.ts` (khoảng 20 toast), `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/pages/(list)/header.tsx`                              | Dịch tiêu đề, nội dung toast và nút “Adding/Add page”; giữ nguyên giá trị `public`/`private` trong dữ liệu.                                                             |
| P1      | Trang lỗi và điều hướng                | Các trang chi tiết `views`, `cycles`, `modules` dưới `apps/web/app/(all)/[workspaceSlug]/(projects)/projects/(detail)/[projectId]/`; `apps/space/app/not-found.tsx`                           | Dịch “View other …”, trang 404 và thông báo lỗi.                                                                                                                        |
| P1      | API và email                           | `apps/api/plane/authentication/views/common.py`, `plane/app/serializers/{project,issue}.py`, 12 tệp dưới `apps/api/templates/emails`, các tác vụ `plane/bgtasks/*` tạo tiêu đề email          | Dịch thông báo hiển thị theo ngôn ngữ người nhận; giữ nguyên `error_code`, tên trường và enum trong hợp đồng API.                                                       |
| P2      | Thông báo lưu trong DB và xuất dữ liệu | `apps/api/plane/bgtasks/notification_task.py`, `issue_activities_task.py`, `analytic_plot_export.py`, `plane/app/views/workspace/base.py`                                                     | Chọn thời điểm/ngôn ngữ tạo nội dung; dữ liệu đã lưu cần chiến lược hiển thị riêng.                                                                                     |
| P2      | Khả năng truy cập và metadata          | `apps/admin/components/common/header/index.tsx`, `apps/space/components/issues/issue-layouts/error.tsx`, các `alt`/`aria-label`; tiêu đề các trang Admin còn “God Mode”                       | Dịch cả nhãn đọc màn hình và tiêu đề tab, không chỉ chữ nhìn thấy.                                                                                                      |
| P2      | Component dùng chung                   | `packages/blocks/src/emoji-icon-picker/icon/icon-root.tsx`, `apps/web/components/core/modals/workspace-image-upload-modal.tsx`                                                                | Chuyển hướng dẫn và fallback lỗi qua i18n.                                                                                                                              |
| P3      | Thuật ngữ                              | `packages/i18n/src/locales/vi-VN/workspace-settings.json`, `integration.json`; `apps/web/components/project/leave-project-modal.tsx`                                                          | Thống nhất “phòng ban/không gian làm việc”, “mục công việc”, “trang”, “Script”, “Webhook”, “Token API”. Nếu đổi câu xác nhận “Leave Project”, đổi cả điều kiện so khớp. |

### Cách xử lý dịch thuật

1. Khóa chuẩn đặt trong `en`; thêm cùng khóa vào tất cả locale rồi sửa `vi-VN`. Tận dụng khóa sẵn có trước khi tạo khóa mới.
2. Với backend dùng Django `gettext`/catalog hoặc mã lỗi ổn định để client dịch. Email và thông báo cần chọn locale của người nhận; không dựa vào locale của worker.
3. Kiểm tra `pnpm --filter @plane/i18n check:sync`, `pnpm --filter @plane/i18n test`, kiểm thử Web/Admin/Spaces bằng tiếng Việt và tiếng Anh, gồm thông báo lỗi, màn hình trống, tiêu đề tab và trình đọc màn hình.
4. Thêm kiểm tra chuỗi giao diện viết trực tiếp vào CI theo từng thư mục; phân loại ngoại lệ cho tên thương hiệu, URL, định dạng và từ kỹ thuật. Không dùng quy tắc ASCII để tự động dịch vì sẽ tạo nhiều dương tính giả.

## Hướng nâng cấp kỹ thuật

Repo khai báo Plane 1.4.2; Node 22.22.0, pnpm 11.10.0, Python 3.12, Django 5.2.17; Docker dùng PostgreSQL 15.7 và RabbitMQ 3.13.6. `pnpm-workspace.yaml` có các `catalog`/`overrides` để giữ tương thích, nên nâng từng nhóm và chạy kiểm thử tương ứng.

1. Cập nhật bản vá trong cùng nhánh hỗ trợ, trước tiên là Django 5.2 và PostgreSQL 15. PostgreSQL khuyến nghị dùng bản minor mới nhất; tại thời điểm rà soát, nhánh 15 là 15.19 và được hỗ trợ đến 11/2027 ([chính sách phiên bản PostgreSQL](https://www.postgresql.org/support/versioning/)). Đồng bộ các bản Docker cho local, test và production sau khi kiểm thử migration/backup.
2. Lập đợt nâng RabbitMQ riêng. Nhánh 3.13 đã hết hỗ trợ cộng đồng ([tài liệu RabbitMQ 3.13](https://www.rabbitmq.com/docs/3.13)). Tài liệu nâng cấp hiện yêu cầu đường `3.13 → 4.2 → 4.3` và bật stable feature flags trước khi nâng ([hướng dẫn RabbitMQ](https://www.rabbitmq.com/docs/upgrade)). Sao lưu volume, thử khôi phục và kiểm tra worker/beat trước khi thay đổi môi trường đang chạy.
3. Chuyển Node 22 sang Node 24 LTS theo một đợt riêng, đồng bộ `.node-version`, Dockerfiles, CI và `pnpm` sau khi chạy build/typecheck/E2E ([hướng dẫn Node 22 → 24](https://nodejs.org/en/blog/migrations/v22-to-v24)).
4. Sau khi ổn định các bước trên mới đánh giá nâng major PostgreSQL/Django/React Router/Vite. Giữ nguyên các `overrides` có lý do tương thích cho đến khi có thử nghiệm riêng.

Không thực hiện nâng cấp hoặc thay đổi dữ liệu trong đợt rà soát này. Workspace đang có nhiều thay đổi chưa commit, gồm chức năng dashboard và migration mới; mọi đợt nâng cấp cần tách khỏi chúng để dễ kiểm chứng và hoàn tác.
