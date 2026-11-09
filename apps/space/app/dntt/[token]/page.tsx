/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useMemo, useState } from "react";
import type { FormEvent, ReactNode } from "react";
import useSWR from "swr";
import { API_BASE_URL } from "@plane/constants";
import { PlaneLockup } from "@plane/blocks/icons";
import { useParams } from "next/navigation";
import type { Route } from "./+types/page";
import {
  buildDnttQueryParams,
  formatDnttAmount,
  groupDnttByDate,
  type DnttPublicEntry,
  type DnttQueryFilters,
} from "../helpers";

interface TDnttPublicResponse {
  month: string;
  updated_at: string | null;
  total_count: number;
  total_amount: string;
  category_summary: Array<{ category: string; count: number; total_amount: string }>;
  filtered_category_summary: Array<{ category: string; count: number; total_amount: string }>;
  month_total_count: number;
  month_total_amount: string;
  departments: string[];
  requesters: string[];
  results: DnttPublicEntry[];
  page: number;
  per_page: number;
  total_pages: number;
}

class DnttPublicError extends Error {
  status: number;

  constructor(status: number) {
    super(status === 404 ? "invalid-link" : "load-error");
    this.status = status;
  }
}

async function fetchDnttMonth(token: string, filters: DnttQueryFilters): Promise<TDnttPublicResponse> {
  const query = buildDnttQueryParams(filters);
  const apiBaseUrl = API_BASE_URL.replace(/\/+$/, "");
  const response = await fetch(`${apiBaseUrl}/api/public/dntt/${encodeURIComponent(token)}/?${query}`, {
    headers: { Accept: "application/json" },
    credentials: "omit",
  });
  if (!response.ok) throw new DnttPublicError(response.status);
  return response.json();
}

function formatReportMonth(month: string): string {
  const [year, monthNumber] = month.split("-").map(Number);
  if (!year || !monthNumber) return month;
  return new Intl.DateTimeFormat("vi-VN", { month: "long", year: "numeric", timeZone: "UTC" }).format(
    new Date(Date.UTC(year, monthNumber - 1, 1))
  );
}

function formatReportDate(value: string): string {
  const match = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!match) return value;
  return `${match[3]}/${match[2]}/${match[1]}`;
}

export const meta: Route.MetaFunction = () => [
  { title: "Đề nghị thanh toán" },
  { name: "robots", content: "noindex, nofollow" },
];

export const headers: Route.HeadersFunction = () => ({
  "Referrer-Policy": "no-referrer",
  "X-Robots-Tag": "noindex, nofollow",
});

