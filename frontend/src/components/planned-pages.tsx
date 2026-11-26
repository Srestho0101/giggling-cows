"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { MilkRecorder } from "@/components/milk-recorder";
import { DataWorkbench, Notice } from "@/components/data-workbench";
import { SalesInvoicesManager } from "@/components/sales-invoices-manager";
import { Badge, btn, DateInput, StatTile, Tabs } from "@/components/ui";
import { useWorkspaceDate } from "@/components/workspace-date";
import { apiQuery, apiRequest, apiRoutes, apiUrl } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type Row = Record<string, unknown>;

type Dashboard = {
  total_cows: number;
  active_cows: number;
  sold_cows: number;
  deceased_cows: number;
  cows_by_category: Record<string, number>;
  cows_by_warehouse: Record<string, number>;
  milk_today_liters: number;
  milk_this_week_liters: number;
  milk_this_month_liters: number;
  month_invoiced_revenue: number;
  month_cash_collected: number;
  month_total_expenses: number;
  total_unpaid_receivables: number;
  alerts: {
    id: string;
    cow_tag: string;
    item_type: string;
    due_date: string;
    days_overdue: number;
    description: string;
  }[];
};

type Profitability = {
  start_date: string;
  end_date: string;
  milk_revenue: number;
  cow_sales_revenue: number;
  other_sales_revenue: number;
  total_invoiced_revenue: number;
  cash_collected: number;
  receivables_uncollected: number;
  cow_acquisition_cost: number;
  feed_consumption_cost: number;
  general_expenses: number;
  health_and_breeding_cost: number;
  labor_salary_paid: number;
  mill_charges: number;
  total_costs: number;
  accrual_net_profit: number;
  cash_net_margin: number;
  profit_margin_percent: number;
};

export function TodaySubtitle() {
  const { tr } = useI18n();
  return <>{tr("Daily farm tasks and entries")}</>;
}

