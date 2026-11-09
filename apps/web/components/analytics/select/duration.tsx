/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

// react
import React from "react";
import { CalendarOutline } from "@makeplane/propel/icons";
// plane package imports
import { ANALYTICS_DURATION_FILTER_OPTIONS } from "@plane/constants";
import { useTranslation } from "@plane/i18n";
import { Select } from "@plane/blocks/select";

type TDurationOption = (typeof ANALYTICS_DURATION_FILTER_OPTIONS)[number];

type Props = {
  value: string | null;
  onChange: (val: TDurationOption["value"]) => void;
  placeholder?: string;
};

function DurationDropdown({ placeholder, onChange, value }: Props) {
  const { t } = useTranslation();

  // derived values
  const options = ANALYTICS_DURATION_FILTER_OPTIONS.map((option) => ({
    value: option.value,
    i18nKey: option.i18nKey,
    name: t(option.i18nKey),
  }));
  const selectedOption = options.find((option) => option.value === value) ?? null;

  return (
    <Select<TDurationOption>
      getValues={() => options}
      value={selectedOption}
      onChange={(val) => {
        const option = options.find((item) => item.value === val);
        if (option) onChange(option.value);
      }}
      getOptionValue={(option) => option.value}
      getOptionLabel={(option) => option.name}
      pinSelected={false}
    >
      <Select.Trigger<TDurationOption> variant="select-md" prependIcon={<CalendarOutline aria-hidden="true" />}>
        {(selected) => (
          <span className="truncate">
            {selected[0]?.name ?? placeholder ?? t("workspace_analytics.filters.duration_label")}
          </span>
        )}
      </Select.Trigger>
    </Select>
  );
}

export default DurationDropdown;
