/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import axios from "axios";
import type { AxiosRequestConfig } from "axios";
// api service
import { APIService } from "../api.service";

/**
 * Service class for handling file upload operations
 * Handles file uploads
 * @extends {APIService}
 */
export class FileUploadService extends APIService {
  private cancelSource: any;

  constructor() {
    super("");
  }

  /**
   * Uploads a file to the specified signed URL
   * @param {string} url - The URL to upload the file to
   * @param {FormData | File} data - POST-policy form data, or the raw file
   * for presigned PUT uploads (S3_PRESIGNED_PUT backends such as Cloudflare R2)
   * @param {AxiosRequestConfig["onUploadProgress"]} onUploadProgress - Optional progress handler
   * @returns {Promise<void>} Promise resolving to void
   * @throws {Error} If the request fails
   */
  async uploadFile(
    url: string,
    data: FormData | File,
    onUploadProgress?: AxiosRequestConfig["onUploadProgress"]
  ): Promise<void> {
    this.cancelSource = axios.CancelToken.source();
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
          onUploadProgress,
        }
      )
        .then((response) => response?.data)
        .catch((error) => {
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
      onUploadProgress,
    })
      .then((response) => response?.data)
      .catch((error) => {
        if (axios.isCancel(error)) {
          console.log(error.message);
        } else {
          throw error?.response?.data;
        }
      });
  }

  /**
   * Cancels the upload
   */
  cancelUpload() {
    this.cancelSource.cancel("Upload canceled");
  }
}
