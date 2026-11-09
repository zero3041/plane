# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

"""Safe, month-scoped parsing for uploaded DNTT workbooks."""

from __future__ import annotations

import re
import tempfile
import unicodedata
import zipfile
from dataclasses import dataclass
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from pathlib import Path
from typing import Any
from xml.etree import ElementTree

from openpyxl import load_workbook

MAX_WORKBOOK_BYTES = 25 * 1024 * 1024
MAX_ARCHIVE_ENTRIES = 2_000
MAX_UNCOMPRESSED_BYTES = 256 * 1024 * 1024
MAX_SHEETS = 500
MAX_ROWS_PER_SHEET = 20_000
MAX_TOTAL_ROWS = 250_000
MAX_COMPRESSION_RATIO = 250

_SHEET_NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main"
_DMY_RE = re.compile(r"(?<!\d)(?P<day>\d{1,2})[._/\-](?P<month>\d{1,2})(?:[._/\-](?P<year>\d{2,4}))?(?!\d)")
_VERBAL_DATE_RE = re.compile(r"\b(?:ngay\s*)?(?P<day>\d{1,2})\s*thang\s*(?P<month>\d{1,2})(?:\s*nam\s*(?P<year>\d{4}))?\b")

_HEADER_ALIASES: dict[str, set[str]] = {
    "serial": {"stt", "so thu tu"},
    "requester": {"ho va ten", "ho ten", "nguoi de nghi", "nguoi yeu cau"},
    "department": {"bo phan", "phong ban", "don vi"},
    "request_number": {"dntt", "so de nghi", "so dntt", "ma dntt"},
    "description": {"noi dung", "dien giai", "hang muc"},
    "amount": {"so tien", "thanh tien", "tong tien"},
}


class DnttWorkbookError(ValueError):
    """Raised when an uploaded file is not a safe, readable DNTT workbook."""


@dataclass(frozen=True, slots=True)
class DnttEntry:
    source_sheet: str
    source_row: int
    request_date: date
    category: str
    requester: str
    department: str
    request_number: str
    description: str
    amount: Decimal | None


@dataclass(frozen=True, slots=True)
class DnttSheetResult:
    name: str
    request_date: date | None
    category: str
    row_count: int
    warnings: tuple[str, ...] = ()
    errors: tuple[str, ...] = ()
    excluded: bool = False


@dataclass(frozen=True, slots=True)
class DnttParseResult:
    report_month: date
    entries: tuple[DnttEntry, ...]
    sheets: tuple[DnttSheetResult, ...]
    excluded_sheets: tuple[str, ...]
    warnings: tuple[str, ...]
    errors: tuple[str, ...]
    summary: dict[str, Any]

    @property
    def sheets_by_name(self) -> dict[str, DnttSheetResult]:
        return {sheet.name: sheet for sheet in self.sheets}


