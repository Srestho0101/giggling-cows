"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, StatTile, statusTone, Tabs, ui } from "@/components/ui";
import { shiftIsoDate, todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import { EditProfilePanel } from "@/components/cow-profile/edit-profile-panel";
import { CowAvatar } from "@/components/cow-profile/cow-avatar";
import { ProfileOverviewTab } from "@/components/cow-profile/profile-overview-tab";
import { BreedingTab, HealthCareTab, MilkCostsTab } from "@/components/cow-profile/profile-domain-tabs";
import {
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
import { daysBetween } from "@/components/cow-profile/types";
import { useI18n } from "@/lib/i18n";

export default function CowProfilePage() {
  const { cowId } = useParams<{ cowId: string }>();
  const { tr, money, num, date: fmtDate, enumLabel, daysOnFarm } = useI18n();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("overview");
  const [editOpen, setEditOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [statusBusy, setStatusBusy] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);
  const [saleModalOpen, setSaleModalOpen] = useState(false);
  const [saleForm, setSaleForm] = useState({
    buyer_name: "",
    buyer_phone: "",
    buyer_address: "",
    sold_date: todayInDhaka(),
    sale_price: "",
    sale_notes: "",
  });

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
      queryClient.invalidateQueries({ queryKey: ["data-workbench", apiRoutes.herd.cows] }),
      queryClient.invalidateQueries({ queryKey: ["herd-cows"] }),
      queryClient.invalidateQueries({ queryKey: ["global-cow-search"] }),
      queryClient.invalidateQueries({ queryKey: ["milk-workspace-cows"] }),
      queryClient.invalidateQueries({ queryKey: ["cows-options"] }),
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
    const daysFarm = cow.acquisition_date ? daysBetween(cow.acquisition_date, today) : null;

    const activePregnancy = pregnancyReports.find(
      (p) => !p.is_archived && (p.status === "confirmed" || p.status === "suspected") && !p.actual_calving_date
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
      daysOnFarm: daysFarm,
      activePregnancy,
      dueCare,
      milkDaysCount,
      milk30Liters,
      totalDirectCost,
    };
  }, [cow, today, pregnancyReports, healthRecords, breedingRecords, milkRecords, expenses, feedingRecords]);

  async function updateStatus(status: string) {
    if (!cow) return;
    if (status === "sold" && cow.status !== "sold") {
      setSaleForm({
        buyer_name: cow.sale_record?.buyer_name ?? cow.buyer_name ?? "",
        buyer_phone: cow.sale_record?.buyer_phone ?? cow.buyer_phone ?? "",
        buyer_address: cow.sale_record?.buyer_address ?? cow.buyer_address ?? "",
        sold_date: cow.sale_record?.sale_date ?? cow.sold_date ?? today,
        sale_price:
          cow.sale_record?.sale_price != null
            ? String(cow.sale_record.sale_price)
            : cow.sale_price != null
              ? String(cow.sale_price)
              : "",
        sale_notes: cow.sale_record?.notes ?? cow.sale_notes ?? "",
      });
      setSaleModalOpen(true);
      return;
    }
    setStatusBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.herd.cow(cowId), {
        method: "PATCH",
        body: { status },
      });
      setNotice(tr("Cow status updated.", "গরুর অবস্থা আপডেট হয়েছে।"));
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update status.");
    } finally {
      setStatusBusy(false);
    }
  }

  async function handleConfirmSale(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!cow) return;
    setStatusBusy(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.herd.cow(cowId), {
        method: "PATCH",
        body: {
          status: "sold",
          buyer_name: saleForm.buyer_name.trim() || null,
          buyer_phone: saleForm.buyer_phone.trim() || null,
          buyer_address: saleForm.buyer_address.trim() || null,
          sold_date: saleForm.sold_date || today,
          sale_price: saleForm.sale_price !== "" ? Number(saleForm.sale_price) : null,
          sale_notes: saleForm.sale_notes.trim() || null,
        },
      });
      setSaleModalOpen(false);
      setNotice(tr("Cow marked as sold and buyer record saved.", "গরু বিক্রি হিসেবে সংরক্ষণ হয়েছে।"));
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record cow sale.");
    } finally {
      setStatusBusy(false);
    }
  }

  function requestToggleArchive() {
    if (!cow) return;
    const archive = !cow.is_archived;
    setConfirmModal({
      title: archive
        ? tr(`Archive cow ${cow.current_tag_number}?`, `গরু ${cow.current_tag_number} আর্কাইভ করবেন?`)
        : tr(`Restore cow ${cow.current_tag_number}?`, `গরু ${cow.current_tag_number} পুনরুদ্ধার করবেন?`),
      description: archive
        ? tr(
            "Archiving removes this cow from active herd lists while preserving all history.",
            "আর্কাইভ করলে গরু সক্রিয় তালিকা থেকে সরে যাবে তবে সকল ইতিহাস সংরক্ষিত থাকবে।"
          )
        : undefined,
      mode: "confirm",
      confirmLabel: archive ? tr("Archive") : tr("Restore"),
      tone: archive ? "danger" : "primary",
      onConfirm: async () => {
        setStatusBusy(true);
        setError("");
        setNotice("");
        try {
          await apiRequest(apiRoutes.herd.cow(cowId), {
            method: "PATCH",
            body: { is_archived: archive },
          });
          setNotice(archive ? tr("Cow archived.", "গরু আর্কাইভ করা হয়েছে।") : tr("Cow restored.", "গরু পুনরুদ্ধার করা হয়েছে।"));
          await reloadAll();
        } finally {
          setStatusBusy(false);
        }
      },
    });
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
    { key: "overview", label: tr("Overview & logs", "সারসংক্ষেপ ও লগ") },
    { key: "health", label: `${tr("Health")} (${activeHealthCount})` },
    { key: "breeding", label: `${tr("Breeding")} (${activeBreedingCount}) · ${tr("Pregnancy", "গর্ভধারণ")} (${activePregnancyCount})` },
    { key: "milk_costs", label: `${tr("Milk & costs", "দুধ ও খরচ")} (${activeMilkAndCostCount})` },
  ] as const;

  return (
    <ModulePage
      title={tr("Cow profile")}
      subtitle={tr("Detailed animal record, weights, shed housing, health, and lineage.", "গরুর বিস্তারিত তথ্য, ওজন, শেড ও স্বাস্থ্য।")}
    >
      <div className="mb-4">
        <Link href="/herd" className={ui.link}>
          ← {tr("Back to herd")}
        </Link>
      </div>

      {cowQuery.isLoading ? <p className="text-[13px] text-muted">{tr("Loading cow profile…", "লোড হচ্ছে…")}</p> : null}
      {loadError ? <Notice>{loadError}</Notice> : null}
      {error ? <div className="mb-4"><Notice>{error}</Notice></div> : null}
      {notice ? <div className="mb-4"><Notice tone="success">{notice}</Notice></div> : null}

      {cow && kpis ? (
        <div className="space-y-5">
          {/* Header Card */}
          <section className="rounded-[8px] border border-line bg-surface p-4 sm:p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div className="flex items-center gap-4">
                <CowAvatar
                  cowId={cow.cow_id}
                  tag={cow.current_tag_number}
                  profilePictureUrl={cow.profile_picture_url}
                  size="xl"
                  editable
                  onUpdated={reloadAll}
                  onError={setError}
                  onNotice={setNotice}
                />
                <div>
                  <div className="flex flex-wrap items-center gap-2">
                    <h2 className="text-[20px] font-semibold tracking-tight text-ink">
                      {tr("Cow")} {cow.current_tag_number}
                    </h2>
                    <Badge tone={statusTone(cow.status)}>{enumLabel(cow.status)}</Badge>
                    {cow.is_archived ? <Badge tone="warn">{enumLabel("archived")}</Badge> : null}
                    {cow.gives_milk ? (
                      <Badge tone="good">
                        {tr("Milking")}
                        {cow.milking_sessions?.length
                          ? ` · ${cow.milking_sessions.map((s) => enumLabel(s)).join(", ")}`
                          : ""}
                      </Badge>
                    ) : null}
                  </div>
                  <p className="mt-1 text-[13px] text-muted">
                    {enumLabel(cow.category)}
                    {cow.cow_type ? ` · ${cow.cow_type}` : ""} · {enumLabel(cow.sex)}
                    {cow.breed ? ` · ${enumLabel(cow.breed)}` : ""}
                    {cow.color ? ` · ${cow.color}` : ""} ·{" "}
                    {cow.warehouse_name ?? tr("No shed", "কোনো শেড নেই")}
                  </p>
                </div>
              </div>

              <div className="flex flex-wrap items-end gap-2">
                <label className="text-[12px] font-medium text-muted">
                  <span className="mb-1 block">{tr("Status")}</span>
                  <select
                    disabled={statusBusy}
                    value={cow.status}
                    onChange={(event) => void updateStatus(event.target.value)}
                    className={`${ui.select} w-32`}
                  >
                    <option value="active">{tr("Active")}</option>
                    <option value="sold">{tr("Sold")}</option>
                    <option value="deceased">{tr("Deceased")}</option>
                    <option value="archived">{enumLabel("archived")}</option>
                  </select>
                </label>
                <button
                  type="button"
                  onClick={() => setEditOpen((open) => !open)}
                  className={btn("secondary", "md")}
                >
                  {editOpen ? tr("Close edit") : tr("Edit profile")}
                </button>
                <button
                  type="button"
                  disabled={statusBusy}
                  onClick={requestToggleArchive}
                  className={btn(cow.is_archived ? "secondary" : "danger", "md")}
                >
                  {cow.is_archived ? tr("Restore") : tr("Archive")}
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
              label={tr("Latest weight", "সর্বশেষ ওজন")}
              value={cow.latest_weight_kg != null ? `${num(cow.latest_weight_kg)} kg` : "—"}
              subtext={
                kpis.latestWeight
                  ? `${fmtDate(kpis.latestWeight.weigh_date)}${
                      kpis.weightDelta !== null
                        ? ` · ${kpis.weightDelta >= 0 ? "+" : ""}${num(kpis.weightDelta)} kg`
                        : ""
                    }`
                  : tr("No active weight recorded", "কোনো ওজন রেকর্ড নেই")
              }
            />
            <StatTile
              label={tr("Current shed", "বর্তমান শেড")}
              value={<span className="text-[18px]">{cow.warehouse_name ?? "—"}</span>}
              subtext={
                kpis.daysOnFarm !== null && kpis.daysOnFarm >= 0
                  ? `${daysOnFarm(kpis.daysOnFarm)} ${tr("on farm", "খামারে")}${kpis.stayDays !== null && kpis.stayDays >= 0 ? ` · ${kpis.stayDays}d ${tr("in shed", "শেডে")}` : ""}`
                  : kpis.currentStay
                    ? `${fmtDate(kpis.currentStay.moved_in_date)}`
                    : tr("No active stay record")
              }
            />
            <StatTile
              label={kpis.activePregnancy ? tr("Pregnancy status", "গর্ভধারণ অবস্থা") : tr("Next care due", "পরবর্তী চিকিৎসা")}
              value={
                <span className="text-[18px]">
                  {kpis.activePregnancy
                    ? kpis.activePregnancy.expected_calving_date
                      ? fmtDate(kpis.activePregnancy.expected_calving_date)
                      : tr("Confirmed", "নিশ্চিত")
                    : kpis.dueCare?.next_due_date
                      ? fmtDate(kpis.dueCare.next_due_date)
                      : tr("Up to date", "হালনাগাদ")}
                </span>
              }
              subtext={
                kpis.activePregnancy
                  ? `${tr("Expected calving")} (${enumLabel(kpis.activePregnancy.status)})`
                  : kpis.dueCare?.next_due_date
                    ? `${enumLabel(kpis.dueCare.record_type)}${kpis.dueCare.next_due_date < today ? ` · ${tr("Overdue", "বিলম্বিত")}` : ""}`
                    : tr("No pending care dates")
              }
            />
            <StatTile
              label={cow.gives_milk || milkRecords.length > 0 ? tr("30-day milk", "৩০ দিনের দুধ") : tr("Direct cow costs", "সরাসরি খরচ")}
              value={
                cow.gives_milk || milkRecords.length > 0
                  ? kpis.milkDaysCount > 0
                    ? `${num(kpis.milk30Liters / kpis.milkDaysCount)} L/day`
                    : "0 L/day"
                  : money(kpis.totalDirectCost)
              }
              subtext={
                cow.gives_milk || milkRecords.length > 0
                  ? `${num(kpis.milk30Liters)} L (${num(kpis.milkDaysCount, 0)}d) · ${money(kpis.totalDirectCost)}`
                  : tr("Health, breeding, expenses & feeding")
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

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />

      {saleModalOpen && cow ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4"
          onClick={() => setSaleModalOpen(false)}
        >
          <form
            onSubmit={(e) => void handleConfirmSale(e)}
            onClick={(e) => e.stopPropagation()}
            className="w-full max-w-lg rounded-[10px] border border-line bg-surface p-5 shadow-xl space-y-4"
          >
            <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
              <div>
                <h3 className="text-[15px] font-semibold text-ink">
                  {tr("Record cow sale")} — {cow.current_tag_number}
                </h3>
                <p className="text-[12px] text-muted">
                  {tr("Save who bought this cow and the sale details.")}
                </p>
              </div>
              <button
                type="button"
                onClick={() => setSaleModalOpen(false)}
                className={btn("quiet", "sm")}
              >
                {tr("Cancel")}
              </button>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className={ui.label}>
                {tr("Buyer name")} *
                <input
                  required
                  maxLength={150}
                  value={saleForm.buyer_name}
                  onChange={(e) => setSaleForm((f) => ({ ...f, buyer_name: e.target.value }))}
                  placeholder="e.g. Abdul Karim"
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                {tr("Buyer phone")}
                <input
                  maxLength={50}
                  value={saleForm.buyer_phone}
                  onChange={(e) => setSaleForm((f) => ({ ...f, buyer_phone: e.target.value }))}
                  placeholder="e.g. 017XXXXXXXX"
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                {tr("Sale date")} *
                <input
                  required
                  type="date"
                  value={saleForm.sold_date}
                  onChange={(e) => setSaleForm((f) => ({ ...f, sold_date: e.target.value }))}
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                {tr("Sale price (৳)")}
                <input
                  type="number"
                  min="0"
                  step="0.01"
                  value={saleForm.sale_price}
                  onChange={(e) => setSaleForm((f) => ({ ...f, sale_price: e.target.value }))}
                  className={ui.input}
                />
              </label>
              <label className={`${ui.label} sm:col-span-2`}>
                {tr("Buyer address")}
                <input
                  maxLength={255}
                  value={saleForm.buyer_address}
                  onChange={(e) => setSaleForm((f) => ({ ...f, buyer_address: e.target.value }))}
                  placeholder="Village, market, or address"
                  className={ui.input}
                />
              </label>
              <label className={`${ui.label} sm:col-span-2`}>
                {tr("Sale notes")}
                <textarea
                  rows={2}
                  value={saleForm.sale_notes}
                  onChange={(e) => setSaleForm((f) => ({ ...f, sale_notes: e.target.value }))}
                  placeholder="Payment method, transport, or remarks"
                  className={ui.textarea}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                onClick={() => setSaleModalOpen(false)}
                className={btn("secondary", "sm")}
              >
                {tr("Cancel")}
              </button>
              <button type="submit" disabled={statusBusy} className={btn("primary", "sm")}>
                {statusBusy ? tr("Saving…") : tr("Confirm sale")}
              </button>
            </div>
          </form>
        </div>
      ) : null}
    </ModulePage>
  );
}