export function TodayWorkspace() {
  const { tr, money, num, date: fmtDate } = useI18n();
  const { date, isReady } = useWorkspaceDate();
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<Dashboard>(apiRoutes.reports.dashboard),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  const milkDayQuery = useQuery({
    queryKey: ["milk-records", date],
    queryFn: () =>
      apiRequest<{ liters: number }[]>(
        apiQuery(apiRoutes.sales.milk, { start_date: date, end_date: date })
      ),
    enabled: isReady && Boolean(date),
    staleTime: 30_000,
  });

  const dashboard = dashboardQuery.data ?? null;
  const loading = dashboardQuery.isLoading;
  const error = dashboardQuery.error ? messageFor(dashboardQuery.error) : "";

  const todayMilkLiters =
    milkDayQuery.data?.reduce((sum, r) => sum + Number(r.liters || 0), 0) ?? 0;

  const dateQuery = apiQuery("", { start_date: date, end_date: date }).slice(1);

  return (
    <div className="space-y-4">
      {error && (
        <Notice>
          {error}{" "}
          <button
            type="button"
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["dashboard"] })}
            className="ml-2 underline cursor-pointer"
          >
            {tr("Retry")}
          </button>
        </Notice>
      )}

      {/* 4 Stat Tiles */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={date ? `${tr("Milk", "দুধ")} (${fmtDate(date)})` : tr("Milk for date", "আজকের দুধ")}
            value={milkDayQuery.isLoading ? "…" : `${num(todayMilkLiters)} L`}
            subtext={`${num(dashboard?.milk_this_week_liters ?? 0)} L ${tr("this week", "এই সপ্তাহে")}`}
          />
          <StatTile
            label={tr("Sales this month")}
            value={loading ? "…" : money(dashboard?.month_invoiced_revenue)}
            subtext={`${money(dashboard?.month_cash_collected)} ${tr("collected", "সংগৃহীত")}`}
          />
          <StatTile
            label={tr("Expenses this month")}
            value={loading ? "…" : money(dashboard?.month_total_expenses)}
            subtext={tr("Total recorded expenses")}
          />
          <StatTile
            label={tr("Receivables")}
            value={loading ? "…" : money(dashboard?.total_unpaid_receivables)}
            subtext={tr("Uncollected balance")}
          />
        </div>
      </section>

      {/* Two Columns on xl */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr] items-start">
        {/* Left Column: Record Milk + Expenses */}
        <div className="space-y-4">
          <MilkRecorder date={date} isReady={isReady} />

          <DataWorkbench
            title="Expenses"
            singularLabel="Expense"
            description={`Record farm expenses for ${fmtDate(date)}.`}
            path={apiRoutes.feeding.expenses}
            query={dateQuery}
            columns={[
              { key: "category_name", label: "Category" },
              { key: "amount", label: "Amount ৳" },
              { key: "description", label: "Description" },
            ]}
            fields={[
              {
                name: "category_id",
                label: "Category",
                type: "select",
                sourcePath: apiRoutes.feeding.categories,
                sourceValue: "category_id",
                required: true,
              },
              {
                name: "warehouse_id",
                label: "Shed",
                type: "select",
                sourcePath: apiRoutes.herd.warehouses,
                sourceValue: "warehouse_id",
              },
              {
                name: "expense_date",
                label: "Date",
                type: "date",
                required: true,
                defaultValue: date,
              },
              { name: "amount", label: "Amount ৳", type: "number", required: true },
              { name: "description", label: "Description", type: "textarea" },
            ]}
          />
        </div>

        {/* Right Column: Herd alerts + Sales invoices */}
        <div className="space-y-4">
          {/* Herd Alerts Card */}
          <section className="rounded-[8px] border border-line bg-surface p-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{tr("Herd alerts")}</h2>
                <p className="text-[12px] text-muted">
                  {num(dashboard?.active_cows ?? 0, 0)} {tr("active of", "সক্রিয় / মোট")}{" "}
                  {num(dashboard?.total_cows ?? 0, 0)} {tr("cows", "টি গরু")}
                </p>
              </div>
              <Badge tone={dashboard?.alerts?.length ? "warn" : "neutral"}>
                {num(dashboard?.alerts?.length ?? 0, 0)}
              </Badge>
            </div>
            {loading ? (
              <p className="mt-3 text-[13px] text-muted">{tr("Loading alerts…")}</p>
            ) : dashboard?.alerts?.length ? (
              <div className="mt-3 space-y-2">
                {dashboard.alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start justify-between gap-3 rounded-[6px] border border-line bg-subtle p-3"
                  >
                    <div>
                      <p className="text-[13px] font-semibold text-ink">{alert.description}</p>
                      <p className="mt-0.5 text-[12px] text-muted">
                        {tr("Cow")} {alert.cow_tag} · {alert.item_type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <Badge tone={alert.days_overdue > 0 ? "bad" : "warn"}>
                      {alert.days_overdue > 0
                        ? `${num(alert.days_overdue, 0)}d ${tr("overdue", "বিলম্বিত")}`
                        : fmtDate(alert.due_date)}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted">{tr("No care alerts right now.")}</p>
            )}
          </section>

          {/* Sales Invoices */}
          <SalesInvoicesManager defaultDate={date} filterDate={date} compact />
        </div>
      </div>
    </div>
  );
}

export function ReportsWorkspace() {
  const { tr, money, num, enumLabel } = useI18n();
  const [tab, setTab] = useState("profitability");
  const [start, setStart] = useState(monthStart());
  const [end, setEnd] = useState(today());
  const [report, setReport] = useState<Profitability | null>(null);
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [milkRows, setMilkRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [refreshKey, setRefreshKey] = useState(0);

  const tabs = [
    { key: "profitability", label: tr("Profitability") },
    { key: "herd", label: tr("Herd summary") },
    { key: "milk", label: tr("Milk summary") },
  ] as const;

  const loadReport = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      setReport(
        await apiRequest<Profitability>(
          apiQuery(apiRoutes.reports.profitability, { start_date: start, end_date: end })
        )
      );
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [start, end]);

  useEffect(() => {
    if (tab !== "profitability") return;
    const timer = window.setTimeout(() => {
      void loadReport();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [tab, loadReport, refreshKey]);

  useEffect(() => {
    let timer: number | undefined;
    if (tab === "herd" && !dashboard) {
      timer = window.setTimeout(() => {
        setLoading(true);
        setError("");
        void apiRequest<Dashboard>(apiRoutes.reports.dashboard)
          .then(setDashboard)
          .catch((cause) => setError(messageFor(cause)))
          .finally(() => setLoading(false));
      }, 0);
    }
    if (tab === "milk") {
      timer = window.setTimeout(() => {
        setLoading(true);
        setError("");
        void apiRequest<Row[]>(
          apiQuery(apiRoutes.sales.milk, { start_date: start, end_date: end })
        )
          .then(setMilkRows)
          .catch((cause) => setError(messageFor(cause)))
          .finally(() => setLoading(false));
      }, 0);
    }
    return () => {
      if (timer !== undefined) window.clearTimeout(timer);
    };
  }, [tab, dashboard, start, end, refreshKey]);

  async function downloadCsvFile(endpoint: string, filename: string) {
    setError("");
    try {
      const response = await fetch(apiUrl(endpoint));
      if (!response.ok) throw new Error(`CSV export failed (${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = filename;
      link.click();
      URL.revokeObjectURL(url);
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  const milkTotal = milkRows.reduce((sum, row) => sum + Number(row.liters ?? 0), 0);
  const byCow = Object.entries(
    milkRows.reduce<Record<string, number>>((acc, row) => {
      const name = String(row.cow_tag_number ?? "Unknown");
      acc[name] = (acc[name] ?? 0) + Number(row.liters ?? 0);
      return acc;
    }, {})
  ).sort((a, b) => b[1] - a[1]);

  return (
    <div className="space-y-4">
      {/* Tab bar and Date filter row */}
      <div className="flex flex-wrap items-center justify-between gap-3 rounded-[8px] border border-line bg-surface p-3.5">
        <Tabs items={tabs} active={tab} onChange={setTab} />
        {tab === "herd" ? (
          <Badge tone="neutral">{tr("Current snapshot")}</Badge>
        ) : (
          <div className="flex flex-wrap items-end gap-2">
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("From")}</span>
              <DateInput value={start} max={end} onChange={(next) => { if (next) setStart(next); }} />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("To")}</span>
              <DateInput value={end} min={start} onChange={(next) => { if (next) setEnd(next); }} />
            </label>
          </div>
        )}
      </div>

      {error && (
        <Notice>
          {error}{" "}
          <button
            type="button"
            onClick={() => setRefreshKey((value) => value + 1)}
            className="ml-2 underline cursor-pointer"
          >
            {tr("Retry")}
          </button>
        </Notice>
      )}

      {tab === "profitability" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{tr("Profitability report")}</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {tr("Accrual revenue and costs for the selected period.", "নির্বাচিত সময়ের আয় ও খরচের বিবরণ।")}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void downloadCsvFile(
                  apiQuery(apiRoutes.reports.profitabilityCsv, { start_date: start, end_date: end }),
                  `profitability_${start}_${end}.csv`
                )
              }
              className={btn("secondary", "sm")}
            >
              {tr("Export CSV")}
            </button>
          </div>

          {loading ? (
            <Panel>{tr("Loading report…", "রিপোর্ট লোড হচ্ছে…")}</Panel>
          ) : report ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label={tr("Invoiced revenue")} value={money(report.total_invoiced_revenue)} />
                <StatTile label={tr("Total costs")} value={money(report.total_costs)} />
                <StatTile label={tr("Accrual net profit")} value={money(report.accrual_net_profit)} />
                <StatTile label={tr("Profit margin")} value={`${num(report.profit_margin_percent)}%`} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <Breakdown
                  title={tr("Revenue", "আয়")}
                  rows={[
                    [tr("Milk sales", "দুধ বিক্রয়"), report.milk_revenue],
                    [tr("Animal sales", "গরু বিক্রয়"), report.cow_sales_revenue],
                    [tr("Other sales", "অন্যান্য বিক্রয়"), report.other_sales_revenue],
                    [tr("Total invoiced", "মোট চালান"), report.total_invoiced_revenue],
                    [tr("Cash collected", "নগদ আদায়"), report.cash_collected],
                    [tr("Uncollected receivables", "অনাদায়ী বকেয়া"), report.receivables_uncollected],
                  ]}
                />
                <Breakdown
                  title={tr("Costs and net", "খরচ ও নিট")}
                  rows={[
                    [tr("Cow acquisition", "গরু ক্রয়"), report.cow_acquisition_cost],
                    [tr("Feed consumption", "খাদ্য খরচ"), report.feed_consumption_cost],
                    [tr("General expenses", "সাধারণ খরচ"), report.general_expenses],
                    [tr("Health and breeding", "স্বাস্থ্য ও প্রজনন"), report.health_and_breeding_cost],
                    [tr("Labor salaries paid", "কর্মীদের বেতন"), report.labor_salary_paid],
                    [tr("Mill charges", "বদলি ও মিল খরচ"), report.mill_charges],
                    [tr("Total costs"), report.total_costs],
                    [tr("Cash net margin", "নগদ নিট লাভ"), report.cash_net_margin],
                  ]}
                />
              </div>
            </>
          ) : (
            <Panel>{tr("Choose a date range to load the report.")}</Panel>
          )}
        </section>
      )}

      {tab === "herd" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{tr("Herd summary")}</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {tr("Current herd snapshot counts across categories and sheds.", "বর্তমান পালের ধরন ও শেড অনুযায়ী সংখ্যা।")}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void downloadCsvFile(
                  apiRoutes.reports.herdSummaryCsv,
                  `herd_summary_${today()}.csv`
                )
              }
              className={btn("secondary", "sm")}
            >
              {tr("Export CSV")}
            </button>
          </div>
          {dashboard ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label={tr("Total cows")} value={num(dashboard.total_cows, 0)} />
                <StatTile label={tr("Active")} value={num(dashboard.active_cows, 0)} />
                <StatTile label={tr("Sold")} value={num(dashboard.sold_cows, 0)} />
                <StatTile label={tr("Deceased")} value={num(dashboard.deceased_cows, 0)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <CountBreakdown
                  title={tr("By category")}
                  rows={Object.fromEntries(
                    Object.entries(dashboard.cows_by_category).map(([k, v]) => [enumLabel(k), v])
                  )}
                />
                <CountBreakdown title={tr("By shed")} rows={dashboard.cows_by_warehouse} />
              </div>
            </>
          ) : (
            <Panel>{loading ? tr("Loading herd summary…") : tr("No summary available.")}</Panel>
          )}
        </section>
      )}

      {tab === "milk" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{tr("Milk production summary")}</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {tr("Summed from individual cow session records in this period.", "নির্বাচিত সময়ের প্রতিটি গরুর দুধের হিসাব।")}
              </p>
            </div>
            <button
              type="button"
              onClick={() =>
                void downloadCsvFile(
                  apiQuery(apiRoutes.reports.milkSummaryCsv, { start_date: start, end_date: end }),
                  `milk_summary_${start}_${end}.csv`
                )
              }
              className={btn("secondary", "sm")}
            >
              {tr("Export CSV")}
            </button>
          </div>
          {loading ? (
            <Panel>{tr("Loading milk records…")}</Panel>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label={tr("Total production")} value={`${num(milkTotal)} L`} />
                <StatTile label={tr("Session records")} value={num(milkRows.length, 0)} />
                <StatTile
                  label={tr("Average per record")}
                  value={`${num(milkRows.length ? milkTotal / milkRows.length : 0)} L`}
                />
              </div>
              <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
                <div className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">
                  {tr("Production by cow")}
                </div>
                {byCow.length ? (
                  <div className="divide-y divide-line">
                    {byCow.map(([cow, liters]) => (
                      <div
                        key={cow}
                        className="flex justify-between px-4 py-2.5 text-[13px] hover:bg-wash transition-colors"
                      >
                        <span className="text-ink">{cow}</span>
                        <span className="font-semibold text-ink tabular-nums">
                          {num(liters)} L
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-8 text-center text-[13px] text-muted">
                    {tr("No milk records in this period.", "এই সময়ে কোনো দুধ রেকর্ড নেই।")}
                  </p>
                )}
              </div>
            </>
          )}
        </section>
      )}
    </div>
  );
}

export function MastersWorkspace() {
  const { tr } = useI18n();
  const [tab, setTab] = useState("warehouses");
  const tabs = [
    { key: "warehouses", label: tr("Sheds") },
    { key: "suppliers", label: tr("Suppliers") },
    { key: "categories", label: tr("Expense categories") },
    { key: "feed-types", label: tr("Feed types") },
    { key: "customers", label: tr("Customers") },
    { key: "market-prices", label: tr("Market prices") },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "warehouses" && (
        <DataWorkbench
          title="Sheds"
          singularLabel="Shed"
          description="Manage cattle sheds, housing type, capacity, and current occupancy."
          path={apiRoutes.herd.warehouses}
          updatePath={(row) => apiRoutes.herd.warehouse(String(row.warehouse_id))}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "warehouses",
            idKey: "warehouse_id",
            isInactive: (row) => row.is_archived === true,
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          deleteLabel="Archive"
          onDelete={async (row) => {
            await apiRequest(apiRoutes.herd.warehouse(String(row.warehouse_id)), {
              method: "PATCH",
              body: { is_archived: true },
            });
          }}
          columns={[
            { key: "name", label: "Name" },
            { key: "housing_type", label: "Housing type" },
            { key: "capacity", label: "Capacity" },
            { key: "current_occupancy", label: "Occupancy" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "housing_type", label: "Housing type", required: true, defaultValue: "shed" },
            { name: "capacity", label: "Capacity", type: "number", required: true, defaultValue: "10" },
          ]}
        />
      )}

      {tab === "suppliers" && (
        <DataWorkbench
          title="Suppliers"
          singularLabel="Supplier"
          description="Maintain suppliers used in purchases and herd records."
          path={apiRoutes.herd.suppliers}
          updatePath={(row) => apiRoutes.herd.supplier(String(row.supplier_id))}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "suppliers",
            idKey: "supplier_id",
            isInactive: (row) => row.is_archived === true,
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          deleteLabel="Archive"
          onDelete={async (row) => {
            await apiRequest(apiRoutes.herd.supplier(String(row.supplier_id)), {
              method: "PATCH",
              body: { is_archived: true },
            });
          }}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "supplier_type", label: "Type" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "phone", label: "Phone" },
            { name: "supplier_type", label: "Supplier type", required: true, defaultValue: "individual" },
          ]}
        />
      )}

      {tab === "categories" && (
        <DataWorkbench
          title="Expense categories"
          singularLabel="Expense category"
          description="Group expense categories as food or miscellaneous."
          path={apiRoutes.feeding.categories}
          updatePath={(row) => apiRoutes.feeding.category(String(row.category_id))}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "expense_categories",
            idKey: "category_id",
            isInactive: (row) => row.is_archived === true,
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          deleteLabel="Archive"
          onDelete={async (row) => {
            await apiRequest(apiRoutes.feeding.category(String(row.category_id)), {
              method: "PATCH",
              body: { is_archived: true },
            });
          }}
          columns={[
            { key: "name", label: "Name" },
            { key: "name_bn", label: "Bangla name" },
            { key: "category_group", label: "Group" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "name_bn", label: "Bangla name", required: true },
            {
              name: "category_group",
              label: "Group",
              type: "select",
              required: true,
              options: [
                { value: "food", label: "Food" },
                { value: "miscellaneous", label: "Miscellaneous" },
              ],
            },
          ]}
        />
      )}

      {tab === "feed-types" && (
        <DataWorkbench
          title="Feed types"
          singularLabel="Feed type"
          description="Manage feed items, units, stock levels, and per-unit costs."
          path={apiRoutes.feeding.feedTypes}
          updatePath={(row) => apiRoutes.feeding.feedType(String(row.feed_type_id))}
          invalidateKeys={[["feed-inventory-types"]]}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "feed_types",
            idKey: "feed_type_id",
            isInactive: (row) => row.is_archived === true,
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          deleteLabel="Archive"
          onDelete={async (row) => {
            await apiRequest(apiRoutes.feeding.feedType(String(row.feed_type_id)), {
              method: "PATCH",
              body: { is_archived: true },
            });
          }}
          columns={[
            { key: "name", label: "Name" },
            { key: "name_bn", label: "Bangla name" },
            { key: "category_name", label: "Category" },
            { key: "unit", label: "Unit" },
            { key: "unit_cost", label: "Unit cost ৳" },
            { key: "stock_quantity", label: "Current stock" },
            { key: "reorder_level", label: "Reorder level" },
          ]}
          fields={[
            {
              name: "category_id",
              label: "Expense category",
              type: "select",
              sourcePath: apiRoutes.feeding.categories,
              sourceValue: "category_id",
              required: true,
            },
            { name: "name", label: "Name", required: true },
            { name: "name_bn", label: "Bangla name", required: true },
            { name: "unit", label: "Unit", required: true, defaultValue: "kg" },
            { name: "unit_cost", label: "Cost per unit ৳", type: "number", required: true },
            { name: "stock_quantity", label: "Current stock", type: "number", defaultValue: "0" },
            { name: "reorder_level", label: "Reorder level", type: "number", defaultValue: "0" },
          ]}
        />
      )}

      {tab === "customers" && (
        <DataWorkbench
          title="Customers"
          singularLabel="Customer"
          description="Maintain buyers and monitor their account balances."
          path={apiRoutes.sales.customers}
          updatePath={(row) => apiRoutes.sales.customer(String(row.customer_id))}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "customers",
            idKey: "customer_id",
            isInactive: (row) => row.is_archived === true,
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          deleteLabel="Archive"
          onDelete={async (row) => {
            await apiRequest(apiRoutes.sales.customer(String(row.customer_id)), {
              method: "PATCH",
              body: { is_archived: true },
            });
          }}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "customer_type", label: "Type" },
            { key: "current_balance", label: "Balance ৳" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "phone", label: "Phone" },
            {
              name: "customer_type",
              label: "Customer type",
              type: "select",
              required: true,
              defaultValue: "individual",
              options: [
                { value: "individual", label: "Individual" },
                { value: "dairy_shop", label: "Dairy Shop" },
                { value: "wholesaler", label: "Wholesaler" },
                { value: "meat_buyer", label: "Meat Buyer" },
              ],
            },
          ]}
        />
      )}

      {tab === "market-prices" && (
        <DataWorkbench
          title="Market prices"
          singularLabel="Market price"
          description="Record dated market rates used as references for purchase evaluations."
          path={apiRoutes.evaluations.marketPrices}
          updatePath={(row) => apiRoutes.evaluations.marketPrice(String(row.market_price_id))}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "market_prices",
            idKey: "market_price_id",
            isInactive: (row) => row.is_archived === true,
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          deleteLabel="Archive"
          onDelete={async (row) => {
            await apiRequest(apiRoutes.evaluations.marketPrice(String(row.market_price_id)), {
              method: "PATCH",
              body: { is_archived: true },
            });
          }}
          columns={[
            { key: "price_date", label: "Date" },
            { key: "price_basis", label: "Price basis" },
            { key: "price_per_kg_net", label: "Net ৳/kg" },
            { key: "source", label: "Source" },
          ]}
          fields={[
            {
              name: "price_date",
              label: "Date",
              type: "date",
              required: true,
              defaultValue: today(),
            },
            {
              name: "price_basis",
              label: "Price basis",
              type: "select",
              required: true,
              defaultValue: "dressed_meat",
              options: [
                { value: "dressed_meat", label: "Dressed Meat" },
                { value: "live_weight", label: "Live Weight" },
              ],
            },
            { name: "price_per_kg_net", label: "Net price per kg ৳", type: "number", required: true },
            { name: "source", label: "Source" },
          ]}
        />
      )}
    </div>
  );
}

export function Metric({ label, value }: { label: string; value: string }) {
  return <StatTile label={label} value={value} />;
}

export function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) {
  const { money } = useI18n();
  return (
    <div className="rounded-[8px] border border-line bg-surface p-4">
      <h3 className="border-b border-line pb-2.5 text-[14px] font-semibold text-ink">{title}</h3>
      <div className="divide-y divide-line">
        {rows.map(([label, value], index) => (
          <div
            key={label}
            className={`flex justify-between gap-3 py-2 text-[13px] ${
              index === rows.length - 1 ? "font-semibold text-ink" : "text-muted"
            }`}
          >
            <span>{label}</span>
            <span className="text-ink tabular-nums">{money(value)}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

export function CountBreakdown({ title, rows }: { title: string; rows: Record<string, number> }) {
  const { num, tr } = useI18n();
  const entries = Object.entries(rows);
  return (
    <div className="rounded-[8px] border border-line bg-surface p-4">
      <h3 className="border-b border-line pb-2.5 text-[14px] font-semibold text-ink">{title}</h3>
      {entries.length ? (
        <div className="divide-y divide-line">
          {entries.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 text-[13px]">
              <span className="text-muted">{label.replaceAll("_", " ")}</span>
              <span className="font-semibold text-ink tabular-nums">{num(value, 0)}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-[13px] text-muted">{tr("No breakdown data.", "কোনো তথ্য নেই।")}</p>
      )}
    </div>
  );
}

export function Panel({ children }: { children: React.ReactNode }) {
  return (
    <div className="rounded-[8px] border border-line bg-surface p-8 text-center text-[13px] text-muted">
      {children}
    </div>
  );
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

function monthStart() {
  return `${today().slice(0, 7)}-01`;
}

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : "Request failed. Please try again.";
}
