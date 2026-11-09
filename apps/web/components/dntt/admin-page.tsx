/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import { useEffect, useRef, useState } from "react";
import type { FormEvent } from "react";
import useSWR from "swr";
import { Button } from "@makeplane/propel/components/button";
import { PageHead } from "@/components/core/page-title";
import { useTranslation } from "@plane/i18n";
import { DnttService } from "@/services/dntt.service";
import type { TDnttImport } from "@/services/dntt.service";

const dnttService = new DnttService();

function getCurrentMonth(): string {
  const date = new Date();
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}`;
}

function getErrorMessage(error: unknown, fallback: string): string {
  if (typeof error === "object" && error !== null && "response" in error) {
    const response = (error as { response?: { data?: { detail?: string; error?: string } } }).response;
    if (response?.data?.detail) return response.data.detail;
    if (response?.data?.error) return response.data.error;
  }
  return fallback;
}

function isImportProcessing(status: TDnttImport["status"] | undefined): boolean {
  return status === "queued" || status === "processing";
}

function withStableKeys<T>(items: readonly T[], getKey: (item: T) => string): { item: T; key: string }[] {
  const occurrences = new Map<string, number>();
  return items.map((item) => {
    const value = getKey(item);
    const occurrence = occurrences.get(value) ?? 0;
    occurrences.set(value, occurrence + 1);
    return { item, key: `${value}-${occurrence}` };
  });
}

export function DnttAdminPage() {
  const { t } = useTranslation();
  const [month, setMonth] = useState(getCurrentMonth);
  const [email, setEmail] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [uploadProgress, setUploadProgress] = useState<number | null>(null);
  const [selectedImportId, setSelectedImportId] = useState("");
  const [shareUrl, setShareUrl] = useState("");
  const [errorMessage, setErrorMessage] = useState("");
  const [notice, setNotice] = useState("");
  const fileInputRef = useRef<HTMLInputElement>(null);

  const {
    data: access,
    error: accessError,
    isLoading: accessLoading,
  } = useSWR("DNTT_ACCESS", () => dnttService.getAccess());
  const { data: imports, mutate: mutateImports } = useSWR(
    access?.can_upload && month ? ["DNTT_IMPORTS", month] : null,
    () => dnttService.listImports(month)
  );
  const { data: selectedImport, mutate: mutateSelectedImport } = useSWR(
    selectedImportId ? ["DNTT_IMPORT", selectedImportId] : null,
    () => dnttService.getImport(selectedImportId),
    {
      refreshInterval: (latestData) => (isImportProcessing(latestData?.status) ? 1800 : 0),
    }
  );
  const { data: permissions, mutate: mutatePermissions } = useSWR(
    access?.can_manage_permissions ? "DNTT_UPLOADER_PERMISSIONS" : null,
    () => dnttService.listPermissions()
  );
  const { data: shareLinkStatus, mutate: mutateShareLinkStatus } = useSWR(
    access?.can_upload && month ? ["DNTT_SHARE_LINK", month] : null,
    () => dnttService.getShareLinkStatus(month)
  );

  useEffect(() => {
    if (selectedImport && !isImportProcessing(selectedImport.status)) void mutateImports();
  }, [selectedImport, mutateImports]);

  const handleUpload = async () => {
    if (!file || !month || isUploading) return;
    setErrorMessage("");
    setNotice("");
    setUploadProgress(0);
    setIsUploading(true);
    setShareUrl("");
    try {
      const created = await dnttService.uploadImport(month, file, (progress) => {
        if (progress.total) setUploadProgress(Math.round((progress.loaded / progress.total) * 100));
      });
      setSelectedImportId(created.id);
      setFile(null);
      if (fileInputRef.current) fileInputRef.current.value = "";
      setUploadProgress(null);
      setIsUploading(false);
      await mutateImports();
      setNotice(t("home.dntt.upload_started"));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("home.dntt.upload_failed")));
      setUploadProgress(null);
      setIsUploading(false);
    }
  };

  const handlePublish = async () => {
    if (!selectedImport) return;
    setErrorMessage("");
    setNotice("");
    try {
      await dnttService.publishImport(selectedImport.id);
      await Promise.all([mutateSelectedImport(), mutateImports(), mutateShareLinkStatus()]);
      setNotice(t("home.dntt.snapshot_published"));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("home.dntt.publish_failed")));
    }
  };

  const handleAddPermission = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const normalizedEmail = email.trim().toLowerCase();
    if (!normalizedEmail) return;
    setErrorMessage("");
    try {
      await dnttService.addPermission(normalizedEmail);
      setEmail("");
      await mutatePermissions();
      setNotice(t("home.dntt.permission_added"));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("home.dntt.permission_failed")));
    }
  };

  const handleRemovePermission = async (id: string) => {
    setErrorMessage("");
    try {
      await dnttService.removePermission(id);
      await mutatePermissions();
      setNotice(t("home.dntt.permission_removed"));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("home.dntt.permission_failed")));
    }
  };

  const handleCreateShareLink = async () => {
    setErrorMessage("");
    try {
      const result = await dnttService.createShareLink(month);
      setShareUrl(result.url);
      await mutateShareLinkStatus();
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("home.dntt.share_link_failed")));
    }
  };

  const handleRevokeShareLink = async () => {
    setErrorMessage("");
    try {
      await dnttService.revokeShareLink(month);
      setShareUrl("");
      await mutateShareLinkStatus();
      setNotice(t("home.dntt.share_link_revoked"));
    } catch (error) {
      setErrorMessage(getErrorMessage(error, t("home.dntt.share_link_failed")));
    }
  };

  if (accessLoading) {
    return <div className="mx-auto max-w-6xl p-8 text-body-sm-regular text-secondary">{t("common.loading")}</div>;
  }

  if (accessError || (!access?.can_upload && !access?.can_manage_permissions)) {
    return (
      <main className="mx-auto max-w-3xl space-y-4 px-5 py-12 text-center">
        <PageHead title={t("home.dntt.manage_title")} />
        <h1 className="text-h4-semibold text-primary">{t("home.dntt.no_upload_access")}</h1>
        <p className="text-body-sm-regular text-secondary">{t("home.dntt.contact_admin")}</p>
      </main>
    );
  }

  const isCurrentImport = selectedImport?.status === "published" || selectedImport?.is_current;

  return (
    <main className="h-screen min-h-0 overflow-y-auto bg-surface-1 px-5 py-8 pb-16 md:px-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <PageHead title={t("home.dntt.manage_title")} />
        <header className="space-y-2">
          <p className="text-caption-md-medium tracking-wide text-accent-primary uppercase">{t("home.dntt.eyebrow")}</p>
          <h1 className="text-h3-semibold text-primary">{t("home.dntt.manage_title")}</h1>
          <p className="max-w-3xl text-body-sm-regular text-secondary">{t("home.dntt.manage_description")}</p>
        </header>

        {errorMessage && (
          <div
            role="alert"
            className="border-danger-primary/30 rounded-lg border bg-danger-subtle p-3 text-body-sm-regular text-danger-primary"
          >
            {errorMessage}
          </div>
        )}
        {notice && (
          <div
            role="status"
            className="border-success-primary/30 rounded-lg border bg-success-subtle p-3 text-body-sm-regular text-success-primary"
          >
            {notice}
          </div>
        )}

        {!access.can_upload && access.can_manage_permissions && (
          <p className="rounded-lg border border-subtle bg-layer-1 p-3 text-body-sm-regular text-secondary">
            {t("home.dntt.admin_manage_without_upload")}
          </p>
        )}

        {access.can_upload && (
          <>
            <section className="rounded-xl border border-subtle bg-surface-1 p-5 md:p-6">
              <div className="mb-5 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
                <div className="space-y-1">
                  <h2 className="text-body-md-medium text-primary">{t("home.dntt.upload_title")}</h2>
                  <p className="text-body-xs-regular text-tertiary">{t("home.dntt.upload_snapshot_note")}</p>
                </div>
                <label className="flex flex-col gap-1.5 text-body-xs-medium text-secondary">
                  {t("home.dntt.report_month")}
                  <input
                    type="month"
                    value={month}
                    onChange={(event) => {
                      setMonth(event.target.value);
                      setShareUrl("");
                      setSelectedImportId("");
                      setNotice("");
                      setErrorMessage("");
                    }}
                    className="h-10 rounded-md border border-subtle bg-surface-1 px-3 text-body-sm-regular text-primary focus-visible:outline-2 focus-visible:outline-accent-strong"
                  />
                </label>
              </div>

              <div className="grid gap-4 md:grid-cols-[minmax(0,1fr)_auto] md:items-end">
                <label className="flex flex-col gap-2 text-body-xs-medium text-secondary">
                  {t("home.dntt.select_workbook")}
                  <input
                    ref={fileInputRef}
                    type="file"
                    accept=".xlsx,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet"
                    onChange={(event) => setFile(event.target.files?.[0] ?? null)}
                    className="block min-h-11 w-full rounded-md border border-subtle bg-surface-1 px-3 py-2 text-body-xs-regular text-secondary file:mr-3 file:rounded file:border-0 file:bg-layer-1 file:px-3 file:py-1.5 file:text-body-xs-medium file:text-primary"
                  />
                </label>
                <Button
                  variant="primary"
                  size="md"
                  stretch="auto"
                  label={t("home.dntt.upload_button")}
                  disabled={!file || isUploading}
                  onClick={() => void handleUpload()}
                />
              </div>
              {file && <p className="mt-2 text-caption-md-regular break-all text-tertiary">{file.name}</p>}
              {uploadProgress !== null && (
                <div className="mt-4 space-y-2" role="status" aria-live="polite">
                  <div className="flex justify-between text-caption-md-regular text-tertiary">
                    <span>{t("home.dntt.uploading")}</span>
                    <span>{uploadProgress}%</span>
                  </div>
                  <progress className="accent-accent-primary h-2 w-full" value={uploadProgress} max={100} />
                </div>
              )}
            </section>

            <section className="rounded-xl border border-subtle bg-surface-1 p-5 md:p-6">
              <div className="mb-4 flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
                <div>
                  <h2 className="text-body-md-medium text-primary">{t("home.dntt.snapshot_history")}</h2>
                  <p className="mt-1 text-body-xs-regular text-tertiary">
                    {t("home.dntt.snapshot_history_description")}
                  </p>
                </div>
                <span className="rounded-md bg-layer-1 px-2.5 py-1 text-caption-md-medium text-secondary">{month}</span>
              </div>
              {!imports?.length ? (
                <p className="rounded-lg border border-dashed border-subtle px-4 py-8 text-center text-body-sm-regular text-tertiary">
                  {t("home.dntt.no_snapshots")}
                </p>
              ) : (
                <div className="divide-y divide-subtle">
                  {imports.map((item) => (
                    <button
                      key={item.id}
                      type="button"
                      onClick={() => setSelectedImportId(item.id)}
                      className={`flex w-full flex-col gap-2 py-4 text-left transition-colors hover:bg-layer-1 sm:flex-row sm:items-center sm:justify-between sm:px-2 ${selectedImportId === item.id ? "bg-accent-subtle/40" : ""}`}
                    >
                      <span className="min-w-0">
                        <span className="block truncate text-body-sm-medium text-primary">
                          {item.original_filename || item.id}
                          {item.is_current && (
                            <span className="ml-2 rounded bg-success-subtle px-2 py-0.5 text-caption-md-medium text-success-primary">
                              {t("home.dntt.current_snapshot")}
                            </span>
                          )}
                        </span>
                        <span className="mt-1 block text-caption-md-regular text-tertiary">
                          {item.created_at ? new Date(item.created_at).toLocaleString() : item.report_month}
                        </span>
                      </span>
                      <span className="shrink-0 self-start rounded-full bg-layer-1 px-2.5 py-1 text-caption-md-medium text-secondary sm:self-center">
                        {t(`home.dntt.status.${item.status}`)}
                      </span>
                    </button>
                  ))}
                </div>
              )}
            </section>

            {selectedImport && (
              <section className="space-y-4 rounded-xl border border-subtle bg-surface-1 p-5 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                  <div>
                    <h2 className="text-body-md-medium text-primary">{t("home.dntt.preview_title")}</h2>
                    <p className="mt-1 text-caption-md-regular break-all text-tertiary">
                      {selectedImport.original_filename}
                    </p>
                  </div>
                  <span className="rounded-full bg-layer-1 px-2.5 py-1 text-caption-md-medium text-secondary">
                    {t(`home.dntt.status.${selectedImport.status}`)}
                  </span>
                </div>
                {isImportProcessing(selectedImport.status) && (
                  <div className="rounded-lg border border-accent-strong/30 bg-accent-subtle p-3 text-body-sm-regular text-accent-primary">
                    {t("home.dntt.processing")}
                  </div>
                )}
                {selectedImport.error_message && (
                  <div
                    role="alert"
                    className="border-danger-primary/30 rounded-lg border bg-danger-subtle p-3 text-body-sm-regular text-danger-primary"
                  >
                    {selectedImport.error_message}
                  </div>
                )}
                {selectedImport.summary && (
                  <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
                    <SummaryTile
                      label={t("home.dntt.rows_in_month")}
                      value={selectedImport.summary.selected_month_rows ?? 0}
                    />
                    <SummaryTile
                      label={t("home.dntt.sheets_in_month")}
                      value={selectedImport.summary.selected_month_sheets ?? 0}
                    />
                    <SummaryTile
                      label={t("home.dntt.excluded_sheets")}
                      value={selectedImport.summary.excluded_month_sheets?.length ?? 0}
                    />
                    <SummaryTile
                      label={t("home.dntt.categories_detected")}
                      value={Object.keys(selectedImport.summary.category_counts ?? {}).length}
                    />
                  </div>
                )}
                {Boolean(selectedImport.summary?.excluded_month_sheets?.length) && (
                  <div className="border-warning-primary/30 rounded-lg border bg-warning-subtle p-4">
                    <h3 className="text-body-xs-medium text-warning-primary">{t("home.dntt.out_of_month_sheets")}</h3>
                    <ul className="mt-2 max-h-40 list-inside list-disc space-y-1 overflow-auto text-caption-md-regular text-secondary">
                      {withStableKeys(
                        selectedImport.summary?.excluded_month_sheets ?? [],
                        (sheet) => `${sheet.sheet_name}-${sheet.report_date ?? ""}`
                      ).map(({ item: sheet, key }) => (
                        <li key={key}>
                          {sheet.sheet_name}
                          {sheet.report_date ? ` · ${sheet.report_date}` : ""}
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
                {Boolean(selectedImport.summary?.warnings?.length) && (
                  <div className="border-warning-primary/30 rounded-lg border bg-warning-subtle p-4">
                    <h3 className="text-body-xs-medium text-warning-primary">{t("home.dntt.warnings")}</h3>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-caption-md-regular text-secondary">
                      {withStableKeys(selectedImport.summary?.warnings ?? [], (warning) => warning).map(
                        ({ item: warning, key }) => (
                          <li key={key}>{warning}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
                {Boolean(selectedImport.summary?.errors?.length) && (
                  <div role="alert" className="border-danger-primary/30 rounded-lg border bg-danger-subtle p-4">
                    <h3 className="text-body-xs-medium text-danger-primary">{t("home.dntt.errors")}</h3>
                    <ul className="mt-2 list-inside list-disc space-y-1 text-caption-md-regular text-danger-primary">
                      {withStableKeys(selectedImport.summary?.errors ?? [], (issue) => issue).map(
                        ({ item: issue, key }) => (
                          <li key={key}>{issue}</li>
                        )
                      )}
                    </ul>
                  </div>
                )}
                {Boolean(selectedImport.preview_rows?.length) && (
                  <div className="space-y-3">
                    <h3 className="text-body-xs-medium text-primary">{t("home.dntt.preview_sample")}</h3>
                    <div className="overflow-x-auto rounded-lg border border-subtle">
                      <table className="w-full min-w-[820px] border-collapse text-left">
                        <thead className="bg-layer-1 text-caption-md-medium text-tertiary">
                          <tr>
                            <th className="px-3 py-2">{t("home.dntt.preview_date")}</th>
                            <th className="px-3 py-2">{t("home.dntt.preview_category")}</th>
                            <th className="px-3 py-2">{t("home.dntt.preview_request_number")}</th>
                            <th className="px-3 py-2">{t("home.dntt.preview_requester")}</th>
                            <th className="px-3 py-2">{t("home.dntt.preview_department")}</th>
                            <th className="px-3 py-2">{t("home.dntt.preview_description")}</th>
                            <th className="px-3 py-2 text-right">{t("home.dntt.preview_amount")}</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-subtle">
                          {withStableKeys(selectedImport.preview_rows ?? [], (row) => JSON.stringify(row)).map(
                            ({ item: row, key }) => (
                              <tr key={key} className="align-top text-body-xs-regular text-primary">
                                <td className="px-3 py-2 whitespace-nowrap">{row.date}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{row.category}</td>
                                <td className="px-3 py-2 whitespace-nowrap">{row.request_number || "—"}</td>
                                <td className="px-3 py-2">{row.requester || "—"}</td>
                                <td className="px-3 py-2">{row.department || "—"}</td>
                                <td className="max-w-72 px-3 py-2 whitespace-normal">{row.description || "—"}</td>
                                <td className="px-3 py-2 text-right whitespace-nowrap tabular-nums">
                                  {formatPreviewAmount(row.amount)}
                                </td>
                              </tr>
                            )
                          )}
                        </tbody>
                      </table>
                    </div>
                  </div>
                )}
                <div className="sticky bottom-0 z-10 -mx-5 flex flex-wrap justify-end gap-2 border-t border-subtle bg-surface-1/95 px-5 py-4 backdrop-blur md:-mx-6 md:px-6">
                  {selectedImport.status === "superseded" && (
                    <Button
                      variant="secondary"
                      size="sm"
                      stretch="auto"
                      label={t("home.dntt.restore_snapshot")}
                      onClick={() => void handlePublish()}
                    />
                  )}
                  {selectedImport.status === "ready" && (
                    <Button
                      variant="primary"
                      size="sm"
                      stretch="auto"
                      label={t("home.dntt.publish_snapshot")}
                      disabled={Boolean(isCurrentImport)}
                      onClick={() => void handlePublish()}
                    />
                  )}
                </div>
              </section>
            )}

            {isCurrentImport && (
              <section className="rounded-xl border border-subtle bg-surface-1 p-5 md:p-6">
                <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                  <div>
                    <h2 className="text-body-md-medium text-primary">{t("home.dntt.public_link_title")}</h2>
                    <p className="mt-1 text-body-xs-regular text-tertiary">{t("home.dntt.public_link_description")}</p>
                  </div>
                  <div className="flex flex-wrap gap-2">
                    <Button
                      variant="secondary"
                      size="sm"
                      stretch="auto"
                      label={t("home.dntt.create_share_link")}
                      onClick={() => void handleCreateShareLink()}
                    />
                    {shareLinkStatus?.active && (
                      <Button
                        variant="secondary"
                        size="sm"
                        stretch="auto"
                        label={t("home.dntt.revoke_share_link")}
                        onClick={() => void handleRevokeShareLink()}
                      />
                    )}
                  </div>
                </div>
                {shareLinkStatus?.active && !shareUrl && (
                  <p className="mt-3 text-caption-md-regular text-success-primary">
                    {t("home.dntt.share_link_active")}
                  </p>
                )}
                {shareUrl && (
                  <div className="mt-4 flex flex-col gap-2 sm:flex-row">
                    <input
                      aria-label={t("home.dntt.public_link_title")}
                      value={shareUrl}
                      readOnly
                      className="h-10 min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-3 text-body-xs-regular text-secondary"
                    />
                    <Button
                      variant="secondary"
                      size="sm"
                      stretch="auto"
                      label={t("home.dntt.copy_link")}
                      onClick={() => void navigator.clipboard.writeText(shareUrl)}
                    />
                  </div>
                )}
              </section>
            )}
          </>
        )}

        {access.can_manage_permissions && (
          <section className="rounded-xl border border-subtle bg-surface-1 p-5 md:p-6">
            <div className="mb-4">
              <h2 className="text-body-md-medium text-primary">{t("home.dntt.allowlist_title")}</h2>
              <p className="mt-1 text-body-xs-regular text-tertiary">{t("home.dntt.allowlist_description")}</p>
            </div>
            <form onSubmit={(event) => void handleAddPermission(event)} className="flex flex-col gap-2 sm:flex-row">
              <label htmlFor="dntt-uploader-email" className="sr-only">
                {t("home.dntt.email_label")}
              </label>
              <input
                id="dntt-uploader-email"
                type="email"
                value={email}
                onChange={(event) => setEmail(event.target.value)}
                placeholder={t("home.dntt.email_placeholder")}
                className="h-10 min-w-0 flex-1 rounded-md border border-subtle bg-surface-1 px-3 text-body-sm-regular text-primary placeholder:text-placeholder focus-visible:outline-2 focus-visible:outline-accent-strong"
                required
              />
              <Button variant="primary" type="submit" size="sm" stretch="auto" label={t("home.dntt.add_email")} />
            </form>
            {permissions?.length ? (
              <div className="mt-4 divide-y divide-subtle border-y border-subtle">
                {permissions.map((permission) => (
                  <div key={permission.id} className="flex flex-wrap items-center justify-between gap-3 py-3">
                    <span className="min-w-0 text-body-sm-regular break-all text-primary">{permission.email}</span>
                    <div className="flex items-center gap-2">
                      <span
                        className={`rounded-full px-2.5 py-1 text-caption-md-medium ${permission.is_active ? "bg-success-subtle text-success-primary" : "bg-layer-1 text-tertiary"}`}
                      >
                        {permission.is_active ? t("home.dntt.active") : t("home.dntt.revoked")}
                      </span>
                      {permission.is_active && (
                        <Button
                          variant="secondary"
                          size="sm"
                          stretch="auto"
                          label={t("home.dntt.revoke_access")}
                          onClick={() => void handleRemovePermission(permission.id)}
                        />
                      )}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-4 text-body-xs-regular text-tertiary">{t("home.dntt.no_allowed_emails")}</p>
            )}
          </section>
        )}
      </div>
    </main>
  );
}

function SummaryTile({ label, value }: { label: string; value: number }) {
  return (
    <div className="rounded-lg border border-subtle bg-surface-1 p-3">
      <p className="text-caption-md-regular text-tertiary">{label}</p>
      <p className="mt-1 text-body-md-medium text-primary tabular-nums">{value.toLocaleString("vi-VN")}</p>
    </div>
  );
}

function formatPreviewAmount(amount: string | null): string {
  if (!amount) return "—";
  try {
    return `${new Intl.NumberFormat("vi-VN").format(BigInt(amount))} ₫`;
  } catch {
    return amount;
  }
}
