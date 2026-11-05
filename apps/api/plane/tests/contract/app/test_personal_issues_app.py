# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date, datetime, timedelta, timezone as dt_timezone
from unittest.mock import patch

import pytest
from django.utils import timezone

from plane.db.models import (
    Issue,
    IssueAssignee,
    Project,
    ProjectMember,
    State,
    User,
    Workspace,
    WorkspaceMember,
)

URL = "/api/users/me/issues/"
TODAY = date(2026, 10, 17)
pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def personal_data(create_user, workspace):
    other = User.objects.create(email="other@plane.so", username="other")
    second = Workspace.objects.create(name="Second", slug="second", owner=other)
    WorkspaceMember.objects.create(workspace=second, member=create_user, role=15)
    projects = [
        Project.objects.create(name=f"Project {index}", identifier=f"P{index}", workspace=ws, network=0)
        for index, ws in enumerate([workspace, second])
    ]
    for project in projects:
        ProjectMember.objects.create(project=project, workspace=project.workspace, member=create_user, role=15)
    states = {
        (project.id, group): State.objects.create(
            project=project, workspace=project.workspace, name=group, group=group, color="#123456"
        )
        for project in projects
        for group in ["backlog", "unstarted", "started", "completed", "cancelled", "triage"]
    }

    def make_issue(project=None, group="unstarted", author=None, assigned=True, **fields):
        project = project or projects[0]
        issue = Issue(
            project=project,
            workspace=project.workspace,
            state=states[(project.id, group)],
            **{"name": "Công việc ' \U0001f680", **fields},
        )
        issue.save(created_by_id=(author or create_user).id)
        if assigned:
            IssueAssignee.objects.create(
                issue=issue, project=project, workspace=project.workspace, assignee=create_user
            )
        return issue

    return create_user, other, projects, make_issue


@pytest.fixture(autouse=True)
def frozen_today():
    with patch("django.utils.timezone.now", return_value=datetime(2026, 10, 16, 18, tzinfo=dt_timezone.utc)):
        yield


def payload(client, params=None):
    response = client.get(URL, params or {})
    assert response.status_code == 200, response.content
    return response.json()


def assert_only(data, issues):
    assert {row["id"] for row in data["results"]} == {str(issue.id) for issue in issues}
    assert data["total_count"] == len(issues)


def test_cross_workspace_exact_contract(session_client, personal_data):
    user, _, projects, make = personal_data
    first = make(target_date=TODAY, start_date=TODAY - timedelta(days=1), priority="high")
    second = make(project=projects[1], group="started")
    data = payload(session_client)
    assert_only(data, [first, second])
    assert set(data) == {
        "results",
        "total_count",
        "next_cursor",
        "next_page_results",
        "counts",
        "overview",
        "state_breakdown",
        "filter_options",
        "project_breakdown",
        "project_options",
        "assignee_workload",
        "today",
        "timezone",
    }
    assert data["today"] == TODAY.isoformat()
    assert data["timezone"] == user.user_timezone
    assert data["counts"] == {
        "all_items": 2,
        "all": 2,
        "today": 1,
        "overdue": 0,
        "in_progress": 1,
        "blocked_or_paused": 0,
        "high_priority": 1,
        "upcoming": 1,
        "completed": 0,
        "cancelled": 0,
    }
    assert data["overview"]["open"] == 2
    assert data["overview"]["total"] == 2
    assert data["next_cursor"] is None
    assert data["next_page_results"] is False
    assert data["results"][0] == {
        "id": str(first.id),
        "name": first.name,
        "sequence_id": first.sequence_id,
        "priority": "high",
        "start_date": "2026-10-16",
        "target_date": "2026-10-17",
        "state": {
            "id": str(first.state_id),
            "name": "unstarted",
            "color": "#123456",
            "group": "unstarted",
            "attention_kind": "normal",
        },
        "project": {"id": str(projects[0].id), "name": projects[0].name, "identifier": projects[0].identifier},
        "workspace": {
            "id": str(projects[0].workspace_id),
            "name": projects[0].workspace.name,
            "slug": projects[0].workspace.slug,
        },
    }


