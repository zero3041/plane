/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
// plane packages
import type { TAdminAuthErrorInfo } from "@plane/constants";
import { SUPPORT_EMAIL, EAdminAuthErrorCodes } from "@plane/constants";

export enum EErrorAlertType {
  BANNER_ALERT = "BANNER_ALERT",
  INLINE_FIRST_NAME = "INLINE_FIRST_NAME",
  INLINE_EMAIL = "INLINE_EMAIL",
  INLINE_PASSWORD = "INLINE_PASSWORD",
  INLINE_EMAIL_CODE = "INLINE_EMAIL_CODE",
}

const errorCodeMessages: {
  [key in EAdminAuthErrorCodes]: { title: string; message: (email?: string) => React.ReactNode };
} = {
  // admin
  [EAdminAuthErrorCodes.ADMIN_ALREADY_EXIST]: {
    title: `Quản trị viên đã tồn tại`,
    message: () => `Quản trị viên đã tồn tại. Vui lòng thử lại.`,
  },
  [EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    title: `Cần nhập email, mật khẩu và tên`,
    message: () => `Cần nhập email, mật khẩu và tên. Vui lòng thử lại.`,
  },
  [EAdminAuthErrorCodes.INVALID_ADMIN_EMAIL]: {
    title: `Email quản trị không hợp lệ`,
    message: () => `Email quản trị không hợp lệ. Vui lòng thử lại.`,
  },
  [EAdminAuthErrorCodes.INVALID_ADMIN_PASSWORD]: {
    title: `Mật khẩu quản trị không hợp lệ`,
    message: () => `Mật khẩu quản trị không hợp lệ. Vui lòng thử lại.`,
  },
  [EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    title: `Cần nhập email và mật khẩu`,
    message: () => `Cần nhập email và mật khẩu. Vui lòng thử lại.`,
  },
  [EAdminAuthErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    title: `Xác thực thất bại`,
    message: () => `Xác thực thất bại. Vui lòng thử lại.`,
  },
  [EAdminAuthErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
    title: `Tài khoản quản trị đã tồn tại`,
    message: () => (
      <div>
        Tài khoản quản trị đã tồn tại.&nbsp;
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" href={`/admin`}>
          Đăng nhập
        </Link>
        &nbsp;ngay.
      </div>
    ),
  },
  [EAdminAuthErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
    title: `Tài khoản quản trị không tồn tại`,
    message: () => (
      <div>
        Tài khoản quản trị không tồn tại.&nbsp;
        <Link className="font-medium underline underline-offset-4 transition-all hover:font-bold" href={`/admin`}>
          Đăng nhập
        </Link>
        &nbsp;ngay.
      </div>
    ),
  },
  [EAdminAuthErrorCodes.ADMIN_USER_DEACTIVATED]: {
    title: `Tài khoản đã bị vô hiệu hóa`,
    message: () => `Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ ${SUPPORT_EMAIL ? SUPPORT_EMAIL : "administrator"}.`,
  },
};

export const authErrorHandler = (errorCode: EAdminAuthErrorCodes, email?: string): TAdminAuthErrorInfo | undefined => {
  const bannerAlertErrorCodes = [
    EAdminAuthErrorCodes.ADMIN_ALREADY_EXIST,
    EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME,
    EAdminAuthErrorCodes.INVALID_ADMIN_EMAIL,
    EAdminAuthErrorCodes.INVALID_ADMIN_PASSWORD,
    EAdminAuthErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD,
    EAdminAuthErrorCodes.ADMIN_AUTHENTICATION_FAILED,
    EAdminAuthErrorCodes.ADMIN_USER_ALREADY_EXIST,
    EAdminAuthErrorCodes.ADMIN_USER_DOES_NOT_EXIST,
    EAdminAuthErrorCodes.ADMIN_USER_DEACTIVATED,
  ];

  if (bannerAlertErrorCodes.includes(errorCode))
    return {
      type: EErrorAlertType.BANNER_ALERT,
      code: errorCode,
      title: errorCodeMessages[errorCode]?.title || "Lỗi",
      message: errorCodeMessages[errorCode]?.message(email) || "Đã xảy ra lỗi. Vui lòng thử lại.",
    };

  return undefined;
};
