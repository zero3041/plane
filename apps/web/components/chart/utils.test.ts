import assert from "node:assert/strict";
import { test } from "node:test";
import { ChartXAxisDateGrouping } from "@plane/constants";
import { ChartXAxisProperty } from "@plane/types";
import type { TChart } from "@plane/types";
import { parseChartData } from "./utils";

test("analytics date labels use the selected locale without changing chart keys", () => {
  const source = {
    data: [{ key: "2020-10-21", name: "2020-10-21", count: 2 }],
    schema: { series: "2020-10-21" },
  } as unknown as TChart;

  const chart = parseChartData(
    source,
    ChartXAxisProperty.CREATED_AT,
    ChartXAxisProperty.CREATED_AT,
    ChartXAxisDateGrouping.WEEK,
    "vi-VN",
    (count) => `Tuần ${count}`
  );

  assert.match(chart.data[0].name, /Tuần \d/);
  assert.match(chart.schema.series, /Tuần \d/);
  assert.equal(chart.data[0].key, "2020-10-21");
  assert.equal(source.data[0].name, "2020-10-21");
});
