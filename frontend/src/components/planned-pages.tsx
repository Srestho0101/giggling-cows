"use client";

import { useCallback, useEffect, useState } from "react";
import { AttendanceWorkspace } from "@/components/operational-pages";
import { DataWorkbench, Notice } from "@/components/data-workbench";
import { apiQuery, apiRequest, apiRoutes, apiUrl } from "@/lib/api";

type Row = Record<string, unknown>;
type Dashboard = {
  total_cows: number; active_cows: number; sold_cows: number; deceased_cows: number;
  cows_by_category: Record<string, number>; cows_by_warehouse: Record<string, number>;
  milk_today_liters: number; milk_this_week_liters: number; milk_this_month_liters: number;
  month_invoiced_revenue: number; month_cash_collected: number; month_total_expenses: number;
  total_unpaid_receivables: number; alerts: { id: string; cow_tag: string; item_type: string; due_date: string; days_overdue: number; description: string }[];
};
type Profitability = {
  start_date: string; end_date: string; milk_revenue: number; cow_sales_revenue: number; other_sales_revenue: number;
  total_invoiced_revenue: number; cash_collected: number; receivables_uncollected: number; cow_acquisition_cost: number;
  feed_consumption_cost: number; general_expenses: number; health_and_breeding_cost: number; labor_salary_paid: number;
  mill_charges: number; total_costs: number; accrual_net_profit: number; cash_net_margin: number; profit_margin_percent: number;
};

