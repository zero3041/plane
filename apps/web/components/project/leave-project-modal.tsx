/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { observer } from "mobx-react";
import { useParams } from "next/navigation";
import { Controller, useForm } from "react-hook-form";
import { WarningTriangleOutline } from "@makeplane/propel/icons";
// Plane imports
import { Field } from "@makeplane/propel/components/field";
import { Input, InputGroup } from "@makeplane/propel/components/input";
import { Button } from "@makeplane/propel/components/button";
import { setToast } from "@plane/blocks/toast";
import { useTranslation } from "@plane/i18n";
import type { IProject } from "@plane/types";
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
// hooks
import { useUserPermissions } from "@/hooks/store/user";
import { useAppRouter } from "@/hooks/use-app-router";

type FormData = {
  projectName: string;
  confirmLeave: string;
};

const defaultValues: FormData = {
  projectName: "",
  confirmLeave: "",
};

export interface ILeaveProjectModal {
  project: IProject;
  isOpen: boolean;
  onClose: () => void;
}

export const LeaveProjectModal = observer(function LeaveProjectModal(props: ILeaveProjectModal) {
  const { project, isOpen, onClose } = props;
  const { t } = useTranslation();
  // router
  const router = useAppRouter();
  const { workspaceSlug } = useParams();
  // store hooks
  const { leaveProject } = useUserPermissions();

  const {
    control,
    formState: { errors, isSubmitting },
    handleSubmit,
    reset,
  } = useForm({ defaultValues });

  const handleClose = () => {
    reset({ ...defaultValues });
    onClose();
  };

  const onSubmit = async (data: any) => {
    if (!workspaceSlug) return;

    if (data) {
      if (data.projectName === project?.name) {
        if (data.confirmLeave === "Leave Project") {
          router.push(`/${workspaceSlug}/projects`);
          return leaveProject(workspaceSlug.toString(), project.id)
            .then(() => {
              handleClose();
            })
            .catch((_err) => {
              setToast({
                type: "error",
                title: "Lỗi!",
                message: "Đã xảy ra lỗi. Vui lòng thử lại sau.",
              });
            });
        } else {
          setToast({
            type: "error",
            title: "Lỗi!",
            message: "Vui lòng nhập 'Leave Project' để xác nhận rời dự án.",
          });
        }
      } else {
        setToast({
          type: "error",
          title: "Lỗi!",
          message: "Vui lòng nhập đúng tên dự án như trong mô tả.",
        });
      }
    } else {
      setToast({
        type: "error",
        title: "Lỗi!",
        message: "Vui lòng điền đầy đủ các trường.",
      });
    }
  };

  return (
    <Dialog
      open={isOpen}
      onOpenChange={(open) => {
        if (!open) handleClose();
      }}
    >
      <DialogContent size="md">
        <form onSubmit={handleSubmit(onSubmit)} className="flex min-h-0 flex-1 flex-col">
          <DialogMain>
            <DialogHeader>
              <div className="flex w-full items-center justify-start gap-6">
                <span className="place-items-center rounded-full bg-danger-subtle p-4">
                  <WarningTriangleOutline className="h-6 w-6 text-danger-primary" aria-hidden="true" />
                </span>
                <DialogHeading>
                  <DialogTitle>{t("leave_project")}</DialogTitle>
                </DialogHeading>
              </div>
            </DialogHeader>
            <DialogBody>
              <div className="flex flex-col gap-6">
                <p className="text-13 leading-7 text-secondary">
                  Bạn có chắc muốn rời dự án -<span className="font-medium text-primary">{` "${project?.name}" `}</span>
                  ? Bạn sẽ không thể truy cập những mục công việc được giao trong dự án này.
                </p>
                <div className="text-secondary">
                  <p className="text-13 break-words">
                    Nhập tên dự án <span className="font-medium text-primary">{project?.name}</span> để tiếp tục:
                  </p>
                  <Controller
                    control={control}
                    name="projectName"
                    rules={{
                      required: t("name_is_required"),
                    }}
                    render={({ field: { value, onChange, ref } }) => (
                      <Field name="projectName" invalid={Boolean(errors.projectName)}>
                        <InputGroup size="2xl">
                          <Input
                            size="2xl"
                            id="projectName"
                            name="projectName"
                            type="text"
                            value={value}
                            onChange={onChange}
                            ref={ref}
                            placeholder="Nhập tên dự án"
                          />
                        </InputGroup>
                      </Field>
                    )}
                  />
                </div>
                <div className="text-secondary">
                  <p className="text-13">
                    Để xác nhận, hãy nhập <span className="font-medium text-primary">Leave Project</span> bên dưới:
                  </p>
                  <Controller
                    control={control}
                    name="confirmLeave"
                    render={({ field: { value, onChange, ref } }) => (
                      <Field name="confirmLeave" invalid={Boolean(errors.confirmLeave)}>
                        <InputGroup size="2xl">
                          <Input
                            size="2xl"
                            id="confirmLeave"
                            name="confirmLeave"
                            type="text"
                            value={value}
                            onChange={onChange}
                            ref={ref}
                            placeholder="Nhập 'Leave Project'"
                          />
                        </InputGroup>
                      </Field>
                    )}
                  />
                </div>
              </div>
            </DialogBody>
          </DialogMain>
          <DialogActions>
            <Button variant="secondary" size="md" stretch="auto" label={t("cancel")} onClick={handleClose} />
            <Button
              variant="danger"
              size="md"
              stretch="auto"
              type="submit"
              label={isSubmitting ? t("leaving") : t("leave_project")}
              loading={isSubmitting}
            />
          </DialogActions>
        </form>
      </DialogContent>
    </Dialog>
  );
});
