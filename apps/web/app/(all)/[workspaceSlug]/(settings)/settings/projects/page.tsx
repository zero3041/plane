/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import Link from "next/link";
import { useTheme } from "next-themes";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { Button as ButtonElement } from "@makeplane/propel/elements/button";
// assets
import ProjectDarkEmptyState from "@/app/assets/empty-state/project-settings/no-projects-dark.png?url";
import ProjectLightEmptyState from "@/app/assets/empty-state/project-settings/no-projects-light.png?url";
// hooks
import { useCommandPalette } from "@/hooks/store/use-command-palette";

function ProjectSettingsPage() {
  // store hooks
  const { resolvedTheme } = useTheme();
  const { toggleCreateProjectModal } = useCommandPalette();
  // derived values
  const resolvedPath = resolvedTheme === "dark" ? ProjectDarkEmptyState : ProjectLightEmptyState;
  return (
    <div className="mx-auto flex h-full max-w-[480px] flex-col items-center justify-center gap-4">
      <img src={resolvedPath} alt="Chưa có dự án nào" />
      <div className="text-16 font-semibold text-tertiary">Chưa có dự án nào</div>
      <div className="text-center text-13 text-tertiary">
        Dự án là nơi bạn tổ chức mục tiêu, thành viên và công việc để cùng hoàn thành kế hoạch.
      </div>
      <div className="flex gap-2">
        <ButtonElement
          variant="secondary"
          size="sm"
          stretch="auto"
          render={<Link href="https://plane.so/" target="_blank" />}
        >
          Tìm hiểu thêm về dự án
        </ButtonElement>
        <Button
          variant="primary"
          size="sm"
          stretch="auto"
          label="Tạo dự án đầu tiên"
          onClick={() => toggleCreateProjectModal(true)}
        />
      </div>
    </div>
  );
}

export default observer(ProjectSettingsPage);
