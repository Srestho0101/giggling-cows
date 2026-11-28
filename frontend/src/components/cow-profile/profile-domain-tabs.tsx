"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { PaginatedTableCard, type PaginatedColumn } from "@/components/paginated-scroll-table";
import { SafeDataHistory } from "@/components/safe-data-history";
import {
  BreedingFormModal,
  CalvingDrawerModal,
  PregnancyCheckModal,
} from "@/components/breeding/breeding-drawers";
import { Badge, btn, statusTone, ui } from "@/components/ui";
import { shiftIsoDate, todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  type BreedingRecord,
  type CowDetail,
  type CowExpense,
  type CowFeedingRecord,
  type CowListOption,
  type HealthRecord,
  type MilkRecord,
  type MilkSession,
  type PregnancyEpisode,
  type PregnancyReport,
  type SireItem,
  type WarehouseOption,
} from "@/components/cow-profile/types";

export function HealthCareTab({
  cowId,
  records,
  reload,
  onError,
  onNotice,
}: {
  cowId: string;
  records: HealthRecord[];
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { tr, money, date: fmtDate, enumLabel } = useI18n();
  const today = todayInDhaka();
  const dueLimit = shiftIsoDate(today, 14);
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [recordType, setRecordType] = useState("vaccination");
  const [recordDate, setRecordDate] = useState(today);
  const [vetName, setVetName] = useState("");
  const [cost, setCost] = useState("");
  const [nextDueDate, setNextDueDate] = useState("");
  const [details, setDetails] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const visible = useMemo(
    () => (showArchived ? records : records.filter((r) => !r.is_archived)),
    [records, showArchived]
  );

  const upcoming = useMemo(
    () =>
      records
        .filter((r) => !r.is_archived && r.next_due_date && r.next_due_date <= dueLimit)
        .sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date))),
    [records, dueLimit]
  );

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.health.records, {
        method: "POST",
        body: {
          cow_id: cowId,
          record_type: recordType,
          record_date: recordDate,
          vet_name: vetName.trim() || null,
          cost: cost !== "" ? Number(cost) : 0,
          next_due_date: nextDueDate || null,
          details: details.trim() || null,
        },
      });
      setVetName("");
      setCost("");
      setNextDueDate("");
      setDetails("");
      onNotice(tr("Health record saved.", "স্বাস্থ্য রেকর্ড সংরক্ষণ করা হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not save health record.", "স্বাস্থ্য রেকর্ড সংরক্ষণ করা যায়নি।"));
    } finally {
      setSaving(false);
    }
  }

  function toggleArchive(row: HealthRecord) {
    const archive = !row.is_archived;
    if (!archive) {
      void applyToggleArchive(row, false);
      return;
    }
    setConfirmModal({
      title: tr("Archive this health record?", "এই স্বাস্থ্য রেকর্ডটি আর্কাইভ করবেন?"),
      mode: "confirm",
      confirmLabel: tr("Archive"),
      tone: "danger",
      onConfirm: () => applyToggleArchive(row, true),
    });
  }

  async function applyToggleArchive(row: HealthRecord, archive: boolean) {
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.health.record(row.health_id), {
        method: "PATCH",
        body: { is_archived: archive },
      });
      onNotice(archive ? tr("Health record archived.", "স্বাস্থ্য রেকর্ড আর্কাইভ করা হয়েছে।") : tr("Health record restored.", "স্বাস্থ্য রেকর্ড পুনরুদ্ধার করা হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not update health record.", "স্বাস্থ্য রেকর্ড আপডেট করা যায়নি।"));
    }
  }

  const columns: PaginatedColumn<HealthRecord>[] = [
    {
      key: "record_date",
      label: tr("Date"),
      render: (row) => <span className="font-medium">{fmtDate(row.record_date)}</span>,
    },
    {
      key: "record_type",
      label: tr("Type"),
      render: (row) => <span>{enumLabel(row.record_type)}</span>,
    },
    {
      key: "vet_name",
      label: tr("Vet"),
      render: (row) => row.vet_name || "—",
    },
    {
      key: "cost",
      label: tr("Cost", "খরচ"),
      align: "right",
      render: (row) => money(row.cost),
    },
    {
      key: "next_due_date",
      label: tr("Next due"),
      render: (row) => {
        if (!row.next_due_date) return "—";
        const overdue = row.next_due_date < today;
        return (
          <Badge tone={overdue ? "bad" : row.next_due_date <= dueLimit ? "warn" : "neutral"}>
            {fmtDate(row.next_due_date)}
          </Badge>
        );
      },
    },
    {
      key: "details",
      label: tr("Details"),
      render: (row) => <span className="text-muted">{row.details || "—"}</span>,
    },
    {
      key: "actions",
      label: tr("Actions"),
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2.5 text-[12px]">
          <button
            type="button"
            onClick={() => void toggleArchive(row)}
            className="cursor-pointer font-medium text-accent hover:underline"
          >
            {row.is_archived ? tr("Restore") : tr("Archive")}
          </button>
          <SafeDataHistory
            entityType="health_records"
            entityId={row.health_id}
            entityLabel={`${enumLabel(row.record_type)} · ${fmtDate(row.record_date)}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-line bg-surface p-4">
        <h3 className="text-[13px] font-semibold text-ink">{tr("Due & upcoming care (next 14 days)", "আসন্ন ও মেয়াদোত্তীর্ণ চিকিৎসা (আগামী ১৪ দিন)")}</h3>
        {upcoming.length ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {upcoming.map((row) => {
              const overdue = String(row.next_due_date) < today;
              return (
                <Badge key={row.health_id} tone={overdue ? "bad" : "warn"}>
                  <span>{enumLabel(row.record_type)}</span> ·{" "}
                  {overdue ? tr("overdue", "মেয়াদোত্তীর্ণ") : tr("due", "নির্ধারিত")} {fmtDate(row.next_due_date)}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="mt-1.5 text-[12.5px] text-muted">{tr("No upcoming care due within 14 days.", "আগামী ১৪ দিনে কোনো নির্ধারিত চিকিৎসা নেই।")}</p>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
        <PaginatedTableCard
          title={tr("Health records")}
          subtitle={tr("Vaccinations, treatments, deworming, and checkups.", "টিকা, চিকিৎসা, কৃমিনাশক ও স্বাস্থ্য পরীক্ষার তথ্য।")}
          rows={visible}
          rowKey={(row) => row.health_id}
          columns={columns}
          emptyMessage={tr("No health records logged for this cow.", "এই গরুর কোনো স্বাস্থ্য রেকর্ড নেই।")}
          defaultPageSize={10}
          scrollHeightClass="max-h-[260px]"
          headerActions={
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              {tr("Show archived")}
            </label>
          }
        />

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
        >
          <div>
            <h3 className="text-[14px] font-semibold text-ink">{tr("Log health care", "স্বাস্থ্য তথ্য যোগ করুন")}</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              {tr("Add a treatment, vaccination, deworming, or vet checkup for this cow.", "চিকিৎসা, টিকা, কৃমিনাশক বা ডাক্তার দেখানোর তথ্য লিখুন।")}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={ui.label}>
              {tr("Type")} *
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className={ui.select}
              >
                <option value="vaccination">{enumLabel("vaccination")}</option>
                <option value="deworming">{enumLabel("deworming")}</option>
                <option value="treatment">{enumLabel("treatment")}</option>
                <option value="checkup">{enumLabel("checkup")}</option>
              </select>
            </label>
            <label className={ui.label}>
              {tr("Date")} *
              <input
                type="date"
                required
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              {tr("Vet name", "ডাক্তারের নাম")}
              <input
                maxLength={100}
                value={vetName}
                onChange={(e) => setVetName(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              {tr("Cost (৳)", "খরচ (৳)")}
              <input
                type="number"
                min="0"
                step="0.01"
                value={cost}
                onChange={(e) => setCost(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={`${ui.label} sm:col-span-2`}>
              {tr("Next due date", "পরবর্তী তারিখ")}
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={`${ui.label} sm:col-span-2`}>
              {tr("Details")}
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className={ui.textarea}
              />
            </label>
          </div>
          <button type="submit" disabled={saving} className={btn("primary", "md")}>
            {saving ? tr("Saving…") : tr("Save health record", "স্বাস্থ্য রেকর্ড সংরক্ষণ করুন")}
          </button>
        </form>
      </div>
      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
}

export function BreedingTab({
  cow,
  breedingRecords,
  pregnancyReports,
  pregnancyEpisodes = [],
  sires = [],
  warehouses = [],
  cows,
  reload,
  onError,
  onNotice,
}: {
  cow: CowDetail;
  breedingRecords: BreedingRecord[];
  pregnancyReports: PregnancyReport[];
  pregnancyEpisodes?: PregnancyEpisode[];
  sires?: SireItem[];
  warehouses?: WarehouseOption[];
  cows: CowListOption[];
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { tr, money, integer, date: fmtDate, enumLabel } = useI18n();
  const today = todayInDhaka();
  const [breedingModalOpen, setBreedingModalOpen] = useState(false);
  const [editingBreeding, setEditingBreeding] = useState<BreedingRecord | null>(null);
  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [editingCheck, setEditingCheck] = useState<PregnancyReport | null>(null);
  const [calvingPregnancyId, setCalvingPregnancyId] = useState<string | null>(null);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const activeEpisode = useMemo(
    () =>
      pregnancyEpisodes.find(
        (p) => !p.is_archived && (p.status === "confirmed" || p.status === "suspected") && !p.ended_at
      ) ?? null,
    [pregnancyEpisodes]
  );

  const summary = cow.reproductive_summary;
  const stateLabel = (() => {
    if (!summary) return tr("Open", "খালি (প্রজননযোগ্য)");
    if (summary.state === "pregnant") {
      return `${tr("Pregnant", "গর্ভবতী")}${summary.days_pregnant != null ? ` · ${tr("Day", "দিন")} ${integer(summary.days_pregnant)}` : ""}${
        summary.expected_calving_date ? ` · ${tr("Due", "সম্ভাব্য প্রসব")} ${fmtDate(summary.expected_calving_date)}` : ""
      }`;
    }
    if (summary.state === "suspected_pregnant") {
      return `${tr("Suspected pregnant", "সম্ভাব্য গর্ভবতী")}${
        summary.expected_calving_date ? ` · ${tr("Due", "সম্ভাব্য প্রসব")} ${fmtDate(summary.expected_calving_date)}` : ""
      }`;
    }
    if (summary.state === "bred") {
      const days = summary.days_since_breeding ?? 0;
      const checkDueIn = Math.max(0, 30 - days);
      return `${tr("Bred", "প্রজননকৃত")} (${integer(days)} ${tr("d ago", "দিন আগে")})${checkDueIn > 0 ? ` · ${tr("Check due in", "পরীক্ষার বাকি")} ${integer(checkDueIn)} ${tr("d", "দিন")}` : ` · ${tr("Check due now", "এখনই পরীক্ষা প্রয়োজন")}`}`;
    }
    if (summary.state === "vwp") {
      return `${tr("Post-calving VWP", "প্রসব-পরবর্তী বিশ্রাম")}${
        summary.next_breeding_eligible_date ? ` (${fmtDate(summary.next_breeding_eligible_date)} ${tr("until", "পর্যন্ত")})` : ""
      }`;
    }
    return tr("Open", "খালি (প্রজননযোগ্য)");
  })();

  function requestArchiveBreeding(rec: BreedingRecord) {
    setConfirmModal({
      title: rec.is_archived ? tr("Restore breeding record?", "প্রজনন রেকর্ড পুনরুদ্ধার করবেন?") : tr("Archive breeding record?", "প্রজনন রেকর্ড আর্কাইভ করবেন?"),
      mode: "confirm",
      confirmLabel: rec.is_archived ? tr("Restore") : tr("Archive"),
      tone: rec.is_archived ? "primary" : "danger",
      onConfirm: async () => {
        await apiRequest(apiRoutes.health.breedingRecord(rec.breeding_id), {
          method: "PATCH",
          body: { is_archived: !rec.is_archived },
        });
        onNotice(rec.is_archived ? tr("Breeding record restored.", "প্রজনন রেকর্ড পুনরুদ্ধার করা হয়েছে।") : tr("Breeding record archived.", "প্রজনন রেকর্ড আর্কাইভ করা হয়েছে।"));
        await reload();
      },
    });
  }

  function requestArchiveCheck(rep: PregnancyReport) {
    setConfirmModal({
      title: rep.is_archived ? tr("Restore pregnancy check?", "গর্ভধারণ পরীক্ষা পুনরুদ্ধার করবেন?") : tr("Archive pregnancy check?", "গর্ভধারণ পরীক্ষা আর্কাইভ করবেন?"),
      mode: "confirm",
      confirmLabel: rep.is_archived ? tr("Restore") : tr("Archive"),
      tone: rep.is_archived ? "primary" : "danger",
      onConfirm: async () => {
        await apiRequest(apiRoutes.health.pregnancyReport(rep.pregnancy_id), {
          method: "PATCH",
          body: { is_archived: !rep.is_archived },
        });
        onNotice(rep.is_archived ? tr("Pregnancy check restored.", "গর্ভধারণ পরীক্ষা পুনরুদ্ধার করা হয়েছে।") : tr("Pregnancy check archived.", "গর্ভধারণ পরীক্ষা আর্কাইভ করা হয়েছে।"));
        await reload();
      },
    });
  }

  function requestAbortPregnancy(ep: PregnancyEpisode) {
    setConfirmModal({
      title: tr(`Mark pregnancy as aborted for ${cow.current_tag_number}?`, `${cow.current_tag_number}-এর গর্ভপাত হিসেবে চিহ্নিত করবেন?`),
      description: tr("Closes the active pregnancy episode, clears calving alerts, and returns the cow to Open.", "সক্রিয় গর্ভধারণ পর্ব বন্ধ করবে, প্রসব সতর্কতা সরাবে এবং গরুকে প্রজননযোগ্য অবস্থায় ফিরিয়ে আনবে।"),
      mode: "reason",
      confirmLabel: tr("Confirm abortion", "গর্ভপাত নিশ্চিত করুন"),
      tone: "danger",
      onConfirm: async (reason) => {
        await apiRequest(apiRoutes.health.pregnancyEpisode(ep.pregnancy_id), {
          method: "PATCH",
          body: { status: "aborted", ended_at: today, notes: reason || ep.notes || null },
        });
        onNotice(tr("Pregnancy marked as aborted and cow returned to Open.", "গর্ভপাত হিসেবে চিহ্নিত হয়েছে এবং গরু প্রজননযোগ্য অবস্থায় ফিরেছে।"));
        await reload();
      },
    });
  }

  const breedingColumns: PaginatedColumn<BreedingRecord>[] = [
    { key: "seed_date", label: tr("Insemination"), render: (r) => fmtDate(r.seed_date) },
    { key: "heat_date", label: tr("Heat", "হিট"), render: (r) => fmtDate(r.heat_date) },
    {
      key: "source",
      label: tr("Sire / Semen", "ষাঁড় / সিমেন"),
      render: (r) => r.sire_display_name || (r.sire_tag_number ? `${tr("Sire")} ${r.sire_tag_number}` : r.semen_code || "—"),
    },
    { key: "doctor_name", label: tr("Doctor"), render: (r) => r.doctor_name || "—" },
    { key: "cost", label: tr("Cost", "খরচ"), align: "right", render: (r) => money(r.cost) },
    {
      key: "outcome",
      label: tr("Outcome"),
      render: (r) => (
        <Badge tone={statusTone(r.outcome)}>
          <span>{enumLabel(r.outcome)}</span>
        </Badge>
      ),
    },
    {
      key: "actions",
      label: tr("Actions"),
      render: (r) => (
        <div className="flex items-center gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => {
              setEditingBreeding(r);
              setBreedingModalOpen(true);
            }}
            className="font-medium text-accent hover:underline"
          >
            {tr("Edit")}
          </button>
          <button
            type="button"
            onClick={() => requestArchiveBreeding(r)}
            className="font-medium text-muted hover:underline"
          >
            {r.is_archived ? tr("Restore") : tr("Archive")}
          </button>
          <SafeDataHistory entityType="breeding_records" entityId={r.breeding_id} entityLabel={`${tr("Breeding")} ${fmtDate(r.seed_date)}`} />
        </div>
      ),
    },
  ];

  const pregnancyColumns: PaginatedColumn<PregnancyReport>[] = [
    { key: "report_date", label: tr("Check date"), render: (r) => fmtDate(r.report_date) },
    {
      key: "status",
      label: tr("Result"),
      render: (r) => (
        <Badge tone={statusTone(r.status)}>
          <span>{enumLabel(r.status)}</span>
        </Badge>
      ),
    },
    {
      key: "expected_calving_date",
      label: tr("Expected calving"),
      render: (r) => fmtDate(r.expected_calving_date),
    },
    {
      key: "actual_calving_date",
      label: tr("Actual calving"),
      render: (r) => fmtDate(r.actual_calving_date),
    },
    { key: "notes", label: tr("Notes"), render: (r) => <span className="text-muted">{r.notes || "—"}</span> },
    {
      key: "actions",
      label: tr("Actions"),
      render: (r) => (
        <div className="flex items-center gap-2 text-[12px]">
          <button
            type="button"
            onClick={() => {
              setEditingCheck(r);
              setCheckModalOpen(true);
            }}
            className="font-medium text-accent hover:underline"
          >
            {tr("Edit")}
          </button>
          <button
            type="button"
            onClick={() => requestArchiveCheck(r)}
            className="font-medium text-muted hover:underline"
          >
            {r.is_archived ? tr("Restore") : tr("Archive")}
          </button>
          <SafeDataHistory entityType="pregnancy_reports" entityId={r.pregnancy_id} entityLabel={`${tr("Check", "পরীক্ষা")} ${fmtDate(r.report_date)}`} />
        </div>
      ),
    },
  ];

  const activeBreedings = breedingRecords.filter((r) => !r.is_archived);
  const activeChecks = pregnancyReports.filter((r) => !r.is_archived);
  const activeEpisodes = pregnancyEpisodes.filter((p) => !p.is_archived);

  return (
    <div className="space-y-5">
      {/* Single Reproductive Status Header with Next Logical Action */}
      <section className="rounded-[8px] border border-accent/35 bg-accent-soft p-4 flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-[11.5px] font-medium uppercase tracking-wider text-muted">{tr("Reproductive status", "প্রজনন অবস্থা")}</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-ink">{stateLabel}</h3>
          {activeEpisode?.dry_off_date ? (
            <p className="mt-0.5 text-[12px] text-muted">
              {tr("Dry-off target:", "দুধ শুকানোর তারিখ:")} {fmtDate(activeEpisode.dry_off_date)}
              {activeEpisode.sire_display_name ? ` · ${tr("Sire")}: ${activeEpisode.sire_display_name}` : ""}
            </p>
          ) : null}
        </div>
        <div className="flex flex-wrap items-center gap-2">
          {activeEpisode ? (
            <>
              <button
                type="button"
                onClick={() => setCalvingPregnancyId(activeEpisode.pregnancy_id)}
                className={btn("primary", "sm")}
              >
                {tr("Record calving", "বাচ্চা প্রসব লিখুন")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCheck(null);
                  setCheckModalOpen(true);
                }}
                className={btn("secondary", "sm")}
              >
                {tr("Log check", "পরীক্ষা লিখুন")}
              </button>
              <button
                type="button"
                onClick={() => requestAbortPregnancy(activeEpisode)}
                className={btn("danger", "sm")}
              >
                {tr("Mark aborted", "গর্ভপাত হিসেবে চিহ্নিত করুন")}
              </button>
            </>
          ) : summary?.state === "bred" ? (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingCheck(null);
                  setCheckModalOpen(true);
                }}
                className={btn("primary", "sm")}
              >
                {tr("Log pregnancy check", "গর্ভধারণ পরীক্ষা লিখুন")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingBreeding(null);
                  setBreedingModalOpen(true);
                }}
                className={btn("secondary", "sm")}
              >
                {tr("Log repeat breeding", "পুনরায় প্রজনন লিখুন")}
              </button>
            </>
          ) : (
            <>
              <button
                type="button"
                onClick={() => {
                  setEditingBreeding(null);
                  setBreedingModalOpen(true);
                }}
                className={btn("primary", "sm")}
              >
                {tr("Log breeding", "প্রজনন তথ্য লিখুন")}
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCheck(null);
                  setCheckModalOpen(true);
                }}
                className={btn("secondary", "sm")}
              >
                {tr("Log check / Bought pregnant", "পরীক্ষা / গর্ভবতী কেনা")}
              </button>
            </>
          )}
        </div>
      </section>

      {/* Grouped Reproductive Cycles */}
      {activeEpisodes.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-ink">{tr("Pregnancy & calving cycles", "গর্ভধারণ ও প্রসব চক্র")} ({integer(activeEpisodes.length)})</h3>
          <div className="space-y-3">
            {activeEpisodes.map((ep, idx) => (
              <div key={ep.pregnancy_id} className="rounded-[8px] border border-line bg-surface p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      {tr("Cycle", "চক্র")} #{integer(activeEpisodes.length - idx)}
                    </span>
                    <Badge tone={statusTone(ep.status)}>
                      <span>{enumLabel(ep.status)}</span>
                    </Badge>
                    {ep.breeding_seed_date ? (
                      <span className="text-[12px] text-muted">
                        {tr("Bred", "প্রজনন")} {fmtDate(ep.breeding_seed_date)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted">{tr("External / bought pregnant", "বাইরে থেকে গর্ভবতী কেনা")}</span>
                    )}
                    {ep.sire_display_name ? (
                      <span className="text-[12px] text-muted">· {ep.sire_display_name}</span>
                    ) : null}
                  </div>
                  <div className="text-[12px] text-muted">
                    {ep.expected_calving_date ? `${tr("Due:", "সম্ভাব্য প্রসব:")} ${fmtDate(ep.expected_calving_date)}` : ""}
                    {ep.ended_at ? ` · ${tr("Ended:", "সমাপ্ত:")} ${fmtDate(ep.ended_at)}` : ""}
                  </div>
                </div>

                {ep.checks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                    {ep.checks.map((chk) => (
                      <span key={chk.pregnancy_id} className="rounded-[4px] border border-line bg-subtle px-2 py-0.5 text-ink">
                        {tr("Check", "পরীক্ষা")} {fmtDate(chk.report_date)}: <strong>{enumLabel(chk.status)}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}

                {ep.calving_event ? (
                  <div className="rounded-[6px] border border-line bg-subtle p-2.5 text-[12px] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      {tr("Calved on", "প্রসবের তারিখ")} <strong>{fmtDate(ep.calving_event.calving_date)}</strong> (
                      <span>{enumLabel(ep.calving_event.calving_ease)}</span> ·{" "}
                      {integer(ep.calving_event.live_count)} {tr("live", "জীবিত")}, {integer(ep.calving_event.stillborn_count)} {tr("stillborn", "মৃত")})
                    </span>
                    {ep.calving_event.calves.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {ep.calving_event.calves.map((calf) => (
                          <Link
                            key={calf.cow_id}
                            href={`/herd/${calf.cow_id}`}
                            className="rounded-[4px] border border-accent/40 bg-surface px-2 py-0.5 font-medium text-accent hover:underline"
                          >
                            {tr("Calf", "বাছুর")} {calf.current_tag_number} ({enumLabel(calf.sex)})
                          </Link>
                        ))}
                      </span>
                    ) : null}
                  </div>
                ) : null}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <PaginatedTableCard
        title={tr("Breeding history", "প্রজনন ইতিহাস")}
        rows={activeBreedings}
        rowKey={(r) => r.breeding_id}
        columns={breedingColumns}
        emptyMessage={tr("No breeding records for this cow.", "এই গরুর কোনো প্রজনন রেকর্ড নেই।")}
        defaultPageSize={10}
        scrollHeightClass="max-h-[260px]"
      />

      <PaginatedTableCard
        title={tr("Pregnancy checks")}
        rows={activeChecks}
        rowKey={(r) => r.pregnancy_id}
        columns={pregnancyColumns}
        emptyMessage={tr("No pregnancy checks recorded.", "কোনো গর্ভধারণ পরীক্ষার তথ্য নেই।")}
        defaultPageSize={10}
        scrollHeightClass="max-h-[260px]"
      />

      <BreedingFormModal
        key={`bf-${cow.cow_id}-${editingBreeding?.breeding_id ?? "new"}-${breedingModalOpen}`}
        open={breedingModalOpen}
        onClose={() => {
          setBreedingModalOpen(false);
          setEditingBreeding(null);
        }}
        onSaved={reload}
        onError={onError}
        onNotice={onNotice}
        fixedCowId={cow.cow_id}
        cows={cows}
        sires={sires}
        initialRecord={editingBreeding}
        relatedSireIds={cow.pedigree?.related_sire_ids ?? []}
        relatedSireCowIds={cow.pedigree?.related_sire_cow_ids ?? []}
      />

      <PregnancyCheckModal
        key={`pc-${cow.cow_id}-${editingCheck?.pregnancy_id ?? "new"}-${checkModalOpen}`}
        open={checkModalOpen}
        onClose={() => {
          setCheckModalOpen(false);
          setEditingCheck(null);
        }}
        onSaved={reload}
        onError={onError}
        onNotice={onNotice}
        fixedCowId={cow.cow_id}
        cows={cows}
        breedingRecords={breedingRecords}
        initialReport={editingCheck}
        defaultBreedingId={summary?.latest_open_breeding_id ?? null}
      />

      <CalvingDrawerModal
        key={`calv-${calvingPregnancyId ?? "closed"}`}
        open={Boolean(calvingPregnancyId)}
        onClose={() => setCalvingPregnancyId(null)}
        onSaved={reload}
        onError={onError}
        onNotice={onNotice}
        pregnancyId={calvingPregnancyId ?? ""}
        damTag={cow.current_tag_number}
        warehouses={warehouses}
        defaultBreed={cow.breed}
      />

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
}

const SESSIONS: MilkSession[] = ["morning", "noon", "evening"];

export function MilkCostsTab({
  cow,
  milkRecords,
  expenses,
  feedingRecords,
  healthRecords,
  breedingRecords,
  reload,
  onError,
  onNotice,
}: {
  cow: CowDetail;
  milkRecords: MilkRecord[];
  expenses: CowExpense[];
  feedingRecords: CowFeedingRecord[];
  healthRecords: HealthRecord[];
  breedingRecords: BreedingRecord[];
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { tr, money, num, date: fmtDate, enumLabel } = useI18n();
  const [givesMilk, setGivesMilk] = useState(Boolean(cow.gives_milk));
  const [sessions, setSessions] = useState<MilkSession[]>(cow.milking_sessions ?? []);
  const [savingSchedule, setSavingSchedule] = useState(false);

  async function saveSchedule(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSavingSchedule(true);
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.sales.milkCowSchedules, {
        method: "PUT",
        body: {
          records: [
            {
              cow_id: cow.cow_id,
              gives_milk: givesMilk,
              milking_sessions: givesMilk ? sessions : [],
            },
          ],
        },
      });
      onNotice(tr("Milking schedule saved.", "দোহন সময়সূচী সংরক্ষণ করা হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not save milking schedule.", "দোহন সময়সূচী সংরক্ষণ করা যায়নি।"));
    } finally {
      setSavingSchedule(false);
    }
  }

  const activeMilk = milkRecords.filter((m) => !m.is_archived && !m.is_void);
  const totalLiters = activeMilk.reduce((sum, row) => sum + Number(row.liters), 0);

  const healthCost = healthRecords
    .filter((h) => !h.is_archived)
    .reduce((sum, h) => sum + Number(h.cost ?? 0), 0);
  const breedingCost = breedingRecords
    .filter((b) => !b.is_archived)
    .reduce((sum, b) => sum + Number(b.cost ?? 0), 0);
  const directExpenseCost = expenses
    .filter((e) => !e.is_archived && !e.is_void)
    .reduce((sum, e) => sum + Number(e.amount ?? 0), 0);
  const feedingCost = feedingRecords
    .filter((f) => !f.is_archived)
    .reduce((sum, f) => sum + Number(f.cost ?? 0), 0);

  type CostLedgerRow = {
    id: string;
    date: string;
    kind: string;
    label: string;
    amount: number;
    note: string;
  };

  const costRows = useMemo<CostLedgerRow[]>(() => {
    const items: CostLedgerRow[] = [
      ...expenses
        .filter((e) => !e.is_archived && !e.is_void)
        .map((e) => ({
          id: `exp-${e.expense_id}`,
          date: e.expense_date,
          kind: tr("Expense", "খরচ"),
          label: e.category_name ?? tr("General expense", "সাধারণ খরচ"),
          amount: Number(e.amount ?? 0),
          note: e.description ?? "—",
        })),
      ...feedingRecords
        .filter((f) => !f.is_archived)
        .map((f) => ({
          id: `feed-${f.feeding_id}`,
          date: f.feeding_date,
          kind: tr("Feeding", "খাদ্য"),
          label: `${f.feed_name ?? tr("Feed", "খাদ্য")} (${num(f.quantity)} ${f.unit ?? ""})`.trim(),
          amount: Number(f.cost ?? 0),
          note: f.notes ?? "—",
        })),
      ...healthRecords
        .filter((h) => !h.is_archived && Number(h.cost ?? 0) > 0)
        .map((h) => ({
          id: `health-${h.health_id}`,
          date: h.record_date,
          kind: tr("Health"),
          label: enumLabel(h.record_type),
          amount: Number(h.cost ?? 0),
          note: h.details ?? h.vet_name ?? "—",
        })),
      ...breedingRecords
        .filter((b) => !b.is_archived && Number(b.cost ?? 0) > 0)
        .map((b) => ({
          id: `breed-${b.breeding_id}`,
          date: b.seed_date,
          kind: tr("Breeding"),
          label: enumLabel(b.method),
          amount: Number(b.cost ?? 0),
          note: b.semen_code ?? b.doctor_name ?? "—",
        })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, feedingRecords, healthRecords, breedingRecords, tr, num, enumLabel]);

  const milkColumns: PaginatedColumn<MilkRecord>[] = [
    { key: "production_date", label: tr("Date"), render: (r) => fmtDate(r.production_date) },
    { key: "session", label: tr("Session"), render: (r) => enumLabel(r.session) },
    {
      key: "liters",
      label: tr("Est. liters", "আনুমানিক লিটার"),
      align: "right",
      render: (r) => <span className="font-semibold tabular-nums">{num(r.liters)} {tr("L", "লিটার")}</span>,
    },
    {
      key: "status",
      label: tr("Status"),
      render: (r) => (
        <Badge tone={r.is_void ? "bad" : "good"}>{r.is_void ? tr("Voided") : tr("Recorded", "রেকর্ডকৃত")}</Badge>
      ),
    },
  ];

  const costColumns: PaginatedColumn<CostLedgerRow>[] = [
    { key: "date", label: tr("Date"), render: (r) => fmtDate(r.date) },
    { key: "kind", label: tr("Module", "খাত"), render: (r) => <Badge tone="neutral">{r.kind}</Badge> },
    { key: "label", label: tr("Item"), render: (r) => <span>{r.label}</span> },
    { key: "amount", label: tr("Amount", "পরিমাণ"), align: "right", render: (r) => money(r.amount) },
    { key: "note", label: tr("Notes"), render: (r) => <span className="text-muted">{r.note}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
        <PaginatedTableCard
          title={tr("Milk production log", "দুধ উৎপাদনের লগ")}
          subtitle={`${tr("Group-averaged per-cow estimates", "দলগত গড় হিসাব অনুযায়ী গরু প্রতি আনুমানিক")} · ${tr("Total active:", "মোট সক্রিয়:")} ${num(totalLiters)} ${tr("L", "লিটার")}`}
          rows={milkRecords}
          rowKey={(r) => r.milk_id}
          columns={milkColumns}
          emptyMessage={tr("No milk production records for this cow.", "এই গরুর দুধ উৎপাদনের কোনো রেকর্ড নেই।")}
          defaultPageSize={10}
          scrollHeightClass="max-h-[240px]"
        />

        <form
          onSubmit={(event) => void saveSchedule(event)}
          className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
        >
          <div>
            <h3 className="text-[14px] font-semibold text-ink">{tr("Milking schedule", "দোহন সময়সূচী")}</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              {tr("Controls whether this cow appears in daily milking session rosters.", "দৈনিক দুধ দোহনের তালিকায় এই গরু থাকবে কিনা তা নির্ধারণ করে।")}
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
            <input
              type="checkbox"
              checked={givesMilk}
              onChange={(e) => setGivesMilk(e.target.checked)}
            />
            {tr("Currently giving milk", "বর্তমানে দুধ দিচ্ছে")}
          </label>
          {givesMilk ? (
            <div className="flex flex-wrap gap-2">
              {SESSIONS.map((s) => {
                const checked = sessions.includes(s);
                return (
                  <label
                    key={s}
                    className={`flex cursor-pointer items-center gap-1.5 rounded-[5px] border px-2.5 py-1.5 text-[12.5px] ${
                      checked ? "border-accent bg-accent-soft text-accent font-medium" : "border-line bg-subtle text-muted"
                    }`}
                  >
                    <input
                      type="checkbox"
                      checked={checked}
                      onChange={(e) =>
                        setSessions((prev) =>
                          e.target.checked
                            ? [...new Set([...prev, s])]
                            : prev.filter((item) => item !== s)
                        )
                      }
                    />
                    {enumLabel(s)}
                  </label>
                );
              })}
            </div>
          ) : null}
          <button type="submit" disabled={savingSchedule} className={btn("primary", "md")}>
            {savingSchedule ? tr("Saving…") : tr("Save schedule", "সময়সূচী সংরক্ষণ করুন")}
          </button>
        </form>
      </div>

      <PaginatedTableCard
        title={tr("Direct expenses & cow-linked costs", "সরাসরি খরচ ও গরু-সংশ্লিষ্ট ব্যয়")}
        subtitle={`${tr("Health")} (${money(healthCost)}) · ${tr("Breeding")} (${money(breedingCost)}) · ${tr("Expenses")} (${money(directExpenseCost)}) · ${tr("Feeding", "খাদ্য")} (${money(feedingCost)})`}
        rows={costRows}
        rowKey={(r) => r.id}
        columns={costColumns}
        emptyMessage={tr("No direct cow-linked costs recorded yet.", "এখনও কোনো সরাসরি খরচের রেকর্ড নেই।")}
        defaultPageSize={10}
        scrollHeightClass="max-h-[260px]"
      />
    </div>
  );
}
