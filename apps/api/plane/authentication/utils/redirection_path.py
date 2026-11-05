# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from plane.db.models import Profile


def get_redirection_path(user):
    profile, _ = Profile.objects.get_or_create(user=user)

    # Explicit next_path remains the responsibility of the authentication caller.
    if not profile.is_onboarded:
        return "onboarding"

    # The personal dashboard also handles users without a workspace.
    return "/"