def parse_dntt_workbook(path: str | Path, report_month: str | date | datetime) -> DnttParseResult:
    """Parse rows for ``report_month`` while preserving source sheet/row references.

    Workbook XML is copied to a temporary file and only invalid worksheet
    ``autoFilter`` metadata is stripped for the parser. The uploaded source is
    never modified. Formula cells are read through their cached values; this
    function deliberately does not attempt to recalculate workbook formulas.
    """

    source = Path(path)
    month = _normalize_report_month(report_month)
    _validate_archive(source)

    entries: list[DnttEntry] = []
    sheet_results: list[DnttSheetResult] = []
    excluded_sheets: list[str] = []
    warnings: list[str] = []
    errors: list[str] = []
    total_rows_seen = 0
    removed_auto_filters = 0

    try:
        with tempfile.TemporaryDirectory(prefix="dntt-workbook-") as temp_dir:
            parser_copy = Path(temp_dir) / "normalized.xlsx"
            removed_auto_filters = _make_parser_copy(source, parser_copy)
            workbook = load_workbook(parser_copy, read_only=True, data_only=True, keep_links=False)
            try:
                if len(workbook.worksheets) > MAX_SHEETS:
                    raise DnttWorkbookError(f"Workbook has more than {MAX_SHEETS} worksheets.")

                for worksheet in workbook.worksheets:
                    sheet_result, sheet_entries, rows_seen = _parse_sheet(worksheet, month)
                    total_rows_seen += rows_seen
                    if total_rows_seen > MAX_TOTAL_ROWS:
                        raise DnttWorkbookError(f"Workbook exceeds the {MAX_TOTAL_ROWS} row limit.")
                    sheet_results.append(sheet_result)
                    entries.extend(sheet_entries)
                    warnings.extend(f"{sheet_result.name}: {warning}" for warning in sheet_result.warnings)
                    errors.extend(f"{sheet_result.name}: {error}" for error in sheet_result.errors)
                    if sheet_result.excluded:
                        excluded_sheets.append(sheet_result.name)
            finally:
                workbook.close()
    except DnttWorkbookError:
        raise
    except Exception as error:  # openpyxl surfaces malformed OOXML via several exception types.
        raise DnttWorkbookError("The workbook could not be read as a supported XLSX file.") from error

    category_counts: dict[str, int] = {}
    category_totals: dict[str, Decimal] = {}
    total_amount = Decimal("0")
    for entry in entries:
        category_counts[entry.category] = category_counts.get(entry.category, 0) + 1
        if entry.amount is not None:
            category_totals[entry.category] = category_totals.get(entry.category, Decimal("0")) + entry.amount
            total_amount += entry.amount

    summary = {
        "sheet_count": len(sheet_results),
        "included_sheet_count": sum(not sheet.excluded and sheet.request_date is not None for sheet in sheet_results),
        "excluded_sheet_count": len(excluded_sheets),
        "unclassified_sheet_count": sum(sheet.category == "Khác" for sheet in sheet_results),
        "entry_count": len(entries),
        "total_amount": total_amount,
        "category_counts": category_counts,
        "category_totals": category_totals,
        "autofilter_nodes_removed": removed_auto_filters,
    }

    return DnttParseResult(
        report_month=month,
        entries=tuple(entries),
        sheets=tuple(sheet_results),
        excluded_sheets=tuple(excluded_sheets),
        warnings=tuple(warnings),
        errors=tuple(errors),
        summary=summary,
    )


def _normalize_report_month(value: str | date | datetime) -> date:
    if isinstance(value, datetime):
        return date(value.year, value.month, 1)
    if isinstance(value, date):
        return date(value.year, value.month, 1)
    if isinstance(value, str):
        try:
            parsed = datetime.strptime(value, "%Y-%m")
        except ValueError as error:
            raise DnttWorkbookError("Report month must use YYYY-MM format.") from error
        return date(parsed.year, parsed.month, 1)
    raise DnttWorkbookError("Report month must be a date or YYYY-MM string.")


def _validate_archive(path: Path) -> None:
    if not path.exists() or not path.is_file():
        raise DnttWorkbookError("Workbook file does not exist.")
    if path.suffix.lower() != ".xlsx":
        raise DnttWorkbookError("Only .xlsx workbooks are supported.")
    size = path.stat().st_size
    if size <= 0 or size > MAX_WORKBOOK_BYTES:
        raise DnttWorkbookError(f"Workbook size must be between 1 byte and {MAX_WORKBOOK_BYTES} bytes.")
    try:
        with zipfile.ZipFile(path) as archive:
            members = archive.infolist()
            if len(members) > MAX_ARCHIVE_ENTRIES:
                raise DnttWorkbookError(f"Workbook contains more than {MAX_ARCHIVE_ENTRIES} ZIP entries.")
            names = [member.filename for member in members]
            if len(set(names)) != len(names):
                raise DnttWorkbookError("Workbook ZIP contains duplicate entry names.")
            if "[Content_Types].xml" not in names or "xl/workbook.xml" not in names:
                raise DnttWorkbookError("File does not contain the required XLSX parts.")
            uncompressed_size = sum(member.file_size for member in members)
            if uncompressed_size > MAX_UNCOMPRESSED_BYTES:
                raise DnttWorkbookError("Workbook expands beyond the allowed uncompressed size.")
            for member in members:
                if member.file_size > MAX_UNCOMPRESSED_BYTES:
                    raise DnttWorkbookError("Workbook contains an oversized ZIP entry.")
                if member.file_size > 0:
                    if member.compress_size <= 0 or member.file_size / member.compress_size > MAX_COMPRESSION_RATIO:
                        raise DnttWorkbookError("Workbook contains an excessive compression ratio.")
    except DnttWorkbookError:
        raise
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as error:
        raise DnttWorkbookError("File is not a readable XLSX archive.") from error


