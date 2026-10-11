"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";

export type FormField = {
  name: string;
  label: string;
  type?: "text" | "date" | "number" | "select" | "textarea";
  required?: boolean;
  placeholder?: string;
  options?: { value: string; label: string }[];
  sourcePath?: string;
  sourceValue?: string;
  sourceLabel?: string;
  step?: string;
  defaultValue?: string;
};

export type TableColumn = { key: string; label: string };
type RecordRow = Record<string, unknown>;

type DataWorkbenchProps = {
  title: string;
  description: string;
  path: string;
  columns: TableColumn[];
  fields: FormField[];
  query?: string;
  onRows?: (rows: RecordRow[]) => void;
  emptyMessage?: string;
  rowHref?: (row: RecordRow) => string | undefined;
  buildBody?: (values: Record<string, string>) => Record<string, unknown>;
  showCreate?: boolean;
  rowActions?: (row: RecordRow) => React.ReactNode;
  updatePath?: (row: RecordRow) => string;
  deletePath?: (row: RecordRow) => string;
  onDelete?: (row: RecordRow) => void | Promise<void>;
};

export function DataWorkbench({
  title,
  description,
  path,
  columns,
  fields,
  query = "",
  onRows,
  emptyMessage = "No records yet.",
  rowHref,
  buildBody,
  showCreate = true,
  rowActions,
  updatePath,
  deletePath,
  onDelete,
}: DataWorkbenchProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [remoteOptions, setRemoteOptions] = useState<Record<string, { value: string; label: string }[]>>({});
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const queryClient = useQueryClient();
  const sourceSignature = fields.filter((field) => field.sourcePath).map((field) => `${field.sourcePath}:${field.sourceValue ?? "id"}:${field.sourceLabel ?? "name"}`).join("|");
  // Config arrays are often declared inline by a parent; the signature is their relevant stable identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sourceFields = useMemo(() => fields.filter((field) => field.sourcePath), [sourceSignature]);

  const queryKey = useMemo(() => ["data-workbench", path, query] as const, [path, query]);
  const rowsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await apiRequest<unknown>(query ? `${path}?${query}` : path);
      const nextRows = Array.isArray(data) ? data as RecordRow[] : [];
      return nextRows;
    },
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
  });

  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const loading = rowsQuery.isLoading;

  useEffect(() => { onRows?.(rows); }, [rows, onRows]);

  const loadRows = useCallback(async () => {
    setError("");
    try {
      await queryClient.invalidateQueries({ queryKey, refetchType: "active" });
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [queryClient, queryKey]);

  useEffect(() => {
    const sources = [...new Set(sourceFields.flatMap((field) => field.sourcePath ? [field.sourcePath] : []))];
    if (sources.length === 0) return;
    let cancelled = false;
    async function loadOptions() {
      const entries = await Promise.all(sources.map(async (sourcePath) => {
        try {
          const list = await apiRequest<unknown>(sourcePath);
          const sourceField = sourceFields.find((field) => field.sourcePath === sourcePath);
          const valueKey = sourceField?.sourceValue ?? "id";
          const labelKey = sourceField?.sourceLabel ?? "name";
          const options = Array.isArray(list) ? list.map((item) => {
            const row = item as RecordRow;
            const value = row[valueKey];
            if (value === undefined || value === null) return null;
            return { value: String(value), label: String(row[labelKey] ?? value) };
          }).filter((option): option is { value: string; label: string } => option !== null) : [];
          return [sourcePath, options] as const;
        } catch {
          return [sourcePath, []] as const;
        }
      }));
      if (!cancelled) setRemoteOptions(Object.fromEntries(entries));
    }
    void loadOptions();
    return () => { cancelled = true; };
  }, [sourceFields]);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    let body: Record<string, unknown>;
    if (buildBody) {
      body = buildBody(values);
    } else {
      body = {};
      for (const field of fields) {
        const value = (values[field.name] ?? field.defaultValue ?? "").trim();
        if (!value) {
          if (field.required) {
            setError(`${field.label} is required.`);
            setSaving(false);
            return;
          }
          continue;
        }
        body[field.name] = field.type === "number" ? Number(value) : value;
      }
    }
    try {
      await apiRequest(editing && updatePath ? updatePath(editing) : path, { method: editing ? "PATCH" : "POST", body });
      setValues({});
      setEditing(null);
      setNotice(editing ? "Changes saved." : "Saved successfully.");
      setFormOpen(false);
      await loadRows();
    } catch (cause) {
      setError(errorText(cause));
    } finally {
      setSaving(false);
    }
  }

  function startEdit(row: RecordRow) {
    setEditing(row);
    setValues(Object.fromEntries(fields.map((field) => [field.name, row[field.name] == null ? "" : String(row[field.name])] )));
    setNotice("");
    setError("");
    setFormOpen(true);
  }

  async function handleDelete(row: RecordRow) {
    if (onDelete) {
      await onDelete(row);
      await loadRows();
      return;
    }
    if (deletePath) {
      await apiRequest(deletePath(row), { method: "DELETE" });
      await loadRows();
    }
  }

  return (
    <section className="space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[14px] font-bold text-stone-900">{title}</h2>
          <p className="mt-1 text-[11px] text-stone-500">{description}</p>
        </div>
        <div className="flex gap-2">
          <button type="button" onClick={() => void loadRows()} className="rounded-md border border-stone-200 bg-white px-3 py-1.5 text-[11px] text-stone-600 hover:bg-stone-50">Refresh</button>
          {showCreate && <button type="button" onClick={() => { setFormOpen((open) => !open); setEditing(null); setValues({}); }} className="rounded-md bg-emerald-800 px-3 py-1.5 text-[11px] font-medium text-white hover:bg-emerald-900">{formOpen ? "Close form" : `+ Add ${title.replace(/s$/, "")}`}</button>}
        </div>
      </div>

      {error && <Notice tone="error">{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      {formOpen && (
        <form onSubmit={submit} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
          <h3 className="mb-3 text-[13px] font-semibold text-stone-800">{editing ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}</h3>
          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {fields.map((field) => {
              const className = "mt-1.5 w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-[12px] text-stone-700 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
              const fieldOptions = field.options ?? (field.sourcePath ? remoteOptions[field.sourcePath] ?? [] : []);
              return (
                <label key={field.name} className={`text-[11px] font-medium text-stone-600 ${field.type === "textarea" ? "sm:col-span-2 xl:col-span-3" : ""}`}>
                  {field.label}{field.required && <span className="ml-1 text-rose-600">*</span>}
                  {field.type === "select" ? (
              <select required={field.required} value={values[field.name] ?? field.defaultValue ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className={className}>
                      <option value="">Choose {field.label.toLowerCase()}</option>
                      {fieldOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea rows={3} required={field.required} placeholder={field.placeholder} value={values[field.name] ?? field.defaultValue ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className={className} />
                  ) : (
                    <input type={field.type ?? "text"} min={field.type === "number" ? "0" : undefined} step={field.step ?? (field.type === "number" ? "0.01" : undefined)} required={field.required} placeholder={field.placeholder} value={values[field.name] ?? field.defaultValue ?? ""} onChange={(event) => setValues((current) => ({ ...current, [field.name]: event.target.value }))} className={className} />
                  )}
                </label>
              );
            })}
          </div>
          <div className="mt-4 flex justify-end">
            <button type="button" onClick={() => { setFormOpen(false); setEditing(null); setValues({}); }} className="mr-2 rounded-md border border-stone-200 px-3 py-2 text-[12px] text-stone-600">Cancel</button>
            <button disabled={saving} className="rounded-md bg-emerald-800 px-3 py-2 text-[12px] font-medium text-white disabled:opacity-50">{saving ? "Saving…" : editing ? "Save changes" : "Save record"}</button>
          </div>
        </form>
      )}

      <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
        <div className="flex items-center justify-between border-b border-stone-100 px-4 py-2.5">
          <p className="text-[12px] font-medium text-stone-700">Records</p>
          <span className="text-[11px] text-stone-400">{loading ? "Loading…" : `${rows.length} records`}</span>
        </div>
        {loading ? (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                <tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-medium">{column.label}</th>)}{(rowActions || updatePath || deletePath || onDelete) && <th className="px-4 py-3 font-medium">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {Array.from({ length: 4 }).map((_, index) => (
                  <tr key={`skeleton-${index}`} className="animate-pulse">
                    {columns.map((column) => <td key={column.key} className="whitespace-nowrap px-3 py-2.5"><div className="h-4 w-24 rounded bg-stone-200" /></td>)}
                    {(rowActions || updatePath || deletePath || onDelete) && <td className="whitespace-nowrap px-3 py-2.5"><div className="h-4 w-20 rounded bg-stone-200" /></td>}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : rows.length === 0 ? <div className="px-4 py-12 text-center text-sm text-stone-400">{emptyMessage}</div> : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[640px] text-left text-sm">
              <thead className="bg-stone-50 text-[11px] uppercase tracking-wide text-stone-500">
                <tr>{columns.map((column) => <th key={column.key} className="whitespace-nowrap px-4 py-3 font-medium">{column.label}</th>)}{(rowActions || updatePath || deletePath || onDelete) && <th className="px-4 py-3 font-medium">Actions</th>}</tr>
              </thead>
              <tbody className="divide-y divide-stone-100">
                {rows.map((row, index) => <tr key={String(row.id ?? row.cow_id ?? row.expense_id ?? row.evaluation_id ?? row.health_id ?? row.breeding_id ?? row.milk_id ?? row.invoice_id ?? row.worker_id ?? row.payment_id ?? index)} className="hover:bg-stone-50/70">
                  {columns.map((column, columnIndex) => {
                    const href = rowHref?.(row);
                    const value = formatCell(row[column.key], column.key);
                    return <td key={column.key} className="whitespace-nowrap px-3 py-2.5 text-stone-700">{columnIndex === 0 && href ? <Link href={href} className="font-medium text-emerald-800 hover:underline">{value}</Link> : value}</td>;
                  })}
                  {(rowActions || updatePath || deletePath || onDelete) && <td className="whitespace-nowrap px-4 py-3"><div className="flex items-center gap-3">{rowActions?.(row)}{updatePath && <button type="button" onClick={() => startEdit(row)} className="text-xs font-medium text-emerald-800 hover:underline">Edit</button>}{(deletePath || onDelete) && <button type="button" onClick={() => void handleDelete(row)} className="text-xs font-medium text-rose-700 hover:underline">Delete</button>}</div></td>}
                </tr>)}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}

export function Notice({ children, tone = "error" }: { children: React.ReactNode; tone?: "error" | "success" | "info" }) {
  const styles = tone === "success" ? "border-emerald-200 bg-emerald-50 text-emerald-800" : tone === "info" ? "border-sky-200 bg-sky-50 text-sky-800" : "border-rose-200 bg-rose-50 text-rose-800";
  return <div role={tone === "error" ? "alert" : "status"} className={`rounded-lg border px-4 py-3 text-sm ${styles}`}>{children}</div>;
}

function errorText(cause: unknown) {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof TypeError) return "Could not reach the API. Check that the backend is running.";
  return "Something went wrong. Your form data is still here; please try again.";
}

function formatCell(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "—";
  if (/(amount|price|cost|salary|paid|balance|total|liters|weight|quantity|kg)$/i.test(key) && !Number.isNaN(Number(value))) {
    return new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value));
  }
  return String(value).replaceAll("_", " ");
}
