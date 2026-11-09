/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type {
  TIssuePriorities,
  TPersonalDashboardBucket,
  TPersonalDashboardColumn,
  TPersonalDashboardDateRange,
  TPersonalDashboardFilterConfig,
  TPersonalDashboardSortDirection,
  TPersonalDashboardSortField,
} from "@plane/types";

export const DEFAULT_DASHBOARD_COLUMNS: TPersonalDashboardColumn[] = [
  "work-item",
  "workspace",
  "state",
  "priority",
  "start-date",
  "due-date",
];

export interface TDashboardFilters {
  bucket: TPersonalDashboardBucket;
  workspace_slug: string;
  project_id: string;
  state_id: string;
  priority: TIssuePriorities | "";
  assignee_id: string;
  due_range: TPersonalDashboardDateRange;
  include_sub_issues: boolean;
  columns: TPersonalDashboardColumn[];
  sort_by: TPersonalDashboardSortField;
  sort_direction: TPersonalDashboardSortDirection;
  saved_view_id: string;
}

const DASHBOARD_BUCKETS = new Set<TPersonalDashboardBucket>([
  "all_items",
  "all",
  "today",
  "overdue",
  "in_progress",
  "blocked_or_paused",
  "high_priority",
  "upcoming",
  "completed",
  "cancelled",
]);
const DASHBOARD_COLUMNS = new Set<TPersonalDashboardColumn>(DEFAULT_DASHBOARD_COLUMNS);
const DASHBOARD_SORT_FIELDS = new Set<TPersonalDashboardSortField>([
  "due_date",
  "start_date",
  "name",
  "priority",
  "state",
  "project",
  "sequence_id",
]);
const DASHBOARD_PRIORITIES = new Set<TIssuePriorities>(["urgent", "high", "medium", "low", "none"]);
const DASHBOARD_DATE_RANGES = new Set<TPersonalDashboardDateRange>([
  "all",
  "today",
  "overdue",
  "next_7",
  "next_30",
  "no_due",
]);

export function getPersonalDashboardKey(
  userId: string | undefined,
  filters: TDashboardFilters,
  cursor: string | null
): readonly [string, string, TDashboardFilters, string | null] | null {
  if (!userId) return null;
  return ["PERSONAL_DASHBOARD", userId, filters, cursor] as const;
}

export function getPersonalDashboardViewsKey(userId: string | undefined): readonly [string, string] | null {
  if (!userId) return null;
  return ["PERSONAL_DASHBOARD_VIEWS", userId] as const;
}

export function getDashboardViewFilters(filters: TDashboardFilters): TPersonalDashboardFilterConfig {
  return {
    bucket: filters.bucket,
    ...(filters.workspace_slug ? { workspace_slug: filters.workspace_slug } : {}),
    ...(filters.project_id ? { project_id: filters.project_id } : {}),
    ...(filters.state_id ? { state_id: filters.state_id } : {}),
    ...(filters.priority ? { priority: filters.priority } : {}),
    ...(filters.assignee_id ? { assignee_id: filters.assignee_id } : {}),
    due_range: filters.due_range,
    include_sub_issues: filters.include_sub_issues,
  };
}

export function getDashboardFilters(searchParams: URLSearchParams): TDashboardFilters {
  const bucket = searchParams.get("bucket");
  const priority = searchParams.get("priority");
  const dueRange = searchParams.get("due_range");
  const sortBy = searchParams.get("sort_by");
  const sortDirection = searchParams.get("sort_direction");
  const requestedColumns = searchParams.get("columns")?.split(",") ?? DEFAULT_DASHBOARD_COLUMNS;
  const columns = [
    ...new Set(
      requestedColumns.filter((column): column is TPersonalDashboardColumn =>
        DASHBOARD_COLUMNS.has(column as TPersonalDashboardColumn)
      )
    ),
  ];
  if (!columns.includes("work-item")) columns.unshift("work-item");
  return {
    bucket: DASHBOARD_BUCKETS.has(bucket as TPersonalDashboardBucket) ? (bucket as TPersonalDashboardBucket) : "all",
    workspace_slug: searchParams.get("workspace_slug") ?? "",
    project_id: searchParams.get("project_id") ?? "",
    state_id: searchParams.get("state_id") ?? "",
    priority: DASHBOARD_PRIORITIES.has(priority as TIssuePriorities) ? (priority as TIssuePriorities) : "",
    assignee_id: searchParams.get("assignee_id") ?? "",
    due_range: DASHBOARD_DATE_RANGES.has(dueRange as TPersonalDashboardDateRange)
      ? (dueRange as TPersonalDashboardDateRange)
      : "all",
    include_sub_issues: searchParams.get("include_sub_issues") !== "false",
    columns,
    sort_by: DASHBOARD_SORT_FIELDS.has(sortBy as TPersonalDashboardSortField)
      ? (sortBy as TPersonalDashboardSortField)
      : "due_date",
    sort_direction: sortDirection === "desc" ? "desc" : "asc",
    saved_view_id: searchParams.get("saved_view_id") ?? "",
  };
}

export type TDashboardFilterUpdates = Partial<Record<keyof TDashboardFilters, string | string[] | null>>;

export function buildDashboardFilterUrl(
  pathname: string,
  searchParams: URLSearchParams,
  updates: TDashboardFilterUpdates
): string {
  const nextParams = new URLSearchParams(searchParams.toString());
  const defaultValues: Partial<Record<keyof TDashboardFilters, string>> = {
    bucket: "all",
    due_range: "all",
    include_sub_issues: "true",
    columns: DEFAULT_DASHBOARD_COLUMNS.join(","),
    sort_by: "due_date",
    sort_direction: "asc",
  };
  for (const [key, rawValue] of Object.entries(updates) as [keyof TDashboardFilters, string | string[] | null][]) {
    const value = Array.isArray(rawValue) ? rawValue.join(",") : (rawValue ?? "");
    if (!value || defaultValues[key] === value) nextParams.delete(key);
    else nextParams.set(key, value);
  }
  nextParams.delete("cursor");
  const query = nextParams.toString();
  return query ? `${pathname}?${query}` : pathname;
}

const MILLISECONDS_PER_DAY = 24 * 60 * 60 * 1000;

function parseDateOnly(value: string | null | undefined): number | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const date = new Date(`${value}T00:00:00Z`);
  const timestamp = date.getTime();
  if (!Number.isFinite(timestamp) || date.toISOString().slice(0, 10) !== value) return null;
  return timestamp;
}

export function getDashboardDueStatus(
  dueDate: string | null | undefined,
  today: string | undefined
): { kind: "overdue" | "today" | "tomorrow" | "upcoming" | "later"; days: number } | null {
  const due = parseDateOnly(dueDate);
  const reference = parseDateOnly(today);
  if (due === null || reference === null) return null;
  const days = Math.round((due - reference) / MILLISECONDS_PER_DAY);
  if (days < 0) return { kind: "overdue", days: Math.abs(days) };
  if (days === 0) return { kind: "today", days };
  if (days === 1) return { kind: "tomorrow", days };
  return { kind: days <= 3 ? "upcoming" : "later", days };
}

export function formatDashboardDate(value: string | null | undefined, locale: string): string | null {
  if (!value || !/^\d{4}-\d{2}-\d{2}$/.test(value)) return null;
  const [year, month, day] = value.split("-").map(Number);
  const date = new Date(Date.UTC(year, month - 1, day));
  if (Number.isNaN(date.getTime())) return null;

  return new Intl.DateTimeFormat(locale, {
    timeZone: "UTC",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}
