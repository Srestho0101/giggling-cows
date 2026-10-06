"use client";

import React, { useEffect, useState } from "react";
import Link from "next/link";
import {
  Beef,
  Droplets,
  DollarSign,
  AlertTriangle,
  Calendar,
  PlusCircle,
  ArrowRight,
  TrendingUp,
  RefreshCw,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { DashboardOverview } from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function DashboardPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders } = useAuth();

  const [data, setData] = useState<DashboardOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const loadDashboard = async () => {
    try {
      setLoading(true);
      setError(null);
      const res = await api.getDashboard(getAuthHeaders());
      setData(res);
    } catch (err: any) {
      setError(err.message || "Failed to load dashboard data");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("dashboard.title")}
          </h1>
          <p className="text-sm text-zinc-500 dark:text-zinc-400">
            {t("dashboard.subtitle")}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            onClick={loadDashboard}
            disabled={loading}
            className="flex items-center gap-2 px-3 py-2 text-xs font-medium rounded-lg border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:bg-zinc-50 text-zinc-700 dark:text-zinc-300 transition shadow-xs"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? "animate-spin" : ""}`} />
            <span>Refresh</span>
          </button>
          <Link
            href="/herd"
            className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition shadow-xs"
          >
            <PlusCircle className="w-4 h-4" />
            <span>{t("herd.add_cow")}</span>
          </Link>
        </div>
      </div>

      {error && (
        <div className="p-4 rounded-xl bg-red-50 dark:bg-red-950/40 border border-red-200 dark:border-red-900 text-sm text-red-700 dark:text-red-300">
          <div className="font-semibold mb-1">Notice</div>
          {error}
        </div>
      )}

      {/* Primary KPI Grid */}
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {/* Total Herd */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("dashboard.total_herd")}
            </span>
            <div className="p-2 rounded-xl bg-emerald-50 dark:bg-emerald-950/50 text-emerald-600">
              <Beef className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {loading ? "..." : data?.total_cows ?? 0}
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-3">
            <span>
              <strong className="text-emerald-600">{data?.active_cows ?? 0}</strong> {t("dashboard.active_cows")}
            </span>
            <span>•</span>
            <span>
              <strong className="text-zinc-700 dark:text-zinc-300">{data?.sold_cows ?? 0}</strong> {t("dashboard.sold_cows")}
            </span>
          </div>
        </div>

        {/* Milk Production Today */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("dashboard.milk_today")}
            </span>
            <div className="p-2 rounded-xl bg-blue-50 dark:bg-blue-950/50 text-blue-600">
              <Droplets className="w-5 h-5" />
            </div>
          </div>
          <div className="text-3xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {loading ? "..." : `${data?.milk_today_liters ?? "0.00"} L`}
          </div>
          <div className="mt-2 text-xs text-zinc-500 flex items-center gap-2">
            <span>This week: {data?.milk_this_week_liters ?? "0.00"} L</span>
          </div>
        </div>

        {/* Monthly Revenue */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("dashboard.invoiced_revenue")}
            </span>
            <div className="p-2 rounded-xl bg-amber-50 dark:bg-amber-950/50 text-amber-600">
              <DollarSign className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-zinc-900 dark:text-zinc-100">
            {loading ? "..." : formatBDT(data?.month_invoiced_revenue, locale)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Cash collected: {formatBDT(data?.month_cash_collected, locale)}
          </div>
        </div>

        {/* Customer Receivables */}
        <div className="p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
          <div className="flex items-center justify-between text-zinc-500 dark:text-zinc-400 mb-2">
            <span className="text-xs font-medium uppercase tracking-wider">
              {t("dashboard.unpaid_receivables")}
            </span>
            <div className="p-2 rounded-xl bg-purple-50 dark:bg-purple-950/50 text-purple-600">
              <TrendingUp className="w-5 h-5" />
            </div>
          </div>
          <div className="text-2xl font-extrabold text-purple-600 dark:text-purple-400">
            {loading ? "..." : formatBDT(data?.total_unpaid_receivables, locale)}
          </div>
          <div className="mt-2 text-xs text-zinc-500">
            Monthly expenses: {formatBDT(data?.month_total_expenses, locale)}
          </div>
        </div>
      </div>

      {/* Action Alerts & Care Schedule */}
      <div className="p-6 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="w-5 h-5 text-amber-500" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {t("dashboard.action_alerts")}
            </h2>
          </div>
          <Link
            href="/health"
            className="text-xs font-medium text-emerald-600 hover:text-emerald-700 flex items-center gap-1"
          >
            <span>Health & Breeding</span>
            <ArrowRight className="w-3.5 h-3.5" />
          </Link>
        </div>

        {loading ? (
          <div className="py-8 text-center text-sm text-zinc-400">Loading alerts...</div>
        ) : !data?.alerts || data.alerts.length === 0 ? (
          <div className="py-6 text-center text-sm text-zinc-500 bg-zinc-50 dark:bg-zinc-800/40 rounded-xl">
            {t("dashboard.no_alerts")}
          </div>
        ) : (
          <div className="divide-y divide-zinc-100 dark:divide-zinc-800">
            {data.alerts.map((alert) => (
              <div
                key={alert.id}
                className="py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-2"
              >
                <div className="flex items-start gap-3">
                  <span className="px-2.5 py-1 rounded-md text-xs font-bold bg-zinc-100 dark:bg-zinc-800 text-zinc-800 dark:text-zinc-200">
                    {alert.cow_tag}
                  </span>
                  <div>
                    <div className="text-sm font-medium text-zinc-900 dark:text-zinc-100">
                      {alert.description}
                    </div>
                    <div className="text-xs text-zinc-500 flex items-center gap-1.5 mt-0.5">
                      <Calendar className="w-3.5 h-3.5" />
                      <span>Due: {formatDate(alert.due_date, locale)}</span>
                    </div>
                  </div>
                </div>

                <div>
                  {alert.days_overdue > 0 ? (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-red-100 text-red-800 dark:bg-red-950 dark:text-red-300">
                      {alert.days_overdue} {t("dashboard.days_overdue")}
                    </span>
                  ) : (
                    <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-semibold bg-amber-100 text-amber-800 dark:bg-amber-950 dark:text-amber-300">
                      {t("dashboard.due_today")}
                    </span>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Quick Navigation Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        <Link
          href="/evaluations"
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 transition group shadow-xs"
        >
          <div className="text-xs text-zinc-500 font-medium mb-1">Pre-purchase</div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition">
            {t("nav.evaluations")} →
          </div>
        </Link>
        <Link
          href="/feeding"
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 transition group shadow-xs"
        >
          <div className="text-xs text-zinc-500 font-medium mb-1">Daily Operations</div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition">
            {t("nav.feeding")} →
          </div>
        </Link>
        <Link
          href="/labor"
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 transition group shadow-xs"
        >
          <div className="text-xs text-zinc-500 font-medium mb-1">Attendance & Mill</div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition">
            {t("nav.labor")} →
          </div>
        </Link>
        <Link
          href="/sales"
          className="p-4 rounded-xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-emerald-500 transition group shadow-xs"
        >
          <div className="text-xs text-zinc-500 font-medium mb-1">Milk & Billing</div>
          <div className="text-sm font-bold text-zinc-900 dark:text-zinc-100 group-hover:text-emerald-600 transition">
            {t("nav.sales")} →
          </div>
        </Link>
      </div>
    </div>
  );
}
