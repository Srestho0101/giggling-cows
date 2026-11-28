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
    if (!summary) return "Open";
    if (summary.state === "pregnant") {
      return `Pregnant${summary.days_pregnant != null ? ` · Day ${summary.days_pregnant}` : ""}${
        summary.expected_calving_date ? ` · Due ${formatDisplayDate(summary.expected_calving_date)}` : ""
      }`;
    }
    if (summary.state === "suspected_pregnant") {
      return `Suspected pregnant${
        summary.expected_calving_date ? ` · Due ${formatDisplayDate(summary.expected_calving_date)}` : ""
      }`;
    }
    if (summary.state === "bred") {
      const days = summary.days_since_breeding ?? 0;
      const checkDueIn = Math.max(0, 30 - days);
      return `Bred (${days}d ago)${checkDueIn > 0 ? ` · Check due in ${checkDueIn}d` : " · Check due now"}`;
    }
    if (summary.state === "vwp") {
      return `Post-calving VWP${
        summary.next_breeding_eligible_date ? ` until ${formatDisplayDate(summary.next_breeding_eligible_date)}` : ""
      }`;
    }
    return "Open";
  })();

  function requestArchiveBreeding(rec: BreedingRecord) {
    setConfirmModal({
      title: rec.is_archived ? "Restore breeding record?" : "Archive breeding record?",
      mode: "confirm",
      confirmLabel: rec.is_archived ? "Restore" : "Archive",
      tone: rec.is_archived ? "primary" : "danger",
      onConfirm: async () => {
        await apiRequest(apiRoutes.health.breedingRecord(rec.breeding_id), {
          method: "PATCH",
          body: { is_archived: !rec.is_archived },
        });
        onNotice(rec.is_archived ? "Breeding record restored." : "Breeding record archived.");
        await reload();
      },
    });
  }

  function requestArchiveCheck(rep: PregnancyReport) {
    setConfirmModal({
      title: rep.is_archived ? "Restore pregnancy check?" : "Archive pregnancy check?",
      mode: "confirm",
      confirmLabel: rep.is_archived ? "Restore" : "Archive",
      tone: rep.is_archived ? "primary" : "danger",
      onConfirm: async () => {
        await apiRequest(apiRoutes.health.pregnancyReport(rep.pregnancy_id), {
          method: "PATCH",
          body: { is_archived: !rep.is_archived },
        });
        onNotice(rep.is_archived ? "Pregnancy check restored." : "Pregnancy check archived.");
        await reload();
      },
    });
  }

  function requestAbortPregnancy(ep: PregnancyEpisode) {
    setConfirmModal({
      title: `Mark pregnancy as aborted for ${cow.current_tag_number}?`,
      description: "Closes the active pregnancy episode, clears calving alerts, and returns the cow to Open.",
      mode: "reason",
      confirmLabel: "Confirm abortion",
      tone: "danger",
      onConfirm: async (reason) => {
        await apiRequest(apiRoutes.health.pregnancyEpisode(ep.pregnancy_id), {
          method: "PATCH",
          body: { status: "aborted", ended_at: today, notes: reason || ep.notes || null },
        });
        onNotice("Pregnancy marked as aborted and cow returned to Open.");
        await reload();
      },
    });
  }

  const breedingColumns: PaginatedColumn<BreedingRecord>[] = [
    { key: "seed_date", label: "Insemination", render: (r) => formatDisplayDate(r.seed_date) },
    { key: "heat_date", label: "Heat", render: (r) => formatDisplayDate(r.heat_date) },
    {
      key: "source",
      label: "Sire / Semen",
      render: (r) => r.sire_display_name || (r.sire_tag_number ? `Sire ${r.sire_tag_number}` : r.semen_code || "—"),
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
    {
      key: "actions",
      label: "Actions",
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
            Edit
          </button>
          <button
            type="button"
            onClick={() => requestArchiveBreeding(r)}
            className="font-medium text-muted hover:underline"
          >
            {r.is_archived ? "Restore" : "Archive"}
          </button>
          <SafeDataHistory entityType="breeding_records" entityId={r.breeding_id} entityLabel={`Breeding ${r.seed_date}`} />
        </div>
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
    {
      key: "actions",
      label: "Actions",
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
            Edit
          </button>
          <button
            type="button"
            onClick={() => requestArchiveCheck(r)}
            className="font-medium text-muted hover:underline"
          >
            {r.is_archived ? "Restore" : "Archive"}
          </button>
          <SafeDataHistory entityType="pregnancy_reports" entityId={r.pregnancy_id} entityLabel={`Check ${r.report_date}`} />
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
          <p className="text-[11.5px] font-medium uppercase tracking-wider text-muted">Reproductive status</p>
          <h3 className="mt-0.5 text-[15px] font-semibold text-ink">{stateLabel}</h3>
          {activeEpisode?.dry_off_date ? (
            <p className="mt-0.5 text-[12px] text-muted">
              Dry-off target: {formatDisplayDate(activeEpisode.dry_off_date)}
              {activeEpisode.sire_display_name ? ` · Sire: ${activeEpisode.sire_display_name}` : ""}
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
                Record calving
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCheck(null);
                  setCheckModalOpen(true);
                }}
                className={btn("secondary", "sm")}
              >
                Log check
              </button>
              <button
                type="button"
                onClick={() => requestAbortPregnancy(activeEpisode)}
                className={btn("danger", "sm")}
              >
                Mark aborted
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
                Log pregnancy check
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingBreeding(null);
                  setBreedingModalOpen(true);
                }}
                className={btn("secondary", "sm")}
              >
                Log repeat breeding
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
                Log breeding
              </button>
              <button
                type="button"
                onClick={() => {
                  setEditingCheck(null);
                  setCheckModalOpen(true);
                }}
                className={btn("secondary", "sm")}
              >
                Log check / Bought pregnant
              </button>
            </>
          )}
        </div>
      </section>

      {/* Grouped Reproductive Cycles */}
      {activeEpisodes.length > 0 ? (
        <section className="space-y-3">
          <h3 className="text-[13px] font-semibold text-ink">Pregnancy &amp; calving cycles ({activeEpisodes.length})</h3>
          <div className="space-y-3">
            {activeEpisodes.map((ep, idx) => (
              <div key={ep.pregnancy_id} className="rounded-[8px] border border-line bg-surface p-4 space-y-2.5">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-[13px] font-semibold text-ink">
                      Cycle #{activeEpisodes.length - idx}
                    </span>
                    <Badge tone={statusTone(ep.status)}>
                      <span className="capitalize">{ep.status}</span>
                    </Badge>
                    {ep.breeding_seed_date ? (
                      <span className="text-[12px] text-muted">
                        Bred {formatDisplayDate(ep.breeding_seed_date)}
                      </span>
                    ) : (
                      <span className="text-[12px] text-muted">External / bought pregnant</span>
                    )}
                    {ep.sire_display_name ? (
                      <span className="text-[12px] text-muted">· {ep.sire_display_name}</span>
                    ) : null}
                  </div>
                  <div className="text-[12px] text-muted">
                    {ep.expected_calving_date ? `Due: ${formatDisplayDate(ep.expected_calving_date)}` : ""}
                    {ep.ended_at ? ` · Ended: ${formatDisplayDate(ep.ended_at)}` : ""}
                  </div>
                </div>

                {ep.checks.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 text-[11.5px]">
                    {ep.checks.map((chk) => (
                      <span key={chk.pregnancy_id} className="rounded-[4px] border border-line bg-subtle px-2 py-0.5 text-ink">
                        Check {formatDisplayDate(chk.report_date)}: <strong className="capitalize">{chk.status}</strong>
                      </span>
                    ))}
                  </div>
                ) : null}

                {ep.calving_event ? (
                  <div className="rounded-[6px] border border-line bg-subtle p-2.5 text-[12px] flex flex-wrap items-center justify-between gap-2">
                    <span>
                      Calved on <strong>{formatDisplayDate(ep.calving_event.calving_date)}</strong> (
                      <span className="capitalize">{ep.calving_event.calving_ease.replaceAll("_", " ")}</span> ·{" "}
                      {ep.calving_event.live_count} live, {ep.calving_event.stillborn_count} stillborn)
                    </span>
                    {ep.calving_event.calves.length > 0 ? (
                      <span className="flex flex-wrap gap-1.5">
                        {ep.calving_event.calves.map((calf) => (
                          <Link
                            key={calf.cow_id}
                            href={`/herd/${calf.cow_id}`}
                            className="rounded-[4px] border border-accent/40 bg-surface px-2 py-0.5 font-medium text-accent hover:underline"
                          >
                            Calf {calf.current_tag_number} ({calf.sex})
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
        title="Breeding history"
        rows={activeBreedings}
        rowKey={(r) => r.breeding_id}
        columns={breedingColumns}
        emptyMessage="No breeding records for this cow."
        defaultPageSize={10}
        scrollHeightClass="max-h-[260px]"
      />

      <PaginatedTableCard
        title="Pregnancy checks"
        rows={activeChecks}
        rowKey={(r) => r.pregnancy_id}
        columns={pregnancyColumns}
        emptyMessage="No pregnancy checks recorded."
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
