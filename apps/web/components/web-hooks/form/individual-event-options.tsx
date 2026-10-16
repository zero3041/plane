/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { Control } from "react-hook-form";
import { Controller } from "react-hook-form";
import { CheckboxField } from "@makeplane/propel/components/checkbox-field";
import { useTranslation } from "@plane/i18n";
import type { IWebhook } from "@plane/types";

export const INDIVIDUAL_WEBHOOK_OPTIONS: ({
  key: keyof IWebhook;
  description: string;
} & ({ labelKey: string } | { label: string }))[] = [
  {
    key: "project",
    labelKey: "projects",
    description: "Dự án được tạo, cập nhật hoặc xóa",
  },
  {
    key: "cycle",
    labelKey: "cycles",
    description: "Chu kỳ được tạo, cập nhật hoặc xóa",
  },
  {
    key: "issue",
    labelKey: "work_items",
    description: "Mục công việc được tạo, cập nhật, xóa hoặc thêm vào chu kỳ hay mô-đun",
  },
  {
    key: "module",
    labelKey: "modules",
    description: "Mô-đun được tạo, cập nhật hoặc xóa",
  },
  {
    key: "issue_comment",
    label: "Bình luận mục công việc",
    description: "Bình luận được đăng, cập nhật hoặc xóa",
  },
];

type Props = {
  control: Control<IWebhook, any>;
};

export function WebhookIndividualEventOptions({ control }: Props) {
  const { t } = useTranslation();
  return (
    <div className="grid grid-cols-1 gap-x-4 gap-y-8 px-6 lg:grid-cols-2">
      {INDIVIDUAL_WEBHOOK_OPTIONS.map((option) => (
        <Controller
          key={option.key}
          control={control}
          name={option.key}
          render={({ field: { onChange, value } }) => (
            <CheckboxField
              name={option.key}
              label={"labelKey" in option ? t(option.labelKey) : option.label}
              size="lg"
              description={option.description}
              stretch="full"
              checked={value === true}
              onCheckedChange={onChange}
            />
          )}
        />
      ))}
    </div>
  );
}
