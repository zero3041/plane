# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

import logging
import hashlib
import tempfile
from pathlib import Path

from celery import shared_task
from django.db import transaction
from django.utils import timezone

from plane.db.models import DnttEntry, DnttImport, DnttSheet
from plane.db.models.dntt import build_dntt_request_group
from plane.settings.storage import S3Storage
from plane.utils.dntt_workbook import DnttWorkbookError, parse_dntt_workbook

logger = logging.getLogger(__name__)


@shared_task(bind=True, max_retries=0)
def process_dntt_import(self, import_id: str) -> None:
    import_version = DnttImport.objects.select_related("month").filter(pk=import_id).first()
    if not import_version or import_version.status != DnttImport.Status.QUEUED:
        return

    claimed = DnttImport.objects.filter(pk=import_version.pk, status=DnttImport.Status.QUEUED).update(
        status=DnttImport.Status.PROCESSING
    )
    if not claimed:
        return
    import_version.refresh_from_db()

    try:
        with tempfile.TemporaryDirectory(prefix="dntt-import-") as temp_dir:
            workbook_path = Path(temp_dir) / "source.xlsx"
            storage = S3Storage()
            response = storage.s3_client.get_object(Bucket=storage.aws_storage_bucket_name, Key=import_version.source_key)
            body = response["Body"]
            total_bytes = 0
            digest = hashlib.sha256()
            try:
                with workbook_path.open("wb") as workbook_file:
                    for chunk in body.iter_chunks(chunk_size=64 * 1024):
                        if not chunk:
                            continue
                        total_bytes += len(chunk)
                        if total_bytes > import_version.source_file_size:
                            raise DnttWorkbookError("Stored workbook size differs from upload metadata.")
                        digest.update(chunk)
                        workbook_file.write(chunk)
            finally:
                body.close()
            if total_bytes != import_version.source_file_size:
                raise DnttWorkbookError("Stored workbook size differs from upload metadata.")
            if digest.hexdigest() != import_version.checksum:
                raise DnttWorkbookError("Stored workbook checksum differs from upload metadata.")

            parsed = parse_dntt_workbook(workbook_path, import_version.month.report_month)
            sheet_rows = []
            for source_index, result in enumerate(parsed.sheets, start=1):
                sheet = DnttSheet(
                    import_version=import_version,
                    source_index=source_index,
                    source_name=result.name,
                    report_date=result.request_date,
                    raw_category=result.category,
                    category=result.category,
                    row_count=result.row_count,
                    warnings=list(result.warnings),
                    errors=list(result.errors),
                )
                sheet_rows.append(sheet)
            entries = list(parsed.entries)

        excluded_names = {sheet.name for sheet in parsed.sheets if sheet.excluded}
        summary = {
            "sheet_count": len(parsed.sheets),
            "selected_month_rows": len(parsed.entries),
            "selected_month_sheets": parsed.summary["included_sheet_count"],
            "excluded_month_sheets": [
                {"sheet_name": sheet.name, "report_date": sheet.request_date.isoformat() if sheet.request_date else None}
                for sheet in parsed.sheets
                if sheet.excluded
            ],
            "excluded_month_sheet_count": len(parsed.excluded_sheets),
            "category_counts": parsed.summary["category_counts"],
            "category_totals": {key: str(value) for key, value in parsed.summary["category_totals"].items()},
            "total_amount": str(parsed.summary["total_amount"]),
            "autofilter_nodes_removed": parsed.summary["autofilter_nodes_removed"],
            "warnings": [warning for warning in parsed.warnings if not any(warning.startswith(f"{name}:") for name in excluded_names)],
            "errors": list(parsed.errors),
        }
        errors = list(parsed.errors)
        if not parsed.entries and not errors:
            errors.append("No DNTT rows were found for the selected month.")
            summary["errors"] = errors
        status = DnttImport.Status.FAILED if errors else DnttImport.Status.READY
        with transaction.atomic():
            locked = DnttImport.objects.select_for_update().get(pk=import_version.pk)
            if locked.status != DnttImport.Status.PROCESSING:
                return
            DnttSheet.all_objects.filter(import_version=locked).delete()
            DnttEntry.all_objects.filter(import_version=locked).delete()
            created_sheets = DnttSheet.objects.bulk_create(sheet_rows)
            sheet_by_name = {sheet.source_name: sheet for sheet in created_sheets}
            deduped_entries = []
            seen_entries = set()
            for entry in entries:
                fingerprint = (
                    entry.request_date,
                    entry.category,
                    entry.request_number.strip().casefold(),
                    entry.requester.strip().casefold(),
                    entry.department.strip().casefold(),
                    entry.description.strip().casefold(),
                    entry.amount,
                )
                if fingerprint in seen_entries:
                    continue
                seen_entries.add(fingerprint)
                deduped_entries.append(entry)
            DnttEntry.objects.bulk_create(
                [
                    DnttEntry(
                        import_version=locked,
                        sheet=sheet_by_name[entry.source_sheet],
                        request_group=build_dntt_request_group(
                            sheet_by_name[entry.source_sheet].pk,
                            entry.source_row,
                            entry.request_number,
                            entry.requester,
                            entry.department,
                        ),
                        source_row=entry.source_row,
                        report_date=entry.request_date,
                        category=entry.category,
                        requester=entry.requester,
                        department=entry.department,
                        request_number=entry.request_number,
                        description=entry.description,
                        amount=entry.amount,
                    )
                    for entry in deduped_entries
                    if entry.source_sheet in sheet_by_name
                ],
                batch_size=1000,
            )
            locked.summary = summary
            locked.errors = errors
            locked.status = status
            locked.processed_at = timezone.now()
            locked.save(update_fields=["summary", "errors", "status", "processed_at", "updated_at"])
    except Exception as error:
        logger.exception("DNTT workbook import failed for import %s", import_version.pk)
        DnttImport.objects.filter(pk=import_version.pk).update(
            status=DnttImport.Status.FAILED,
            errors=[str(error) if isinstance(error, DnttWorkbookError) else "The workbook could not be processed."],
            processed_at=timezone.now(),
        )
