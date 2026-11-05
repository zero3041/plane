# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import pytest

from plane.db.models import Project, ProjectMember, State, WorkspaceMember

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


@pytest.fixture
def state_data(workspace, create_user):
    project = Project.objects.create(name="Project", identifier="STATE", workspace=workspace)
    ProjectMember.objects.create(project=project, workspace=workspace, member=create_user, role=20)
    state = State.objects.create(
        project=project, workspace=workspace, name="Workflow", group="started", color="#123456"
    )
    url = f"/api/workspaces/{workspace.slug}/projects/{project.id}/states/"
    return project, state, url


def test_admin_create_patch_rename_and_clear_attention(session_client, state_data):
    project, _, url = state_data
    response = session_client.post(
        url, {"name": "Waiting", "color": "#123456", "group": "started", "attention_kind": "blocked"}, format="json"
    )
    assert response.status_code == 200, response.content
    state_id = response.json()["id"]
    assert response.json()["attention_kind"] == "blocked"
    detail = f"{url}{state_id}/"
    renamed = session_client.patch(detail, {"name": "Không suy diễn từ tên"}, format="json")
    assert renamed.status_code == 200, renamed.content
    assert renamed.json()["attention_kind"] == "blocked"
    invalid = session_client.patch(detail, {"group": "completed"}, format="json")
    assert invalid.status_code == 400
    state = State.objects.get(pk=state_id)
    assert state.group == "started"
    assert state.attention_kind == "blocked"
    cleared = session_client.patch(detail, {"group": "completed", "attention_kind": "normal"}, format="json")
    assert cleared.status_code == 200, cleared.content
    state.refresh_from_db()
    assert (state.group, state.attention_kind) == ("completed", "normal")
    assert state.project_id == project.id
    listed = session_client.get(url)
    assert listed.status_code == 200
    assert all("attention_kind" in row for row in listed.json())


def test_create_without_metadata_defaults_to_normal(session_client, state_data):
    _, _, url = state_data
    response = session_client.post(url, {"name": "Blocked", "color": "#123456", "group": "cancelled"}, format="json")
    assert response.status_code == 200, response.content
    assert response.json()["attention_kind"] == "normal"
    assert State.objects.get(pk=response.json()["id"]).attention_kind == "normal"


@pytest.mark.parametrize("group", ["completed", "cancelled", "triage"])
def test_create_rejects_attention_on_non_open_group(session_client, state_data, group):
    _, _, url = state_data
    response = session_client.post(
        url, {"name": "Invalid", "color": "#123456", "group": group, "attention_kind": "paused"}, format="json"
    )
    assert response.status_code == 400, response.content
    assert not State.all_state_objects.filter(name="Invalid").exists()


@pytest.mark.parametrize("scope", ["workspace_only", "inactive_project_member"])
def test_forbidden_member_cannot_update_state(session_client, create_user, state_data, scope):
    project, state, url = state_data
    WorkspaceMember.objects.filter(workspace=project.workspace, member=create_user).update(role=15)
    members = ProjectMember.objects.filter(project=project, member=create_user)
    if scope == "workspace_only":
        members.delete(soft=False)
    else:
        members.update(role=15, is_active=False)
    response = session_client.patch(f"{url}{state.id}/", {"attention_kind": "paused"}, format="json")
    assert response.status_code == 403, response.content
    state.refresh_from_db()
    assert state.attention_kind == "normal"


@pytest.mark.parametrize("role", [5, 15])
def test_existing_active_member_patch_permissions_are_not_changed(session_client, create_user, state_data, role):
    project, state, url = state_data
    WorkspaceMember.objects.filter(workspace=project.workspace, member=create_user).update(role=role)
    ProjectMember.objects.filter(project=project, member=create_user).update(role=role)
    response = session_client.patch(f"{url}{state.id}/", {"attention_kind": "paused"}, format="json")
    assert response.status_code == 200, response.content
    assert response.json()["attention_kind"] == "paused"
    forbidden = session_client.post(
        url, {"name": "New", "color": "#123456", "attention_kind": "blocked"}, format="json"
    )
    assert forbidden.status_code == 403
