# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.urls import path

from plane.space.views.dntt import DnttPublicMonthDownloadEndpoint, DnttPublicMonthEndpoint

urlpatterns = [
    path("dntt/<str:token>/download/", DnttPublicMonthDownloadEndpoint.as_view(), name="dntt-public-download"),
    path("dntt/<str:token>/", DnttPublicMonthEndpoint.as_view(), name="dntt-public-month"),
]
