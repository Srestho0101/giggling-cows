"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { apiRequest, apiRoutes } from "@/lib/api";

type Invoice = Record<string, unknown> & { lines?: Record<string, unknown>[]; payments?: Record<string, unknown>[] };

export default function InvoiceDetailPage() {
  const { invoiceId } = useParams<{ invoiceId: string }>();
  const [invoice, setInvoice] = useState<Invoice | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const load = useCallback(async () => {
    setError("");
    try { setInvoice(await apiRequest<Invoice>(apiRoutes.sales.invoice(invoiceId))); }
    catch (cause) { setError(cause instanceof Error ? cause.message : "Could not load invoice."); }
  }, [invoiceId]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);

  async function addPayment(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault(); const form = event.currentTarget; const data = new FormData(form);
    setSaving(true); setError(""); setNotice("");
    try {
      await apiRequest(apiRoutes.sales.invoicePayments(invoiceId), { method: "POST", body: { payment_date: data.get("payment_date"), amount: Number(data.get("amount")), payment_method: data.get("payment_method"), reference_number: data.get("reference_number") || null, notes: data.get("notes") || null } });
      form.reset(); await load(); setNotice("Payment recorded.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not record payment."); }
    finally { setSaving(false); }
  }

  async function voidPayment(paymentId: string) {
    const reason = window.prompt("Reason for voiding this payment:", "Erroneous payment entry");
    if (reason === null) return;
    setError(""); setNotice("");
    try {
      await apiRequest(apiRoutes.sales.voidPayment(invoiceId, paymentId), {
        method: "PATCH",
        body: { void_reason: reason.trim() || "Voided by user" },
      });
      await load(); setNotice("Payment voided and invoice balance adjusted.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not void payment."); }
  }

  async function setStatus(status: "issued" | "void") {
    setError(""); setNotice("");
    try {
      const updated = await apiRequest<Invoice>(apiRoutes.sales.invoiceStatus(invoiceId), { method: "PATCH", body: { status } });
      setInvoice(updated); setNotice(status === "void" ? "Invoice voided." : "Invoice issued.");
    } catch (cause) { setError(cause instanceof Error ? cause.message : "Could not update invoice."); }
  }

  return <ModulePage title={invoice ? `Invoice ${String(invoice.invoice_number)}` : "Invoice"} subtitle="Invoice lines, payments, and status.">
    <Link href="/milk-sales" className="mb-4 inline-block text-xs font-medium text-emerald-800 hover:underline">← Back to milk and sales</Link>
    {error && <div className="mb-4"><Notice>{error}</Notice></div>}{notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
    {!invoice ? <p className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">Loading invoice…</p> : <div className="space-y-5">
      <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-4"><div><h2 className="text-lg font-semibold">{String(invoice.customer_name ?? "Customer")}</h2><p className="mt-1 text-sm text-stone-500">{String(invoice.invoice_date)} · Due {String(invoice.due_date ?? "—")} · <span className="capitalize">{String(invoice.status)}</span></p></div><div className="flex gap-2">{invoice.status === "draft" && <button onClick={() => void setStatus("issued")} className="rounded-md bg-emerald-800 px-3 py-2 text-sm text-white">Issue invoice</button>}{invoice.status !== "void" && <button onClick={() => void setStatus("void")} className="rounded-md border border-rose-200 px-3 py-2 text-sm text-rose-700">Void</button>}</div></div>
        <div className="mt-5 grid gap-3 sm:grid-cols-3">{[["Subtotal", invoice.subtotal], ["Total", invoice.total_amount], ["Outstanding", invoice.outstanding_balance]].map(([label, value]) => <div key={String(label)} className="rounded-lg bg-stone-50 p-3"><p className="text-xs text-stone-500">{String(label)}</p><p className="mt-1 font-semibold text-stone-900">৳ {String(value ?? "0.00")}</p></div>)}</div>
        <div className="mt-5 overflow-x-auto"><table className="w-full text-left text-sm"><thead className="text-xs text-stone-500"><tr><th className="py-2">Item</th><th className="py-2">Description</th><th className="py-2">Qty</th><th className="py-2">Unit price</th><th className="py-2">Line total</th></tr></thead><tbody className="divide-y divide-stone-100">{(invoice.lines ?? []).map((line) => <tr key={String(line.line_id)}><td className="py-3 capitalize">{String(line.item_type)}</td><td className="py-3">{String(line.description)}</td><td className="py-3">{String(line.quantity)}</td><td className="py-3">৳ {String(line.unit_price)}</td><td className="py-3">৳ {String(line.line_total)}</td></tr>)}</tbody></table></div>
      </section>
      <div className="grid gap-5 xl:grid-cols-[1fr_0.8fr]">
        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold">Payment history</h3>
          {invoice.payments?.length ? (
            <div className="divide-y divide-stone-100">
              {invoice.payments.map((payment) => {
                const isVoid = payment.status === "void";
                return (
                  <div key={String(payment.payment_id)} className="flex items-center justify-between gap-3 px-4 py-3 text-sm">
                    <div>
                      <div className="flex items-center gap-2">
                        <span className={isVoid ? "line-through text-stone-400" : "text-stone-800"}>
                          {String(payment.payment_date)} · {String(payment.payment_method ?? "payment")}
                        </span>
                        {isVoid && (
                          <span className="rounded bg-rose-50 px-2 py-0.5 text-[11px] font-medium text-rose-700">
                            Voided{payment.void_reason ? `: ${String(payment.void_reason)}` : ""}
                          </span>
                        )}
                      </div>
                      {Boolean(payment.reference_number) && (
                        <p className="text-xs text-stone-400">Ref: {String(payment.reference_number)}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-3">
                      <strong className={isVoid ? "line-through text-stone-400" : "text-stone-900"}>
                        ৳ {String(payment.amount)}
                      </strong>
                      {!isVoid && invoice.status !== "void" && (
                        <button
                          type="button"
                          onClick={() => void voidPayment(String(payment.payment_id))}
                          className="rounded border border-rose-200 px-2 py-1 text-xs font-medium text-rose-600 hover:bg-rose-50"
                        >
                          Void
                        </button>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <p className="p-6 text-sm text-stone-400">No payments recorded yet.</p>
          )}
        </section>
        <form onSubmit={addPayment} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm"><h3 className="text-sm font-semibold">Record a payment</h3><div className="mt-4 space-y-3"><label className={labelClass}>Payment date<input required name="payment_date" type="date" defaultValue={today()} className={inputClass} /></label><label className={labelClass}>Amount (৳)<input required name="amount" type="number" min="0.01" step="0.01" className={inputClass} /></label><label className={labelClass}>Method<select name="payment_method" className={inputClass}><option value="cash">Cash</option><option value="bank">Bank</option><option value="bKash">bKash</option><option value="Nagad">Nagad</option><option value="other">Other</option></select></label><label className={labelClass}>Reference<input name="reference_number" className={inputClass} /></label><label className={labelClass}>Notes<textarea name="notes" rows={2} className={inputClass} /></label></div><button disabled={saving} className="mt-4 rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white">{saving ? "Saving…" : "Save payment"}</button></form>
      </div>
    </div>}
  </ModulePage>;
}

const inputClass = "mt-1 block w-full rounded-md border border-stone-200 px-3 py-2 text-sm outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
const labelClass = "block text-xs font-medium text-stone-600";
function today() { const parts = new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka", year: "numeric", month: "2-digit", day: "2-digit" }).formatToParts(new Date()); const date = Object.fromEntries(parts.map((part) => [part.type, part.value])); return `${date.year}-${date.month}-${date.day}`; }