def test_global_dashboard_includes_all_accessible_work_and_summary(session_client, personal_data):
    user, _, projects, make = personal_data
    assigned = make(target_date=TODAY, priority="high")
    visible_unassigned = make(project=projects[1], group="started", assigned=False)
    make(project=projects[1], group="completed", assigned=False)

    data = payload(session_client)

    assert_only(data, [assigned, visible_unassigned])
    assert data["overview"] == {
        "total": 3,
        "open": 2,
        "completed": 1,
        "cancelled": 0,
        "overdue": 0,
        "due_soon": 1,
        "blocked_or_paused": 0,
        "high_priority": 1,
        "unassigned_open": 1,
        "project_count": 2,
        "workspace_count": 2,
    }
    assert sum(row["count"] for row in data["state_breakdown"]) == 3
    assert {row["workspace_slug"] for row in data["project_breakdown"]} == {
        projects[0].workspace.slug,
        projects[1].workspace.slug,
    }
    assert data["assignee_workload"] == [{"id": str(user.id), "display_name": user.display_name, "open_count": 1}]


def test_project_filter_scopes_dashboard_data_and_keeps_workspace_project_options(session_client, personal_data):
    _, _, projects, make = personal_data
    first = make(project=projects[0])
    make(project=projects[1], group="completed", assigned=False)

    data = payload(session_client, {"project_id": str(projects[0].id)})

    assert_only(data, [first])
    assert data["overview"]["total"] == 1
    assert data["overview"]["project_count"] == 1
    assert len(data["project_breakdown"]) == 1
    assert len(data["project_options"]) == 2


@pytest.mark.parametrize(
    "workspace_role,network,visible",
    [(20, 0, True), (15, 2, True), (15, 0, False), (5, 2, False)],
)
def test_dashboard_project_visibility_matches_workspace_access(
    session_client, personal_data, workspace_role, network, visible
):
    user, other, projects, _ = personal_data
    workspace = projects[0].workspace
    WorkspaceMember.objects.filter(workspace=workspace, member=user).update(role=workspace_role)
    project = Project.objects.create(name="Unjoined", identifier="NEW", workspace=workspace, network=network)
    state = State.objects.create(
        project=project,
        workspace=workspace,
        name="started",
        group="started",
        color="#123456",
    )
    issue = Issue(project=project, workspace=workspace, state=state, name="Unassigned work")
    issue.save(created_by_id=other.id)

    data = payload(session_client)

    assert (str(issue.id) in {row["id"] for row in data["results"]}) is visible
    assert (str(project.id) in {item["id"] for item in data["project_options"]}) is visible


def test_project_guest_dashboard_metadata_only_includes_visible_projects(session_client, personal_data):
    user, other, projects, make = personal_data
    project = projects[0]
    WorkspaceMember.objects.filter(workspace=project.workspace, member=user).update(role=5)
    ProjectMember.objects.filter(project=project, member=user).update(role=5)
    hidden_issue = make(project=project, author=other, assigned=False)

    hidden_data = payload(session_client)
    assert str(hidden_issue.id) not in {row["id"] for row in hidden_data["results"]}
    assert str(project.id) not in {item["id"] for item in hidden_data["project_options"]}
    project_state_ids = {
        str(state_id) for state_id in State.objects.filter(project=project).values_list("id", flat=True)
    }
    assert project_state_ids.isdisjoint({item["id"] for item in hidden_data["filter_options"]["states"]})

    visible_issue = make(project=project, author=user, assigned=False)
    visible_data = payload(session_client)
    assert_only(visible_data, [visible_issue])
    assert str(project.id) in {item["id"] for item in visible_data["project_options"]}


def test_dashboard_filters_state_priority_assignee_dates_and_subtasks(session_client, personal_data):
    user, _, _, make = personal_data
    parent = make(group="started", priority="high", target_date=TODAY + timedelta(days=2))
    child = make(
        group="started",
        priority="high",
        target_date=TODAY + timedelta(days=1),
        assigned=False,
        parent=parent,
    )
    make(group="unstarted", priority="medium", target_date=TODAY + timedelta(days=2), assigned=False)
    filters = {
        "state_id": str(child.state_id),
        "priority": "high",
        "assignee_id": "unassigned",
        "due_range": "next_7",
    }

    filtered = payload(session_client, filters)
    assert_only(filtered, [child])
    assert filtered["overview"]["unassigned_open"] == 1
    assert any(option["name"] == "unstarted" for option in filtered["filter_options"]["states"])
    assert any(option["id"] == str(user.id) for option in filtered["filter_options"]["assignees"])

    parent_only = payload(session_client, {**filters, "include_sub_issues": "false"})
    assert_only(parent_only, [])


