# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import hashlib

from django.conf import settings
from django.db import models

from .base import BaseModel


def build_dntt_request_group(sheet_id, source_row, request_number, requester, department):
    normalized_number = (request_number or "").strip().casefold()
    if normalized_number:
        identity = "\x1f".join(
            (
                normalized_number,
                (requester or "").strip().casefold(),
                (department or "").strip().casefold(),
            )
        )
    else:
        identity = f"{sheet_id}\x1frow\x1f{source_row}"
    return hashlib.sha256(identity.encode("utf-8")).hexdigest()


class DnttUploaderPermission(BaseModel):
    """An explicitly approved, verified Plane email that can upload DNTT workbooks."""

    email = models.EmailField(max_length=255, unique=True)
    is_active = models.BooleanField(default=True)
    granted_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dntt_permissions_granted",
    )
    revoked_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dntt_permissions_revoked",
    )
    revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "dntt_uploader_permissions"
        ordering = ("email",)

    def save(self, *args, **kwargs):
        self.email = (self.email or "").strip().casefold()
        super().save(*args, **kwargs)


class DnttImport(BaseModel):
    class Status(models.TextChoices):
        QUEUED = "queued", "Queued"
        PROCESSING = "processing", "Processing"
        READY = "ready", "Ready to publish"
        FAILED = "failed", "Failed"
        PUBLISHED = "published", "Published"
        SUPERSEDED = "superseded", "Superseded"

    month = models.ForeignKey("db.DnttMonth", on_delete=models.CASCADE, related_name="imports")
    revision = models.PositiveIntegerField()
    uploaded_by = models.ForeignKey(
        settings.AUTH_USER_MODEL,
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="dntt_imports",
    )
    uploader_email = models.EmailField(max_length=255)
    original_filename = models.CharField(max_length=255)
    source_key = models.CharField(max_length=800)
    source_file_size = models.PositiveBigIntegerField()
    checksum = models.CharField(max_length=64)
    parser_version = models.CharField(max_length=32, default="1")
    status = models.CharField(max_length=20, choices=Status.choices, default=Status.QUEUED)
    summary = models.JSONField(default=dict, blank=True)
    errors = models.JSONField(default=list, blank=True)
    processed_at = models.DateTimeField(null=True, blank=True)
    published_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "dntt_imports"
        ordering = ("-created_at",)
        constraints = [
            models.UniqueConstraint(fields=("month", "revision"), name="dntt_import_month_revision_uniq"),
        ]
        indexes = [models.Index(fields=("month", "status"), name="dntt_import_month_status_idx")]


class DnttMonth(BaseModel):
    report_month = models.DateField(unique=True)
    current_import = models.ForeignKey(
        "db.DnttImport",
        null=True,
        blank=True,
        on_delete=models.SET_NULL,
        related_name="active_for_months",
    )
    share_token_hash = models.CharField(max_length=64, null=True, blank=True, unique=True)
    share_link_created_at = models.DateTimeField(null=True, blank=True)
    share_link_revoked_at = models.DateTimeField(null=True, blank=True)

    class Meta:
        db_table = "dntt_months"
        ordering = ("-report_month",)


class DnttSheet(BaseModel):
    import_version = models.ForeignKey(DnttImport, on_delete=models.CASCADE, related_name="sheets")
    source_index = models.PositiveIntegerField()
    source_name = models.CharField(max_length=255)
    report_date = models.DateField(null=True, blank=True)
    raw_category = models.CharField(max_length=100, blank=True)
    category = models.CharField(max_length=100, blank=True)
    header_row = models.PositiveIntegerField(null=True, blank=True)
    row_count = models.PositiveIntegerField(default=0)
    warnings = models.JSONField(default=list, blank=True)
    errors = models.JSONField(default=list, blank=True)

    class Meta:
        db_table = "dntt_sheets"
        ordering = ("source_index",)
        constraints = [
            models.UniqueConstraint(fields=("import_version", "source_index"), name="dntt_sheet_import_index_uniq")
        ]


class DnttEntry(BaseModel):
    import_version = models.ForeignKey(DnttImport, on_delete=models.CASCADE, related_name="entries")
    sheet = models.ForeignKey(DnttSheet, on_delete=models.CASCADE, related_name="entries")
    request_group = models.CharField(max_length=64, blank=True, db_index=True)
    source_row = models.PositiveIntegerField()
    report_date = models.DateField()
    category = models.CharField(max_length=100, blank=True)
    requester = models.CharField(max_length=255, blank=True)
    department = models.CharField(max_length=255, blank=True)
    request_number = models.CharField(max_length=255, blank=True)
    description = models.TextField(blank=True)
    amount = models.DecimalField(max_digits=20, decimal_places=0, null=True, blank=True)

    class Meta:
        db_table = "dntt_entries"
        ordering = ("report_date", "category", "request_number", "source_row")
        constraints = [
            models.UniqueConstraint(fields=("sheet", "source_row"), name="dntt_entry_sheet_row_uniq")
        ]
        indexes = [
            models.Index(fields=("import_version", "report_date"), name="dntt_entry_import_date_idx"),
            models.Index(fields=("import_version", "category"), name="dntt_entry_import_category_idx"),
            models.Index(fields=("import_version", "request_number"), name="dntt_entry_import_number_idx"),
            models.Index(fields=("import_version", "request_group"), name="dntt_entry_import_group_idx"),
        ]

    def save(self, *args, **kwargs):
        if not self.request_group and self.sheet_id:
            self.request_group = build_dntt_request_group(
                self.sheet_id,
                self.source_row,
                self.request_number,
                self.requester,
                self.department,
            )
        super().save(*args, **kwargs)
