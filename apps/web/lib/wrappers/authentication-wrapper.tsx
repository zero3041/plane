/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect } from "react";
import type { ReactNode } from "react";
import { observer } from "mobx-react";
import { useSearchParams, usePathname } from "next/navigation";
import useSWR from "swr";
// plane imports
import { Button } from "@makeplane/propel/components/button";
import { useTranslation } from "@plane/i18n";
import { isValidNextPath } from "@plane/utils";
// components
import { LogoSpinner } from "@/components/common/logo-spinner";
// helpers
import { EPageTypes } from "@/helpers/authentication.helper";
// hooks
import { useWorkspace } from "@/hooks/store/use-workspace";
import { useUser, useUserProfile } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

type TAuthenticationWrapper = {
  children: ReactNode;
  pageType?: EPageTypes;
  unauthenticatedFallback?: ReactNode;
};

// Normalize dot segments and trailing slashes when checking for self-redirects.
const getPathname = (path: string): string => new URL(path, "http://localhost").pathname.replace(/\/+$/, "") || "/";

export const AuthenticationWrapper = observer(function AuthenticationWrapper(props: TAuthenticationWrapper) {
  const pathname = usePathname();
  const router = useAppRouter();
  const searchParams = useSearchParams();
  const { t } = useTranslation();
  const { children, pageType = EPageTypes.AUTHENTICATED, unauthenticatedFallback } = props;
  const { isLoading: isUserLoading, data: currentUser, fetchCurrentUser } = useUser();
  const { data: currentUserProfile, error: profileError, fetchUserProfile } = useUserProfile();
  const { loader: workspacesLoader } = useWorkspace();

  // fetchCurrentUser also hydrates profile, settings, and the user's workspaces.
  const { isLoading: isUserSWRLoading } = useSWR("USER_INFORMATION", () => fetchCurrentUser(), {
    revalidateOnFocus: false,
    shouldRetryOnError: false,
  });
  const { error: profileSWRError } = useSWR(
    currentUser?.id && !currentUserProfile?.id ? ["USER_PROFILE", currentUser.id] : null,
    () => fetchUserProfile(),
    { revalidateOnFocus: false, shouldRetryOnError: false }
  );

  const isUserOnboard = !!(
    currentUserProfile?.is_onboarded ||
    (currentUserProfile?.onboarding_step?.profile_complete &&
      currentUserProfile?.onboarding_step?.workspace_create &&
      currentUserProfile?.onboarding_step?.workspace_invite &&
      currentUserProfile?.onboarding_step?.workspace_join)
  );
  const nextPath = searchParams.get("next_path")?.trim();
  const validNextPath = nextPath && isValidNextPath(nextPath) ? nextPath : undefined;
  const destination = validNextPath && getPathname(validNextPath) !== getPathname(pathname) ? validNextPath : undefined;
  const query = searchParams.toString();
  const currentPath = `${pathname}${query ? `?${query}` : ""}`;
  const isPublicPage = pageType === EPageTypes.PUBLIC;
  const isLoading =
    !isPublicPage &&
    ((!currentUser?.id && (isUserSWRLoading || isUserLoading || workspacesLoader)) ||
      (!!currentUser?.id && !currentUserProfile?.id));
  const hasProfileError = !isPublicPage && !currentUserProfile?.id && !!(profileError || profileSWRError);
  const canRoute = !isPublicPage && !isLoading && !hasProfileError;
  const onboardingDestination = destination || (pageType === EPageTypes.AUTHENTICATED ? currentPath : undefined);
  const onboardingRoute = `/onboarding${onboardingDestination ? `?next_path=${encodeURIComponent(onboardingDestination)}` : ""}`;

  let redirectTo: string | undefined;
  if (canRoute) {
    if (!currentUser?.id) {
      if (pageType !== EPageTypes.HOME && pageType !== EPageTypes.NON_AUTHENTICATED) {
        redirectTo = `/?next_path=${encodeURIComponent(destination || currentPath)}`;
      }
    } else if (pageType === EPageTypes.ONBOARDING) {
      if (isUserOnboard) redirectTo = destination || "/";
    } else if (pageType === EPageTypes.SET_PASSWORD) {
      if (!currentUser.is_password_autoset && isUserOnboard) redirectTo = destination || "/";
    } else if (!isUserOnboard) {
      redirectTo = onboardingRoute;
    } else if (pageType === EPageTypes.HOME) {
      redirectTo = destination;
    } else if (pageType === EPageTypes.NON_AUTHENTICATED) {
      redirectTo = destination || "/";
    }
  }

  useEffect(() => {
    if (redirectTo) router.replace(redirectTo);
  }, [redirectTo, router]);

  if (hasProfileError)
    return (
      <div role="alert" className="flex h-screen w-full flex-col items-center justify-center gap-3">
        <p className="text-14 text-secondary">{t("something_went_wrong")}</p>
        <Button
          variant="secondary"
          size="xs"
          stretch="auto"
          label={t("common.retry")}
          onClick={() => router.refresh()}
        />
      </div>
    );

  if (isLoading || redirectTo)
    return (
      <div className="relative flex h-screen w-full items-center justify-center">
        <LogoSpinner />
      </div>
    );

  if (pageType === EPageTypes.HOME && !currentUser?.id) return <>{unauthenticatedFallback}</>;

  return <>{children}</>;
});