def _make_parser_copy(source: Path, target: Path) -> int:
    removed_filters = 0
    try:
        with zipfile.ZipFile(source) as original, zipfile.ZipFile(target, "w", zipfile.ZIP_DEFLATED) as normalized:
            for member in original.infolist():
                content = original.read(member.filename)
                if member.filename.startswith("xl/worksheets/") and member.filename.endswith(".xml"):
                    try:
                        root = ElementTree.fromstring(content)
                    except ElementTree.ParseError as error:
                        raise DnttWorkbookError("Workbook contains invalid worksheet XML.") from error
                    for child in list(root):
                        if child.tag == f"{{{_SHEET_NS}}}autoFilter":
                            root.remove(child)
                            removed_filters += 1
                    content = ElementTree.tostring(root, encoding="utf-8", xml_declaration=True)
                normalized.writestr(member, content)
    except DnttWorkbookError:
        raise
    except (OSError, zipfile.BadZipFile, zipfile.LargeZipFile) as error:
        raise DnttWorkbookError("Workbook could not be normalized for parsing.") from error
    return removed_filters


def _parse_sheet(worksheet: Any, report_month: date) -> tuple[DnttSheetResult, list[DnttEntry], int]:
    if hasattr(worksheet, "reset_dimensions"):
        worksheet.reset_dimensions()
    first_rows = list(worksheet.iter_rows(min_row=1, max_row=8, values_only=True))
    title_text = " ".join(
        str(value).strip()
        for row in first_rows[:3]
        for value in row
        if isinstance(value, str) and value.strip()
    )
    has_content = any(value is not None for row in first_rows for value in row)
    if not has_content and not _worksheet_has_content(worksheet):
        return (
            DnttSheetResult(
                worksheet.title,
                None,
                "Khác",
                0,
                ("Empty worksheet contains no detectable date or table and was excluded.",),
                excluded=True,
            ),
            [],
            len(first_rows),
        )
    request_date = _find_sheet_date(worksheet.title, title_text, report_month.year)
    category, category_known = _find_category(worksheet.title, title_text)
    warnings: list[str] = []
    errors: list[str] = []

    if not category_known:
        warnings.append("Category could not be identified; mapped to Khác.")
    if request_date is None:
        errors.append("Request date could not be identified; sheet was not imported.")
        return (
            DnttSheetResult(worksheet.title, None, category, 0, tuple(warnings), tuple(errors)),
            [],
            len(first_rows),
        )
    if request_date.year != report_month.year or request_date.month != report_month.month:
        warnings.append("Sheet date is outside the selected report month and was excluded.")
        return (
            DnttSheetResult(worksheet.title, request_date, category, 0, tuple(warnings), (), excluded=True),
            [],
            len(first_rows),
        )

    entries: list[DnttEntry] = []
    column_map: dict[str, int] | None = None
    active_request: tuple[str, str, str] | None = None
    data_rows = 0
    rows_seen = 0
    for row_number, cells in enumerate(worksheet.iter_rows(values_only=True), start=1):
        rows_seen += 1
        if rows_seen > MAX_ROWS_PER_SHEET:
            raise DnttWorkbookError(f"Sheet '{worksheet.title}' exceeds the {MAX_ROWS_PER_SHEET} row limit.")
        values = tuple(cells)
        detected_header = _find_header_map(values)
        if detected_header is not None:
            column_map = detected_header
            active_request = None
            continue
        if column_map is None:
            continue

        serial = _text_value(_get_value(values, column_map, "serial"))
        requester = _text_value(_get_value(values, column_map, "requester"))
        department = _text_value(_get_value(values, column_map, "department"))
        request_number = _text_value(_get_value(values, column_map, "request_number"))
        description = _text_value(_get_value(values, column_map, "description"))
        raw_amount = _get_value(values, column_map, "amount")
        amount = _parse_amount(raw_amount)
        has_detail = any((requester, department, request_number, description, raw_amount is not None))
        if not has_detail:
            active_request = None
            continue
        if _is_total_row(description, serial):
            active_request = None
            continue

        if request_number:
            if active_request and request_number == active_request[2]:
                requester = requester or active_request[0]
                department = department or active_request[1]
            active_request = (requester, department, request_number)
        elif not requester and not department and active_request:
            requester, department, request_number = active_request
        else:
            active_request = None

        data_rows += 1
        if raw_amount is not None and amount is None:
            errors.append(f"Row {row_number} has an amount that could not be parsed.")
        if raw_amount is None and description:
            errors.append(f"Row {row_number} has content but no amount.")
        entries.append(
            DnttEntry(
                source_sheet=worksheet.title,
                source_row=row_number,
                request_date=request_date,
                category=category,
                requester=requester,
                department=department,
                request_number=request_number,
                description=description,
                amount=amount,
            )
        )

    if column_map is None:
        errors.append("A supported DNTT table header was not found.")
    if not entries and not errors:
        warnings.append("No detail rows were found for this sheet.")
    return (
        DnttSheetResult(worksheet.title, request_date, category, data_rows, tuple(warnings), tuple(errors)),
        entries,
        rows_seen,
    )


