# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.conf import settings
from django.db import models
from django.db.models.functions import Lower

from plane.utils.personal_dashboard import DEFAULT_PERSONAL_DASHBOARD_COLUMNS, PERSONAL_DASHBOARD_SORT_FIELDS

from .base import BaseModel


def default_personal_dashboard_columns():
    return list(DEFAULT_PERSONAL_DASHBOARD_COLUMNS)


class PersonalDashboardView(BaseModel):
    owner = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        on_delete=models.CASCADE,
        related_name="personal_dashboard_views",
    )
    name = models.CharField(max_length=100)
    filters = models.JSONField(default=dict)
    columns = models.JSONField(default=default_personal_dashboard_columns)
    sort_by = models.CharField(
        max_length=32,
        choices=[(field, field.replace("_", " ").title()) for field in PERSONAL_DASHBOARD_SORT_FIELDS],
        default="due_date",
    )
    sort_direction = models.CharField(
        max_length=4,
        choices=(("asc", "Ascending"), ("desc", "Descending")),
        default="asc",
    )
    is_favorite = models.BooleanField(default=False)

    class Meta:
        db_table = "personal_dashboard_views"
        ordering = ("-is_favorite", "-updated_at", "name")
        constraints = [
            models.UniqueConstraint(
                Lower("name"),
                "owner",
                condition=models.Q(deleted_at__isnull=True),
                name="pdv_owner_name_ci_live_uniq",
            )
        ]
        indexes = [models.Index(fields=("owner", "is_favorite", "updated_at"), name="pdv_owner_favorite_idx")]
