# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.db import migrations, models


class Migration(migrations.Migration):
    dependencies = [
        ("db", "0123_alter_cycle_timezone_and_more"),
    ]

    operations = [
        migrations.AddField(
            model_name="state",
            name="attention_kind",
            field=models.CharField(
                choices=[("normal", "Normal"), ("blocked", "Blocked"), ("paused", "Paused")],
                default="normal",
                max_length=20,
            ),
        ),
    ]