@pytest.mark.parametrize(
    "scope",
    [
        "workspace_inactive",
        "workspace_member_deleted",
        "workspace_member_missing",
        "workspace_deleted",
        "project_inactive",
        "project_member_deleted",
        "project_member_missing",
        "project_deleted",
        "project_archived",
    ],
)
def test_revoked_access_never_leaks_results_or_counts(session_client, personal_data, scope):
    user, other, projects, make = personal_data
    visible = make(target_date=TODAY)
    hidden = make(project=projects[1], group="started", target_date=TODAY, priority="urgent")
    State.objects.filter(pk=hidden.state_id).update(attention_kind="blocked")
    project = projects[1]
    if scope.startswith("workspace"):
        if scope == "workspace_deleted":
            Workspace.objects.filter(pk=project.workspace_id).update(deleted_at=timezone.now())
        elif scope == "workspace_member_missing":
            WorkspaceMember.objects.filter(workspace=project.workspace, member=user).delete(soft=False)
        else:
            fields = {"is_active": False} if scope == "workspace_inactive" else {"deleted_at": timezone.now()}
            WorkspaceMember.objects.filter(workspace=project.workspace, member=user).update(**fields)
    elif scope.startswith("project_member") or scope == "project_inactive":
        members = ProjectMember.objects.filter(project=project, member=user)
        if scope == "project_member_missing":
            members.delete(soft=False)
        else:
            members.update(**({"is_active": False} if scope == "project_inactive" else {"deleted_at": timezone.now()}))
    elif scope in {"project_deleted", "project_archived"}:
        Project.objects.filter(pk=project.pk).update(
            **{
                "deleted_at" if scope == "project_deleted" else "archived_at": timezone.now(),
            }
        )
    data = payload(session_client)
    assert_only(data, [visible])
    assert data["counts"] == {
        "all_items": 1,
        "all": 1,
        "today": 1,
        "overdue": 0,
        "in_progress": 0,
        "blocked_or_paused": 0,
        "high_priority": 0,
        "upcoming": 1,
        "completed": 0,
        "cancelled": 0,
    }
    scoped = payload(session_client, {"workspace_slug": project.workspace.slug})
    assert_only(scoped, [])
    assert scoped["counts"] == dict.fromkeys(
        [
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
        ],
        0,
    )


@pytest.mark.parametrize("view_all", [False, True])
def test_guest_creator_scope(session_client, personal_data, view_all):
    user, other, projects, make = personal_data
    ProjectMember.objects.filter(member=user).update(role=5)
    WorkspaceMember.objects.filter(member=user).update(role=5)
    # Another member must not grant their broader role to this guest.
    ProjectMember.objects.create(project=projects[1], workspace=projects[1].workspace, member=other, role=20)
    Project.objects.filter(pk__in=[p.pk for p in projects]).update(guest_view_all_features=view_all)
    own = make(target_date=TODAY, priority="high")
    foreign = make(author=other, project=projects[1], group="started", target_date=TODAY, priority="urgent")
    State.objects.filter(pk__in=[own.state_id, foreign.state_id]).update(attention_kind="paused")
    data = payload(session_client)
    assert_only(data, [own, foreign] if view_all else [own])
    assert data["counts"]["all"] == (2 if view_all else 1)
    assert data["counts"]["in_progress"] == (1 if view_all else 0)
    for bucket in ["blocked_or_paused", "high_priority", "upcoming"]:
        assert data["counts"][bucket] == (2 if view_all else 1)
        assert_only(payload(session_client, {"bucket": bucket}), [own, foreign] if view_all else [own])


