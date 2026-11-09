# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from django.shortcuts import get_object_or_404
from rest_framework import status
from rest_framework.response import Response

from plane.app.serializers.personal_dashboard_view import PersonalDashboardViewSerializer
from plane.app.views.base import BaseAPIView
from plane.db.models import PersonalDashboardView


class PersonalDashboardViewsEndpoint(BaseAPIView):
    """List and create private dashboard views owned by the current user."""

    def get(self, request):
        views = PersonalDashboardView.objects.filter(owner=request.user).order_by("-is_favorite", "-updated_at", "name")
        return Response(PersonalDashboardViewSerializer(views, many=True).data)

    def post(self, request):
        serializer = PersonalDashboardViewSerializer(data=request.data, context={"request": request})
        serializer.is_valid(raise_exception=True)
        view = serializer.save(owner=request.user)
        return Response(PersonalDashboardViewSerializer(view).data, status=status.HTTP_201_CREATED)


class PersonalDashboardViewDetailEndpoint(BaseAPIView):
    """Read, update, or remove one of the current user's private views."""

    def get(self, request, pk):
        view = get_object_or_404(PersonalDashboardView.objects.filter(owner=request.user), pk=pk)
        return Response(PersonalDashboardViewSerializer(view).data)

    def patch(self, request, pk):
        view = get_object_or_404(PersonalDashboardView.objects.filter(owner=request.user), pk=pk)
        serializer = PersonalDashboardViewSerializer(
            view,
            data=request.data,
            partial=True,
            context={"request": request},
        )
        serializer.is_valid(raise_exception=True)
        return Response(PersonalDashboardViewSerializer(serializer.save()).data)

    def delete(self, request, pk):
        view = get_object_or_404(PersonalDashboardView.objects.filter(owner=request.user), pk=pk)
        view.delete()
        return Response(status=status.HTTP_204_NO_CONTENT)
