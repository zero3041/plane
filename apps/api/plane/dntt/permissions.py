# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from rest_framework.permissions import BasePermission

from plane.db.models import DnttUploaderPermission


def normalized_email(email: str | None) -> str:
    return (email or "").strip().casefold()


def is_dntt_uploader(user) -> bool:
    email = normalized_email(getattr(user, "email", None))
    return bool(
        user
        and user.is_authenticated
        and getattr(user, "is_email_verified", False)
        and email
        and DnttUploaderPermission.objects.filter(email=email, is_active=True).exists()
    )


class DnttUploaderAccessPermission(BasePermission):
    """Require a signed-in user with a verified, explicitly allowlisted email."""

    def has_permission(self, request, view):
        return is_dntt_uploader(request.user)
