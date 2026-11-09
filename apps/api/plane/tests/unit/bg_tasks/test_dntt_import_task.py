# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date
from decimal import Decimal
from hashlib import sha256
from io import BytesIO
from types import SimpleNamespace
from unittest.mock import Mock, patch

import pytest
from openpyxl import Workbook

from plane.bgtasks.dntt_import_task import process_dntt_import
from plane.db.models import DnttEntry, DnttImport, DnttMonth, DnttSheet

pytestmark = [pytest.mark.unit, pytest.mark.django_db]


class FakeS3Body:
    def __init__(self, content: bytes):
        self.stream = BytesIO(content)

    def iter_chunks(self, chunk_size=64 * 1024):
        while chunk := self.stream.read(chunk_size):
            yield chunk

    def close(self):
        self.stream.close()


def make_workbook() -> bytes:
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "31.10 TMDV"
    sheet.append(["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"])
    sheet.append([1, "Người đề nghị", "Kế toán", "DNTT-31", "Chi phí", 125000])
    buffer = BytesIO()
    workbook.save(buffer)
    return buffer.getvalue()


def test_processing_task_persists_selected_month_rows_and_summary(create_user):
    content = make_workbook()
    month = DnttMonth.objects.create(report_month=date(2026, 10, 1))
    import_version = DnttImport.objects.create(
        month=month,
        revision=1,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="snapshot.xlsx",
        source_key="dntt/private/2026-10/source.xlsx",
        source_file_size=len(content),
        checksum=sha256(content).hexdigest(),
        status=DnttImport.Status.QUEUED,
    )
    fake_storage = SimpleNamespace(
        aws_storage_bucket_name="uploads",
        s3_client=Mock(get_object=Mock(return_value={"Body": FakeS3Body(content)})),
    )

    with patch("plane.bgtasks.dntt_import_task.S3Storage", return_value=fake_storage):
        process_dntt_import.run(str(import_version.pk))

    import_version.refresh_from_db()
    assert import_version.status == DnttImport.Status.READY
    assert import_version.summary["selected_month_rows"] == 1
    assert import_version.summary["category_counts"] == {"TMDV": 1}
    assert DnttSheet.objects.filter(import_version=import_version, source_name="31.10 TMDV").count() == 1
    entry = DnttEntry.objects.get(import_version=import_version)
    assert entry.report_date == date(2026, 10, 31)
    assert entry.request_number == "DNTT-31"
    assert entry.amount == Decimal("125000")


def test_processing_task_is_idempotent_after_a_snapshot_is_ready(create_user):
    month = DnttMonth.objects.create(report_month=date(2026, 10, 1))
    import_version = DnttImport.objects.create(
        month=month,
        revision=1,
        uploaded_by=create_user,
        uploader_email=create_user.email,
        original_filename="snapshot.xlsx",
        source_key="dntt/private/2026-10/source.xlsx",
        source_file_size=1,
        checksum="d" * 64,
        status=DnttImport.Status.READY,
    )

    with patch("plane.bgtasks.dntt_import_task.S3Storage") as storage:
        process_dntt_import.run(str(import_version.pk))

    storage.assert_not_called()
    assert DnttEntry.objects.filter(import_version=import_version).count() == 0
