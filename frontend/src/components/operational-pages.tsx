"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import { DataWorkbench, Notice, type FormField, type TableColumn } from "@/components/data-workbench";
import { apiRequest, apiRoutes, apiQuery } from "@/lib/api";

const cowColumns: TableColumn[] = [
  { key: "current_tag_number", label: "Tag" }, { key: "category", label: "Category" },
  { key: "sex", label: "Sex" }, { key: "birth_date", label: "Birth date" },
  { key: "warehouse_name", label: "Warehouse" }, { key: "status", label: "Status" },
  { key: "latest_weight_kg", label: "Latest kg" },
];

const cowFields: FormField[] = [
  { name: "current_tag_number", label: "Tag number", required: true },
  { name: "sex", label: "Sex", type: "select", required: true, options: [{ value: "female", label: "Female" }, { value: "male", label: "Male" }] },
  { name: "category", label: "Category", required: true, placeholder: "Milking cow, heifer…" },
  { name: "birth_date", label: "Birth date", type: "date" },
  { name: "acquisition_type", label: "Acquisition", type: "select", required: true, options: [{ value: "born_on_farm", label: "Born on farm" }, { value: "bought_from_supplier", label: "Bought from supplier" }, { value: "bought_from_bazar", label: "Bought from bazar" }] },
  { name: "acquisition_date", label: "Acquisition date", type: "date", required: true },
  { name: "supplier_id", label: "Supplier", type: "select", sourcePath: apiRoutes.herd.suppliers, sourceValue: "supplier_id" },
  { name: "warehouse_id", label: "Warehouse", type: "select", required: true, sourcePath: apiRoutes.herd.warehouses, sourceValue: "warehouse_id" },
  { name: "purchase_price", label: "Purchase price ৳", type: "number" },
  { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "sold", label: "Sold" }, { value: "deceased", label: "Deceased" }] },
];

export function HerdWorkspace() {
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sex, setSex] = useState("");
  const query = useMemo(() => new URLSearchParams(Object.entries({ search, warehouse_id: warehouse, status, category, sex }).filter(([, value]) => value)).toString(), [search, warehouse, status, category, sex]);
  return <>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-5">
      <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Search by tag" className={inputClass} />
      <FilterSelect path={apiRoutes.herd.warehouses} valueKey="warehouse_id" value={warehouse} onChange={setWarehouse} placeholder="All warehouses" />
      <select value={status} onChange={(event) => setStatus(event.target.value)} className={inputClass}><option value="">All statuses</option><option value="active">Active</option><option value="sold">Sold</option><option value="deceased">Deceased</option></select>
      <input value={category} onChange={(event) => setCategory(event.target.value)} placeholder="Category" className={inputClass} />
      <select value={sex} onChange={(event) => setSex(event.target.value)} className={inputClass}><option value="">All sexes</option><option value="female">Female</option><option value="male">Male</option></select>
    </div>
    <DataWorkbench title="Cows" description="Search and register animals. Select a tag to open its record." path={apiRoutes.herd.cows} columns={cowColumns} fields={cowFields} query={query} rowHref={(row) => `/herd/${String(row.cow_id)}`} />
  </>;
}

