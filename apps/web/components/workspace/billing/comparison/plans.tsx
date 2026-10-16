/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { ChatOutline, MailOutline } from "@makeplane/propel/icons";
import { EProductSubscriptionEnum } from "@plane/types";
// plane imports
import { cn } from "@plane/utils";

export type TPlanFeatureData = React.ReactNode | boolean | null;

// TODO: we should change this type and use TProductSubscriptionType instead. Need changes in common constants.
export type TPlanePlans = "free" | "one" | "pro" | "business" | "enterprise";

export type TPlanDetail = {
  id: EProductSubscriptionEnum;
  name: React.ReactNode;
  monthlyPrice?: number;
  yearlyPrice?: number;
  monthlyPriceSecondaryDescription?: React.ReactNode;
  yearlyPriceSecondaryDescription?: React.ReactNode;
  buttonCTA?: React.ReactNode;
  isActive: boolean;
};

type TPlanFeatureDetails = {
  title: React.ReactNode;
  description?: React.ReactNode;
  selfHostedDescription?: React.ReactNode;
  comingSoon?: boolean;
  selfHostedOnly?: boolean;
  cloud: Record<TPlanePlans, TPlanFeatureData>;
  "self-hosted"?: Record<TPlanePlans, TPlanFeatureData>;
};

type TPlansComparisonDetails = {
  id: string;
  title: React.ReactNode;
  comingSoon?: boolean;
  cloudOnly?: boolean;
  selfHostedOnly?: boolean;
  features: TPlanFeatureDetails[];
};

type PlanePlans = {
  planDetails: Record<TPlanePlans, TPlanDetail>;
  planHighlights: Record<TPlanePlans, string[]>;
  planComparison: TPlansComparisonDetails[];
};

function ForumIcon({ className }: { className?: string }) {
  return <ChatOutline className={cn(className, "size-5 text-secondary")} />;
}

export function ComingSoonBadge({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "w-fit rounded-sm bg-accent-primary px-1.5 py-0.5 text-9 font-semibold whitespace-nowrap text-on-color",
        className
      )}
    >
      SẮP RA MẮT
    </span>
  );
}

export const PLANS_LIST: TPlanePlans[] = ["free", "one", "pro", "business", "enterprise"];

