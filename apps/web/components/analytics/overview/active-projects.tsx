/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import React from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import useSWR from "swr";
// plane package imports
import { useTranslation } from "@plane/i18n";
import { Loader } from "@plane/blocks/skeleton";
// plane web hooks
import { useAnalytics } from "@/hooks/store/use-analytics";
import { useProject } from "@/hooks/store/use-project";
// plane web components
import AnalyticsSectionWrapper from "../analytics-section-wrapper";
import ActiveProjectItem from "./active-project-item";

const PROJECT_LOADING_KEYS = [
  "project-loading-1",
  "project-loading-2",
  "project-loading-3",
  "project-loading-4",
  "project-loading-5",
];

const ActiveProjects = observer(function ActiveProjects() {
  const { t } = useTranslation();
  const { fetchProjectAnalyticsCount } = useProject();
  const { workspaceSlug } = useParams();
  const { selectedDurationI18nKey } = useAnalytics();
  const { data: projectAnalyticsCount, isLoading: isProjectAnalyticsCountLoading } = useSWR(
    workspaceSlug ? ["projectAnalyticsCount", workspaceSlug] : null,
    workspaceSlug
      ? () =>
          fetchProjectAnalyticsCount(workspaceSlug.toString(), {
            fields: "total_work_items,total_completed_work_items",
          })
      : null
  );
  return (
    <AnalyticsSectionWrapper
      title={`${t("workspace_analytics.active_projects")}`}
      subtitle={selectedDurationI18nKey ? t(selectedDurationI18nKey) : undefined}
      className="md:col-span-2"
    >
      <div className="flex h-[350px] flex-col gap-4 overflow-auto">
        {isProjectAnalyticsCountLoading &&
          PROJECT_LOADING_KEYS.map((key) => <Loader.Item key={key} height="40px" width="100%" />)}
        {!isProjectAnalyticsCountLoading &&
          projectAnalyticsCount?.map((project) => <ActiveProjectItem key={project.id} project={project} />)}
      </div>
    </AnalyticsSectionWrapper>
  );
});

export default ActiveProjects;
