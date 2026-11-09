/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import {
  buildDashboardFilterUrl,
  formatDashboardDate,
  getDashboardDueStatus,
  getDashboardFilters,
  getPersonalDashboardKey,
} from "./helpers";

test("khóa cache phân biệt tài khoản, phòng ban, bộ lọc và trang", () => {
  const filters = getDashboardFilters(new URLSearchParams("bucket=today&workspace_slug=it&project_id=project-a"));
  const key = getPersonalDashboardKey("user-a", filters, null);
  assert.notDeepEqual(key, getPersonalDashboardKey("user-b", filters, null));
  assert.notDeepEqual(key, getPersonalDashboardKey("user-a", { ...filters, workspace_slug: "mh" }, null));
  assert.notDeepEqual(key, getPersonalDashboardKey("user-a", { ...filters, bucket: "all" }, null));
  assert.notDeepEqual(key, getPersonalDashboardKey("user-a", { ...filters, project_id: "project-b" }, null));
  assert.notDeepEqual(key, getPersonalDashboardKey("user-a", filters, "50"));
  assert.equal(getPersonalDashboardKey(undefined, filters, null), null);
});

test("dashboard filters can be restored and shared through the URL", () => {
  const params = new URLSearchParams(
    "bucket=overdue&workspace_slug=cntt1&project_id=project-a&state_id=state-a&priority=high&assignee_id=unassigned&due_range=next_7&include_sub_issues=false"
  );
  assert.deepEqual(getDashboardFilters(params), {
    bucket: "overdue",
    workspace_slug: "cntt1",
    project_id: "project-a",
    state_id: "state-a",
    priority: "high",
    assignee_id: "unassigned",
    due_range: "next_7",
    include_sub_issues: false,
    columns: ["work-item", "workspace", "state", "priority", "start-date", "due-date"],
    sort_by: "due_date",
    sort_direction: "asc",
    saved_view_id: "",
  });
  assert.equal(
    buildDashboardFilterUrl("/", params, { project_id: "", due_range: "all" }),
    "/?bucket=overdue&workspace_slug=cntt1&state_id=state-a&priority=high&assignee_id=unassigned&include_sub_issues=false"
  );
});

test("nhãn hạn dùng ngày tham chiếu từ API và giữ biên cửa sổ ba ngày", () => {
  assert.deepEqual(getDashboardDueStatus("2026-10-13", "2026-10-16"), { kind: "overdue", days: 3 });
  assert.deepEqual(getDashboardDueStatus("2026-10-16", "2026-10-16"), { kind: "today", days: 0 });
  assert.deepEqual(getDashboardDueStatus("2026-10-17", "2026-10-16"), { kind: "tomorrow", days: 1 });
  assert.deepEqual(getDashboardDueStatus("2026-10-19", "2026-10-16"), { kind: "upcoming", days: 3 });
  assert.deepEqual(getDashboardDueStatus("2026-10-20", "2026-10-16"), { kind: "later", days: 4 });
});

test("chênh lệch date-only đúng qua DST, năm nhuận và không nhận ngày sai", () => {
  assert.deepEqual(getDashboardDueStatus("2026-03-09", "2026-03-07"), { kind: "upcoming", days: 2 });
  assert.deepEqual(getDashboardDueStatus("2028-03-01", "2028-02-28"), { kind: "upcoming", days: 2 });
  for (const value of [null, undefined, "", "not-a-date", "2026-02-30", "2026-13-01"]) {
    assert.equal(getDashboardDueStatus(value, "2026-10-16"), null);
  }
  assert.equal(getDashboardDueStatus("2026-10-16", undefined), null);
});

test("ngày hạn date-only giữ nguyên ngày khi trình duyệt dùng múi giờ khác", () => {
  assert.equal(formatDashboardDate("2026-10-16", "vi-VN"), "16/10/2026");
  assert.equal(formatDashboardDate("2026-10-16", "en"), "10/16/2026");
  assert.equal(formatDashboardDate(null, "vi-VN"), null);
  assert.equal(formatDashboardDate("không hợp lệ", "vi-VN"), null);
});
