"use client";

import React, { useCallback, useEffect, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { AttendanceWorkspace } from "@/components/operational-pages";
import { MilkRecorder } from "@/components/milk-recorder";
import { DataWorkbench, Notice } from "@/components/data-workbench";
import { Badge, btn, StatTile, Tabs, ui } from "@/components/ui";
import { useWorkspaceDate } from "@/components/workspace-date";
import { apiQuery, apiRequest, apiRoutes, apiUrl } from "@/lib/api";

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

export function TodayWorkspace() {
  const { date, isReady } = useWorkspaceDate();
  const queryClient = useQueryClient();

  const dashboardQuery = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<Dashboard>(apiRoutes.reports.dashboard),
    staleTime: 30_000,
    refetchOnWindowFocus: true,
    retry: 1,
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
            onClick={() => void queryClient.invalidateQueries({ queryKey: ["dashboard"] })}
            className="ml-2 underline cursor-pointer"
          >
            Retry
          </button>
        </Notice>
      )}

      {/* 4 Stat Tiles */}
      <section>
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
          <StatTile
            label={date ? `Milk (${date})` : "Milk for date"}
            value={milkDayQuery.isLoading ? "…" : `${fmt(todayMilkLiters)} L`}
            subtext={`${fmt(dashboard?.milk_this_week_liters)} L this week`}
          />
          <StatTile
            label="Sales this month"
            value={loading ? "…" : money(dashboard?.month_invoiced_revenue)}
            subtext={`${money(dashboard?.month_cash_collected)} collected`}
          />
          <StatTile
            label="Expenses this month"
            value={loading ? "…" : money(dashboard?.month_total_expenses)}
            subtext="Total recorded expenses"
          />
          <StatTile
            label="Receivables"
            value={loading ? "…" : money(dashboard?.total_unpaid_receivables)}
            subtext="Uncollected balance"
          />
        </div>
      </section>

      {/* Two Columns on xl (1.4fr / 1fr) */}
      <div className="grid gap-4 xl:grid-cols-[1.4fr_1fr] items-start">
        {/* Left Column: Record Milk + Expenses */}
        <div className="space-y-4">
          <MilkRecorder date={date} isReady={isReady} />

          <DataWorkbench
            title="Expenses"
            description={`Record farm expenses for ${date}.`}
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
                label: "Warehouse",
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

        {/* Right Column: Herd alerts + Attendance + Sales invoices */}
        <div className="space-y-4">
          {/* Herd Alerts Card */}
          <section className="rounded-[8px] border border-line bg-surface p-4">
            <div className="flex items-center justify-between border-b border-line pb-3">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">Herd alerts</h2>
                <p className="text-[12px] text-muted">
                  {dashboard?.active_cows ?? "—"} active of {dashboard?.total_cows ?? "—"} cows
                </p>
              </div>
              <Badge tone={dashboard?.alerts?.length ? "warn" : "neutral"}>
                {dashboard?.alerts?.length ?? 0}
              </Badge>
            </div>
            {loading ? (
              <p className="mt-3 text-[13px] text-muted">Loading alerts…</p>
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
                        Cow {alert.cow_tag} · {alert.item_type.replaceAll("_", " ")}
                      </p>
                    </div>
                    <Badge tone={alert.days_overdue > 0 ? "bad" : "warn"}>
                      {alert.days_overdue > 0 ? `${alert.days_overdue}d overdue` : alert.due_date}
                    </Badge>
                  </div>
                ))}
              </div>
            ) : (
              <p className="mt-3 text-[13px] text-muted">No care alerts right now.</p>
            )}
          </section>

          {/* Attendance Card (embedded) */}
          <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
            <div className="border-b border-line pb-2.5">
              <h2 className="text-[15px] font-semibold text-ink">Attendance</h2>
              <p className="text-[12px] text-muted">
                Worker attendance for {date || "selected date"}.
              </p>
            </div>
            <AttendanceWorkspace key={date} initialDate={date} embedded />
          </section>

          {/* Sales Invoices */}
          <DataWorkbench
            title="Sales invoices"
            description={`Create and review invoices dated ${date}.`}
            path={apiRoutes.sales.invoices}
            query={dateQuery}
            columns={[
              { key: "invoice_number", label: "Invoice" },
              { key: "customer_name", label: "Customer" },
              { key: "total_amount", label: "Total ৳" },
              { key: "paid_amount", label: "Paid ৳" },
              { key: "status", label: "Status" },
            ]}
            fields={[
              {
                name: "customer_id",
                label: "Customer",
                type: "select",
                sourcePath: apiRoutes.sales.customers,
                sourceValue: "customer_id",
                required: true,
              },
              {
                name: "invoice_date",
                label: "Invoice date",
                type: "date",
                required: true,
                defaultValue: date,
              },
              {
                name: "item_type",
                label: "Item type",
                type: "select",
                required: true,
                options: [
                  { value: "milk", label: "Milk" },
                  { value: "animal", label: "Animal" },
                  { value: "other", label: "Other" },
                ],
              },
              {
                name: "cow_id",
                label: "Cow (required for animal sales)",
                type: "select",
                sourcePath: apiRoutes.herd.cows,
                sourceValue: "cow_id",
                sourceLabel: "current_tag_number",
              },
              { name: "description", label: "Line description", required: true },
              { name: "quantity", label: "Quantity", type: "number", required: true },
              { name: "unit_price", label: "Unit price ৳", type: "number", required: true },
              { name: "discount", label: "Invoice discount ৳", type: "number" },
            ]}
            buildBody={(values) => ({
              customer_id: values.customer_id,
              invoice_date: values.invoice_date || date,
              discount: Number(values.discount || 0),
              lines: [
                {
                  item_type: values.item_type,
                  cow_id: values.cow_id || undefined,
                  description: values.description,
                  quantity: Number(values.quantity),
                  unit_price: Number(values.unit_price),
                },
              ],
            })}
          />
        </div>
      </div>
    </div>
  );
}

