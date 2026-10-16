/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useState } from "react";
import { observer } from "mobx-react";
import { useParams } from "next/navigation";
// Plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";
import { setToast } from "@plane/blocks/toast";
import type { IState } from "@plane/types";
// hooks
import { useProjectState } from "@/hooks/store/use-project-state";

type TStateDeleteModal = {
  isOpen: boolean;
  onClose: () => void;
  data: IState | null;
};

export const StateDeleteModal = observer(function StateDeleteModal(props: TStateDeleteModal) {
  const { isOpen, onClose, data } = props;
  // states
  const [isDeleteLoading, setIsDeleteLoading] = useState(false);
  // router
  const { workspaceSlug } = useParams();
  const { deleteState } = useProjectState();

  const handleClose = () => {
    onClose();
    setIsDeleteLoading(false);
  };

  const handleDeletion = async () => {
    if (!workspaceSlug || !data) return;

    setIsDeleteLoading(true);

    try {
      await deleteState(workspaceSlug.toString(), data.project_id, data.id);
      handleClose();
    } catch (err) {
      if ((err as { status?: number })?.status === 400)
        setToast({
          type: "error",
          title: "Lỗi!",
          message: "Trạng thái này còn mục công việc. Hãy chuyển chúng sang trạng thái khác trước khi xóa.",
        });
      else
        setToast({
          type: "error",
          title: "Lỗi!",
          message: "Không thể xóa trạng thái. Vui lòng thử lại.",
        });
    } finally {
      setIsDeleteLoading(false);
    }
  };

  return (
    <ConfirmDialog
      handleClose={handleClose}
      handleSubmit={handleDeletion}
      isSubmitting={isDeleteLoading}
      isOpen={isOpen}
      title="Xóa trạng thái"
      content={
        <>
          Bạn có chắc muốn xóa trạng thái - <span className="font-medium text-primary">{data?.name}</span>? Mọi dữ liệu
          liên quan đến trạng thái sẽ bị xóa vĩnh viễn. Bạn không thể hoàn tác thao tác này.
        </>
      }
    />
  );
});
