/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { BrainCog } from "lucide-react";
// plane imports
import { ImageOutline, LockOutline, MailOutline, SettingsOutline, WorkspaceOutline } from "@makeplane/propel/icons";
// types
import type { TSidebarMenuItem } from "./types";

export type TCoreSidebarMenuKey = "general" | "email" | "workspace" | "authentication" | "ai" | "image";

export const coreSidebarMenuLinks: Record<TCoreSidebarMenuKey, TSidebarMenuItem> = {
  general: {
    Icon: SettingsOutline,
    name: "Chung",
    description: "Xem thông tin chính của máy chủ.",
    href: `/general/`,
  },
  email: {
    Icon: MailOutline,
    name: "Email",
    description: "Cấu hình SMTP.",
    href: `/email/`,
  },
  workspace: {
    Icon: WorkspaceOutline,
    name: "Không gian làm việc",
    description: "Quản lý mọi không gian làm việc trên máy chủ.",
    href: `/workspace/`,
  },
  authentication: {
    Icon: LockOutline,
    name: "Xác thực",
    description: "Cấu hình phương thức xác thực.",
    href: `/authentication/`,
  },
  ai: {
    Icon: BrainCog,
    name: "Trí tuệ nhân tạo",
    description: "Cấu hình thông tin OpenAI.",
    href: `/ai/`,
  },
  image: {
    Icon: ImageOutline,
    name: "Hình ảnh trong Plane",
    description: "Cho phép thư viện ảnh bên thứ ba.",
    href: `/image/`,
  },
};
