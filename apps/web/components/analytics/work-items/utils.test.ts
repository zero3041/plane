import assert from "node:assert/strict";
import { test } from "node:test";
import { ChartXAxisProperty } from "@plane/types";
import { formatAnalyticsDate, localizeChartLabel } from "./utils";

test("priority chart translates known values using existing locale keys", () => {
  const labels: Record<string, string> = {
    high: "Cao",
    low: "Thấp",
    medium: "Trung bình",
    urgent: "Khẩn cấp",
    "common.none": "Không có",
  };
  const translate = (key: string) => labels[key] ?? key;

  assert.equal(localizeChartLabel("High", ChartXAxisProperty.PRIORITY, translate), "Cao");
  assert.equal(localizeChartLabel("LOW", ChartXAxisProperty.PRIORITY, translate), "Thấp");
  assert.equal(localizeChartLabel("medium", ChartXAxisProperty.PRIORITY, translate), "Trung bình");
  assert.equal(localizeChartLabel("urgent", ChartXAxisProperty.PRIORITY, translate), "Khẩn cấp");
  assert.equal(localizeChartLabel("None", ChartXAxisProperty.PRIORITY, translate), "Không có");
});

test("analytics date keeps the calendar day in timezones west of UTC", () => {
  const originalTimeZone = process.env.TZ;
  try {
    process.env.TZ = "America/Los_Angeles";
    assert.equal(formatAnalyticsDate("2026-10-01", "vi-VN"), "1 thg 10, 2026");
  } finally {
    if (originalTimeZone === undefined) delete process.env.TZ;
    else process.env.TZ = originalTimeZone;
  }
});
