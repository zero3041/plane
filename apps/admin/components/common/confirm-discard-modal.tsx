/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useRouter } from "next/navigation";
// plane imports
import { ConfirmDialog } from "@plane/blocks/dialog";

type Props = {
  isOpen: boolean;
  handleClose: () => void;
  onDiscardHref: string;
};

export function ConfirmDiscardModal(props: Props) {
  const { isOpen, handleClose, onDiscardHref } = props;
  // router
  const router = useRouter();

  // The confirm used to be a `<Link href={onDiscardHref}>`; ConfirmDialog's confirm is a button, so
  // it navigates through the router instead.
  const handleSubmit = () => {
    try {
      router.push(onDiscardHref);
    } catch (error) {
      console.error("Failed to discard changes and go back:", error);
    }
  };

  return (
    <ConfirmDialog
      isOpen={isOpen}
      handleClose={handleClose}
      handleSubmit={handleSubmit}
      isSubmitting={false}
      variant="primary"
      hideIcon
      title="Bạn có thay đổi chưa lưu"
      content="Những thay đổi chưa lưu sẽ bị mất nếu bạn quay lại. Bạn có muốn quay lại không?"
      primaryButtonText={{ default: "Quay lại" }}
      secondaryButtonText="Tiếp tục chỉnh sửa"
    />
  );
}
