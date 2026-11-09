/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// plane package imports
import type { ChartYAxisMetric, IState } from "@plane/types";
import { ChartXAxisProperty } from "@plane/types";
import { getDate } from "@plane/utils";

interface ParamsProps {
  x_axis: ChartXAxisProperty;
  y_axis: ChartYAxisMetric;
  group_by?: ChartXAxisProperty;
}

export const localizeChartLabel = (
  label: string,
  property: ChartXAxisProperty | undefined,
  t: (key: string) => string
): string => {
  const normalized = label.toLowerCase().replaceAll("_", "");
  if (normalized === "none" || normalized === "null") return t("common.none");
  if (property === ChartXAxisProperty.PRIORITY && ["urgent", "high", "medium", "low"].includes(normalized)) {
    return t(normalized);
  }
  if (
    property === ChartXAxisProperty.STATE_GROUPS &&
    ["backlog", "unstarted", "started", "completed", "cancelled"].includes(normalized)
  ) {
    return t(`workspace_projects.state.${normalized}`);
  }
  return label;
};

export const formatAnalyticsDate = (value: string, locale: string): string => {
  const date = getDate(value);
  if (!date || Number.isNaN(date.getTime())) return value;
  return new Intl.DateTimeFormat(locale, { day: "numeric", month: "short", year: "numeric" }).format(date);
};

export const generateBarColor = (
  value: string | null | undefined,
  params: ParamsProps,
  baseColors: string[],
  workspaceStates?: IState[]
): string => {
  if (!value) return baseColors[0];
  let color = baseColors[0];
  // Priority
  if (params.x_axis === ChartXAxisProperty.PRIORITY) {
    color =
      value === "urgent"
        ? "#ef4444"
        : value === "high"
          ? "#f97316"
          : value === "medium"
            ? "#eab308"
            : value === "low"
              ? "#22c55e"
              : "#ced4da";
  }

  // State
  if (params.x_axis === ChartXAxisProperty.STATES) {
    if (workspaceStates && workspaceStates.length > 0) {
      const state = workspaceStates.find((s) => s.id === value);
      if (state) {
        color = state.color;
      } else {
        const index = Math.abs(value.split("").reduce((acc, char) => acc + char.charCodeAt(0), 0)) % baseColors.length;
        color = baseColors[index];
      }
    }
  }

  return color;
};
