"use client";

import React, { useMemo, useState } from "react";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { PaginatedTableCard, type PaginatedColumn } from "@/components/paginated-scroll-table";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, Segmented, statusTone, ui } from "@/components/ui";
import { shiftIsoDate, todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import {
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
  type MilkSession,
  type PregnancyReport,
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
      onNotice("Health record saved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save health record.");
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
      title: "Archive this health record?",
      mode: "confirm",
      confirmLabel: "Archive",
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
      onNotice(archive ? "Health record archived." : "Health record restored.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not update health record.");
    }
  }

  const columns: PaginatedColumn<HealthRecord>[] = [
    {
      key: "record_date",
      label: "Date",
      render: (row) => <span className="font-medium">{formatDisplayDate(row.record_date)}</span>,
    },
    {
      key: "record_type",
      label: "Type",
      render: (row) => <span className="capitalize">{row.record_type}</span>,
    },
    {
      key: "vet_name",
      label: "Vet",
      render: (row) => row.vet_name || "—",
    },
    {
      key: "cost",
      label: "Cost",
      align: "right",
      render: (row) => formatMoney(row.cost),
    },
    {
      key: "next_due_date",
      label: "Next due",
      render: (row) => {
        if (!row.next_due_date) return "—";
        const overdue = row.next_due_date < today;
        return (
          <Badge tone={overdue ? "bad" : row.next_due_date <= dueLimit ? "warn" : "neutral"}>
            {formatDisplayDate(row.next_due_date)}
          </Badge>
        );
      },
    },
    {
      key: "details",
      label: "Details",
      render: (row) => <span className="text-muted">{row.details || "—"}</span>,
    },
    {
      key: "actions",
      label: "Actions",
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2.5 text-[12px]">
          <button
            type="button"
            onClick={() => void toggleArchive(row)}
            className="cursor-pointer font-medium text-accent hover:underline"
          >
            {row.is_archived ? "Restore" : "Archive"}
          </button>
          <SafeDataHistory
            entityType="health_records"
            entityId={row.health_id}
            entityLabel={`${row.record_type} · ${formatDisplayDate(row.record_date)}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="space-y-4">
      <section className="rounded-[8px] border border-line bg-surface p-4">
        <h3 className="text-[13px] font-semibold text-ink">Due & upcoming care (next 14 days)</h3>
        {upcoming.length ? (
          <div className="mt-2.5 flex flex-wrap gap-2">
            {upcoming.map((row) => {
              const overdue = String(row.next_due_date) < today;
              return (
                <Badge key={row.health_id} tone={overdue ? "bad" : "warn"}>
                  <span className="capitalize">{row.record_type}</span> ·{" "}
                  {overdue ? "overdue" : "due"} {formatDisplayDate(row.next_due_date)}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="mt-1.5 text-[12.5px] text-muted">No upcoming care due within 14 days.</p>
        )}
      </section>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
        <PaginatedTableCard
          title="Health records"
          subtitle="Vaccinations, treatments, deworming, and checkups."
          rows={visible}
          rowKey={(row) => row.health_id}
          columns={columns}
          emptyMessage="No health records logged for this cow."
          defaultPageSize={10}
          scrollHeightClass="max-h-[260px]"
          headerActions={
            <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
              <input
                type="checkbox"
                checked={showArchived}
                onChange={(e) => setShowArchived(e.target.checked)}
              />
              Show archived
            </label>
          }
        />

        <form
          onSubmit={(event) => void handleSubmit(event)}
          className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
        >
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Log health care</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              Add a treatment, vaccination, deworming, or vet checkup for this cow.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={ui.label}>
              Type *
              <select
                value={recordType}
                onChange={(e) => setRecordType(e.target.value)}
                className={ui.select}
              >
                <option value="vaccination">Vaccination</option>
                <option value="deworming">Deworming</option>
                <option value="treatment">Treatment</option>
                <option value="checkup">Checkup</option>
              </select>
            </label>
            <label className={ui.label}>
              Date *
              <input
                type="date"
                required
                value={recordDate}
                onChange={(e) => setRecordDate(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              Vet name
              <input
                maxLength={100}
                value={vetName}
                onChange={(e) => setVetName(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={ui.label}>
              Cost (৳)
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
              Next due date
              <input
                type="date"
                value={nextDueDate}
                onChange={(e) => setNextDueDate(e.target.value)}
                className={ui.input}
              />
            </label>
            <label className={`${ui.label} sm:col-span-2`}>
              Details
              <textarea
                rows={2}
                value={details}
                onChange={(e) => setDetails(e.target.value)}
                className={ui.textarea}
              />
            </label>
          </div>
          <button type="submit" disabled={saving} className={btn("primary", "md")}>
            {saving ? "Saving…" : "Save health record"}
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
  cows,
  reload,
  onError,
  onNotice,
}: {
  cow: CowDetail;
  breedingRecords: BreedingRecord[];
  pregnancyReports: PregnancyReport[];
  cows: CowListOption[];
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const today = todayInDhaka();
  const [sourceMode, setSourceMode] = useState<"semen" | "sire">("semen");
  const [heatDate, setHeatDate] = useState("");
  const [seedDate, setSeedDate] = useState(today);
  const [method, setMethod] = useState("artificial_insemination");
  const [sireId, setSireId] = useState("");
  const [semenCode, setSemenCode] = useState("");
  const [semenProvider, setSemenProvider] = useState("");
  const [doctorName, setDoctorName] = useState("");
  const [breedingCost, setBreedingCost] = useState("");
  const [breedingSaving, setBreedingSaving] = useState(false);

  const [reportDate, setReportDate] = useState(today);
  const [pregStatus, setPregStatus] = useState("confirmed");
  const [expectedCalving, setExpectedCalving] = useState("");
  const [actualCalving, setActualCalving] = useState("");
  const [pregNotes, setPregNotes] = useState("");
  const [pregSaving, setPregSaving] = useState(false);
  const [resolvingId, setResolvingId] = useState<string | null>(null);
  const [resolveDate, setResolveDate] = useState(today);
  const [resolveBusy, setResolveBusy] = useState(false);

  const activePregnancies = pregnancyReports.filter(
    (p) => !p.is_archived && (p.status === "confirmed" || p.status === "suspected") && !p.actual_calving_date
  );
  const maleSires = cows.filter((c) => c.cow_id !== cow.cow_id && c.sex === "male" && c.status === "active");

  async function resolvePregnancy(pregnancyId: string) {
    setResolveBusy(true);
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.health.pregnancyReport(pregnancyId), {
        method: "PATCH",
        body: {
          status: "calved",
          actual_calving_date: resolveDate || today,
        },
      });
      setResolvingId(null);
      onNotice("Pregnancy marked as calved and alerts resolved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not update pregnancy report.");
    } finally {
      setResolveBusy(false);
    }
  }

  async function submitBreeding(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    onNotice("");
    if (heatDate && seedDate && seedDate < heatDate) {
      onError("Insemination date cannot be earlier than heat date.");
      return;
    }
    if (sourceMode === "sire" && !sireId) {
      onError("Please select an on-farm sire.");
      return;
    }
    if (sourceMode === "semen" && !semenCode.trim()) {
      onError("Please enter a purchased semen code.");
      return;
    }
    setBreedingSaving(true);
    try {
      await apiRequest(apiRoutes.health.breeding, {
        method: "POST",
        body: {
          cow_id: cow.cow_id,
          heat_date: heatDate || null,
          seed_date: seedDate,
          method,
          sire_id: sourceMode === "sire" ? sireId || null : null,
          semen_code: sourceMode === "semen" ? semenCode.trim() || null : null,
          semen_provider: sourceMode === "semen" ? semenProvider.trim() || null : null,
          doctor_name: doctorName.trim() || null,
          cost: breedingCost !== "" ? Number(breedingCost) : 0,
        },
      });
      setHeatDate("");
      setSemenCode("");
      setSemenProvider("");
      setSireId("");
      setDoctorName("");
      setBreedingCost("");
      onNotice("Breeding record saved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save breeding record.");
    } finally {
      setBreedingSaving(false);
    }
  }

  async function submitPregnancy(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    onNotice("");
    if (
      reportDate &&
      expectedCalving &&
      !actualCalving &&
      (pregStatus === "confirmed" || pregStatus === "suspected") &&
      expectedCalving < reportDate
    ) {
      onError("Expected calving date cannot be earlier than check date.");
      return;
    }
    setPregSaving(true);
    try {
      await apiRequest(apiRoutes.health.pregnancy, {
        method: "POST",
        body: {
          cow_id: cow.cow_id,
          report_date: reportDate,
          status: pregStatus,
          expected_calving_date: expectedCalving || null,
          actual_calving_date: actualCalving || null,
          notes: pregNotes.trim() || null,
        },
      });
      setExpectedCalving("");
      setActualCalving("");
      setPregNotes("");
      onNotice("Pregnancy report saved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save pregnancy report.");
    } finally {
      setPregSaving(false);
    }
  }

  const breedingColumns: PaginatedColumn<BreedingRecord>[] = [
    { key: "seed_date", label: "Insemination", render: (r) => formatDisplayDate(r.seed_date) },
    { key: "heat_date", label: "Heat", render: (r) => formatDisplayDate(r.heat_date) },
    {
      key: "source",
      label: "Source",
      render: (r) => r.sire_tag_number ? `Sire ${r.sire_tag_number}` : r.semen_code || "—",
    },
    { key: "doctor_name", label: "Doctor", render: (r) => r.doctor_name || "—" },
    { key: "cost", label: "Cost", align: "right", render: (r) => formatMoney(r.cost) },
    {
      key: "outcome",
      label: "Outcome",
      render: (r) => (
        <Badge tone={statusTone(r.outcome)}>
          <span className="capitalize">{r.outcome}</span>
        </Badge>
      ),
    },
  ];

  const pregnancyColumns: PaginatedColumn<PregnancyReport>[] = [
    { key: "report_date", label: "Check date", render: (r) => formatDisplayDate(r.report_date) },
    {
      key: "status",
      label: "Result",
      render: (r) => (
        <Badge tone={statusTone(r.status)}>
          <span className="capitalize">{r.status}</span>
        </Badge>
      ),
    },
    {
      key: "expected_calving_date",
      label: "Expected calving",
      render: (r) => formatDisplayDate(r.expected_calving_date),
    },
    {
      key: "actual_calving_date",
      label: "Actual calving",
      render: (r) => formatDisplayDate(r.actual_calving_date),
    },
    { key: "notes", label: "Notes", render: (r) => <span className="text-muted">{r.notes || "—"}</span> },
  ];

  return (
    <div className="space-y-5">
      {activePregnancies.length > 0 ? (
        <section className="rounded-[8px] border border-accent/35 bg-accent-soft p-4 space-y-2.5">
          <h3 className="text-[13px] font-semibold text-accent">Active pregnancy tracking</h3>
          <div className="space-y-2 text-[13px] text-ink">
            {activePregnancies.map((item) => (
              <div key={item.pregnancy_id} className="flex flex-wrap items-center justify-between gap-3">
                <span>
                  <strong className="capitalize">{item.status}</strong> (checked {formatDisplayDate(item.report_date)})
                  {item.expected_calving_date
                    ? ` · Expected calving: ${formatDisplayDate(item.expected_calving_date)}`
                    : ""}
                </span>
                {resolvingId === item.pregnancy_id ? (
                  <div className="flex flex-wrap items-center gap-2">
                    <input
                      type="date"
                      max={today}
                      value={resolveDate}
                      onChange={(e) => setResolveDate(e.target.value)}
                      className={`${ui.input} !h-8 w-auto`}
                    />
                    <button
                      type="button"
                      disabled={resolveBusy}
                      onClick={() => void resolvePregnancy(item.pregnancy_id)}
                      className={btn("primary", "sm")}
                    >
                      {resolveBusy ? "Saving…" : "Confirm calving"}
                    </button>
                    <button
                      type="button"
                      disabled={resolveBusy}
                      onClick={() => setResolvingId(null)}
                      className={btn("secondary", "sm")}
                    >
                      Cancel
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setResolvingId(item.pregnancy_id);
                      setResolveDate(today);
                    }}
                    className={btn("secondary", "sm")}
                  >
                    Record calving / Mark resolved
                  </button>
                )}
              </div>
            ))}
          </div>
        </section>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
        <PaginatedTableCard
          title="Breeding history"
          rows={breedingRecords.filter((r) => !r.is_archived)}
          rowKey={(r) => r.breeding_id}
          columns={breedingColumns}
          emptyMessage="No breeding records for this cow."
          defaultPageSize={10}
          scrollHeightClass="max-h-[240px]"
        />

        <form
          onSubmit={(event) => void submitBreeding(event)}
          className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
        >
          <h3 className="text-[14px] font-semibold text-ink">Log breeding</h3>
          {cow.sex === "male" ? (
            <p className="text-[12px] text-muted">
              This animal is male; breeding records normally apply to female cows.
            </p>
          ) : null}
          <div>
            <span className="mb-1.5 block text-[12px] font-medium text-muted">Breeding source</span>
            <Segmented
              name="breeding_source"
              size="sm"
              value={sourceMode}
              onChange={setSourceMode}
              options={[
                { value: "semen", label: "Purchased semen" },
                { value: "sire", label: "On-farm sire" },
              ]}
            />
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={ui.label}>
              Heat date
              <input type="date" value={heatDate} onChange={(e) => setHeatDate(e.target.value)} className={ui.input} />
            </label>
            <label className={ui.label}>
              Insemination date *
              <input type="date" required value={seedDate} onChange={(e) => setSeedDate(e.target.value)} className={ui.input} />
            </label>
            <label className={`${ui.label} sm:col-span-2`}>
              Method *
              <select value={method} onChange={(e) => setMethod(e.target.value)} className={ui.select}>
                <option value="artificial_insemination">Artificial insemination</option>
                <option value="natural">Natural</option>
              </select>
            </label>
            {sourceMode === "sire" ? (
              <label className={ui.label}>
                On-farm sire *
                <select required value={sireId} onChange={(e) => setSireId(e.target.value)} className={ui.select}>
                  <option value="">Choose sire</option>
                  {maleSires.map((s) => (
                    <option key={s.cow_id} value={s.cow_id}>
                      {s.current_tag_number}
                    </option>
                  ))}
                </select>
              </label>
            ) : (
              <>
                <label className={ui.label}>
                  Semen code *
                  <input required value={semenCode} onChange={(e) => setSemenCode(e.target.value)} className={ui.input} />
                </label>
                <label className={ui.label}>
                  Semen provider
                  <input value={semenProvider} onChange={(e) => setSemenProvider(e.target.value)} className={ui.input} />
                </label>
              </>
            )}
            <label className={ui.label}>
              Doctor
              <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={ui.input} />
            </label>
            <label className={ui.label}>
              Cost (৳)
              <input type="number" min="0" step="0.01" value={breedingCost} onChange={(e) => setBreedingCost(e.target.value)} className={ui.input} />
            </label>
          </div>
          <button type="submit" disabled={breedingSaving} className={btn("primary", "md")}>
            {breedingSaving ? "Saving…" : "Save breeding"}
          </button>
        </form>
      </div>

      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
        <PaginatedTableCard
          title="Pregnancy checks"
          rows={pregnancyReports.filter((r) => !r.is_archived)}
          rowKey={(r) => r.pregnancy_id}
          columns={pregnancyColumns}
          emptyMessage="No pregnancy checks recorded."
          defaultPageSize={10}
          scrollHeightClass="max-h-[240px]"
        />

        <form
          onSubmit={(event) => void submitPregnancy(event)}
          className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
        >
          <h3 className="text-[14px] font-semibold text-ink">Log pregnancy check</h3>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className={ui.label}>
              Report date *
              <input type="date" required value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={ui.input} />
            </label>
            <label className={ui.label}>
              Result *
              <select value={pregStatus} onChange={(e) => setPregStatus(e.target.value)} className={ui.select}>
                <option value="confirmed">Confirmed</option>
                <option value="suspected">Suspected</option>
                <option value="failed">Not pregnant / failed</option>
                <option value="calved">Calved</option>
                <option value="aborted">Aborted</option>
              </select>
            </label>
            <label className={ui.label}>
              Expected calving
              <input type="date" value={expectedCalving} onChange={(e) => setExpectedCalving(e.target.value)} className={ui.input} />
            </label>
            <label className={ui.label}>
              Actual calving
              <input type="date" value={actualCalving} onChange={(e) => setActualCalving(e.target.value)} className={ui.input} />
            </label>
            <label className={`${ui.label} sm:col-span-2`}>
              Notes
              <textarea rows={2} value={pregNotes} onChange={(e) => setPregNotes(e.target.value)} className={ui.textarea} />
            </label>
          </div>
          <button type="submit" disabled={pregSaving} className={btn("primary", "md")}>
            {pregSaving ? "Saving…" : "Save pregnancy check"}
          </button>
        </form>
      </div>
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
      onNotice("Milking schedule saved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save milking schedule.");
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
          kind: "Expense",
          label: e.category_name ?? "General expense",
          amount: Number(e.amount ?? 0),
          note: e.description ?? "—",
        })),
      ...feedingRecords
        .filter((f) => !f.is_archived)
        .map((f) => ({
          id: `feed-${f.feeding_id}`,
          date: f.feeding_date,
          kind: "Feeding",
          label: `${f.feed_name ?? "Feed"} (${formatNumber(f.quantity)} ${f.unit ?? ""})`.trim(),
          amount: Number(f.cost ?? 0),
          note: f.notes ?? "—",
        })),
      ...healthRecords
        .filter((h) => !h.is_archived && Number(h.cost ?? 0) > 0)
        .map((h) => ({
          id: `health-${h.health_id}`,
          date: h.record_date,
          kind: "Health",
          label: h.record_type,
          amount: Number(h.cost ?? 0),
          note: h.details ?? h.vet_name ?? "—",
        })),
      ...breedingRecords
        .filter((b) => !b.is_archived && Number(b.cost ?? 0) > 0)
        .map((b) => ({
          id: `breed-${b.breeding_id}`,
          date: b.seed_date,
          kind: "Breeding",
          label: b.method.replaceAll("_", " "),
          amount: Number(b.cost ?? 0),
          note: b.semen_code ?? b.doctor_name ?? "—",
        })),
    ];
    return items.sort((a, b) => b.date.localeCompare(a.date));
  }, [expenses, feedingRecords, healthRecords, breedingRecords]);

  const milkColumns: PaginatedColumn<MilkRecord>[] = [
    { key: "production_date", label: "Date", render: (r) => formatDisplayDate(r.production_date) },
    { key: "session", label: "Session", render: (r) => sessionLabel(r.session) },
    {
      key: "liters",
      label: "Est. liters",
      align: "right",
      render: (r) => <span className="font-semibold tabular-nums">{formatNumber(r.liters)} L</span>,
    },
    {
      key: "status",
      label: "Status",
      render: (r) => (
        <Badge tone={r.is_void ? "bad" : "good"}>{r.is_void ? "Voided" : "Recorded"}</Badge>
      ),
    },
  ];

  const costColumns: PaginatedColumn<CostLedgerRow>[] = [
    { key: "date", label: "Date", render: (r) => formatDisplayDate(r.date) },
    { key: "kind", label: "Module", render: (r) => <Badge tone="neutral">{r.kind}</Badge> },
    { key: "label", label: "Item", render: (r) => <span className="capitalize">{r.label}</span> },
    { key: "amount", label: "Amount", align: "right", render: (r) => formatMoney(r.amount) },
    { key: "note", label: "Notes", render: (r) => <span className="text-muted">{r.note}</span> },
  ];

  return (
    <div className="space-y-5">
      <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
        <PaginatedTableCard
          title="Milk production log"
          subtitle={`Group-averaged per-cow estimates · Total active: ${formatNumber(totalLiters)} L`}
          rows={milkRecords}
          rowKey={(r) => r.milk_id}
          columns={milkColumns}
          emptyMessage="No milk production records for this cow."
          defaultPageSize={10}
          scrollHeightClass="max-h-[240px]"
        />

        <form
          onSubmit={(event) => void saveSchedule(event)}
          className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
        >
          <div>
            <h3 className="text-[14px] font-semibold text-ink">Milking schedule</h3>
            <p className="mt-0.5 text-[12px] text-muted">
              Controls whether this cow appears in daily milking session rosters.
            </p>
          </div>
          <label className="flex cursor-pointer items-center gap-2 text-[13px] font-medium text-ink">
            <input
              type="checkbox"
              checked={givesMilk}
              onChange={(e) => setGivesMilk(e.target.checked)}
            />
            Currently giving milk
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
                    {sessionLabel(s)}
                  </label>
                );
              })}
            </div>
          ) : null}
          <button type="submit" disabled={savingSchedule} className={btn("primary", "md")}>
            {savingSchedule ? "Saving…" : "Save schedule"}
          </button>
        </form>
      </div>

      <PaginatedTableCard
        title="Direct expenses & cow-linked costs"
        subtitle={`Health (${formatMoney(healthCost)}) · Breeding (${formatMoney(breedingCost)}) · Expenses (${formatMoney(directExpenseCost)}) · Feeding (${formatMoney(feedingCost)})`}
        rows={costRows}
        rowKey={(r) => r.id}
        columns={costColumns}
        emptyMessage="No direct cow-linked costs recorded yet."
        defaultPageSize={10}
        scrollHeightClass="max-h-[260px]"
      />
    </div>
  );
}
