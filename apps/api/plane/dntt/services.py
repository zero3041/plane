# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from __future__ import annotations

import hashlib
import re
import tempfile
import zipfile
from datetime import date, datetime
from decimal import Decimal
from pathlib import PurePosixPath

from django.conf import settings
from django.core.exceptions import ValidationError
from django.core.validators import validate_email
from django.db import transaction
from django.db.models import Max
from django.utils import timezone
from rest_framework.exceptions import ParseError

from plane.db.models import DnttImport, DnttMonth
from plane.dntt.permissions import normalized_email
from plane.settings.storage import S3Storage
from plane.utils.dntt_workbook import (
    MAX_ARCHIVE_ENTRIES,
    MAX_COMPRESSION_RATIO,
    MAX_UNCOMPRESSED_BYTES,
    MAX_WORKBOOK_BYTES,
)

XLSX_CONTENT_TYPE = "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
DNTT_PARSER_VERSION = "1"


class _BufferedUpload:
    def __init__(self, source):
        self.name = source.name
        self._file = tempfile.SpooledTemporaryFile(max_size=8 * 1024 * 1024, mode="w+b")
        self.size = 0
        for chunk in source.chunks():
            self._file.write(chunk)
            self.size += len(chunk)
        self._file.seek(0)

    def seek(self, *args):
        return self._file.seek(*args)

    def read(self, *args):
        return self._file.read(*args)

    def chunks(self, chunk_size=64 * 1024):
        self._file.seek(0)
        while chunk := self._file.read(chunk_size):
            yield chunk

    def close(self):
        self._file.close()


def parse_report_month(value: str) -> date:
    if not isinstance(value, str) or not re.fullmatch(r"\d{4}-\d{2}", value):
        raise ParseError("month must use YYYY-MM format.")
    try:
        parsed = datetime.strptime(value, "%Y-%m")
    except ValueError as error:
        raise ParseError("month is not a valid calendar month.") from error
    return date(parsed.year, parsed.month, 1)


def validate_allowlisted_email(value: str) -> str:
    email = normalized_email(value)
    try:
        validate_email(email)
    except ValidationError as error:
        raise ParseError("A valid email address is required.") from error
    return email


def sha256_uploaded_file(uploaded_file) -> str:
    digest = hashlib.sha256()
    uploaded_file.seek(0)
    for chunk in uploaded_file.chunks():
        digest.update(chunk)
    uploaded_file.seek(0)
    return digest.hexdigest()


def validate_xlsx_upload(uploaded_file) -> None:
    max_size = min(settings.DNTT_MAX_UPLOAD_SIZE, MAX_WORKBOOK_BYTES)
    if uploaded_file.size <= 0 or uploaded_file.size > max_size:
        raise ParseError(f"Workbook size must be between 1 byte and {max_size} bytes.")
    filename = PurePosixPath((uploaded_file.name or "").replace("\\", "/")).name
    if not filename.lower().endswith(".xlsx") or filename.lower().endswith(".xlsm"):
        raise ParseError("Only .xlsx workbooks are supported.")
    uploaded_file.seek(0)
    try:
        with zipfile.ZipFile(uploaded_file) as archive:
            members = archive.infolist()
            if len(members) > MAX_ARCHIVE_ENTRIES:
                raise ParseError("Workbook contains too many internal files.")
            names = {member.filename for member in members}
            if "[Content_Types].xml" not in names or "xl/workbook.xml" not in names:
                raise ParseError("File does not contain the required XLSX workbook parts.")
            if any(name.lower().endswith("vbaProject.bin") for name in names):
                raise ParseError("Macro-enabled workbooks are not supported.")
            if sum(member.file_size for member in members) > MAX_UNCOMPRESSED_BYTES:
                raise ParseError("Workbook expands beyond the allowed uncompressed size.")
            for member in members:
                if member.file_size and (
                    member.compress_size <= 0 or member.file_size / member.compress_size > MAX_COMPRESSION_RATIO
                ):
                    raise ParseError("Workbook contains an excessive compression ratio.")
    except ParseError:
        raise
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as error:
        raise ParseError("File is not a readable XLSX workbook.") from error
    finally:
        uploaded_file.seek(0)


def store_private_workbook(uploaded_file, report_month: date, checksum: str) -> str:
    from uuid import uuid4

    object_key = f"dntt/private/{report_month:%Y-%m}/{uuid4().hex}.xlsx"
    uploaded_file.seek(0)
    storage = S3Storage()
    extra_args = {"Metadata": {"sha256": checksum}}
    if settings.DNTT_SOURCE_ACL:
        extra_args["ACL"] = settings.DNTT_SOURCE_ACL
    uploaded = storage.upload_file(
        file_obj=uploaded_file,
        object_name=object_key,
        content_type=XLSX_CONTENT_TYPE,
        extra_args=extra_args,
    )
    uploaded_file.seek(0)
    if not uploaded:
        storage.delete_files([object_key])
        raise RuntimeError("Workbook could not be stored privately.")
    return object_key


def delete_private_workbook(object_key: str) -> None:
    if object_key:
        S3Storage().delete_files([object_key])


def create_dntt_import(uploaded_file, user, report_month: date):
    uploaded_file = _BufferedUpload(uploaded_file)
    filename = PurePosixPath((uploaded_file.name or "dntt.xlsx").replace("\\", "/")).name[:255]
    checksum = sha256_uploaded_file(uploaded_file)
    duplicate = DnttImport.objects.filter(
        month__report_month=report_month,
        checksum=checksum,
        parser_version=DNTT_PARSER_VERSION,
    ).exclude(status=DnttImport.Status.FAILED).first()
    if duplicate:
        return duplicate, False

    object_key = store_private_workbook(uploaded_file, report_month, checksum)
    duplicate = None
    import_version = None
    try:
        with transaction.atomic():
            month, _ = DnttMonth.objects.get_or_create(report_month=report_month)
            month = DnttMonth.objects.select_for_update().get(pk=month.pk)
            duplicate = (
                DnttImport.objects.filter(
                    month=month,
                    checksum=checksum,
                    parser_version=DNTT_PARSER_VERSION,
                )
                .exclude(status=DnttImport.Status.FAILED)
                .first()
            )
            if not duplicate:
                revision = (month.imports.aggregate(max_revision=Max("revision"))["max_revision"] or 0) + 1
                import_version = DnttImport.objects.create(
                    month=month,
                    revision=revision,
                    uploaded_by=user,
                    uploader_email=normalized_email(user.email),
                    original_filename=filename,
                    source_key=object_key,
                    source_file_size=uploaded_file.size,
                    checksum=checksum,
                    parser_version=DNTT_PARSER_VERSION,
                    status=DnttImport.Status.QUEUED,
                )
                transaction.on_commit(lambda: _queue_dntt_import(import_version.pk))
    except Exception:
        delete_private_workbook(object_key)
        raise
    if duplicate:
        delete_private_workbook(object_key)
        uploaded_file.close()
        return duplicate, False
    uploaded_file.close()
    return import_version, True


def _queue_dntt_import(import_id) -> None:
    from plane.bgtasks.dntt_import_task import process_dntt_import

    try:
        process_dntt_import.delay(str(import_id))
    except Exception:
        DnttImport.objects.filter(pk=import_id, status=DnttImport.Status.QUEUED).update(
            status=DnttImport.Status.FAILED,
            errors=["Import worker is unavailable. Please retry the upload."],
            processed_at=timezone.now(),
        )
