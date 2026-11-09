# Thiết kế cổng Đề Nghị Thanh Toán

**Trạng thái:** đề xuất UX và kiến trúc dựa trên code Plane hiện có và workbook mẫu `Bàn giao ĐNTT tháng 10.2026.xlsx`.

## Quyết định đã xác nhận

- Mỗi lần tải là một **bản đầy đủ mới của tháng**, thay snapshot đang công khai sau khi xử lý và xác nhận thành công.
- Người có link công khai được xem đủ các trường như workbook: người đề nghị, bộ phận, số DNTT, nội dung và số tiền.
- Link tháng 10 chỉ hiển thị dữ liệu có ngày thuộc tháng 10. Sheet tháng 8 và 9 trong workbook mẫu không xuất hiện ở link tháng 10.

## Kết quả khảo sát

### Workbook mẫu

- File khoảng 1,36 MB, có 147 sheet: 146 sheet có dữ liệu và một sheet trống.
- Workbook có dữ liệu mang ngày trong tháng 8, 9 và 10 dù tên file ghi tháng 10. Tháng hiển thị phải lấy từ ngày của sheet sau khi chuẩn hóa, không lấy riêng từ tên file.
- Có ba biến thể hàng tiêu đề: 97 sheet dùng `STT | Họ và Tên | Bộ Phận | DNTT | Nội Dung | Số Tiền`; 46 sheet dùng `STT | NGƯỜI ĐỀ NGHỊ | BỘ PHẬN | SỐ ĐỀ NGHỊ | NỘI DUNG | SỐ TIỀN`; 3 sheet thiếu nhãn bộ phận nhưng giữ các cột còn lại.
- Bảy sheet có hàng tiêu đề lặp; tên sheet không đồng nhất về dấu, chữ hoa/thường và hậu tố. Có 11 sheet không nhận diện được loại từ tên, cùng một sheet trống.
- Có 603 công thức trên 105 sheet và 51 vùng merge trên 48 sheet. Tất cả công thức có giá trị cache trong file mẫu, nhưng cache có thể cũ nếu workbook chưa được Excel tính lại.
- `openpyxl==3.1.2` đã có trong API. Thư viện không mở được file nguyên trạng vì 145 node `autoFilter` có tiêu chí XML bị từ chối. Bỏ các node lọc khỏi một **bản sao tạm** cho phép đọc dữ liệu; workbook gốc không bị sửa. Hướng dẫn openpyxl cũng nói thư viện từ chối một số OOXML không hợp lệ, `data_only` chỉ đọc giá trị đã lưu lần cuối và thư viện không tính lại công thức ([load workbook/formulas](https://openpyxl.readthedocs.io/en/latest/tutorial.html)).

### Thành phần Plane có thể tái sử dụng

- Lưu trữ S3/MinIO và URL tải lên có chữ ký: [`storage.py`](../apps/api/plane/settings/storage.py), [`asset/v2.py`](../apps/api/plane/app/views/asset/v2.py). Endpoint tài sản hiện có chỉ chấp nhận ảnh và giới hạn chung 5 MB, nên cần luồng upload workbook riêng.
- Celery đã được cấu hình: [`celery.py`](../apps/api/plane/celery.py). Có thể đưa việc đọc và chuẩn hóa workbook vào worker thay vì giữ request HTTP mở trong lúc xử lý.
- Cổng Space có mẫu trang công khai riêng: [`apps/space/app/routes.ts`](../apps/space/app/routes.ts). Có thể thêm route chỉ đọc ở đây; không nên dùng quyền “public” của Project Pages vì quyền đó vẫn từ chối người dùng anonymous: [`page.py`](../apps/api/plane/app/permissions/page.py).
- Các giao diện hiện có cung cấp mẫu table, filter, tháng, upload và trạng thái tải lên: [`data-table.tsx`](../apps/web/components/common/data-table.tsx), [personal dashboard](../apps/web/components/personal-dashboard/root.tsx), [calendar header](../apps/web/components/issues/issue-layouts/calendar/header.tsx), [attachment upload](../apps/web/components/issues/attachment/attachment-item-list.tsx).

## UX đề xuất

### Trang công khai theo tháng

Trang chỉ đọc, không yêu cầu đăng nhập. Token trong link cấp quyền cho đúng tháng; người có link thấy toàn bộ trường đã xác nhận ở trên. Trang không liệt kê các tháng khác và không cho đoán ID tháng.

```text
┌────────────────────────────────────────────────────────────────────────┐
│ Đề nghị thanh toán · Tháng 10/2026              [Tải Excel tháng 10]  │
│ Cập nhật lần cuối: [thời gian] · [N] đề nghị · [N] loại             │
├────────────────────────────────────────────────────────────────────────┤
│ [Tìm số DNTT, người đề nghị, nội dung…            ] [Ngày ▾] [Loại ▾] │
│ [Bộ phận ▾] [Người đề nghị ▾] [Số tiền ▾]             [Xóa bộ lọc]   │
│ TMDV  ·  TNHH  ·  Du học  ·  Khác                                    │
├────────────────────────────────────────────────────────────────────────┤
│ 30 THÁNG 10     18 DNTT · tổng ........................... [Thu gọn]  │
│  Mã DNTT     Người đề nghị    Bộ phận    Nội dung       Số tiền       │
│  ...                                                               │
│ 29 THÁNG 10     12 DNTT · tổng ........................... [Mở rộng]  │
│                                            [10 / 25 / 50 mỗi trang]    │
└────────────────────────────────────────────────────────────────────────┘
```

**Cấu trúc hiển thị**

1. Tiêu đề tháng, thời điểm snapshot được công khai lần cuối và nút tải Excel của riêng tháng đó.
2. Tổng số DNTT và tổng số tiền của tháng. Khi lọc, hiển thị riêng “Kết quả đang lọc” để không nhầm với tổng toàn tháng.
3. Tóm tắt số lượng và tổng tiền theo TMDV, TNHH, Du học và Khác.
4. Tìm kiếm theo số DNTT, người đề nghị, bộ phận hoặc nội dung. Bộ lọc gồm ngày trong tháng, loại, bộ phận, người đề nghị và khoảng tiền.
5. Bộ lọc đang bật xuất hiện thành chip có thể gỡ từng chip; có thao tác xóa tất cả.
6. Kết quả nhóm theo ngày; trong ngày có thể nhóm theo loại. Các hàng mang cùng số DNTT được gom thành một đề nghị, các dòng nội dung và số tiền nằm trong phần mở rộng.
7. Desktop dùng bảng; mobile chuyển mỗi đề nghị thành thẻ. Phân trang 25 mục mặc định, chọn 10/25/50.

**Logic tra cứu**

- Tháng lấy từ ngày sheet sau khi chuẩn hóa. Link tháng 10 chỉ trả các hàng thuộc tháng 10; sheet tháng 8/9 được báo ở phần xem trước khi tải lên và không được xuất vào dữ liệu tháng 10.
- Ngày trong nội dung mô tả chỉ dùng để tìm kiếm; không tự suy ra ngày DNTT từ câu mô tả. Ngày DNTT lấy từ tiêu đề/tab của sheet hoặc được người tải xác nhận nếu parser chưa chắc chắn.
- Tìm kiếm không phân biệt hoa/thường; ưu tiên các trường có chỉ mục như số DNTT, người đề nghị và bộ phận. Nội dung hỗ trợ tìm theo từ khóa.
- Tổng tiền cộng từ các dòng chi tiết; dòng tổng/subtotal trong Excel dùng để đối soát và không được cộng lần hai.
- Dữ liệu sheet thiếu ngày hoặc loại được đánh dấu “Cần phân loại” trong màn hình quản trị, không tự gán vào tháng 10.

### Trang quản trị tải lên

Trang quản trị nằm trong ứng dụng đăng nhập. Tài khoản cần đăng nhập bằng email được cấp quyền. Backend phải kiểm tra quyền cho từng API, kể cả khi người dùng tự gọi endpoint.

```text
Đề nghị thanh toán / Quản lý

Tháng báo cáo: [10 / 2026 ▾]       Snapshot công khai: 29/10, 15:42

┌──────────────────────────────────────────────────────────────┐
│ Kéo workbook tháng 10 vào đây hoặc [Chọn file .xlsx]       │
│ Mỗi lần tải là snapshot đầy đủ; bản mới thay bản đang dùng. │
└──────────────────────────────────────────────────────────────┘

Đang đọc workbook…  147 sheet · tìm thấy dữ liệu tháng 8–10
• Tháng 10: N sheet · N dòng
• Ngoài tháng 10: N sheet (sẽ không đưa vào trang tháng 10)
• Cần phân loại: N sheet                 [Xem chi tiết]

[Xem trước] [Hủy] [Công khai snapshot tháng 10]
Lịch sử snapshot · ai tải · thời điểm · trạng thái · [Khôi phục]
```

**Quản lý email được cấp quyền** (chỉ admin được chỉ định): nhập email, xem danh sách email đang có quyền, người cấp và thời gian cấp; có thể thu hồi quyền. Tài khoản bị thu hồi không tải được snapshot tiếp theo dù giao diện vẫn đang mở.

**Luồng tải**

1. Chọn tháng báo cáo và tải `.xlsx`; hiển thị tên file, dung lượng và tiến trình.
2. API xác nhận email trong allowlist, kiểm tra nội dung workbook, tạo phiên bản nhập và đưa việc đọc file vào Celery.
3. Trang quản trị thăm dò trạng thái xử lý; hiển thị số sheet theo ngày/loại, số dòng đã đọc, số dòng bỏ qua, lỗi và cảnh báo.
4. Người tải xem trước dữ liệu; xử lý sheet chưa nhận diện hoặc xác nhận bỏ các sheet ngoài tháng chọn.
5. Chỉ khi kiểm tra hợp lệ, người tải bấm công khai. Phiên bản mới thay snapshot đang dùng của tháng đó trong một lần cập nhật nguyên tử. Nếu phân tích thất bại, bản công khai cũ tiếp tục hoạt động.
6. Link công khai của tháng giữ nguyên qua các lần cập nhật; quản trị viên có thể thu hồi và tạo token mới.

## Xử lý workbook và dữ liệu

1. **Giữ nguyên workbook gốc** trong bucket riêng tư, đặt object key ngẫu nhiên, tính SHA-256 và giữ checksum. Tên file người dùng là metadata; không dùng làm đường dẫn lưu trữ.
2. Chỉ chấp nhận `.xlsx`. Kiểm tra extension, ZIP/OOXML signature, dung lượng nén và sau giải nén, số entry và giới hạn sheet/row. MIME do trình duyệt gửi không được xem là bằng chứng loại file. Đây là các kiểm tra phù hợp với hướng dẫn upload của [OWASP](https://cheatsheetseries.owasp.org/cheatsheets/File_Upload_Cheat_Sheet.html). Django cũng cung cấp cơ chế đọc file theo chunks để tránh nạp toàn bộ file lớn vào RAM ([Django file handling](https://docs.djangoproject.com/en/5.2/ref/files/)).
3. Dùng Celery tạo bản sao tạm chuẩn hóa chỉ để parser đọc; bỏ `autoFilter` không hợp lệ nếu cần, không ghi đè hoặc round-trip workbook gốc. Có thể chọn parser khác nếu không muốn sửa XML tạm.
4. Tìm hàng tiêu đề theo alias thay vì cột cố định. Hỗ trợ ba layout hiện có, header lặp, dòng trống, merged cells, tab có hậu tố và khoảng trắng/dấu khác nhau.
5. Ngày: lấy từ tên sheet/ô tiêu đề; nếu sheet chỉ có ngày-tháng thì năm lấy từ tháng báo cáo đã chọn. Không nhận dạng chắc chắn thì yêu cầu xác nhận trong preview.
6. Loại: chuẩn hóa TMDV, TNHH, Du học; giữ nguyên nhãn gốc và để người tải map các sheet khác. Không âm thầm bỏ 11 sheet không nhận diện được loại.
7. Mỗi dòng chi tiết được lưu kèm import version, sheet nguồn và số dòng Excel. Gom dòng thành DNTT theo số đề nghị; nếu thiếu số, không tự gộp dựa trên tên/nội dung.
8. Số tiền được parse thành số thập phân chính xác theo VND, không dùng float. Công thức không được `openpyxl` tính lại; dùng cached value nếu có, ghi cảnh báo nếu trống và cho phép đối soát tổng các dòng với tổng sheet. Tài liệu openpyxl mô tả `data_only` là giá trị lưu lần cuối bởi Excel; dữ liệu cache hiện có không chứng minh công thức đã được tính lại gần nhất ([openpyxl load workbook](https://openpyxl.readthedocs.io/en/latest/tutorial.html)).
9. Snapshot mới được lưu riêng. Sau khi người tải xác nhận, dùng transaction để chuyển con trỏ phiên bản đang công khai của tháng; phiên bản cũ giữ lại để xem lịch sử/khôi phục. Transaction đảm bảo hoặc chuyển toàn bộ trạng thái công khai, hoặc không chuyển trạng thái nào ([Django transactions](https://docs.djangoproject.com/en/5.2/topics/db/transactions/)).

## Mô hình dữ liệu đề xuất

| Bản ghi             | Trường chính                                                                           | Mục đích                                               |
| ------------------- | -------------------------------------------------------------------------------------- | ------------------------------------------------------ |
| `DnttUploader`      | email chuẩn hóa, active, người cấp quyền, thời gian cấp/thu hồi                        | Allowlist email; email phải khớp tài khoản đã xác thực |
| `DnttImportVersion` | tháng báo cáo, file gốc, checksum, uploader, parser version, trạng thái, thống kê, lỗi | Audit và lịch sử snapshot đầy đủ                       |
| `DnttSheet`         | import version, tên sheet, ngày DNTT, loại gốc/chuẩn hóa, hàng header, trạng thái      | Truy vết từng sheet và xử lý lỗi phân loại             |
| `DnttRequest`       | ngày, loại, người đề nghị, bộ phận, số DNTT, tổng tiền, import version                 | Bản ghi đề nghị để lọc/tổng hợp                        |
| `DnttRequestLine`   | DNTT, nội dung, số tiền, sheet nguồn, số dòng nguồn                                    | Chi tiết từng dòng, không làm mất cấu trúc Excel       |
| `DnttMonthShare`    | tháng, token hash, active, hết hạn/thu hồi                                             | Link bearer chỉ đọc cho đúng tháng                     |

Các API quản trị cần tạo import, lấy trạng thái, xem preview, publish snapshot, xem lịch sử/khôi phục và cấp/thu hồi link. API công khai nhận token, chỉ trả các trường đã duyệt và chỉ truy vấn tháng nằm trong quyền của token. Tải Excel công khai sinh workbook riêng cho tháng được chia sẻ; không trả URL/object key của file gốc chứa nhiều tháng.

## Bảo mật và riêng tư

- Quyền upload kiểm tra ở backend theo user đã đăng nhập và email đã xác minh trong allowlist. Quản lý allowlist chỉ dành cho admin được chỉ định.
- Link công khai là bearer token dài ngẫu nhiên, chỉ lưu hash, có thể thu hồi/đổi token; không dùng ID tăng dần hoặc slug đoán được.
- Ai có link tháng 10 đều xem được tên, bộ phận, số DNTT, nội dung và số tiền tháng 10. Không đăng index, không cho API liệt kê các tháng/token, thêm rate limit, che token khỏi logs, đặt `Referrer-Policy: no-referrer` và `X-Robots-Tag: noindex, nofollow`.
- File gốc nhiều tháng chỉ tải từ trang quản trị. Trang công khai tải file Excel đã lọc theo đúng tháng trong token.
- Lỗi public trả thông báo chung; chi tiết sheet/dòng chỉ hiển thị cho uploader/admin.

## Các giai đoạn triển khai

1. Chốt quy tắc ngày, loại, dòng tổng và cách download theo tháng dựa trên workbook thực tế.
2. Tạo model/migration cho allowlist, import version, sheet, DNTT/line và token chia sẻ.
3. Xây API upload/preview/status và parser Celery có giới hạn tài nguyên, idempotency theo checksum, lỗi theo sheet/dòng.
4. Xây màn hình upload, preview, lịch sử và publish/rollback.
5. Xây public API, token theo tháng, export workbook tháng và trang tra cứu responsive.
6. Bổ sung kiểm thử unit/integration/E2E cho parser, quyền upload, phân trang/lọc, link bị thu hồi và download không lẫn tháng.

## Còn cần xác nhận trước khi chốt parser

- Dòng có cùng số DNTT trong nhiều hàng có phải là các dòng chi tiết của một đề nghị không? Thiết kế mặc định nhóm các dòng đó thành một đề nghị.
- Khi workbook tháng 10 có sheet tháng 8/9, các sheet đó bị bỏ khỏi snapshot tháng 10 như đã chọn. Có cần tự tạo/refresh snapshot tháng 8/9 từ cùng workbook không? Thiết kế mặc định không tự sửa các tháng khác.
- File công khai tải về là Excel mới chỉ chứa dữ liệu tháng được chia sẻ; file gốc đầy đủ nhiều tháng chỉ dành cho uploader/admin. Nếu cần tải đúng file gốc, link tháng đó sẽ chứa dữ liệu các tháng khác trong workbook.
- Những sheet không nhận diện loại/ngày phải được map trong preview; chưa nên tự đoán từ nội dung mô tả.
