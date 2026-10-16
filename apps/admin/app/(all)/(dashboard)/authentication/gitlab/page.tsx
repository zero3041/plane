/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import useSWR from "swr";
import { Switch } from "@makeplane/propel/components/switch";
// assets
import GitlabLogo from "@/app/assets/logos/gitlab-logo.svg?url";
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
import { InstanceGitlabConfigForm } from "./form";

const InstanceGitlabAuthenticationPage = observer(function InstanceGitlabAuthenticationPage(
  _props: Route.ComponentProps
) {
  // store
  const { fetchInstanceConfigurations, formattedConfig, updateInstanceConfigurations } = useInstance();
  // state
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  // config
  const enableGitlabConfig = formattedConfig?.IS_GITLAB_ENABLED ?? "";

  useSWR("INSTANCE_CONFIGURATIONS", () => fetchInstanceConfigurations());

  const updateConfig = async (key: "IS_GITLAB_ENABLED", value: string) => {
    setIsSubmitting(true);

    const payload = {
      [key]: value,
    };

    const updateConfigPromise = updateInstanceConfigurations(payload);

    setPromiseToast(updateConfigPromise, {
      loading: "Đang lưu cấu hình",
      success: {
        title: "Đã lưu cấu hình",
        message: () => `Xác thực GitLab hiện ${value === "1" ? "đang bật" : "đã tắt"}.`,
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
  return (
    <PageWrapper
      customHeader={
        <AuthenticationMethodCard
          name="GitLab"
          description="Cho phép thành viên đăng nhập hoặc đăng ký Plane bằng tài khoản GitLab."
          icon={<img src={GitlabLogo} height={24} width={24} alt="GitLab Logo" />}
          config={
            <Switch
              aria-label="Bật xác thực GitLab"
              checked={Boolean(parseInt(enableGitlabConfig))}
              onCheckedChange={() => {
                if (Boolean(parseInt(enableGitlabConfig)) === true) {
                  updateConfig("IS_GITLAB_ENABLED", "0");
                } else {
                  updateConfig("IS_GITLAB_ENABLED", "1");
                }
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
        <InstanceGitlabConfigForm config={formattedConfig} />
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

export const meta: Route.MetaFunction = () => [{ title: "GitLab Authentication - God Mode" }];

export default InstanceGitlabAuthenticationPage;
