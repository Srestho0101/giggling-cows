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
import {
  acquisitionLabel,
  breedLabel,
  computeAgeFromBirthDate,
  daysBetween,
  formatDisplayDate,
  formatMoney,
  formatNumber,
  sessionLabel,
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
            <FieldItem label="Tag" value={cow.current_tag_number} />
            <FieldItem label="Category" value={cow.category} capitalize />
            <FieldItem label="Cow type" value={cow.cow_type ?? "—"} />
            <FieldItem label="Sex" value={cow.sex} capitalize />
            <FieldItem label="Breed" value={breedLabel(cow.breed)} />
            <FieldItem label="Color" value={cow.color?.trim() ? cow.color : "—"} />
            <FieldItem label="Marking" value={cow.marking?.trim() ? cow.marking : "—"} />
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
              label="Days on farm"
              value={
                cow.acquisition_date
                  ? `${daysBetween(cow.acquisition_date, today) ?? 0} days`
                  : "—"
              }
            />
            <FieldItem
              label="Supplier"
              value={cow.acquisition_type === "born_on_farm" ? "Born on farm" : cow.supplier_name ?? "—"}
            />
            <FieldItem label="Purchase price" value={formatMoney(cow.purchase_price)} />
            <div className="col-span-2 border-t border-line pt-2.5">
              <dt className="text-[11.5px] text-muted">Current shed</dt>
              <dd className="mt-0.5 text-[13px] font-medium text-ink">
                {cow.warehouse_name ?? "No shed"}
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

  function requestArchiveWeight(row: WeightRecord, archived: boolean) {
    if (!archived) {
      void applyArchiveWeight(row, false);
      return;
    }
    setConfirmModal({
      title: "Archive this weight record?",
      mode: "confirm",
      confirmLabel: "Archive",
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
            onClick={() => requestArchiveWeight(row, !row.is_archived)}
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
      onNotice("Shed move saved.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not save shed move.");
    } finally {
      setSaving(false);
    }
  }

  const columns: PaginatedColumn<WarehouseHistoryItem>[] = [
    {
      key: "warehouse_name",
      label: "Shed",
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
        title="Shed history"
        subtitle="Housing transfers and current shed assignment."
        rows={cow.warehouse_history ?? []}
        rowKey={(row) => row.movement_id}
        columns={columns}
        emptyMessage="No shed movements recorded."
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
            Destination shed *
            <select
              required
              value={warehouseId}
              onChange={(e) => setWarehouseId(e.target.value)}
              className={ui.select}
            >
              <option value="">Choose shed</option>
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
      onNotice("Sale record updated.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not update sale record.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Sale &amp; buyer record</h3>
          <p className="text-[12px] text-muted">
            Buyer details, sale price, date, and invoice reference for this sold cow.
          </p>
        </div>
        <div className="flex items-center gap-2">
          {sale?.invoice_id && sale.invoice_number ? (
            <Link
              href={`/milk-sales/invoices/${sale.invoice_id}`}
              className="rounded-[6px] border border-line-strong bg-subtle px-2.5 py-1 text-[12px] font-medium text-accent hover:underline"
            >
              Invoice {sale.invoice_number}
            </Link>
          ) : null}
          <button
            type="button"
            onClick={() => setEditing((v) => !v)}
            className={btn("secondary", "sm")}
          >
            {editing ? "Cancel" : "Edit sale info"}
          </button>
        </div>
      </div>

      {editing ? (
        <form onSubmit={(e) => void handleSaveSale(e)} className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
          <label className={ui.label}>
            Buyer name *
            <input
              required
              maxLength={150}
              value={buyerName}
              onChange={(e) => setBuyerName(e.target.value)}
              placeholder="e.g. Abdul Karim"
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Buyer phone
            <input
              maxLength={50}
              value={buyerPhone}
              onChange={(e) => setBuyerPhone(e.target.value)}
              placeholder="e.g. 017XXXXXXXX"
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Buyer address
            <input
              maxLength={255}
              value={buyerAddress}
              onChange={(e) => setBuyerAddress(e.target.value)}
              placeholder="Village, upazila, or market"
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Sale date *
            <input
              required
              type="date"
              value={soldDate}
              onChange={(e) => setSoldDate(e.target.value)}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Sale price (৳)
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
            Sale notes
            <textarea
              rows={2}
              value={saleNotes}
              onChange={(e) => setSaleNotes(e.target.value)}
              placeholder="Payment terms, transport notes, or remarks"
              className={ui.textarea}
            />
          </label>
          <div className="sm:col-span-2 lg:col-span-3 flex justify-end gap-2">
            <button type="submit" disabled={saving} className={btn("primary", "sm")}>
              {saving ? "Saving…" : "Save sale record"}
            </button>
          </div>
        </form>
      ) : (
        <dl className="grid grid-cols-2 gap-x-4 gap-y-3 text-[12.5px] sm:grid-cols-3 lg:grid-cols-6">
          <FieldItem label="Buyer" value={sale?.buyer_name || cow.buyer_name || "—"} />
          <FieldItem label="Buyer phone" value={sale?.buyer_phone || cow.buyer_phone || "—"} />
          <FieldItem label="Buyer address" value={sale?.buyer_address || cow.buyer_address || "—"} />
          <FieldItem label="Sale date" value={formatDisplayDate(sale?.sale_date ?? cow.sold_date)} />
          <FieldItem label="Sale price" value={formatMoney(sale?.sale_price ?? cow.sale_price)} />
          <FieldItem
            label="Invoice status"
            value={sale?.invoice_status ? sale.invoice_status.replaceAll("_", " ") : "Direct sale"}
            capitalize
          />
          {sale?.invoice_id ? (
            <>
              <FieldItem label="Paid amount" value={formatMoney(sale.paid_amount)} />
              <FieldItem label="Balance due" value={formatMoney(sale.outstanding_balance)} />
            </>
          ) : null}
          <div className="col-span-2 sm:col-span-3 lg:col-span-6 border-t border-line pt-2.5">
            <dt className="text-[11.5px] text-muted">Sale notes</dt>
            <dd className="mt-0.5 whitespace-pre-wrap text-[12.5px] text-ink">
              {(sale?.notes || cow.sale_notes)?.trim() ? (sale?.notes || cow.sale_notes) : "—"}
            </dd>
          </div>
        </dl>
      )}
    </section>
  );
}
