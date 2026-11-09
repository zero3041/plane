# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from __future__ import annotations

import hashlib
import secrets
from decimal import Decimal

from django.conf import settings
from django.core.paginator import Paginator
from django.db import transaction
from django.db.models import Count, Max, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from django.utils import timezone
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from rest_framework import status
from rest_framework.parsers import FormParser, JSONParser, MultiPartParser
from rest_framework.permissions import IsAuthenticated
from rest_framework.response import Response
from rest_framework.exceptions import ParseError

from plane.app.views.base import BaseAPIView
from plane.db.models import DnttEntry, DnttImport, DnttMonth, DnttUploaderPermission
from plane.dntt.permissions import DnttUploaderAccessPermission, is_dntt_uploader, normalized_email
from plane.dntt.services import (
    create_dntt_import,
    parse_report_month,
    validate_allowlisted_email,
    validate_xlsx_upload,
)
from plane.license.api.permissions.instance import InstanceAdminPermission


def _format_amount(value) -> str | None:
    return None if value is None else format(Decimal(value), "f")


def _serialize_import(import_version: DnttImport) -> dict:
    errors = import_version.errors or []
    excluded_sheets = (import_version.summary or {}).get("excluded_month_sheets", [])
    return {
        "id": str(import_version.pk),
        "month": import_version.month.report_month.strftime("%Y-%m"),
        "report_month": import_version.month.report_month.strftime("%Y-%m"),
        "revision": import_version.revision,
        "filename": import_version.original_filename,
        "original_filename": import_version.original_filename,
        "uploader_email": import_version.uploader_email,
        "status": import_version.status,
        "summary": import_version.summary or {},
        "errors": errors,
        "error_message": errors[0] if errors else None,
        "uploaded_at": import_version.created_at.isoformat() if import_version.created_at else None,
        "created_at": import_version.created_at.isoformat() if import_version.created_at else None,
        "processed_at": import_version.processed_at.isoformat() if import_version.processed_at else None,
        "published_at": import_version.published_at.isoformat() if import_version.published_at else None,
        "is_current": import_version.month.current_import_id == import_version.pk,
        "excluded_month_sheets": excluded_sheets,
    }


class DnttAccessEndpoint(BaseAPIView):
    permission_classes = [IsAuthenticated]

    def get(self, request):
        return Response(
            {
                "can_upload": is_dntt_uploader(request.user),
                "can_manage_permissions": InstanceAdminPermission().has_permission(request, self),
            },
            status=status.HTTP_200_OK,
        )


class DnttUploaderPermissionEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]
    parser_classes = [JSONParser, FormParser]

    def get(self, request):
        rows = DnttUploaderPermission.objects.order_by("email")
        return Response(
            {
                "results": [
                    {
                        "id": str(row.pk),
                        "email": row.email,
                        "is_active": row.is_active,
                        "created_at": row.created_at.isoformat() if row.created_at else None,
                        "revoked_at": row.revoked_at.isoformat() if row.revoked_at else None,
                    }
                    for row in rows
                ]
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request):
        email = validate_allowlisted_email(request.data.get("email", ""))
        permission = DnttUploaderPermission.all_objects.filter(email=email).first()
        if permission:
            permission.is_active = True
            permission.granted_by = request.user
            permission.revoked_by = None
            permission.revoked_at = None
            permission.deleted_at = None
            permission.save()
            created = False
        else:
            permission = DnttUploaderPermission.objects.create(email=email, granted_by=request.user)
            created = True
        return Response(
            {
                "id": str(permission.pk),
                "email": permission.email,
                "is_active": permission.is_active,
                "created_at": permission.created_at.isoformat() if permission.created_at else None,
            },
            status=status.HTTP_201_CREATED if created else status.HTTP_200_OK,
        )


class DnttUploaderPermissionDetailEndpoint(BaseAPIView):
    permission_classes = [InstanceAdminPermission]

    def delete(self, request, pk):
        permission = get_object_or_404(DnttUploaderPermission, pk=pk)
        permission.is_active = False
        permission.revoked_by = request.user
        permission.revoked_at = timezone.now()
        permission.save(update_fields=["is_active", "revoked_by", "revoked_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)


class DnttMonthImportsEndpoint(BaseAPIView):
    permission_classes = [DnttUploaderAccessPermission]
    parser_classes = [MultiPartParser, FormParser]

    def get(self, request, report_month):
        month_date = parse_report_month(report_month)
        month = DnttMonth.objects.filter(report_month=month_date).select_related("current_import").first()
        imports = (
            DnttImport.objects.filter(month__report_month=month_date)
            .select_related("month")
            .order_by("-revision")
        )
        return Response(
            {
                "results": [_serialize_import(import_version) for import_version in imports],
                "current_import": _serialize_import(month.current_import) if month and month.current_import else None,
            },
            status=status.HTTP_200_OK,
        )

    def post(self, request, report_month):
        month_date = parse_report_month(report_month)
        requested_month = request.data.get("month")
        if requested_month and parse_report_month(requested_month) != month_date:
            raise ParseError("The upload month must match the requested report month.")
        uploaded_file = request.FILES.get("file")
        if uploaded_file is None:
            raise ParseError("An .xlsx workbook is required.")
        validate_xlsx_upload(uploaded_file)
        try:
            import_version, created = create_dntt_import(uploaded_file, request.user, month_date)
        except RuntimeError as error:
            return Response({"error": str(error)}, status=status.HTTP_503_SERVICE_UNAVAILABLE)
        body = _serialize_import(import_version)
        return Response(body, status=status.HTTP_202_ACCEPTED if created else status.HTTP_200_OK)


class DnttImportDetailEndpoint(BaseAPIView):
    permission_classes = [DnttUploaderAccessPermission]

    def get(self, request, pk):
        import_version = get_object_or_404(DnttImport.objects.select_related("month"), pk=pk)
        payload = _serialize_import(import_version)
        if import_version.status in {
            DnttImport.Status.READY,
            DnttImport.Status.PUBLISHED,
            DnttImport.Status.SUPERSEDED,
        }:
            payload["preview_rows"] = [
                {
                    "date": entry.report_date.isoformat(),
                    "category": entry.category,
                    "request_number": entry.request_number,
                    "requester": entry.requester,
                    "department": entry.department,
                    "description": entry.description,
                    "amount": _format_amount(entry.amount),
                }
                for entry in DnttEntry.objects.filter(import_version=import_version)
                .order_by("report_date", "category", "request_number", "source_row")[:8]
            ]
        return Response(payload, status=status.HTTP_200_OK)


class DnttImportPublishEndpoint(BaseAPIView):
    permission_classes = [DnttUploaderAccessPermission]

    def post(self, request, pk):
        with transaction.atomic():
            import_version = get_object_or_404(
                DnttImport.objects.select_for_update().select_related("month"), pk=pk
            )
            month = DnttMonth.objects.select_for_update().get(pk=import_version.month_id)
            if import_version.status not in {DnttImport.Status.READY, DnttImport.Status.PUBLISHED, DnttImport.Status.SUPERSEDED}:
                return Response(
                    {"error": "Only a successfully processed snapshot can be published."},
                    status=status.HTTP_409_CONFLICT,
                )
            if import_version.status == DnttImport.Status.READY:
                latest_revision = month.imports.exclude(status=DnttImport.Status.FAILED).aggregate(
                    max_revision=Max("revision")
                )["max_revision"]
                if latest_revision != import_version.revision:
                    return Response(
                        {"error": "A newer snapshot exists. Refresh the history and publish the latest version."},
                        status=status.HTTP_409_CONFLICT,
                    )
            previous = month.current_import
            if previous and previous.pk != import_version.pk:
                DnttImport.objects.filter(pk=previous.pk).update(status=DnttImport.Status.SUPERSEDED)
            import_version.status = DnttImport.Status.PUBLISHED
            import_version.published_at = timezone.now()
            import_version.save(update_fields=["status", "published_at", "updated_at"])
            month.current_import = import_version
            month.save(update_fields=["current_import", "updated_at"])
            import_version.month = month
        return Response(_serialize_import(import_version), status=status.HTTP_200_OK)


class DnttMonthShareLinkEndpoint(BaseAPIView):
    permission_classes = [DnttUploaderAccessPermission]

    def get(self, request, report_month):
        month_date = parse_report_month(report_month)
        month = DnttMonth.objects.filter(report_month=month_date).first()
        return Response(
            {"active": bool(month and month.current_import_id and month.share_token_hash)},
            status=status.HTTP_200_OK,
        )

    def post(self, request, report_month):
        month_date = parse_report_month(report_month)
        month = get_object_or_404(DnttMonth.objects.select_related("current_import"), report_month=month_date)
        if not month.current_import_id:
            return Response({"error": "Publish a DNTT snapshot before creating a share link."}, status=409)
        raw_token = secrets.token_urlsafe(32)
        month.share_token_hash = hashlib.sha256(raw_token.encode("utf-8")).hexdigest()
        month.share_link_created_at = timezone.now()
        month.share_link_revoked_at = None
        month.save(update_fields=["share_token_hash", "share_link_created_at", "share_link_revoked_at", "updated_at"])
        base_url = (getattr(settings, "SPACE_BASE_URL", "") or "http://localhost:3002").rstrip("/")
        base_path = (getattr(settings, "SPACE_BASE_PATH", "") or "").strip("/")
        path = f"/{base_path}" if base_path else ""
        return Response({"url": f"{base_url}{path}/dntt/{raw_token}"}, status=status.HTTP_201_CREATED)

    def delete(self, request, report_month):
        month_date = parse_report_month(report_month)
        month = get_object_or_404(DnttMonth, report_month=month_date)
        month.share_token_hash = None
        month.share_link_revoked_at = timezone.now()
        month.save(update_fields=["share_token_hash", "share_link_revoked_at", "updated_at"])
        return Response(status=status.HTTP_204_NO_CONTENT)