def _worksheet_has_content(worksheet: Any) -> bool:
    for row_number, row in enumerate(worksheet.iter_rows(values_only=True), start=1):
        if row_number > MAX_ROWS_PER_SHEET:
            raise DnttWorkbookError(f"Sheet '{worksheet.title}' exceeds the {MAX_ROWS_PER_SHEET} row limit.")
        if any(value is not None for value in row):
            return True
    return False


def _find_header_map(values: tuple[Any, ...]) -> dict[str, int] | None:
    found: dict[str, int] = {}
    for index, value in enumerate(values):
        if not isinstance(value, str):
            continue
        normalized = _normalize_label(value)
        for field_name, aliases in _HEADER_ALIASES.items():
            if normalized in aliases:
                found[field_name] = index
                break
    required = {"description", "amount"}
    if required.issubset(found) and ("serial" in found or "request_number" in found or "requester" in found):
        return found
    return None


def _get_value(values: tuple[Any, ...], column_map: dict[str, int], field_name: str) -> Any:
    index = column_map.get(field_name)
    return values[index] if index is not None and index < len(values) else None


def _normalize_label(value: str) -> str:
    normalized = _normalize_text(value)
    return " ".join(re.sub(r"[^a-z0-9]+", " ", normalized).split())


def _normalize_text(value: str) -> str:
    value = value.replace("Đ", "D").replace("đ", "d")
    return "".join(
        character
        for character in unicodedata.normalize("NFD", value.casefold())
        if unicodedata.category(character) != "Mn"
    )


def _find_category(sheet_title: str, title_text: str) -> tuple[str, bool]:
    combined = _normalize_text(f"{sheet_title} {title_text}")
    compact = combined.replace(" ", "")
    if "tmdv" in compact:
        return "TMDV", True
    if "tnhh" in compact:
        return "TNHH", True
    if "du hoc" in combined:
        return "Du học", True
    return "Khác", False


def _find_sheet_date(sheet_title: str, title_text: str, fallback_year: int) -> date | None:
    # A full date in the visible sheet title takes precedence over a short date
    # in the tab name. The short tab format (dd.mm) is used as a fallback.
    for source in (title_text, sheet_title):
        normalized = _normalize_text(source)
        verbal = _VERBAL_DATE_RE.search(normalized)
        if verbal:
            parsed = _make_date(verbal.group("day"), verbal.group("month"), verbal.group("year"), fallback_year)
            if parsed:
                return parsed
        for match in _DMY_RE.finditer(source):
            parsed = _make_date(match.group("day"), match.group("month"), match.group("year"), fallback_year)
            if parsed:
                return parsed
    return None


def _make_date(day_text: str, month_text: str, year_text: str | None, fallback_year: int) -> date | None:
    day = int(day_text)
    month = int(month_text)
    if not 1 <= day <= 31 or not 1 <= month <= 12:
        return None
    if year_text is None:
        year = fallback_year
    else:
        year = int(year_text)
        if year < 100:
            year += 2000
    try:
        return date(year, month, day)
    except ValueError:
        return None


def _text_value(value: Any) -> str:
    if value is None:
        return ""
    if isinstance(value, datetime):
        return value.date().isoformat()
    if isinstance(value, date):
        return value.isoformat()
    return " ".join(str(value).split())


def _parse_amount(value: Any) -> Decimal | None:
    if value is None or isinstance(value, bool):
        return None
    if isinstance(value, Decimal):
        return value.quantize(Decimal("1"))
    if isinstance(value, (int, float)):
        try:
            return Decimal(str(value)).quantize(Decimal("1"))
        except InvalidOperation:
            return None
    text = str(value).strip().replace("₫", "").replace("đ", "").replace("Đ", "").replace("VND", "")
    text = text.replace(" ", "")
    if not text:
        return None
    negative = text.startswith("-") or (text.startswith("(") and text.endswith(")"))
    digits = re.sub(r"[^0-9]", "", text)
    if not digits:
        return None
    amount = Decimal(digits)
    return -amount if negative else amount


def _is_total_row(description: str, serial: str) -> bool:
    if serial:
        return False
    normalized = _normalize_label(description)
    return normalized in {"tong", "tong cong", "tong tien", "cong", "grand total"}