@pytest.mark.parametrize(
    "excluded", ["completed", "cancelled", "triage", "draft", "archived", "deleted", "deleted_state"]
)
def test_excludes_non_open_issues(session_client, personal_data, excluded):
    _, _, _, make = personal_data
    visible = make(group="backlog")
    kwargs = {"group": excluded} if excluded in {"completed", "cancelled", "triage"} else {}
    hidden = make(priority="urgent", target_date=TODAY, **kwargs)
    State.all_state_objects.filter(pk=hidden.state_id).update(attention_kind="paused")
    if excluded in {"draft", "archived", "deleted"}:
        Issue.objects.filter(pk=hidden.pk).update(
            **{
                "draft": {"is_draft": True},
                "archived": {"archived_at": TODAY},
                "deleted": {"deleted_at": timezone.now()},
            }[excluded]
        )
    if excluded == "deleted_state":
        State.objects.filter(pk=hidden.state_id).update(deleted_at=timezone.now())
        Issue.objects.filter(pk=visible.pk).update(state=State.objects.get(project=visible.project, group="started"))
    data = payload(session_client)
    assert_only(data, [visible])
    assert data["counts"]["all"] == 1
    assert data["counts"]["high_priority"] == 0
    assert data["counts"]["upcoming"] == 0


@pytest.mark.parametrize("bucket,expected", [("all", 4), ("today", 1), ("overdue", 1), ("in_progress", 2)])
def test_buckets_and_workspace_counts(session_client, personal_data, bucket, expected):
    _, _, projects, make = personal_data
    issues = [
        make(group="started", target_date=TODAY - timedelta(days=1)),
        make(target_date=TODAY),
        make(group="started", target_date=TODAY + timedelta(days=1)),
        make(),
    ]
    make(project=projects[1], target_date=TODAY)
    data = payload(session_client, {"bucket": bucket, "workspace_slug": projects[0].workspace.slug})
    assert data["total_count"] == expected
    assert len(data["results"]) == expected
    assert data["counts"] == {
        "all_items": 4,
        "all": 4,
        "today": 1,
        "overdue": 1,
        "in_progress": 2,
        "blocked_or_paused": 0,
        "high_priority": 0,
        "upcoming": 2,
        "completed": 0,
        "cancelled": 0,
    }
    if bucket != "all":
        wanted = {"today": [issues[1]], "overdue": [issues[0]], "in_progress": [issues[0], issues[2]]}[bucket]
        assert_only(data, wanted)


@pytest.mark.parametrize("zone,day", [("America/Los_Angeles", "2026-10-16"), ("Asia/Ho_Chi_Minh", "2026-10-17")])
def test_today_uses_user_timezone_not_workspace_or_utc(session_client, personal_data, zone, day):
    user, _, _, make = personal_data
    user.user_timezone = zone
    user.save(update_fields=["user_timezone"])
    issue = make(target_date=date.fromisoformat(day))
    make(target_date=date.fromisoformat(day) - timedelta(days=1))
    data = payload(session_client, {"bucket": "today"})
    assert_only(data, [issue])
    assert data["today"] == day
    assert data["timezone"] == zone
    assert data["counts"]["overdue"] == 1


def test_stable_null_last_pagination_and_history_does_not_duplicate(session_client, personal_data):
    user, _, projects, make = personal_data
    no_due = make()
    tied = [make(target_date=TODAY) for _ in range(3)]
    overdue = make(target_date=TODAY - timedelta(days=1))
    IssueAssignee.objects.create(
        issue=tied[0],
        assignee=user,
        project=projects[0],
        workspace=projects[0].workspace,
        deleted_at=timezone.now(),
    )
    seen = []
    params = {"per_page": 2}
    for page in range(3):
        data = payload(session_client, params)
        assert data["total_count"] == 5
        assert data["counts"]["all"] == 5
        seen += [row["id"] for row in data["results"]]
        assert data["next_page_results"] is (page < 2)
        assert data["next_cursor"] == (f"2:{page + 1}:0" if page < 2 else None)
        params = {"per_page": 2, "cursor": data["next_cursor"]}
    assert seen == [str(overdue.id), *sorted(str(issue.id) for issue in tied), str(no_due.id)]
    beyond = payload(session_client, {"per_page": 2, "cursor": "2:99:0"})
    assert beyond["results"] == []
    assert beyond["total_count"] == 5
    assert beyond["next_cursor"] is None