export function TodayWorkspace() {
  const [date, setDate] = useState(today());
  const [dashboard, setDashboard] = useState<Dashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const load = useCallback(async () => {
    setLoading(true); setError("");
    try { setDashboard(await apiRequest<Dashboard>(apiRoutes.reports.dashboard)); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setLoading(false); }
  }, []);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  const dateQuery = apiQuery("", { start_date: date, end_date: date }).slice(1);
  return <div className="space-y-7">
    <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm">
      <div><p className="text-sm font-semibold text-stone-800">Daily operations</p><p className="mt-1 text-xs text-stone-500">Choose a date to review or enter that day’s records.</p></div>
      <div className="flex items-center gap-2"><button aria-label="Previous day" onClick={() => setDate(shiftDate(date, -1))} className={iconButton}>‹</button><input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /><button aria-label="Next day" onClick={() => setDate(shiftDate(date, 1))} className={iconButton}>›</button><button onClick={() => setDate(today())} className="rounded-md border border-stone-200 px-3 py-2 text-xs text-stone-600">Today</button></div>
    </div>
    {error && <Notice>{error} <button onClick={() => void load()} className="ml-2 underline">Retry</button></Notice>}
    <section>
      <div className="mb-3 flex items-center justify-between"><div><h2 className="text-sm font-semibold text-stone-800">Farm overview</h2><p className="mt-1 text-xs text-stone-500">Current totals from the dashboard</p></div><button onClick={() => void load()} className="text-xs font-medium text-emerald-800 hover:underline">Refresh</button></div>
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[
        ["Active herd", loading ? "…" : dashboard?.active_cows ?? "—", `${dashboard?.total_cows ?? "—"} total registered`],
        ["Milk today", loading ? "…" : `${fmt(dashboard?.milk_today_liters)} L`, `${fmt(dashboard?.milk_this_week_liters)} L this week`],
        ["Month invoiced", loading ? "…" : money(dashboard?.month_invoiced_revenue), `${money(dashboard?.month_cash_collected)} collected`],
        ["Unpaid receivables", loading ? "…" : money(dashboard?.total_unpaid_receivables), `${money(dashboard?.month_total_expenses)} expenses this month`],
      ].map(([label, value, detail]) => <div key={label} className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-2xl font-semibold tracking-tight text-stone-900">{value}</p><p className="mt-1 text-xs text-stone-500">{detail}</p></div>)}</div>
    </section>
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5"><div className="flex items-center justify-between"><div><h2 className="text-sm font-semibold text-amber-950">Herd alerts</h2><p className="mt-1 text-xs text-amber-800">Upcoming and overdue care reminders</p></div><span className="rounded-full bg-white px-2.5 py-1 text-xs font-medium text-amber-900">{dashboard?.alerts.length ?? 0}</span></div>
      {loading ? <p className="mt-4 text-sm text-amber-800">Loading alerts…</p> : dashboard?.alerts.length ? <div className="mt-4 grid gap-2 md:grid-cols-2">{dashboard.alerts.map((alert) => <div key={alert.id} className="rounded-lg border border-amber-200 bg-white p-3"><div className="flex items-start justify-between gap-3"><div><p className="text-sm font-medium text-stone-800">{alert.description}</p><p className="mt-1 text-xs text-stone-500">Cow {alert.cow_tag} · {alert.item_type.replaceAll("_", " ")}</p></div><span className={`shrink-0 rounded-full px-2 py-1 text-[11px] ${alert.days_overdue > 0 ? "bg-rose-50 text-rose-800" : "bg-amber-100 text-amber-900"}`}>{alert.days_overdue > 0 ? `${alert.days_overdue}d overdue` : alert.due_date}</span></div></div>)}</div> : <p className="mt-4 text-sm text-amber-800">No care alerts right now.</p>}
    </section>
    <div className="grid gap-7 xl:grid-cols-2">
      <DataWorkbench title="Milk production" description={`Add per-cow morning or evening records for ${date}.`} path={apiRoutes.sales.milk} query={dateQuery} columns={[{ key: "cow_tag_number", label: "Cow" }, { key: "session", label: "Session" }, { key: "liters", label: "Liters" }]} fields={[
        { name: "cow_id", label: "Cow", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number", required: true }, { name: "production_date", label: "Date", type: "date", required: true, defaultValue: date }, { name: "session", label: "Session", type: "select", required: true, options: [{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }] }, { name: "liters", label: "Liters", type: "number", required: true },
      ]} />
      <div className="space-y-3"><div><h2 className="text-lg font-semibold text-stone-900">Attendance</h2><p className="mt-1 text-sm text-stone-500">Mark active workers present or record an absence for {date}.</p></div><AttendanceWorkspace key={date} initialDate={date} /></div>
      <DataWorkbench title="Sales invoices" description={`Create and review invoices dated ${date}.`} path={apiRoutes.sales.invoices} query={dateQuery} columns={[{ key: "invoice_number", label: "Invoice" }, { key: "customer_name", label: "Customer" }, { key: "total_amount", label: "Total ৳" }, { key: "paid_amount", label: "Paid ৳" }, { key: "status", label: "Status" }]} fields={[
        { name: "customer_id", label: "Customer", type: "select", sourcePath: apiRoutes.sales.customers, sourceValue: "customer_id", required: true }, { name: "invoice_date", label: "Invoice date", type: "date", required: true, defaultValue: date }, { name: "item_type", label: "Item type", type: "select", required: true, options: [{ value: "milk", label: "Milk" }, { value: "animal", label: "Animal" }, { value: "other", label: "Other" }] }, { name: "cow_id", label: "Cow (required for animal sales)", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number" }, { name: "description", label: "Line description", required: true }, { name: "quantity", label: "Quantity", type: "number", required: true }, { name: "unit_price", label: "Unit price ৳", type: "number", required: true }, { name: "discount", label: "Invoice discount ৳", type: "number" },
      ]} buildBody={(values) => ({ customer_id: values.customer_id, invoice_date: values.invoice_date || date, discount: Number(values.discount || 0), lines: [{ item_type: values.item_type, cow_id: values.cow_id || undefined, description: values.description, quantity: Number(values.quantity), unit_price: Number(values.unit_price) }] })} />
      <DataWorkbench title="Expenses" description={`Record farm expenses for ${date}.`} path={apiRoutes.feeding.expenses} query={dateQuery} columns={[{ key: "category_name", label: "Category" }, { key: "amount", label: "Amount ৳" }, { key: "description", label: "Description" }]} fields={[
        { name: "category_id", label: "Category", type: "select", sourcePath: apiRoutes.feeding.categories, sourceValue: "category_id", required: true }, { name: "warehouse_id", label: "Warehouse", type: "select", sourcePath: apiRoutes.herd.warehouses, sourceValue: "warehouse_id" }, { name: "expense_date", label: "Date", type: "date", required: true, defaultValue: date }, { name: "amount", label: "Amount ৳", type: "number", required: true }, { name: "description", label: "Description", type: "textarea" },
      ]} />
    </div>
  </div>;
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
  const tabs = [{ key: "profitability", label: "Profitability" }, { key: "herd", label: "Herd summary" }, { key: "milk", label: "Milk summary" }];
  const loadReport = useCallback(async () => {
    setLoading(true); setError("");
    try { setReport(await apiRequest<Profitability>(apiQuery(apiRoutes.reports.profitability, { start_date: start, end_date: end }))); }
    catch (cause) { setError(messageFor(cause)); }
    finally { setLoading(false); }
  }, [start, end]);
  useEffect(() => { if (tab !== "profitability") return; const timer = window.setTimeout(() => { void loadReport(); }, 0); return () => window.clearTimeout(timer); }, [tab, loadReport, refreshKey]);
  useEffect(() => {
    let timer: number | undefined;
    if (tab === "herd" && !dashboard) timer = window.setTimeout(() => { setLoading(true); setError(""); void apiRequest<Dashboard>(apiRoutes.reports.dashboard).then(setDashboard).catch((cause) => setError(messageFor(cause))).finally(() => setLoading(false)); }, 0);
    if (tab === "milk") timer = window.setTimeout(() => { setLoading(true); setError(""); void apiRequest<Row[]>(apiQuery(apiRoutes.sales.milk, { start_date: start, end_date: end })).then(setMilkRows).catch((cause) => setError(messageFor(cause))).finally(() => setLoading(false)); }, 0);
    return () => { if (timer !== undefined) window.clearTimeout(timer); };
  }, [tab, dashboard, start, end, refreshKey]);
  async function downloadCsv() {
    setError("");
    try {
      const response = await fetch(apiUrl(apiQuery(apiRoutes.reports.profitabilityCsv, { start_date: start, end_date: end })));
      if (!response.ok) throw new Error(`CSV export failed (${response.status}).`);
      const blob = await response.blob(); const url = URL.createObjectURL(blob); const link = document.createElement("a");
      link.href = url; link.download = `profitability_${start}_${end}.csv`; link.click(); URL.revokeObjectURL(url);
    } catch (cause) { setError(messageFor(cause)); }
  }
  const milkTotal = milkRows.reduce((sum, row) => sum + Number(row.liters ?? 0), 0);
  const byCow = Object.entries(milkRows.reduce<Record<string, number>>((acc, row) => { const name = String(row.cow_tag_number ?? "Unknown"); acc[name] = (acc[name] ?? 0) + Number(row.liters ?? 0); return acc; }, {})).sort((a, b) => b[1] - a[1]);
  return <div>
    <div className="mb-5 flex flex-wrap items-center justify-between gap-3 rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><div className="flex flex-wrap gap-1">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-md px-3.5 py-2 text-sm ${tab === item.key ? "bg-[#34443a] font-medium text-white" : "text-stone-600 hover:bg-stone-50"}`}>{item.label}</button>)}</div><div className="flex flex-wrap items-end gap-2"><label className={labelClass}>From<input type="date" value={start} max={end} onChange={(event) => setStart(event.target.value)} className={inputClass} /></label><label className={labelClass}>To<input type="date" value={end} min={start} onChange={(event) => setEnd(event.target.value)} className={inputClass} /></label></div></div>
    {error && <div className="mb-4"><Notice>{error} <button onClick={() => setRefreshKey((value) => value + 1)} className="ml-2 underline">Retry</button></Notice></div>}
    {tab === "profitability" && <section className="space-y-5">
      <div className="flex flex-wrap items-end justify-between gap-3"><div><h2 className="text-lg font-semibold text-stone-900">Profitability report</h2><p className="mt-1 text-sm text-stone-500">Accrual revenue and costs for the selected period.</p></div><button onClick={() => void downloadCsv()} className="rounded-md border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Export CSV</button></div>
      {loading ? <Panel>Loading report…</Panel> : report ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Invoiced revenue", money(report.total_invoiced_revenue)], ["Total costs", money(report.total_costs)], ["Accrual net profit", money(report.accrual_net_profit)], ["Profit margin", `${fmt(report.profit_margin_percent)}%`]].map(([label, value]) => <Metric key={label} label={label} value={value} />)}</div><div className="grid gap-5 xl:grid-cols-2"><Breakdown title="Revenue" rows={[["Milk sales", report.milk_revenue], ["Animal sales", report.cow_sales_revenue], ["Other sales", report.other_sales_revenue], ["Total invoiced", report.total_invoiced_revenue], ["Cash collected", report.cash_collected], ["Uncollected receivables", report.receivables_uncollected]]} /><Breakdown title="Costs and net" rows={[["Cow acquisition", report.cow_acquisition_cost], ["Feed consumption", report.feed_consumption_cost], ["General expenses", report.general_expenses], ["Health and breeding", report.health_and_breeding_cost], ["Labor salaries paid", report.labor_salary_paid], ["Mill charges", report.mill_charges], ["Total costs", report.total_costs], ["Cash net margin", report.cash_net_margin]]} /></div></> : <Panel>Choose a date range to load the report.</Panel>}
    </section>}
    {tab === "herd" && <section className="space-y-5"><div><h2 className="text-lg font-semibold text-stone-900">Herd summary</h2><p className="mt-1 text-sm text-stone-500">Current herd counts from the dashboard.</p></div>{dashboard ? <><div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">{[["Total cows", dashboard.total_cows], ["Active", dashboard.active_cows], ["Sold", dashboard.sold_cows], ["Deceased", dashboard.deceased_cows]].map(([label, value]) => <Metric key={String(label)} label={String(label)} value={String(value)} />)}</div><div className="grid gap-5 md:grid-cols-2"><CountBreakdown title="By category" rows={dashboard.cows_by_category} /><CountBreakdown title="By warehouse" rows={dashboard.cows_by_warehouse} /></div></> : <Panel>{loading ? "Loading herd summary…" : "No summary available."}</Panel>}</section>}
    {tab === "milk" && <section className="space-y-5"><div><h2 className="text-lg font-semibold text-stone-900">Milk production summary</h2><p className="mt-1 text-sm text-stone-500">Summed from individual cow session records in this period.</p></div>{loading ? <Panel>Loading milk records…</Panel> : <><div className="grid gap-3 sm:grid-cols-3"><Metric label="Total production" value={`${fmt(milkTotal)} L`} /><Metric label="Session records" value={String(milkRows.length)} /><Metric label="Average per record" value={`${fmt(milkRows.length ? milkTotal / milkRows.length : 0)} L`} /></div><div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm"><div className="border-b border-stone-100 px-4 py-3 text-sm font-medium text-stone-700">Production by cow</div>{byCow.length ? <div className="divide-y divide-stone-100">{byCow.map(([cow, liters]) => <div key={cow} className="flex justify-between px-4 py-3 text-sm"><span className="text-stone-700">{cow}</span><span className="font-medium text-stone-900">{fmt(liters)} L</span></div>)}</div> : <p className="p-8 text-center text-sm text-stone-500">No milk records in this period.</p>}</div></>}</section>}
  </div>;
}

export function MastersWorkspace() {
  const [tab, setTab] = useState("warehouses");
  const tabs = [{ key: "warehouses", label: "Warehouses" }, { key: "suppliers", label: "Suppliers" }, { key: "categories", label: "Expense categories" }, { key: "feed-types", label: "Feed types" }, { key: "customers", label: "Customers" }, { key: "market-prices", label: "Market prices" }];
  return <div><div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1.5 shadow-sm">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-md px-3.5 py-2 text-sm ${tab === item.key ? "bg-[#34443a] font-medium text-white" : "text-stone-600 hover:bg-stone-50"}`}>{item.label}</button>)}</div>
    {tab === "warehouses" && <DataWorkbench title="Warehouses" description="Manage housing areas, type, capacity, and current occupancy." path={apiRoutes.herd.warehouses} updatePath={(row) => apiRoutes.herd.warehouse(String(row.warehouse_id))} columns={[{ key: "name", label: "Name" }, { key: "housing_type", label: "Housing type" }, { key: "capacity", label: "Capacity" }, { key: "current_occupancy", label: "Occupancy" }, { key: "is_archived", label: "Archived" }]} fields={[{ name: "name", label: "Name", required: true }, { name: "housing_type", label: "Housing type", required: true, defaultValue: "shed" }, { name: "capacity", label: "Capacity", type: "number", required: true, defaultValue: "10" }, { name: "is_archived", label: "Archived", type: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }]} />}
    {tab === "suppliers" && <DataWorkbench title="Suppliers" description="Maintain suppliers used in purchases and herd records." path={apiRoutes.herd.suppliers} updatePath={(row) => apiRoutes.herd.supplier(String(row.supplier_id))} columns={[{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "supplier_type", label: "Type" }, { key: "is_archived", label: "Archived" }]} fields={[{ name: "name", label: "Name", required: true }, { name: "phone", label: "Phone" }, { name: "supplier_type", label: "Supplier type", required: true, defaultValue: "individual" }, { name: "is_archived", label: "Archived", type: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }]} />}
    {tab === "categories" && <DataWorkbench title="Expense categories" description="Group expense categories as food or miscellaneous. Categories are create-only in the API." path={apiRoutes.feeding.categories} columns={[{ key: "name", label: "Name" }, { key: "name_bn", label: "Bangla name" }, { key: "category_group", label: "Group" }]} fields={[{ name: "name", label: "Name", required: true }, { name: "name_bn", label: "Bangla name", required: true }, { name: "category_group", label: "Group", type: "select", required: true, options: [{ value: "food", label: "Food" }, { value: "miscellaneous", label: "Miscellaneous" }] }]} />}
    {tab === "feed-types" && <DataWorkbench title="Feed types" description="Manage feed items, units, and per-unit costs." path={apiRoutes.feeding.feedTypes} updatePath={(row) => apiRoutes.feeding.feedType(String(row.feed_type_id))} columns={[{ key: "name", label: "Name" }, { key: "name_bn", label: "Bangla name" }, { key: "category_name", label: "Category" }, { key: "unit", label: "Unit" }, { key: "unit_cost", label: "Unit cost ৳" }]} fields={[{ name: "category_id", label: "Expense category", type: "select", sourcePath: apiRoutes.feeding.categories, sourceValue: "category_id", required: true }, { name: "name", label: "Name", required: true }, { name: "name_bn", label: "Bangla name", required: true }, { name: "unit", label: "Unit", required: true, defaultValue: "kg" }, { name: "unit_cost", label: "Cost per unit ৳", type: "number", required: true }, { name: "is_archived", label: "Archived", type: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }]} />}
    {tab === "customers" && <DataWorkbench title="Customers" description="Maintain buyers and monitor their account balances." path={apiRoutes.sales.customers} updatePath={(row) => apiRoutes.sales.customer(String(row.customer_id))} columns={[{ key: "name", label: "Name" }, { key: "phone", label: "Phone" }, { key: "customer_type", label: "Type" }, { key: "current_balance", label: "Balance ৳" }, { key: "is_archived", label: "Archived" }]} fields={[{ name: "name", label: "Name", required: true }, { name: "phone", label: "Phone" }, { name: "customer_type", label: "Customer type", type: "select", required: true, defaultValue: "individual", options: [{ value: "individual", label: "Individual" }, { value: "dairy_shop", label: "Dairy shop" }, { value: "wholesaler", label: "Wholesaler" }, { value: "meat_buyer", label: "Meat buyer" }] }, { name: "is_archived", label: "Archived", type: "select", options: [{ value: "true", label: "Yes" }, { value: "false", label: "No" }] }]} />}
    {tab === "market-prices" && <DataWorkbench title="Market prices" description="Record dated market rates used as references for purchase evaluations. The API supports adding and viewing rates." path={apiRoutes.evaluations.marketPrices} columns={[{ key: "price_date", label: "Date" }, { key: "price_per_kg_net", label: "Net ৳/kg" }, { key: "source", label: "Source" }]} fields={[{ name: "price_date", label: "Date", type: "date", required: true, defaultValue: today() }, { name: "price_per_kg_net", label: "Net price per kg ৳", type: "number", required: true }, { name: "source", label: "Source" }]} />}
  </div>;
}

const inputClass = "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
const labelClass = "block text-xs font-medium text-stone-600";
const iconButton = "size-9 rounded-md border border-stone-200 bg-white text-lg text-stone-600 hover:bg-stone-50";
function Metric({ label, value }: { label: string; value: string }) { return <div className="rounded-xl border border-stone-200 bg-white p-4 shadow-sm"><p className="text-xs text-stone-500">{label}</p><p className="mt-2 text-xl font-semibold text-stone-900">{value}</p></div>; }
function Breakdown({ title, rows }: { title: string; rows: [string, number][] }) { return <div className="rounded-xl border border-stone-200 bg-white shadow-sm"><h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-800">{title}</h3><div className="divide-y divide-stone-100">{rows.map(([label, value], index) => <div key={label} className={`flex justify-between gap-3 px-4 py-3 text-sm ${index === rows.length - 1 ? "font-semibold" : ""}`}><span className="text-stone-600">{label}</span><span className="text-stone-900">{money(value)}</span></div>)}</div></div>; }
function CountBreakdown({ title, rows }: { title: string; rows: Record<string, number> }) { const entries = Object.entries(rows); return <div className="rounded-xl border border-stone-200 bg-white shadow-sm"><h3 className="border-b border-stone-100 px-4 py-3 text-sm font-semibold text-stone-800">{title}</h3>{entries.length ? <div className="divide-y divide-stone-100">{entries.map(([label, value]) => <div key={label} className="flex justify-between px-4 py-3 text-sm"><span className="capitalize text-stone-600">{label.replaceAll("_", " ")}</span><span className="font-medium text-stone-900">{value}</span></div>)}</div> : <p className="p-5 text-sm text-stone-500">No breakdown data.</p>}</div>; }
function Panel({ children }: { children: React.ReactNode }) { return <div className="rounded-xl border border-stone-200 bg-white p-8 text-center text-sm text-stone-500">{children}</div>; }
function money(value: unknown) { return value == null ? "—" : `৳ ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value))}`; }
function fmt(value: unknown) { return value == null ? "0" : new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value)); }
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()); }
function monthStart() { return `${today().slice(0, 7)}-01`; }
function shiftDate(value: string, offset: number) { const date = new Date(`${value}T12:00:00+06:00`); date.setDate(date.getDate() + offset); return date.toISOString().slice(0, 10); }
function messageFor(cause: unknown) { return cause instanceof Error ? cause.message : "Request failed. Please try again."; }