export default function DnttPublicPage() {
  const params = useParams<{ token: string }>();
  const token = params.token ?? "";
  const [filters, setFilters] = useState<DnttQueryFilters>({ page: 1, per_page: 25 });
  const [searchInput, setSearchInput] = useState("");
  const { data, error, isLoading, mutate } = useSWR(
    token ? ["DNTT_PUBLIC_MONTH", token, filters] : null,
    () => fetchDnttMonth(token, filters),
    { revalidateOnFocus: false, keepPreviousData: true }
  );
  const dateGroups = useMemo(() => groupDnttByDate(data?.results ?? []), [data?.results]);

  const setFilter = <K extends keyof DnttQueryFilters>(key: K, value: DnttQueryFilters[K]) => {
    setFilters((current) => ({ ...current, [key]: value, page: 1 }));
  };

  const applySearch = (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setFilters((current) => ({ ...current, q: searchInput.trim() || undefined, page: 1 }));
  };

  const clearFilters = () => {
    setFilters({ page: 1, per_page: filters.per_page ?? 25 });
    setSearchInput("");
  };

  const removeFilter = (key: "q" | "date" | "category" | "department" | "requester" | "min_amount" | "max_amount") => {
    setFilters((current) => ({ ...current, [key]: undefined, page: 1 }));
    if (key === "q") setSearchInput("");
  };

  const activeFilters = [
    ["q", "Từ khóa", filters.q],
    ["date", "Ngày", filters.date],
    ["category", "Loại", filters.category],
    ["department", "Bộ phận", filters.department],
    ["requester", "Người đề nghị", filters.requester],
    ["min_amount", "Từ tiền", filters.min_amount],
    ["max_amount", "Đến tiền", filters.max_amount],
  ] as const;

  if (error instanceof DnttPublicError && error.status === 404) {
    return (
      <PublicMessage
        title="Link không còn hoạt động"
        description="Hãy kiểm tra lại link hoặc liên hệ người đã gửi link cho bạn."
      />
    );
  }

  return (
    <main className="min-h-screen bg-surface-1 text-primary">
      <header className="border-b border-subtle bg-surface-1">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-5 py-4 md:px-8">
          <PlaneLockup className="h-6 w-auto" />
          <span className="rounded-full border border-subtle bg-layer-1 px-3 py-1 text-caption-md-medium text-secondary">
            Chỉ xem
          </span>
        </div>
      </header>
      <div className="mx-auto max-w-7xl space-y-6 px-5 py-7 md:px-8 md:py-9">
        <section className="flex flex-col gap-5 md:flex-row md:items-end md:justify-between">
          <div className="space-y-2">
            <p className="text-caption-md-medium tracking-wide text-accent-primary uppercase">DNTT · Công khai</p>
            <h1 className="text-h3-semibold text-primary">
              Đề nghị thanh toán {data ? `· ${formatReportMonth(data.month)}` : ""}
            </h1>
            <p className="text-body-sm-regular text-tertiary">
              {data?.updated_at
                ? `Cập nhật lần cuối ${new Date(data.updated_at).toLocaleString("vi-VN")}`
                : "Tra cứu đề nghị thanh toán trong tháng."}
            </p>
          </div>
          <a
            href={`${API_BASE_URL}/api/public/dntt/${encodeURIComponent(token)}/download/`}
            className="inline-flex h-10 items-center justify-center rounded-md bg-accent-primary px-4 text-body-xs-medium text-on-color transition-opacity hover:opacity-90 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
          >
            Tải Excel tháng
          </a>
        </section>

        {error && (
          <PublicMessage
            title="Không tải được dữ liệu"
            description="Thử tải lại trang sau ít phút."
            onRetry={() => void mutate()}
          />
        )}

        <section className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5" aria-label="Tổng hợp tháng">
          <SummaryCard
            label="Số đề nghị trong tháng"
            value={isLoading && !data ? "…" : (data?.month_total_count ?? 0).toLocaleString("vi-VN")}
          />
          <SummaryCard
            label="Tổng số tiền trong tháng"
            value={isLoading && !data ? "…" : formatDnttAmount(data?.month_total_amount ?? "0")}
          />
          {(data?.category_summary ?? []).map((item) => (
            <SummaryCard
              key={item.category}
              label={`${item.category} · ${item.count} đề nghị`}
              value={formatDnttAmount(item.total_amount)}
            />
          ))}
        </section>

        <section className="space-y-4 rounded-xl border border-subtle bg-surface-1 p-4 md:p-5">
          <form onSubmit={applySearch} className="flex flex-col gap-2 sm:flex-row">
            <label htmlFor="dntt-search" className="sr-only">
              Tìm số DNTT, người đề nghị hoặc nội dung
            </label>
            <input
              id="dntt-search"
              value={searchInput}
              onChange={(event) => setSearchInput(event.target.value)}
              placeholder="Tìm số DNTT, người đề nghị, bộ phận hoặc nội dung…"
              className="h-10 min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-3 text-body-sm-regular text-primary placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-accent-strong"
            />
            <button
              type="submit"
              className="h-10 rounded-md bg-layer-1 px-4 text-body-xs-medium text-primary hover:bg-layer-2 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Tìm kiếm
            </button>
          </form>
          <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-5">
            <FilterSelect
              label="Loại"
              value={filters.category ?? ""}
              onChange={(value) => setFilter("category", value || undefined)}
            >
              <option value="">Tất cả loại</option>
              {(data?.category_summary ?? []).map((item) => (
                <option key={item.category} value={item.category}>
                  {item.category}
                </option>
              ))}
            </FilterSelect>
            <label className="flex min-w-0 flex-col gap-1 text-caption-md-medium text-tertiary">
              Ngày
              <input
                type="date"
                value={filters.date ?? ""}
                onChange={(event) => setFilter("date", event.target.value || undefined)}
                className="h-10 min-w-0 rounded-md border border-subtle bg-surface-1 px-2.5 text-body-xs-regular text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
              />
            </label>
            <FilterSelect
              label="Bộ phận"
              value={filters.department ?? ""}
              onChange={(value) => setFilter("department", value || undefined)}
            >
              <option value="">Tất cả bộ phận</option>
              {(data?.departments ?? []).map((department) => (
                <option key={department} value={department}>
                  {department}
                </option>
              ))}
            </FilterSelect>
            <FilterSelect
              label="Người đề nghị"
              value={filters.requester ?? ""}
              onChange={(value) => setFilter("requester", value || undefined)}
            >
              <option value="">Tất cả người đề nghị</option>
              {(data?.requesters ?? []).map((requester) => (
                <option key={requester} value={requester}>
                  {requester}
                </option>
              ))}
            </FilterSelect>
            <div className="grid grid-cols-2 gap-2">
              <label className="flex min-w-0 flex-col gap-1 text-caption-md-medium text-tertiary">
                Từ tiền
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={filters.min_amount ?? ""}
                  onChange={(event) => setFilter("min_amount", event.target.value || undefined)}
                  placeholder="Tối thiểu"
                  className="h-10 min-w-0 rounded-md border border-subtle bg-surface-1 px-2 text-body-xs-regular text-primary placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-accent-strong"
                />
              </label>
              <label className="flex min-w-0 flex-col gap-1 text-caption-md-medium text-tertiary">
                Đến tiền
                <input
                  type="number"
                  min={0}
                  step={1}
                  value={filters.max_amount ?? ""}
                  onChange={(event) => setFilter("max_amount", event.target.value || undefined)}
                  placeholder="Tối đa"
                  className="h-10 min-w-0 rounded-md border border-subtle bg-surface-1 px-2 text-body-xs-regular text-primary placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-accent-strong"
                />
              </label>
            </div>
          </div>
          {activeFilters.some(([, , value]) => Boolean(value)) && (
            <div className="flex flex-wrap gap-2">
              {activeFilters.map(([key, label, value]) =>
                value ? (
                  <button
                    key={key}
                    type="button"
                    onClick={() => removeFilter(key)}
                    className="rounded-full border border-subtle bg-layer-1 px-3 py-1 text-caption-md-regular text-secondary hover:border-strong"
                  >
                    {label}: {value} <span aria-hidden="true">×</span>
                  </button>
                ) : null
              )}
            </div>
          )}
          <div className="flex flex-wrap items-center justify-between gap-2 border-t border-subtle pt-3">
            <p className="text-body-xs-regular text-tertiary">
              {data
                ? `Kết quả đang lọc: ${data.total_count.toLocaleString("vi-VN")} đề nghị · ${formatDnttAmount(data.total_amount)}`
                : "Đang tải dữ liệu…"}
            </p>
            <button
              type="button"
              onClick={clearFilters}
              className="rounded px-2 py-1 text-body-xs-medium text-accent-primary hover:bg-accent-subtle focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-accent-strong"
            >
              Xóa bộ lọc
            </button>
          </div>
        </section>

        <section className="space-y-4" aria-label="Danh sách đề nghị thanh toán">
          {isLoading && !data ? (
            <div className="rounded-xl border border-subtle bg-surface-1 px-5 py-12 text-center text-body-sm-regular text-tertiary">
              Đang tải đề nghị thanh toán…
            </div>
          ) : !data?.results.length ? (
            <div className="rounded-xl border border-dashed border-subtle bg-surface-1 px-5 py-12 text-center text-body-sm-regular text-tertiary">
              Không có đề nghị phù hợp với bộ lọc.
            </div>
          ) : (
            dateGroups.map((group) => (
              <details key={group.date} open className="overflow-hidden rounded-xl border border-subtle bg-surface-1">
                <summary className="flex cursor-pointer list-none flex-wrap items-center justify-between gap-2 border-b border-subtle bg-layer-1 px-4 py-3 md:px-5">
                  <span className="text-body-sm-medium text-primary">{formatReportDate(group.date)}</span>
                  <span className="text-body-xs-regular text-secondary">{group.entries.length} mục trong trang</span>
                </summary>
                <div className="hidden overflow-x-auto md:block">
                  <table className="w-full min-w-[820px] border-collapse text-left">
                    <thead className="bg-surface-1 text-caption-md-medium text-tertiary">
                      <tr>
                        <th className="px-4 py-3">Số DNTT</th>
                        <th className="px-4 py-3">Người đề nghị</th>
                        <th className="px-4 py-3">Bộ phận / loại</th>
                        <th className="px-4 py-3">Nội dung</th>
                        <th className="px-4 py-3 text-right">Số tiền</th>
                      </tr>
                    </thead>
                    <tbody className="divide-y divide-subtle">
                      {group.entries.map((entry) => (
                        <DnttTableRow key={entry.id} entry={entry} />
                      ))}
                    </tbody>
                  </table>
                </div>
                <div className="divide-y divide-subtle md:hidden">
                  {group.entries.map((entry) => (
                    <DnttMobileCard key={entry.id} entry={entry} />
                  ))}
                </div>
              </details>
            ))
          )}
        </section>

        {data && data.total_pages > 1 && (
          <nav
            className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-subtle bg-surface-1 px-4 py-3"
            aria-label="Phân trang"
          >
            <div className="flex items-center gap-2 text-body-xs-regular text-secondary">
              <span>Hiển thị</span>
              <select
                aria-label="Số mục mỗi trang"
                value={data.per_page}
                onChange={(event) =>
                  setFilters((current) => ({ ...current, per_page: Number(event.target.value), page: 1 }))
                }
                className="h-9 rounded-md border border-subtle bg-surface-1 px-2 text-body-xs-medium text-primary"
              >
                {[10, 25, 50].map((size) => (
                  <option key={size} value={size}>
                    {size}
                  </option>
                ))}
              </select>
              <span>
                mỗi trang · Trang {data.page} / {data.total_pages}
              </span>
            </div>
            <div className="flex gap-2">
              <button
                type="button"
                disabled={data.page <= 1}
                onClick={() => setFilters((current) => ({ ...current, page: Math.max(1, (current.page ?? 1) - 1) }))}
                className="h-9 rounded-md border border-subtle px-3 text-body-xs-medium text-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Trước
              </button>
              <button
                type="button"
                disabled={data.page >= data.total_pages}
                onClick={() =>
                  setFilters((current) => ({ ...current, page: Math.min(data.total_pages, (current.page ?? 1) + 1) }))
                }
                className="h-9 rounded-md border border-subtle px-3 text-body-xs-medium text-secondary disabled:cursor-not-allowed disabled:opacity-50"
              >
                Tiếp
              </button>
            </div>
          </nav>
        )}
      </div>
    </main>
  );
}

