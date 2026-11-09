# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from datetime import date
from decimal import Decimal
from hashlib import sha256
from pathlib import Path
from zipfile import ZIP_DEFLATED, ZipFile

import openpyxl
import pytest
from openpyxl import Workbook
from openpyxl.worksheet.worksheet import Worksheet

from plane.utils.dntt_workbook import DnttWorkbookError, parse_dntt_workbook

pytestmark = pytest.mark.unit


def add_standard_rows(workbook: Workbook, title: str, rows: list[list[object]], headers: list[str]) -> Worksheet:
    sheet = workbook.create_sheet(title)
    sheet.merge_cells("B1:E1")
    sheet["B1"] = f"Bàn giao DNTT ngày {title} năm 2026"
    for column, value in enumerate(headers, start=1):
        sheet.cell(row=3, column=column, value=value)
    for row_number, row in enumerate(rows, start=4):
        for column, value in enumerate(row, start=1):
            sheet.cell(row=row_number, column=column, value=value)
    return sheet


def inject_invalid_custom_filter(path: Path) -> None:
    rewritten = path.with_name(f"{path.stem}.rewritten.xlsx")
    with ZipFile(path) as source, ZipFile(rewritten, "w", ZIP_DEFLATED) as target:
        for member in source.infolist():
            contents = source.read(member.filename)
            if member.filename == "xl/worksheets/sheet1.xml":
                marker = b"</worksheet>"
                filter_xml = (
                    b'<autoFilter ref="A1:F6"><filterColumn colId="0"><customFilters>'
                    b'<customFilter val="non-numeric-text"/></customFilters></filterColumn></autoFilter>'
                )
                assert marker in contents
                contents = contents.replace(marker, filter_xml + marker)
            target.writestr(member, contents)
    rewritten.replace(path)


def test_parser_handles_header_variants_repeated_headers_and_month_scope(tmp_path: Path):
    workbook = Workbook()
    workbook.remove(workbook.active)
    standard_headers = ["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"]
    add_standard_rows(
        workbook,
        "03.10 TMDV",
        [
            [1, "Người A", "Vận hành", "DNTT-001", "Khoản một", 100_000],
            standard_headers,
            [2, "Người A", "Vận hành", "DNTT-001", "Khoản hai", 200_000],
        ],
        standard_headers,
    )
    add_standard_rows(
        workbook,
        "04.10 TNHH",
        [[1, "Người B", "Tài vụ", "DNTT-002", "Khoản ba", "1.234.000"]],
        ["STT", "NGƯỜI ĐỀ NGHỊ", "BỘ PHẬN", "SỐ ĐỀ NGHỊ", "NỘI DUNG", "SỐ TIỀN"],
    )
    add_standard_rows(
        workbook,
        "29.09 Du hoc",
        [[1, "Người C", "Đào tạo", "DNTT-003", "Tháng trước", 50_000]],
        standard_headers,
    )
    add_standard_rows(
        workbook,
        "khong-co-ngay",
        [[1, "Người D", "Khác", "DNTT-004", "Thiếu ngày", 75_000]],
        standard_headers,
    )
    path = tmp_path / "snapshot.xlsx"
    workbook.save(path)

    result = parse_dntt_workbook(path, "2026-10")

    assert result.report_month == date(2026, 10, 1)
    assert len(result.entries) == 3
    assert [(entry.category, entry.request_number, entry.amount) for entry in result.entries] == [
        ("TMDV", "DNTT-001", Decimal("100000")),
        ("TMDV", "DNTT-001", Decimal("200000")),
        ("TNHH", "DNTT-002", Decimal("1234000")),
    ]
    assert [entry.source_row for entry in result.entries] == [4, 6, 4]
    assert result.excluded_sheets == ("29.09 Du hoc",)
    assert result.sheets_by_name["khong-co-ngay"].errors
    assert result.summary["entry_count"] == 3


def test_parser_reads_workbook_with_invalid_auto_filter_without_mutating_source(tmp_path: Path):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "03.10 TMDV"
    for column, value in enumerate(["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"], start=1):
        sheet.cell(row=3, column=column, value=value)
    for column, value in enumerate([1, "Người A", "Vận hành", "DNTT-001", "Khoản một", 100_000], start=1):
        sheet.cell(row=4, column=column, value=value)
    workbook.save(tmp_path / "base.xlsx")
    path = tmp_path / "invalid-filter.xlsx"
    (tmp_path / "base.xlsx").replace(path)
    inject_invalid_custom_filter(path)
    original_hash = sha256(path.read_bytes()).hexdigest()

    with pytest.raises(ValueError):
        openpyxl.load_workbook(path, data_only=True)

    result = parse_dntt_workbook(path, "2026-10")

    assert len(result.entries) == 1
    assert sha256(path.read_bytes()).hexdigest() == original_hash


