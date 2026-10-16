/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useTheme } from "next-themes";
import { Button } from "@makeplane/propel/components/button";
// assets
import { AuthHeader } from "@/app/(all)/(home)/auth-header";
import InstanceFailureDarkImage from "@/app/assets/instance/instance-failure-dark.svg?url";
import InstanceFailureImage from "@/app/assets/instance/instance-failure.svg?url";

const handleRetry = () => {
  window.location.reload();
};

export const InstanceFailureView = observer(function InstanceFailureView() {
  const { resolvedTheme } = useTheme();

  const instanceImage = resolvedTheme === "dark" ? InstanceFailureDarkImage : InstanceFailureImage;

  return (
    <>
      <AuthHeader />
      <div className="mt-10 flex w-full flex-grow flex-col items-center justify-center py-6">
        <div className="relative flex w-full max-w-[22.5rem] flex-col gap-6">
          <div className="relative flex flex-col items-center justify-center space-y-4">
            <img src={instanceImage} alt="Instance failure illustration" />
            <h3 className="text-center text-20 font-medium text-on-color">Không thể tải thông tin máy chủ.</h3>
            <p className="text-center text-14 font-medium">
              Không thể tải thông tin máy chủ. Có thể kết nối mạng đang gặp sự cố.
            </p>
          </div>
          <div className="flex justify-center">
            <Button variant="primary" size="md" stretch="auto" onClick={handleRetry} label="Thử lại" />
          </div>
        </div>
      </div>
    </>
  );
});
