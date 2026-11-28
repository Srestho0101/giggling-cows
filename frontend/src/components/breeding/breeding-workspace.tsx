"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { Notice } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import {
  BreedingFormModal,
  CalvingDrawerModal,
  PregnancyCheckModal,
} from "@/components/breeding/breeding-drawers";
import { Badge, btn, StatTile, statusTone, Tabs, ui } from "@/components/ui";
import { apiRequest, apiRoutes } from "@/lib/api";
import {
  formatDisplayDate,
  formatMoney,
  type BreedingActionQueueItem,
  type BreedingRecord,
  type BreedingSummary,
  type CowListOption,
  type PregnancyEpisode,
  type SireItem,
  type WarehouseOption,
} from "@/components/cow-profile/types";

export function BreedingWorkspaceView() {
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("queue");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [breedingModalOpen, setBreedingModalOpen] = useState(false);
  const [breedingFixedCowId, setBreedingFixedCowId] = useState<string | undefined>(undefined);
  const [editingBreeding, setEditingBreeding] = useState<BreedingRecord | null>(null);

  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkFixedCowId, setCheckFixedCowId] = useState<string | undefined>(undefined);
  const [checkDefaultBreedingId, setCheckDefaultBreedingId] = useState<string | null>(null);

  const [calvingTarget, setCalvingTarget] = useState<{
    pregnancyId: string;
    damTag: string;
  } | null>(null);

  const [sireFormOpen, setSireFormOpen] = useState(false);
  const [bullName, setBullName] = useState("");
  const [semenCode, setSemenCode] = useState("");
  const [provider, setProvider] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireSaving, setSireSaving] = useState(false);

  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["breeding-summary"],
    queryFn: () => apiRequest<BreedingSummary>(apiRoutes.health.breedingSummary),
  });
  const breedingsQuery = useQuery({
    queryKey: ["breeding-records"],
    queryFn: () => apiRequest<BreedingRecord[]>(apiRoutes.health.breeding),
  });
  const pregnanciesQuery = useQuery({
    queryKey: ["breeding-pregnancies"],
    queryFn: () => apiRequest<PregnancyEpisode[]>(apiRoutes.health.pregnancies),
  });
  const siresQuery = useQuery({
    queryKey: ["sires"],
    queryFn: () => apiRequest<SireItem[]>(apiRoutes.health.sires),
  });
  const cowsQuery = useQuery({
    queryKey: ["cows-options"],
    queryFn: () => apiRequest<CowListOption[]>(apiRoutes.herd.cows),
    staleTime: 60_000,
  });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiRequest<WarehouseOption[]>(apiRoutes.herd.warehouses),
    staleTime: 60_000,
  });

  const reloadAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["breeding-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["breeding-records"] }),
      queryClient.invalidateQueries({ queryKey: ["breeding-pregnancies"] }),
      queryClient.invalidateQueries({ queryKey: ["sires"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["herd-cows"] }),
    ]);
  }, [queryClient]);

  const summary = summaryQuery.data;
  const breedings = useMemo(() => breedingsQuery.data ?? [], [breedingsQuery.data]);
  const pregnancies = useMemo(() => pregnanciesQuery.data ?? [], [pregnanciesQuery.data]);
  const sires = useMemo(() => siresQuery.data ?? [], [siresQuery.data]);
  const cows = cowsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];

  const filteredBreedings = useMemo(
    () => (outcomeFilter ? breedings.filter((b) => b.outcome === outcomeFilter) : breedings),
    [breedings, outcomeFilter]
  );

  const activePregnancies = useMemo(
    () => pregnancies.filter((p) => p.status === "confirmed" || p.status === "suspected"),
    [pregnancies]
  );

  async function handleCreateExternalSire(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSireSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.health.sires, {
        method: "POST",
        body: {
          source_type: "external_semen",
          bull_name: bullName.trim() || null,
          semen_code: semenCode.trim() || null,
          provider: provider.trim() || null,
          breed: sireBreed.trim() || null,
        },
      });
      setBullName("");
      setSemenCode("");
      setProvider("");
      setSireBreed("");
      setSireFormOpen(false);
      setNotice("External AI sire added to registry.");
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save sire.");
    } finally {
      setSireSaving(false);
    }
  }

  function renderQueueBucket(
    title: string,
    subtitle: string,
    items: BreedingActionQueueItem[],
    actionLabel: string,
    onAction: (item: BreedingActionQueueItem) => void
  ) {
    return (
      <section className="rounded-[8px] border border-line bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink">
              {title} ({items.length})
            </h3>
            <p className="text-[12px] text-muted">{subtitle}</p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-[12.5px] text-muted py-2">Nothing due right now.</p>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <div key={`${item.bucket}-${item.cow_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <div>
                  <Link href={`/herd/${item.cow_id}`} className="font-semibold text-accent hover:underline">
                    Cow {item.cow_tag_number}
                  </Link>
                  <span className="ml-2 text-muted">{item.detail}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onAction(item)}
                  className={btn("secondary", "sm")}
                >
                  {actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const queueTotal =
    (summary?.due_for_check.length ?? 0) +
    (summary?.due_for_dry_off.length ?? 0) +
    (summary?.calving_due.length ?? 0) +
    (summary?.open_over_90_days.length ?? 0);

  return (
    <div className="space-y-5">
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {/* Top 3 Herd KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label="Conception rate"
          value={summary?.conception_rate_pct != null ? `${summary.conception_rate_pct}%` : "—"}
          subtext="Successful vs resolved breedings"
        />
        <StatTile
          label="Avg services / conception"
          value={summary?.avg_services_per_conception != null ? String(summary.avg_services_per_conception) : "—"}
          subtext="Lower is better"
        />
        <StatTile
          label="Active pregnant cows"
          value={String(summary?.active_pregnant_count ?? activePregnancies.length)}
          subtext="Confirmed & suspected episodes"
        />
      </div>

      {/* Primary Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          items={[
            { key: "queue", label: `Action queue (${queueTotal})` },
            { key: "breedings", label: `Breeding log (${breedings.length})` },
            { key: "pregnancies", label: `Active pregnancies (${activePregnancies.length})` },
            { key: "sires", label: `Sire registry (${sires.length})` },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingBreeding(null);
              setBreedingFixedCowId(undefined);
              setBreedingModalOpen(true);
            }}
            className={btn("primary", "sm")}
          >
            + Log breeding
          </button>
          <button
            type="button"
            onClick={() => {
              setCheckFixedCowId(undefined);
              setCheckDefaultBreedingId(null);
              setCheckModalOpen(true);
            }}
            className={btn("secondary", "sm")}
          >
            + Log check
          </button>
        </div>
      </div>

      {activeTab === "queue" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {renderQueueBucket(
            "Due for pregnancy check",
            "Pending services 28+ days ago with no active pregnancy.",
            summary?.due_for_check ?? [],
            "Log check",
            (item) => {
              setCheckFixedCowId(item.cow_id);
              setCheckDefaultBreedingId(item.breeding_id ?? null);
              setCheckModalOpen(true);
            }
          )}
          {renderQueueBucket(
            "Calving due (<14d)",
            "Confirmed or suspected pregnancies nearing due date.",
            summary?.calving_due ?? [],
            "Record calving",
            (item) => {
              if (item.pregnancy_id) {
                setCalvingTarget({ pregnancyId: item.pregnancy_id, damTag: item.cow_tag_number });
              }
            }
          )}
          {renderQueueBucket(
            "Due for dry-off",
            "Confirmed pregnancies approaching 60 days pre-calving.",
            summary?.due_for_dry_off ?? [],
            "View cow",
            (item) => {
              router.push(`/herd/${item.cow_id}`);
            }
          )}
          {renderQueueBucket(
            "Open > 90 days",
            "Adult females past VWP with no active pregnancy for 90+ days.",
            summary?.open_over_90_days ?? [],
            "Log breeding",
            (item) => {
              setEditingBreeding(null);
              setBreedingFixedCowId(item.cow_id);
              setBreedingModalOpen(true);
            }
          )}
        </div>
      ) : null}

      {activeTab === "breedings" ? (
        <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink">Breeding log</h3>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className={`${ui.select} w-44`}
            >
              <option value="">All outcomes</option>
              <option value="pending">Pending</option>
              <option value="successful">Successful</option>
              <option value="failed">Failed</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11.5px] text-muted">
                <tr>
                  <th className="py-2 pr-3">Cow</th>
                  <th className="py-2 pr-3">Insemination</th>
                  <th className="py-2 pr-3">Method</th>
                  <th className="py-2 pr-3">Sire / Semen</th>
                  <th className="py-2 pr-3">Doctor</th>
                  <th className="py-2 pr-3 text-right">Cost</th>
                  <th className="py-2 pr-3">Outcome</th>
                  <th className="py-2 text-right">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredBreedings.map((br) => (
                  <tr key={br.breeding_id} className="hover:bg-wash">
                    <td className="py-2 pr-3 font-medium">
                      <Link href={`/herd/${br.cow_id}`} className="text-accent hover:underline">
                        {br.cow_tag_number ?? br.cow_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{formatDisplayDate(br.seed_date)}</td>
                    <td className="py-2 pr-3 capitalize">{br.method.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3">{br.sire_display_name || br.sire_tag_number || br.semen_code || "—"}</td>
                    <td className="py-2 pr-3">{br.doctor_name || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{formatMoney(br.cost)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={statusTone(br.outcome)}>
                        <span className="capitalize">{br.outcome}</span>
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2 text-[12px]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBreeding(br);
                            setBreedingFixedCowId(br.cow_id);
                            setBreedingModalOpen(true);
                          }}
                          className="font-medium text-accent hover:underline"
                        >
                          Edit
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              title: "Archive breeding record?",
                              mode: "confirm",
                              confirmLabel: "Archive",
                              tone: "danger",
                              onConfirm: async () => {
                                await apiRequest(apiRoutes.health.breedingRecord(br.breeding_id), {
                                  method: "PATCH",
                                  body: { is_archived: true },
                                });
                                setNotice("Breeding record archived.");
                                await reloadAll();
                              },
                            })
                          }
                          className="font-medium text-muted hover:underline"
                        >
                          Archive
                        </button>
                        <SafeDataHistory entityType="breeding_records" entityId={br.breeding_id} entityLabel={`Breeding ${br.seed_date}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "pregnancies" ? (
        <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
          <h3 className="text-[14px] font-semibold text-ink">Active pregnancies</h3>
          {activePregnancies.length === 0 ? (
            <p className="text-[13px] text-muted">No active pregnancies.</p>
          ) : (
            <div className="divide-y divide-line">
              {activePregnancies.map((ep) => (
                <div key={ep.pregnancy_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
                  <div>
                    <Link href={`/herd/${ep.cow_id}`} className="font-semibold text-accent hover:underline">
                      Cow {ep.cow_tag_number}
                    </Link>
                    <span className="ml-2">
                      <Badge tone={statusTone(ep.status)}>
                        <span className="capitalize">{ep.status}</span>
                      </Badge>
                    </span>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {ep.sire_display_name ? `Sire: ${ep.sire_display_name} · ` : ""}
                      Expected calving: {formatDisplayDate(ep.expected_calving_date)}
                      {ep.dry_off_date ? ` · Dry-off: ${formatDisplayDate(ep.dry_off_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCalvingTarget({
                          pregnancyId: ep.pregnancy_id,
                          damTag: ep.cow_tag_number ?? "Cow",
                        })
                      }
                      className={btn("primary", "sm")}
                    >
                      Record calving
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckFixedCowId(ep.cow_id);
                        setCheckDefaultBreedingId(ep.breeding_id ?? null);
                        setCheckModalOpen(true);
                      }}
                      className={btn("secondary", "sm")}
                    >
                      Log check
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "sires" ? (
        <section className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">Sire registry</h3>
              <p className="text-[12px] text-muted">On-farm bulls and external AI semen straws.</p>
            </div>
            <button type="button" onClick={() => setSireFormOpen((v) => !v)} className={btn("secondary", "sm")}>
              {sireFormOpen ? "Close" : "+ Add external AI sire"}
            </button>
          </div>

          {sireFormOpen ? (
            <form onSubmit={(e) => void handleCreateExternalSire(e)} className="grid gap-3 rounded-[6px] border border-line bg-subtle p-3.5 sm:grid-cols-4">
              <label className={ui.label}>
                Bull name
                <input value={bullName} onChange={(e) => setBullName(e.target.value)} placeholder="e.g. Raja HF-22" className={ui.input} />
              </label>
              <label className={ui.label}>
                Semen code *
                <input required value={semenCode} onChange={(e) => setSemenCode(e.target.value)} placeholder="e.g. HF-2026-220" className={ui.input} />
              </label>
              <label className={ui.label}>
                Provider
                <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder="e.g. BRAC / DLS" className={ui.input} />
              </label>
              <label className={ui.label}>
                Breed
                <input value={sireBreed} onChange={(e) => setSireBreed(e.target.value)} placeholder="e.g. Friesian" className={ui.input} />
              </label>
              <div className="sm:col-span-4 flex justify-end">
                <button type="submit" disabled={sireSaving} className={btn("primary", "sm")}>
                  {sireSaving ? "Saving…" : "Save AI sire"}
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11.5px] text-muted">
                <tr>
                  <th className="py-2 pr-3">Sire</th>
                  <th className="py-2 pr-3">Type</th>
                  <th className="py-2 pr-3">Semen code</th>
                  <th className="py-2 pr-3">Provider</th>
                  <th className="py-2 pr-3">Breed</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sires.map((s) => (
                  <tr key={s.sire_id}>
                    <td className="py-2 pr-3 font-medium text-ink">
                      {s.cow_id ? (
                        <Link href={`/herd/${s.cow_id}`} className="text-accent hover:underline">
                          {s.display_name || s.cow_tag_number}
                        </Link>
                      ) : (
                        s.display_name || s.bull_name || s.semen_code
                      )}
                    </td>
                    <td className="py-2 pr-3 capitalize">{s.source_type.replaceAll("_", " ")}</td>
                    <td className="py-2 pr-3">{s.semen_code || "—"}</td>
                    <td className="py-2 pr-3">{s.provider || "—"}</td>
                    <td className="py-2 pr-3 capitalize">{s.breed || "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <BreedingFormModal
        key={`ws-bf-${breedingFixedCowId ?? "any"}-${editingBreeding?.breeding_id ?? "new"}-${breedingModalOpen}`}
        open={breedingModalOpen}
        onClose={() => {
          setBreedingModalOpen(false);
          setEditingBreeding(null);
        }}
        onSaved={reloadAll}
        onError={setError}
        onNotice={setNotice}
        fixedCowId={breedingFixedCowId}
        cows={cows}
        sires={sires}
        initialRecord={editingBreeding}
      />

      <PregnancyCheckModal
        key={`ws-pc-${checkFixedCowId ?? "any"}-${checkDefaultBreedingId ?? "none"}-${checkModalOpen}`}
        open={checkModalOpen}
        onClose={() => setCheckModalOpen(false)}
        onSaved={reloadAll}
        onError={setError}
        onNotice={setNotice}
        fixedCowId={checkFixedCowId}
        cows={cows}
        breedingRecords={breedings}
        defaultBreedingId={checkDefaultBreedingId}
      />

      <CalvingDrawerModal
        key={`ws-calv-${calvingTarget?.pregnancyId ?? "closed"}`}
        open={Boolean(calvingTarget)}
        onClose={() => setCalvingTarget(null)}
        onSaved={reloadAll}
        onError={setError}
        onNotice={setNotice}
        pregnancyId={calvingTarget?.pregnancyId ?? ""}
        damTag={calvingTarget?.damTag ?? ""}
        warehouses={warehouses}
      />

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
}