export function PurchasesWorkspace() {
  const [liveWeight, setLiveWeight] = useState("350");
  const [growth, setGrowth] = useState("good");
  const [offered, setOffered] = useState("");
  const [market, setMarket] = useState("");
  const [preview, setPreview] = useState<Record<string, unknown> | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState("returned");
  const [revision, setRevision] = useState(0);
  const [convertRow, setConvertRow] = useState<Record<string, unknown> | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertValues, setConvertValues] = useState({ tag_number: "", sex: "female", category: "Milking cow", warehouse_id: "", birth_date: "", notes: "" });

  async function calculate() {
    setError("");
    try {
      const result = await apiRequest<Record<string, unknown>>(apiRoutes.evaluations.preview, {
        method: "POST",
        body: { live_weight_kg: Number(liveWeight), growth_potential: growth, offered_price: Number(offered), market_price_per_kg: Number(market) },
      });
      setPreview(result);
    } catch (cause) { setError(messageFor(cause)); }
  }
  async function saveEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    try {
      await apiRequest(apiRoutes.evaluations.root, { method: "POST", body: {
        evaluation_date: formData.get("evaluation_date"), supplier_id: formData.get("supplier_id") || null,
        live_weight_kg: Number(liveWeight), growth_potential: growth, offered_price: Number(offered),
        market_price_per_kg: Number(market), decision, notes: formData.get("notes") || null,
      } });
      setNotice("Evaluation saved.");
      setPreview(null);
      form.reset();
      setRevision((value) => value + 1);
    } catch (cause) { setError(messageFor(cause)); }
    finally { setSaving(false); }
  }
  async function returnEvaluation(row: Record<string, unknown>) {
    setError("");
    try {
      await apiRequest(apiRoutes.evaluations.update(String(row.evaluation_id)), { method: "PATCH", body: { decision: "returned" } });
      setRevision((value) => value + 1);
      setNotice("Evaluation marked returned.");
    } catch (cause) { setError(messageFor(cause)); }
  }
  async function convertToCow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!convertRow) return;
    setConvertBusy(true); setError("");
    try {
      await apiRequest(apiRoutes.evaluations.convert(String(convertRow.evaluation_id)), { method: "POST", body: { ...convertValues, birth_date: convertValues.birth_date || null, notes: convertValues.notes || null } });
      setConvertRow(null);
      setRevision((value) => value + 1);
      setNotice("Cow registered from this purchase.");
    } catch (cause) { setError(messageFor(cause)); }
    finally { setConvertBusy(false); }
  }
  return <div className="space-y-6">
    {error && <Notice>{error}</Notice>}{notice && <Notice tone="success">{notice}</Notice>}
    <div className="grid gap-5 xl:grid-cols-[1fr_0.9fr]">
      <form onSubmit={saveEvaluation} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-800">Evaluate an animal</h2>
        <p className="mt-1 text-xs text-stone-500">The backend calculates expected net weight and profitability.</p>
        <div className="mt-5 grid gap-4 sm:grid-cols-2">
          <label className={labelClass}>Evaluation date<input name="evaluation_date" type="date" required defaultValue={today()} className={inputClass} /></label>
          <label className={labelClass}>Supplier<select name="supplier_id" className={inputClass}><option value="">Unknown / bazar</option><RemoteOptions path={apiRoutes.herd.suppliers} valueKey="supplier_id" labelKey="name" /></select></label>
          <label className={labelClass}>Live weight (kg)<input type="number" min="1" step="0.1" required value={liveWeight} onChange={(event) => setLiveWeight(event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Growth potential<select value={growth} onChange={(event) => setGrowth(event.target.value)} className={inputClass}><option value="good">Good (60–62%)</option><option value="poor">Poor (54–55%)</option></select></label>
          <label className={labelClass}>Offered price (৳)<input type="number" min="0" step="0.01" required value={offered} onChange={(event) => setOffered(event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Market price (৳/kg)<input type="number" min="0" step="0.01" required value={market} onChange={(event) => setMarket(event.target.value)} className={inputClass} /></label>
          <label className={labelClass}>Decision<select value={decision} onChange={(event) => setDecision(event.target.value)} className={inputClass}><option value="returned">Return</option><option value="bought">Bought</option></select></label>
          <label className={`${labelClass} sm:col-span-2`}>Notes<textarea name="notes" rows={2} className={inputClass} /></label>
        </div>
        <div className="mt-5 flex flex-wrap gap-2"><button type="button" onClick={() => void calculate()} className="rounded-md border border-emerald-800 px-4 py-2 text-sm font-medium text-emerald-900">Calculate preview</button><button disabled={saving} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save evaluation"}</button></div>
      </form>
      <div className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
        <h2 className="text-sm font-semibold text-stone-800">Calculation preview</h2>
        {preview ? <div className="mt-5 space-y-3">{[
          ["Estimated net weight", `${preview.est_net_weight_kg ?? "—"} kg`],
          ["Net price per kg", money(preview.net_price_per_kg)],
          ["Market price per kg", money(preview.market_price_per_kg)],
          ["Projected margin", money(preview.total_projected_margin)],
        ].map(([label, value]) => <div key={label} className="flex justify-between border-b border-stone-100 pb-3 text-sm"><span className="text-stone-500">{label}</span><span className="font-medium text-stone-800">{value}</span></div>)}<div className={`mt-2 inline-flex rounded-full px-3 py-1.5 text-xs font-semibold ${preview.is_profitable ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-800"}`}>{preview.is_profitable ? "Profitable" : "Not profitable"}</div></div> : <p className="mt-8 rounded-lg bg-stone-50 p-5 text-sm text-stone-500">Enter weights and prices, then calculate to see the server estimate.</p>}
      </div>
    </div>
    {convertRow && <div className="fixed inset-0 z-40 grid place-items-center bg-stone-950/30 p-4"><form onSubmit={convertToCow} className="w-full max-w-xl rounded-xl border border-stone-200 bg-white p-6 shadow-2xl"><h2 className="text-lg font-semibold">Register purchased cow</h2><p className="mt-1 text-sm text-stone-500">The cow and its initial tag and warehouse history will be created from this evaluation.</p><div className="mt-5 grid gap-4 sm:grid-cols-2">
      <label className={labelClass}>Tag number<input required value={convertValues.tag_number} onChange={(event) => setConvertValues((v) => ({ ...v, tag_number: event.target.value }))} className={inputClass} /></label>
      <label className={labelClass}>Sex<select value={convertValues.sex} onChange={(event) => setConvertValues((v) => ({ ...v, sex: event.target.value }))} className={inputClass}><option value="female">Female</option><option value="male">Male</option></select></label>
      <label className={labelClass}>Category<input required value={convertValues.category} onChange={(event) => setConvertValues((v) => ({ ...v, category: event.target.value }))} className={inputClass} /></label>
      <label className={labelClass}>Warehouse<select required value={convertValues.warehouse_id} onChange={(event) => setConvertValues((v) => ({ ...v, warehouse_id: event.target.value }))} className={inputClass}><option value="">Choose warehouse</option><RemoteOptions path={apiRoutes.herd.warehouses} valueKey="warehouse_id" labelKey="name" /></select></label>
      <label className={labelClass}>Birth date<input type="date" value={convertValues.birth_date} onChange={(event) => setConvertValues((v) => ({ ...v, birth_date: event.target.value }))} className={inputClass} /></label>
      <label className={`${labelClass} sm:col-span-2`}>Notes<textarea rows={2} value={convertValues.notes} onChange={(event) => setConvertValues((v) => ({ ...v, notes: event.target.value }))} className={inputClass} /></label>
    </div><div className="mt-5 flex justify-end gap-2"><button type="button" onClick={() => setConvertRow(null)} className="rounded-md border border-stone-200 px-4 py-2 text-sm">Cancel</button><button disabled={convertBusy} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white">{convertBusy ? "Registering…" : "Register cow"}</button></div></form></div>}
    <DataWorkbench key={revision} title="Purchase evaluations" description="Review saved buy and return decisions. Register a bought animal to add it to the herd." path={apiRoutes.evaluations.root} columns={[{ key: "evaluation_date", label: "Date" }, { key: "supplier_name", label: "Supplier" }, { key: "live_weight_kg", label: "Live kg" }, { key: "est_net_weight_kg", label: "Estimated kg" }, { key: "offered_price", label: "Offered ৳" }, { key: "net_price_per_kg", label: "Net ৳/kg" }, { key: "is_profitable", label: "Profitable" }, { key: "decision", label: "Decision" }]} fields={[]} showCreate={false} rowActions={(row) => row.cow_id ? <span className="text-xs text-emerald-800">Registered</span> : row.decision === "returned" ? <span className="text-xs text-stone-400">Closed</span> : <div className="flex gap-2"><button type="button" onClick={() => setConvertRow(row)} className="text-xs font-medium text-emerald-800 hover:underline">Register cow</button><button type="button" onClick={() => void returnEvaluation(row)} className="text-xs text-stone-500 hover:underline">Return</button></div>} />
  </div>;
}

export function BreedingWorkspace() {
  return <div className="space-y-7">
    <DataWorkbench title="Breeding records" description="Record heat, insemination, sire or semen details, and outcome." path={apiRoutes.health.breeding} columns={[{ key: "cow_tag_number", label: "Cow" }, { key: "heat_date", label: "Heat date" }, { key: "seed_date", label: "Insemination" }, { key: "method", label: "Method" }, { key: "semen_code", label: "Semen code" }, { key: "doctor_name", label: "Doctor" }, { key: "outcome", label: "Outcome" }]} fields={[
      { name: "cow_id", label: "Cow", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number", required: true },
      { name: "heat_date", label: "Heat date", type: "date" }, { name: "seed_date", label: "Insemination date", type: "date", required: true },
      { name: "method", label: "Method", type: "select", required: true, options: [{ value: "artificial_insemination", label: "Artificial insemination" }, { value: "natural", label: "Natural" }] },
      { name: "semen_code", label: "Semen code" }, { name: "semen_provider", label: "Semen provider" },
      { name: "doctor_name", label: "Doctor" }, { name: "cost", label: "Cost ৳", type: "number" },
      { name: "outcome", label: "Outcome", type: "select", options: [{ value: "pending", label: "Pending" }, { value: "successful", label: "Successful" }, { value: "failed", label: "Failed" }] },
      { name: "notes", label: "Notes", type: "textarea" },
    ]} />
    <DataWorkbench title="Pregnancy checks" description="Log pregnancy results and expected calving dates." path={apiRoutes.health.pregnancy} columns={[{ key: "cow_tag_number", label: "Cow" }, { key: "report_date", label: "Check date" }, { key: "status", label: "Result" }, { key: "expected_calving_date", label: "Expected calving" }, { key: "actual_calving_date", label: "Actual calving" }, { key: "notes", label: "Notes" }]} fields={[
      { name: "cow_id", label: "Cow", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number", required: true },
      { name: "report_date", label: "Report date", type: "date", required: true },
      { name: "status", label: "Status", type: "select", options: [{ value: "confirmed", label: "Confirmed" }, { value: "suspected", label: "Suspected" }, { value: "failed", label: "Not pregnant / failed" }, { value: "calved", label: "Calved" }, { value: "aborted", label: "Aborted" }] },
      { name: "expected_calving_date", label: "Expected calving", type: "date" }, { name: "actual_calving_date", label: "Actual calving", type: "date" }, { name: "notes", label: "Notes", type: "textarea" },
    ]} />
  </div>;
}

export function HealthWorkspace() {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const dueThrough = dateAfter(today(), 14);
  const upcoming = useMemo(() => records.filter((row) => typeof row.next_due_date === "string" && row.next_due_date <= dueThrough).sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date))), [records, dueThrough]);
  return <div className="space-y-6">
    <section className="rounded-xl border border-amber-200 bg-amber-50/70 p-5">
      <h2 className="text-sm font-semibold text-amber-950">Due and overdue care</h2>
      {upcoming.length ? <div className="mt-3 flex flex-wrap gap-2">{upcoming.map((row) => { const overdue = String(row.next_due_date) < today(); return <span key={String(row.health_id)} className={`rounded-full border px-3 py-1.5 text-xs ${overdue ? "border-rose-200 bg-rose-50 text-rose-900" : "border-amber-200 bg-white text-amber-900"}`}>{String(row.record_type)} · Cow {String(row.cow_tag_number ?? "—")} · {overdue ? "overdue" : "due"} {String(row.next_due_date)}</span>; })}</div> : <p className="mt-2 text-sm text-amber-800">No care due in the next 14 days.</p>}
    </section>
    <DataWorkbench title="Health records" description="Vaccinations, deworming, treatment, and checkups." path={apiRoutes.health.records} columns={[{ key: "record_date", label: "Date" }, { key: "cow_tag_number", label: "Cow" }, { key: "record_type", label: "Type" }, { key: "vet_name", label: "Vet" }, { key: "cost", label: "Cost ৳" }, { key: "next_due_date", label: "Next due" }, { key: "details", label: "Details" }]} onRows={setRecords} fields={[
      { name: "cow_id", label: "Cow", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number", required: true },
      { name: "record_type", label: "Type", type: "select", required: true, options: [{ value: "treatment", label: "Treatment" }, { value: "vaccination", label: "Vaccination" }, { value: "deworming", label: "Deworming" }, { value: "checkup", label: "Checkup" }] },
      { name: "record_date", label: "Date", type: "date", required: true }, { name: "vet_name", label: "Vet" }, { name: "cost", label: "Cost ৳", type: "number" }, { name: "next_due_date", label: "Next due", type: "date" }, { name: "details", label: "Details", type: "textarea" },
    ]} />
  </div>;
}

export function ExpensesWorkspace() {
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const total = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const query = new URLSearchParams(Object.entries({ category_id: category, warehouse_id: warehouse, start_date: start, end_date: end }).filter(([, value]) => value)).toString();
  return <>
    <div className="mb-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      <FilterSelect path={apiRoutes.feeding.categories} valueKey="category_id" value={category} onChange={setCategory} placeholder="All categories" />
      <FilterSelect path={apiRoutes.herd.warehouses} valueKey="warehouse_id" value={warehouse} onChange={setWarehouse} placeholder="All warehouses" />
      <label className={labelClass}>From<input type="date" value={start} onChange={(event) => setStart(event.target.value)} className={inputClass} /></label>
      <label className={labelClass}>To<input type="date" value={end} onChange={(event) => setEnd(event.target.value)} className={inputClass} /></label>
    </div>
    <div className="mb-4 flex items-center justify-between rounded-lg border border-stone-200 bg-white px-4 py-3"><span className="text-xs text-stone-500">Total in filtered results</span><strong className="text-sm">৳ {new Intl.NumberFormat("en-BD", { minimumFractionDigits: 2, maximumFractionDigits: 2 }).format(total)}</strong></div>
    <DataWorkbench title="Expenses" description="Filter and record farm and animal expenses." path={apiRoutes.feeding.expenses} query={query} onRows={setExpenses} columns={[{ key: "expense_date", label: "Date" }, { key: "category_name", label: "Category" }, { key: "warehouse_name", label: "Warehouse" }, { key: "cow_tag_number", label: "Cow" }, { key: "amount", label: "Amount ৳" }, { key: "description", label: "Description" }]} fields={[
      { name: "category_id", label: "Category", type: "select", sourcePath: apiRoutes.feeding.categories, sourceValue: "category_id", sourceLabel: "name", required: true },
      { name: "warehouse_id", label: "Warehouse", type: "select", sourcePath: apiRoutes.herd.warehouses, sourceValue: "warehouse_id" },
      { name: "cow_id", label: "Cow", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number" },
      { name: "expense_date", label: "Date", type: "date", required: true }, { name: "amount", label: "Amount ৳", type: "number", required: true }, { name: "description", label: "Description", type: "textarea" },
    ]} />
  </>;
}

export function MilkSalesWorkspace() {
  const [tab, setTab] = useState("milk");
  const tabs = [{ key: "milk", label: "Milk records" }, { key: "invoices", label: "Sales invoices" }, { key: "customers", label: "Customers" }];
  return <div>
    <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1.5 shadow-sm">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-md px-4 py-2 text-sm ${tab === item.key ? "bg-[#34443a] font-medium text-white" : "text-stone-600 hover:bg-stone-50"}`}>{item.label}</button>)}</div>
    {tab === "milk" && <DataWorkbench title="Milk production" description="Record per-cow production sessions." path={apiRoutes.sales.milk} columns={[{ key: "production_date", label: "Date" }, { key: "cow_tag_number", label: "Cow" }, { key: "session", label: "Session" }, { key: "liters", label: "Liters" }]} fields={[
      { name: "cow_id", label: "Cow", type: "select", sourcePath: apiRoutes.herd.cows, sourceValue: "cow_id", sourceLabel: "current_tag_number", required: true }, { name: "production_date", label: "Date", type: "date", required: true }, { name: "session", label: "Session", type: "select", required: true, options: [{ value: "morning", label: "Morning" }, { value: "evening", label: "Evening" }] }, { name: "liters", label: "Liters", type: "number", required: true },
    ]} />}
    {tab === "customers" && <DataWorkbench title="Customers" description="Maintain customers and review their outstanding balance." path={apiRoutes.sales.customers} columns={[{ key: "name", label: "Customer" }, { key: "phone", label: "Phone" }, { key: "customer_type", label: "Type" }, { key: "total_invoiced", label: "Invoiced ৳" }, { key: "total_paid", label: "Paid ৳" }, { key: "current_balance", label: "Balance ৳" }]} fields={[{ name: "name", label: "Name", required: true }, { name: "phone", label: "Phone" }, { name: "customer_type", label: "Customer type", type: "select", options: [{ value: "individual", label: "Individual" }, { value: "dairy_shop", label: "Dairy shop" }, { value: "wholesaler", label: "Wholesaler" }, { value: "meat_buyer", label: "Meat buyer" }] }]} />}
    {tab === "invoices" && <DataWorkbench title="Sales invoices" description="Create an invoice with one line item. Select an invoice to record payments or update its status." path={apiRoutes.sales.invoices} columns={[{ key: "invoice_number", label: "Invoice" }, { key: "customer_name", label: "Customer" }, { key: "invoice_date", label: "Date" }, { key: "status", label: "Status" }, { key: "total_amount", label: "Total ৳" }, { key: "paid_amount", label: "Paid ৳" }, { key: "outstanding_balance", label: "Balance ৳" }]} rowHref={(row) => `/milk-sales/invoices/${String(row.invoice_id)}`} fields={[
      { name: "customer_id", label: "Customer", type: "select", sourcePath: apiRoutes.sales.customers, sourceValue: "customer_id", sourceLabel: "name", required: true },
      { name: "invoice_date", label: "Invoice date", type: "date", required: true }, { name: "due_date", label: "Due date", type: "date" },
      { name: "item_type", label: "Item", type: "select", required: true, options: [{ value: "milk", label: "Milk" }, { value: "animal", label: "Animal" }, { value: "other", label: "Other" }] },
      { name: "description", label: "Description", required: true }, { name: "quantity", label: "Quantity", type: "number", required: true }, { name: "unit_price", label: "Unit price ৳", type: "number", required: true }, { name: "discount", label: "Discount ৳", type: "number" },
    ]} buildBody={(values) => ({ customer_id: values.customer_id, invoice_date: values.invoice_date, due_date: values.due_date || null, discount: Number(values.discount || 0), lines: [{ item_type: values.item_type, description: values.description, quantity: Number(values.quantity), unit_price: Number(values.unit_price) }] })} />}
  </div>;
}

export function PayrollWorkspace() {
  const [tab, setTab] = useState("workers");
  const tabs = [{ key: "workers", label: "Workers" }, { key: "attendance", label: "Attendance" }, { key: "salary", label: "Salary payments" }, { key: "substitutes", label: "Substitutes" }];
  return <div>
    <div className="mb-5 flex flex-wrap gap-1 rounded-lg border border-stone-200 bg-white p-1.5 shadow-sm">{tabs.map((item) => <button key={item.key} onClick={() => setTab(item.key)} className={`rounded-md px-4 py-2 text-sm ${tab === item.key ? "bg-[#34443a] font-medium text-white" : "text-stone-600 hover:bg-stone-50"}`}>{item.label}</button>)}</div>
    {tab === "workers" && <DataWorkbench title="Workers" description="Add staff and keep their employment details current." path={apiRoutes.labor.workers} columns={[{ key: "name", label: "Name" }, { key: "role", label: "Role" }, { key: "phone", label: "Phone" }, { key: "join_date", label: "Joined" }, { key: "monthly_salary", label: "Monthly salary ৳" }, { key: "status", label: "Status" }]} fields={[{ name: "name", label: "Name", required: true }, { name: "phone", label: "Phone" }, { name: "role", label: "Role" }, { name: "join_date", label: "Join date", type: "date", required: true }, { name: "monthly_salary", label: "Monthly salary ৳", type: "number", required: true }, { name: "status", label: "Status", type: "select", options: [{ value: "active", label: "Active" }, { value: "inactive", label: "Inactive" }] }]} />}
    {tab === "attendance" && <AttendanceWorkspace />}
    {tab === "salary" && <DataWorkbench title="Salary payments" description="Record a worker’s salary settlement for a month." path={apiRoutes.labor.salaries} columns={[{ key: "worker_name", label: "Worker" }, { key: "pay_month", label: "Pay month" }, { key: "base_salary", label: "Base ৳" }, { key: "absence_deduction", label: "Deduction ৳" }, { key: "bonus", label: "Bonus ৳" }, { key: "net_paid", label: "Net ৳" }, { key: "paid_date", label: "Paid date" }]} fields={[{ name: "worker_id", label: "Worker", type: "select", sourcePath: apiRoutes.labor.workers, sourceValue: "worker_id", required: true }, { name: "pay_month", label: "Pay month", type: "date", required: true }, { name: "base_salary", label: "Base salary ৳", type: "number", required: true }, { name: "absence_deduction", label: "Absence deduction ৳", type: "number" }, { name: "bonus", label: "Bonus ৳", type: "number" }, { name: "paid_date", label: "Paid date", type: "date", required: true }, { name: "status", label: "Status", type: "select", options: [{ value: "paid", label: "Paid" }, { value: "pending", label: "Pending" }, { value: "cancelled", label: "Cancelled" }] }]} />}
    {tab === "substitutes" && <DataWorkbench title="Substitute and mill charges" description="Record one-day substitute costs and other mill charges." path={apiRoutes.labor.substitutes} columns={[{ key: "charge_date", label: "Date" }, { key: "charge_type", label: "Type" }, { key: "substitute_name", label: "Substitute" }, { key: "amount", label: "Amount ৳" }, { key: "description", label: "Description" }]} fields={[{ name: "charge_date", label: "Date", type: "date", required: true }, { name: "charge_type", label: "Type", type: "select", required: true, options: [{ value: "substitute_worker", label: "Substitute worker" }, { value: "worker_food", label: "Worker food" }, { value: "other", label: "Other" }] }, { name: "substitute_name", label: "Substitute name" }, { name: "amount", label: "Amount ৳", type: "number", required: true }, { name: "description", label: "Description", type: "textarea" }]} />}
  </div>;
}

export function AttendanceWorkspace({ initialDate }: { initialDate?: string } = {}) {
  const [date, setDate] = useState(initialDate ?? today());
  const [workers, setWorkers] = useState<Record<string, unknown>[]>([]);
  const [attendance, setAttendance] = useState<Record<string, { present: boolean; note: string }>>({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const load = useCallback(async () => {
    setLoading(true); setError("");
    try {
      const [workerRows, attendanceRows] = await Promise.all([
        apiRequest<Record<string, unknown>[]>(apiQuery(apiRoutes.labor.workers, { status: "active" })),
        apiRequest<Record<string, unknown>[]>(apiQuery(apiRoutes.labor.attendance, { attendance_date: date })),
      ]);
      setWorkers(workerRows);
      setAttendance(Object.fromEntries(workerRows.map((worker) => {
        const workerId = String(worker.worker_id);
        const existing = attendanceRows.find((row) => row.worker_id === worker.worker_id);
        return [workerId, { present: existing ? Boolean(existing.is_present) : true, note: String(existing?.note ?? "") }];
      })));
    } catch (cause) { setError(messageFor(cause)); }
    finally { setLoading(false); }
  }, [date]);
  useEffect(() => { const timer = window.setTimeout(() => { void load(); }, 0); return () => window.clearTimeout(timer); }, [load]);
  async function save() {
    setSaving(true); setError(""); setNotice("");
    try {
      await apiRequest(apiRoutes.labor.attendanceBatch, { method: "POST", body: { attendance_date: date, records: workers.map((worker) => ({ worker_id: worker.worker_id, is_present: attendance[String(worker.worker_id)]?.present ?? true, note: attendance[String(worker.worker_id)]?.note || null })) } });
      setNotice("Attendance saved.");
    } catch (cause) { setError(messageFor(cause)); }
    finally { setSaving(false); }
  }
  return <section className="space-y-4">
    <div className="flex items-end gap-3"><label className={labelClass}>Attendance date<input type="date" value={date} onChange={(event) => setDate(event.target.value)} className={inputClass} /></label><button onClick={() => void load()} className="rounded-md border border-stone-200 bg-white px-4 py-2 text-sm">Load day</button></div>
    {error && <Notice>{error}</Notice>}{notice && <Notice tone="success">{notice}</Notice>}
    <div className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
      {loading ? <p className="p-8 text-center text-sm text-stone-500">Loading attendance…</p> : workers.length === 0 ? <p className="p-8 text-center text-sm text-stone-500">No active workers found. Add a worker first.</p> : <div className="divide-y divide-stone-100">{workers.map((worker) => {
        const id = String(worker.worker_id); const value = attendance[id] ?? { present: true, note: "" };
        return <div key={id} className="grid items-center gap-3 px-4 py-3 sm:grid-cols-[1fr_auto_minmax(180px,280px)]"><div><p className="text-sm font-medium text-stone-800">{String(worker.name)}</p><p className="text-xs text-stone-500">{String(worker.role ?? "Worker")}</p></div><label className="flex items-center gap-2 text-sm text-stone-700"><input type="checkbox" checked={value.present} onChange={(event) => setAttendance((current) => ({ ...current, [id]: { ...value, present: event.target.checked } }))} className="size-4 accent-emerald-800" />Present</label><input disabled={value.present} value={value.note} onChange={(event) => setAttendance((current) => ({ ...current, [id]: { ...value, note: event.target.value } }))} placeholder="Reason for absence" className={`${inputClass} disabled:bg-stone-50`} /></div>;
      })}</div>}
      <div className="flex justify-end border-t border-stone-100 p-4"><button onClick={() => void save()} disabled={saving || workers.length === 0} className="rounded-md bg-emerald-800 px-4 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save attendance"}</button></div>
    </div>
  </section>;
}

function FilterSelect({ path, valueKey, value, onChange, placeholder }: { path: string; valueKey: string; value: string; onChange: (value: string) => void; placeholder: string }) {
  return <select value={value} onChange={(event) => onChange(event.target.value)} className={inputClass}><option value="">{placeholder}</option><RemoteOptions path={path} valueKey={valueKey} labelKey="name" /></select>;
}

function RemoteOptions({ path, valueKey, labelKey }: { path: string; valueKey: string; labelKey: string }) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  useEffect(() => { void apiRequest<Record<string, unknown>[]>(path).then(setItems).catch(() => setItems([])); }, [path]);
  return <>{items.map((item, index) => <option key={String(item[valueKey] ?? index)} value={String(item[valueKey] ?? "")}>{String(item[labelKey] ?? "")}</option>)}</>;
}

const inputClass = "w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800 outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/10";
const labelClass = "block text-xs font-medium text-stone-600";
function today() { return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date()); }
function dateAfter(dateValue: string, days: number) { const date = new Date(`${dateValue}T12:00:00+06:00`); date.setDate(date.getDate() + days); return date.toISOString().slice(0, 10); }
function money(value: unknown) { return value == null ? "—" : `৳ ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value))}`; }
function messageFor(cause: unknown) { return cause instanceof Error ? cause.message : "Request failed. Please try again."; }
