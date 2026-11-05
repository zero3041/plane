/**
 * Copyright (c) 2023-present Plane Software, Inc. and contributors
 * SPDX-License-Identifier: AGPL-3.0-only
 * See the LICENSE file for details.
 */

import Link from "next/link";
import { useTranslation } from "@plane/i18n";
import type {
  IPersonalDashboardAssigneeSummary,
  IPersonalDashboardOverview,
  IPersonalDashboardProjectSummary,
  IPersonalDashboardStateSummary,
} from "@plane/types";

type Props = {
  overview?: IPersonalDashboardOverview;
  states: IPersonalDashboardStateSummary[];
  projects: IPersonalDashboardProjectSummary[];
  assignees: IPersonalDashboardAssigneeSummary[];
  isLoading: boolean;
};

export function PersonalDashboardOverview({ overview, states, projects, assignees, isLoading }: Props) {
  const { t, currentLocale } = useTranslation();
  const number = new Intl.NumberFormat(currentLocale);
  if (!overview) {
    if (!isLoading) return null;
    return (
      <section className="space-y-4" aria-label={t("overview")} aria-busy="true">
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
          {Array.from({ length: 6 }, (_, index) => (
            <div key={index} className="min-h-[104px] animate-pulse rounded-xl border border-subtle bg-layer-1" />
          ))}
        </div>
        <div className="grid gap-4 xl:grid-cols-3">
          {Array.from({ length: 3 }, (_, index) => (
            <div key={index} className="min-h-[440px] animate-pulse rounded-xl border border-subtle bg-layer-1" />
          ))}
        </div>
      </section>
    );
  }
  const cards = [
    { label: t("work_items"), value: overview.total, tone: "text-primary" },
    { label: t("home.personal_dashboard.all_open"), value: overview.open, tone: "text-accent-primary" },
    { label: t("completed"), value: overview.completed, tone: "text-success-primary" },
    { label: t("home.personal_dashboard.overdue"), value: overview.overdue, tone: "text-danger-primary" },
    { label: t("home.personal_dashboard.project_count"), value: overview.project_count, tone: "text-primary" },
    { label: t("home.personal_dashboard.workspace_count"), value: overview.workspace_count, tone: "text-primary" },
  ];
  const maxStateCount = Math.max(1, ...states.map((state) => state.count));

  return (
    <section className="space-y-4" aria-label={t("overview")}>
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-6">
        {cards.map((card) => (
          <article key={card.label} className="min-h-[104px] rounded-xl border border-subtle bg-surface-1 p-4 md:p-5">
            <p className="text-body-xs-medium text-tertiary">{card.label}</p>
            <p className={`mt-3 text-h3-semibold tabular-nums ${card.tone}`}>{number.format(card.value)}</p>
          </article>
        ))}
      </div>
      <div className="grid gap-4 xl:grid-cols-3">
        <section
          className="min-h-[440px] rounded-xl border border-subtle bg-surface-1 p-4 md:p-5"
          aria-label={t("state")}
        >
          <h2 className="text-body-md-medium text-primary">{t("state")}</h2>
          {states.length === 0 ? (
            <p className="mt-4 text-body-xs-regular text-tertiary">—</p>
          ) : (
            <ul className="mt-4 max-h-80 space-y-3 overflow-y-auto">
              {states.map((state) => (
                <li key={state.id} className="space-y-1.5">
                  <div className="flex items-center justify-between gap-3 text-body-xs-regular">
                    <span className="truncate text-secondary">{state.name}</span>
                    <span className="shrink-0 text-primary tabular-nums">{number.format(state.count)}</span>
                  </div>
                  <div className="h-1.5 overflow-hidden rounded-full bg-layer-1">
                    <span
                      className="block h-full rounded-full"
                      style={{
                        width: `${Math.max(4, (state.count / maxStateCount) * 100)}%`,
                        backgroundColor: state.color,
                      }}
                    />
                  </div>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          className="min-h-[440px] rounded-xl border border-subtle bg-surface-1 p-4 md:p-5"
          aria-label={t("projects")}
        >
          <h2 className="text-body-md-medium text-primary">{t("projects")}</h2>
          {projects.length === 0 ? (
            <p className="mt-4 text-body-xs-regular text-tertiary">—</p>
          ) : (
            <ul className="mt-3 max-h-80 divide-y divide-subtle overflow-y-auto">
              {projects.map((project) => (
                <li key={project.id}>
                  <Link
                    href={`/${project.workspace_slug}/projects/${project.id}/issues`}
                    className={[
                      "flex items-center justify-between gap-3 rounded py-2.5 hover:text-accent-primary",
                      "focus-visible:outline-2 focus-visible:outline-offset-2",
                    ].join(" ")}
                  >
                    <span className="min-w-0">
                      <span className="block truncate text-body-xs-medium text-primary">
                        {project.identifier} · {project.name}
                      </span>
                      <span className="mt-0.5 block truncate text-caption-md-regular text-tertiary">
                        {project.workspace_name}
                      </span>
                    </span>
                    <span className="shrink-0 text-right text-caption-md-regular text-secondary">
                      <span className="block tabular-nums">
                        {number.format(project.open_count)} / {number.format(project.total_count)}
                      </span>
                      {project.overdue_count > 0 && (
                        <span className="block text-danger-primary">
                          {number.format(project.overdue_count)} {t("home.personal_dashboard.overdue").toLowerCase()}
                        </span>
                      )}
                    </span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </section>
        <section
          className="min-h-[440px] rounded-xl border border-subtle bg-surface-1 p-4 md:p-5"
          aria-label={t("assignees")}
        >
          <h2 className="text-body-md-medium text-primary">{t("assignees")}</h2>
          {assignees.length === 0 ? (
            <p className="mt-4 text-body-xs-regular text-tertiary">—</p>
          ) : (
            <ul className="mt-3 max-h-80 divide-y divide-subtle overflow-y-auto">
              {assignees.map((assignee) => (
                <li key={assignee.id} className="flex items-center justify-between gap-3 py-2.5">
                  <span className="truncate text-body-xs-medium text-primary">{assignee.display_name}</span>
                  <span className="shrink-0 text-body-xs-regular text-secondary tabular-nums">
                    {number.format(assignee.open_count)}
                  </span>
                </li>
              ))}
            </ul>
          )}
          <p className="mt-3 border-t border-subtle pt-3 text-caption-md-regular text-tertiary">
            {t("home.personal_dashboard.unassigned_open")}: {number.format(overview.unassigned_open)}
          </p>
        </section>
      </div>
    </section>
  );
}
