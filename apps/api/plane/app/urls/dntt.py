# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.app.views.dntt import (
    DnttAccessEndpoint,
    DnttImportDetailEndpoint,
    DnttImportPublishEndpoint,
    DnttMonthImportsEndpoint,
    DnttMonthShareLinkEndpoint,
    DnttUploaderPermissionDetailEndpoint,
    DnttUploaderPermissionEndpoint,
)

urlpatterns = [
    path("dntt/admin/access/", DnttAccessEndpoint.as_view(), name="dntt-admin-access"),
    path("dntt/admin/permissions/", DnttUploaderPermissionEndpoint.as_view(), name="dntt-admin-permissions"),
    path(
        "dntt/admin/permissions/<uuid:pk>/",
        DnttUploaderPermissionDetailEndpoint.as_view(),
        name="dntt-admin-permission-detail",
    ),
    path(
        "dntt/admin/months/<str:report_month>/imports/",
        DnttMonthImportsEndpoint.as_view(),
        name="dntt-admin-month-imports",
    ),
    path("dntt/admin/imports/<uuid:pk>/", DnttImportDetailEndpoint.as_view(), name="dntt-admin-import-detail"),
    path(
        "dntt/admin/imports/<uuid:pk>/publish/",
        DnttImportPublishEndpoint.as_view(),
        name="dntt-admin-import-publish",
    ),
    path(
        "dntt/admin/months/<str:report_month>/share-link/",
        DnttMonthShareLinkEndpoint.as_view(),
        name="dntt-admin-share-link",
    ),
]