function PublicMessage({ title, description, onRetry }: { title: string; description: string; onRetry?: () => void }) {
  return (
    <main className="flex min-h-screen items-center justify-center bg-surface-1 px-5 text-primary">
      <div className="w-full max-w-md space-y-3 rounded-xl border border-subtle bg-surface-1 p-8 text-center">
        <h1 className="text-body-md-medium">{title}</h1>
        <p className="text-body-sm-regular text-secondary">{description}</p>
        {onRetry && (
          <button
            type="button"
            onClick={onRetry}
            className="rounded-md bg-layer-1 px-3 py-2 text-body-xs-medium text-primary"
          >
            Tải lại
          </button>
        )}
      </div>
    </main>
  );
}

function SummaryCard({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-subtle bg-surface-1 p-4">
      <p className="text-body-xs-regular text-tertiary">{label}</p>
      <p className="mt-2 truncate text-h5-semibold text-primary tabular-nums">{value}</p>
    </div>
  );
}

function FilterSelect({
  label,
  value,
  onChange,
  children,
}: {
  label: string;
  value: string;
  onChange: (value: string) => void;
  children: ReactNode;
}) {
  return (
    <label className="flex min-w-0 flex-col gap-1 text-caption-md-medium text-tertiary">
      {label}
      <select
        value={value}
        onChange={(event) => onChange(event.target.value)}
        className="h-10 min-w-0 rounded-md border border-subtle bg-surface-1 px-2.5 text-body-xs-regular text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
      >
        {children}
      </select>
    </label>
  );
}

