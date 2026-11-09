/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { TUserPermissions } from "./enums";
import type { IIssueActivity, TIssuePriorities, TStateAttentionKind, TStateGroups } from ".";
import type { TLoginMediums } from "./instance";

export type TPersonalDashboardBucket =
  | "all_items"
  | "all"
  | "today"
  | "overdue"
  | "in_progress"
  | "blocked_or_paused"
  | "high_priority"
  | "upcoming"
  | "completed"
  | "cancelled";

export type TPersonalDashboardDateRange = "all" | "today" | "overdue" | "next_7" | "next_30" | "no_due";

export type TPersonalDashboardColumn = "work-item" | "workspace" | "state" | "priority" | "start-date" | "due-date";

export type TPersonalDashboardSortField =
  | "due_date"
  | "start_date"
  | "name"
  | "priority"
  | "state"
  | "project"
  | "sequence_id";

export type TPersonalDashboardSortDirection = "asc" | "desc";

export interface IPersonalDashboardIssue {
  id: string;
  name: string;
  sequence_id: number;
  priority: TIssuePriorities;
  start_date: string | null;
  target_date: string | null;
  state: { id: string; name: string; color: string; group: TStateGroups; attention_kind?: TStateAttentionKind };
  project: { id: string; name: string; identifier: string };
  workspace: { id: string; name: string; slug: string };
}

export interface IPersonalDashboardOverview {
  total: number;
  open: number;
  completed: number;
  cancelled: number;
  overdue: number;
  due_soon: number;
  blocked_or_paused: number;
  high_priority: number;
  unassigned_open: number;
  project_count: number;
  workspace_count: number;
}

export interface IPersonalDashboardStateSummary {
  id: string;
  name: string;
  color: string;
  group: TStateGroups;
  attention_kind: TStateAttentionKind;
  count: number;
}

export interface IPersonalDashboardProjectSummary {
  id: string;
  name: string;
  identifier: string;
  workspace_slug: string;
  workspace_name: string;
  total_count: number;
  open_count: number;
  completed_count: number;
  overdue_count: number;
}

export interface IPersonalDashboardProjectOption {
  id: string;
  name: string;
  identifier: string;
  workspace_slug: string;
  workspace_name: string;
}

export interface IPersonalDashboardAssigneeSummary {
  id: string;
  display_name: string;
  open_count: number;
}

export interface IPersonalDashboardFilterOptions {
  states: Pick<IPersonalDashboardStateSummary, "id" | "name" | "color" | "group">[];
  assignees: Pick<IPersonalDashboardAssigneeSummary, "id" | "display_name">[];
}

export interface IPersonalDashboardResponse {
  results: IPersonalDashboardIssue[];
  total_count: number;
  next_cursor: string | null;
  next_page_results: boolean;
  counts: Record<TPersonalDashboardBucket, number>;
  overview: IPersonalDashboardOverview;
  state_breakdown: IPersonalDashboardStateSummary[];
  filter_options: IPersonalDashboardFilterOptions;
  project_breakdown: IPersonalDashboardProjectSummary[];
  project_options: IPersonalDashboardProjectOption[];
  assignee_workload: IPersonalDashboardAssigneeSummary[];
  today: string;
  timezone: string;
}

export interface IPersonalDashboardParams {
  bucket: TPersonalDashboardBucket;
  workspace_slug?: string;
  project_id?: string;
  state_id?: string;
  priority?: TIssuePriorities;
  assignee_id?: string;
  due_range?: TPersonalDashboardDateRange;
  include_sub_issues?: boolean;
  sort_by?: TPersonalDashboardSortField;
  sort_direction?: TPersonalDashboardSortDirection;
  cursor?: string;
  per_page?: number;
}

export type TPersonalDashboardFilterConfig = Partial<
  Pick<
    IPersonalDashboardParams,
    | "bucket"
    | "workspace_slug"
    | "project_id"
    | "state_id"
    | "priority"
    | "assignee_id"
    | "due_range"
    | "include_sub_issues"
  >
>;

export interface IPersonalDashboardSavedView {
  id: string;
  name: string;
  filters: TPersonalDashboardFilterConfig;
  columns: TPersonalDashboardColumn[];
  sort_by: TPersonalDashboardSortField;
  sort_direction: TPersonalDashboardSortDirection;
  is_favorite: boolean;
  created_at: string;
  updated_at: string;
}

export type TPersonalDashboardSavedViewPayload = Omit<IPersonalDashboardSavedView, "id" | "created_at" | "updated_at">;

/**
 * @description The start of the week for the user
 * @enum {number}
 */
export enum EStartOfTheWeek {
  SUNDAY = 0,
  MONDAY = 1,
  TUESDAY = 2,
  WEDNESDAY = 3,
  THURSDAY = 4,
  FRIDAY = 5,
  SATURDAY = 6,
}

