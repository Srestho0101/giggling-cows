"use client";

import React, { useEffect, useState } from "react";
import { Utensils, DollarSign, Plus, X, Calendar, Layers } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Cow, Expense, ExpenseCategory, FeedType, FeedingRecord } from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function FeedingPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<"feeding" | "expenses">("feeding");
  const [feedingRecords, setFeedingRecords] = useState<FeedingRecord[]>([]);
  const [expenses, setExpenses] = useState<Expense[]>([]);
  const [feedTypes, setFeedTypes] = useState<FeedType[]>([]);
  const [categories, setCategories] = useState<ExpenseCategory[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isFeedModalOpen, setIsFeedModalOpen] = useState(false);
  const [isExpenseModalOpen, setIsExpenseModalOpen] = useState(false);

  // Forms
  const [feedForm, setFeedForm] = useState({
    feed_type_id: "",
    cow_id: "",
    feeding_date: new Date().toISOString().split("T")[0],
    quantity: "10",
    notes: "",
  });

  const [expenseForm, setExpenseForm] = useState({
    category_id: "",
    cow_id: "",
    expense_date: new Date().toISOString().split("T")[0],
    amount: "",
    description: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const auth = getAuthHeaders();
      const [feedRecs, expRecs, fTypes, cats, cowsRes] = await Promise.all([
        api.getFeedingRecords(auth),
        api.getExpenses(auth),
        api.getFeedTypes(auth),
        api.getExpenseCategories(auth),
        api.getCows({ status: "active" }, auth),
      ]);
      setFeedingRecords(feedRecs);
      setExpenses(expRecs);
      setFeedTypes(fTypes);
      setCategories(cats);
      setCows(cowsRes);

      if (fTypes.length > 0 && !feedForm.feed_type_id) {
        setFeedForm((prev) => ({ ...prev, feed_type_id: fTypes[0].feed_type_id }));
      }
      if (cats.length > 0 && !expenseForm.category_id) {
        setExpenseForm((prev) => ({ ...prev, category_id: cats[0].category_id }));
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

  const handleCreateFeeding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createFeedingRecord(
        {
          feed_type_id: feedForm.feed_type_id,
          cow_id: feedForm.cow_id || undefined,
          feeding_date: feedForm.feeding_date,
          quantity: parseFloat(feedForm.quantity),
          notes: feedForm.notes || undefined,
        },
        getAuthHeaders()
      );
      setIsFeedModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateExpense = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createExpense(
        {
          category_id: expenseForm.category_id,
          cow_id: expenseForm.cow_id || undefined,
          expense_date: expenseForm.expense_date,
          amount: parseFloat(expenseForm.amount),
          description: expenseForm.description || undefined,
        },
        getAuthHeaders()
      );
      setIsExpenseModalOpen(false);
      setExpenseForm((prev) => ({ ...prev, amount: "", description: "" }));
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
            {t("feeding.title")}
          </h1>
          <p className="text-sm text-zinc-500">
            {t("feeding.subtitle")}
          </p>
        </div>

        <div className="flex items-center gap-2">
          <button
            onClick={() => setIsFeedModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
          >
            <Plus className="w-4 h-4" />
            <span>{t("feeding.log_feeding")}</span>
          </button>
          <button
            onClick={() => setIsExpenseModalOpen(true)}
            className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50 shadow-xs"
          >
            <DollarSign className="w-4 h-4 text-amber-500" />
            <span>{t("feeding.log_expense")}</span>
          </button>
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("feeding")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "feeding"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Utensils className="w-4 h-4" />
          <span>Feed Consumption Logs</span>
        </button>

        <button
          onClick={() => setActiveTab("expenses")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "expenses"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>General Farm Expenses</span>
        </button>
      </div>

      {/* FEED TYPES SUMMARY BAR */}
      <div className="grid grid-cols-2 sm:grid-cols-5 gap-3">
        {feedTypes.map((ft) => (
          <div
            key={ft.feed_type_id}
            className="p-3 bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 rounded-xl text-xs shadow-xs"
          >
            <span className="text-zinc-400 block">{locale === "bn" ? ft.name_bn : ft.name}</span>
            <span className="font-extrabold text-sm text-zinc-900 dark:text-zinc-100">
              ৳ {ft.unit_cost} <span className="text-[11px] font-normal text-zinc-400">/ {ft.unit}</span>
            </span>
          </div>
        ))}
      </div>

      {/* FEEDING RECORDS TABLE */}
      {activeTab === "feeding" ? (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Feed Type</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Quantity</th>
                  <th className="px-4 py-3">Total Cost</th>
                  <th className="px-4 py-3">Notes</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {feedingRecords.length === 0 ? (
                  <tr>
                    <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                      No feeding records logged yet.
                    </td>
                  </tr>
                ) : (
                  feedingRecords.map((fr) => (
                    <tr key={fr.feeding_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 text-zinc-500">{formatDate(fr.feeding_date, locale)}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                        {locale === "bn" ? fr.feed_name_bn : fr.feed_name}
                      </td>
                      <td className="px-4 py-3">
                        {fr.cow_tag_number ? (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-bold">
                            {fr.cow_tag_number}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Herd General</span>
                        )}
                      </td>
                      <td className="px-4 py-3 font-medium">
                        {fr.quantity} {fr.unit}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-emerald-600">
                        {formatBDT(fr.cost, locale)}
                      </td>
                      <td className="px-4 py-3 text-zinc-400">{fr.notes || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      ) : (
        /* EXPENSES TABLE */
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
                <tr>
                  <th className="px-4 py-3">Date</th>
                  <th className="px-4 py-3">Category</th>
                  <th className="px-4 py-3">Amount</th>
                  <th className="px-4 py-3">Target</th>
                  <th className="px-4 py-3">Description</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
                {expenses.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                      No general expenses logged yet.
                    </td>
                  </tr>
                ) : (
                  expenses.map((exp) => (
                    <tr key={exp.expense_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                      <td className="px-4 py-3 text-zinc-500">{formatDate(exp.expense_date, locale)}</td>
                      <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                        {locale === "bn" ? exp.category_name_bn : exp.category_name}
                      </td>
                      <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-zinc-100">
                        {formatBDT(exp.amount, locale)}
                      </td>
                      <td className="px-4 py-3">
                        {exp.cow_tag_number ? (
                          <span className="px-2 py-0.5 rounded-md bg-zinc-100 dark:bg-zinc-800 font-bold">
                            {exp.cow_tag_number}
                          </span>
                        ) : (
                          <span className="text-zinc-400 italic">Farm General</span>
                        )}
                      </td>
                      <td className="px-4 py-3 text-zinc-500">{exp.description || "-"}</td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {/* FEEDING MODAL */}
      {isFeedModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {t("feeding.log_feeding")}
              </h2>
              <button onClick={() => setIsFeedModalOpen(false)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateFeeding} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Feed Type *</label>
                <select
                  value={feedForm.feed_type_id}
                  onChange={(e) => setFeedForm({ ...feedForm, feed_type_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {feedTypes.map((ft) => (
                    <option key={ft.feed_type_id} value={ft.feed_type_id}>
                      {locale === "bn" ? ft.name_bn : ft.name} (৳ {ft.unit_cost} / {ft.unit})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Quantity *</label>
                  <input
                    type="number"
                    step="0.1"
                    required
                    value={feedForm.quantity}
                    onChange={(e) => setFeedForm({ ...feedForm, quantity: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={feedForm.feeding_date}
                    onChange={(e) => setFeedForm({ ...feedForm, feeding_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Target Cow (Optional)</label>
                <select
                  value={feedForm.cow_id}
                  onChange={(e) => setFeedForm({ ...feedForm, cow_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="">General Herd / All</option>
                  {cows.map((c) => (
                    <option key={c.cow_id} value={c.cow_id}>
                      {c.current_tag_number} ({c.category})
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsFeedModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Feeding Log
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* EXPENSE MODAL */}
      {isExpenseModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                {t("feeding.log_expense")}
              </h2>
              <button onClick={() => setIsExpenseModalOpen(false)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateExpense} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Expense Category *</label>
                <select
                  value={expenseForm.category_id}
                  onChange={(e) => setExpenseForm({ ...expenseForm, category_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {categories.map((c) => (
                    <option key={c.category_id} value={c.category_id}>
                      {locale === "bn" ? c.name_bn : c.name} ({c.category_group})
                    </option>
                  ))}
                </select>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Amount (BDT) *</label>
                  <input
                    type="number"
                    step="0.01"
                    required
                    value={expenseForm.amount}
                    onChange={(e) => setExpenseForm({ ...expenseForm, amount: e.target.value })}
                    placeholder="e.g. 1500"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Date *</label>
                  <input
                    type="date"
                    required
                    value={expenseForm.expense_date}
                    onChange={(e) => setExpenseForm({ ...expenseForm, expense_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={expenseForm.description}
                  onChange={(e) => setExpenseForm({ ...expenseForm, description: e.target.value })}
                  placeholder="e.g. New cow rope and chaff cutter maintenance"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsExpenseModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Expense
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
