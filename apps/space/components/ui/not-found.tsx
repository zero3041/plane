/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// images
import Image404 from "@/app/assets/404.svg?url";

export function PageNotFound() {
  return (
    <div className={`h-screen w-full overflow-hidden bg-surface-1`}>
      <div className="grid h-full place-items-center p-4">
        <div className="space-y-8 text-center">
          <div className="relative mx-auto h-60 w-60 lg:h-80 lg:w-80">
            <img src={Image404} alt="404 - Không tìm thấy trang" className="h-full w-full object-contain" />
          </div>
          <div className="space-y-2">
            <h3 className="text-16 font-semibold">Rất tiếc! Đã xảy ra lỗi.</h3>
            <p className="text-13 text-secondary">
              Không tìm thấy trang bạn đang tìm. Trang có thể đã bị xóa, đổi tên hoặc tạm thời không khả dụng.
            </p>
          </div>
        </div>
      </div>
    </div>
  );
}
