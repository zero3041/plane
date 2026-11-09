import assert from "node:assert/strict";
import test from "node:test";
import { buildDnttQueryParams, formatDnttAmount, groupDnttByDate } from "./helpers.ts";

test("DNTT query params preserve active filters and pagination", () => {
  const params = buildDnttQueryParams({
    q: "INV-12",
    date: "2026-10-30",
    category: "TMDV",
    department: "Ops",
    requester: "user-a",
    min_amount: "1000",
    max_amount: "5000",
    page: 3,
    per_page: 25,
  });

  assert.deepEqual(Object.fromEntries(params.entries()), {
    q: "INV-12",
    date: "2026-10-30",
    category: "TMDV",
    department: "Ops",
    requester: "user-a",
    min_amount: "1000",
    max_amount: "5000",
    page: "3",
    per_page: "25",
  });
});

test("DNTT query params omit empty filters and clamp pagination", () => {
  const params = buildDnttQueryParams({ q: " ", category: "", page: 0, per_page: 1000 });

  assert.deepEqual(Object.fromEntries(params.entries()), { page: "1", per_page: "100" });
});

test("DNTT entries group by day in descending date order", () => {
  const groups = groupDnttByDate([
    { id: "1", date: "2026-10-29" },
    { id: "2", date: "2026-10-30" },
    { id: "3", date: "2026-10-29" },
  ]);

  assert.deepEqual(groups, [
    { date: "2026-10-30", entries: [{ id: "2", date: "2026-10-30" }] },
    {
      date: "2026-10-29",
      entries: [
        { id: "1", date: "2026-10-29" },
        { id: "3", date: "2026-10-29" },
      ],
    },
  ]);
});

test("DNTT amount formatting preserves large integer values", () => {
  const format = new Intl.NumberFormat("vi-VN", {
    style: "currency",
    currency: "VND",
    maximumFractionDigits: 0,
  });

  assert.equal(formatDnttAmount("9007199254740993"), format.format(9007199254740993n));
});

test("missing DNTT amounts render as unknown instead of zero", () => {
  assert.equal(formatDnttAmount(null), "—");
});
