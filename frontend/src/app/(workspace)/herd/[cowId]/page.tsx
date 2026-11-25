"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, StatTile, statusTone, Tabs, ui } from "@/components/ui";
import { shiftIsoDate, todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import { EditProfilePanel } from "@/components/cow-profile/edit-profile-panel";
import { ProfileOverviewTab } from "@/components/cow-profile/profile-overview-tab";
import { BreedingTab, HealthCareTab, MilkCostsTab } from "@/components/cow-profile/profile-domain-tabs";
import {
  breedLabel,
  daysBetween,
  formatDisplayDate,
  formatMoney,
  formatNumber,
  sessionLabel,
  type BreedingRecord,
  type CowDetail,
  type CowExpense,
  type CowFeedingRecord,
  type CowListOption,
  type HealthRecord,
  type MilkRecord,
  type PregnancyReport,
  type SupplierOption,
  type WarehouseOption,
} from "@/components/cow-profile/types";

export default function CowProfilePage() {
  const { cowId } = useParams<{ cowId: string }>();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);

  const cowQuery = useQuery({
    queryKey: ["cow-profile", cowId],
    queryFn: () => apiRequest<CowDetail>(apiRoutes.herd.cow(cowId)),
  });

  const healthQuery = useQuery({
    queryKey: ["cow-health", cowId],
    queryFn: () => apiRequest<HealthRecord[]>(`${apiRoutes.health.records}?cow_id=${cowId}&include_archived=true`),
  });

  const breedingQuery = useQuery({
    queryKey: ["cow-breeding", cowId],
    queryFn: () => apiRequest<BreedingRecord[]>(`${apiRoutes.health.breeding}?cow_id=${cowId}&include_archived=true`),
  });

  const pregnancyQuery = useQuery({
    queryKey: ["cow-pregnancy", cowId],
    queryFn: () => apiRequest<PregnancyReport[]>(`${apiRoutes.health.pregnancy}?cow_id=${cowId}&include_archived=true`),
  });

  const milkQuery = useQuery({
    queryKey: ["cow-milk", cowId],
    queryFn: () => apiRequest<MilkRecord[]>(`${apiRoutes.sales.milk}?cow_id=${cowId}`),
  });

  const expenseQuery = useQuery({
    queryKey: ["cow-expenses", cowId],
    queryFn: () => apiRequest<CowExpense[]>(`${apiRoutes.feeding.expenses}?cow_id=${cowId}`),
  });

  const feedingQuery = useQuery({
    queryKey: ["cow-feeding", cowId],
    queryFn: () => apiRequest<CowFeedingRecord[]>(`${apiRoutes.feeding.records}?cow_id=${cowId}`),
  });

  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiRequest<WarehouseOption[]>(apiRoutes.herd.warehouses),
    staleTime: 60_000,
  });

  const suppliersQuery = useQuery({
    queryKey: ["suppliers"],
    queryFn: () => apiRequest<SupplierOption[]>(apiRoutes.herd.suppliers),
    staleTime: 60_000,
  });

  const cowsListQuery = useQuery({
    queryKey: ["cows-options"],
    queryFn: () => apiRequest<CowListOption[]>(apiRoutes.herd.cows),
    staleTime: 60_000,
  });

  const reloadAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["cow-profile", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["cow-health", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["cow-breeding", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["cow-pregnancy", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["cow-milk", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["cow-expenses", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["cow-feeding", cowId] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
    ]);
  }, [queryClient, cowId]);

  const cow = cowQuery.data ?? null;
  const healthRecords = useMemo(() => healthQuery.data ?? [], [healthQuery.data]);
  const breedingRecords = useMemo(() => breedingQuery.data ?? [], [breedingQuery.data]);
  const pregnancyReports = useMemo(() => pregnancyQuery.data ?? [], [pregnancyQuery.data]);
  const milkRecords = useMemo(() => milkQuery.data ?? [], [milkQuery.data]);
  const expenses = useMemo(() => expenseQuery.data ?? [], [expenseQuery.data]);
  const feedingRecords = useMemo(() => feedingQuery.data ?? [], [feedingQuery.data]);
  const warehouses = warehousesQuery.data ?? [];
  const suppliers = suppliersQuery.data ?? [];
  const allCows = cowsListQuery.data ?? [];

  const today = todayInDhaka();

  // Compute KPI strip metrics
  const kpis = useMemo(() => {
    if (!cow) return null;

    const activeWeights = (cow.weight_records ?? [])
      .filter((w) => !w.is_archived)
      .slice()
      .sort((a, b) => b.weigh_date.localeCompare(a.weigh_date));
    const latestWeight = activeWeights[0];
    const previousWeight = activeWeights[1];
    const weightDelta =
      latestWeight && previousWeight
        ? Number(latestWeight.weight_kg) - Number(previousWeight.weight_kg)
        : null;

    const currentStay = (cow.warehouse_history ?? []).find((m) => !m.moved_out_date);
    const stayDays = currentStay ? daysBetween(currentStay.moved_in_date, today) : null;
    const daysOnFarm = cow.acquisition_date ? daysBetween(cow.acquisition_date, today) : null;

    const activePregnancy = pregnancyReports.find(
      (p) => !p.is_archived && (p.status === "confirmed" || p.status === "suspected")
    );
    const dueCare = healthRecords
      .filter((h) => !h.is_archived && h.next_due_date)
      .sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date)))[0];

    const cutoff30 = shiftIsoDate(today, -30);
    const activeMilk30 = milkRecords.filter(
      (m) => !m.is_archived && !m.is_void && m.production_date >= cutoff30
    );
    const milkDaysCount = new Set(activeMilk30.map((m) => m.production_date)).size;
    const milk30Liters = activeMilk30.reduce((sum, m) => sum + Number(m.liters), 0);

    const totalDirectCost =
      healthRecords.filter((h) => !h.is_archived).reduce((s, h) => s + Number(h.cost ?? 0), 0) +
      breedingRecords.filter((b) => !b.is_archived).reduce((s, b) => s + Number(b.cost ?? 0), 0) +
      expenses.filter((e) => !e.is_archived && !e.is_void).reduce((s, e) => s + Number(e.amount ?? 0), 0) +
      feedingRecords.filter((f) => !f.is_archived).reduce((s, f) => s + Number(f.cost ?? 0), 0);

    return {
      latestWeight,
      weightDelta,
      currentStay,
      stayDays,
      daysOnFarm,
      activePregnancy,
      dueCare,
      milkDaysCount,
      milk30Liters,
      totalDirectCost,
    };
  }, [cow, today, pregnancyReports, healthRecords, breedingRecords, milkRecords, expenses, feedingRecords]);

  async function updateStatus(status: string) {
    if (!cow) return;
    setStatusBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.herd.cow(cowId), {
        method: "PATCH",
        body: { status },
      });
      setNotice("Cow status updated.");
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function toggleArchive() {
    if (!cow) return;
    const archive = !cow.is_archived;
    if (!window.confirm(`${archive ? "Archive" : "Restore"} cow ${cow.current_tag_number}?`)) return;
    setStatusBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.herd.cow(cowId), {
        method: "PATCH",
        body: { is_archived: archive },
      });
      setNotice(archive ? "Cow archived." : "Cow restored.");
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update archive status.");
    } finally {
      setStatusBusy(false);
    }
  }

  const loadError = cowQuery.error instanceof Error ? cowQuery.error.message : "";
  const activeHealthCount = healthRecords.filter((h) => !h.is_archived).length;
  const activeBreedingCount = breedingRecords.filter((b) => !b.is_archived).length;
  const activePregnancyCount = pregnancyReports.filter((p) => !p.is_archived).length;
  const activeMilkAndCostCount =
    milkRecords.filter((m) => !m.is_archived && !m.is_void).length +
    expenses.filter((e) => !e.is_archived && !e.is_void).length +
    feedingRecords.filter((f) => !f.is_archived).length;

  const tabItems = [
    { key: "overview", label: "Overview & logs" },
    { key: "health", label: `Health (${activeHealthCount})` },
    { key: "breeding", label: `Breeding (${activeBreedingCount}) · Pregnancy (${activePregnancyCount})` },
    { key: "milk_costs", label: `Milk & costs (${activeMilkAndCostCount})` },
  ] as const;

  return (
    <ModulePage title="Cow profile" subtitle="Detailed animal record, weights, housing, tags, health, and lineage.">
      <div className="mb-4">
        <Link href="/herd" className={ui.link}>
          ← Back to herd
        </Link>
      </div>

      {cowQuery.isLoading ? <p className="text-[13px] text-muted">Loading cow profile…</p> : null}
      {loadError ? <Notice>{loadError}</Notice> : null}
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      {notice ? <div className="mb-4"><Notice tone="success">{notice}</Notice></div> : null}

      {cow && kpis ? (
        <div className="space-y-5">
          {/* Header Card */}
          <section className="rounded-[8px] border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2">
                  <h2 className="text-[20px] font-semibold tracking-tight text-ink">
                    Cow {cow.current_tag_number}
                  </h2>
                  <Badge tone={statusTone(cow.status)}>
                    <span className="capitalize">{cow.status}</span>
                  </Badge>
                  {cow.is_archived ? <Badge tone="warn">Archived</Badge> : null}
                  {cow.gives_milk ? (
                    <Badge tone="good">
                      Milking
                      {cow.milking_sessions?.length
                        ? ` · ${cow.milking_sessions.map(sessionLabel).join(", ")}`
                        : ""}
                    </Badge>
                  ) : null}
                </div>
                <p className="mt-1 text-[13px] text-muted capitalize">
                  {cow.category}
                  {cow.cow_type ? ` · ${cow.cow_type}` : ""} · {cow.sex}
                  {cow.breed ? ` · ${breedLabel(cow.breed)}` : ""} ·{" "}
                  {cow.warehouse_name ?? "No warehouse"}
                </p>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[12px] font-medium text-muted">
                  <span className="mb-1 block">Status</span>
                  <select
                    disabled={statusBusy}
                    value={cow.status}
                    onChange={(event) => void updateStatus(event.target.value)}
                    className={`${ui.select} w-32`}
                  >
                    <option value="active">Active</option>
                    <option value="sold">Sold</option>
                    <option value="deceased">Deceased</option>
                    <option value="archived">Archived</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setEditOpen((open) => !open)}
                  className={btn("secondary", "md")}
                >
                  {editOpen ? "Close edit" : "Edit profile"}
                </button>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={() => void toggleArchive()}
                  className={btn("secondary", "md")}
                >
                  {cow.is_archived ? "Restore" : "Archive"}
                </button>
                <div className="inline-flex h-9 items-center rounded-[6px] border border-line-strong bg-surface px-3 text-[12.5px]">
                  <SafeDataHistory entityType="cows" entityId={cow.cow_id} entityLabel={`Cow #${cow.current_tag_number}`} />
                </div>
              </div>
            </div>
          </section>

          {editOpen ? (
            <EditProfilePanel
              key={`${cow.cow_id}-${cow.current_tag_number}-${cow.acquisition_type}`}
              cow={cow}
              suppliers={suppliers}
              cows={allCows}
              onSaved={reloadAll}
              onCancel={() => setEditOpen(false)}
              onError={setError}
              onNotice={setNotice}
            />
          ) : null}

          {/* Summary Stat Strip */}
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
            <StatTile
              label="Latest weight"
              value={cow.latest_weight_kg != null ? `${formatNumber(cow.latest_weight_kg)} kg` : "—"}
              subtext={
                kpis.latestWeight
                  ? `${formatDisplayDate(kpis.latestWeight.weigh_date)}${
                      kpis.weightDelta !== null
                        ? ` · ${kpis.weightDelta >= 0 ? "+" : ""}${formatNumber(kpis.weightDelta)} kg vs prev`
                        : ""
                    }`
                  : "No active weight recorded"
              }
            />
            <StatTile
              label="Current housing"
              value={<span className="text-[18px]">{cow.warehouse_name ?? "—"}</span>}
              subtext={
                kpis.daysOnFarm !== null && kpis.daysOnFarm >= 0
                  ? `${kpis.daysOnFarm} day${kpis.daysOnFarm === 1 ? "" : "s"} on farm${kpis.stayDays !== null && kpis.stayDays >= 0 ? ` · ${kpis.stayDays}d in shed` : ""}`
                  : kpis.currentStay
                  ? `Since ${formatDisplayDate(kpis.currentStay.moved_in_date)}${
                      kpis.stayDays !== null && kpis.stayDays >= 0 ? ` (${kpis.stayDays} days)` : ""
                    }`
                  : "No active stay record"
              }
            />
            <StatTile
              label={kpis.activePregnancy ? "Pregnancy status" : "Next care due"}
              value={
                <span className="text-[18px]">
                  {kpis.activePregnancy
                    ? kpis.activePregnancy.expected_calving_date
                      ? formatDisplayDate(kpis.activePregnancy.expected_calving_date)
                      : "Confirmed"
                    : kpis.dueCare?.next_due_date
                      ? formatDisplayDate(kpis.dueCare.next_due_date)
                      : "Up to date"}
                </span>
              }
              subtext={
                kpis.activePregnancy
                  ? `Expected calving (${kpis.activePregnancy.status})`
                  : kpis.dueCare?.next_due_date
                    ? `${kpis.dueCare.record_type}${
                        kpis.dueCare.next_due_date < today ? " · Overdue" : ""
                      }`
                    : "No pending care dates"
              }
            />
            <StatTile
              label={cow.gives_milk || milkRecords.length > 0 ? "30-day milk" : "Direct cow costs"}
              value={
                cow.gives_milk || milkRecords.length > 0
                  ? kpis.milkDaysCount > 0
                    ? `${formatNumber(kpis.milk30Liters / kpis.milkDaysCount)} L/day`
                    : "0 L/day"
                  : formatMoney(kpis.totalDirectCost)
              }
              subtext={
                cow.gives_milk || milkRecords.length > 0
                  ? `${formatNumber(kpis.milk30Liters)} L total over ${kpis.milkDaysCount} day${kpis.milkDaysCount !== 1 ? "s" : ""} · Direct cost: ${formatMoney(kpis.totalDirectCost)}`
                  : "Health, breeding, expenses & feeding"
              }
            />
          </div>

          <Tabs items={tabItems} active={activeTab} onChange={setActiveTab} />

          {activeTab === "overview" ? (
            <ProfileOverviewTab
              cow={cow}
              warehouses={warehouses}
              reload={reloadAll}
              onError={setError}
              onNotice={setNotice}
            />
          ) : null}

          {activeTab === "health" ? (
            <HealthCareTab
              cowId={cow.cow_id}
              records={healthRecords}
              reload={reloadAll}
              onError={setError}
              onNotice={setNotice}
            />
          ) : null}

          {activeTab === "breeding" ? (
            <BreedingTab
              cow={cow}
              breedingRecords={breedingRecords}
              pregnancyReports={pregnancyReports}
              cows={allCows}
              reload={reloadAll}
              onError={setError}
              onNotice={setNotice}
            />
          ) : null}

          {activeTab === "milk_costs" ? (
            <MilkCostsTab
              key={`${cow.cow_id}-${cow.gives_milk}-${(cow.milking_sessions ?? []).join(",")}`}
              cow={cow}
              milkRecords={milkRecords}
              expenses={expenses}
              feedingRecords={feedingRecords}
              healthRecords={healthRecords}
              breedingRecords={breedingRecords}
              reload={reloadAll}
              onError={setError}
              onNotice={setNotice}
            />
          ) : null}
        </div>
      ) : null}
    </ModulePage>
  );
}
