/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { Button } from "@makeplane/propel/components/button";
import { Menu, MenuCheckboxItem, MenuContent, MenuTrigger } from "@makeplane/propel/components/menu";
import { useTranslation } from "@plane/i18n";
import type { TPersonalDashboardColumn } from "@plane/types";

const OPTIONAL_COLUMNS: { key: TPersonalDashboardColumn; label: string }[] = [
  { key: "workspace", label: "home.personal_dashboard.column_workspace" },
  { key: "state", label: "home.personal_dashboard.column_state" },
  { key: "priority", label: "home.personal_dashboard.column_priority" },
  { key: "start-date", label: "home.personal_dashboard.column_start_date" },
  { key: "due-date", label: "home.personal_dashboard.column_due_date" },
];

type Props = {
  columns: TPersonalDashboardColumn[];
  onChange: (columns: TPersonalDashboardColumn[]) => void;
};

export function PersonalDashboardColumnSelector({ columns, onChange }: Props) {
  const { t } = useTranslation();

  const toggleColumn = (column: TPersonalDashboardColumn) => {
    if (columns.includes(column)) {
      onChange(columns.filter((item) => item !== column));
      return;
    }
    onChange([...columns, column]);
  };

  return (
    <Menu>
      <MenuTrigger
        render={<Button variant="secondary" size="lg" stretch="auto" label={t("home.personal_dashboard.columns")} />}
      />
      <MenuContent side="bottom" align="end">
        {OPTIONAL_COLUMNS.map((column) => (
          <MenuCheckboxItem
            key={column.key}
            label={t(column.label)}
            checked={columns.includes(column.key)}
            onCheckedChange={() => toggleColumn(column.key)}
          />
        ))}
      </MenuContent>
    </Menu>
  );
}