export function ReportsWorkspace() {
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
    { key: "profitability", label: "Profitability" },
    { key: "herd", label: "Herd summary" },
    { key: "milk", label: "Milk summary" },
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

  async function downloadCsv() {
    setError("");
    try {
      const response = await fetch(
        apiUrl(apiQuery(apiRoutes.reports.profitabilityCsv, { start_date: start, end_date: end }))
      );
      if (!response.ok) throw new Error(`CSV export failed (${response.status}).`);
      const blob = await response.blob();
      const url = URL.createObjectURL(blob);
      const link = document.createElement("a");
      link.href = url;
      link.download = `profitability_${start}_${end}.csv`;
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
        <div className="flex flex-wrap items-end gap-2">
          <label className="text-[12px] font-medium text-ink">
            <span className="block mb-1">From</span>
            <input
              type="date"
              value={start}
              max={end}
              onChange={(event) => setStart(event.target.value)}
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="block mb-1">To</span>
            <input
              type="date"
              value={end}
              min={start}
              onChange={(event) => setEnd(event.target.value)}
              className={ui.input}
            />
          </label>
        </div>
      </div>

      {error && (
        <Notice>
          {error}{" "}
          <button
            onClick={() => setRefreshKey((value) => value + 1)}
            className="ml-2 underline cursor-pointer"
          >
            Retry
          </button>
        </Notice>
      )}

      {tab === "profitability" && (
        <section className="space-y-4">
          <div className="flex flex-wrap items-end justify-between gap-3">
            <div>
              <h2 className="text-[16px] font-semibold text-ink">Profitability report</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                Accrual revenue and costs for the selected period.
              </p>
            </div>
            <button onClick={() => void downloadCsv()} className={btn("secondary", "sm")}>
              Export CSV
            </button>
          </div>

          {loading ? (
            <Panel>Loading report…</Panel>
          ) : report ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Invoiced revenue" value={money(report.total_invoiced_revenue)} />
                <StatTile label="Total costs" value={money(report.total_costs)} />
                <StatTile label="Accrual net profit" value={money(report.accrual_net_profit)} />
                <StatTile label="Profit margin" value={`${fmt(report.profit_margin_percent)}%`} />
              </div>
              <div className="grid gap-4 xl:grid-cols-2">
                <Breakdown
                  title="Revenue"
                  rows={[
                    ["Milk sales", report.milk_revenue],
                    ["Animal sales", report.cow_sales_revenue],
                    ["Other sales", report.other_sales_revenue],
                    ["Total invoiced", report.total_invoiced_revenue],
                    ["Cash collected", report.cash_collected],
                    ["Uncollected receivables", report.receivables_uncollected],
                  ]}
                />
                <Breakdown
                  title="Costs and net"
                  rows={[
                    ["Cow acquisition", report.cow_acquisition_cost],
                    ["Feed consumption", report.feed_consumption_cost],
                    ["General expenses", report.general_expenses],
                    ["Health and breeding", report.health_and_breeding_cost],
                    ["Labor salaries paid", report.labor_salary_paid],
                    ["Mill charges", report.mill_charges],
                    ["Total costs", report.total_costs],
                    ["Cash net margin", report.cash_net_margin],
                  ]}
                />
              </div>
            </>
          ) : (
            <Panel>Choose a date range to load the report.</Panel>
          )}
        </section>
      )}

      {tab === "herd" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Herd summary</h2>
            <p className="mt-0.5 text-[12px] text-muted">Current herd counts from the dashboard.</p>
          </div>
          {dashboard ? (
            <>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
                <StatTile label="Total cows" value={String(dashboard.total_cows)} />
                <StatTile label="Active" value={String(dashboard.active_cows)} />
                <StatTile label="Sold" value={String(dashboard.sold_cows)} />
                <StatTile label="Deceased" value={String(dashboard.deceased_cows)} />
              </div>
              <div className="grid gap-4 md:grid-cols-2">
                <CountBreakdown title="By category" rows={dashboard.cows_by_category} />
                <CountBreakdown title="By warehouse" rows={dashboard.cows_by_warehouse} />
              </div>
            </>
          ) : (
            <Panel>{loading ? "Loading herd summary…" : "No summary available."}</Panel>
          )}
        </section>
      )}

      {tab === "milk" && (
        <section className="space-y-4">
          <div>
            <h2 className="text-[16px] font-semibold text-ink">Milk production summary</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Summed from individual cow session records in this period.
            </p>
          </div>
          {loading ? (
            <Panel>Loading milk records…</Panel>
          ) : (
            <>
              <div className="grid gap-3 sm:grid-cols-3">
                <StatTile label="Total production" value={`${fmt(milkTotal)} L`} />
                <StatTile label="Session records" value={String(milkRows.length)} />
                <StatTile
                  label="Average per record"
                  value={`${fmt(milkRows.length ? milkTotal / milkRows.length : 0)} L`}
                />
              </div>
              <div className="overflow-hidden rounded-[8px] border border-line bg-surface">
                <div className="border-b border-line px-4 py-3 text-[13px] font-semibold text-ink">
                  Production by cow
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
                          {fmt(liters)} L
                        </span>
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="p-8 text-center text-[13px] text-muted">
                    No milk records in this period.
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
  const [tab, setTab] = useState("warehouses");
  const tabs = [
    { key: "warehouses", label: "Warehouses" },
    { key: "suppliers", label: "Suppliers" },
    { key: "categories", label: "Expense categories" },
    { key: "feed-types", label: "Feed types" },
    { key: "customers", label: "Customers" },
    { key: "market-prices", label: "Market prices" },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "warehouses" && (
        <DataWorkbench
          title="Warehouses"
          description="Manage housing areas, type, capacity, and current occupancy."
          path={apiRoutes.herd.warehouses}
          updatePath={(row) => apiRoutes.herd.warehouse(String(row.warehouse_id))}
          columns={[
            { key: "name", label: "Name" },
            { key: "housing_type", label: "Housing type" },
            { key: "capacity", label: "Capacity" },
            { key: "current_occupancy", label: "Occupancy" },
            { key: "is_archived", label: "Archived" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "housing_type", label: "Housing type", required: true, defaultValue: "shed" },
            { name: "capacity", label: "Capacity", type: "number", required: true, defaultValue: "10" },
            {
              name: "is_archived",
              label: "Archived",
              type: "select",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
          ]}
        />
      )}

      {tab === "suppliers" && (
        <DataWorkbench
          title="Suppliers"
          description="Maintain suppliers used in purchases and herd records."
          path={apiRoutes.herd.suppliers}
          updatePath={(row) => apiRoutes.herd.supplier(String(row.supplier_id))}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "supplier_type", label: "Type" },
            { key: "is_archived", label: "Archived" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "phone", label: "Phone" },
            {
              name: "supplier_type",
              label: "Supplier type",
              required: true,
              defaultValue: "individual",
            },
            {
              name: "is_archived",
              label: "Archived",
              type: "select",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
          ]}
        />
      )}

      {tab === "categories" && (
        <DataWorkbench
          title="Expense categories"
          description="Group expense categories as food or miscellaneous. Categories are create-only in the API."
          path={apiRoutes.feeding.categories}
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
          description="Manage feed items, units, and per-unit costs."
          path={apiRoutes.feeding.feedTypes}
          updatePath={(row) => apiRoutes.feeding.feedType(String(row.feed_type_id))}
          columns={[
            { key: "name", label: "Name" },
            { key: "name_bn", label: "Bangla name" },
            { key: "category_name", label: "Category" },
            { key: "unit", label: "Unit" },
            { key: "unit_cost", label: "Unit cost ৳" },
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
            {
              name: "is_archived",
              label: "Archived",
              type: "select",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
          ]}
        />
      )}

      {tab === "customers" && (
        <DataWorkbench
          title="Customers"
          description="Maintain buyers and monitor their account balances."
          path={apiRoutes.sales.customers}
          updatePath={(row) => apiRoutes.sales.customer(String(row.customer_id))}
          columns={[
            { key: "name", label: "Name" },
            { key: "phone", label: "Phone" },
            { key: "customer_type", label: "Type" },
            { key: "current_balance", label: "Balance ৳" },
            { key: "is_archived", label: "Archived" },
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
                { value: "dairy_shop", label: "Dairy shop" },
                { value: "wholesaler", label: "Wholesaler" },
                { value: "meat_buyer", label: "Meat buyer" },
              ],
            },
            {
              name: "is_archived",
              label: "Archived",
              type: "select",
              options: [
                { value: "true", label: "Yes" },
                { value: "false", label: "No" },
              ],
            },
          ]}
        />
      )}

      {tab === "market-prices" && (
        <DataWorkbench
          title="Market prices"
          description="Record dated market rates used as references for purchase evaluations. The API supports adding and viewing rates."
          path={apiRoutes.evaluations.marketPrices}
          columns={[
            { key: "price_date", label: "Date" },
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
  const entries = Object.entries(rows);
  return (
    <div className="rounded-[8px] border border-line bg-surface p-4">
      <h3 className="border-b border-line pb-2.5 text-[14px] font-semibold text-ink">{title}</h3>
      {entries.length ? (
        <div className="divide-y divide-line">
          {entries.map(([label, value]) => (
            <div key={label} className="flex justify-between py-2 text-[13px]">
              <span className="capitalize text-muted">{label.replaceAll("_", " ")}</span>
              <span className="font-semibold text-ink tabular-nums">{value}</span>
            </div>
          ))}
        </div>
      ) : (
        <p className="py-4 text-center text-[13px] text-muted">No breakdown data.</p>
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

function money(value: unknown) {
  return value == null
    ? "—"
    : `৳ ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value))}`;
}

function fmt(value: unknown) {
  return value == null
    ? "0"
    : new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value));
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
