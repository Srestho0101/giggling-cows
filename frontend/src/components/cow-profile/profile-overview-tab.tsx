"use client";

import Link from "next/link";
import React, { useMemo, useState } from "react";
import { PaginatedTableCard, type PaginatedColumn } from "@/components/paginated-scroll-table";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, statusTone, ui } from "@/components/ui";
import { todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import { WeightTrendChart } from "@/components/cow-profile/weight-chart";
import {
  acquisitionLabel,
  breedLabel,
  computeAgeFromBirthDate,
  daysBetween,
  formatDisplayDate,
  formatMoney,
  formatNumber,
  sessionLabel,
  tagTypeLabel,
  type CowDetail,
  type TagHistoryItem,
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
  const today = todayInDhaka();
  const computedAge = cow.age ?? computeAgeFromBirthDate(cow.birth_date, today);
  const milkingText = cow.gives_milk
    ? cow.milking_sessions?.length
      ? `Yes (${cow.milking_sessions.map(sessionLabel).join(", ")})`
      : "Yes (no sessions set)"
    : "No";

  return (
    <div className="space-y-6">
      {/* Structured Profile & Lineage Grid */}
      <div className="grid gap-4 lg:grid-cols-3">
        <section className="rounded-[8px] border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink">Identity & classification</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
            <FieldItem label="Tag number" value={cow.current_tag_number} />
            <FieldItem label="Category" value={cow.category} capitalize />
            <FieldItem label="Sex" value={cow.sex} capitalize />
            <FieldItem label="Breed" value={breedLabel(cow.breed)} />
            <FieldItem label="Birth date" value={formatDisplayDate(cow.birth_date)} />
            <FieldItem label="Age" value={computedAge ?? "—"} />
            <FieldItem label="Age group" value={cow.age_group ?? "—"} />
            <FieldItem label="Milking" value={milkingText} />
            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">Notes</dt>
              <dd className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink">
                {cow.notes?.trim() ? cow.notes : "—"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[8px] border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink">Acquisition & housing</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
            <FieldItem label="Acquisition" value={acquisitionLabel(cow.acquisition_type)} />
            <FieldItem label="Acquired date" value={formatDisplayDate(cow.acquisition_date)} />
            <FieldItem
              label="Supplier"
              value={cow.acquisition_type === "born_on_farm" ? "Born on farm" : cow.supplier_name ?? "—"}
            />
            <FieldItem label="Purchase price" value={formatMoney(cow.purchase_price)} />
            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">Current warehouse</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-ink">
                {cow.warehouse_name ?? "No warehouse"}
              </dd>
            </div>
          </dl>
        </section>

        <section className="rounded-[8px] border border-line bg-surface p-4">
          <h3 className="text-[13px] font-semibold text-ink">Family & lineage</h3>
          <dl className="mt-3 grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px]">
            <div>
              <dt className="text-[11.5px] text-muted">Dam (Mother)</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {cow.dam_id ? (
                  <Link href={`/herd/${cow.dam_id}`} className="text-accent hover:underline">
                    {cow.dam_tag ?? "View dam"}
                  </Link>
                ) : (
                  cow.dam_tag ?? "—"
                )}
              </dd>
            </div>
            <div>
              <dt className="text-[11.5px] text-muted">Sire (Father)</dt>
              <dd className="mt-0.5 font-medium text-ink">
                {cow.sire_id ? (
                  <Link href={`/herd/${cow.sire_id}`} className="text-accent hover:underline">
                    {cow.sire_tag ?? "View sire"}
                  </Link>
                ) : (
                  cow.sire_tag ?? "—"
                )}
              </dd>
            </div>
            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">
                Offspring ({cow.offspring?.length ?? 0})
              </dt>
              <dd className="mt-1.5">
                {cow.offspring?.length ? (
                  <div className="flex max-h-24 flex-wrap gap-1.5 overflow-y-auto">
                    {cow.offspring.map((child) => (
                      <Link
                        key={child.cow_id}
                        href={`/herd/${child.cow_id}`}
                        className="inline-flex items-center gap-1.5 rounded-[5px] border border-line bg-subtle px-2 py-1 text-[12px] font-medium text-ink transition-colors hover:border-accent hover:text-accent"
                      >
                        <span>{child.current_tag_number}</span>
                        <span className="text-[11px] text-muted capitalize">
                          ({child.sex}{child.birth_date ? ` · ${formatDisplayDate(child.birth_date)}` : ""})
                        </span>
                      </Link>
                    ))}
                  </div>
                ) : (
                  <span className="text-[12.5px] text-muted">No recorded offspring.</span>
                )}
              </dd>
            </div>
          </dl>
        </section>
      </div>

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

      {/* Tag History (Paginated + Scrollable) & Assign / Add Tag */}
      <TagSection
        cow={cow}
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
  const [showArchived, setShowArchived] = useState(false);
  const [saving, setSaving] = useState(false);
  const [weighDate, setWeighDate] = useState(today);
  const [weightKg, setWeightKg] = useState("");
  const [editing, setEditing] = useState<WeightRecord | null>(null);
  const [editDate, setEditDate] = useState("");
  const [editWeight, setEditWeight] = useState("");
  const [editSaving, setEditSaving] = useState(false);

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
      onError("Weigh date cannot be in the future.");
      return;
    }
    setSaving(true);
    try {
      await apiRequest(apiRoutes.herd.weight(cowId), {
        method: "POST",
        body: { weigh_date: weighDate, weight_kg: Number(weightKg) },
      });
      setWeightKg("");
      onNotice("Weight recorded.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save weight record.");
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
      onError("Weigh date cannot be in the future.");
      return;
    }
    setEditSaving(true);
    try {
      await apiRequest(apiRoutes.herd.weightRecord(cowId, editing.weight_id), {
        method: "PATCH",
        body: { weigh_date: editDate, weight_kg: Number(editWeight) },
      });
      setEditing(null);
      onNotice("Weight record updated.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not update weight record.");
    } finally {
      setEditSaving(false);
    }
  }

  async function setArchived(row: WeightRecord, archived: boolean) {
    if (archived && !window.confirm("Archive this weight record?")) return;
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.herd.weightRecord(cowId, row.weight_id), {
        method: "PATCH",
        body: { is_archived: archived },
      });
      onNotice(archived ? "Weight record archived." : "Weight record restored.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not update weight record.");
    }
  }

  const columns: PaginatedColumn<WeightRecord>[] = [
    {
      key: "weigh_date",
      label: "Date",
      render: (row) => <span className="font-medium text-ink">{formatDisplayDate(row.weigh_date)}</span>,
    },
    {
      key: "weight_kg",
      label: "Weight",
      align: "right",
      render: (row) => <span className="font-semibold tabular-nums">{formatNumber(row.weight_kg)} kg</span>,
    },
    {
      key: "delta",
      label: "Change",
      align: "right",
      render: (row) => {
        if (row.is_archived) return <span className="text-muted">—</span>;
        const delta = deltaById.get(row.weight_id);
        if (delta === undefined) return <span className="text-muted">—</span>;
        const toneClass = delta > 0 ? "text-accent" : delta < 0 ? "text-warn" : "text-muted";
        return (
          <span className={`font-medium tabular-nums ${toneClass}`}>
            {delta > 0 ? "+" : ""}
            {formatNumber(delta)} kg
          </span>
        );
      },
    },
    {
      key: "is_archived",
      label: "Status",
      render: (row) => (
        <Badge tone={row.is_archived ? "neutral" : "good"}>
          {row.is_archived ? "Archived" : "Active"}
        </Badge>
      ),
    },
    {
      key: "actions",
      label: "Actions",
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
            Edit
          </button>
          <button
            type="button"
            onClick={() => void setArchived(row, !row.is_archived)}
            className="cursor-pointer font-medium text-muted hover:text-ink hover:underline"
          >
            {row.is_archived ? "Restore" : "Archive"}
          </button>
          <SafeDataHistory
            entityType="weight_records"
            entityId={row.weight_id}
            entityLabel={`Weight · ${formatDisplayDate(row.weigh_date)}`}
          />
        </div>
      ),
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
      <PaginatedTableCard
        title="Weight history"
        subtitle="Newest weight logs appear first."
        rows={visibleRows}
        rowKey={(row) => row.weight_id}
        columns={columns}
        emptyMessage={showArchived ? "No weight records yet." : "No active weight records."}
        defaultPageSize={5}
        scrollHeightClass=""
        headerActions={
          <label className="flex cursor-pointer items-center gap-1.5 text-[12px] text-muted">
            <input
              type="checkbox"
              checked={showArchived}
              onChange={(event) => setShowArchived(event.target.checked)}
            />
            Show archived
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
                  Correcting weight entry:
                </div>
                <label className="text-[12px] text-muted">
                  Date
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
                  Weight (kg)
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
                    {editSaving ? "Saving…" : "Update"}
                  </button>
                  <button
                    type="button"
                    onClick={() => setEditing(null)}
                    className={btn("secondary", "sm")}
                  >
                    Cancel
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
          <h3 className="text-[14px] font-semibold text-ink">Log a weight</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Record a new weighing to track growth over time.
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Date *
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
            Weight (kg) *
            <input
              type="number"
              min="0.1"
              step="0.01"
              required
              placeholder="e.g. 425.5"
              value={weightKg}
              onChange={(e) => setWeightKg(e.target.value)}
              className={ui.input}
            />
          </label>
        </div>
        <button type="submit" disabled={saving} className={btn("primary", "md")}>
          {saving ? "Saving…" : "Save weight"}
        </button>
      </form>
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
      onNotice("Warehouse move saved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save warehouse move.");
    } finally {
      setSaving(false);
    }
  }

  const columns: PaginatedColumn<WarehouseHistoryItem>[] = [
    {
      key: "warehouse_name",
      label: "Warehouse",
      render: (row) => <span className="font-medium text-ink">{row.warehouse_name ?? "—"}</span>,
    },
    {
      key: "moved_in_date",
      label: "Moved in",
      render: (row) => formatDisplayDate(row.moved_in_date),
    },
    {
      key: "moved_out_date",
      label: "Moved out",
      render: (row) =>
        row.moved_out_date ? (
          formatDisplayDate(row.moved_out_date)
        ) : (
          <Badge tone="good">Current</Badge>
        ),
    },
    {
      key: "duration",
      label: "Stay",
      align: "right",
      render: (row) => {
        const end = row.moved_out_date ?? today;
        const days = daysBetween(row.moved_in_date, end);
        return days !== null && days >= 0 ? `${days} d` : "—";
      },
    },
    {
      key: "reason",
      label: "Reason",
      render: (row) => <span className="text-muted">{row.reason || "—"}</span>,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
      <PaginatedTableCard
        title="Warehouse history"
        subtitle="Housing transfers and current shed assignment."
        rows={cow.warehouse_history ?? []}
        rowKey={(row) => row.movement_id}
        columns={columns}
        emptyMessage="No warehouse movements recorded."
        defaultPageSize={10}
        scrollHeightClass="max-h-[240px]"
      />

      <form
        onSubmit={(event) => void handleMove(event)}
        className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
      >
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Move cow</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Current shed: <strong className="text-ink">{cow.warehouse_name ?? "—"}</strong>
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Destination warehouse *
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={ui.select}
            >
              <option value="">Choose warehouse</option>
              {warehouses.map((warehouse) => {
                const isCurrent = warehouse.warehouse_id === cow.warehouse_id;
                return (
                  <option
                    key={warehouse.warehouse_id}
                    value={warehouse.warehouse_id}
                    disabled={isCurrent}
                  >
                    {warehouse.name}
                    {isCurrent ? " (Current)" : ""}
                  </option>
                );
              })}
            </select>
          </label>
          <label className={ui.label}>
            Move date *
            <input
              type="date"
              required
              value={moveDate}
              onChange={(e) => setMoveDate(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={`${ui.label} sm:col-span-2`}>
            Reason
            <input
              maxLength={200}
              placeholder="e.g. Isolation, calving preparation, shed rotation"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={ui.input}
            />
          </label>
        </div>
        <button type="submit" disabled={saving || !warehouseId} className={btn("primary", "md")}>
          {saving ? "Saving…" : "Save move"}
        </button>
      </form>
    </div>
  );
}

function TagSection({
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
  const [saving, setSaving] = useState(false);
  const [tagNumber, setTagNumber] = useState("");
  const [tagType, setTagType] = useState("ear_tag");
  const [assignedDate, setAssignedDate] = useState(today);
  const [reason, setReason] = useState("");
  const [setAsCurrent, setSetAsCurrent] = useState(true);

  async function handleAddTag(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.herd.tags(cow.cow_id), {
        method: "POST",
        body: {
          tag_number: tagNumber.trim(),
          tag_type: tagType,
          assigned_date: assignedDate,
          reason: reason.trim() || null,
          set_as_current: setAsCurrent,
        },
      });
      setTagNumber("");
      setReason("");
      onNotice(setAsCurrent ? "Current tag updated and logged." : "Tag record added.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save tag record.");
    } finally {
      setSaving(false);
    }
  }

  const primaryActiveTagId = useMemo(() => {
    const active = (cow.id_history ?? []).filter((h) => !h.removed_date);
    const matchingCurrent = active.filter((h) => h.tag_number === cow.current_tag_number);
    return (
      matchingCurrent.find((h) => h.tag_type === "ear_tag")?.history_id ??
      matchingCurrent[0]?.history_id ??
      null
    );
  }, [cow.id_history, cow.current_tag_number]);

  const columns: PaginatedColumn<TagHistoryItem>[] = [
    {
      key: "tag_number",
      label: "Tag",
      render: (row) => <span className="font-semibold text-ink">{row.tag_number}</span>,
    },
    {
      key: "tag_type",
      label: "Type",
      render: (row) => tagTypeLabel(row.tag_type),
    },
    {
      key: "assigned_date",
      label: "Assigned",
      render: (row) => formatDisplayDate(row.assigned_date),
    },
    {
      key: "removed_date",
      label: "Removed",
      render: (row) =>
        row.removed_date ? (
          formatDisplayDate(row.removed_date)
        ) : row.history_id === primaryActiveTagId ? (
          <Badge tone={statusTone("active")}>Current ({tagTypeLabel(row.tag_type)})</Badge>
        ) : (
          <Badge tone="neutral">Active ({tagTypeLabel(row.tag_type)})</Badge>
        ),
    },
    {
      key: "reason",
      label: "Reason",
      render: (row) => <span className="text-muted">{row.reason || "—"}</span>,
    },
  ];

  return (
    <div className="grid gap-4 xl:grid-cols-[1.5fr_0.9fr] items-start">
      <PaginatedTableCard
        title="Tag history"
        subtitle="Ear tags, RFIDs, and identification changes."
        rows={cow.id_history ?? []}
        rowKey={(row) => row.history_id}
        columns={columns}
        emptyMessage="No tag history recorded."
        defaultPageSize={10}
        scrollHeightClass="max-h-[240px]"
      />

      <form
        onSubmit={(event) => void handleAddTag(event)}
        className="rounded-[8px] border border-line bg-surface p-4 space-y-3"
      >
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Assign or add tag</h3>
          <p className="mt-0.5 text-[12px] text-muted">
            Replace a lost ear tag or attach a secondary identifier (RFID, neck band).
          </p>
        </div>
        <div className="grid gap-3 sm:grid-cols-2">
          <label className={ui.label}>
            Tag number *
            <input
              required
              maxLength={50}
              placeholder="e.g. GC-001-R2"
              value={tagNumber}
              onChange={(e) => setTagNumber(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Tag type *
            <select
              value={tagType}
              onChange={(e) => setTagType(e.target.value)}
              className={ui.select}
            >
              <option value="ear_tag">Ear tag</option>
              <option value="rfid">RFID</option>
              <option value="neck_band">Neck band</option>
              <option value="tattoo">Tattoo</option>
              <option value="other">Other</option>
            </select>
          </label>
          <label className={ui.label}>
            Assigned date *
            <input
              type="date"
              required
              value={assignedDate}
              onChange={(e) => setAssignedDate(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Reason
            <input
              maxLength={200}
              placeholder="e.g. Lost tag replacement"
              value={reason}
              onChange={(e) => setReason(e.target.value)}
              className={ui.input}
            />
          </label>
        </div>
        <label className="flex cursor-pointer items-center gap-2 text-[12.5px] text-ink">
          <input
            type="checkbox"
            checked={setAsCurrent}
            onChange={(e) => setSetAsCurrent(e.target.checked)}
          />
          Set as current primary tag (closes previous primary tag)
        </label>
        <button type="submit" disabled={saving} className={btn("primary", "md")}>
          {saving ? "Saving…" : "Save tag"}
        </button>
      </form>
    </div>
  );
}
