/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AxiosRequestConfig } from "axios";
import axios from "axios";
// services
import { APIService } from "@/services/api.service";

export class FileUploadService extends APIService {
  private cancelSource: any;

  constructor() {
    super("");
  }

  async uploadFile(
    url: string,
    data: FormData | File,
    uploadProgressHandler?: AxiosRequestConfig["onUploadProgress"]
  ): Promise<void> {
    // oxlint-disable-next-line import/no-named-as-default-member -- CancelToken is accessed via the default export at runtime
    this.cancelSource = axios.CancelToken.source();
    // Presigned PUT uploads (S3_PRESIGNED_PUT backends such as Cloudflare R2):
    // PUT the raw file with the signed Content-Type instead of a POST policy.
    if (data instanceof File) {
      return this.put(
        url,
        data,
        {
          headers: {
            "Content-Type": data.type || "application/octet-stream",
          },
          cancelToken: this.cancelSource.token,
          withCredentials: false,
          onUploadProgress: uploadProgressHandler,
        }
      )
        .then((response) => response?.data)
        .catch((error) => {
          // oxlint-disable-next-line import/no-named-as-default-member -- isCancel is accessed via the default export at runtime
          if (axios.isCancel(error)) {
            console.log(error.message);
          } else {
            throw error?.response?.data;
          }
        });
    }
    return this.post(url, data, {
      headers: {
        "Content-Type": "multipart/form-data",
      },
      cancelToken: this.cancelSource.token,
      withCredentials: false,
      onUploadProgress: uploadProgressHandler,
    })
      .then((response) => response?.data)
      .catch((error) => {
        // oxlint-disable-next-line import/no-named-as-default-member -- isCancel is accessed via the default export at runtime
        if (axios.isCancel(error)) {
          console.log(error.message);
        } else {
          throw error?.response?.data;
        }
      });
  }

  cancelUpload() {
    this.cancelSource.cancel("Upload canceled");
  }
}
