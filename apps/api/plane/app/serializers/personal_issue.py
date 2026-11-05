# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework import serializers


class PersonalIssueSerializer(serializers.Serializer):
    """The small, stable representation used by the cross-workspace issue list."""

    def to_representation(self, instance):
        return {
            "id": str(instance.id),
            "name": instance.name,
            "sequence_id": instance.sequence_id,
            "priority": instance.priority,
            "start_date": instance.start_date,
            "target_date": instance.target_date,
            "state": {
                "id": str(instance.state_id),
                "name": instance.state.name,
                "color": instance.state.color,
                "group": instance.state.group,
                "attention_kind": instance.state.attention_kind,
            },
            "project": {
                "id": str(instance.project_id),
                "name": instance.project.name,
                "identifier": instance.project.identifier,
            },
            "workspace": {
                "id": str(instance.workspace_id),
                "name": instance.workspace.name,
                "slug": instance.workspace.slug,
            },
        }
