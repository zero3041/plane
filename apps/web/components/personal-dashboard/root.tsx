/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import Link from "next/link";
import { usePathname, useSearchParams } from "next/navigation";
import { useNavigate } from "react-router";
import useSWR from "swr";
import { Avatar } from "@makeplane/propel/components/avatar";
import { Button } from "@makeplane/propel/components/button";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { Switch } from "@makeplane/propel/components/switch";
import { CalendarOutline, PauseOutline, PriorityUrgent, WarningTriangleOutline } from "@makeplane/propel/icons";
import { PlaneLockup } from "@plane/blocks/icons";
import { useTranslation } from "@plane/i18n";
import type {
  IPersonalDashboardSavedView,
  TIssuePriorities,
  TPersonalDashboardDateRange,
  TPersonalDashboardSortField,
} from "@plane/types";
import { getFileURL, orderWorkspacesList } from "@plane/utils";
import { PageHead } from "@/components/core/page-title";
import { WorkspaceLogo } from "@/components/workspace/logo";
import { useUser } from "@/hooks/store/user";
import { useWorkspace } from "@/hooks/store/use-workspace";
import { UserService } from "@/services/user.service";
import {
  buildDashboardFilterUrl,
  DEFAULT_DASHBOARD_COLUMNS,
  formatDashboardDate,
  getDashboardFilters,
  getPersonalDashboardKey,
  getPersonalDashboardViewsKey,
  type TDashboardFilters,
  type TDashboardFilterUpdates,
} from "./helpers";
import { PersonalDashboardColumnSelector } from "./column-selector";
import { PersonalDashboardOverview } from "./overview";
import { PersonalDashboardSavedViewsControl } from "./saved-views-control";
import { PersonalTaskList } from "./task-list";

const userService = new UserService();
const BUCKETS = [
  {
    key: "blocked_or_paused",
    label: "home.personal_dashboard.blocked_or_paused",
    icon: PauseOutline,
    tone: "text-warning-primary",
    surface: "bg-warning-subtle",
  },
  {
    key: "high_priority",
    label: "home.personal_dashboard.high_priority",
    icon: PriorityUrgent,
    tone: "text-priority-high",
    surface: "bg-layer-1",
  },
  {
    key: "upcoming",
    label: "home.personal_dashboard.upcoming",
    icon: CalendarOutline,
    tone: "text-accent-primary",
    surface: "bg-accent-subtle",
  },
  {
    key: "overdue",
    label: "home.personal_dashboard.overdue",
    icon: WarningTriangleOutline,
    tone: "text-danger-primary",
    surface: "bg-danger-subtle",
  },
] as const;
const SECONDARY_BUCKETS = [
  { key: "all", label: "home.personal_dashboard.all_open" },
  { key: "all_items", label: "home.personal_dashboard.all_items" },
  { key: "in_progress", label: "home.personal_dashboard.in_progress" },
  { key: "today", label: "home.personal_dashboard.due_today" },
  { key: "completed", label: "home.personal_dashboard.completed" },
  { key: "cancelled", label: "home.personal_dashboard.cancelled" },
] as const;
const PRIORITIES: TIssuePriorities[] = ["urgent", "high", "medium", "low", "none"];
const DUE_RANGES: TPersonalDashboardDateRange[] = ["all", "today", "overdue", "next_7", "next_30", "no_due"];
const PERSONAL_DASHBOARD_PAGE_SIZE = 10;

