/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { ReactNode } from "react";
import Link from "next/link";
// plane imports
import { SUPPORT_EMAIL } from "@plane/constants";

export enum EPageTypes {
  PUBLIC = "PUBLIC",
  NON_AUTHENTICATED = "NON_AUTHENTICATED",
  SET_PASSWORD = "SET_PASSWORD",
  ONBOARDING = "ONBOARDING",
  AUTHENTICATED = "AUTHENTICATED",
}

export enum EAuthModes {
  SIGN_IN = "SIGN_IN",
  SIGN_UP = "SIGN_UP",
}

export enum EAuthSteps {
  EMAIL = "EMAIL",
  PASSWORD = "PASSWORD",
  UNIQUE_CODE = "UNIQUE_CODE",
}

export enum EErrorAlertType {
  BANNER_ALERT = "BANNER_ALERT",
  INLINE_FIRST_NAME = "INLINE_FIRST_NAME",
  INLINE_EMAIL = "INLINE_EMAIL",
  INLINE_PASSWORD = "INLINE_PASSWORD",
  INLINE_EMAIL_CODE = "INLINE_EMAIL_CODE",
}

export enum EAuthenticationErrorCodes {
  // Global
  INSTANCE_NOT_CONFIGURED = "5000",
  INVALID_EMAIL = "5005",
  EMAIL_REQUIRED = "5010",
  SIGNUP_DISABLED = "5015",
  MAGIC_LINK_LOGIN_DISABLED = "5016",
  BOT_USER_LOGIN_FORBIDDEN = "5017",
  PASSWORD_LOGIN_DISABLED = "5018",
  USER_ACCOUNT_DEACTIVATED = "5019",
  // Password strength
  INVALID_PASSWORD = "5020",
  PASSWORD_TOO_WEAK = "5021",
  SMTP_NOT_CONFIGURED = "5025",
  // Sign Up
  USER_ALREADY_EXIST = "5030",
  AUTHENTICATION_FAILED_SIGN_UP = "5035",
  REQUIRED_EMAIL_PASSWORD_SIGN_UP = "5040",
  INVALID_EMAIL_SIGN_UP = "5045",
  INVALID_EMAIL_MAGIC_SIGN_UP = "5050",
  MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED = "5055",
  // Sign In
  USER_DOES_NOT_EXIST = "5060",
  AUTHENTICATION_FAILED_SIGN_IN = "5065",
  REQUIRED_EMAIL_PASSWORD_SIGN_IN = "5070",
  INVALID_EMAIL_SIGN_IN = "5075",
  INVALID_EMAIL_MAGIC_SIGN_IN = "5080",
  MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED = "5085",
  // Both Sign in and Sign up for magic
  INVALID_MAGIC_CODE_SIGN_IN = "5090",
  INVALID_MAGIC_CODE_SIGN_UP = "5092",
  EXPIRED_MAGIC_CODE_SIGN_IN = "5095",
  EXPIRED_MAGIC_CODE_SIGN_UP = "5097",
  EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN = "5100",
  EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP = "5102",
  // Oauth
  OAUTH_NOT_CONFIGURED = "5104",
  GOOGLE_NOT_CONFIGURED = "5105",
  GITHUB_NOT_CONFIGURED = "5110",
  GITLAB_NOT_CONFIGURED = "5111",
  GOOGLE_OAUTH_PROVIDER_ERROR = "5115",
  GITHUB_OAUTH_PROVIDER_ERROR = "5120",
  GITLAB_OAUTH_PROVIDER_ERROR = "5121",
  // Reset Password
  INVALID_PASSWORD_TOKEN = "5125",
  EXPIRED_PASSWORD_TOKEN = "5130",
  // Change password
  INCORRECT_OLD_PASSWORD = "5135",
  MISSING_PASSWORD = "5138",
  INVALID_NEW_PASSWORD = "5140",
  // set password
  PASSWORD_ALREADY_SET = "5145",
  // Admin
  ADMIN_ALREADY_EXIST = "5150",
  REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME = "5155",
  INVALID_ADMIN_EMAIL = "5160",
  INVALID_ADMIN_PASSWORD = "5165",
  REQUIRED_ADMIN_EMAIL_PASSWORD = "5170",
  ADMIN_AUTHENTICATION_FAILED = "5175",
  ADMIN_USER_ALREADY_EXIST = "5180",
  ADMIN_USER_DOES_NOT_EXIST = "5185",
  ADMIN_USER_DEACTIVATED = "5190",
  // Rate limit
  RATE_LIMIT_EXCEEDED = "5900",
}

