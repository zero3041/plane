/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import type { AxiosRequestConfig } from "axios";
import { API_BASE_URL } from "@plane/constants";
import { APIService } from "@/services/api.service";

export type TDnttImportStatus = "queued" | "processing" | "ready" | "failed" | "published" | "superseded";

export interface TDnttAccess {
  can_upload: boolean;
  can_manage_permissions: boolean;
}

export interface TDnttUploaderPermission {
  id: string;
  email: string;
  is_active: boolean;
  created_at: string;
}

export interface TDnttImportSummary {
  selected_month_rows?: number;
  selected_month_sheets?: number;
  excluded_month_sheets?: Array<{ sheet_name: string; report_date?: string | null }>;
  category_counts?: Record<string, number>;
  warnings?: string[];
  errors?: string[];
}

export interface TDnttPreviewRow {
  date: string;
  category: string;
  request_number: string;
  requester: string;
  department: string;
  description: string;
  amount: string | null;
}

export interface TDnttImport {
  id: string;
  report_month: string;
  status: TDnttImportStatus;
  original_filename?: string;
  created_at?: string;
  published_at?: string | null;
  is_current?: boolean;
  error_message?: string | null;
  summary?: TDnttImportSummary;
  preview_rows?: TDnttPreviewRow[];
}

export class DnttService extends APIService {
  constructor() {
    super(API_BASE_URL);
  }

  async getAccess(): Promise<TDnttAccess> {
    const response = await this.get("/api/dntt/admin/access/");
    return response.data;
  }

  async listPermissions(): Promise<TDnttUploaderPermission[]> {
    const response = await this.get("/api/dntt/admin/permissions/");
    return response.data.results ?? [];
  }

  async addPermission(email: string): Promise<TDnttUploaderPermission> {
    const response = await this.post("/api/dntt/admin/permissions/", { email });
    return response.data;
  }

  async removePermission(id: string): Promise<void> {
    await this.delete(`/api/dntt/admin/permissions/${id}/`);
  }

  async uploadImport(
    month: string,
    file: File,
    onUploadProgress?: AxiosRequestConfig["onUploadProgress"]
  ): Promise<TDnttImport> {
    const form = new FormData();
    form.append("month", month);
    form.append("file", file);
    const response = await this.post(`/api/dntt/admin/months/${month}/imports/`, form, { onUploadProgress });
    return response.data;
  }

  async listImports(month: string): Promise<TDnttImport[]> {
    const response = await this.get(`/api/dntt/admin/months/${month}/imports/`);
    return response.data.results ?? [];
  }

  async getImport(id: string): Promise<TDnttImport> {
    const response = await this.get(`/api/dntt/admin/imports/${id}/`);
    return response.data;
  }

  async publishImport(id: string): Promise<TDnttImport> {
    const response = await this.post(`/api/dntt/admin/imports/${id}/publish/`, {});
    return response.data;
  }

  async createShareLink(month: string): Promise<{ url: string }> {
    const response = await this.post(`/api/dntt/admin/months/${month}/share-link/`, {});
    return response.data;
  }

  async getShareLinkStatus(month: string): Promise<{ active: boolean }> {
    const response = await this.get(`/api/dntt/admin/months/${month}/share-link/`);
    return response.data;
  }

  async revokeShareLink(month: string): Promise<void> {
    await this.delete(`/api/dntt/admin/months/${month}/share-link/`);
  }
}
