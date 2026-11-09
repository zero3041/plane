# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hashlib
import re
import secrets
from datetime import date
from decimal import Decimal
from io import BytesIO
from unittest.mock import patch
from uuid import uuid4

import pytest
from django.core.files.uploadedfile import SimpleUploadedFile
from django.utils import timezone
from openpyxl import Workbook
from openpyxl import load_workbook

from plane.db.models import DnttEntry, DnttImport, DnttMonth, DnttSheet, DnttUploaderPermission
from plane.license.models import Instance, InstanceAdmin

pytestmark = [pytest.mark.contract, pytest.mark.django_db]


def workbook_upload():
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "31.10 TMDV"
    sheet.append(["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"])
    sheet.append([1, "Người đề nghị", "Phòng", "DNTT-1", "Chi phí", 120000])
    buffer = BytesIO()
    workbook.save(buffer)
    return SimpleUploadedFile(
        "Bàn giao ĐNTT tháng 10.2026.xlsx",
        buffer.getvalue(),
        content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
    )


def test_access_endpoint_reports_upload_and_allowlist_capabilities(session_client):
    response = session_client.get("/api/dntt/admin/access/")

    assert response.status_code == 200
    assert response.json() == {"can_upload": False, "can_manage_permissions": False}


def test_unknown_public_token_returns_json_not_an_auth_redirect(api_client):
    response = api_client.get("/api/public/dntt/unknown-token/")

    assert response.status_code == 404
    assert response["Content-Type"].startswith("application/json")


def test_upload_is_denied_without_allowlisted_verified_email(session_client):
    response = session_client.post(
        "/api/dntt/admin/months/2026-10/imports/",
        {"file": workbook_upload()},
        format="multipart",
    )

    assert response.status_code == 403


def test_instance_admin_can_grant_verified_email_uploader_access(session_client, create_user):
    instance = Instance.objects.create(
        instance_name="DNTT test",
        instance_id=uuid4().hex,
        current_version="1.0.0",
        last_checked_at=timezone.now(),
    )
    InstanceAdmin.objects.create(instance=instance, user=create_user, role=20)
    create_user.email = "Uploader@Example.com"
    create_user.is_email_verified = False
    create_user.save(update_fields=["email", "is_email_verified"])

    created = session_client.post("/api/dntt/admin/permissions/", {"email": " uploader@example.com "}, format="json")
    assert created.status_code == 201
    assert created.json()["email"] == "uploader@example.com"
    assert DnttUploaderPermission.objects.get().email == "uploader@example.com"
    assert session_client.get("/api/dntt/admin/access/").json()["can_upload"] is False

    create_user.is_email_verified = True
    create_user.save(update_fields=["is_email_verified"])
    assert session_client.get("/api/dntt/admin/access/").json()["can_upload"] is True


def test_non_instance_admin_cannot_change_uploader_allowlist(session_client):
    response = session_client.post(
        "/api/dntt/admin/permissions/",
        {"email": "uploader@example.com"},
        format="json",
    )

    assert response.status_code == 403


@pytest.mark.django_db(transaction=True)
def test_allowlisted_verified_user_can_upload_a_private_full_snapshot(session_client, create_user):
    create_user.is_email_verified = True
    create_user.save(update_fields=["is_email_verified"])
    DnttUploaderPermission.objects.create(email=create_user.email, granted_by=create_user)

    with patch("plane.dntt.services.S3Storage.upload_file", return_value=True) as store_file, patch(
        "plane.dntt.services._queue_dntt_import"
    ) as queue_import:
        response = session_client.post(
            "/api/dntt/admin/months/2026-10/imports/",
            {"file": workbook_upload(), "month": "2026-10"},
            format="multipart",
        )

    assert response.status_code == 202
    created = DnttImport.objects.get(pk=response.json()["id"])
    assert created.status == DnttImport.Status.QUEUED
    assert created.month.report_month == date(2026, 10, 1)
    assert created.source_key.startswith("dntt/private/2026-10/")
    assert created.source_file_size > 0
    assert "source_key" not in response.json()
    assert store_file.call_args.kwargs["extra_args"]["ACL"] == "private"
    queue_import.assert_called_once_with(created.pk)


