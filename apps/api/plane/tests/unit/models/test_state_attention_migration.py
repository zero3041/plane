# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest
from django.db import connection
from django.db.migrations.executor import MigrationExecutor

pytestmark = [pytest.mark.unit, pytest.mark.django_db(transaction=True)]


def test_attention_migration_preserves_existing_states_and_defaults_to_normal():
    before = [("db", "0123_alter_cycle_timezone_and_more")]
    after = [("db", "0124_state_attention_kind")]
    executor = MigrationExecutor(connection)
    if not executor.loader.graph.nodes:
        pytest.skip("Migration checks require pytest without the default --nomigrations option.")
    executor.migrate(before)
    old_apps = executor.loader.project_state(before).apps
    user = old_apps.get_model("db", "User").objects.create(email="migration@plane.so", username="migration")
    workspace = old_apps.get_model("db", "Workspace").objects.create(
        name="Migration", slug="migration", owner_id=user.pk
    )
    project = old_apps.get_model("db", "Project").objects.create(
        name="Migration", identifier="MIG", workspace_id=workspace.pk
    )
    old_state = old_apps.get_model("db", "State")
    states = [
        old_state.objects.create(
            name=name, group=group, project_id=project.pk, workspace_id=workspace.pk, color="#123456"
        )
        for name, group in [("Blocked", "started"), ("Paused", "cancelled"), ("Tạm dừng", "completed")]
    ]
    try:
        executor = MigrationExecutor(connection)
        executor.migrate(after)
        new_state = executor.loader.project_state(after).apps.get_model("db", "State")
        assert list(
            new_state.objects.filter(pk__in=[state.pk for state in states])
            .order_by("name")
            .values_list("name", "group", "attention_kind")
        ) == [
            ("Blocked", "started", "normal"),
            ("Paused", "cancelled", "normal"),
            ("Tạm dừng", "completed", "normal"),
        ]
    finally:
        MigrationExecutor(connection).migrate(after)
