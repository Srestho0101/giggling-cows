"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { PaginatedTableCard, type PaginatedColumn } from "@/components/paginated-scroll-table";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, ui } from "@/components/ui";
import { todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import { WeightTrendChart } from "@/components/cow-profile/weight-chart";
import { useI18n } from "@/lib/i18n";
import {
  computeAgeFromBirthDate,
  daysBetween,
  type CowDetail,
  type WarehouseHistoryItem,
  type WarehouseOption,
  type WeightRecord,
} from "@/components/cow-profile/types";

type OverviewTabProps = {
  cow: CowDetail;
  warehouses: WarehouseOption[];
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function ProfileOverviewTab({
  cow,
  warehouses,
  reload,
  onError,
  onNotice,
}: OverviewTabProps) {
  const { tr, money, num, integer, date: fmtDate, enumLabel, daysOnFarm, age: fmtAge } = useI18n();
  const today = todayInDhaka();
  const computedAge = cow.age ?? computeAgeFromBirthDate(cow.birth_date, today);
  const milkingText = cow.gives_milk
    ? cow.milking_sessions?.length
      ? `${tr("Yes")} (${cow.milking_sessions.map((s) => enumLabel(s)).join(", ")})`
      : tr("Yes (no sessions set)", "হ্যাঁ (সেশন নির্ধারিত নেই)")
    : tr("No");

  return (
    <div className="space-y-6">
      {/* Structured Profile & Lineage Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[8px] border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink">{tr("Identity & classification", "পরিচয় ও শ্রেণিবিন্যাস")}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
            <FieldItem label={tr("Tag")} value={cow.current_tag_number} />
            <FieldItem label={tr("Category")} value={enumLabel(cow.category)} />
            <FieldItem label={tr("Cow type")} value={cow.cow_type ? enumLabel(cow.cow_type) : "—"} />
            <FieldItem label={tr("Sex")} value={enumLabel(cow.sex)} />
            <FieldItem label={tr("Breed")} value={cow.breed ? enumLabel(cow.breed) : "—"} />
            <FieldItem label={tr("Color")} value={cow.color?.trim() ? cow.color : "—"} />
            <FieldItem label={tr("Marking")} value={cow.marking?.trim() ? cow.marking : "—"} />
            <FieldItem label={tr("Birth date")} value={fmtDate(cow.birth_date)} />
            <FieldItem label={tr("Age")} value={fmtAge(computedAge)} />
            <FieldItem label={tr("Age group")} value={cow.age_group ? enumLabel(cow.age_group) : "—"} />
            <FieldItem label={tr("Milking")} value={milkingText} />
            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">{tr("Notes")}</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink">
                {cow.notes?.trim() ? cow.notes : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[8px] border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink">{tr("Acquisition & housing", "সংগ্রহ ও শেড তথ্য")}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
            <FieldItem label={tr("Acquisition")} value={enumLabel(cow.acquisition_type)} />
            <FieldItem label={tr("Acquired date", "সংগ্রহের তারিখ")} value={fmtDate(cow.acquisition_date)} />
            <FieldItem
              label={tr("Days on farm")}
              value={
                cow.acquisition_date
                  ? daysOnFarm(daysBetween(cow.acquisition_date, today) ?? 0)
                  : "—"
              }
            />
            <FieldItem
              label={tr("Supplier")}
              value={cow.acquisition_type === "born_on_farm" ? tr("Born on Farm") : cow.supplier_name ?? "—"}
            />
            <FieldItem label={tr("Purchase price", "ক্রয়মূল্য")} value={money(cow.purchase_price)} />
            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">{tr("Current shed", "বর্তমান শেড")}</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-ink">
                {cow.warehouse_name ?? tr("No shed", "কোনো শেড নেই")}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[8px] border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink">{tr("Family & lineage", "বংশতালিকা")}</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
            <div>
              <dt className="text-[11.5px] text-muted">{tr("Dam (Mother)", "মা")}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {cow.dam_id ? (
                  <Link href={`/herd/${cow.dam_id}`} className="text-accent hover:underline">
                    {cow.dam_tag ?? tr("View dam", "মা দেখুন")}
                  </Link>
                ) : (
                  cow.dam_tag ?? "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-muted">{tr("Sire (Father)", "বাবা")}</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {cow.sire_id ? (
                  <Link href={`/herd/${cow.sire_id}`} className="text-accent hover:underline">
                    {cow.sire_tag ?? cow.sire_display_name ?? tr("View sire", "বাবা দেখুন")}
                  </Link>
                ) : (
                  cow.sire_display_name ?? cow.sire_tag ?? "—"
                )}
              </dd>
            </div>

            {cow.pedigree &&
            (cow.pedigree.maternal_grand_dam ||
              cow.pedigree.maternal_grand_sire ||
              cow.pedigree.paternal_grand_dam ||
              cow.pedigree.paternal_grand_sire) ? (
              <div className="col-span-2 border-t border-line pt-2.5 text-[11.5px]">
                <dt className="text-muted">{tr("Grandparents (2-gen pedigree)", "দাদা-দাদি / নানা-নানি")}</dt>
                <dd className="mt-1 grid grid-cols-2 gap-2 text-ink">
                  <div>
                    <span className="text-muted">{tr("Maternal:", "মাতৃকুল:")} </span>
                    {cow.pedigree.maternal_grand_dam ? (
                      <Link href={`/herd/${cow.pedigree.maternal_grand_dam.cow_id}`} className="text-accent hover:underline">
                        {cow.pedigree.maternal_grand_dam.label}
                      </Link>
                    ) : "—"}
                    {" × "}
                    {cow.pedigree.maternal_grand_sire?.cow_id ? (
                      <Link href={`/herd/${cow.pedigree.maternal_grand_sire.cow_id}`} className="text-accent hover:underline">
                        {cow.pedigree.maternal_grand_sire.label}
                      </Link>
                    ) : (
                      cow.pedigree.maternal_grand_sire?.label ?? "—"
                    )}
                  </div>
                  <div>
                    <span className="text-muted">{tr("Paternal:", "পিতৃকুল:")} </span>
                    {cow.pedigree.paternal_grand_dam ? (
                      <Link href={`/herd/${cow.pedigree.paternal_grand_dam.cow_id}`} className="text-accent hover:underline">
                        {cow.pedigree.paternal_grand_dam.label}
                      </Link>
                    ) : "—"}
                    {" × "}
                    {cow.pedigree.paternal_grand_sire?.cow_id ? (
                      <Link href={`/herd/${cow.pedigree.paternal_grand_sire.cow_id}`} className="text-accent hover:underline">
                        {cow.pedigree.paternal_grand_sire.label}
                      </Link>
                    ) : (
                      cow.pedigree.paternal_grand_sire?.label ?? "—"
                    )}
                  </div>
                </dd>
              </div>
            ) : null}

            {cow.origin_context ? (
              <div className="col-span-2 border-t border-line pt-2.5 text-[11.5px] space-y-1">
                <dt className="text-muted">{tr("Origin & conception (derived)", "জন্ম ও গর্ভধারণ তথ্য")}</dt>
                <dd className="text-ink space-y-1">
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5">
                    {cow.origin_context.conception_method ? (
                      <span>
                        {tr("Method:", "পদ্ধতি:")} <strong>{enumLabel(cow.origin_context.conception_method)}</strong>
                      </span>
                    ) : null}
                    {cow.origin_context.insemination_date ? (
                      <span>{tr("Service:", "প্রজনন:")} <strong>{fmtDate(cow.origin_context.insemination_date)}</strong></span>
                    ) : null}
                    {cow.origin_context.gestation_days != null ? (
                      <span>{tr("Gestation:", "গর্ভকাল:")} <strong>{integer(cow.origin_context.gestation_days)} {tr("d", "দিন")}</strong></span>
                    ) : null}
                    <span>
                      {tr("Calving:", "প্রসব:")} <strong>{enumLabel(cow.origin_context.calving_ease)}</strong>
                    </span>
                    {cow.origin_context.birth_weight_kg != null ? (
                      <span>{tr("Birth wt:", "জন্ম ওজন:")} <strong>{num(cow.origin_context.birth_weight_kg)} {tr("kg", "কেজি")}</strong></span>
                    ) : null}
                  </div>
                  {cow.origin_context.littermates?.length ? (
                    <div>
                      <span className="text-muted">{tr("Twin / Littermate:", "যমজ বাছুর:")} </span>
                      {cow.origin_context.littermates.map((lm, i) => (
                        <React.Fragment key={lm.cow_id}>
                          {i > 0 ? ", " : ""}
                          <Link href={`/herd/${lm.cow_id}`} className="text-accent hover:underline font-medium">
                            {lm.current_tag_number}
                          </Link>
                        </React.Fragment>
                      ))}
                    </div>
                  ) : null}
                </dd>
              </div>
            ) : null}

            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">
                {tr("Offspring", "বাছুরসমূহ")} ({integer(cow.offspring?.length ?? 0)})
              </dt>
              <dd className="mt-1.5">
                {cow.offspring?.length ? (
                  <div className="flex max-h-28 flex-wrap gap-1.5 overflow-y-auto">
                    {cow.offspring.map((child) => (
                      <Link
                        key={child.cow_id}
                        href={`/herd/${child.cow_id}`}
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-line bg-subtle px-2 py-1 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        <span>{child.current_tag_number}</span>
                        <span className="text-[11px] text-muted">
                          ({enumLabel(child.sex)}
                          {child.birth_date ? ` · ${fmtDate(child.birth_date)}` : ""}
                          {child.other_parent_tag ? ` · × ${child.other_parent_tag}` : ""}
                          {child.status !== "active" ? ` · ${enumLabel(child.status)}` : ""})
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-[12.5px] text-muted">{tr("No recorded offspring.", "কোনো বাছুরের তথ্য নেই।")}</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

      {/* Sale & Buyer Record (shown when sold or sale info exists) */}
      {(cow.status === "sold" || cow.sale_record) ? (
        <SaleRecordSection
          cow={cow}
          today={today}
          reload={reload}
          onError={onError}
          onNotice={onNotice}
        />
      ) : null}

      {/* Weight History (Paginated + Scrollable) & Entry */}
      <WeightSection
        cowId={cow.cow_id}
        rows={cow.weight_records ?? []}
        today={today}
        reload={reload}
        onError={onError}
        onNotice={onNotice}
      />

      {/* Warehouse History (Paginated + Scrollable) & Move Cow */}
      <WarehouseSection
        cow={cow}
        warehouses={warehouses}
        today={today}
        reload={reload}
        onError={onError}
        onNotice={onNotice}
      />
    </div>
  );
}

function FieldItem({
  label,
  value,
  capitalize = false,
}: {
  label: string;
  value: string;
  capitalize?: boolean;
}) {
  return (
    <div>
      <dt className="text-[11.5px] text-muted">{label}</dt>
      <dd className={`mt-0.5 font-medium text-ink ${capitalize ? "capitalize" : ""}`}>{value}</dd>
    </div>
  );
}

function WeightSection({
  cowId,
  rows,
  today,
  reload,
  onError,
  onNotice,
}: {
  cowId: string;
  rows: WeightRecord[];
  today: string;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { tr, num, date: fmtDate } = useI18n();
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weighDate, setWeighDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [editing, setEditing] = useState<WeightRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editSaving, setEditSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const visibleRows = useMemo(
    () =>
      (showArchived ? rows : rows.filter((row) => !row.is_archived))
        .slice()
        .sort((a, b) => b.weigh_date.localeCompare(a.weigh_date)),
    [rows, showArchived]
  );

  // Delta compared to the previous active weight measurement chronologically
  const deltaById = useMemo(() => {
    const activeAsc = rows
      .filter((r) => !r.is_archived)
      .slice()
      .sort((a, b) => a.weigh_date.localeCompare(b.weigh_date));
    const map = new Map<string, number>();
    for (let i = 1; i < activeAsc.length; i += 1) {
      map.set(
        activeAsc[i].weight_id,
        Number(activeAsc[i].weight_kg) - Number(activeAsc[i - 1].weight_kg)
      );
    }
    return map;
  }, [rows]);

  async function handleLogWeight(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    onError("");
    onNotice("");
    if (weighDate > today) {
      onError(tr("Weigh date cannot be in the future.", "ওজন মাপার তারিখ ভবিষ্যতের হতে পারবে না।"));
      return;
    }
    setSaving(true);
    try {
      await apiRequest(apiRoutes.herd.weight(cowId), {
        method: "POST",
        body: { weigh_date: weighDate, weight_kg: Number(weightKg) },
      });
      setWeightKg("");
      onNotice(tr("Weight recorded.", "ওজন সংরক্ষণ করা হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not save weight record.", "ওজনের তথ্য সংরক্ষণ করা যায়নি।"));
    } finally {
      setSaving(false);
    }
  }

  async function handleEditSave(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!editing) return;
    onError("");
    onNotice("");
    if (editDate > today) {
      onError(tr("Weigh date cannot be in the future.", "ওজন মাপার তারিখ ভবিষ্যতের হতে পারবে না।"));
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(apiRoutes.herd.weightRecord(cowId, editing.weight_id), {
        method: "PATCH",
        body: { weigh_date: editDate, weight_kg: Number(editWeight) },
      });
      setEditing(null);
      onNotice(tr("Weight record updated.", "ওজনের তথ্য আপডেট হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not update weight record.", "ওজনের তথ্য আপডেট করা যায়নি।"));
    } finally {
      setEditSaving(false);
    }
  }

  function requestArchiveWeight(row: WeightRecord, archived: boolean) {
    if (!archived) {
      void applyArchiveWeight(row, false);
      return;
    }
    setConfirmModal({
      title: tr("Archive this weight record?", "এই ওজনের তথ্য আর্কাইভ করবেন?"),
      mode: "confirm",
      confirmLabel: tr("Archive"),
      tone: "danger",
      onConfirm: () => applyArchiveWeight(row, true),
    });
  }

  async function applyArchiveWeight(row: WeightRecord, archived: boolean) {
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.herd.weightRecord(cowId, row.weight_id), {
        method: "PATCH",
        body: { is_archived: archived },
      });
      onNotice(archived ? tr("Weight record archived.", "ওজনের তথ্য আর্কাইভ করা হয়েছে।") : tr("Weight record restored.", "ওজনের তথ্য পুনরুদ্ধার করা হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not update weight record.", "ওজনের তথ্য আপডেট করা যায়নি।"));
    }
  }

  const columns: PaginatedColumn<WeightRecord>[] = [
    {
      key: "weigh_date",
      label: tr("Date"),
      render: (row) => <span className="font-medium text-ink">{fmtDate(row.weigh_date)}</span>,
    },
    {
      key: "weight_kg",
      label: tr("Weight", "ওজন"),
      align: "right",
      render: (row) => <span className="font-semibold tabular-nums">{num(row.weight_kg)} {tr("kg", "কেজি")}</span>,
    },
    {
      key: "delta",
      label: tr("Change", "পরিবর্তন"),
      align: "right",
      render: (row) => {
        if (row.is_archived) return <span className="text-muted">—</span>;
        const delta = deltaById.get(row.weight_id);
        if (delta === undefined) return <span className="text-muted">—</span>;
        const toneClass = delta > 0 ? "text-accent" : delta < 0 ? "text-warn" : "text-muted";
        return (
          <span className={`font-medium tabular-nums ${toneClass}`}>
            {delta > 0 ? "+" : ""}
            {num(delta)} {tr("kg", "কেজি")}
          </span>
        );
      },
    },
    {
      key: "is_archived",
      label: tr("Status"),
      render: (row) => (
        <Badge tone={row.is_archived ? "neutral" : "good"}>
          {row.is_archived ? tr("Archived", "আর্কাইভড") : tr("Active")}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: tr("Actions"),
      align: "right",
      render: (row) => (
        <div className="flex items-center justify-end gap-2.5 text-[12px]">
          <button
            type="button"
            onClick={() => {
              setEditing(row);
              setEditDate(row.weigh_date);
              setEditWeight(String(row.weight_kg));
            }}
            className="cursor-pointer font-medium text-accent hover:underline"
          >
            {tr("Edit")}
          </button>
          <button
            type="button"
            onClick={() => requestArchiveWeight(row, !row.is_archived)}
            className="cursor-pointer font-medium text-muted hover:text-ink hover:underline"
          >
            {row.is_archived ? tr("Restore") : tr("Archive")}
          </button>
          <SafeDataHistory
            entityType="weight_records"
            entityId={row.weight_id}
            entityLabel={`${tr("Weight", "ওজন")} · ${fmtDate(row.weigh_date)}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
      <PaginatedTableCard
        title={tr("Weight history", "ওজনের ইতিহাস")}
        subtitle={tr("Newest weight logs appear first.", "সাম্প্রতিক ওজনের তথ্য সবার আগে দেখাচ্ছে।")}
        rows={visibleRows}
        rowKey={(row) => row.weight_id}
        columns={columns}
        emptyMessage={showArchived ? tr("No weight records yet.", "এখনও কোনো ওজনের তথ্য নেই।") : tr("No active weight records.", "কোনো সক্রিয় ওজনের তথ্য নেই।")}
        defaultPageSize={5}
        scrollHeightClass=""
        headerActions={
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            {tr("Show archived")}
          </label>
        }
        topContent={
          <div className="space-y-3">
            <WeightTrendChart records={rows} />
            {editing ? (
              <form
                onSubmit={(event) => void handleEditSave(event)}
                className="flex flex-wrap items-end gap-2.5 rounded-[6px] border border-accent/40 bg-surface p-3"
              >
                <div className="text-[12px] font-medium text-ink">
                  {tr("Correcting weight entry:", "ওজনের তথ্য সংশোধন:")}
                </div>
                <label className="text-[12px] text-muted">
                  {tr("Date")}
                  <input
                    type="date"
                    required
                    max={today}
                    value={editDate}
                    onChange={(e) => setEditDate(e.target.value)}
                    className={`${ui.input} mt-1 h-8 w-36`}
                  />
                </label>
                <label className="text-[12px] text-muted">
                  {tr("Weight (kg)", "ওজন (কেজি)")}
                  <input
                    type="number"
                    min="0.1"
                    step="0.01"
                    required
                    value={editWeight}
                    onChange={(e) => setEditWeight(e.target.value)}
                    className={`${ui.input} mt-1 h-8 w-28`}
                  />
                </label>
                <div className="flex items-center gap-1.5">
                  <button type="submit" disabled={editSaving} className={btn("primary", "sm")}>
                    {editSaving ? tr("Saving…") : tr("Update", "আপডেট করুন")}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className={btn("secondary", "sm")}
                  >
                    {tr("Cancel")}
                  </button>
                </div>
              </form>
            ) : null}
          </div>
        }
      />

      <form
        onSubmit={(event) => void handleLogWeight(event)}
        className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
      >
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{tr("Log a weight", "নতুন ওজন লিখুন")}</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {tr("Record a new weighing to track growth over time.", "সময়ের সাথে গরুর বৃদ্ধি দেখতে নতুন ওজন লিখুন।")}
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            {tr("Date")} *
            <input
              type="date"
              required
              max={today}
              value={weighDate}
              onChange={(e) => setWeighDate(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            {tr("Weight (kg)", "ওজন (কেজি)")} *
            <input
              type="number"
              min="0.1"
              step="0.01"
              required
              placeholder={tr("e.g. 425.5", "যেমন: ৪২৫.৫")}
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className={ui.input}
            />
          </label>
        </div>
        <button type="submit" disabled={saving} className={btn("primary", "md")}>
          {saving ? tr("Saving…") : tr("Save weight", "ওজন সংরক্ষণ করুন")}
        </button>
      </form>
      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
}

function WarehouseSection({
  cow,
  warehouses,
  today,
  reload,
  onError,
  onNotice,
}: {
  cow: CowDetail;
  warehouses: WarehouseOption[];
  today: string;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { tr, integer, date: fmtDate } = useI18n();
  const [saving, setSaving] = useState(false);
  const [warehouseId, setWarehouseId] = useState("");
  const [moveDate, setMoveDate] = useState(today);
  const [reason, setReason] = useState("");

  async function handleMove(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!warehouseId) return;
    setSaving(true);
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.herd.move(cow.cow_id), {
        method: "POST",
        body: {
          warehouse_id: warehouseId,
          moved_in_date: moveDate,
          reason: reason.trim() || null,
        },
      });
      setWarehouseId("");
      setReason("");
      onNotice(tr("Shed move saved.", "শেড পরিবর্তন সংরক্ষিত হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not save shed move.", "শেড পরিবর্তন সংরক্ষণ করা যায়নি।"));
    } finally {
      setSaving(false);
    }
  }

  const columns: PaginatedColumn<WarehouseHistoryItem>[] = [
    {
      key: "warehouse_name",
      label: tr("Shed"),
      render: (row) => <span className="font-medium text-ink">{row.warehouse_name ?? "—"}</span>,
    },
    {
      key: "moved_in_date",
      label: tr("Moved in", "প্রবেশের তারিখ"),
      render: (row) => fmtDate(row.moved_in_date),
    },
    {
      key: "moved_out_date",
      label: tr("Moved out", "স্থানান্তরের তারিখ"),
      render: (row) =>
        row.moved_out_date ? (
          fmtDate(row.moved_out_date)
        ) : (
          <Badge tone="good">{tr("Current", "বর্তমান")}</Badge>
        ),
    },
    {
      key: "duration",
      label: tr("Stay", "অবস্থান"),
      align: "right",
      render: (row) => {
        const end = row.moved_out_date ?? today;
        const days = daysBetween(row.moved_in_date, end);
        return days !== null && days >= 0 ? `${integer(days)} ${tr("d", "দিন")}` : "—";
      },
    },
    {
      key: "reason",
      label: tr("Reason", "কারণ"),
      render: (row) => <span className="text-muted">{row.reason || "—"}</span>,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
      <PaginatedTableCard
        title={tr("Shed history", "শেডের ইতিহাস")}
        subtitle={tr("Housing transfers and current shed assignment.", "শেড স্থানান্তর ও বর্তমান শেডের তথ্য।")}
        rows={cow.warehouse_history ?? []}
        rowKey={(row) => row.movement_id}
        columns={columns}
        emptyMessage={tr("No shed movements recorded.", "শেড পরিবর্তনের কোনো তথ্য নেই।")}
        defaultPageSize={10}
        scrollHeightClass="max-h-[240px]"
      />

      <form
        onSubmit={(event) => void handleMove(event)}
        className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
      >
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{tr("Move cow", "শেড পরিবর্তন করুন")}</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            {tr("Current shed:", "বর্তমান শেড:")} <strong className="text-ink">{cow.warehouse_name ?? "—"}</strong>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            {tr("Destination shed", "নতুন শেড")} *
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={ui.select}
            >
              <option value="">{tr("Choose shed", "শেড নির্বাচন করুন")}</option>
              {warehouses.map((warehouse) => {
                const isCurrent = warehouse.warehouse_id === cow.warehouse_id;
                return (
                  <option
                    key={warehouse.warehouse_id}
                    value={warehouse.warehouse_id}
                    disabled={isCurrent}
                  >
                    {warehouse.name}
                    {isCurrent ? ` (${tr("Current", "বর্তমান")})` : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label className={ui.label}>
            {tr("Move date", "পরিবর্তনের তারিখ")} *
            <input
              type="date"
              required
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={`${ui.label} sm:col-span-2`}>
            {tr("Reason", "কারণ")}
            <input
              maxLength={200}
              placeholder={tr("e.g. Isolation, calving preparation, shed rotation", "যেমন: আলাদা রাখা, প্রসব প্রস্তুতি, শেড পরিবর্তন")}
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={ui.input}
            />
          </label>
        </div>
        <button type="submit" disabled={saving || !warehouseId} className={btn("primary", "md")}>
          {saving ? tr("Saving…") : tr("Save move", "পরিবর্তন সংরক্ষণ করুন")}
        </button>
      </form>
    </div>
  );
}

function SaleRecordSection({
  cow,
  today,
  reload,
  onError,
  onNotice,
}: {
  cow: CowDetail;
  today: string;
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  const { tr, money, date: fmtDate, enumLabel } = useI18n();
  const sale = cow.sale_record;
  const [editing, setEditing] = useState(false);
  const [saving, setSaving] = useState(false);
  const [buyerName, setBuyerName] = useState(sale?.buyer_name ?? cow.buyer_name ?? "");
  const [buyerPhone, setBuyerPhone] = useState(sale?.buyer_phone ?? cow.buyer_phone ?? "");
  const [buyerAddress, setBuyerAddress] = useState(sale?.buyer_address ?? cow.buyer_address ?? "");
  const [soldDate, setSoldDate] = useState(sale?.sale_date ?? cow.sold_date ?? today);
  const [salePrice, setSalePrice] = useState(
    sale?.sale_price != null
      ? String(sale.sale_price)
      : cow.sale_price != null
        ? String(cow.sale_price)
        : ""
  );
  const [saleNotes, setSaleNotes] = useState(sale?.notes ?? cow.sale_notes ?? "");

  async function handleSaveSale(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.herd.cow(cow.cow_id), {
        method: "PATCH",
        body: {
          status: "sold",
          buyer_name: buyerName.trim() || null,
          buyer_phone: buyerPhone.trim() || null,
          buyer_address: buyerAddress.trim() || null,
          sold_date: soldDate || null,
          sale_price: salePrice !== "" ? Number(salePrice) : null,
          sale_notes: saleNotes.trim() || null,
        },
      });
      setEditing(false);
      onNotice(tr("Sale record updated.", "বিক্রির তথ্য আপডেট হয়েছে।"));
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not update sale record.", "বিক্রির তথ্য আপডেট করা যায়নি।"));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">{tr("Sale & buyer record", "বিক্রি ও ক্রেতার তথ্য")}</h3>
          <p className="text-[12px] text-muted">
            {tr("Buyer details, sale price, date, and invoice reference for this sold cow.", "বিক্রিত গরুর ক্রেতা, বিক্রয়মূল্য, তারিখ ও চালানের তথ্য।")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sale?.invoice_id && sale.invoice_number ? (
            <Link
              href={`/milk-sales/invoices/${sale.invoice_id}`}
              className="rounded-[6px] border border-line-strong bg-subtle px-2.5 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              {tr("Invoice")} {sale.invoice_number}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={btn("secondary", "sm")}
          >
            {editing ? tr("Cancel") : tr("Edit sale info", "বিক্রির তথ্য সম্পাদনা")}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={(e) => void handleSaveSale(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={ui.label}>
            {tr("Buyer name", "ক্রেতার নাম")} *
            <input
              required
              maxLength={150}
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder={tr("e.g. Abdul Karim", "যেমন: আব্দুল করিম")}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            {tr("Buyer phone", "ক্রেতার ফোন")}
            <input
              maxLength={50}
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder={tr("e.g. 017XXXXXXXX", "যেমন: ০১৭XXXXXXXX")}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            {tr("Buyer address", "ক্রেতার ঠিকানা")}
            <input
              maxLength={255}
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder={tr("Village, upazila, or market", "গ্রাম, উপজেলা বা বাজার")}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            {tr("Sale date", "বিক্রির তারিখ")} *
            <input
              required
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            {tr("Sale price (৳)", "বিক্রয়মূল্য (৳)")}
            <input
              type="number"
              min="0"
              step="0.01"
              value={salePrice}
              onChange={(e) => setSalePrice(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={`${ui.label} sm:col-span-2 lg:col-span-3`}>
            {tr("Sale notes", "বিক্রির নোট")}
            <textarea
              rows={2}
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder={tr("Payment terms, transport notes, or remarks", "পেমেন্টের শর্ত, পরিবহন বা মন্তব্য")}
              className={ui.textarea}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
            <button type="submit" disabled={saving} className={btn("primary", "sm")}>
              {saving ? tr("Saving…") : tr("Save sale record", "বিক্রির তথ্য সংরক্ষণ করুন")}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px] sm:grid-cols-3 lg:grid-cols-6">
          <FieldItem label={tr("Buyer", "ক্রেতা")} value={sale?.buyer_name || cow.buyer_name || "—"} />
          <FieldItem label={tr("Buyer phone", "ক্রেতার ফোন")} value={sale?.buyer_phone || cow.buyer_phone || "—"} />
          <FieldItem label={tr("Buyer address", "ক্রেতার ঠিকানা")} value={sale?.buyer_address || cow.buyer_address || "—"} />
          <FieldItem label={tr("Sale date", "বিক্রির তারিখ")} value={fmtDate(sale?.sale_date ?? cow.sold_date)} />
          <FieldItem label={tr("Sale price", "বিক্রয়মূল্য")} value={money(sale?.sale_price ?? cow.sale_price)} />
          <FieldItem
            label={tr("Invoice status", "চালানের অবস্থা")}
            value={sale?.invoice_status ? enumLabel(sale.invoice_status) : tr("Direct sale", "সরাসরি বিক্রি")}
          />
          {sale?.invoice_id ? (
            <>
              <FieldItem label={tr("Paid amount", "পরিশোধিত টাকা")} value={money(sale.paid_amount)} />
              <FieldItem label={tr("Balance due", "বকেয়া")} value={money(sale.outstanding_balance)} />
            </>
          ) : null}
          <div className="col-span-2 sm:col-span-3 lg:col-span-6 border-t border-line pt-2.5">
            <dt className="text-[11.5px] text-muted">{tr("Sale notes", "বিক্রির নোট")}</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink">
              {(sale?.notes || cow.sale_notes)?.trim() ? (sale?.notes || cow.sale_notes) : "—"}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