def test_duplicate_full_snapshot_upload_is_idempotent(session_client, create_user):
    create_user.is_email_verified = True
    create_user.save(update_fields=["is_email_verified"])
    DnttUploaderPermission.objects.create(email=create_user.email, granted_by=create_user)
    file_contents = workbook_upload().read()

    def duplicate_upload():
        return SimpleUploadedFile(
            "snapshot.xlsx",
            file_contents,
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )

    with patch("plane.dntt.services.S3Storage.upload_file", return_value=True), patch(
        "plane.dntt.services._queue_dntt_import"
    ):
        first = session_client.post(
            "/api/dntt/admin/months/2026-10/imports/", {"file": duplicate_upload(), "month": "2026-10"}, format="multipart"
        )
        second = session_client.post(
            "/api/dntt/admin/months/2026-10/imports/",
            {"file": duplicate_upload(), "month": "2026-10"},
            format="multipart",
        )

    assert first.status_code == 202
    assert second.status_code == 200
    assert first.json()["id"] == second.json()["id"]
    assert DnttImport.objects.filter(month__report_month=date(2026, 10, 1)).count() == 1


def test_public_month_link_filters_out_other_months_and_exports_only_selected_month(api_client, create_user):
    month = DnttMonth.objects.create(report_month=date(2026, 10, 1))
    import_version = DnttImport.objects.create(
        month=month,
        revision=1,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="snapshot.xlsx",
        source_key="dntt/private/2026-10/source.xlsx",
        source_file_size=100,
        checksum="a" * 64,
        status=DnttImport.Status.PUBLISHED,
        published_at=timezone.now(),
    )
    month.current_import = import_version
    token = secrets.token_urlsafe(32)
    month.share_token_hash = hashlib.sha256(token.encode()).hexdigest()
    month.save(update_fields=["current_import", "share_token_hash", "updated_at"])
    sheet = DnttSheet.objects.create(
        import_version=import_version,
        source_index=1,
        source_name="31.10 TMDV",
        report_date=date(2026, 10, 31),
        category="TMDV",
        row_count=2,
    )
    DnttEntry.objects.create(
        import_version=import_version,
        sheet=sheet,
        source_row=4,
        report_date=date(2026, 10, 31),
        category="TMDV",
        requester="Người tháng 10",
        department="Bộ phận A",
        request_number="DNTT-10",
        description="Dòng tháng 10",
        amount=Decimal("100000"),
    )
    DnttEntry.objects.create(
        import_version=import_version,
        sheet=sheet,
        source_row=5,
        report_date=date(2026, 10, 31),
        category="TMDV",
        requester="Người tháng 10",
        department="Bộ phận A",
        request_number="DNTT-10",
        description="Dòng thứ hai của cùng DNTT",
        amount=Decimal("50000"),
    )
    DnttEntry.objects.create(
        import_version=import_version,
        sheet=sheet,
        source_row=6,
        report_date=date(2026, 9, 30),
        category="TMDV",
        requester="Người tháng 9",
        department="Bộ phận A",
        request_number="DNTT-09",
        description="Dòng tháng 9 không được lộ",
        amount=Decimal("200000"),
    )

    response = api_client.get(f"/api/public/dntt/{token}/")
    assert response.status_code == 200
    assert response["Cache-Control"] == "no-store"
    payload = response.json()
    assert payload["month"] == "2026-10"
    assert payload["month_total_count"] == 1
    assert payload["month_total_amount"] == "150000"
    assert [row["request_number"] for row in payload["results"]] == ["DNTT-10"]
    assert payload["results"][0]["line_count"] == 2
    assert payload["results"][0]["amount"] == "150000"

    filtered = api_client.get(f"/api/public/dntt/{token}/", {"q": "thứ hai", "per_page": 1})
    assert filtered.status_code == 200
    assert filtered.json()["total_count"] == 1
    assert filtered.json()["results"][0]["line_count"] == 2

    download = api_client.get(f"/api/public/dntt/{token}/download/")
    assert download.status_code == 200
    workbook = load_workbook(BytesIO(download.content), read_only=True, data_only=True)
    values = [cell for row in workbook.active.iter_rows(values_only=True) for cell in row if isinstance(cell, str)]
    workbook.close()
    assert "DNTT-10" in values
    assert "DNTT-09" not in values


