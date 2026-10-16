/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useSearchParams } from "next/navigation";
import useSWR from "swr";
import {
  BoxesOutline,
  CloseOutline,
  ShareAltOutline,
  StarOutline,
  TickOutline,
  UserOutline,
} from "@makeplane/propel/icons";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
import { EmptySpace, EmptySpaceItem } from "@/components/ui/empty-space";
// constants
import { WORKSPACE_INVITATION } from "@plane/constants";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useUser } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";
// wrappers
import { AuthenticationWrapper } from "@/lib/wrappers/authentication-wrapper";
import { WorkspaceService } from "@/services/workspace.service";
// services

// service initialization
const workspaceService = new WorkspaceService();

function WorkspaceInvitationPage() {
  // router
  const router = useAppRouter();
  // query params
  const searchParams = useSearchParams();
  const invitation_id = searchParams.get("invitation_id");
  const slug = searchParams.get("slug");
  const token = searchParams.get("token");
  // store hooks
  const { data: currentUser } = useUser();

  const { data: invitationDetail, error } = useSWR(
    invitation_id && slug && WORKSPACE_INVITATION(invitation_id.toString()),
    invitation_id && slug
      ? () => workspaceService.getWorkspaceInvitation(slug.toString(), invitation_id.toString())
      : null
  );

  const handleAccept = () => {
    if (!invitationDetail) return;
    workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: true,
        token: token,
      })
      .then(() => {
        if (invitationDetail.email === currentUser?.email) {
          router.push(`/${invitationDetail.workspace.slug}`);
        } else {
          router.push("/");
        }
      })
      .catch((err: unknown) => console.error(err));
  };

  const handleReject = () => {
    if (!invitationDetail || !token) return;
    void workspaceService
      .joinWorkspace(invitationDetail.workspace.slug, invitationDetail.id, {
        accepted: false,
        token: token,
      })
      .then(() => {
        router.push("/");
      })
      .catch((err: unknown) => console.error(err));
  };

  return (
    <AuthenticationWrapper pageType={EPageTypes.PUBLIC}>
      <div className="flex h-full w-full flex-col items-center justify-center px-3">
        {invitationDetail && !invitationDetail.responded_at ? (
          error ? (
            <div className="shadow-2xl flex w-full flex-col space-y-4 rounded-sm border border-subtle bg-surface-1 px-4 py-8 text-center md:w-1/3">
              <h2 className="text-18 uppercase">KHÔNG TÌM THẤY LỜI MỜI</h2>
            </div>
          ) : (
            <EmptySpace
              title={`Bạn được mời vào ${invitationDetail.workspace.name}`}
              description="Trong không gian làm việc, bạn có thể tạo dự án, cộng tác và sắp xếp các công việc."
            >
              <EmptySpaceItem Icon={TickOutline} title="Chấp nhận" action={handleAccept} />
              <EmptySpaceItem Icon={CloseOutline} title="Bỏ qua" action={handleReject} />
            </EmptySpace>
          )
        ) : error || invitationDetail?.responded_at ? (
          invitationDetail?.accepted ? (
            <EmptySpace
              title={`Bạn đã là thành viên của ${invitationDetail.workspace.name}`}
              description="Trong không gian làm việc, bạn có thể tạo dự án, cộng tác và sắp xếp các công việc."
            >
              <EmptySpaceItem Icon={BoxesOutline} title="Về trang chủ" href="/" />
            </EmptySpace>
          ) : (
            <EmptySpace
              title="Liên kết mời này không còn hiệu lực."
              description="Trong không gian làm việc, bạn có thể tạo dự án, cộng tác và sắp xếp các công việc."
              link={{ text: "Hoặc bắt đầu với dự án mới", href: "/" }}
            >
              {!currentUser ? (
                <EmptySpaceItem Icon={UserOutline} title="Đăng nhập để tiếp tục" href="/" />
              ) : (
                <EmptySpaceItem Icon={BoxesOutline} title="Về trang chủ" href="/" />
              )}
              <EmptySpaceItem Icon={StarOutline} title="Ủng hộ Plane trên GitHub" href="https://github.com/makeplane" />
              <EmptySpaceItem Icon={ShareAltOutline} title="Tham gia cộng đồng Plane" href="https://forum.plane.so" />
            </EmptySpace>
          )
        ) : (
          <div className="flex h-full w-full items-center justify-center">
            <LogoSpinner />
          </div>
        )}
      </div>
    </AuthenticationWrapper>
  );
}

export default observer(WorkspaceInvitationPage);