export type TAuthErrorInfo = {
  type: EErrorAlertType;
  code: EAuthenticationErrorCodes;
  title: string;
  message: ReactNode;
};

// TODO: move all error messages to translation files
const errorCodeMessages: {
  [key in EAuthenticationErrorCodes]: { title: string; message: (email?: string) => ReactNode };
} = {
  // global
  [EAuthenticationErrorCodes.INSTANCE_NOT_CONFIGURED]: {
    title: `Hệ thống chưa được cấu hình`,
    message: () => `Hệ thống chưa được cấu hình. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL]: {
    title: `Email không hợp lệ`,
    message: () => `Email không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.EMAIL_REQUIRED]: {
    title: `Vui lòng nhập email`,
    message: () => `Vui lòng nhập email và thử lại.`,
  },
  [EAuthenticationErrorCodes.SIGNUP_DISABLED]: {
    title: `Đã tắt đăng ký`,
    message: () => `Đã tắt đăng ký. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.MAGIC_LINK_LOGIN_DISABLED]: {
    title: `Đã tắt đăng nhập bằng liên kết`,
    message: () => `Đã tắt đăng nhập bằng liên kết. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.PASSWORD_LOGIN_DISABLED]: {
    title: `Đã tắt đăng nhập bằng mật khẩu`,
    message: () => `Đã tắt đăng nhập bằng mật khẩu. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED]: {
    title: `Tài khoản đã bị vô hiệu hóa`,
    message: () => `Tài khoản đã bị vô hiệu hóa. Vui lòng liên hệ ${SUPPORT_EMAIL ? SUPPORT_EMAIL : "quản trị viên"}.`,
  },
  [EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN]: {
    title: `Không thể đăng nhập`,
    message: () => `Không thể đăng nhập bằng tài khoản này. Vui lòng dùng tài khoản cá nhân.`,
  },
  [EAuthenticationErrorCodes.INVALID_PASSWORD]: {
    title: `Mật khẩu không hợp lệ`,
    message: () => `Mật khẩu không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.PASSWORD_TOO_WEAK]: {
    title: `Mật khẩu quá yếu`,
    message: () => `Vui lòng dùng mật khẩu mạnh hơn.`,
  },
  [EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED]: {
    title: `SMTP chưa được cấu hình`,
    message: () => `SMTP chưa được cấu hình. Vui lòng liên hệ quản trị viên.`,
  },

  // sign up
  [EAuthenticationErrorCodes.USER_ALREADY_EXIST]: {
    title: `Người dùng đã tồn tại`,
    message: (email = undefined) => (
      <div>
        Tài khoản của bạn đã được đăng ký.&nbsp;
        <Link
          className="font-medium underline underline-offset-4 transition-all hover:font-bold"
          href={`/sign-in${email ? `?email=${encodeURIComponent(email)}` : ``}`}
        >
          Đăng nhập
        </Link>
        &nbsp;ngay.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP]: {
    title: `Vui lòng nhập email và mật khẩu`,
    message: () => `Vui lòng nhập email và mật khẩu rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP]: {
    title: `Xác thực thất bại`,
    message: () => `Xác thực thất bại. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP]: {
    title: `Email không hợp lệ`,
    message: () => `Email không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED]: {
    title: `Vui lòng nhập email và mã`,
    message: () => `Vui lòng nhập email và mã rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP]: {
    title: `Email không hợp lệ`,
    message: () => `Email không hợp lệ. Vui lòng thử lại.`,
  },

  [EAuthenticationErrorCodes.USER_DOES_NOT_EXIST]: {
    title: `Người dùng không tồn tại`,
    message: (email = undefined) => (
      <div>
        Không tìm thấy tài khoản.&nbsp;
        <Link
          className="font-medium underline underline-offset-4 transition-all hover:font-bold"
          href={`/${email ? `?email=${encodeURIComponent(email)}` : ``}`}
        >
          Tạo tài khoản
        </Link>
        &nbsp;để bắt đầu.
      </div>
    ),
  },
  [EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN]: {
    title: `Vui lòng nhập email và mật khẩu`,
    message: () => `Vui lòng nhập email và mật khẩu rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN]: {
    title: `Xác thực thất bại`,
    message: () => `Xác thực thất bại. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN]: {
    title: `Email không hợp lệ`,
    message: () => `Email không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED]: {
    title: `Vui lòng nhập email và mã`,
    message: () => `Vui lòng nhập email và mã rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN]: {
    title: `Email không hợp lệ`,
    message: () => `Email không hợp lệ. Vui lòng thử lại.`,
  },

  // Both Sign in and Sign up
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN]: {
    title: `Xác thực thất bại`,
    message: () => `Mã đăng nhập không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP]: {
    title: `Xác thực thất bại`,
    message: () => `Mã đăng nhập không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN]: {
    title: `Mã đăng nhập đã hết hạn`,
    message: () => `Mã đăng nhập đã hết hạn. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP]: {
    title: `Mã đăng nhập đã hết hạn`,
    message: () => `Mã đăng nhập đã hết hạn. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN]: {
    title: `Mã đăng nhập đã hết hạn`,
    message: () => `Mã đăng nhập đã hết hạn. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP]: {
    title: `Mã đăng nhập đã hết hạn`,
    message: () => `Mã đăng nhập đã hết hạn. Vui lòng thử lại.`,
  },

  // Oauth
  [EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED]: {
    title: `OAuth chưa được cấu hình`,
    message: () => `OAuth chưa được cấu hình. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED]: {
    title: `Google chưa được cấu hình`,
    message: () => `Google chưa được cấu hình. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED]: {
    title: `GitHub chưa được cấu hình`,
    message: () => `GitHub chưa được cấu hình. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED]: {
    title: `GitLab chưa được cấu hình`,
    message: () => `GitLab chưa được cấu hình. Vui lòng liên hệ quản trị viên.`,
  },
  [EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR]: {
    title: `Lỗi nhà cung cấp Google OAuth`,
    message: () => `Lỗi nhà cung cấp Google OAuth. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR]: {
    title: `Lỗi nhà cung cấp GitHub OAuth`,
    message: () => `Lỗi nhà cung cấp GitHub OAuth. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR]: {
    title: `Lỗi nhà cung cấp GitLab OAuth`,
    message: () => `Lỗi nhà cung cấp GitLab OAuth. Vui lòng thử lại.`,
  },

  // Reset Password
  [EAuthenticationErrorCodes.INVALID_PASSWORD_TOKEN]: {
    title: `Mã đặt lại mật khẩu không hợp lệ`,
    message: () => `Mã đặt lại mật khẩu không hợp lệ.`,
  },
  [EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN]: {
    title: `Mã đặt lại mật khẩu đã hết hạn`,
    message: () => `Mã đặt lại mật khẩu đã hết hạn. Vui lòng thử lại.`,
  },

  // Change password
  [EAuthenticationErrorCodes.MISSING_PASSWORD]: {
    title: `Vui lòng nhập mật khẩu`,
    message: () => `Vui lòng nhập mật khẩu rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD]: {
    title: `Mật khẩu cũ không đúng`,
    message: () => `Mật khẩu cũ không đúng. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_NEW_PASSWORD]: {
    title: `Mật khẩu mới không hợp lệ`,
    message: () => `Mật khẩu mới không hợp lệ. Vui lòng thử lại.`,
  },

  // set password
  [EAuthenticationErrorCodes.PASSWORD_ALREADY_SET]: {
    title: `Mật khẩu đã được đặt`,
    message: () => `Mật khẩu đã được đặt. Vui lòng thử lại.`,
  },

  // admin
  [EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST]: {
    title: `Quản trị viên đã tồn tại`,
    message: () => `Quản trị viên đã tồn tại. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME]: {
    title: `Vui lòng nhập email, mật khẩu và tên`,
    message: () => `Vui lòng nhập email, mật khẩu và tên rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL]: {
    title: `Email quản trị viên không hợp lệ`,
    message: () => `Email quản trị viên không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD]: {
    title: `Mật khẩu quản trị viên không hợp lệ`,
    message: () => `Mật khẩu quản trị viên không hợp lệ. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD]: {
    title: `Vui lòng nhập email và mật khẩu`,
    message: () => `Vui lòng nhập email và mật khẩu rồi thử lại.`,
  },
  [EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED]: {
    title: `Xác thực thất bại`,
    message: () => `Xác thực thất bại. Vui lòng thử lại.`,
  },
  [EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST]: {
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
  [EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST]: {
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
  [EAuthenticationErrorCodes.ADMIN_USER_DEACTIVATED]: {
    title: `Tài khoản quản trị đã bị vô hiệu hóa`,
    message: () => <div>Tài khoản của bạn đã bị vô hiệu hóa</div>,
  },
  [EAuthenticationErrorCodes.RATE_LIMIT_EXCEEDED]: {
    title: "",
    message: () => `Đã vượt quá giới hạn yêu cầu. Vui lòng thử lại sau.`,
  },
};

export const authErrorHandler = (errorCode: EAuthenticationErrorCodes, email?: string): TAuthErrorInfo | undefined => {
  const bannerAlertErrorCodes = [
    EAuthenticationErrorCodes.INSTANCE_NOT_CONFIGURED,
    EAuthenticationErrorCodes.INVALID_EMAIL,
    EAuthenticationErrorCodes.EMAIL_REQUIRED,
    EAuthenticationErrorCodes.SIGNUP_DISABLED,
    EAuthenticationErrorCodes.MAGIC_LINK_LOGIN_DISABLED,
    EAuthenticationErrorCodes.PASSWORD_LOGIN_DISABLED,
    EAuthenticationErrorCodes.BOT_USER_LOGIN_FORBIDDEN,
    EAuthenticationErrorCodes.USER_ACCOUNT_DEACTIVATED,
    EAuthenticationErrorCodes.INVALID_PASSWORD,
    EAuthenticationErrorCodes.SMTP_NOT_CONFIGURED,
    EAuthenticationErrorCodes.USER_ALREADY_EXIST,
    EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_UP,
    EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_UP,
    EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_UP,
    EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_UP,
    EAuthenticationErrorCodes.MAGIC_SIGN_UP_EMAIL_CODE_REQUIRED,
    EAuthenticationErrorCodes.USER_DOES_NOT_EXIST,
    EAuthenticationErrorCodes.AUTHENTICATION_FAILED_SIGN_IN,
    EAuthenticationErrorCodes.REQUIRED_EMAIL_PASSWORD_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_EMAIL_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_EMAIL_MAGIC_SIGN_IN,
    EAuthenticationErrorCodes.MAGIC_SIGN_IN_EMAIL_CODE_REQUIRED,
    EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_IN,
    EAuthenticationErrorCodes.INVALID_MAGIC_CODE_SIGN_UP,
    EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_IN,
    EAuthenticationErrorCodes.EXPIRED_MAGIC_CODE_SIGN_UP,
    EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_IN,
    EAuthenticationErrorCodes.EMAIL_CODE_ATTEMPT_EXHAUSTED_SIGN_UP,
    EAuthenticationErrorCodes.OAUTH_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GOOGLE_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GITHUB_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GITLAB_NOT_CONFIGURED,
    EAuthenticationErrorCodes.GOOGLE_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.GITHUB_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.GITLAB_OAUTH_PROVIDER_ERROR,
    EAuthenticationErrorCodes.INVALID_PASSWORD_TOKEN,
    EAuthenticationErrorCodes.EXPIRED_PASSWORD_TOKEN,
    EAuthenticationErrorCodes.INCORRECT_OLD_PASSWORD,
    EAuthenticationErrorCodes.MISSING_PASSWORD,
    EAuthenticationErrorCodes.INVALID_NEW_PASSWORD,
    EAuthenticationErrorCodes.PASSWORD_ALREADY_SET,
    EAuthenticationErrorCodes.ADMIN_ALREADY_EXIST,
    EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD_FIRST_NAME,
    EAuthenticationErrorCodes.INVALID_ADMIN_EMAIL,
    EAuthenticationErrorCodes.INVALID_ADMIN_PASSWORD,
    EAuthenticationErrorCodes.REQUIRED_ADMIN_EMAIL_PASSWORD,
    EAuthenticationErrorCodes.ADMIN_AUTHENTICATION_FAILED,
    EAuthenticationErrorCodes.ADMIN_USER_ALREADY_EXIST,
    EAuthenticationErrorCodes.ADMIN_USER_DOES_NOT_EXIST,
    EAuthenticationErrorCodes.ADMIN_USER_DEACTIVATED,
    EAuthenticationErrorCodes.RATE_LIMIT_EXCEEDED,
    EAuthenticationErrorCodes.PASSWORD_TOO_WEAK,
  ];

  if (bannerAlertErrorCodes.includes(errorCode))
    return {
      type: EErrorAlertType.BANNER_ALERT,
      code: errorCode,
      title: errorCodeMessages[errorCode]?.title || "Error",
      message: errorCodeMessages[errorCode]?.message(email) || "Something went wrong. Please try again.",
    };

  return undefined;
};

export const passwordErrors = [
  EAuthenticationErrorCodes.PASSWORD_TOO_WEAK,
  EAuthenticationErrorCodes.INVALID_NEW_PASSWORD,
];
