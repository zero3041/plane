/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import {
  CalendarOutline,
  PauseOutline,
  SortAscendingOutline,
  SortDescendingOutline,
  WarningTriangleOutline,
} from "@makeplane/propel/icons";
import { EmptyStateCompact } from "@plane/blocks/empty-state";
import { PriorityIcon, StateGroupIcon } from "@plane/blocks/icons";
import { Loader } from "@plane/blocks/skeleton";
import { useTranslation } from "@plane/i18n";
import type {
  IPersonalDashboardIssue,
  TPersonalDashboardColumn,
  TPersonalDashboardSortDirection,
  TPersonalDashboardSortField,
} from "@plane/types";
import { generateWorkItemLink } from "@plane/utils";
import { DataTable } from "@/components/common/data-table";
import type { DataTableColumn } from "@/components/common/data-table";
import { formatDashboardDate, getDashboardDueStatus } from "./helpers";

type Props = {
  issues: IPersonalDashboardIssue[];
  isLoading: boolean;
  today?: string;
  columns: TPersonalDashboardColumn[];
  sortBy: TPersonalDashboardSortField;
  sortDirection: TPersonalDashboardSortDirection;
  onSort: (sortBy: TPersonalDashboardSortField) => void;
};

function TaskState({ issue }: { issue: IPersonalDashboardIssue }) {
  const { t } = useTranslation();
  const kind = issue.state.attention_kind ?? "normal";
  const isAttention = kind === "blocked" || kind === "paused";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-body-xs-regular ${isAttention ? "bg-warning-subtle text-warning-primary" : "bg-layer-1 text-secondary"}`}
    >
      {isAttention ? (
        kind === "paused" ? (
          <PauseOutline className="size-3.5 shrink-0" aria-hidden="true" />
        ) : (
          <WarningTriangleOutline className="size-3.5 shrink-0" aria-hidden="true" />
        )
      ) : (
        <StateGroupIcon stateGroup={issue.state.group} color={issue.state.color} size="sm" />
      )}
      <span>
        {issue.state.name}
        {isAttention && <span className="ml-1">· {t(`home.personal_dashboard.attention_${kind}`)}</span>}
      </span>
    </span>
  );
}

function TaskPriority({ issue }: { issue: IPersonalDashboardIssue }) {
  const { t } = useTranslation();
  const isHighPriority = issue.priority === "urgent" || issue.priority === "high";
  return (
    <span
      className={`inline-flex items-center gap-2 rounded-md px-2 py-1 text-body-xs-medium ${isHighPriority ? "bg-danger-subtle text-danger-primary" : "text-secondary"}`}
    >
      <PriorityIcon priority={issue.priority} className="size-3.5" />
      {t(issue.priority === "none" ? "none" : `issue.priority.${issue.priority}`)}
    </span>
  );
}

function TaskDueDate({ issue, today }: { issue: IPersonalDashboardIssue; today?: string }) {
  const { t, currentLocale } = useTranslation();
  const date = formatDashboardDate(issue.target_date, currentLocale);
  const status = getDashboardDueStatus(issue.target_date, today);
  const label = !status
    ? null
    : status.kind === "overdue"
      ? t("home.personal_dashboard.overdue_days", { count: status.days })
      : status.kind === "today"
        ? t("home.personal_dashboard.due_today_label")
        : status.kind === "tomorrow"
          ? t("home.personal_dashboard.due_tomorrow")
          : t("home.personal_dashboard.due_in_days", { count: status.days });
  const color =
    status?.kind === "overdue"
      ? "text-danger-primary"
      : status && status.days <= 3
        ? "text-warning-primary"
        : "text-secondary";
  return (
    <div className="flex flex-col gap-1">
      {label && (
        <span className={`inline-flex items-center gap-1.5 text-body-xs-medium ${color}`}>
          {status?.kind === "overdue" ? (
            <WarningTriangleOutline className="size-3.5 shrink-0" aria-hidden="true" />
          ) : (
            <CalendarOutline className="size-3.5 shrink-0" aria-hidden="true" />
          )}
          {label}
        </span>
      )}
      <span className="text-caption-md-regular text-tertiary">{date ?? t("home.personal_dashboard.no_due_date")}</span>
    </div>
  );
}

export function PersonalTaskList({
  issues,
  isLoading,
  today,
  columns: visibleColumns,
  sortBy,
  sortDirection,
  onSort,
}: Props) {
  const { t, currentLocale } = useTranslation();
  const columnDefinitions: (DataTableColumn<IPersonalDashboardIssue> & { sortBy: TPersonalDashboardSortField })[] = [
    {
      key: "work-item",
      sortBy: "name",
      content: t("work_items"),
      tdRender: (issue: IPersonalDashboardIssue) => (
        <Link
          href={generateWorkItemLink({
            workspaceSlug: issue.workspace.slug,
            projectId: issue.project.id,
            issueId: issue.id,
            projectIdentifier: issue.project.identifier,
            sequenceId: issue.sequence_id,
          })}
          className="block min-w-56 rounded py-1 hover:text-accent-primary focus-visible:outline-2 focus-visible:outline-offset-2"
        >
          <span className="text-caption-md-regular text-tertiary">
            {issue.project.identifier}-{issue.sequence_id}
          </span>
          <span className="mt-1 block truncate text-body-sm-medium">{issue.name}</span>
        </Link>
      ),
    },
    {
      key: "workspace",
      sortBy: "project",
      content: t("home.personal_dashboard.workspaces"),
      tdRender: (issue: IPersonalDashboardIssue) => (
        <div className="min-w-36">
          <div className="truncate text-body-xs-medium text-primary">{issue.workspace.name}</div>
          <div className="truncate text-caption-md-regular text-tertiary">{issue.project.name}</div>
        </div>
      ),
    },
    {
      key: "state",
      sortBy: "state",
      content: t("state"),
      tdRender: (issue: IPersonalDashboardIssue) => <TaskState issue={issue} />,
    },
    {
      key: "priority",
      sortBy: "priority",
      content: t("priority"),
      tdRender: (issue: IPersonalDashboardIssue) => <TaskPriority issue={issue} />,
    },
    {
      key: "start-date",
      sortBy: "start_date",
      content: t("start_date"),
      tdRender: (issue: IPersonalDashboardIssue) => (
        <span className="text-body-xs-regular whitespace-nowrap text-secondary">
          {formatDashboardDate(issue.start_date, currentLocale) ?? "—"}
        </span>
      ),
    },
    {
      key: "due-date",
      sortBy: "due_date",
      content: t("due_date"),
      tdRender: (issue: IPersonalDashboardIssue) => <TaskDueDate issue={issue} today={today} />,
    },
  ];
  const columns = columnDefinitions
    .filter((column) => visibleColumns.includes(column.key as TPersonalDashboardColumn))
    // oxlint-disable-next-line oxc/no-map-spread -- Build fresh DataTable column definitions with sort handlers.
    .map(({ sortBy: columnSortBy, ...column }) => ({
      ...column,
      thRender: () => (
        <button
          type="button"
          className="inline-flex items-center gap-1 text-left focus-visible:outline-2 focus-visible:outline-offset-2"
          aria-label={t(
            sortBy === columnSortBy
              ? sortDirection === "asc"
                ? "home.personal_dashboard.sort_ascending"
                : "home.personal_dashboard.sort_descending"
              : "home.personal_dashboard.sort_column",
            { column: column.content }
          )}
          onClick={() => onSort(columnSortBy)}
        >
          {column.content}
          {sortBy === columnSortBy &&
            (sortDirection === "asc" ? (
              <SortAscendingOutline className="size-3.5" aria-hidden="true" />
            ) : (
              <SortDescendingOutline className="size-3.5" aria-hidden="true" />
            ))}
        </button>
      ),
    }));
  if (!isLoading && issues.length === 0)
    return <EmptyStateCompact title={t("home.personal_dashboard.empty")} rootClassName="min-h-48 px-6 py-12" />;
  return (
    <>
      <div className="hidden overflow-x-auto md:block">
        <DataTable columns={columns} data={issues} keyExtractor={(issue) => issue.id} isLoading={isLoading} />
      </div>
      <div className="divide-y divide-subtle md:hidden">
        {isLoading ? (
          <Loader className="space-y-3 p-4">
            <Loader.Item height="110px" width="100%" />
            <Loader.Item height="110px" width="100%" />
          </Loader>
        ) : (
          issues.map((issue) => (
            <article key={issue.id} className="space-y-3 p-4">
              <Link
                href={generateWorkItemLink({
                  workspaceSlug: issue.workspace.slug,
                  projectId: issue.project.id,
                  issueId: issue.id,
                  projectIdentifier: issue.project.identifier,
                  sequenceId: issue.sequence_id,
                })}
                className="block rounded focus-visible:outline-2 focus-visible:outline-offset-2"
              >
                <span className="text-caption-md-regular text-tertiary">
                  {issue.project.identifier}-{issue.sequence_id}
                </span>
                <h3 className="mt-1 text-body-sm-medium break-words text-primary">{issue.name}</h3>
              </Link>
              <p className="text-body-xs-regular break-words text-tertiary">
                {issue.workspace.name} · {issue.project.name}
              </p>
              <div className="flex flex-wrap gap-2">
                <TaskState issue={issue} />
                <TaskPriority issue={issue} />
              </div>
              <TaskDueDate issue={issue} today={today} />
            </article>
          ))
        )}
      </div>
    </>
  );
}
