/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import type { FormEvent } from "react";
import { Button } from "@makeplane/propel/components/button";
import {
  Dialog,
  DialogActions,
  DialogBody,
  DialogContent,
  DialogHeader,
  DialogHeading,
  DialogMain,
  DialogTitle,
} from "@makeplane/propel/components/dialog";
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import {
  Menu,
  MenuCheckboxItem,
  MenuContent,
  MenuItem,
  MenuSeparator,
  MenuTrigger,
} from "@makeplane/propel/components/menu";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IPersonalDashboardSavedView } from "@plane/types";
import { UserService } from "@/services/user.service";
import { getDashboardViewFilters, type TDashboardFilters } from "./helpers";

const userService = new UserService();

type TSaveMode = "create" | "update" | "duplicate";

type Props = {
  views: IPersonalDashboardSavedView[];
  selectedView?: IPersonalDashboardSavedView;
  filters: TDashboardFilters;
  onApply: (view: IPersonalDashboardSavedView | null) => void;
  onViewsChanged: () => Promise<unknown>;
};

export function PersonalDashboardSavedViewsControl(props: Props) {
  const { views, selectedView, filters, onApply, onViewsChanged } = props;
  const { t } = useTranslation();
  const [saveMode, setSaveMode] = useState<TSaveMode | null>(null);
  const [viewName, setViewName] = useState("");
  const [validationError, setValidationError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [isDeleteOpen, setIsDeleteOpen] = useState(false);

  const openSaveDialog = (mode: TSaveMode) => {
    setValidationError("");
    setViewName(
      mode === "update"
        ? (selectedView?.name ?? "")
        : mode === "duplicate"
          ? `${selectedView?.name ?? "View"} copy`
          : ""
    );
    setSaveMode(mode);
  };

  const closeSaveDialog = () => {
    if (isSaving) return;
    setSaveMode(null);
    setValidationError("");
  };

  const handleSave = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const name = viewName.trim();
    if (!name) {
      setValidationError(t("home.personal_dashboard.view_name_required"));
      return;
    }
    setIsSaving(true);
    try {
      const payload = {
        name,
        filters: getDashboardViewFilters(filters),
        columns: filters.columns,
        sort_by: filters.sort_by,
        sort_direction: filters.sort_direction,
        is_favorite: saveMode === "update" ? (selectedView?.is_favorite ?? false) : false,
      };
      const savedView =
        saveMode === "update" && selectedView
          ? await userService.updatePersonalDashboardView(selectedView.id, payload)
          : await userService.createPersonalDashboardView(payload);
      await onViewsChanged();
      onApply(savedView);
      setSaveMode(null);
      setToast({
        type: "success",
        title: t("success"),
        message: t(
          saveMode === "update" ? "home.personal_dashboard.view_updated" : "home.personal_dashboard.view_saved"
        ),
      });
    } catch {
      setValidationError(t("home.personal_dashboard.view_save_error"));
    } finally {
      setIsSaving(false);
    }
  };

  const handleToggleFavorite = async () => {
    if (!selectedView) return;
    try {
      await userService.updatePersonalDashboardView(selectedView.id, { is_favorite: !selectedView.is_favorite });
      await onViewsChanged();
    } catch {
      setToast({
        type: "error",
        title: t("error"),
        message: t("home.personal_dashboard.view_save_error"),
      });
    }
  };

  const handleDelete = async () => {
    if (!selectedView) return;
    setIsDeleting(true);
    try {
      await userService.deletePersonalDashboardView(selectedView.id);
      await onViewsChanged();
      onApply(null);
      setIsDeleteOpen(false);
      setToast({
        type: "success",
        title: t("success"),
        message: t("home.personal_dashboard.view_deleted"),
      });
    } catch {
      setToast({
        type: "error",
        title: t("error"),
        message: t("home.personal_dashboard.view_delete_error"),
      });
    } finally {
      setIsDeleting(false);
    }
  };

  const viewOptions = [
    { value: "", label: t("home.personal_dashboard.current_filters") },
    ...views.map((view) => ({ value: view.id, label: `${view.is_favorite ? "★ " : ""}${view.name}` })),
    ...(filters.saved_view_id && !selectedView
      ? [{ value: filters.saved_view_id, label: t("home.personal_dashboard.saved_view_unavailable") }]
      : []),
  ];

  return (
    <>
      <div className="flex w-full flex-col gap-2 sm:w-auto sm:flex-row">
        <div className="w-full sm:w-64">
          <Select<string>
            value={filters.saved_view_id}
            onValueChange={(value) => onApply(views.find((view) => view.id === value) ?? null)}
            items={viewOptions}
          >
            <SelectTrigger size="lg" aria-label={t("home.personal_dashboard.saved_views")} />
            <SelectContent side="bottom" align="end">
              <SelectList>
                {viewOptions.map((option) => (
                  <SelectItem
                    key={option.value || "current-filters"}
                    value={option.value}
                    size="lg"
                    label={option.label}
                  />
                ))}
              </SelectList>
            </SelectContent>
          </Select>
        </div>
        <Menu>
          <MenuTrigger
            render={
              <Button variant="secondary" size="lg" stretch="auto" label={t("home.personal_dashboard.view_actions")} />
            }
          />
          <MenuContent side="bottom" align="end">
            {selectedView ? (
              <>
                <MenuItem label={t("home.personal_dashboard.update_view")} onClick={() => openSaveDialog("update")} />
                <MenuItem
                  label={t("home.personal_dashboard.duplicate_view")}
                  onClick={() => openSaveDialog("duplicate")}
                />
                <MenuCheckboxItem
                  label={t(
                    selectedView.is_favorite ? "home.personal_dashboard.unpin_view" : "home.personal_dashboard.pin_view"
                  )}
                  checked={selectedView.is_favorite}
                  onCheckedChange={() => void handleToggleFavorite()}
                />
                <MenuSeparator />
                <MenuItem label={t("home.personal_dashboard.delete_view")} onClick={() => setIsDeleteOpen(true)} />
                <MenuSeparator />
              </>
            ) : null}
            <MenuItem label={t("home.personal_dashboard.save_view_as")} onClick={() => openSaveDialog("create")} />
          </MenuContent>
        </Menu>
      </div>

      <Dialog
        open={saveMode !== null}
        onOpenChange={(open) => {
          if (!open) closeSaveDialog();
        }}
      >
        <DialogContent size="sm">
          <form onSubmit={handleSave} className="flex min-h-0 flex-1 flex-col">
            <DialogMain>
              <DialogHeader>
                <DialogHeading>
                  <DialogTitle>
                    {t(
                      saveMode === "update"
                        ? "home.personal_dashboard.update_view"
                        : "home.personal_dashboard.save_view"
                    )}
                  </DialogTitle>
                </DialogHeading>
              </DialogHeader>
              <DialogBody>
                <Field name="view_name" invalid={Boolean(validationError)}>
                  <InputGroup size="2xl">
                    <Input
                      size="2xl"
                      id="dashboard-view-name"
                      name="view_name"
                      value={viewName}
                      onChange={(event) => {
                        setViewName(event.target.value);
                        setValidationError("");
                      }}
                      maxLength={100}
                      placeholder={t("home.personal_dashboard.view_name_placeholder")}
                      autoComplete="off"
                    />
                  </InputGroup>
                </Field>
                {validationError && (
                  <p role="alert" className="mt-2 text-body-xs-regular text-danger-primary">
                    {validationError}
                  </p>
                )}
              </DialogBody>
            </DialogMain>
            <DialogActions>
              <Button
                variant="secondary"
                size="md"
                stretch="auto"
                label={t("cancel")}
                onClick={closeSaveDialog}
                disabled={isSaving}
              />
              <Button
                variant="primary"
                size="md"
                stretch="auto"
                type="submit"
                label={isSaving ? t("saving") : t("save")}
                loading={isSaving}
              />
            </DialogActions>
          </form>
        </DialogContent>
      </Dialog>

      <ConfirmDialog
        isOpen={isDeleteOpen}
        isSubmitting={isDeleting}
        title={t("home.personal_dashboard.delete_view")}
        content={t("home.personal_dashboard.delete_view_confirmation", { name: selectedView?.name ?? "" })}
        primaryButtonText={{ default: t("delete"), loading: t("deleting") }}
        handleClose={() => setIsDeleteOpen(false)}
        handleSubmit={handleDelete}
      />
    </>
  );
}
