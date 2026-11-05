# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from types import SimpleNamespace
from unittest.mock import patch
from urllib.parse import parse_qs, urlparse
from uuid import uuid4

import pytest
from django.test import RequestFactory

from plane.authentication.utils.redirection_path import get_redirection_path
from plane.authentication.views.app.email import SignInAuthEndpoint

pytestmark = pytest.mark.unit
MODULE = "plane.authentication.utils.redirection_path"
EMAIL_MODULE = "plane.authentication.views.app.email"


@pytest.mark.parametrize(
    "onboarded,last_workspace,expected",
    [
        (False, None, "onboarding"),
        (False, "previous", "onboarding"),
        (True, None, "/"),
        (True, "previous", "/"),
    ],
)
def test_default_redirect_keeps_onboarding_and_otherwise_returns_root(onboarded, last_workspace, expected):
    profile = SimpleNamespace(is_onboarded=onboarded, last_workspace_id=uuid4() if last_workspace else None)
    with (
        patch(f"{MODULE}.Profile.objects.get_or_create", return_value=(profile, False)),
        patch("plane.db.models.Workspace.objects.filter") as workspaces,
    ):
        workspaces.return_value.first.return_value = SimpleNamespace(slug="previous")
        workspaces.return_value.order_by.return_value.first.return_value = SimpleNamespace(slug="previous")
        assert get_redirection_path(SimpleNamespace(id=uuid4(), email="user@plane.so")) == expected


@pytest.mark.parametrize(
    "next_path,onboarded,expected",
    [
        (None, True, "/"),
        (None, False, None),
        ("/department/projects/project/issues/task", True, "/department/projects/project/issues/task"),
        ("/invitations", True, "/invitations"),
    ],
)
def test_email_login_preserves_explicit_next_path(next_path, onboarded, expected):
    user = SimpleNamespace(id=uuid4(), email="user@plane.so")
    profile = SimpleNamespace(is_onboarded=onboarded, last_workspace_id=None)
    data = {"email": user.email, "password": "test-password"}
    if next_path is not None:
        data["next_path"] = next_path
    request = RequestFactory().post("/auth/sign-in/", data)
    with (
        patch("plane.authentication.rate_limit.authentication_throttle_allows", return_value=True),
        patch(f"{EMAIL_MODULE}.Instance.objects.first", return_value=SimpleNamespace(is_setup_done=True)),
        patch(f"{EMAIL_MODULE}.User.objects.filter") as users,
        patch(f"{EMAIL_MODULE}.EmailProvider") as provider,
        patch(f"{EMAIL_MODULE}.user_login") as login,
        patch(f"{EMAIL_MODULE}.base_host", return_value="http://localhost:3000"),
        patch("plane.utils.path_validator.get_allowed_hosts", return_value={"localhost:3000"}),
        patch(f"{MODULE}.Profile.objects.get_or_create", return_value=(profile, False)),
        patch("plane.db.models.Workspace.objects.filter") as workspaces,
    ):
        workspaces.return_value.first.return_value = SimpleNamespace(slug="previous")
        workspaces.return_value.order_by.return_value.first.return_value = SimpleNamespace(slug="previous")
        users.return_value.first.return_value = user
        provider.return_value.authenticate.return_value = user
        response = SignInAuthEndpoint.as_view()(request)
    assert response.status_code == 302
    assert parse_qs(urlparse(response.url).query).get("next_path") == ([expected] if expected else None)
    login.assert_called_once_with(request=request, user=user, is_app=True)
