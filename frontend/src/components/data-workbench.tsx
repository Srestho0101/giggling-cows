"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import Link from "next/link";
import { apiRequest, ApiError } from "@/lib/api";
import { Badge, btn, statusTone, ui } from "@/components/ui";
import { SafeDataHistory } from "@/components/safe-data-history";

export { Notice } from "@/components/ui";

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
  showWhen?: { field: string; equals: string[] };
};

export type TableColumn = { key: string; label: string };
type RecordRow = Record<string, unknown>;
type LifecycleActions = {
  includeQuery: string;
  entityType: string;
  idKey: string;
  isInactive: (row: RecordRow) => boolean;
  restoreBody: (row: RecordRow) => Record<string, unknown>;
  restoreLabel?: (row: RecordRow) => string;
};

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
  addLabel?: string;
  rowActions?: (row: RecordRow) => React.ReactNode;
  updatePath?: (row: RecordRow) => string;
  deletePath?: (row: RecordRow) => string;
  deleteLabel?: string;
  onDelete?: (row: RecordRow) => void | Promise<void>;
  lifecycle?: LifecycleActions;
};

const isNumericKey = (key: string) =>
  /(amount|price|cost|salary|paid|balance|total|liters|weight|quantity|kg)$/i.test(key);

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
  addLabel,
  rowActions,
  updatePath,
  deletePath,
  deleteLabel,
  onDelete,
  lifecycle,
}: DataWorkbenchProps) {
  const [values, setValues] = useState<Record<string, string>>({});
  const [remoteOptions, setRemoteOptions] = useState<
    Record<string, { value: string; label: string }[]>
  >( {});
  const [saving, setSaving] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editing, setEditing] = useState<RecordRow | null>(null);
  const [showInactive, setShowInactive] = useState(false);
  const queryClient = useQueryClient();

  const sourceSignature = fields
    .filter((field) => field.sourcePath)
    .map((field) => `${field.sourcePath}:${field.sourceValue ?? "id"}:${field.sourceLabel ?? "name"}`)
    .join("|");

  // Config arrays are often declared inline by a parent; the signature is their relevant stable identity.
  // eslint-disable-next-line react-hooks/exhaustive-deps
  const sourceFields = useMemo(
    () => fields.filter((field) => field.sourcePath),
    [sourceSignature]
  );

  const effectiveQuery = [query, showInactive ? lifecycle?.includeQuery : ""].filter(Boolean).join("&");
  const queryKey = useMemo(() => ["data-workbench", path, effectiveQuery] as const, [path, effectiveQuery]);
  const rowsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const data = await apiRequest<unknown>(effectiveQuery ? `${path}?${effectiveQuery}` : path);
      const nextRows = Array.isArray(data) ? (data as RecordRow[]) : [];
      return nextRows;
    },
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const rows = useMemo(() => rowsQuery.data ?? [], [rowsQuery.data]);
  const loading = rowsQuery.isLoading;
  const visibleFields = fields.filter(
    (field) =>
      !field.showWhen ||
      field.showWhen.equals.includes(values[field.showWhen.field] ?? "")
  );

  useEffect(() => {
    onRows?.(rows);
  }, [rows, onRows]);

  const loadRows = useCallback(async () => {
    setError("");
    try {
      await queryClient.invalidateQueries({ queryKey, refetchType: "active" });
    } catch (cause) {
      setError(errorText(cause));
    }
  }, [queryClient, queryKey]);

  useEffect(() => {
    const sources = [
      ...new Set(sourceFields.flatMap((field) => (field.sourcePath ? [field.sourcePath] : []))),
    ];
    if (sources.length === 0) return;
    let cancelled = false;
    async function loadOptions() {
      const entries = await Promise.all(
        sources.map(async (sourcePath) => {
          try {
            const list = await apiRequest<unknown>(sourcePath);
            const sourceField = sourceFields.find((field) => field.sourcePath === sourcePath);
            const valueKey = sourceField?.sourceValue ?? "id";
            const labelKey = sourceField?.sourceLabel ?? "name";
            const options = Array.isArray(list)
              ? list
                  .map((item) => {
                    const row = item as RecordRow;
                    const value = row[valueKey];
                    if (value === undefined || value === null) return null;
                    return { value: String(value), label: String(row[labelKey] ?? value) };
                  })
                  .filter((option): option is { value: string; label: string } => option !== null)
              : [];
            return [sourcePath, options] as const;
          } catch {
            return [sourcePath, []] as const;
          }
        })
      );
      if (!cancelled) setRemoteOptions(Object.fromEntries(entries));
    }
    void loadOptions();
    return () => {
      cancelled = true;
    };
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
      for (const field of visibleFields) {
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
      await apiRequest(editing && updatePath ? updatePath(editing) : path, {
        method: editing ? "PATCH" : "POST",
        body,
      });
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
    setValues(
      Object.fromEntries(
        fields.map((field) => [field.name, row[field.name] == null ? "" : String(row[field.name])])
      )
    );
    setNotice("");
    setError("");
    setFormOpen(true);
  }

  async function handleDelete(row: RecordRow) {
    setError("");
    try {
      if (onDelete) {
        await onDelete(row);
        await loadRows();
        return;
      }
      if (deletePath) {
        await apiRequest(deletePath(row), { method: "DELETE" });
        await loadRows();
      }
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  async function restoreRow(row: RecordRow) {
    if (!lifecycle || !updatePath) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(updatePath(row), { method: "PATCH", body: lifecycle.restoreBody(row) });
      setNotice("Record restored.");
      await loadRows();
    } catch (cause) {
      setError(errorText(cause));
    }
  }

  const defaultAddLabel = `+ Add ${title.replace(/s$/, "")}`;
  const toggleLabel = formOpen ? "Close form" : addLabel ?? defaultAddLabel;

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3.5">
      {/* Header Row */}
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{title}</h2>
          <p className="mt-0.5 text-[12px] text-muted">{description}</p>
        </div>
        <div className="flex items-center gap-2">
          {lifecycle ? (
            <label className="flex items-center gap-2 text-xs text-muted">
              <input type="checkbox" checked={showInactive} onChange={(event) => setShowInactive(event.target.checked)} />
              Show archived and voided
            </label>
          ) : null}
          <button
            type="button"
            onClick={() => void loadRows()}
            className={btn("secondary", "sm")}
          >
            Refresh
          </button>
          {showCreate && (
            <button
              type="button"
              onClick={() => {
                setFormOpen((open) => !open);
                setEditing(null);
                setValues({});
              }}
              className={btn("primary", "sm")}
            >
              {toggleLabel}
            </button>
          )}
        </div>
      </div>

      {error && (
        <div role="alert" className="rounded-[6px] border border-warn/30 bg-warn-soft p-3 text-[13px] text-warn">
          {error}
        </div>
      )}
      {notice && (
        <div role="status" className="rounded-[6px] border border-accent/30 bg-accent-soft p-3 text-[13px] text-accent">
          {notice}
        </div>
      )}

      {/* Inset Form Panel */}
      {formOpen && (
        <form
          onSubmit={submit}
          className="@container rounded-[6px] border border-line bg-subtle p-4 space-y-3.5"
        >
          <h3 className="text-[13px] font-semibold text-ink">
            {editing ? `Edit ${title.replace(/s$/, "")}` : `New ${title.replace(/s$/, "")}`}
          </h3>
          <div className="grid gap-3 @lg:grid-cols-2 @3xl:grid-cols-3">
            {visibleFields.map((field) => {
              const fieldOptions =
                field.options ?? (field.sourcePath ? remoteOptions[field.sourcePath] ?? [] : []);
              return (
                <label
                  key={field.name}
                  className={`text-[12px] font-medium text-ink ${
                    field.type === "textarea" ? "@lg:col-span-2 @3xl:col-span-3" : ""
                  }`}
                >
                  <span className="block mb-1">
                    {field.label}
                    {field.required && <span className="ml-1 text-warn">*</span>}
                  </span>
                  {field.type === "select" ? (
                    <select
                      required={field.required}
                      value={values[field.name] ?? field.defaultValue ?? ""}
                      onChange={(event) =>
                        setValues((current) => {
                          const next = { ...current, [field.name]: event.target.value };
                          if (field.name === "acquisition_type") {
                            next.supplier_id = "";
                            next.dam_id = "";
                            next.sire_id = "";
                          }
                          return next;
                        })
                      }
                      className={ui.select}
                    >
                      <option value="">Choose {field.label.toLowerCase()}</option>
                      {fieldOptions.map((option) => (
                        <option key={option.value} value={option.value}>
                          {option.label}
                        </option>
                      ))}
                    </select>
                  ) : field.type === "textarea" ? (
                    <textarea
                      rows={3}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? field.defaultValue ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                      className={ui.textarea}
                    />
                  ) : (
                    <input
                      type={field.type ?? "text"}
                      min={field.type === "number" ? "0" : undefined}
                      step={field.step ?? (field.type === "number" ? "0.01" : undefined)}
                      required={field.required}
                      placeholder={field.placeholder}
                      value={values[field.name] ?? field.defaultValue ?? ""}
                      onChange={(event) =>
                        setValues((current) => ({
                          ...current,
                          [field.name]: event.target.value,
                        }))
                      }
                      className={ui.input}
                    />
                  )}
                </label>
              );
            })}
          </div>
          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                setFormOpen(false);
                setEditing(null);
                setValues({});
              }}
              className={btn("secondary", "sm")}
            >
              Cancel
            </button>
            <button disabled={saving} className={btn("primary", "sm")}>
              {saving ? "Saving…" : editing ? "Save changes" : "Save record"}
            </button>
          </div>
        </form>
      )}

      {/* Table Container */}
      <div className="overflow-x-auto rounded-[6px] border border-line">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-subtle">
              {columns.map((column) => (
                <th
                  key={column.key}
                  className={`px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap ${
                    isNumericKey(column.key) ? "text-right" : ""
                  }`}
                >
                  {column.label}
                </th>
              ))}
              {(rowActions || updatePath || deletePath || onDelete || lifecycle) && (
                <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap text-right">
                  Actions
                </th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-[13.5px]">
            {loading ? (
              Array.from({ length: 4 }).map((_, index) => (
                <tr key={`skeleton-${index}`} className="animate-pulse">
                  {columns.map((column) => (
                    <td key={column.key} className="px-3 py-2.5 whitespace-nowrap">
                      <div className="h-4 w-20 rounded-[4px] bg-line/60" />
                    </td>
                  ))}
                  {(rowActions || updatePath || deletePath || onDelete || lifecycle) && (
                    <td className="px-3 py-2.5 whitespace-nowrap text-right">
                      <div className="ml-auto h-4 w-14 rounded-[4px] bg-line/60" />
                    </td>
                  )}
                </tr>
              ))
            ) : rows.length === 0 ? (
              <tr>
                <td
                  colSpan={columns.length + (rowActions || updatePath || deletePath || onDelete || lifecycle ? 1 : 0)}
                  className="px-4 py-10 text-center text-[13px] text-muted"
                >
                  {emptyMessage}
                </td>
              </tr>
            ) : (
              rows.map((row, index) => {
                const rowKey = String(
                  row.id ??
                    row.cow_id ??
                    row.expense_id ??
                    row.evaluation_id ??
                    row.health_id ??
                    row.breeding_id ??
                    row.milk_id ??
                    row.invoice_id ??
                    row.worker_id ??
                    row.payment_id ??
                    index
                );
                return (
                  <tr key={rowKey} className="hover:bg-wash transition-colors">
                    {columns.map((column, columnIndex) => {
                      const href = rowHref?.(row);
                      const rawValue = row[column.key];
                      const numeric = isNumericKey(column.key);
                      const isBadgeCol =
                        /^(status|outcome|decision)$/i.test(column.key) ||
                        column.key === "is_profitable";

                      let content: React.ReactNode;
                      if (column.key === "is_profitable") {
                        const profitable = Boolean(rawValue);
                        content = (
                          <Badge tone={profitable ? "good" : "bad"}>
                            {profitable ? "Profitable" : "Not profitable"}
                          </Badge>
                        );
                      } else if (isBadgeCol && rawValue != null && rawValue !== "") {
                        content = (
                          <Badge tone={statusTone(rawValue)}>
                            {formatCell(rawValue, column.key)}
                          </Badge>
                        );
                      } else {
                        const formatted = formatCell(rawValue, column.key);
                        if (columnIndex === 0 && href) {
                          content = (
                            <Link href={href} className="font-medium text-accent hover:underline">
                              {formatted}
                            </Link>
                          );
                        } else {
                          content = formatted;
                        }
                      }

                      return (
                        <td
                          key={column.key}
                          className={`px-3 py-2.5 whitespace-nowrap text-ink ${
                            numeric ? "text-right tabular-nums font-mono-normal" : ""
                          }`}
                        >
                          {content}
                        </td>
                      );
                    })}
                    {(rowActions || updatePath || deletePath || onDelete || lifecycle) && (
                      <td className="px-3 py-2.5 whitespace-nowrap text-right">
                        <div className="flex items-center justify-end gap-2.5 text-[12px]">
                          {rowActions?.(row)}
                          {lifecycle && lifecycle.isInactive(row) && updatePath ? (
                            <button
                              type="button"
                              onClick={() => void restoreRow(row)}
                              className="font-medium text-accent hover:underline cursor-pointer"
                            >
                              {lifecycle.restoreLabel?.(row) ?? "Restore"}
                            </button>
                          ) : null}
                          {updatePath && (
                            <button
                              type="button"
                              onClick={() => startEdit(row)}
                              className="font-medium text-accent hover:underline cursor-pointer"
                            >
                              Edit
                            </button>
                          )}
                          {(deletePath || onDelete) && !(lifecycle?.isInactive(row)) && (
                            <button
                              type="button"
                              onClick={() => void handleDelete(row)}
                              className="font-medium text-warn hover:underline cursor-pointer"
                            >
                              {deleteLabel ?? "Delete"}
                            </button>
                          )}
                          {lifecycle ? (
                            <SafeDataHistory
                              entityType={lifecycle.entityType}
                              entityId={String(row[lifecycle.idKey] ?? "")}
                            />
                          ) : null}
                        </div>
                      </td>
                    )}
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </section>
  );
}

function errorText(cause: unknown) {
  if (cause instanceof ApiError) return cause.message;
  if (cause instanceof TypeError)
    return "Could not reach the API. Check that the backend is running.";
  return "Something went wrong. Your form data is still here; please try again.";
}

function formatCell(value: unknown, key: string) {
  if (value === null || value === undefined || value === "") return "—";
  if (typeof value === "boolean") return value ? "Yes" : "No";
  if (typeof value === "object") return Array.isArray(value) ? `${value.length} items` : "—";
  if (isNumericKey(key) && !Number.isNaN(Number(value))) {
    return new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value));
  }
  return String(value).replaceAll("_", " ");
}