function DnttTableRow({ entry }: { entry: DnttPublicEntry }) {
  return (
    <tr className="align-top transition-colors hover:bg-layer-1">
      <td className="px-4 py-3 text-body-xs-medium whitespace-nowrap text-accent-primary">
        {entry.request_number || "—"}
        {entry.line_count && entry.line_count > 1 && (
          <span className="mt-1 block text-caption-md-regular text-tertiary">{entry.line_count} dòng chi tiết</span>
        )}
      </td>
      <td className="px-4 py-3 text-body-xs-regular text-primary">{entry.requester || "—"}</td>
      <td className="px-4 py-3">
        <span className="block text-body-xs-regular text-primary">{entry.department || "—"}</span>
        <span className="mt-1 inline-flex rounded bg-layer-1 px-2 py-0.5 text-caption-md-regular text-secondary">
          {entry.category}
        </span>
      </td>
      <td className="max-w-[420px] px-4 py-3 text-body-xs-regular whitespace-pre-line text-secondary">
        {entry.description || "—"}
      </td>
      <td className="px-4 py-3 text-right text-body-xs-medium whitespace-nowrap text-primary tabular-nums">
        {formatDnttAmount(entry.amount)}
      </td>
    </tr>
  );
}

function DnttMobileCard({ entry }: { entry: DnttPublicEntry }) {
  return (
    <article className="space-y-2 p-4">
      <div className="flex items-start justify-between gap-3">
        <div className="min-w-0">
          <p className="truncate text-body-xs-medium text-accent-primary">{entry.request_number || "—"}</p>
          <h3 className="mt-1 text-body-sm-medium break-words whitespace-pre-line text-primary">
            {entry.description || "—"}
          </h3>
          {entry.line_count && entry.line_count > 1 && (
            <p className="mt-1 text-caption-md-regular text-tertiary">{entry.line_count} dòng chi tiết</p>
          )}
        </div>
        <span className="shrink-0 text-body-xs-medium text-primary tabular-nums">{formatDnttAmount(entry.amount)}</span>
      </div>
      <p className="text-body-xs-regular text-secondary">
        {entry.requester || "—"} · {entry.department || "—"}
      </p>
      <span className="inline-flex rounded bg-layer-1 px-2 py-0.5 text-caption-md-regular text-secondary">
        {entry.category}
      </span>
    </article>
  );
}
