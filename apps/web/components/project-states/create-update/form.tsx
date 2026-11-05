/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useState } from "react";
import { Field, FieldLabel } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Popover, PopoverContent, PopoverTrigger } from "@makeplane/propel/components/popover";
import { Select, SelectContent, SelectItem, SelectList, SelectTrigger } from "@makeplane/propel/components/select";
import { TextArea, TextAreaGroup } from "@makeplane/propel/components/text-area";
import { Button } from "@makeplane/propel/components/button";
import { ColorSwatchPicker } from "@plane/blocks/common";
import { useTranslation } from "@plane/i18n";
import type { IState, TStateAttentionKind } from "@plane/types";

type TStateForm = {
  data: Partial<IState>;
  onSubmit: (formData: Partial<IState>) => Promise<{ status: string }>;
  onCancel: () => void;
  buttonDisabled: boolean;
  buttonTitle: string;
};

function PopoverButton({ color }: { color?: string }) {
  return (
    <span
      className="group inline-flex h-5 w-5 items-center rounded-sm text-14 font-medium transition-all"
      style={{
        backgroundColor: color ?? "black",
      }}
    />
  );
}

export function StateForm(props: TStateForm) {
  const { data, onSubmit, onCancel, buttonDisabled, buttonTitle } = props;
  // plane hooks
  const { t } = useTranslation();
  // states
  const [formData, setFromData] = useState<Partial<IState> | undefined>(undefined);
  const [errors, setErrors] = useState<Partial<Record<keyof IState, string>> | undefined>(undefined);

  const isOpenGroup = ["backlog", "unstarted", "started"].includes(formData?.group ?? "");
  const attentionOptions: { value: TStateAttentionKind; label: string }[] = [
    { value: "normal", label: t("home.personal_dashboard.attention_normal") },
    { value: "blocked", label: t("home.personal_dashboard.attention_blocked") },
    { value: "paused", label: t("home.personal_dashboard.attention_paused") },
  ];

  useEffect(() => {
    if (data && !formData) setFromData({ ...data, attention_kind: data.attention_kind ?? "normal" });
  }, [data, formData]);

  const handleFormData = <T extends keyof IState>(key: T, value: IState[T]) => {
    setFromData((prev) => ({ ...prev, [key]: value }));
    setErrors((prev) => ({ ...prev, [key]: "" }));
  };

  const formSubmit = async (event: React.MouseEvent<HTMLButtonElement, MouseEvent>) => {
    event.preventDefault();

    const name = formData?.name || undefined;
    if (!formData || !name) {
      let currentErrors: Partial<Record<keyof IState, string>> = {};
      if (!name) currentErrors = { ...currentErrors, name: "Name is required" };
      setErrors(currentErrors);
      return;
    }

    try {
      await onSubmit({
        ...formData,
        attention_kind: isOpenGroup ? (formData.attention_kind ?? "normal") : "normal",
      });
    } catch (error) {
      console.log("error", error);
    }
  };

  return (
    <div className="relative flex space-x-2 rounded-sm bg-surface-1 p-3">
      {/* color */}
      <div className="mt-2 h-full flex-shrink-0">
        <Popover>
          <PopoverTrigger
            render={
              <button
                type="button"
                className="flex items-center justify-center rounded-sm focus:outline-none"
                aria-label={t("aria_labels.color_picker.open")}
              >
                <PopoverButton color={formData?.color} />
              </button>
            }
          />
          <PopoverContent variant="rich" side="bottom" align="start">
            <ColorSwatchPicker value={formData?.color} onChange={(hex) => handleFormData("color", hex)} />
          </PopoverContent>
        </Popover>
      </div>

      <div className="w-full space-y-2">
        {/* title */}
        <Field name="name" invalid={(errors && Boolean(errors.name)) || false}>
          <InputGroup size="2xl">
            <Input
              size="2xl"
              id="name"
              type="text"
              name="name"
              placeholder="Tên"
              value={formData?.name}
              onChange={(e) => handleFormData("name", e.target.value)}
              maxLength={100}
              // oxlint-disable-next-line jsx-a11y/no-autofocus -- Focus the primary required field when the modal opens.
              autoFocus
            />
          </InputGroup>
        </Field>

        {/* description */}
        <Field name="description" invalid={(errors && Boolean(errors.description)) || false}>
          <TextAreaGroup resize="none">
            <TextArea
              size="lg"
              surface="field"
              autoResize
              maxRows={8}
              id="description"
              name="description"
              placeholder="Mô tả trạng thái này cho thành viên."
              value={formData?.description ?? ""}
              onChange={(e) => handleFormData("description", e.target.value)}
            />
          </TextAreaGroup>
        </Field>

        {isOpenGroup && (
          <Field name="attention_kind">
            <FieldLabel size="lg" inset={false}>
              {t("home.personal_dashboard.attention_label")}
            </FieldLabel>
            <Select<TStateAttentionKind>
              name="attention_kind"
              items={attentionOptions}
              value={formData?.attention_kind ?? "normal"}
              onValueChange={(value) => {
                if (value) handleFormData("attention_kind", value);
              }}
              disabled={buttonDisabled}
            >
              <SelectTrigger size="lg" />
              <SelectContent>
                <SelectList>
                  {attentionOptions.map((option) => (
                    <SelectItem key={option.value} value={option.value} label={option.label} size="lg" />
                  ))}
                </SelectList>
              </SelectContent>
            </Select>
          </Field>
        )}

        <div className="flex items-center space-x-2">
          <Button
            variant="primary"
            size="md"
            stretch="auto"
            label={buttonTitle}
            onClick={formSubmit}
            disabled={buttonDisabled}
          />
          <Button
            type="button"
            variant="secondary"
            size="md"
            stretch="auto"
            label="Hủy"
            disabled={buttonDisabled}
            onClick={onCancel}
          />
        </div>
      </div>
    </div>
  );
}