export const PersonalDashboard = observer(function PersonalDashboard() {
  const { data: user } = useUser();
  const { workspaces } = useWorkspace();
  const { t, currentLocale } = useTranslation();
  const navigate = useNavigate();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filters = getDashboardFilters(new URLSearchParams(searchParams.toString()));
  const { bucket, workspace_slug: workspaceSlug, project_id: projectId } = filters;
  const { data: savedViews = [], mutate: mutateSavedViews } = useSWR(
    getPersonalDashboardViewsKey(user?.id),
    () => userService.getPersonalDashboardViews(),
    { revalidateOnFocus: true }
  );
  const selectedView = savedViews.find((view) => view.id === filters.saved_view_id);
  const [cursors, setCursors] = useState<(string | null)[]>([null]);
  const cursor = cursors[cursors.length - 1];
  const dashboardFilters: TDashboardFilters = filters;
  const { data, error, isLoading, mutate } = useSWR(
    getPersonalDashboardKey(user?.id, dashboardFilters, cursor),
    () =>
      userService.getPersonalIssues({
        bucket,
        workspace_slug: workspaceSlug || undefined,
        project_id: projectId || undefined,
        state_id: filters.state_id || undefined,
        priority: filters.priority || undefined,
        assignee_id: filters.assignee_id || undefined,
        due_range: filters.due_range,
        include_sub_issues: filters.include_sub_issues,
        sort_by: filters.sort_by,
        sort_direction: filters.sort_direction,
        cursor: cursor ?? undefined,
        per_page: PERSONAL_DASHBOARD_PAGE_SIZE,
      }),
    { revalidateOnFocus: true, keepPreviousData: true }
  );
  const availableWorkspaces = orderWorkspacesList(Object.values(workspaces));
  const userName = user?.display_name || user?.first_name || t("common.your_profile");
  const workspaceOptions = [
    { value: "", label: t("home.personal_dashboard.all_workspaces") },
    ...availableWorkspaces.map((workspace) => ({ value: workspace.slug, label: workspace.name })),
  ];
  const projectOptions = [
    { value: "", label: t("all_projects") },
    ...(data?.project_options ?? []).map((project) => ({
      value: project.id,
      label: `${project.workspace_name} · ${project.identifier} ${project.name}`,
    })),
  ];
  const changeFilters = (updates: TDashboardFilterUpdates) => {
    setCursors([null]);
    navigate(buildDashboardFilterUrl(pathname, new URLSearchParams(searchParams.toString()), updates), {
      replace: true,
      preventScrollReset: true,
    });
  };
  const applySavedView = (view: IPersonalDashboardSavedView | null) => {
    if (!view) {
      changeFilters({ saved_view_id: "" });
      return;
    }
    changeFilters({
      bucket: view.filters.bucket ?? "all",
      workspace_slug: view.filters.workspace_slug ?? "",
      project_id: view.filters.project_id ?? "",
      state_id: view.filters.state_id ?? "",
      priority: view.filters.priority ?? "",
      assignee_id: view.filters.assignee_id ?? "",
      due_range: view.filters.due_range ?? "all",
      include_sub_issues: String(view.filters.include_sub_issues ?? true),
      columns: view.columns,
      sort_by: view.sort_by,
      sort_direction: view.sort_direction,
      saved_view_id: view.id,
    });
  };
  const changeSort = (sortBy: TPersonalDashboardSortField) => {
    changeFilters({
      sort_by: sortBy,
      sort_direction: filters.sort_by === sortBy && filters.sort_direction === "asc" ? "desc" : "asc",
    });
  };
  const stateOptions = [
    { value: "", label: t("home.personal_dashboard.all_states") },
    ...(data?.filter_options.states ?? []).map((state) => ({ value: state.id, label: state.name })),
  ];
  const assigneeOptions = [
    { value: "", label: t("home.personal_dashboard.all_assignees") },
    { value: "unassigned", label: t("home.personal_dashboard.unassigned") },
    ...(data?.filter_options.assignees ?? []).map((assignee) => ({ value: assignee.id, label: assignee.display_name })),
  ];
  const priorityOptions = [
    { value: "", label: t("home.personal_dashboard.all_priorities") },
    ...PRIORITIES.map((priority) => ({ value: priority, label: t(`home.personal_dashboard.priority_${priority}`) })),
  ];
  const dueRangeOptions = DUE_RANGES.map((range) => ({
    value: range,
    label: t(`home.personal_dashboard.range_${range}`),
  }));

  return (
    <div className="h-screen overflow-y-auto bg-surface-1 text-primary">
      <PageHead title={t("home.personal_dashboard.global_title")} />
      <header className="sticky top-0 z-10 border-b border-subtle bg-surface-1">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-4 px-5 md:px-8">
          <Link
            href="/"
            aria-label={t("home.personal_dashboard.global_title")}
            className="rounded focus-visible:outline-2 focus-visible:outline-offset-4"
          >
            <PlaneLockup className="h-6 w-auto" />
          </Link>
          <div className="flex items-center gap-2 sm:gap-4">
            <Link
              href="/dntt/manage/"
              className="rounded-md px-3 py-2 text-body-xs-medium text-secondary transition-colors hover:bg-layer-1 hover:text-primary focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              {t("home.dntt.nav_link")}
            </Link>
            <Link
              href="/settings/profile/general/"
              className="flex min-w-0 items-center gap-2.5 rounded-md px-2 py-1.5 transition-colors hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-offset-2"
            >
              <Avatar
                src={getFileURL(user?.avatar_url ?? "")}
                alt={userName}
                fallback={userName[0]?.toUpperCase()}
                size="sm"
              />
              <span className="max-w-36 truncate text-body-sm-medium text-secondary sm:max-w-52">{userName}</span>
            </Link>
          </div>
        </div>
      </header>
      <main className="mx-auto max-w-7xl space-y-8 px-5 py-7 md:space-y-9 md:px-8 md:py-9">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="space-y-2">
            <h1 className="text-h4-semibold text-primary">{t("home.personal_dashboard.global_title")}</h1>
            <p className="text-body-sm-regular text-tertiary">{t("home.personal_dashboard.global_subtitle")}</p>
          </div>
          {data?.today && (
            <div className="flex shrink-0 items-center gap-2 text-body-xs-medium text-secondary">
              <CalendarOutline className="size-4 text-tertiary" aria-hidden="true" />
              <time dateTime={data.today}>{formatDashboardDate(data.today, currentLocale)}</time>
            </div>
          )}
        </div>
        <div className="grid grid-cols-2 gap-3 lg:grid-cols-4" aria-label={t("home.personal_dashboard.global_title")}>
          {BUCKETS.map((item) => {
            const BucketIcon = item.icon;
            return (
              <button
                key={item.key}
                type="button"
                aria-pressed={bucket === item.key}
                onClick={() => changeFilters({ bucket: item.key })}
                title={item.key === "upcoming" ? t("home.personal_dashboard.upcoming_hint") : undefined}
                className={`group flex min-h-32 flex-col justify-between gap-4 rounded-xl border p-4 text-left transition-colors focus-visible:outline-2 focus-visible:outline-offset-2 md:p-5 ${item.surface} ${bucket === item.key ? "border-accent-strong ring-1 ring-accent-strong" : "border-subtle hover:border-strong"}`}
              >
                <span className="flex w-full items-start justify-between gap-3">
                  <span className="text-body-sm-medium text-secondary">{t(item.label)}</span>
                  <BucketIcon className={`size-5 shrink-0 ${item.tone}`} aria-hidden="true" />
                </span>
                <span className="text-h3-semibold text-primary tabular-nums">
                  {error ? "—" : (data?.counts[item.key] ?? "—")}
                </span>
              </button>
            );
          })}
        </div>
        <PersonalDashboardOverview
          overview={data?.overview}
          states={data?.state_breakdown ?? []}
          projects={data?.project_breakdown ?? []}
          assignees={data?.assignee_workload ?? []}
          isLoading={!data && !error}
        />
        <div className="flex flex-wrap gap-2" aria-label={t("work_items")}>
          {SECONDARY_BUCKETS.map((item) => (
            <button
              key={item.key}
              type="button"
              aria-pressed={bucket === item.key}
              onClick={() => changeFilters({ bucket: item.key })}
              className={`rounded-md border px-3 py-2 text-body-xs-medium focus-visible:outline-2 focus-visible:outline-offset-2 ${bucket === item.key ? "border-accent-strong bg-accent-subtle text-accent-primary" : "border-subtle text-secondary hover:bg-layer-1"}`}
            >
              {t(item.label)}
            </button>
          ))}
        </div>
        <section className="overflow-hidden rounded-xl border border-subtle bg-surface-1" aria-label={t("work_items")}>
          <div className="flex flex-col gap-3 border-b border-subtle px-4 py-4 sm:flex-row sm:items-center sm:justify-between md:px-5">
            <div className="flex min-w-0 items-center gap-2">
              <h2 className="text-body-md-medium text-primary">
                {t([...BUCKETS, ...SECONDARY_BUCKETS].find((item) => item.key === bucket)!.label)}
              </h2>
              {data && !error && (
                <span className="rounded bg-layer-1 px-2 py-0.5 text-caption-md-medium text-tertiary tabular-nums">
                  {data.total_count}
                </span>
              )}
            </div>
            <div className="flex w-full flex-col gap-2 sm:w-auto">
              <PersonalDashboardSavedViewsControl
                views={savedViews}
                selectedView={selectedView}
                filters={filters}
                onApply={applySavedView}
                onViewsChanged={() => mutateSavedViews()}
              />
              <div className="grid w-full grid-cols-1 gap-2 sm:grid-cols-2 lg:grid-cols-3">
                <div className="w-full sm:w-60">
                  <Select<string>
                    value={workspaceSlug}
                    onValueChange={(nextValue) => {
                      changeFilters({ workspace_slug: nextValue ?? "", project_id: "" });
                    }}
                    items={workspaceOptions}
                  >
                    <SelectTrigger size="lg" aria-label={t("home.personal_dashboard.workspaces")} />
                    <SelectContent side="bottom" align="end">
                      <SelectList>
                        {workspaceOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} size="lg" label={option.label} />
                        ))}
                      </SelectList>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-80">
                  <Select<string>
                    value={projectId}
                    onValueChange={(nextValue) => {
                      changeFilters({ project_id: nextValue ?? "" });
                    }}
                    items={projectOptions}
                  >
                    <SelectTrigger size="lg" aria-label={t("projects")} />
                    <SelectContent side="bottom" align="end">
                      <SelectList>
                        {projectOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} size="lg" label={option.label} />
                        ))}
                      </SelectList>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-60">
                  <Select<string>
                    value={filters.state_id}
                    onValueChange={(nextValue) => changeFilters({ state_id: nextValue ?? "" })}
                    items={stateOptions}
                  >
                    <SelectTrigger size="lg" aria-label={t("home.personal_dashboard.state_filter")} />
                    <SelectContent side="bottom" align="end">
                      <SelectList>
                        {stateOptions.map((option) => (
                          <SelectItem
                            key={option.value || "all-states"}
                            value={option.value}
                            size="lg"
                            label={option.label}
                          />
                        ))}
                      </SelectList>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-60">
                  <Select<string>
                    value={filters.assignee_id}
                    onValueChange={(nextValue) => changeFilters({ assignee_id: nextValue ?? "" })}
                    items={assigneeOptions}
                  >
                    <SelectTrigger size="lg" aria-label={t("home.personal_dashboard.assignee_filter")} />
                    <SelectContent side="bottom" align="end">
                      <SelectList>
                        {assigneeOptions.map((option) => (
                          <SelectItem
                            key={option.value || "all-assignees"}
                            value={option.value}
                            size="lg"
                            label={option.label}
                          />
                        ))}
                      </SelectList>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-60">
                  <Select<string>
                    value={filters.priority}
                    onValueChange={(nextValue) => changeFilters({ priority: nextValue ?? "" })}
                    items={priorityOptions}
                  >
                    <SelectTrigger size="lg" aria-label={t("home.personal_dashboard.priority_filter")} />
                    <SelectContent side="bottom" align="end">
                      <SelectList>
                        {priorityOptions.map((option) => (
                          <SelectItem
                            key={option.value || "all-priorities"}
                            value={option.value}
                            size="lg"
                            label={option.label}
                          />
                        ))}
                      </SelectList>
                    </SelectContent>
                  </Select>
                </div>
                <div className="w-full sm:w-60">
                  <Select<TPersonalDashboardDateRange>
                    value={filters.due_range}
                    onValueChange={(nextValue) => nextValue && changeFilters({ due_range: nextValue })}
                    items={dueRangeOptions}
                  >
                    <SelectTrigger size="lg" aria-label={t("home.personal_dashboard.due_range_filter")} />
                    <SelectContent side="bottom" align="end">
                      <SelectList>
                        {dueRangeOptions.map((option) => (
                          <SelectItem key={option.value} value={option.value} size="lg" label={option.label} />
                        ))}
                      </SelectList>
                    </SelectContent>
                  </Select>
                </div>
                <div className="flex min-h-10 items-center justify-between gap-3 rounded-md border border-subtle px-3">
                  <span className="text-body-xs-medium text-secondary">
                    {t("home.personal_dashboard.include_sub_issues")}
                  </span>
                  <Switch
                    size="sm"
                    checked={filters.include_sub_issues}
                    onCheckedChange={(checked) => changeFilters({ include_sub_issues: String(checked) })}
                    aria-label={t("home.personal_dashboard.include_sub_issues")}
                  />
                </div>
                <PersonalDashboardColumnSelector
                  columns={filters.columns}
                  onChange={(columns) => changeFilters({ columns })}
                />
                <div className="flex items-center justify-between gap-3 sm:col-span-2 lg:col-span-3">
                  <span className="text-body-xs-regular text-tertiary">
                    {t("home.personal_dashboard.quick_filters")}
                  </span>
                  <Button
                    variant="tertiary"
                    size="sm"
                    stretch="auto"
                    label={t("home.personal_dashboard.clear_filters")}
                    onClick={() =>
                      changeFilters({
                        bucket: "all",
                        saved_view_id: "",
                        workspace_slug: "",
                        project_id: "",
                        state_id: "",
                        priority: "",
                        assignee_id: "",
                        due_range: "all",
                        include_sub_issues: "true",
                        columns: DEFAULT_DASHBOARD_COLUMNS,
                        sort_by: "due_date",
                        sort_direction: "asc",
                      })
                    }
                  />
                </div>
              </div>
            </div>
          </div>
          {error ? (
            <div role="alert" className="flex flex-col items-center gap-4 px-5 py-12 text-center">
              <WarningTriangleOutline className="size-7 text-tertiary" aria-hidden="true" />
              <p className="text-body-sm-regular text-secondary">{t("home.personal_dashboard.load_error")}</p>
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("common.retry")}
                onClick={() => void mutate()}
              />
            </div>
          ) : (
            <PersonalTaskList
              issues={data?.results ?? []}
              isLoading={isLoading && !data}
              today={data?.today}
              columns={filters.columns}
              sortBy={filters.sort_by}
              sortDirection={filters.sort_direction}
              onSort={changeSort}
            />
          )}
          {!error && data && (cursors.length > 1 || data.next_page_results) && (
            <div className="flex justify-end gap-2 border-t border-subtle px-4 py-3 md:px-5">
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("prev")}
                disabled={cursors.length === 1 || isLoading}
                onClick={() => setCursors((values) => values.slice(0, -1))}
              />
              <Button
                variant="secondary"
                size="sm"
                stretch="auto"
                label={t("next")}
                disabled={!data.next_cursor || !data.next_page_results || isLoading}
                onClick={() => {
                  if (data.next_cursor) setCursors((values) => [...values, data.next_cursor]);
                }}
              />
            </div>
          )}
        </section>
        <section aria-labelledby="personal-workspaces-title" className="space-y-4 pb-6">
          <h2 id="personal-workspaces-title" className="text-body-md-medium text-primary">
            {t("home.personal_dashboard.workspaces")}
          </h2>
          {availableWorkspaces.length === 0 ? (
            <div className="space-y-3 rounded-xl border border-dashed border-subtle p-6 text-body-sm-regular text-secondary">
              <p>{t("home.personal_dashboard.no_workspaces")}</p>
              <div className="flex flex-wrap gap-4">
                <Link href="/invitations/" className="text-accent-primary hover:underline">
                  {t("invitations")}
                </Link>
                <Link href="/create-workspace/" className="text-accent-primary hover:underline">
                  {t("create_workspace")}
                </Link>
              </div>
            </div>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
              {availableWorkspaces.map((workspace) => (
                <Link
                  key={workspace.id}
                  href={`/${workspace.slug}/`}
                  className="group flex items-center gap-3 rounded-xl border border-subtle p-4 transition-colors hover:border-strong hover:bg-layer-1 focus-visible:outline-2 focus-visible:outline-offset-2 md:p-5"
                >
                  <div className="flex size-10 shrink-0 items-center justify-center rounded-lg bg-layer-1">
                    <WorkspaceLogo logo={workspace.logo_url} name={workspace.name} />
                  </div>
                  <div className="min-w-0 flex-1">
                    <div className="truncate text-body-sm-medium text-primary">{workspace.name}</div>
                    <div className="mt-1 text-body-xs-regular text-tertiary">
                      {t("home.personal_dashboard.open_workspace")}{" "}
                      <span
                        aria-hidden="true"
                        className="inline-block transition-transform group-hover:translate-x-0.5"
                      >
                        →
                      </span>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </section>
      </main>
    </div>
  );
});
