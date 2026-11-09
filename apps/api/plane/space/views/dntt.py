# Copyright (c) 2023-present Plane Software, Inc. and contributors
# SPDX-License-Identifier: AGPL-3.0-only
# See the LICENSE file for details.

from __future__ import annotations

import hashlib
import re
from datetime import date
from decimal import Decimal, InvalidOperation

from django.core.paginator import Paginator
from django.db.models import Count, Q, Subquery, Sum
from django.http import HttpResponse
from django.shortcuts import get_object_or_404
from openpyxl import Workbook
from openpyxl.cell import WriteOnlyCell
from rest_framework import status
from rest_framework.exceptions import ParseError
from rest_framework.permissions import AllowAny
from rest_framework.response import Response
from rest_framework.throttling import AnonRateThrottle

from plane.app.views.base import BaseAPIView
from plane.db.models import DnttEntry, DnttMonth

_TOKEN_RE = re.compile(r"^[A-Za-z0-9_-]{40,64}$")
_GROUP_ORDERINGS = {
    "date": ("-report_date", "category", "request_number", "request_group"),
    "amount": ("-total_amount", "-report_date", "request_number", "request_group"),
    "requester": ("requester", "-report_date", "request_number", "request_group"),
    "request_number": ("request_number", "-report_date", "request_group"),
}


class DnttPublicRateThrottle(AnonRateThrottle):
    scope = "dntt_public"

    def get_rate(self):
        return "1200/hour"


def _get_shared_month(token: str) -> DnttMonth:
    if not _TOKEN_RE.fullmatch(token or ""):
        from django.http import Http404

        raise Http404
    token_hash = hashlib.sha256(token.encode("utf-8")).hexdigest()
    month = DnttMonth.objects.select_related("current_import").filter(share_token_hash=token_hash).first()
    if not month or not month.current_import_id or month.current_import.status != "published":
        from django.http import Http404

        raise Http404
    return month


def _public_month_entries(month: DnttMonth):
    return DnttEntry.objects.filter(
        import_version_id=month.current_import_id,
        report_date__year=month.report_month.year,
        report_date__month=month.report_month.month,
    )


def _filtered_entry_rows(request, month: DnttMonth):
    query = _public_month_entries(month)
    params = request.query_params
    search = params.get("q", "").strip()
    if len(search) > 200:
        raise ParseError("Search query must be 200 characters or fewer.")
    if search:
        matching_groups = query.filter(
            Q(request_number__icontains=search)
            | Q(requester__icontains=search)
            | Q(department__icontains=search)
            | Q(description__icontains=search)
        ).values("request_group")
        query = query.filter(request_group__in=Subquery(matching_groups))

    requested_date = params.get("date")
    if requested_date:
        try:
            query = query.filter(report_date=date.fromisoformat(requested_date))
        except ValueError as error:
            raise ParseError("date must use YYYY-MM-DD format.") from error

    for parameter, field in (("category", "category"), ("department", "department"), ("requester", "requester")):
        value = params.get(parameter, "").strip()
        if value:
            if len(value) > 255:
                raise ParseError(f"{parameter} filter is too long.")
            query = query.filter(**{f"{field}__iexact": value})

    min_amount = _parse_amount_param(params.get("min_amount"), "min_amount")
    max_amount = _parse_amount_param(params.get("max_amount"), "max_amount")
    if min_amount is not None and max_amount is not None and min_amount > max_amount:
        raise ParseError("min_amount cannot be greater than max_amount.")

    ordering = params.get("ordering", "date")
    if ordering not in _GROUP_ORDERINGS:
        raise ParseError("Unsupported ordering.")
    return query, min_amount, max_amount, ordering


def _group_entries(entries, min_amount=None, max_amount=None):
    groups = entries.values(
        "request_group",
        "report_date",
        "category",
        "request_number",
        "requester",
        "department",
    ).annotate(total_amount=Sum("amount"), line_count=Count("id"))
    if min_amount is not None:
        groups = groups.filter(total_amount__gte=min_amount)
    if max_amount is not None:
        groups = groups.filter(total_amount__lte=max_amount)
    return groups


def _parse_amount_param(raw_value: str | None, name: str) -> Decimal | None:
    if raw_value in (None, ""):
        return None
    try:
        value = Decimal(raw_value)
    except (InvalidOperation, TypeError) as error:
        raise ParseError(f"{name} must be a valid number.") from error
    if not value.is_finite() or value < 0:
        raise ParseError(f"{name} must be a non-negative finite number.")
    return value


def _amount_string(value) -> str | None:
    return None if value is None else format(Decimal(value), "f")


def _summarize_request_groups(groups):
    category_totals = {}
    total_amount = Decimal("0")
    rows = list(groups.values("request_group", "category", "total_amount"))
    for row in rows:
        category = row["category"] or "Khác"
        category_summary = category_totals.setdefault(category, {"count": 0, "total_amount": Decimal("0")})
        category_summary["count"] += 1
        amount = row["total_amount"] or Decimal("0")
        category_summary["total_amount"] += amount
        total_amount += amount
    categories = [
        {"category": category, "count": values["count"], "total_amount": _amount_string(values["total_amount"])}
        for category, values in sorted(category_totals.items())
    ]
    return len(rows), total_amount, categories


