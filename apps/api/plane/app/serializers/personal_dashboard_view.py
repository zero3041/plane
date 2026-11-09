# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import re
from uuid import UUID

from rest_framework import serializers

from plane.db.models import PersonalDashboardView
from plane.db.models.personal_dashboard_view import default_personal_dashboard_columns
from plane.utils.personal_dashboard import (
    PERSONAL_DASHBOARD_BUCKETS,
    PERSONAL_DASHBOARD_COLUMNS,
    PERSONAL_DASHBOARD_DUE_RANGES,
    PERSONAL_DASHBOARD_PRIORITIES,
    PERSONAL_DASHBOARD_SORT_FIELDS,
)


class PersonalDashboardViewSerializer(serializers.ModelSerializer):
    filters = serializers.JSONField(required=False, default=dict)
    columns = serializers.ListField(
        child=serializers.ChoiceField(choices=PERSONAL_DASHBOARD_COLUMNS),
        required=False,
        default=default_personal_dashboard_columns,
    )
    sort_by = serializers.ChoiceField(choices=PERSONAL_DASHBOARD_SORT_FIELDS, required=False, default="due_date")
    sort_direction = serializers.ChoiceField(choices=("asc", "desc"), required=False, default="asc")

    class Meta:
        model = PersonalDashboardView
        fields = [
            "id",
            "name",
            "filters",
            "columns",
            "sort_by",
            "sort_direction",
            "is_favorite",
            "created_at",
            "updated_at",
        ]
        read_only_fields = ["id", "created_at", "updated_at"]

    def validate_name(self, value):
        name = value.strip()
        if not name:
            raise serializers.ValidationError("A saved view needs a name.")
        owner = self.context["request"].user
        existing = PersonalDashboardView.objects.filter(owner=owner, name__iexact=name)
        if self.instance:
            existing = existing.exclude(pk=self.instance.pk)
        if existing.exists():
            raise serializers.ValidationError("A view with this name already exists.")
        return name

    def validate_filters(self, value):
        if not isinstance(value, dict):
            raise serializers.ValidationError("Filters must be an object.")
        allowed_keys = {
            "bucket",
            "workspace_slug",
            "project_id",
            "state_id",
            "priority",
            "assignee_id",
            "due_range",
            "include_sub_issues",
        }
        unknown_keys = set(value) - allowed_keys
        if unknown_keys:
            raise serializers.ValidationError("Unknown filter fields.")

        normalized = dict(value)
        bucket = normalized.get("bucket", "all")
        if bucket not in PERSONAL_DASHBOARD_BUCKETS:
            raise serializers.ValidationError({"bucket": "Invalid dashboard bucket."})
        due_range = normalized.get("due_range", "all")
        if due_range not in PERSONAL_DASHBOARD_DUE_RANGES:
            raise serializers.ValidationError({"due_range": "Invalid due date range."})
        priority = normalized.get("priority")
        if priority not in (None, "", *PERSONAL_DASHBOARD_PRIORITIES):
            raise serializers.ValidationError({"priority": "Invalid priority."})
        workspace_slug = normalized.get("workspace_slug")
        if workspace_slug not in (None, "") and (
            not isinstance(workspace_slug, str) or not re.fullmatch(r"[-a-zA-Z0-9_]{1,48}", workspace_slug)
        ):
            raise serializers.ValidationError({"workspace_slug": "Invalid workspace slug."})
        for field in ("project_id", "state_id"):
            raw_value = normalized.get(field)
            if raw_value in (None, ""):
                continue
            try:
                normalized[field] = str(UUID(raw_value))
            except (TypeError, ValueError, AttributeError) as error:
                raise serializers.ValidationError({field: "Invalid identifier."}) from error
        assignee_id = normalized.get("assignee_id")
        if assignee_id not in (None, "", "unassigned"):
            try:
                normalized["assignee_id"] = str(UUID(assignee_id))
            except (TypeError, ValueError, AttributeError) as error:
                raise serializers.ValidationError({"assignee_id": "Invalid identifier."}) from error
        if "include_sub_issues" in normalized and not isinstance(normalized["include_sub_issues"], bool):
            raise serializers.ValidationError({"include_sub_issues": "Expected a boolean."})
        return normalized

    def validate_columns(self, value):
        if not value or len(value) != len(set(value)):
            raise serializers.ValidationError("Choose at least one unique column.")
        if "work-item" not in value:
            raise serializers.ValidationError("The work item column must remain visible.")
        return value
