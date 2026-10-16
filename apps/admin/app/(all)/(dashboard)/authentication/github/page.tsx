/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useTheme } from "next-themes";
import useSWR from "swr";
// plane internal packages
import { Switch } from "@makeplane/propel/components/switch";
import { resolveGeneralTheme } from "@plane/utils";
// assets
import githubLightModeImage from "@/app/assets/logos/github-black.png?url";
import githubDarkModeImage from "@/app/assets/logos/github-white.png?url";
// components
import { AuthenticationMethodCard } from "@/components/authentication/authentication-method-card";
import { PageWrapper } from "@/components/common/page-wrapper";
import { Skeleton } from "@/components/common/skeleton";
import { setPromiseToast } from "@plane/blocks/toast";
// hooks
import { useInstance } from "@/hooks/store";
// types
import type { Route } from "./+types/page";
// local
import { InstanceGithubConfigForm } from "./form";

const InstanceGithubAuthenticationPage = observer(function InstanceGithubAuthenticationPage(
  _props: Route.ComponentProps
) {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // theme
  const { resolvedTheme } = useTheme();
  // config
  const enableGithubConfig = formattedConfig?.IS_GITHUB_ENABLED ?? "";

  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_GITHUB_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "Đang lưu cấu hình",
      success: {
        title: "Đã lưu cấu hình",
        message: () => `Xác thực GitHub hiện ${value === "1" ? "đang bật" : "đã tắt"}.`,
      },
      error: {
        title: "Lỗi",
        message: () => "Không thể lưu cấu hình",
      },
    });

    await updateConfigPromise
      .then(() => {
        setIsSubmitting(false);
      })
      .catch((err) => {
        console.error(err);
        setIsSubmitting(false);
      });
  };

  const isGithubEnabled = enableGithubConfig === "1";

  return (
    <PageWrapper
      customHeader={
        <AuthenticationMethodCard
          name="GitHub"
          description="Cho phép thành viên đăng nhập hoặc đăng ký Plane bằng tài khoản GitHub."
          icon={
            <img
              src={resolveGeneralTheme(resolvedTheme) === "dark" ? githubDarkModeImage : githubLightModeImage}
              height={24}
              width={24}
              alt="GitHub Logo"
            />
          }
          config={
            <Switch
              aria-label="Bật xác thực GitHub"
              checked={isGithubEnabled}
              onCheckedChange={() => {
                updateConfig("IS_GITHUB_ENABLED", isGithubEnabled ? "0" : "1");
              }}
              size="sm"
              disabled={isSubmitting || !formattedConfig}
            />
          }
          disabled={isSubmitting || !formattedConfig}
          withBorder={false}
        />
      }
    >
      {formattedConfig ? (
        <InstanceGithubConfigForm config={formattedConfig} />
      ) : (
        <Skeleton className="space-y-8">
          <Skeleton.Item height="50px" width="25%" />
          <Skeleton.Item height="50px" />
          <Skeleton.Item height="50px" />
          <Skeleton.Item height="50px" />
          <Skeleton.Item height="50px" width="50%" />
        </Skeleton>
      )}
    </PageWrapper>
  );
});

export const meta: Route.MetaFunction = () => [{ title: "GitHub Authentication - God Mode" }];

export default InstanceGithubAuthenticationPage;
