"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Badge, btn, DateInput, statusTone, ui } from "@/components/ui";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Invoice = Record<string, unknown> & {
  lines?: Record<string, unknown>[];
  payments?: Record<string, unknown>[];
};

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const { tr, money, num, date: fmtDate, enumLabel } = useI18n();
  const queryClient = useQueryClient();

  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [paymentDate, setPaymentDate] = useState(today);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const invalidateRelated = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["sales-invoices"] }),
      queryClient.invalidateQueries({ queryKey: ["data-workbench"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["herd-cows"] }),
    ]);
  }, [queryClient]);

  const load = useCallback(async () => {
    setError("");
    try {
      setInvoice(await apiRequest<Invoice>(apiRoutes.sales.invoice(invoiceId)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load invoice.");
    }
  }, [invoiceId]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    const data = new FormData(form);
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.sales.invoicePayments(invoiceId), {
        method: "POST",
        body: {
          payment_date: paymentDate,
          amount: Number(data.get("amount")),
          payment_method: data.get("payment_method"),
          reference_number: data.get("reference_number") || null,
          notes: data.get("notes") || null,
        },
      });
      form.reset();
      setPaymentDate(today());
      await Promise.all([load(), invalidateRelated()]);
      setNotice(tr("Payment recorded.", "পেমেন্ট সংরক্ষিত হয়েছে।"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not record payment.");
    } finally {
      setSaving(false);
    }
  }

  function requestVoidPayment(paymentId: string) {
    setConfirmModal({
      title: tr("Void this payment?", "এই পেমেন্ট বাতিল করবেন?"),
      description: tr(
        "Voided payments remain in audit history and invoice balance will be recalculated.",
        "বাতিলকৃত পেমেন্ট অডিট ইতিহাসে থাকবে এবং চালানের বকেয়া পুনর্গণনা হবে।"
      ),
      mode: "reason",
      confirmLabel: tr("Void"),
      tone: "danger",
      reasonLabel: tr("Reason for voiding"),
      onConfirm: async (reason) => {
        await apiRequest(apiRoutes.sales.voidPayment(invoiceId, paymentId), {
          method: "PATCH",
          body: { void_reason: reason },
        });
        await Promise.all([load(), invalidateRelated()]);
        setNotice(tr("Payment voided and invoice balance adjusted.", "পেমেন্ট বাতিল করা হয়েছে এবং বকেয়া সমন্বয় হয়েছে।"));
      },
    });
  }

  async function issueOrVoid(status: "issued" | "void") {
    setError("");
    setNotice("");
    if (status === "void") {
      setConfirmModal({
        title: tr("Void this invoice?", "এই চালান বাতিল করবেন?"),
        mode: "reason",
        confirmLabel: tr("Void"),
        tone: "danger",
        reasonLabel: tr("Reason for voiding"),
        onConfirm: async (reason) => {
          const updated = await apiRequest<Invoice>(apiRoutes.sales.invoiceStatus(invoiceId), {
            method: "PATCH",
            body: { status: "void", void_reason: reason },
          });
          setInvoice(updated);
          await invalidateRelated();
          setNotice(tr("Invoice voided.", "চালান বাতিল করা হয়েছে।"));
        },
      });
      return;
    }

    try {
      const updated = await apiRequest<Invoice>(apiRoutes.sales.invoiceStatus(invoiceId), {
        method: "PATCH",
        body: { status: "issued" },
      });
      setInvoice(updated);
      await invalidateRelated();
      setNotice(tr("Invoice issued.", "চালান ইস্যু করা হয়েছে।"));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update invoice.");
    }
  }

  return (
    <ModulePage
      title={invoice ? `${tr("Invoice")} ${String(invoice.invoice_number)}` : tr("Invoice")}
      subtitle={tr("Invoice lines, payments, and status.", "চালানের আইটেম, পেমেন্ট এবং অবস্থা।")}
    >
      <Link href="/milk-sales" className={`mb-4 inline-block ${ui.link}`}>
        ← {tr("Back to milk and sales")}
      </Link>
      {error && (
        <div className="mb-4">
          <Notice>{error}</Notice>
        </div>
      )}
      {notice && (
        <div className="mb-4">
          <Notice tone="success">{notice}</Notice>
        </div>
      )}

      {!invoice ? (
        <p className="rounded-[8px] border border-line bg-surface p-8 text-center text-[13px] text-muted">
          {tr("Loading invoice…", "চালান লোড হচ্ছে…")}
        </p>
      ) : (
        <div className="space-y-5">
          <section className="rounded-[8px] border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-4">
              <div>
                <div className="flex flex-wrap items-center gap-2.5">
                  <h2 className="text-lg font-semibold text-ink">
                    {String(invoice.customer_name ?? tr("Customer"))}
                  </h2>
                  <Badge tone={statusTone(invoice.status)}>{enumLabel(invoice.status)}</Badge>
                </div>
                <p className="mt-1 text-[13px] text-muted tabular-nums">
                  {fmtDate(String(invoice.invoice_date ?? ""))} · {tr("Due date")}:{" "}
                  {invoice.due_date ? fmtDate(String(invoice.due_date)) : "—"}
                </p>
                {invoice.status === "void" && invoice.void_reason ? (
                  <p className="mt-1 text-xs text-warn">
                    {tr("Void reason")}: {String(invoice.void_reason)}
                  </p>
                ) : null}
                <div className="mt-2">
                  <SafeDataHistory
                    entityType="sales_invoices"
                    entityId={invoiceId}
                    entityLabel={String(invoice.invoice_number ?? "")}
                  />
                </div>
              </div>
              <div className="flex flex-wrap gap-2">
                {(invoice.status === "draft" || invoice.status === "void") && (
                  <button
                    type="button"
                    onClick={() => void issueOrVoid("issued")}
                    className={btn("primary", "md")}
                  >
                    {invoice.status === "void" ? tr("Reissue invoice") : tr("Issue invoice")}
                  </button>
                )}
                {invoice.status !== "void" && (
                  <button
                    type="button"
                    onClick={() => void issueOrVoid("void")}
                    className={btn("danger", "md")}
                  >
                    {tr("Void")}
                  </button>
                )}
              </div>
            </div>

            <div className="mt-5 grid gap-3 sm:grid-cols-3">
              {[
                [tr("Subtotal"), invoice.subtotal],
                [tr("Total"), invoice.total_amount],
                [tr("Balance ৳", "বকেয়া"), invoice.outstanding_balance],
              ].map(([label, value]) => (
                <div key={String(label)} className="rounded-[6px] border border-line bg-subtle p-3">
                  <p className="text-xs text-muted">{String(label)}</p>
                  <p className="mt-1 text-[16px] font-semibold text-ink tabular-nums">
                    {money(value ?? 0)}
                  </p>
                </div>
              ))}
            </div>

            <div className="mt-5 overflow-x-auto">
              <table className="w-full text-left text-[13px]">
                <thead className="border-b border-line text-xs text-muted">
                  <tr>
                    <th className="py-2 pr-3">{tr("Item")}</th>
                    <th className="py-2 pr-3">{tr("Description")}</th>
                    <th className="py-2 pr-3 text-right">{tr("Quantity")}</th>
                    <th className="py-2 pr-3 text-right">{tr("Unit price ৳")}</th>
                    <th className="py-2 text-right">{tr("Line total")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {(invoice.lines ?? []).map((line) => (
                    <tr key={String(line.line_id)}>
                      <td className="py-3 pr-3">{enumLabel(line.item_type)}</td>
                      <td className="py-3 pr-3">{String(line.description)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{num(line.quantity)}</td>
                      <td className="py-3 pr-3 text-right tabular-nums">{money(line.unit_price)}</td>
                      <td className="py-3 text-right font-medium tabular-nums">{money(line.line_total)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </section>

          <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
            <section className="overflow-hidden rounded-[8px] border border-line bg-surface">
              <h3 className="border-b border-line px-4 py-3 text-sm font-semibold text-ink">
                {tr("Payment history")}
              </h3>
              <p className="px-4 pt-3 text-xs text-muted">
                {tr(
                  "Voided payments stay in the audit history. Record a replacement payment to correct the invoice balance.",
                  "বাতিলকৃত পেমেন্ট অডিট ইতিহাসে সংরক্ষিত থাকে।"
                )}
              </p>
              {invoice.payments?.length ? (
                <div className="divide-y divide-line">
                  {invoice.payments.map((payment) => {
                    const isVoid = payment.status === "void";
                    return (
                      <div
                        key={String(payment.payment_id)}
                        className="flex flex-wrap items-center justify-between gap-3 px-4 py-3 text-sm"
                      >
                        <div>
                          <div className="flex flex-wrap items-center gap-2">
                            <span className={isVoid ? "line-through text-muted" : "text-ink"}>
                              {fmtDate(String(payment.payment_date ?? ""))} · {String(payment.payment_method ?? "payment")}
                            </span>
                            {isVoid && (
                              <Badge tone="bad">
                                {tr("Voided")}
                                {payment.void_reason ? `: ${String(payment.void_reason)}` : ""}
                              </Badge>
                            )}
                          </div>
                          {Boolean(payment.reference_number) && (
                            <p className="text-xs text-muted">Ref: {String(payment.reference_number)}</p>
                          )}
                        </div>
                        <div className="flex items-center gap-3">
                          <strong className={`tabular-nums ${isVoid ? "line-through text-muted" : "text-ink"}`}>
                            {money(payment.amount)}
                          </strong>
                          <SafeDataHistory
                            entityType="sale_payments"
                            entityId={String(payment.payment_id)}
                          />
                          {!isVoid && invoice.status !== "void" && (
                            <button
                              type="button"
                              onClick={() => requestVoidPayment(String(payment.payment_id))}
                              className={btn("danger", "sm")}
                            >
                              {tr("Void")}
                            </button>
                          )}
                        </div>
                      </div>
                    );
                  })}
                </div>
              ) : (
                <p className="p-6 text-sm text-muted">
                  {tr("No payments recorded yet.", "এখনও কোনো পেমেন্ট রেকর্ড করা হয়নি।")}
                </p>
              )}
            </section>

            <form onSubmit={(e) => void addPayment(e)} className="rounded-[8px] border border-line bg-surface p-5 space-y-3">
              <h3 className="text-sm font-semibold text-ink">{tr("Record a payment")}</h3>
              <label className="block text-xs font-medium text-ink">
                <span className="mb-1 block">{tr("Date")} *</span>
                <DateInput value={paymentDate} onChange={setPaymentDate} required />
              </label>
              <label className="block text-xs font-medium text-ink">
                <span className="mb-1 block">{tr("Amount ৳")} *</span>
                <input
                  required
                  name="amount"
                  type="number"
                  min="0.01"
                  step="0.01"
                  className={ui.input}
                />
              </label>
              <label className="block text-xs font-medium text-ink">
                <span className="mb-1 block">{tr("Method")}</span>
                <select name="payment_method" className={ui.select}>
                  <option value="cash">Cash</option>
                  <option value="bank">Bank</option>
                  <option value="bKash">bKash</option>
                  <option value="Nagad">Nagad</option>
                  <option value="other">Other</option>
                </select>
              </label>
              <label className="block text-xs font-medium text-ink">
                <span className="mb-1 block">{tr("Reference", "রেফারেন্স")}</span>
                <input name="reference_number" className={ui.input} />
              </label>
              <label className="block text-xs font-medium text-ink">
                <span className="mb-1 block">{tr("Notes")}</span>
                <textarea name="notes" rows={2} className={ui.textarea} />
              </label>
              <button disabled={saving} className={btn("primary", "md")}>
                {saving ? tr("Saving…") : tr("Save payment")}
              </button>
            </form>
          </div>
        </div>
      )}

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </ModulePage>
  );
}

function today() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const date = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return `${date.year}-${date.month}-${date.day}`;
}
