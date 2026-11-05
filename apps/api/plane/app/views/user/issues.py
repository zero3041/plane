# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from datetime import timedelta
from uuid import UUID

from django.db.models import Count, Exists, F, OuterRef, Q
from django.utils import timezone
from rest_framework.exceptions import ParseError
from rest_framework.response import Response

from plane.app.permissions import ROLE
from plane.app.serializers.personal_issue import PersonalIssueSerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import (
    Issue,
    IssueAssignee,
    Project,
    ProjectMember,
    ProjectNetwork,
    State,
    StateGroup,
    WorkspaceMember,
)
from plane.utils.paginator import Cursor

DEFAULT_PER_PAGE = 50
MAX_PER_PAGE = 100
# PostgreSQL LIMIT/OFFSET are signed bigint values, including the look-ahead row.
MAX_OFFSET = (1 << 63) - 1 - MAX_PER_PAGE - 1
OPEN_GROUPS = (StateGroup.BACKLOG.value, StateGroup.UNSTARTED.value, StateGroup.STARTED.value)
BUCKETS = (
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
DUE_RANGES = ("all", "today", "overdue", "next_7", "next_30", "no_due")
PRIORITIES = ("urgent", "high", "medium", "low", "none")


class UserDashboardIssuesEndpoint(BaseAPIView):
    """Return work items and rollups visible to the current user across projects."""

    def _get_parameters(self, params):
        bucket = params.get("bucket", "all")
        if bucket not in BUCKETS:
            raise ParseError("Invalid bucket parameter.")
        raw_per_page = params.get("per_page", str(DEFAULT_PER_PAGE))
        if not re.fullmatch(r"[0-9]{1,3}", raw_per_page):
            raise ParseError("Invalid per_page parameter.")
        per_page = int(raw_per_page)
        if not 1 <= per_page <= MAX_PER_PAGE:
            raise ParseError("per_page must be between 1 and 100.")
        raw_cursor = params.get("cursor", f"{per_page}:0:0")
        if not re.fullmatch(r"[0-9]{1,3}:[0-9]{1,19}:[01]", raw_cursor):
            raise ParseError("Invalid cursor parameter.")
        cursor = Cursor.from_string(raw_cursor)
        if cursor.value != per_page or cursor.offset * per_page > MAX_OFFSET:
            raise ParseError("Invalid cursor parameter.")
        slug = params.get("workspace_slug")
        if slug is not None and not re.fullmatch(r"[-a-zA-Z0-9_]{1,48}", slug):
            raise ParseError("Invalid workspace_slug parameter.")
        raw_project_id = params.get("project_id")
        if raw_project_id is not None:
            try:
                project_id = str(UUID(raw_project_id))
            except (TypeError, ValueError, AttributeError) as error:
                raise ParseError("Invalid project_id parameter.") from error
        else:
            project_id = None
        raw_state_id = params.get("state_id")
        if raw_state_id is not None:
            try:
                state_id = str(UUID(raw_state_id))
            except (TypeError, ValueError, AttributeError) as error:
                raise ParseError("Invalid state_id parameter.") from error
        else:
            state_id = None
        priority = params.get("priority")
        if priority is not None and priority not in PRIORITIES:
            raise ParseError("Invalid priority parameter.")
        raw_assignee_id = params.get("assignee_id")
        if raw_assignee_id == "unassigned":
            assignee_id = raw_assignee_id
        elif raw_assignee_id is not None:
            try:
                assignee_id = str(UUID(raw_assignee_id))
            except (TypeError, ValueError, AttributeError) as error:
                raise ParseError("Invalid assignee_id parameter.") from error
        else:
            assignee_id = None
        due_range = params.get("due_range", "all")
        if due_range not in DUE_RANGES:
            raise ParseError("Invalid due_range parameter.")
        raw_include_sub_issues = params.get("include_sub_issues", "true")
        if raw_include_sub_issues not in {"true", "false"}:
            raise ParseError("include_sub_issues must be true or false.")
        include_sub_issues = raw_include_sub_issues == "true"
        return (
            bucket,
            per_page,
            cursor,
            slug,
            project_id,
            state_id,
            priority,
            assignee_id,
            due_range,
            include_sub_issues,
        )

    def _get_authorized_issues(self, user):
        workspace_members = WorkspaceMember.objects.filter(
            workspace_id=OuterRef("workspace_id"),
            member=user,
            is_active=True,
            deleted_at__isnull=True,
        )
        project_members = ProjectMember.objects.filter(
            project_id=OuterRef("project_id"),
            workspace_id=OuterRef("workspace_id"),
            member=user,
            is_active=True,
            deleted_at__isnull=True,
        )
        workspace_admin = workspace_members.filter(role=ROLE.ADMIN.value)
        workspace_member = workspace_members.filter(role=ROLE.MEMBER.value)
        # Keep workspace-view guest semantics and avoid multiplying rows through
        # memberships while returning all work visible to the current user.
        return Issue.issue_objects.filter(
            Exists(workspace_members),
            (
                Exists(workspace_admin)
                | Exists(project_members.filter(role__gt=ROLE.GUEST.value))
                | (Exists(workspace_member) & Q(project__network=ProjectNetwork.PUBLIC.value))
                | (
                    Exists(project_members.filter(role=ROLE.GUEST.value))
                    & (Q(project__guest_view_all_features=True) | Q(created_by=user))
                )
            ),
            workspace__deleted_at__isnull=True,
            project__deleted_at__isnull=True,
            project__workspace_id=F("workspace_id"),
            state__deleted_at__isnull=True,
            is_draft=False,
        ).exclude(state__group=StateGroup.TRIAGE.value)

    def _get_accessible_projects(self, user, workspace_slug):
        workspace_members = WorkspaceMember.objects.filter(
            workspace_id=OuterRef("workspace_id"),
            member=user,
            is_active=True,
            deleted_at__isnull=True,
        )
        project_members = ProjectMember.objects.filter(
            project_id=OuterRef("pk"),
            workspace_id=OuterRef("workspace_id"),
            member=user,
            is_active=True,
            deleted_at__isnull=True,
        )
        guest_visible_issues = Issue.issue_objects.filter(
            project_id=OuterRef("pk"),
            workspace_id=OuterRef("workspace_id"),
            created_by=user,
            workspace__deleted_at__isnull=True,
            project__deleted_at__isnull=True,
            state__deleted_at__isnull=True,
            is_draft=False,
        ).exclude(state__group=StateGroup.TRIAGE.value)
        if workspace_slug is not None:
            workspace_filter = Q(workspace__slug=workspace_slug)
        else:
            workspace_filter = Q()
        return list(
            Project.objects.filter(
                workspace_filter,
                Exists(workspace_members),
                (
                    Exists(workspace_members.filter(role=ROLE.ADMIN.value))
                    | Exists(project_members.filter(role__gt=ROLE.GUEST.value))
                    | (
                        Exists(project_members.filter(role=ROLE.GUEST.value))
                        & (Q(guest_view_all_features=True) | Exists(guest_visible_issues))
                    )
                    | (
                        Exists(workspace_members.filter(role=ROLE.MEMBER.value))
                        & Q(network=ProjectNetwork.PUBLIC.value)
                    )
                ),
                workspace__deleted_at__isnull=True,
                deleted_at__isnull=True,
            )
            .select_related("workspace")
            .order_by("workspace__name", "name", "id")
        )

    def _get_project_breakdown(self, projects, project_id, issues, today):
        project_stats = {
            row["project_id"]: row
            for row in issues.values(
                "project_id",
                "project__name",
                "project__identifier",
                "workspace__slug",
                "workspace__name",
            ).annotate(
                total_count=Count("id"),
                open_count=Count("id", filter=Q(state__group__in=OPEN_GROUPS)),
                completed_count=Count("id", filter=Q(state__group=StateGroup.COMPLETED.value)),
                overdue_count=Count("id", filter=Q(state__group__in=OPEN_GROUPS, target_date__lt=today)),
            )
        }
        visible_projects = [project for project in projects if project_id is None or str(project.id) == project_id]
        return [
            {
                "id": str(project.id),
                "name": project.name,
                "identifier": project.identifier,
                "workspace_slug": project.workspace.slug,
                "workspace_name": project.workspace.name,
                **{
                    key: project_stats.get(project.id, {}).get(key, 0)
                    for key in ("total_count", "open_count", "completed_count", "overdue_count")
                },
            }
            for project in visible_projects
        ]

    def get(self, request):
        (
            bucket,
            per_page,
            cursor,
            slug,
            project_id,
            state_id,
            priority,
            assignee_id,
            due_range,
            include_sub_issues,
        ) = self._get_parameters(request.query_params)
        today = timezone.localdate()
        scope_issues = self._get_authorized_issues(request.user)
        if slug is not None:
            scope_issues = scope_issues.filter(workspace__slug=slug)
        if project_id is not None:
            scope_issues = scope_issues.filter(project_id=project_id)
        if not include_sub_issues:
            scope_issues = scope_issues.filter(parent__isnull=True)

        project_options = self._get_accessible_projects(request.user, slug)
        state_project_ids = [
            project.id for project in project_options if project_id is None or str(project.id) == project_id
        ]
        state_options = [
            {
                "id": str(row["id"]),
                "name": row["name"],
                "group": row["group"],
                "color": row["color"],
            }
            for row in State.objects.filter(project_id__in=state_project_ids, deleted_at__isnull=True)
            .exclude(group=StateGroup.TRIAGE.value)
            .values("id", "name", "group", "color")
            .order_by("group", "name")
        ]
        assignee_options = [
            {
                "id": str(row["assignee_id"]),
                "display_name": row["assignee__display_name"] or row["assignee__username"],
            }
            for row in IssueAssignee.objects.filter(issue_id__in=scope_issues.values("id"), deleted_at__isnull=True)
            .values("assignee_id", "assignee__display_name", "assignee__username")
            .distinct()
            .order_by("assignee__display_name", "assignee__username")
        ]

        issues = scope_issues
        if state_id is not None:
            issues = issues.filter(state_id=state_id)
        if priority is not None:
            issues = issues.filter(priority=priority)
        if assignee_id == "unassigned":
            active_assignee = IssueAssignee.objects.filter(issue_id=OuterRef("pk"), deleted_at__isnull=True)
            issues = issues.annotate(has_assignee=Exists(active_assignee)).filter(has_assignee=False)
        elif assignee_id is not None:
            assignee_match = IssueAssignee.objects.filter(
                issue_id=OuterRef("pk"), assignee_id=assignee_id, deleted_at__isnull=True
            )
            issues = issues.filter(Exists(assignee_match))
        due_range_filters = {
            "all": Q(),
            "today": Q(target_date=today),
            "overdue": Q(target_date__lt=today),
            "next_7": Q(target_date__gte=today, target_date__lte=today + timedelta(days=7)),
            "next_30": Q(target_date__gte=today, target_date__lte=today + timedelta(days=30)),
            "no_due": Q(target_date__isnull=True),
        }
        issues = issues.filter(due_range_filters[due_range])
        open_issues = issues.filter(state__group__in=OPEN_GROUPS)
        filters = {
            "all_items": Q(),
            "all": Q(state__group__in=OPEN_GROUPS),
            "today": Q(state__group__in=OPEN_GROUPS, target_date=today),
            "overdue": Q(state__group__in=OPEN_GROUPS, target_date__lt=today),
            "in_progress": Q(state__group=StateGroup.STARTED),
            "blocked_or_paused": Q(state__group__in=OPEN_GROUPS, state__attention_kind__in=["blocked", "paused"]),
            "high_priority": Q(state__group__in=OPEN_GROUPS, priority__in=["high", "urgent"]),
            "upcoming": Q(
                state__group__in=OPEN_GROUPS,
                target_date__gte=today,
                target_date__lte=today + timedelta(days=3),
            ),
            "completed": Q(state__group=StateGroup.COMPLETED.value),
            "cancelled": Q(state__group=StateGroup.CANCELLED.value),
        }
        counts = issues.aggregate(**{key: Count("id", filter=condition) for key, condition in filters.items()})
        filtered = issues.filter(filters[bucket])
        total_count = counts[bucket]
        offset = cursor.offset * per_page
        rows = list(
            filtered.select_related("state", "project", "workspace")
            .only(
                "id",
                "name",
                "sequence_id",
                "priority",
                "start_date",
                "target_date",
                "state__id",
                "state__name",
                "state__color",
                "state__group",
                "state__attention_kind",
                "project__id",
                "project__name",
                "project__identifier",
                "workspace__id",
                "workspace__name",
                "workspace__slug",
            )
            .order_by(F("target_date").asc(nulls_last=True), "id")[offset : offset + per_page + 1]
        )
        has_next = len(rows) > per_page
        overview_counts = issues.aggregate(
            total=Count("id"),
            open=Count("id", filter=Q(state__group__in=OPEN_GROUPS)),
            completed=Count("id", filter=Q(state__group=StateGroup.COMPLETED.value)),
            cancelled=Count("id", filter=Q(state__group=StateGroup.CANCELLED.value)),
            overdue=Count("id", filter=Q(state__group__in=OPEN_GROUPS, target_date__lt=today)),
            due_soon=Count(
                "id",
                filter=Q(
                    state__group__in=OPEN_GROUPS,
                    target_date__gte=today,
                    target_date__lte=today + timedelta(days=14),
                ),
            ),
            blocked_or_paused=Count(
                "id", filter=Q(state__group__in=OPEN_GROUPS, state__attention_kind__in=["blocked", "paused"])
            ),
            high_priority=Count("id", filter=Q(state__group__in=OPEN_GROUPS, priority__in=["high", "urgent"])),
        )
        active_assignees = IssueAssignee.objects.filter(issue_id=OuterRef("pk"), deleted_at__isnull=True)
        overview_counts["unassigned_open"] = (
            open_issues.annotate(has_assignee=Exists(active_assignees)).filter(has_assignee=False).count()
        )
        state_breakdown = list(
            issues.values("state_id", "state__name", "state__color", "state__group", "state__attention_kind")
            .annotate(count=Count("id"))
            .order_by("state__group", "state__sequence", "state__name")
        )
        state_breakdown = [
            {
                "id": str(row["state_id"]),
                "name": row["state__name"],
                "color": row["state__color"],
                "group": row["state__group"],
                "attention_kind": row["state__attention_kind"],
                "count": row["count"],
            }
            for row in state_breakdown
        ]
        project_breakdown = self._get_project_breakdown(project_options, project_id, issues, today)
        assignment_rows = (
            IssueAssignee.objects.filter(issue_id__in=open_issues.values("id"), deleted_at__isnull=True)
            .values("assignee_id", "assignee__display_name", "assignee__username")
            .annotate(open_count=Count("issue_id", distinct=True))
            .order_by("-open_count", "assignee__display_name", "assignee__username")[:20]
        )
        assignee_workload = [
            {
                "id": str(row["assignee_id"]),
                "display_name": row["assignee__display_name"] or row["assignee__username"],
                "open_count": row["open_count"],
            }
            for row in assignment_rows
        ]
        workspace_count = len({project["workspace_slug"] for project in project_breakdown})
        return Response(
            {
                "results": PersonalIssueSerializer(rows[:per_page], many=True).data,
                "total_count": total_count,
                "next_cursor": str(Cursor(per_page, cursor.offset + 1)) if has_next else None,
                "next_page_results": has_next,
                "counts": counts,
                "overview": {
                    **overview_counts,
                    "project_count": len(project_breakdown),
                    "workspace_count": workspace_count,
                },
                "state_breakdown": state_breakdown,
                "filter_options": {"states": state_options, "assignees": assignee_options},
                "project_breakdown": project_breakdown,
                "project_options": [
                    {
                        "id": str(project.id),
                        "name": project.name,
                        "identifier": project.identifier,
                        "workspace_slug": project.workspace.slug,
                        "workspace_name": project.workspace.name,
                    }
                    for project in project_options
                ],
                "assignee_workload": assignee_workload,
                "today": today.isoformat(),
                "timezone": request.user.user_timezone,
            }
        )