@pytest.mark.parametrize(
    "params",
    [
        {"bucket": "unknown"},
        {"bucket": ""},
        {"per_page": 0},
        {"per_page": -1},
        {"per_page": 101},
        {"per_page": "no"},
        {"per_page": "1.5"},
        {"per_page": ""},
        {"cursor": ""},
        {"cursor": "abc"},
        {"cursor": "50:-1:0"},
        {"cursor": "50:0:2"},
        {"cursor": "0:0:0"},
        {"cursor": "1.5:0:0"},
        {"cursor": "50:0"},
        {"cursor": "50:0:0:0"},
        {"cursor": "20:1:0"},
        {"cursor": "50:9999999999999999999999:0"},
        {"workspace_slug": ""},
        {"workspace_slug": "../other"},
        {"workspace_slug": "x" * 49},
        {"workspace_slug": "a​b"},
        {"state_id": "not-a-uuid"},
        {"priority": "critical"},
        {"assignee_id": "not-a-uuid"},
        {"due_range": "next_year"},
        {"include_sub_issues": "maybe"},
        {"project_id": "not-a-uuid"},
    ],
)
def test_invalid_parameters_return_400(session_client, params):
    response = session_client.get(URL, params)
    assert response.status_code == 400, response.content


@pytest.mark.parametrize("per_page,expected", [(None, 50), (1, 1), (100, 100)])
def test_page_size_boundaries(session_client, personal_data, per_page, expected):
    user, _, projects, _ = personal_data
    project = projects[0]
    state = State.objects.get(project=project, group="started")
    issues = [Issue(project=project, workspace=project.workspace, state=state, name=f"Task {i}") for i in range(101)]
    Issue.objects.bulk_create(issues)
    IssueAssignee.objects.bulk_create(
        [IssueAssignee(issue=issue, project=project, workspace=project.workspace, assignee=user) for issue in issues]
    )
    data = payload(session_client, {} if per_page is None else {"per_page": per_page})
    assert len(data["results"]) == expected
    assert data["total_count"] == 101
    assert data["next_cursor"] == f"{expected}:1:0"


def test_empty_unknown_workspace_and_membership_revocation_between_requests(session_client, personal_data):
    user, _, projects, make = personal_data
    assert_only(payload(session_client), [])
    issue = make()
    assert_only(payload(session_client), [issue])
    assert_only(payload(session_client, {"workspace_slug": "unknown"}), [])
    WorkspaceMember.objects.filter(workspace=projects[0].workspace, member=user).update(role=15)
    ProjectMember.objects.filter(project=projects[0], member=user).update(is_active=False)
    assert_only(payload(session_client), [])


def test_cannot_select_another_user(session_client, personal_data):
    _, other, _, make = personal_data
    visible = make(assigned=False, author=other)
    assert_only(payload(session_client, {"user_id": str(other.id)}), [visible])


def test_requires_authentication(api_client):
    assert api_client.get(URL).status_code in {401, 403}


@pytest.mark.parametrize("has_invitation", [False, True])
def test_onboarded_without_workspace_defaults_to_root(create_user, has_invitation):
    from plane.authentication.utils.redirection_path import get_redirection_path
    from plane.db.models import Profile, WorkspaceMemberInvite

    profile, _ = Profile.objects.get_or_create(user=create_user)
    Profile.objects.filter(pk=profile.pk).update(is_onboarded=True)
    if has_invitation:
        owner = User.objects.create(email="inviter@plane.so", username="inviter")
        workspace = Workspace.objects.create(name="Invited", slug="invited", owner=owner)
        WorkspaceMemberInvite.objects.create(workspace=workspace, email=create_user.email, token="test-invite")
    assert not WorkspaceMember.objects.filter(member=create_user).exists()
    assert get_redirection_path(create_user) == "/"


def test_large_assignment_set_keeps_queries_and_page_bounded(session_client, personal_data):
    from django.db import connection
    from django.test.utils import CaptureQueriesContext

    user, _, projects, _ = personal_data
    project = projects[0]
    state = State.objects.get(project=project, group="started")
    State.objects.filter(pk=state.pk).update(attention_kind="paused")
    issues = [
        Issue(
            project=project,
            workspace=project.workspace,
            state=state,
            name=f"Task {i}",
            priority="urgent",
            target_date=TODAY,
        )
        for i in range(10001)
    ]
    Issue.objects.bulk_create(issues, batch_size=1000)
    IssueAssignee.objects.bulk_create(
        [IssueAssignee(issue=issue, project=project, workspace=project.workspace, assignee=user) for issue in issues],
        batch_size=1000,
    )
    with CaptureQueriesContext(connection) as queries:
        data = payload(session_client)
    assert data["total_count"] == 10001
    assert data["counts"] == {
        "all_items": 10001,
        "all": 10001,
        "today": 10001,
        "overdue": 0,
        "in_progress": 10001,
        "blocked_or_paused": 10001,
        "high_priority": 10001,
        "upcoming": 10001,
        "completed": 0,
        "cancelled": 0,
    }
    assert len(data["results"]) == 50
    issue_queries = [q["sql"] for q in queries if 'FROM "issues"' in q["sql"]]
    assert len(issue_queries) <= 8
    assert all('"description_html"' not in sql for sql in issue_queries)


