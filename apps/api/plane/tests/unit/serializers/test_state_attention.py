# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.app.serializers.state import StateLiteSerializer, StateSerializer
from plane.db.models import State

pytestmark = pytest.mark.unit
OPEN_GROUPS = ["backlog", "unstarted", "started"]


def test_model_and_serializers_default_to_normal_without_database():
    state = State(name="Blocked / Tạm dừng", color="#123456")
    assert state.attention_kind == "normal"
    assert StateSerializer(state).data["attention_kind"] == "normal"
    assert StateLiteSerializer(state).data["attention_kind"] == "normal"


@pytest.mark.parametrize("group", OPEN_GROUPS + ["completed", "cancelled"])
@pytest.mark.parametrize("kind", ["normal", "blocked", "paused"])
def test_create_validates_group_and_attention_kind(group, kind):
    serializer = StateSerializer(data={"name": "State", "color": "#123456", "group": group, "attention_kind": kind})
    expected = kind == "normal" or group in OPEN_GROUPS
    assert serializer.is_valid() is expected, serializer.errors
    if expected:
        assert serializer.validated_data["attention_kind"] == kind
    else:
        assert "attention_kind" in serializer.errors


@pytest.mark.parametrize("kind", [None, "", "unknown", 123, [], {}, "blоcked", "paused​"])
def test_create_rejects_invalid_attention_values(kind):
    serializer = StateSerializer(data={"name": "State", "color": "#123456", "attention_kind": kind})
    assert not serializer.is_valid()
    assert "attention_kind" in serializer.errors


@pytest.mark.parametrize("group", ["completed", "cancelled", "triage"])
@pytest.mark.parametrize("kind", ["blocked", "paused"])
def test_patch_attention_only_uses_existing_terminal_group(group, kind):
    state = State(name="State", color="#123456", group=group)
    serializer = StateSerializer(state, data={"attention_kind": kind}, partial=True)
    assert not serializer.is_valid()
    assert "attention_kind" in serializer.errors


@pytest.mark.parametrize("group", ["completed", "cancelled", "triage"])
@pytest.mark.parametrize("kind", ["blocked", "paused"])
def test_patch_group_only_uses_existing_attention_kind(group, kind):
    state = State(name="State", color="#123456", group="started")
    state.attention_kind = kind
    serializer = StateSerializer(state, data={"group": group}, partial=True)
    assert not serializer.is_valid()


@pytest.mark.parametrize(
    "changes", [{}, {"name": "Đổi tên ' 🚀"}, {"group": "unstarted"}, {"attention_kind": "paused"}]
)
def test_patch_preserves_effective_open_classification(changes):
    state = State(name="State", color="#123456", group="started")
    state.attention_kind = "blocked"
    serializer = StateSerializer(state, data=changes, partial=True)
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data == changes


def test_patch_can_clear_attention_and_move_to_completed_together():
    state = State(name="State", color="#123456", group="started")
    state.attention_kind = "blocked"
    serializer = StateSerializer(state, data={"group": "completed", "attention_kind": "normal"}, partial=True)
    assert serializer.is_valid(), serializer.errors


def test_create_uses_default_group_and_keeps_triage_restriction():
    serializer = StateSerializer(data={"name": "State", "color": "#123456", "attention_kind": "paused"})
    assert serializer.is_valid(), serializer.errors
    assert serializer.validated_data["attention_kind"] == "paused"
    triage = StateSerializer(data={"name": "State", "color": "#123456", "group": "triage"})
    assert not triage.is_valid()


@pytest.mark.parametrize("kind", ["normal", "blocked", "paused"])
def test_lite_serialization_exposes_read_only_attention_kind(kind):
    state = State(name="State", color="#123456", group="started")
    state.attention_kind = kind
    assert StateLiteSerializer(state).data["attention_kind"] == kind
    assert StateLiteSerializer().fields["attention_kind"].read_only
