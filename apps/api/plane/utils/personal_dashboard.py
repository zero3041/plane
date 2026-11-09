# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

PERSONAL_DASHBOARD_BUCKETS = (
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
)
PERSONAL_DASHBOARD_DUE_RANGES = ("all", "today", "overdue", "next_7", "next_30", "no_due")
PERSONAL_DASHBOARD_PRIORITIES = ("urgent", "high", "medium", "low", "none")
PERSONAL_DASHBOARD_COLUMNS = ("work-item", "workspace", "state", "priority", "start-date", "due-date")
DEFAULT_PERSONAL_DASHBOARD_COLUMNS = PERSONAL_DASHBOARD_COLUMNS
PERSONAL_DASHBOARD_SORT_FIELDS = ("due_date", "start_date", "name", "priority", "state", "project", "sequence_id")