@pytest.mark.parametrize("bucket", ["blocked_or_paused", "high_priority", "upcoming"])
def test_attention_buckets_overlap_without_duplicate_counts(session_client, personal_data, bucket):
    user, _, projects, make = personal_data
    first = make(group="started", priority="urgent", target_date=TODAY)
    second = make(group="backlog", priority="high", target_date=TODAY + timedelta(days=3))
    State.objects.filter(pk=first.state_id).update(attention_kind="blocked")
    State.objects.filter(pk=second.state_id).update(attention_kind="paused")
    make(priority="medium", target_date=TODAY + timedelta(days=4))
    make(priority="low", target_date=TODAY - timedelta(days=1))
    make(priority="none")
    for model, fields in [
        (IssueAssignee, {"issue": first, "assignee": user}),
        (ProjectMember, {"member": user, "role": 20}),
        (WorkspaceMember, {"member": user, "role": 20}),
    ]:
        scope = {"workspace": projects[0].workspace}
        if model is not WorkspaceMember:
            scope = {**scope, "project": projects[0]}
        # Historical memberships must not trigger new-member property creation.
        model.objects.bulk_create([model(**scope, **fields, deleted_at=timezone.now())])
    expected = {
        "all_items": 5,
        "all": 5,
        "today": 1,
        "overdue": 1,
        "in_progress": 1,
        "blocked_or_paused": 2,
        "high_priority": 2,
        "upcoming": 2,
        "completed": 0,
        "cancelled": 0,
    }
    data = payload(session_client, {"bucket": bucket, "per_page": 1})
    assert data["counts"] == expected
    assert data["total_count"] == 2
    assert [row["id"] for row in data["results"]] == [str(first.id)]
    assert data["next_cursor"] == "1:1:0"
    second_page = payload(session_client, {"bucket": bucket, "per_page": 1, "cursor": data["next_cursor"]})
    assert second_page["counts"] == expected
    assert [row["id"] for row in second_page["results"]] == [str(second.id)]
    assert second_page["next_cursor"] is None


def test_state_rename_does_not_change_attention_classification(session_client, personal_data):
    _, _, _, make = personal_data
    blocked = make(group="started")
    ordinary = make(group="unstarted")
    State.objects.filter(pk=blocked.state_id).update(attention_kind="blocked", name="Ordinary workflow")
    State.objects.filter(pk=ordinary.state_id).update(name="Blocked / Paused / Tạm dừng")
    assert_only(payload(session_client, {"bucket": "blocked_or_paused"}), [blocked])
    State.objects.filter(pk=blocked.state_id).update(name="Đổi tên ' 🚀")
    renamed = payload(session_client, {"bucket": "blocked_or_paused"})
    assert_only(renamed, [blocked])
    assert renamed["results"][0]["state"]["attention_kind"] == "blocked"


@pytest.mark.parametrize(
    "zone,day",
    [("America/Los_Angeles", "2026-10-16"), ("Asia/Ho_Chi_Minh", "2026-10-17"), ("Pacific/Kiritimati", "2026-10-17")],
)
def test_upcoming_inclusive_boundaries_use_profile_timezone(session_client, personal_data, zone, day):
    user, _, _, make = personal_data
    user.user_timezone = zone
    user.save(update_fields=["user_timezone"])
    today = date.fromisoformat(day)
    issues = {offset: make(target_date=today + timedelta(days=offset)) for offset in [-1, 0, 1, 2, 3, 4]}
    make()
    data = payload(session_client, {"bucket": "upcoming"})
    assert_only(data, [issues[offset] for offset in [0, 1, 2, 3]])
    assert data["today"] == day
    assert data["timezone"] == zone
    assert data["counts"]["today"] == 1
    assert data["counts"]["overdue"] == 1