def _public_headers(response):
    response["Cache-Control"] = "no-store"
    response["X-Robots-Tag"] = "noindex, nofollow"
    response["Referrer-Policy"] = "no-referrer"
    response["X-Content-Type-Options"] = "nosniff"
    return response


class DnttPublicMonthEndpoint(BaseAPIView):
    permission_classes = [AllowAny]
    authentication_classes = []
    throttle_classes = [DnttPublicRateThrottle]

    def get(self, request, token):
        month = _get_shared_month(token)
        month_query = _public_month_entries(month)
        entry_query, min_amount, max_amount, ordering = _filtered_entry_rows(request, month)
        month_groups = _group_entries(month_query)
        filtered_groups = _group_entries(entry_query, min_amount, max_amount).order_by(*_GROUP_ORDERINGS[ordering])
        per_page = _parse_per_page(request.query_params.get("per_page", "25"))
        try:
            requested_page = int(request.query_params.get("page", "1"))
        except ValueError as error:
            raise ParseError("page must be a positive integer.") from error
        if requested_page < 1:
            raise ParseError("page must be a positive integer.")

        paginator = Paginator(filtered_groups, per_page)
        page = paginator.get_page(requested_page)
        page_groups = list(page.object_list)
        page_group_ids = [group["request_group"] for group in page_groups]
        line_items_by_group = {}
        for line in month_query.filter(request_group__in=page_group_ids).order_by("source_row").values(
            "request_group", "description", "amount", "source_row"
        ):
            line_items_by_group.setdefault(line["request_group"], []).append(
                {"description": line["description"], "amount": _amount_string(line["amount"])}
            )
        monthly_count, monthly_amount, category_summary = _summarize_request_groups(month_groups)
        filtered_count, filtered_amount, filtered_category_summary = _summarize_request_groups(filtered_groups)
        departments = list(
            month_query.exclude(department="").order_by("department").values_list("department", flat=True).distinct()
        )
        requesters = list(
            month_query.exclude(requester="").order_by("requester").values_list("requester", flat=True).distinct()
        )
        results = []
        for group in page_groups:
            line_items = line_items_by_group.get(group["request_group"], [])
            descriptions = [line["description"] for line in line_items if line["description"]]
            results.append(
                {
                    "id": group["request_group"],
                    "date": group["report_date"].isoformat(),
                    "category": group["category"] or "Khác",
                    "request_number": group["request_number"],
                    "requester": group["requester"],
                    "department": group["department"],
                    "description": "\n".join(descriptions),
                    "line_count": group["line_count"],
                    "line_items": line_items,
                    "amount": _amount_string(group["total_amount"]),
                }
            )
        response = Response(
            {
                "month": month.report_month.strftime("%Y-%m"),
                "updated_at": (month.current_import.published_at or month.current_import.created_at).isoformat(),
                "month_total_count": monthly_count,
                "month_total_amount": _amount_string(monthly_amount),
                "total_count": filtered_count,
                "total_amount": _amount_string(filtered_amount),
                "category_summary": category_summary,
                "filtered_category_summary": filtered_category_summary,
                "departments": departments,
                "requesters": requesters,
                "results": results,
                "page": page.number,
                "per_page": per_page,
                "total_pages": paginator.num_pages,
            },
            status=status.HTTP_200_OK,
        )
        return _public_headers(response)

    def download(self, request, token):
        month = _get_shared_month(token)
        workbook = Workbook(write_only=True)
        worksheet = workbook.create_sheet(title=f"DNTT {month.report_month:%Y-%m}")
        worksheet.append(
            [
                "Ngày DNTT",
                "Loại",
                "Số DNTT",
                "Người đề nghị",
                "Bộ phận",
                "Nội dung",
                "Số tiền (VND)",
            ]
        )
        for entry in _public_month_entries(month).order_by("report_date", "category", "request_number", "source_row").iterator(
            chunk_size=1000
        ):
            worksheet.append(
                [
                    entry.report_date,
                    _safe_excel_text(worksheet, entry.category or "Khác"),
                    _safe_excel_text(worksheet, entry.request_number),
                    _safe_excel_text(worksheet, entry.requester),
                    _safe_excel_text(worksheet, entry.department),
                    _safe_excel_text(worksheet, entry.description),
                    entry.amount,
                ]
            )
        from io import BytesIO

        buffer = BytesIO()
        workbook.save(buffer)
        response = HttpResponse(
            buffer.getvalue(),
            content_type="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        )
        response["Content-Disposition"] = f'attachment; filename="DNTT-{month.report_month:%Y-%m}.xlsx"'
        return _public_headers(response)


class DnttPublicMonthDownloadEndpoint(DnttPublicMonthEndpoint):
    def get(self, request, token):
        return self.download(request, token)


def _safe_excel_text(worksheet, value):
    cell = WriteOnlyCell(worksheet, value=str(value or ""))
    cell.data_type = "s"
    return cell


def _parse_per_page(raw_value: str) -> int:
    try:
        per_page = int(raw_value)
    except (TypeError, ValueError) as error:
        raise ParseError("per_page must be an integer between 1 and 100.") from error
    if not 1 <= per_page <= 100:
        raise ParseError("per_page must be an integer between 1 and 100.")
    return per_page
