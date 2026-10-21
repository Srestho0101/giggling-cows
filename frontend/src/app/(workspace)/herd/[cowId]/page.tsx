"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import { apiRequest, apiRoutes } from "@/lib/api";

type CowDetails = Record<string, unknown> & {
  weight_records?: Record<string, unknown>[];
  warehouse_history?: Record<string, unknown>[];
  id_history?: Record<string, unknown>[];
};

export default function CowProfilePage() {
  const { cowId } = useParams<{ cowId: string }>();
  const [cow, setCow] = useState<CowDetails | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [busy, setBusy] = useState(false);

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setCow(await apiRequest<CowDetails>(apiRoutes.herd.cow(cowId))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load this cow."); }
    finally { setLoading(false); }
  }, [cowId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function submit(event: React.FormEvent<HTMLFormElement>, kind: "weight" | "move") {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    const body = kind === "weight"
      ? { weigh_date: data.get("date"), weight_kg: Number(data.get("weight_kg")) }
      : { warehouse_id: data.get("warehouse_id"), moved_in_date: data.get("date"), reason: data.get("reason") || null };
    setBusy(true); setError(""); setNotice("");
    try {
      await apiRequest(kind === "weight" ? apiRoutes.herd.weight(cowId) : apiRoutes.herd.move(cowId), { method: "POST", body });
      form.reset(); setNotice(kind === "weight" ? "Weight saved." : "Warehouse move saved."); await load();
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not save this record."); }
    finally { setBusy(false); }
  }

  return <ModulePage title="Cow profile" subtitle="Cow record details, weight and housing history.">
    {loading && <p className="text-sm text-stone-500">Loading cow…</p>}
    {error && <Notice>{error}</Notice>}
    {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
    {cow && <div className="space-y-6">
      <div className="flex flex-wrap items-start justify-between gap-4 rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div><Link href="/herd" className="text-xs text-emerald-800 hover:underline">← Back to herd</Link><h2 className="mt-3 text-xl font-semibold">Cow {String(cow.current_tag_number)}</h2><p className="mt-1 text-sm text-stone-500">{String(cow.category)} · {String(cow.sex)} · {String(cow.warehouse_name ?? "No warehouse")}</p></div>
        <label className="text-xs font-medium text-stone-500">Status<select value={String(cow.status ?? "active")} onChange={async (event) => {
          const status = event.target.value; setError(""); setNotice("");
          try { const updated = await apiRequest<CowDetails>(apiRoutes.herd.cow(cowId), { method: "PATCH", body: { status } }); setCow(updated); setNotice("Cow status updated."); }
          catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update status."); }
        }} className="mt-1 block rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800"><option value="active">Active</option><option value="sold">Sold</option><option value="deceased">Deceased</option><option value="archived">Archived</option></select></label>
      </div>
      <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">{[
        ["Acquired", String(cow.acquisition_date ?? "—")], ["Acquisition", String(cow.acquisition_type ?? "—").replaceAll("_", " ")], ["Purchase price", cow.purchase_price ? `৳ ${cow.purchase_price}` : "—"], ["Dam", String(cow.dam_tag ?? "—")], ["Sire", String(cow.sire_tag ?? "—")], ["Latest weight", cow.latest_weight_kg ? `${cow.latest_weight_kg} kg` : "—"],
      ].map(([label, value]) => <div key={label} className="rounded-xl border border-stone-200 bg-white p-4"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-sm font-medium capitalize text-stone-800">{value}</p></div>)}</div>
      <div className="grid gap-5 xl:grid-cols-2">
        <WeightHistory
          cowId={cowId}
          rows={cow.weight_records ?? []}
          reload={load}
          onError={setError}
          onNotice={setNotice}
        />
        <form onSubmit={(event) => void submit(event, "weight")} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-semibold">Log a weight</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>Date<input name="date" type="date" required defaultValue={localToday()} className={inputClass} /></label><label className={labelClass}>Weight (kg)<input name="weight_kg" type="number" min="0.1" step="0.1" required className={inputClass} /></label></div><button disabled={busy} className={buttonClass}>{busy ? "Saving…" : "Save weight"}</button></form>
      </div>
      <div className="grid gap-5 xl:grid-cols-2">
        <HistoryCard title="Warehouse history" columns={["Warehouse", "Moved in", "Moved out", "Reason"]} rows={cow.warehouse_history ?? []} keys={["warehouse_name", "moved_in_date", "moved_out_date", "reason"]} />
        <form onSubmit={(event) => void submit(event, "move")} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-semibold">Move cow</h3><div className="mt-4 grid gap-3 sm:grid-cols-2"><label className={labelClass}>New warehouse<select name="warehouse_id" required className={inputClass}><WarehouseOptions /></select></label><label className={labelClass}>Move date<input name="date" type="date" required defaultValue={localToday()} className={inputClass} /></label><label className={`${labelClass} sm:col-span-2`}>Reason<input name="reason" className={inputClass} /></label></div><button disabled={busy} className={buttonClass}>{busy ? "Saving…" : "Save move"}</button></form>
      </div>
      <HistoryCard title="Tag history" columns={["Tag", "Type", "Assigned", "Removed", "Reason"]} rows={cow.id_history ?? []} keys={["tag_number", "tag_type", "assigned_date", "removed_date", "reason"]} />
    </div>}
  </ModulePage>;
}

function WeightHistory({
  cowId,
  rows,
  reload,
  onError,
  onNotice,
}: {
  cowId: string;
  rows: Record<string, unknown>[];
  reload: () => Promise<void>;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
}) {
  async function setArchived(row: Record<string, unknown>, archived: boolean) {
    const label = archived ? "archive" : "restore";
    if (archived && !window.confirm("Archive this weight record?")) return;
    onError("");
    onNotice("");
    try {
      await apiRequest(apiRoutes.herd.weightRecord(cowId, String(row.weight_id)), {
        method: "PATCH",
        body: { is_archived: archived },
      });
      onNotice(archived ? "Weight record archived." : "Weight record restored.");
      await reload();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : `Could not ${label} weight record.`);
    }
  }

  return (
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      <h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Weight history</h3>
      {rows.length ? (
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-stone-50 text-stone-500"><tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Weight</th><th className="px-4 py-2.5">Archived</th><th className="px-4 py-2.5">Actions</th></tr></thead>
            <tbody className="divide-y divide-stone-100">
              {rows.map((row) => (
                <tr key={String(row.weight_id)}>
                  <td className="whitespace-nowrap px-4 py-3">{String(row.weigh_date)}</td>
                  <td className="whitespace-nowrap px-4 py-3">{String(row.weight_kg)} kg</td>
                  <td className="px-4 py-3">{row.is_archived ? "Yes" : "No"}</td>
                  <td className="px-4 py-3"><div className="flex items-center gap-3">
                    <button type="button" onClick={() => void setArchived(row, !row.is_archived)} className="font-medium text-accent hover:underline">{row.is_archived ? "Restore" : "Archive"}</button>
                    <SafeDataHistory entityType="weight_records" entityId={String(row.weight_id)} />
                  </div></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : <p className="px-4 py-8 text-center text-xs text-stone-400">No weight records yet.</p>}
    </div>
  );
}

function HistoryCard({ title, columns, rows, keys, suffixes = [] }: { title: string; columns: string[]; rows: Record<string, unknown>[]; keys: string[]; suffixes?: string[] }) {
  return <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"><h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">{title}</h3>{rows.length ? <div className="overflow-x-auto"><table className="w-full text-left text-xs"><thead className="bg-stone-50 text-stone-500"><tr>{columns.map((column) => <th key={column} className="px-4 py-2.5 font-medium">{column}</th>)}</tr></thead><tbody className="divide-y divide-stone-100">{rows.map((row, index) => <tr key={String(row.weight_id ?? row.movement_id ?? row.history_id ?? index)}>{keys.map((key, cell) => <td key={key} className="whitespace-nowrap px-4 py-3 text-stone-700">{String(row[key] ?? "—")}{suffixes[cell]}</td>)}</tr>)}</tbody></table></div> : <p className="px-4 py-8 text-center text-xs text-stone-400">No history recorded.</p>}</div>;
}

function WarehouseOptions() {
  const [warehouses, setWarehouses] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { void apiRequest<Record<string, unknown>[]>(apiRoutes.herd.warehouses).then(setWarehouses).catch(() => setWarehouses([])); }, []);
  return <><option value="">Choose warehouse</option>{warehouses.map((warehouse) => <option key={String(warehouse.warehouse_id)} value={String(warehouse.warehouse_id)}>{String(warehouse.name)}</option>)}</>;
}

const inputClass = "mt-1 block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
const labelClass = "block text-xs font-medium text-stone-600";
const buttonClass = "mt-4 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50";
function localToday() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const date = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${date.year}-${date.month}-${date.day}`; }