export const PLANS_COMPARISON_LIST: TPlansComparisonDetails[] = [
  {
    id: "project-work-tracking",
    title: "Theo dõi dự án và công việc",
    features: [
      {
        title: "Dự án",
        description: "Tạo dự án để quản lý mục công việc, chu kỳ và nhóm công việc.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Mục công việc",
        description: "Tạo mục công việc, đặt thuộc tính để theo dõi và thêm vào chu kỳ hoặc nhóm công việc.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Bình luận",
        description: "Phản hồi mục công việc, nhắc tên thành viên và thảo luận ngay trong Plane.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Chu kỳ",
        description: "Theo dõi công việc theo các chu kỳ có độ dài khác nhau.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Nhóm công việc",
        description: "Nhóm các công việc liên quan và chỉ định người phụ trách riêng.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Tiếp nhận",
        description: "Xem đề xuất và phản hồi từ người xem hoặc khách trước khi đưa vào dự án.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Ước tính",
        description: "Ước lượng công sức bằng điểm theo hệ thống phù hợp với bạn.",
        cloud: {
          free: "Basic",
          one: "Basic",
          pro: "Advanced",
          business: "Advanced",
          enterprise: "Advanced",
        },
      },
    ],
  },
  {
    id: "project-work-management",
    title: "Quản lý dự án và công việc",
    features: [
      {
        title: "Thao tác hàng loạt",
        description: "Thêm nhiều mục vào chu kỳ hoặc nhóm, chuyển chúng hoặc sửa thuộc tính cùng lúc.",
        cloud: {
          free: false,
          one: "Limited props",
          pro: "All props",
          business: (
            <span className="flex flex-col items-end gap-1 lg:items-center">
              <ComingSoonBadge />
              Chuyển và đổi loại mục công việc
            </span>
          ),
          enterprise: (
            <span className="flex flex-col items-end gap-1 lg:items-center">
              <ComingSoonBadge />
              Chuyển và đổi loại mục công việc
            </span>
          ),
        },
      },
      {
        title: "Theo dõi thời gian và nhật ký công việc",
        description: "Ghi thời gian cho từng mục công việc, xem báo cáo tổng hợp và lọc theo nhu cầu.",
        cloud: {
          free: false,
          one: "Basic",
          pro: "Historical timesheets",
          business: "Historical timesheets\nand approvals",
          enterprise: "Historical timesheets\nand approvals",
        },
      },
      {
        title: "Chu kỳ đang hoạt động",
        description: "Xem mọi chu kỳ đang chạy trong tất cả dự án hoặc trong một dự án.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Loại mục công việc",
        description: "Tạo loại mục công việc và thuộc tính riêng.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Thuộc tính tùy chỉnh",
        description: "Tạo thuộc tính riêng và áp dụng cho không gian làm việc hoặc dự án.",
        cloud: {
          free: false,
          one: false,
          pro: "Project-level\ncustom properties",
          business: "Workspace-level\nproperties and roll-ups",
          enterprise: "Workspace-level\nproperties and roll-ups",
        },
      },
      {
        title: "Phụ thuộc trên biểu đồ Gantt",
        description: "Điều chỉnh trực quan mốc thời gian của các mục phụ thuộc trên biểu đồ Gantt.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Chuyển mục công việc",
        description: "Chuyển mục công việc sang dự án hoặc chu kỳ khác.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Tự động chuyển mục chưa hoàn thành",
        description: "Chuyển mục chưa hoàn thành sang chu kỳ tiếp theo hoặc trạng thái mặc định của dự án.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Nhóm công việc lớn",
        description: "Tổ chức công việc dài hạn trong các nhóm lớn gồm mục công việc, chu kỳ và nhóm công việc.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Sáng kiến",
        description: "Tạo sáng kiến để tập hợp nhiều nhóm công việc lớn.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Mốc kiểm tra",
        description: "Đặt mốc cho dự án, nhóm công việc lớn và sáng kiến để theo dõi tiến độ.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Tổng quan nhóm công việc",
        description: "Xem chi tiết và biểu đồ tiến độ của từng nhóm công việc.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Tự động giao việc trong nhóm",
        description: "Chọn quy tắc giao việc trong nhóm: tuần tự, luân phiên hoặc theo năng lực.",
        cloud: {
          free: false,
          one: false,
          pro: "Linear",
          business: "Round-robin and Capacity",
          enterprise: "Round-robin and Capacity",
        },
      },
      // {
      //   title: "Tổng quan dự án",
      //   description: "Xem nhanh dự án cùng các chỉ số quan trọng.",
      //   comingSoon: true,
      //   cloud: {
      //     free: false,
      //     one: false,
      //     pro: true,
      //     business: true,
      //     enterprise: true,
      //   },
      // },
      {
        title: "Dự án công khai, riêng tư và bí mật",
        description:
          "Dự án công khai cho mọi người truy cập. Dự án riêng tư cần được duyệt để tham gia. Dự án bí mật không hiển thị với người ngoài.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Trạng thái dự án",
        description: "Xem dự án theo trạng thái để nhận biết dự án cần chú ý và dự án đúng tiến độ.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      // {
      //   title: "Cập nhật dự án",
      //   description:
      //     "Keep stakeholders in the loop with a dedicated\nspace for updates that everyone in the project can\nsee.",
      //   comingSoon: true,
      //   cloud: {
      //     free: false,
      //     one: false,
      //     pro: true,
      //     business: true,
      //     enterprise: true,
      //   },
      // },
      {
        title: "Mẫu mục công việc có sẵn",
        description: "Chọn mẫu mục công việc có sẵn với loại và thuộc tính phù hợp từng nhu cầu.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Chu kỳ nhóm",
        description: "Xem nhiều chu kỳ của nhiều dự án cùng lúc.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Mẫu dự án",
        description: "Lưu trạng thái, quy trình, tự động hóa và cài đặt dự án thành mẫu.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Kế hoạch gốc và sai lệch",
        description: "Đặt kế hoạch gốc cho tiến độ dự án và theo dõi sai lệch.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Giao tiếp theo lịch",
        description: "Lên lịch gửi báo cáo, thông báo và tin nhắn đến công cụ bên ngoài.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Người xử lý mục tiếp nhận",
        description: "Tự động giao mục tiếp nhận đã duyệt cho thành viên mặc định.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "SLA tùy chỉnh",
        description: "Đặt cam kết thời gian xử lý cho các mục công việc cần gấp.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Biểu mẫu tiếp nhận",
        description: "Tiếp nhận mục công việc từ biểu mẫu web bên ngoài.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Email tiếp nhận",
        description: "Dùng địa chỉ email để gửi mục công việc trực tiếp vào phần tiếp nhận của dự án.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "visualization",
    title: "Trực quan hóa",
    features: [
      {
        title: "Bố cục",
        description: "Chọn bố cục danh sách, bảng, lịch, Gantt hoặc bảng tính cho mục công việc.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Chế độ xem",
        description: "Lưu cách sắp xếp, bộ lọc và hiển thị thành một chế độ xem.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Chế độ xem được chia sẻ",
        description: "Chọn thành viên để chia sẻ chế độ xem.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Xuất bản chế độ xem",
        description: "Đưa chế độ xem lên Internet để khách hàng tương tác.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Bảng điều khiển và tiện ích",
        description: "Tạo bảng điều khiển riêng với tiện ích và loại dữ liệu tùy chỉnh.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "analytics-reports",
    title: "Phân tích và báo cáo",
    features: [
      {
        title: "Biểu đồ tiến độ",
        description: "Theo dõi tiến độ chu kỳ và nhóm công việc ngay trong Plane mà không cần mở bảng phân tích.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Báo cáo chu kỳ",
        description: "Xem báo cáo trong và sau chu kỳ; mở lại bất kỳ lúc nào qua liên kết cố định.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Thông tin chuyên sâu",
        description: "Phân tích quá khứ, theo yêu cầu và dự báo.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      // {
      //   title: "Dòng thời gian dự án",
      //   description: "Quay lại dòng thời gian để xem trạng thái dự án tại từng thời điểm.",
      //   comingSoon: true,
      //   cloud: {
      //     free: false,
      //     one: false,
      //     pro: false,
      //     business: true,
      //     enterprise: true,
      //   },
      // },
      {
        title: "Phân tích trang nâng cao",
        description: "Xem ai đã đọc, chia sẻ và bình luận trên trang cùng các thông tin hữu ích khác.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Báo cáo tùy chỉnh",
        description: "Tạo báo cáo theo mọi chiều dữ liệu và chỉ số của dự án hoặc không gian làm việc.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "navigation",
    title: "Điều hướng",
    features: [
      {
        title: "Power K",
        description: "Dùng bàn phím để truy cập nhanh hầu hết chức năng trong Plane.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      // {
      //   title: "Tìm kiếm",
      //   description: "Tìm kiếm bằng ngôn ngữ tự nhiên, toán tử hoặc PQL",
      //   cloud: {
      //     free: "Basic text search",
      //     one: "Basic text search",
      //     pro: (
      //       <span className="flex flex-col items-end lg:items-center gap-1">
      //         <span className="bg-[#3f76ff] text-on-color font-semibold text-9 p-0.5 w-fit whitespace-nowrap rounded-xs">
      //           COMING SOON
      //         </span>
      //         Operator capsules from text or PQL
      //       </span>
      //     ),
      //     business: (
      //       <span className="flex flex-col items-end lg:items-center gap-1">
      //         <span className="bg-[#3f76ff] text-on-color font-semibold text-9 p-0.5 w-fit whitespace-nowrap rounded-xs">
      //           COMING SOON
      //         </span>
      //         Operator capsules from text or PQL
      //       </span>
      //     ),
      //     enterprise: (
      //       <span className="flex flex-col items-end lg:items-center gap-1">
      //         <span className="bg-[#3f76ff] text-on-color font-semibold text-9 p-0.5 w-fit whitespace-nowrap rounded-xs">
      //           COMING SOON
      //         </span>
      //         Operator capsules from text or PQL
      //       </span>
      //     ),
      //   },
      // },
      {
        title: "PQL",
        description: "Viết truy vấn Plane với các toán tử logic; sắp tới hỗ trợ ngôn ngữ tự nhiên.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "workspace-user-management",
    title: "Quản lý không gian làm việc và người dùng",
    features: [
      {
        title: "Giới hạn thành viên",
        description: "Số người có thể dùng tính năng quản lý dự án và công việc",
        selfHostedDescription: "Number of users that our standard infra supports\nIncrease infra to get more users",
        cloud: {
          free: "12",
          one: "",
          pro: "Unlimited",
          business: "Unlimited",
          enterprise: "Unlimited",
        },
        "self-hosted": {
          free: "~50",
          one: "~50",
          pro: "~200",
          business: "~200",
          enterprise: "Unlimited",
        },
      },
      {
        title: "Vai trò",
        description: "Chọn một trong bốn vai trò có sẵn hoặc tạo vai trò riêng với phân quyền RBAC.",
        cloud: {
          free: "Basic",
          one: "Basic",
          pro: "Pre-defined roles",
          business: "RBAC",
          enterprise: "GAC",
        },
      },
      {
        title: "Khách",
        description: "Cho phép một số người xem toàn bộ dự án hoặc chỉ mục công việc của họ.",
        cloud: {
          free: false,
          one: "5 per paid member",
          pro: "5 per paid member",
          business: "5 per paid member",
          enterprise: "5 per paid member",
        },
      },
      {
        title: "Phê duyệt",
        description: "Chỉ định quản trị viên phê duyệt không gian làm việc, dự án và loại mục công việc.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Giao diện quản trị",
        description: "Xem tổng quan quản trị để quản lý cài đặt không gian làm việc và dự án.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Nhật ký hoạt động không gian làm việc",
        description: "Xem và lọc nhật ký hoạt động của toàn bộ không gian làm việc.",
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Nhật ký kiểm toán qua API",
        description: "Xem nhật ký kiểm toán toàn bộ không gian làm việc và dùng API cho hệ thống tuân thủ.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "automations-workflows",
    title: "Tự động hóa và quy trình",
    features: [
      {
        title: "Điều kiện kích hoạt và hành động",
        description: "Chọn điều kiện kích hoạt và hành động cho mỗi luồng tự động hóa.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Tự động hóa có nhánh và vòng lặp",
        description: "Dùng hành động làm điều kiện kích hoạt tiếp theo trong luồng tự động hóa.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Số luồng tự động hóa",
        description: "Tổng số luồng tự động hóa trong không gian làm việc",
        cloud: {
          free: false,
          one: false,
          pro: "5,000",
          business: "10,000",
          enterprise: "Unlimited",
        },
      },
    ],
  },
  {
    id: "knowledge-management",
    title: "Quản lý tri thức",
    features: [
      {
        title: "Trang",
        description: "Xây dựng kho tri thức dễ truy cập và chia sẻ cho nhóm.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Cộng tác thời gian thực",
        description: "Cùng thành viên trong dự án, nhóm hoặc không gian làm việc chỉnh sửa trang.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Nhúng mục công việc",
        description: "Nhúng mục công việc từ dự án mà bạn là thành viên.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Liên kết tới mục công việc",
        description: "Liên kết trang vào phần riêng trong chi tiết mục công việc.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Xuất bản",
        description: "Xuất bản trang cho người ngoài xem và bình luận mà không cần đăng nhập.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Wiki",
        description: "Tạo wiki hoặc kho tri thức toàn công ty mà không cần tạo dự án.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Xuất dữ liệu",
        description: "Xuất nội dung trang thành PDF hoặc tài liệu tương thích Word.",
        cloud: {
          free: false,
          one: false,
          pro: "One download\nat a time",
          business: "Queued downloads",
          enterprise: "Queued downloads",
        },
      },
      {
        title: "Mẫu",
        description: "Dùng trang làm mẫu cho dự án, nhóm hoặc không gian làm việc.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Phiên bản",
        description: "Xem và khôi phục các phiên bản đã chỉnh sửa của trang.",
        cloud: {
          free: false,
          one: false,
          pro: "2 days",
          business: "3 months",
          enterprise: "Unlimited",
        },
      },
      {
        title: "Cơ sở dữ liệu và công thức",
        description: "Thêm cơ sở dữ liệu và công thức vào trang cùng văn bản, hình ảnh và nội dung khác.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Trang lồng nhau",
        description: "Tổ chức các trang con trong trang cha để hiển thị thông tin theo từng lớp.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: "Word-compatible + other format downloads",
          enterprise: "Word-compatible + other format downloads",
        },
      },
    ],
  },
  {
    id: "importers",
    title: "Công cụ nhập dữ liệu",
    features: [
      {
        title: "Jira",
        description: "Nhập mục công việc và thành viên từ Jira.",
        cloud: {
          free: "Without custom props",
          one: "Without custom props",
          pro: "With custom props",
          business: "With custom props",
          enterprise: "With custom props",
        },
      },
      {
        title: "GitHub",
        description: "Nhập mục công việc và thành viên từ GitHub.",
        cloud: {
          free: "Without custom props",
          one: "Without custom props",
          pro: "With custom props",
          business: "With custom props",
          enterprise: "With custom props",
        },
      },
    ],
  },
  {
    id: "integrations",
    title: "Tích hợp",
    comingSoon: true,
    features: [
      {
        title: "GitHub",
        description: "Đồng bộ mục công việc và trạng thái giữa Plane và GitHub theo cả hai chiều.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Slack",
        description: "Nhận hoạt động Plane trong Slack và dùng lệnh / để thao tác với Plane.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Zapier",
        description: "Tạo quy tắc tự động hóa nếu–thì bằng Zapier.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Zendesk",
        description: "Tạo mục công việc Plane từ ticket Zendesk.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Freshdesk",
        description: "Tạo mục công việc Plane từ ticket Freshdesk.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "storage",
    title: "Lưu trữ",
    cloudOnly: true,
    features: [
      {
        title: "Dung lượng",
        description: "Tổng dung lượng lưu trữ cho mỗi không gian làm việc",
        cloud: {
          free: "5GB",
          one: false,
          pro: "1 TB",
          business: "5 TB",
          enterprise: "Custom",
        },
      },
      {
        title: "Kích thước tệp tối đa",
        description: "Giới hạn tải tệp lên không gian làm việc",
        cloud: {
          free: "5 MB",
          one: false,
          pro: "100 MB",
          business: "200 MB",
          enterprise: "Custom",
        },
      },
    ],
  },
  {
    id: "security",
    title: "Bảo mật",
    features: [
      {
        title: "SAML",
        description: "Dùng tích hợp SAML chính thức để bảo mật Plane với mọi nhà cung cấp danh tính.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "OIDC",
        description: "Dùng tích hợp OIDC chính thức để bảo mật Plane với mọi nhà cung cấp danh tính.",
        selfHostedOnly: true,
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Bảo mật tên miền",
        description: "Chọn các tên miền được phép đăng nhập vào Plane hoặc chỉ cho phép một tên miền.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Xác thực hai yếu tố và khóa truy cập",
        description: "Bảo vệ không gian làm việc bằng xác thực hai yếu tố và khóa truy cập.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Chính sách mật khẩu",
        description: "Đặt chính sách mật khẩu phù hợp yêu cầu tuân thủ.",
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "LDAP",
        description: "Dùng tích hợp LDAP chính thức để bảo mật Plane bằng máy chủ LDAP của bạn.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: false,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "self-hosted",
    title: "Tự lưu trữ",
    selfHostedOnly: true,
    features: [
      {
        title: "Chế độ quản trị",
        description: "Quản lý máy chủ Plane tự lưu trữ qua giao diện quản trị.",
        cloud: {
          free: true,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Triển khai một bước",
        description: "Cài đặt và triển khai Plane trên đám mây riêng bằng một lệnh.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Ứng dụng DigitalOcean Marketplace",
        description: "Cài ứng dụng Plane tương thích DigitalOcean từ Marketplace.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Ứng dụng Heroku",
        description: "Cài ứng dụng Plane tương thích Heroku và triển khai dễ dàng.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "AWS AMI",
        description: "Cài ứng dụng tương thích AMI từ AWS Marketplace.",
        cloud: {
          free: false,
          one: true,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
      {
        title: "Triển khai riêng",
        description: "Sử dụng Plane Cloud trên đám mây riêng do Plane quản lý.",
        comingSoon: true,
        cloud: {
          free: false,
          one: false,
          pro: false,
          business: false,
          enterprise: true,
        },
      },
    ],
  },
  {
    id: "support",
    title: "Hỗ trợ",
    features: [
      {
        title: "Kênh hỗ trợ",
        description: "Truy cập các kênh hỗ trợ theo gói của bạn.",
        cloud: {
          free: (
            <>
              <ForumIcon className="size-4" />
            </>
          ),
          one: (
            <div className="flex items-center gap-1">
              <MailOutline className="size-4 flex-shrink-0" />
              <ForumIcon className="size-4 flex-shrink-0" />
            </div>
          ),
          pro: (
            <div className="flex items-center gap-1">
              <MailOutline className="size-4 flex-shrink-0" />
              <ForumIcon className="size-4 flex-shrink-0" />
              <ChatOutline className="size-4 flex-shrink-0" />
            </div>
          ),
          business: "Full-suite\nprofessional services",
          enterprise: "Full-suite\nprofessional services",
        },
      },
      {
        title: "SLA",
        description: (
          <>
            Get business-friendly SLAs with higher plans. SLAs are by priority of work item and tiers{" "}
            <a href="https://plane.so/talk-to-sales" target="_blank" rel="noopener noreferrer" className="underline">
              can be requested
            </a>
            .
          </>
        ),
        cloud: {
          free: false,
          one: false,
          pro: true,
          business: true,
          enterprise: true,
        },
      },
    ],
  },
];

export const PLANE_PLANS: PlanePlans = {
  planDetails: {
    free: {
      id: EProductSubscriptionEnum.FREE,
      name: "Free",
      monthlyPrice: 0,
      yearlyPrice: 0,
      isActive: true,
    },
    one: {
      id: EProductSubscriptionEnum.ONE,
      name: "One",
      monthlyPrice: 799,
      yearlyPrice: 799,
      monthlyPriceSecondaryDescription: "per workspace",
      yearlyPriceSecondaryDescription: "per workspace",
      buttonCTA: "Upgrade",
      isActive: false,
    },
    pro: {
      id: EProductSubscriptionEnum.PRO,
      name: "Pro",
      monthlyPrice: 8,
      yearlyPrice: 6,
      monthlyPriceSecondaryDescription: "billed monthly",
      yearlyPriceSecondaryDescription: "billed yearly",
      buttonCTA: "Upgrade",
      isActive: true,
    },
    business: {
      id: EProductSubscriptionEnum.BUSINESS,
      name: "Business",
      monthlyPriceSecondaryDescription: "billed monthly",
      yearlyPriceSecondaryDescription: "billed yearly",
      buttonCTA: "Talk to Sales",
      isActive: false,
    },
    enterprise: {
      id: EProductSubscriptionEnum.ENTERPRISE,
      name: "Enterprise",
      monthlyPriceSecondaryDescription: "billed monthly",
      yearlyPriceSecondaryDescription: "billed yearly",
      buttonCTA: "Talk to Sales",
      isActive: false,
    },
  },
  planHighlights: {
    free: ["Upto 12 users", "Pages", "Unlimited projects", "Unlimited cycles and modules"],
    one: ["Upto 50 users", "OIDC and SAML", "Active cycles", "Limited time tracking"],
    pro: ["Unlimited users", "Custom work items + Properties", "Work item templates", "Full Time Tracking"],
    business: ["RBAC", "Project Templates", "Baselines And Deviations", "Custom Reports"],
    enterprise: ["Private + managed deployments", "GAC", "LDAP support", "Databases + Formulas"],
  },
  planComparison: PLANS_COMPARISON_LIST,
};