def test_parser_rejects_non_xlsx_input(tmp_path: Path):
    path = tmp_path / "requests.csv"
    path.write_text("not an Excel workbook", encoding="utf-8")

    with pytest.raises(DnttWorkbookError):
        parse_dntt_workbook(path, "2026-10")


def test_parser_accepts_a_table_that_starts_on_the_first_row(tmp_path: Path):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "01.10 TMDV"
    for column, value in enumerate(["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"], start=1):
        sheet.cell(row=1, column=column, value=value)
    for column, value in enumerate([1, "Người A", "Vận hành", "DNTT-001", "Khoản một", 100_000], start=1):
        sheet.cell(row=2, column=column, value=value)
    path = tmp_path / "table-at-top.xlsx"
    workbook.save(path)

    result = parse_dntt_workbook(path, "2026-10")

    assert len(result.entries) == 1
    assert result.entries[0].source_row == 2


def test_parser_keeps_rows_from_unknown_category_under_khac_with_warning(tmp_path: Path):
    workbook = Workbook()
    workbook.remove(workbook.active)
    headers = ["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"]
    sheet = add_standard_rows(
        workbook,
        "02.10 Loai Moi",
        [[1, "Người A", "Vận hành", "DNTT-001", "Khoản một", 100_000]],
        headers,
    )
    sheet["B1"] = "Bàn giao DNTT ngày 02.10.2026 Loại mới"
    path = tmp_path / "unknown-category.xlsx"
    workbook.save(path)

    result = parse_dntt_workbook(path, "2026-10")

    assert len(result.entries) == 1
    assert result.entries[0].category == "Khác"
    assert any("Category could not be identified" in warning for warning in result.sheets[0].warnings)


def test_empty_undated_sheet_is_excluded_without_failing_month_import(tmp_path: Path):
    workbook = Workbook()
    empty_sheet = workbook.active
    empty_sheet.title = "Sheet1"
    headers = ["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"]
    add_standard_rows(
        workbook,
        "03.10 TMDV",
        [[1, "Người A", "Vận hành", "DNTT-001", "Khoản một", 100_000]],
        headers,
    )
    path = tmp_path / "snapshot-with-empty-sheet.xlsx"
    workbook.save(path)

    result = parse_dntt_workbook(path, "2026-10")

    assert len(result.entries) == 1
    assert result.errors == ()
    assert result.excluded_sheets == ("Sheet1",)
    assert any("Empty worksheet" in warning for warning in result.sheets_by_name["Sheet1"].warnings)


def test_nonempty_request_without_amount_blocks_month_publication(tmp_path: Path):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "03.10 TMDV"
    for column, value in enumerate(["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"], start=1):
        sheet.cell(row=1, column=column, value=value)
    for column, value in enumerate([1, "Người A", "Vận hành", "DNTT-001", "Khoản một", None], start=1):
        sheet.cell(row=2, column=column, value=value)
    path = tmp_path / "missing-amount.xlsx"
    workbook.save(path)

    result = parse_dntt_workbook(path, "2026-10")

    assert len(result.entries) == 1
    assert result.entries[0].amount is None
    assert any("no amount" in error.lower() for error in result.errors)


def test_contiguous_detail_rows_inherit_request_fields_until_a_blank_separator(tmp_path: Path):
    workbook = Workbook()
    sheet = workbook.active
    sheet.title = "03.10 TMDV"
    headers = ["STT", "Họ và Tên", "Bộ Phận", "DNTT", "Nội Dung", "Số Tiền"]
    sheet.append(headers)
    sheet.append([1, "Người A", "Vận hành", "DNTT-001", "Dòng một", 100_000])
    sheet.append([2, None, None, None, "Dòng hai", 200_000])
    sheet.append([None, None, None, None, None, None])
    sheet.append([3, None, None, None, "DNTT chưa có số", 50_000])
    path = tmp_path / "detail-lines.xlsx"
    workbook.save(path)

    result = parse_dntt_workbook(path, "2026-10")

    assert [entry.request_number for entry in result.entries] == ["DNTT-001", "DNTT-001", ""]
    assert [entry.requester for entry in result.entries] == ["Người A", "Người A", ""]
    assert [entry.department for entry in result.entries] == ["Vận hành", "Vận hành", ""]