def test_uploader_import_detail_includes_a_small_admin_only_preview(session_client, create_user):
    create_user.is_email_verified = True
    create_user.save(update_fields=["is_email_verified"])
    DnttUploaderPermission.objects.create(email=create_user.email, granted_by=create_user)
    month = DnttMonth.objects.create(report_month=date(2026, 10, 1))
    import_version = DnttImport.objects.create(
        month=month,
        revision=1,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="snapshot.xlsx",
        source_key="dntt/private/2026-10/source.xlsx",
        source_file_size=100,
        checksum="e" * 64,
        status=DnttImport.Status.READY,
    )
    sheet = DnttSheet.objects.create(
        import_version=import_version,
        source_index=1,
        source_name="31.10 TMDV",
        report_date=date(2026, 10, 31),
        category="TMDV",
        row_count=1,
    )
    DnttEntry.objects.create(
        import_version=import_version,
        sheet=sheet,
        source_row=4,
        report_date=date(2026, 10, 31),
        category="TMDV",
        requester="Người đề nghị",
        department="Bộ phận A",
        request_number="DNTT-31",
        description="Chi phí",
        amount=Decimal("125000"),
    )

    response = session_client.get(f"/api/dntt/admin/imports/{import_version.pk}/")

    assert response.status_code == 200
    assert response.json()["preview_rows"] == [
        {
            "date": "2026-10-31",
            "category": "TMDV",
            "request_number": "DNTT-31",
            "requester": "Người đề nghị",
            "department": "Bộ phận A",
            "description": "Chi phí",
            "amount": "125000",
        }
    ]
    assert "source_key" not in response.json()


def test_share_link_can_be_created_and_revoked(session_client, create_user, api_client):
    create_user.is_email_verified = True
    create_user.save(update_fields=["is_email_verified"])
    DnttUploaderPermission.objects.create(email=create_user.email, granted_by=create_user)
    month = DnttMonth.objects.create(report_month=date(2026, 10, 1))
    import_version = DnttImport.objects.create(
        month=month,
        revision=1,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="snapshot.xlsx",
        source_key="dntt/private/2026-10/source.xlsx",
        source_file_size=100,
        checksum="b" * 64,
        status=DnttImport.Status.READY,
    )
    month.current_import = import_version
    month.save(update_fields=["current_import", "updated_at"])
    publish = session_client.post(f"/api/dntt/admin/imports/{import_version.pk}/publish/")
    assert publish.status_code == 200

    created = session_client.post("/api/dntt/admin/months/2026-10/share-link/")
    assert created.status_code == 201
    token_match = re.search(r"/dntt/([A-Za-z0-9_-]{40,64})/?$", created.json()["url"])
    assert token_match
    token = token_match.group(1)
    assert session_client.get("/api/dntt/admin/months/2026-10/share-link/").json() == {"active": True}
    assert api_client.get(f"/api/public/dntt/{token}/").status_code == 200

    revoked = session_client.delete("/api/dntt/admin/months/2026-10/share-link/")
    assert revoked.status_code == 204
    assert session_client.get("/api/dntt/admin/months/2026-10/share-link/").json() == {"active": False}
    assert api_client.get(f"/api/public/dntt/{token}/").status_code == 404


def test_failed_newer_upload_does_not_block_publishing_valid_snapshot(session_client, create_user):
    create_user.is_email_verified = True
    create_user.save(update_fields=["is_email_verified"])
    DnttUploaderPermission.objects.create(email=create_user.email, granted_by=create_user)
    month = DnttMonth.objects.create(report_month=date(2026, 10, 1))
    valid = DnttImport.objects.create(
        month=month,
        revision=1,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="valid.xlsx",
        source_key="dntt/private/2026-10/valid.xlsx",
        source_file_size=100,
        checksum="f" * 64,
        status=DnttImport.Status.READY,
    )
    DnttImport.objects.create(
        month=month,
        revision=2,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="failed.xlsx",
        source_key="dntt/private/2026-10/failed.xlsx",
        source_file_size=100,
        checksum="a" * 64,
        status=DnttImport.Status.FAILED,
    )

    response = session_client.post(f"/api/dntt/admin/imports/{valid.pk}/publish/")

    assert response.status_code == 200
    month.refresh_from_db()
    assert month.current_import_id == valid.pk
