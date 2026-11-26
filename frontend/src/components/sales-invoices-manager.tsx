"use client";

import React, { useMemo, useState } from "react";
import Link from "next/link";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, DateInput, Notice, statusTone, ui } from "@/components/ui";
import { apiQuery, apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type InvoiceLineForm = {
  item_type: "milk" | "animal" | "other";
  cow_id: string;
  description: string;
  quantity: string;
  unit_price: string;
};

type InvoiceRow = {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name?: string | null;
  invoice_date: string;
  due_date?: string | null;
  status: string;
  subtotal: string | number;
  discount: string | number;
  total_amount: string | number;
  paid_amount: string | number;
  outstanding_balance: string | number;
  notes?: string | null;
  void_reason?: string | null;
  lines?: {
    line_id?: string;
    item_type: "milk" | "animal" | "other";
    cow_id?: string | null;
    description: string;
    quantity: string | number;
    unit_price: string | number;
    line_total?: string | number;
  }[];
};

type CustomerOption = {
  customer_id: string;
  name: string;
};

type CowOption = {
  cow_id: string;
  current_tag_number: string;
  status: string;
};

const emptyLine = (): InvoiceLineForm => ({
  item_type: "milk",
  cow_id: "",
  description: "",
  quantity: "",
  unit_price: "",
});

export function SalesInvoicesManager({
  defaultDate,
  filterDate,
  compact = false,
}: {
  defaultDate: string;
  filterDate?: string;
  compact?: boolean;
}) {
  const { tr, money, date: fmtDate, enumLabel } = useI18n();
  const queryClient = useQueryClient();

  const [showVoid, setShowVoid] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [customerId, setCustomerId] = useState("");
  const [invoiceDate, setInvoiceDate] = useState(defaultDate);
  const [dueDate, setDueDate] = useState("");
  const [discount, setDiscount] = useState("0");
  const [notes, setNotes] = useState("");
  const [lines, setLines] = useState<InvoiceLineForm[]>([emptyLine()]);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const queryParams = useMemo(
    () =>
      apiQuery(apiRoutes.sales.invoices, {
        start_date: filterDate,
        end_date: filterDate,
        include_void: showVoid ? "true" : undefined,
      }),
    [filterDate, showVoid]
  );

  const invoicesQuery = useQuery({
    queryKey: ["sales-invoices", filterDate ?? "all", showVoid],
    queryFn: () => apiRequest<InvoiceRow[]>(queryParams),
    staleTime: 30_000,
  });

  const customersQuery = useQuery({
    queryKey: ["sales-customers-options"],
    queryFn: () => apiRequest<CustomerOption[]>(apiRoutes.sales.customers),
    staleTime: 60_000,
  });

  const cowsQuery = useQuery({
    queryKey: ["herd-cows-options"],
    queryFn: () => apiRequest<CowOption[]>(apiRoutes.herd.cows),
    staleTime: 60_000,
  });

  const invoices = invoicesQuery.data ?? [];
  const customers = customersQuery.data ?? [];
  const activeCows = useMemo(
    () => (cowsQuery.data ?? []).filter((c) => c.status === "active"),
    [cowsQuery.data]
  );

  const computedSubtotal = useMemo(
    () =>
      lines.reduce((sum, line) => {
        const q = Number(line.quantity || 0);
        const p = Number(line.unit_price || 0);
        if (!Number.isFinite(q) || !Number.isFinite(p) || q < 0 || p < 0) return sum;
        return sum + q * p;
      }, 0),
    [lines]
  );
  const discountNum = Math.max(0, Number(discount || 0));
  const computedTotal = Math.max(0, computedSubtotal - (Number.isFinite(discountNum) ? discountNum : 0));

  async function invalidateAll() {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["data-workbench"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["herd-cows"] }),
    ]);
  }

  function resetForm() {
    setEditingId(null);
    setCustomerId("");
    setInvoiceDate(defaultDate);
    setDueDate("");
    setDiscount("0");
    setNotes("");
    setLines([emptyLine()]);
    setError("");
  }

  function startCreate() {
    if (formOpen && !editingId) {
      setFormOpen(false);
      return;
    }
    resetForm();
    setNotice("");
    setFormOpen(true);
  }

  function startEdit(inv: InvoiceRow) {
    setEditingId(inv.invoice_id);
    setCustomerId(inv.customer_id);
    setInvoiceDate(inv.invoice_date);
    setDueDate(inv.due_date ?? "");
    setDiscount(inv.discount != null ? String(inv.discount) : "0");
    setNotes(inv.notes ?? "");
    const hydratedLines: InvoiceLineForm[] =
      inv.lines && inv.lines.length > 0
        ? inv.lines.map((line) => ({
            item_type: line.item_type ?? "milk",
            cow_id: line.cow_id ?? "",
            description: line.description ?? "",
            quantity: line.quantity != null ? String(line.quantity) : "",
            unit_price: line.unit_price != null ? String(line.unit_price) : "",
          }))
        : [emptyLine()];
    setLines(hydratedLines);
    setError("");
    setNotice("");
    setFormOpen(true);
  }

  function updateLine(index: number, patch: Partial<InvoiceLineForm>) {
    setLines((prev) => prev.map((item, idx) => (idx === index ? { ...item, ...patch } : item)));
  }

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!customerId) {
      setError(tr("Please select a customer.", "অনুগ্রহ করে একজন ক্রেতা নির্বাচন করুন।"));
      return;
    }
    if (!invoiceDate) {
      setError(tr("Invoice date is required.", "চালানের তারিখ প্রয়োজন।"));
      return;
    }
    if (lines.length === 0) {
      setError(tr("Add at least one line item.", "কমপক্ষে একটি আইটেম যোগ করুন।"));
      return;
    }

    for (let i = 0; i < lines.length; i += 1) {
      const line = lines[i];
      if (!line.description.trim()) {
        setError(tr(`Line ${i + 1}: Description is required.`, `আইটেম ${i + 1}: বিবরণ প্রয়োজন।`));
        return;
      }
      if (line.item_type === "animal" && !line.cow_id) {
        setError(tr(`Line ${i + 1}: Please select a cow for animal sale.`, `আইটেম ${i + 1}: গরুর বিক্রয়ের জন্য গরু নির্বাচন করুন।`));
        return;
      }
      const qty = Number(line.quantity);
      const price = Number(line.unit_price);
      if (!Number.isFinite(qty) || qty <= 0) {
        setError(tr(`Line ${i + 1}: Quantity must be greater than 0.`, `আইটেম ${i + 1}: পরিমাণ ০-এর বেশি হতে হবে।`));
        return;
      }
      if (!Number.isFinite(price) || price < 0) {
        setError(tr(`Line ${i + 1}: Unit price cannot be negative.`, `আইটেম ${i + 1}: একক মূল্য ঋণাত্মক হতে পারবে না।`));
        return;
      }
    }

    if (discountNum > computedSubtotal) {
      setError(tr("Discount cannot exceed invoice subtotal.", "ছাড় উপমোটের চেয়ে বেশি হতে পারবে না।"));
      return;
    }

    const body = {
      customer_id: customerId,
      invoice_date: invoiceDate,
      due_date: dueDate || null,
      discount: discountNum,
      notes: notes.trim() || null,
      lines: lines.map((line) => ({
        item_type: line.item_type,
        cow_id: line.item_type === "animal" && line.cow_id ? line.cow_id : null,
        description: line.description.trim(),
        quantity: Number(line.quantity),
        unit_price: Number(line.unit_price),
      })),
    };

    setSaving(true);
    try {
      if (editingId) {
        await apiRequest(apiRoutes.sales.invoice(editingId), {
          method: "PATCH",
          body,
        });
        setNotice(tr("Changes saved."));
      } else {
        await apiRequest(apiRoutes.sales.invoices, {
          method: "POST",
          body,
        });
        setNotice(tr("Saved successfully."));
      }
      resetForm();
      setFormOpen(false);
      await invalidateAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Could not save invoice.", "চালান সংরক্ষণ করা যায়নি।"));
    } finally {
      setSaving(false);
    }
  }

  function requestVoid(inv: InvoiceRow) {
    setConfirmModal({
      title: tr(`Void invoice ${inv.invoice_number}?`, `চালান ${inv.invoice_number} বাতিল করবেন?`),
      description: tr(
        "Voiding keeps the invoice in audit history and reverts sold animal statuses if applicable.",
        "বাতিল করলে চালানটি অডিট ইতিহাসে সংরক্ষিত থাকবে।"
      ),
      mode: "reason",
      confirmLabel: tr("Void"),
      tone: "danger",
      reasonLabel: tr("Reason for voiding"),
      onConfirm: async (reason) => {
        await apiRequest(apiRoutes.sales.invoiceStatus(inv.invoice_id), {
          method: "PATCH",
          body: { status: "void", void_reason: reason },
        });
        setNotice(tr("Invoice voided.", "চালান বাতিল করা হয়েছে।"));
        await invalidateAll();
      },
    });
  }

  async function reissueInvoice(inv: InvoiceRow) {
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.sales.invoiceStatus(inv.invoice_id), {
        method: "PATCH",
        body: { status: "issued" },
      });
      setNotice(tr("Invoice issued.", "চালান ইস্যু করা হয়েছে।"));
      await invalidateAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Could not reissue invoice."));
    }
  }

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3.5">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{tr("Sales invoices")}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {filterDate
              ? tr(`Create and review invoices dated ${fmtDate(filterDate)}.`, `${fmtDate(filterDate)} তারিখের চালান তৈরি ও পর্যালোচনা করুন।`)
              : tr(
                  "Create invoices with one or more line items. Select an invoice to record payments or update its status.",
                  "এক বা একাধিক আইটেমসহ চালান তৈরি করুন। পেমেন্ট নিতে চালানে ক্লিক করুন।"
                )}
          </p>
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
            <input
              type="checkbox"
              checked={showVoid}
              onChange={(event) => setShowVoid(event.target.checked)}
            />
            {tr("Show archived and voided")}
          </label>
          <button
            type="button"
            onClick={() => void invalidateAll()}
            className={btn("secondary", "sm")}
          >
            {tr("Refresh")}
          </button>
          <button type="button" onClick={startCreate} className={btn("primary", "sm")}>
            {formOpen && !editingId ? tr("Close form") : tr("+ Add Sales invoice", "+ বিক্রয় চালান যোগ করুন")}
          </button>
        </div>
      </div>

      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {formOpen ? (
        <form
          onSubmit={(event) => void handleSubmit(event)}
          noValidate
          className="rounded-[6px] border border-line bg-subtle p-4 space-y-4"
        >
          <h3 className="text-[13px] font-semibold text-ink">
            {editingId ? tr("Edit Sales invoice", "বিক্রয় চালান সম্পাদনা") : tr("New Sales invoice", "নতুন বিক্রয় চালান")}
          </h3>

          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">
                {tr("Customer")} <span className="text-warn">*</span>
              </span>
              <select
                required
                value={customerId}
                onChange={(event) => setCustomerId(event.target.value)}
                className={ui.select}
              >
                <option value="">{tr("Choose customer", "ক্রেতা নির্বাচন করুন")}</option>
                {customers.map((c) => (
                  <option key={c.customer_id} value={c.customer_id}>
                    {c.name}
                  </option>
                ))}
              </select>
            </label>

            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">
                {tr("Invoice date")} <span className="text-warn">*</span>
              </span>
              <DateInput value={invoiceDate} onChange={setInvoiceDate} required />
            </label>

            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Due date")}</span>
              <DateInput value={dueDate} onChange={setDueDate} />
            </label>

            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Discount ৳")}</span>
              <input
                type="number"
                min="0"
                step="0.01"
                value={discount}
                onChange={(event) => setDiscount(event.target.value)}
                className={ui.input}
              />
            </label>
          </div>

          <div className="space-y-2.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <span className="text-[12px] font-semibold text-ink">
                {tr("Line items", "আইটেম তালিকা")}
              </span>
              <button
                type="button"
                onClick={() => setLines((prev) => [...prev, emptyLine()])}
                className={btn("secondary", "sm")}
              >
                {tr("+ Add line item")}
              </button>
            </div>

            <div className="space-y-2.5">
              {lines.map((line, index) => {
                const qty = Number(line.quantity || 0);
                const price = Number(line.unit_price || 0);
                const lineTotal =
                  Number.isFinite(qty) && Number.isFinite(price) && qty > 0 && price >= 0
                    ? qty * price
                    : 0;
                return (
                  <div
                    key={index}
                    className="grid gap-2.5 rounded-[6px] border border-line bg-surface p-3 sm:grid-cols-12 sm:items-end"
                  >
                    <label className="text-[11.5px] font-medium text-ink sm:col-span-2">
                      <span className="block mb-1">{tr("Item")} *</span>
                      <select
                        value={line.item_type}
                        onChange={(event) =>
                          updateLine(index, {
                            item_type: event.target.value as "milk" | "animal" | "other",
                            cow_id: event.target.value === "animal" ? line.cow_id : "",
                          })
                        }
                        className={ui.select}
                      >
                        <option value="milk">{enumLabel("milk")}</option>
                        <option value="animal">{enumLabel("animal")}</option>
                        <option value="other">{enumLabel("other")}</option>
                      </select>
                    </label>

                    {line.item_type === "animal" ? (
                      <label className="text-[11.5px] font-medium text-ink sm:col-span-2">
                        <span className="block mb-1">{tr("Cow")} *</span>
                        <select
                          value={line.cow_id}
                          onChange={(event) => updateLine(index, { cow_id: event.target.value })}
                          className={ui.select}
                        >
                          <option value="">{tr("Choose cow", "গরু নির্বাচন")}</option>
                          {activeCows.map((cow) => (
                            <option key={cow.cow_id} value={cow.cow_id}>
                              {cow.current_tag_number}
                            </option>
                          ))}
                        </select>
                      </label>
                    ) : null}

                    <label
                      className={`text-[11.5px] font-medium text-ink ${
                        line.item_type === "animal" ? "sm:col-span-3" : "sm:col-span-5"
                      }`}
                    >
                      <span className="block mb-1">{tr("Description")} *</span>
                      <input
                        value={line.description}
                        onChange={(event) => updateLine(index, { description: event.target.value })}
                        placeholder={tr("e.g. Morning fresh milk", "যেমন: সকালের তাজা দুধ")}
                        className={ui.input}
                      />
                    </label>

                    <label className="text-[11.5px] font-medium text-ink sm:col-span-2">
                      <span className="block mb-1">{tr("Quantity")} *</span>
                      <input
                        type="number"
                        min="0.01"
                        step="0.01"
                        value={line.quantity}
                        onChange={(event) => updateLine(index, { quantity: event.target.value })}
                        className={ui.input}
                      />
                    </label>

                    <label className="text-[11.5px] font-medium text-ink sm:col-span-2">
                      <span className="block mb-1">{tr("Unit price ৳")} *</span>
                      <input
                        type="number"
                        min="0"
                        step="0.01"
                        value={line.unit_price}
                        onChange={(event) => updateLine(index, { unit_price: event.target.value })}
                        className={ui.input}
                      />
                    </label>

                    <div className="flex items-center justify-between gap-2 sm:col-span-1 sm:justify-end">
                      <span className="text-[12px] font-semibold text-ink tabular-nums sm:hidden">
                        {money(lineTotal)}
                      </span>
                      {lines.length > 1 ? (
                        <button
                          type="button"
                          onClick={() => setLines((prev) => prev.filter((_, idx) => idx !== index))}
                          className="text-[12px] font-medium text-warn hover:underline cursor-pointer"
                        >
                          {tr("Remove")}
                        </button>
                      ) : null}
                    </div>
                  </div>
                );
              })}
            </div>
          </div>

          <div className="grid gap-3 sm:grid-cols-[1fr_auto] sm:items-end">
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Notes")}</span>
              <input
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={ui.input}
              />
            </label>
            <div className="rounded-[6px] border border-line bg-surface px-3.5 py-2 text-right text-[12.5px] tabular-nums space-y-0.5">
              <p className="text-muted">
                {tr("Subtotal")}: <strong className="text-ink">{money(computedSubtotal)}</strong> ·{" "}
                {tr("Discount ৳")}: <strong className="text-ink">{money(discountNum)}</strong>
              </p>
              <p className="text-[14px] font-semibold text-ink">
                {tr("Total")}: {money(computedTotal)}
              </p>
            </div>
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <button
              type="button"
              onClick={() => {
                resetForm();
                setFormOpen(false);
              }}
              className={btn("secondary", "sm")}
            >
              {tr("Cancel")}
            </button>
            <button type="submit" disabled={saving} className={btn("primary", "sm")}>
              {saving
                ? tr("Saving…")
                : editingId
                  ? tr("Save changes")
                  : tr("Save record")}
            </button>
          </div>
        </form>
      ) : null}

      <div className="overflow-x-auto rounded-[6px] border border-line">
        <table className="w-full text-left border-collapse">
          <thead>
            <tr className="border-b border-line bg-subtle">
              <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap">
                {tr("Invoice")}
              </th>
              <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap">
                {tr("Customer")}
              </th>
              {!compact ? (
                <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap">
                  {tr("Date")}
                </th>
              ) : null}
              <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap min-w-[115px]">
                {tr("Status")}
              </th>
              <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap text-right">
                {tr("Total ৳")}
              </th>
              <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap text-right">
                {tr("Paid ৳")}
              </th>
              {!compact ? (
                <th className="px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap text-right">
                  {tr("Balance ৳")}
                </th>
              ) : null}
              <th className="sticky right-0 z-10 border-l border-line bg-subtle px-3 py-2.5 text-[12px] font-medium text-muted whitespace-nowrap text-right shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.2)]">
                {tr("Actions")}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-line text-[13.5px]">
            {invoicesQuery.isLoading ? (
              <tr>
                <td colSpan={compact ? 6 : 8} className="px-4 py-8 text-center text-[13px] text-muted">
                  {tr("Loading…", "লোড হচ্ছে…")}
                </td>
              </tr>
            ) : invoices.length === 0 ? (
              <tr>
                <td colSpan={compact ? 6 : 8} className="px-4 py-10 text-center text-[13px] text-muted">
                  {tr("No records yet.")}
                </td>
              </tr>
            ) : (
              invoices.map((inv) => (
                <tr key={inv.invoice_id} className="group hover:bg-wash transition-colors">
                  <td className="px-3 py-2.5 whitespace-nowrap">
                    <Link
                      href={`/milk-sales/invoices/${inv.invoice_id}`}
                      className="font-medium text-accent hover:underline"
                    >
                      {inv.invoice_number}
                    </Link>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-ink">
                    {inv.customer_name ?? "—"}
                  </td>
                  {!compact ? (
                    <td className="px-3 py-2.5 whitespace-nowrap text-ink tabular-nums">
                      {fmtDate(inv.invoice_date)}
                    </td>
                  ) : null}
                  <td className="px-3 py-2.5 whitespace-nowrap min-w-[115px]">
                    <Badge tone={statusTone(inv.status)}>{enumLabel(inv.status)}</Badge>
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums text-ink">
                    {money(inv.total_amount)}
                  </td>
                  <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums text-ink">
                    {money(inv.paid_amount)}
                  </td>
                  {!compact ? (
                    <td className="px-3 py-2.5 whitespace-nowrap text-right tabular-nums text-ink">
                      {money(inv.outstanding_balance)}
                    </td>
                  ) : null}
                  <td className="sticky right-0 z-10 border-l border-line bg-surface px-3 py-2.5 whitespace-nowrap text-right shadow-[-6px_0_10px_-8px_rgba(0,0,0,0.2)]">
                    <div className="flex items-center justify-end gap-2.5 text-[12px]">
                      {inv.status === "void" ? (
                        <button
                          type="button"
                          onClick={() => void reissueInvoice(inv)}
                          className="font-medium text-accent hover:underline cursor-pointer"
                        >
                          {tr("Reissue", "পুনরায় ইস্যু")}
                        </button>
                      ) : (
                        <>
                          <button
                            type="button"
                            onClick={() => startEdit(inv)}
                            className="font-medium text-accent hover:underline cursor-pointer"
                          >
                            {tr("Edit")}
                          </button>
                          <button
                            type="button"
                            onClick={() => requestVoid(inv)}
                            className="font-medium text-warn hover:underline cursor-pointer"
                          >
                            {tr("Void")}
                          </button>
                        </>
                      )}
                      <SafeDataHistory
                        entityType="sales_invoices"
                        entityId={inv.invoice_id}
                        entityLabel={inv.invoice_number}
                      />
                    </div>
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </section>
  );
}