export interface IUserLite {
  avatar_url: string;
  display_name: string;
  email?: string;
  first_name: string;
  id: string;
  is_bot: boolean;
  last_name: string;
  joining_date?: string;
}
export interface IUser extends IUserLite {
  // only for uploading the cover image
  cover_image_asset?: string | null;
  cover_image?: string | null;
  // only for rendering the cover image
  cover_image_url: string | null;
  date_joined: string;
  email: string;
  is_active: boolean;
  is_email_verified: boolean;
  is_password_autoset: boolean;
  is_tour_completed: boolean;
  mobile_number: string | null;
  last_workspace_id: string;
  user_timezone: string;
  username: string;
  last_login_medium: TLoginMediums;
  theme: IUserTheme;
}

export interface IUserAccount {
  provider_account_id: string;
  provider: string;
  created_at: Date;
  updated_at: Date;
}

export type TUserProfile = {
  id: string | undefined;
  user: string | undefined;
  role: string | undefined;
  last_workspace_id: string | undefined;
  theme: {
    theme: string | undefined;
    primary: string | undefined;
    background: string | undefined;
    darkPalette: boolean | undefined;
  };
  onboarding_step: TOnboardingSteps;
  is_onboarded: boolean;
  is_tour_completed: boolean;
  use_case: string | undefined;
  billing_address_country: string | undefined;
  billing_address: string | undefined;
  has_billing_address: boolean;
  has_marketing_email_consent: boolean;
  language: string;
  created_at: Date | string;
  updated_at: Date | string;
  start_of_the_week: EStartOfTheWeek;
};

export interface IInstanceAdminStatus {
  is_instance_admin: boolean;
}

export interface IUserSettings {
  id: string | undefined;
  email: string | undefined;
  workspace: {
    last_workspace_id: string | undefined;
    last_workspace_slug: string | undefined;
    last_workspace_name: string | undefined;
    last_workspace_logo: string | undefined;
    fallback_workspace_id: string | undefined;
    fallback_workspace_slug: string | undefined;
    invites: number | undefined;
  };
}

export interface IUserTheme {
  theme: string | undefined; // 'light', 'dark', 'custom', etc.
  primary?: string | undefined;
  background?: string | undefined;
  darkPalette?: boolean | undefined;
}

export interface IUserMemberLite extends IUserLite {
  email?: string;
}

export interface IUserActivity {
  created_date: string;
  activity_count: number;
}

export interface IUserPriorityDistribution {
  priority: TIssuePriorities;
  priority_count: number;
}

export interface IUserStateDistribution {
  state_group: TStateGroups;
  state_count: number;
}

export interface IUserActivityResponse {
  count: number;
  extra_stats: null;
  next_cursor: string;
  next_page_results: boolean;
  prev_cursor: string;
  prev_page_results: boolean;
  results: IIssueActivity[];
  total_pages: number;
  total_results: number;
}

export type UserAuth = {
  isMember: boolean;
  isOwner: boolean;
  isGuest: boolean;
};

export type TOnboardingSteps = {
  profile_complete: boolean;
  workspace_create: boolean;
  workspace_invite: boolean;
  workspace_join: boolean;
};

export interface IUserProfileData {
  assigned_issues: number;
  completed_issues: number;
  created_issues: number;
  pending_issues: number;
  priority_distribution: IUserPriorityDistribution[];
  state_distribution: IUserStateDistribution[];
  subscribed_issues: number;
}

export interface IUserProfileProjectSegregation {
  project_data: {
    assigned_issues: number;
    completed_issues: number;
    created_issues: number;
    id: string;
    pending_issues: number;
  }[];
  user_data: Pick<IUser, "avatar_url" | "cover_image_url" | "display_name" | "first_name" | "last_name"> & {
    date_joined: Date;
    user_timezone: string;
  };
}

export interface IUserProjectsRole {
  [projectId: string]: TUserPermissions;
}

export interface IUserEmailNotificationSettings {
  property_change: boolean;
  state_change: boolean;
  comment: boolean;
  mention: boolean;
  issue_completed: boolean;
}

export type TProfileViews = "assigned" | "created" | "subscribed";

export type TPublicMember = {
  id: string;
  member: string;
  member__display_name: string;
  member__avatar: string;
};

// export interface ICurrentUser {
//   id: readonly string;
//   avatar: string;
//   first_name: string;
//   last_name: string;
//   username: string;
//   email: string;
//   mobile_number: string;
//   is_email_verified: boolean;
//   is_tour_completed: boolean;
//   onboarding_step: TOnboardingSteps;
//   is_onboarded: boolean;
//   role: string;
// }

// export interface ICustomTheme {
//   background: string;
//   text: string;
//   primary: string;
//   sidebarBackground: string;
//   sidebarText: string;
//   darkPalette: boolean;
//   palette: string;
//   theme: string;
// }

// export interface ICurrentUserSettings {
//   theme: ICustomTheme;
// }
