# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

# Module imports
from .base import BaseSerializer
from rest_framework import serializers

from plane.db.models import State, StateGroup


class StateSerializer(BaseSerializer):
    order = serializers.FloatField(required=False)
    attention_kind = serializers.ChoiceField(
        choices=State.AttentionKind.choices,
        default=State.AttentionKind.NORMAL,
    )

    class Meta:
        model = State
        fields = [
            "id",
            "project_id",
            "workspace_id",
            "name",
            "color",
            "group",
            "attention_kind",
            "default",
            "description",
            "sequence",
            "order",
        ]
        read_only_fields = ["workspace", "project"]

    def validate(self, attrs):
        effective_group = attrs.get("group", getattr(self.instance, "group", StateGroup.BACKLOG.value))
        effective_attention_kind = attrs.get(
            "attention_kind",
            getattr(self.instance, "attention_kind", State.AttentionKind.NORMAL),
        )
        if effective_attention_kind != State.AttentionKind.NORMAL and effective_group not in {
            StateGroup.BACKLOG.value,
            StateGroup.UNSTARTED.value,
            StateGroup.STARTED.value,
        }:
            raise serializers.ValidationError({"attention_kind": "Only open states can be blocked or paused."})
        if attrs.get("group") == StateGroup.TRIAGE.value:
            raise serializers.ValidationError("Cannot create triage state")
        return attrs


class StateLiteSerializer(BaseSerializer):
    class Meta:
        model = State
        fields = ["id", "name", "color", "group", "attention_kind"]
        read_only_fields = fields
