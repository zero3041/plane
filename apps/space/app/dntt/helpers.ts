export interface DnttQueryFilters {
  q?: string;
  date?: string;
  category?: string;
  department?: string;
  requester?: string;
  min_amount?: string;
  max_amount?: string;
  page?: number;
  per_page?: number;
}

export interface DnttPublicEntry {
  id: string;
  date: string;
  category: string;
  request_number: string;
  requester: string;
  department: string;
  description: string;
  amount: string | null;
  line_count?: number;
}

export interface DnttDateGroup<T extends { date: string }> {
  date: string;
  entries: T[];
}

const MAX_PAGE_SIZE = 100;
const DEFAULT_PAGE_SIZE = 25;

function normalizeTextFilter(value: string | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function normalizePage(value: number | undefined): number {
  if (!Number.isFinite(value)) return 1;
  return Math.max(1, Math.floor(value ?? 1));
}

function normalizePageSize(value: number | undefined): number {
  if (!Number.isFinite(value)) return DEFAULT_PAGE_SIZE;
  return Math.min(MAX_PAGE_SIZE, Math.max(1, Math.floor(value ?? DEFAULT_PAGE_SIZE)));
}

export function buildDnttQueryParams(filters: DnttQueryFilters): URLSearchParams {
  const params = new URLSearchParams();

  for (const key of ["q", "date", "category", "department", "requester", "min_amount", "max_amount"] as const) {
    const value = normalizeTextFilter(filters[key]);
    if (value) params.set(key, value);
  }

  params.set("page", String(normalizePage(filters.page)));
  params.set("per_page", String(normalizePageSize(filters.per_page)));
  return params;
}

export function groupDnttByDate<T extends { date: string }>(entries: readonly T[]): DnttDateGroup<T>[] {
  const groups = new Map<string, T[]>();

  for (const entry of entries) {
    const group = groups.get(entry.date) ?? [];
    group.push(entry);
    groups.set(entry.date, group);
  }

  return [...groups.entries()]
    .toSorted(([left], [right]) => right.localeCompare(left))
    .map(([date, groupedEntries]) => ({ date, entries: groupedEntries }));
}

export function formatDnttAmount(amount: string | number | null, locale = "vi-VN"): string {
  if (amount === null || amount === "") return "—";
  const formatter = new Intl.NumberFormat(locale, {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });

  if (typeof amount === "string") {
    const integerAmount = /^(-?\d+)(?:\.0+)?$/.exec(amount.trim());
    if (integerAmount) return formatter.format(BigInt(integerAmount[1]));
  }

  const numericAmount = typeof amount === "number" ? amount : Number(amount);
  if (!Number.isFinite(numericAmount)) return "—";
  return formatter.format(numericAmount);
}
