"use client";

import React, { useEffect, useState } from "react";
import {
  Receipt,
  Droplets,
  Users,
  Plus,
  X,
  CreditCard,
  CheckCircle,
  AlertCircle,
  Eye,
  Trash2,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Cow, Customer, MilkProduction, SalesInvoice } from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function SalesPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders, user } = useAuth();

  const [activeTab, setActiveTab] = useState<"invoices" | "customers" | "milk">("invoices");
  const [invoices, setInvoices] = useState<SalesInvoice[]>([]);
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [milkRecords, setMilkRecords] = useState<MilkProduction[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isInvoiceModalOpen, setIsInvoiceModalOpen] = useState(false);
  const [isCustomerModalOpen, setIsCustomerModalOpen] = useState(false);
  const [isMilkModalOpen, setIsMilkModalOpen] = useState(false);
  const [paymentInvoice, setPaymentInvoice] = useState<SalesInvoice | null>(null);
  const [viewInvoice, setViewInvoice] = useState<SalesInvoice | null>(null);

  // Forms
  const [invoiceForm, setInvoiceForm] = useState({
    customer_id: "",
    invoice_date: new Date().toISOString().split("T")[0],
    discount: "0",
    notes: "",
    lines: [
      {
        item_type: "milk" as "milk" | "animal" | "other",
        cow_id: "",
        description: "Fresh Cow Milk (কাঁচা দুধ)",
        quantity: "50",
        unit_price: "75",
      },
    ],
  });

  const [paymentForm, setPaymentForm] = useState({
    payment_date: new Date().toISOString().split("T")[0],
    amount: "",
    payment_method: "cash" as "cash" | "bKash" | "bank" | "Nagad" | "other",
    reference_number: "",
    notes: "",
  });

  const [customerForm, setCustomerForm] = useState({
    name: "",
    phone: "",
    customer_type: "dairy_shop" as "individual" | "dairy_shop" | "wholesaler" | "meat_buyer",
  });

  const [milkForm, setMilkForm] = useState({
    cow_id: "",
    production_date: new Date().toISOString().split("T")[0],
    session: "morning" as "morning" | "evening",
    liters: "12.5",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const auth = getAuthHeaders();
      const [invRes, custRes, milkRes, cowsRes] = await Promise.all([
        api.getInvoices(auth),
        api.getCustomers(auth),
        api.getMilkRecords(auth),
        api.getCows({ status: "active" }, auth),
      ]);
      setInvoices(invRes);
      setCustomers(custRes);
      setMilkRecords(milkRes);
      setCows(cowsRes);

      if (custRes.length > 0 && !invoiceForm.customer_id) {
        setInvoiceForm((prev) => ({ ...prev, customer_id: custRes[0].customer_id }));
      }
      if (cowsRes.length > 0 && !milkForm.cow_id) {
        setMilkForm((prev) => ({ ...prev, cow_id: cowsRes[0].cow_id }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, []);

  const handleAddLine = () => {
    setInvoiceForm((prev) => ({
      ...prev,
      lines: [
        ...prev.lines,
        {
          item_type: "milk",
          cow_id: "",
          description: "Fresh Milk",
          quantity: "10",
          unit_price: "75",
        },
      ],
    }));
  };

  const handleRemoveLine = (idx: number) => {
    setInvoiceForm((prev) => ({
      ...prev,
      lines: prev.lines.filter((_, i) => i !== idx),
    }));
  };

  const handleCreateInvoice = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload = {
        customer_id: invoiceForm.customer_id,
        invoice_date: invoiceForm.invoice_date,
        discount: parseFloat(invoiceForm.discount || "0"),
        notes: invoiceForm.notes || undefined,
        lines: invoiceForm.lines.map((l) => ({
          item_type: l.item_type,
          cow_id: l.item_type === "animal" ? l.cow_id || undefined : undefined,
          description: l.description,
          quantity: parseFloat(l.quantity),
          unit_price: parseFloat(l.unit_price),
        })),
      };

      await api.createInvoice(payload, getAuthHeaders());
      setIsInvoiceModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleIssueInvoice = async (invoiceId: string) => {
    if (!confirm("Are you sure you want to issue this invoice? Any sold cows will transition to status 'sold'.")) {
      return;
    }
    try {
      await api.updateInvoiceStatus(invoiceId, "issued", getAuthHeaders());
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleRecordPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!paymentInvoice) return;
    try {
      await api.recordPayment(
        paymentInvoice.invoice_id,
        {
          payment_date: paymentForm.payment_date,
          amount: parseFloat(paymentForm.amount),
          payment_method: paymentForm.payment_method,
          reference_number: paymentForm.reference_number || undefined,
          notes: paymentForm.notes || undefined,
        },
        getAuthHeaders()
      );
      setPaymentInvoice(null);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCustomer = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createCustomer(customerForm, getAuthHeaders());
      setIsCustomerModalOpen(false);
      setCustomerForm({ name: "", phone: "", customer_type: "dairy_shop" });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateMilk = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createMilkRecord(
        {
          cow_id: milkForm.cow_id,
          production_date: milkForm.production_date,
          session: milkForm.session,
          liters: parseFloat(milkForm.liters),
        },
        getAuthHeaders()
      );
      setIsMilkModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("sales.title")}
          </h1>
          <p className="text-sm text-zinc-500">{t("sales.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "invoices" && (
            <button
              onClick={() => setIsInvoiceModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("sales.create_invoice")}</span>
            </button>
          )}

          {activeTab === "customers" && (
            <button
              onClick={() => setIsCustomerModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>New Customer</span>
            </button>
          )}

          {activeTab === "milk" && (
            <button
              onClick={() => setIsMilkModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("sales.record_milk")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("invoices")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "invoices"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Receipt className="w-4 h-4" />
          <span>{t("sales.invoices_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("customers")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "customers"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t("sales.customers_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("milk")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "milk"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Droplets className="w-4 h-4" />
          <span>{t("sales.milk_tab")}</span>
        </button>
      </div>

      {/* INVOICES TAB */}
      {activeTab === "invoices" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">{t("sales.invoice_number")}</th>
                <th className="px-4 py-3">{t("sales.customer")}</th>
                <th className="px-4 py-3">{t("sales.date")}</th>
                <th className="px-4 py-3">{t("sales.amount")}</th>
                <th className="px-4 py-3">{t("sales.paid")}</th>
                <th className="px-4 py-3 font-bold text-purple-600">{t("sales.balance")}</th>
                <th className="px-4 py-3">{t("sales.status")}</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {invoices.length === 0 ? (
                <tr>
                  <td colSpan={8} className="px-4 py-6 text-center text-zinc-400">
                    No sales invoices created yet.
                  </td>
                </tr>
              ) : (
                invoices.map((inv) => (
                  <tr key={inv.invoice_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 font-black text-zinc-900 dark:text-zinc-100">
                      {inv.invoice_number}
                    </td>
                    <td className="px-4 py-3 font-medium">{inv.customer_name}</td>
                    <td className="px-4 py-3 text-zinc-500">{formatDate(inv.invoice_date, locale)}</td>
                    <td className="px-4 py-3 font-bold">{formatBDT(inv.total_amount, locale)}</td>
                    <td className="px-4 py-3 text-emerald-600 font-bold">
                      {formatBDT(inv.paid_amount, locale)}
                    </td>
                    <td className="px-4 py-3 font-black text-purple-600">
                      {formatBDT(inv.outstanding_balance, locale)}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-bold uppercase ${
                          inv.status === "paid"
                            ? "bg-emerald-100 text-emerald-800"
                            : inv.status === "partially_paid"
                            ? "bg-blue-100 text-blue-800"
                            : inv.status === "issued"
                            ? "bg-amber-100 text-amber-800"
                            : "bg-zinc-200 text-zinc-800"
                        }`}
                      >
                        {inv.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right flex items-center justify-end gap-2">
                      <button
                        onClick={() => setViewInvoice(inv)}
                        className="p-1 rounded-md text-zinc-400 hover:text-zinc-700"
                        title="View Lines"
                      >
                        <Eye className="w-4 h-4" />
                      </button>

                      {inv.status === "draft" && (
                        <button
                          onClick={() => handleIssueInvoice(inv.invoice_id)}
                          className="px-2 py-1 rounded bg-zinc-800 text-white font-semibold text-[11px] hover:bg-black"
                        >
                          Issue
                        </button>
                      )}

                      {["issued", "partially_paid"].includes(inv.status) &&
                        user.permissions.can_record_payments && (
                          <button
                            onClick={() => {
                              setPaymentInvoice(inv);
                              setPaymentForm({
                                payment_date: new Date().toISOString().split("T")[0],
                                amount: inv.outstanding_balance,
                                payment_method: "cash",
                                reference_number: "",
                                notes: "",
                              });
                            }}
                            className="px-2 py-1 rounded bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-500"
                          >
                            Pay
                          </button>
                        )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CUSTOMERS TAB */}
      {activeTab === "customers" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Customer Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Total Invoiced</th>
                <th className="px-4 py-3">Total Paid</th>
                <th className="px-4 py-3 font-bold text-purple-600">Balance Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {customers.map((c) => (
                <tr key={c.customer_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{c.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{c.phone || "-"}</td>
                  <td className="px-4 py-3 capitalize">{c.customer_type.replace("_", " ")}</td>
                  <td className="px-4 py-3">{formatBDT(c.total_invoiced, locale)}</td>
                  <td className="px-4 py-3 text-emerald-600">{formatBDT(c.total_paid, locale)}</td>
                  <td className="px-4 py-3 font-black text-purple-600">
                    {formatBDT(c.current_balance, locale)}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* MILK TAB */}
      {activeTab === "milk" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cow Tag</th>
                <th className="px-4 py-3">Session</th>
                <th className="px-4 py-3 font-bold">Liters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {milkRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-4 py-6 text-center text-zinc-400">
                    No milk production logged yet.
                  </td>
                </tr>
              ) : (
                milkRecords.map((m) => (
                  <tr key={m.milk_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(m.production_date, locale)}</td>
                    <td className="px-4 py-3 font-bold">{m.cow_tag_number}</td>
                    <td className="px-4 py-3 capitalize font-semibold">{m.session}</td>
                    <td className="px-4 py-3 font-black text-blue-600 text-sm">{m.liters} L</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* CREATE INVOICE MODAL */}
      {isInvoiceModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-lg font-bold">{t("sales.create_invoice")}</h2>
              <button onClick={() => setIsInvoiceModalOpen(false)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateInvoice} className="space-y-4 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Customer *</label>
                  <select
                    value={invoiceForm.customer_id}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, customer_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    {customers.map((c) => (
                      <option key={c.customer_id} value={c.customer_id}>
                        {c.name} ({c.customer_type})
                      </option>
                    ))}
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Invoice Date *</label>
                  <input
                    type="date"
                    required
                    value={invoiceForm.invoice_date}
                    onChange={(e) => setInvoiceForm({ ...invoiceForm, invoice_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              {/* Invoice Lines */}
              <div className="space-y-3">
                <div className="flex items-center justify-between">
                  <span className="font-bold text-sm">Invoice Line Items</span>
                  <button
                    type="button"
                    onClick={handleAddLine}
                    className="px-2.5 py-1 rounded bg-zinc-100 hover:bg-zinc-200 text-zinc-700 font-semibold"
                  >
                    + Add Item
                  </button>
                </div>

                {invoiceForm.lines.map((line, idx) => (
                  <div
                    key={idx}
                    className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl space-y-2 border border-zinc-200 dark:border-zinc-700"
                  >
                    <div className="grid grid-cols-12 gap-2">
                      <div className="col-span-3">
                        <label className="block text-[11px] font-semibold mb-0.5">Item Type</label>
                        <select
                          value={line.item_type}
                          onChange={(e) => {
                            const val = e.target.value as any;
                            const newLines = [...invoiceForm.lines];
                            newLines[idx].item_type = val;
                            newLines[idx].description =
                              val === "milk"
                                ? "Fresh Milk"
                                : val === "animal"
                                ? "Live Cattle Sale"
                                : "Other Sale";
                            setInvoiceForm({ ...invoiceForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        >
                          <option value="milk">Milk (দুধ)</option>
                          <option value="animal">Animal / Cow (গরু বিক্রয়)</option>
                          <option value="other">Other (অন্যান্য)</option>
                        </select>
                      </div>

                      {line.item_type === "animal" && (
                        <div className="col-span-3">
                          <label className="block text-[11px] font-semibold mb-0.5">Select Cow *</label>
                          <select
                            value={line.cow_id}
                            onChange={(e) => {
                              const newLines = [...invoiceForm.lines];
                              newLines[idx].cow_id = e.target.value;
                              setInvoiceForm({ ...invoiceForm, lines: newLines });
                            }}
                            className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                          >
                            <option value="">Select Cow</option>
                            {cows.map((c) => (
                              <option key={c.cow_id} value={c.cow_id}>
                                {c.current_tag_number} ({c.category})
                              </option>
                            ))}
                          </select>
                        </div>
                      )}

                      <div className={line.item_type === "animal" ? "col-span-3" : "col-span-5"}>
                        <label className="block text-[11px] font-semibold mb-0.5">Description</label>
                        <input
                          type="text"
                          value={line.description}
                          onChange={(e) => {
                            const newLines = [...invoiceForm.lines];
                            newLines[idx].description = e.target.value;
                            setInvoiceForm({ ...invoiceForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold mb-0.5">Quantity</label>
                        <input
                          type="number"
                          step="0.1"
                          value={line.quantity}
                          onChange={(e) => {
                            const newLines = [...invoiceForm.lines];
                            newLines[idx].quantity = e.target.value;
                            setInvoiceForm({ ...invoiceForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                      </div>

                      <div className="col-span-2">
                        <label className="block text-[11px] font-semibold mb-0.5">Unit Price</label>
                        <input
                          type="number"
                          value={line.unit_price}
                          onChange={(e) => {
                            const newLines = [...invoiceForm.lines];
                            newLines[idx].unit_price = e.target.value;
                            setInvoiceForm({ ...invoiceForm, lines: newLines });
                          }}
                          className="w-full px-2 py-1.5 text-xs rounded border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                        />
                      </div>

                      {invoiceForm.lines.length > 1 && (
                        <div className="col-span-1 flex items-end justify-center pb-1">
                          <button
                            type="button"
                            onClick={() => handleRemoveLine(idx)}
                            className="text-red-500 hover:text-red-700"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      )}
                    </div>
                  </div>
                ))}
              </div>

              <div>
                <label className="block font-semibold mb-1">Discount (BDT)</label>
                <input
                  type="number"
                  value={invoiceForm.discount}
                  onChange={(e) => setInvoiceForm({ ...invoiceForm, discount: e.target.value })}
                  className="w-48 px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsInvoiceModalOpen(false)}
                  className="px-4 py-2 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500"
                >
                  Create Invoice
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD PAYMENT MODAL */}
      {paymentInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold">
              Record Payment ({paymentInvoice.invoice_number})
            </h2>
            <div className="p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl text-xs space-y-1">
              <div>Customer: <strong>{paymentInvoice.customer_name}</strong></div>
              <div>Outstanding Due: <strong className="text-purple-600">{formatBDT(paymentInvoice.outstanding_balance, locale)}</strong></div>
            </div>

            <form onSubmit={handleRecordPayment} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Payment Amount (BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={paymentForm.amount}
                  onChange={(e) => setPaymentForm({ ...paymentForm, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Payment Method</label>
                  <select
                    value={paymentForm.payment_method}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_method: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="cash">Cash (নগদ)</option>
                    <option value="bKash">bKash (বিকাশ)</option>
                    <option value="Nagad">Nagad (নগদ)</option>
                    <option value="bank">Bank Transfer</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Payment Date</label>
                  <input
                    type="date"
                    required
                    value={paymentForm.payment_date}
                    onChange={(e) => setPaymentForm({ ...paymentForm, payment_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Reference / TrxID (Optional)</label>
                <input
                  type="text"
                  value={paymentForm.reference_number}
                  onChange={(e) => setPaymentForm({ ...paymentForm, reference_number: e.target.value })}
                  placeholder="e.g. TRX123456"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setPaymentInvoice(null)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Confirm Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* VIEW INVOICE MODAL */}
      {viewInvoice && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold">
                Invoice Details: {viewInvoice.invoice_number}
              </h2>
              <button onClick={() => setViewInvoice(null)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <div className="text-xs space-y-2">
              <div className="flex justify-between">
                <span className="text-zinc-500">Customer:</span>
                <span className="font-bold">{viewInvoice.customer_name}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Date:</span>
                <span>{formatDate(viewInvoice.invoice_date, locale)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-zinc-500">Status:</span>
                <span className="font-bold uppercase">{viewInvoice.status}</span>
              </div>

              <div className="pt-2 border-t space-y-2">
                <span className="font-semibold block">Line Items:</span>
                <div className="divide-y divide-zinc-100 dark:divide-zinc-800 border rounded-lg p-2">
                  {viewInvoice.lines.map((l) => (
                    <div key={l.line_id} className="py-1.5 flex justify-between">
                      <div>
                        <span className="font-semibold">{l.description}</span>
                        {l.cow_tag_number && (
                          <span className="text-zinc-400 block text-[11px]">
                            Cow: {l.cow_tag_number}
                          </span>
                        )}
                        <span className="text-zinc-400 text-[11px] block">
                          {l.quantity} × {formatBDT(l.unit_price, locale)}
                        </span>
                      </div>
                      <span className="font-bold">{formatBDT(l.line_total, locale)}</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="pt-2 space-y-1 font-semibold text-right">
                <div>Subtotal: {formatBDT(viewInvoice.subtotal, locale)}</div>
                {parseFloat(viewInvoice.discount) > 0 && (
                  <div className="text-red-600">Discount: -{formatBDT(viewInvoice.discount, locale)}</div>
                )}
                <div className="text-sm font-black">Total: {formatBDT(viewInvoice.total_amount, locale)}</div>
                <div className="text-emerald-600">Paid: {formatBDT(viewInvoice.paid_amount, locale)}</div>
                <div className="text-purple-600">Balance: {formatBDT(viewInvoice.outstanding_balance, locale)}</div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* NEW CUSTOMER MODAL */}
      {isCustomerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold">New Customer</h2>
            <form onSubmit={handleCreateCustomer} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Customer Name *</label>
                <input
                  type="text"
                  required
                  value={customerForm.name}
                  onChange={(e) => setCustomerForm({ ...customerForm, name: e.target.value })}
                  placeholder="e.g. Dhaka Sweetmeat Shop"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Phone Number</label>
                <input
                  type="text"
                  value={customerForm.phone}
                  onChange={(e) => setCustomerForm({ ...customerForm, phone: e.target.value })}
                  placeholder="017xxxxxxxx"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Customer Type</label>
                <select
                  value={customerForm.customer_type}
                  onChange={(e) => setCustomerForm({ ...customerForm, customer_type: e.target.value as any })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="dairy_shop">Dairy Shop (মিষ্টির দোকান / দুধ বিক্রেতা)</option>
                  <option value="wholesaler">Wholesaler (পাইকারি)</option>
                  <option value="individual">Individual Household (বাসা-বাড়ি)</option>
                  <option value="meat_buyer">Meat / Cattle Buyer (কোরবানি / মাংসের ক্রেতা)</option>
                </select>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsCustomerModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Customer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD MILK MODAL */}
      {isMilkModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold">{t("sales.record_milk")}</h2>
            <form onSubmit={handleCreateMilk} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Dairy Cow *</label>
                <select
                  value={milkForm.cow_id}
                  onChange={(e) => setMilkForm({ ...milkForm, cow_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {cows
                    .filter((c) => c.category === "dairy" || c.sex === "female")
                    .map((c) => (
                      <option key={c.cow_id} value={c.cow_id}>
                        {c.current_tag_number} ({c.category})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Session</label>
                  <select
                    value={milkForm.session}
                    onChange={(e) => setMilkForm({ ...milkForm, session: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="morning">Morning (সকাল)</option>
                    <option value="evening">Evening (বিকাল)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Liters *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={milkForm.liters}
                    onChange={(e) => setMilkForm({ ...milkForm, liters: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Date</label>
                <input
                  type="date"
                  required
                  value={milkForm.production_date}
                  onChange={(e) => setMilkForm({ ...milkForm, production_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsMilkModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Milk Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
