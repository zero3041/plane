/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import assert from "node:assert/strict";
import { test } from "node:test";
import { createRequire } from "node:module";
import { createInstance } from "i18next";
import type ICUConstructor from "i18next-icu";
import { DEFAULT_LANGUAGE, FALLBACK_LANGUAGE } from "../src/constants/language.js";
import { loadLocale } from "./lib/locale-io.js";

const require = createRequire(import.meta.url);
// Dùng entry CJS để intl-messageformat tương thích với Node, không qua bundler.
const { default: ICU } = require("i18next-icu") as { default: typeof ICUConstructor };

const english = loadLocale("en");
const vietnamese = loadLocale("vi-VN");

function flattenStrings(data: Record<string, unknown>, prefix = ""): [string, string][] {
  return Object.entries(data).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    if (typeof value === "string") return [[path, value]];
    assert.ok(value !== null && typeof value === "object" && !Array.isArray(value), path);
    return flattenStrings(value as Record<string, unknown>, path);
  });
}

test("ngôn ngữ mặc định là tiếng Việt và vẫn có tiếng Anh dự phòng", () => {
  assert.equal(DEFAULT_LANGUAGE, "vi-VN");
  assert.equal(FALLBACK_LANGUAGE, "en");
});

test("tiếng Việt có cùng namespace và khóa với tiếng Anh", () => {
  assert.deepEqual(
    vietnamese.namespaces.map(({ name }) => name).toSorted(),
    english.namespaces.map(({ name }) => name).toSorted()
  );
  for (const namespace of english.namespaces) {
    const target = vietnamese.namespaces.find(({ name }) => name === namespace.name);
    assert.ok(target, namespace.name);
    assert.deepEqual([...target.keys].toSorted(), [...namespace.keys].toSorted(), namespace.name);
  }
});

test("mọi chuỗi tiếng Việt đều render bằng ICU mà không âm thầm trả chuỗi lỗi", async () => {
  const instance = createInstance();
  await instance.use(ICU).init({
    lng: "vi-VN",
    fallbackLng: false,
    resources: {
      "vi-VN": Object.fromEntries(vietnamese.namespaces.map(({ name, data }) => [name, data])),
    },
    ns: vietnamese.namespaces.map(({ name }) => name),
    nsSeparator: false,
    i18nFormat: {
      parseErrorHandler: (error: Error) => {
        throw error;
      },
    },
  });

  for (const namespace of vietnamese.namespaces) {
    for (const [key, value] of flattenStrings(namespace.data)) {
      const samples = value.includes(", plural,") ? [0, 1, 2, 10] : [1];
      for (const count of samples) {
        const variables = Object.fromEntries(
          [...value.matchAll(/\{([A-Za-z_][A-Za-z0-9_]*)/g)].map((match) => [match[1], "mẫu"])
        );
        const result = instance.t(key, { ...variables, ns: namespace.name, count, plural: "", isPublished: "false" });
        assert.equal(typeof result, "string", `${namespace.name}:${key}`);
        if (value.length > 0) assert.ok(result.trim().length > 0, `${namespace.name}:${key}`);
      }
    }
  }
});

test("nhãn Epic đã sửa tuân theo thuật ngữ chuẩn của dự án", () => {
  const labels = new Map(vietnamese.namespaces.flatMap(({ data }) => flattenStrings(data)));
  assert.equal(labels.get("sidebar.epics"), "Epic");
  assert.equal(labels.get("common.epics"), "Epic");
});

test("nhãn phân tích mục công việc có bản dịch tiếng Việt", () => {
  const labels = new Map(vietnamese.namespaces.flatMap(({ data }) => flattenStrings(data)));
  assert.equal(labels.get("workspace_analytics.filters.duration.last_30_days"), "30 ngày qua");
  assert.equal(labels.get("workspace_analytics.filters.x_axis.states"), "Tên trạng thái");
  assert.equal(labels.get("workspace_analytics.filters.y_axis.work_item_count"), "Mục công việc");
  assert.equal(labels.get("workspace_analytics.chart.created"), "Đã tạo");
  assert.equal(labels.get("workspace_analytics.chart.resolved"), "Đã giải quyết");
});

test("nhãn mở rộng thanh bên có bản dịch tiếng Việt", () => {
  const labels = new Map(vietnamese.namespaces.flatMap(({ data }) => flattenStrings(data)));
  assert.equal(labels.get("sidebar.more"), "Xem thêm");
  assert.equal(labels.get("sidebar.hide"), "Ẩn bớt");
});

test("các khóa dùng trên biểu đồ ưu tiên trả về nhãn thay vì nguyên khóa", async () => {
  const instance = createInstance();
  await instance.use(ICU).init({
    lng: "vi-VN",
    fallbackLng: false,
    resources: {
      "vi-VN": Object.fromEntries(vietnamese.namespaces.map(({ name, data }) => [name, data])),
    },
    ns: vietnamese.namespaces.map(({ name }) => name),
    defaultNS: "common",
    fallbackNS: vietnamese.namespaces.map(({ name }) => name).filter((name) => name !== "common"),
    nsSeparator: false,
  });

  assert.equal(instance.t("high"), "Cao");
  assert.equal(instance.t("low"), "Thấp");
  assert.equal(instance.t("medium"), "Trung bình");
  assert.equal(instance.t("urgent"), "Khẩn cấp");
  assert.equal(instance.t("unassigned"), "Chưa phân công");
  assert.equal(instance.t("sidebar.more"), "Xem thêm");
});
