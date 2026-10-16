"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataWorkbench, Notice, type FormField, type TableColumn } from "@/components/data-workbench";
import { Icon } from "@/components/icons";
import { Badge, btn, Segmented, Tabs, ui } from "@/components/ui";
import { apiRequest, apiRoutes, apiQuery } from "@/lib/api";

const cowColumns: TableColumn[] = [
  { key: "current_tag_number", label: "Tag" },
  { key: "category", label: "Category" },
  { key: "sex", label: "Sex" },
  { key: "birth_date", label: "Birth date" },
  { key: "warehouse_name", label: "Warehouse" },
  { key: "status", label: "Status" },
  { key: "latest_weight_kg", label: "Latest kg" },
];

const cowFields: FormField[] = [
  { name: "current_tag_number", label: "Tag number", required: true },
  {
    name: "sex",
    label: "Sex",
    type: "select",
    required: true,
    options: [
      { value: "female", label: "Female" },
      { value: "male", label: "Male" },
    ],
  },
  { name: "category", label: "Category", required: true, placeholder: "Milking cow, heifer…" },
  { name: "birth_date", label: "Birth date", type: "date" },
  {
    name: "acquisition_type",
    label: "Acquisition",
    type: "select",
    required: true,
    options: [
      { value: "born_on_farm", label: "Born on farm" },
      { value: "bought_from_supplier", label: "Bought from supplier" },
      { value: "bought_from_bazar", label: "Bought from bazar" },
    ],
  },
  { name: "acquisition_date", label: "Acquisition date", type: "date", required: true },
  {
    name: "supplier_id",
    label: "Supplier",
    type: "select",
    sourcePath: apiRoutes.herd.suppliers,
    sourceValue: "supplier_id",
  },
  {
    name: "warehouse_id",
    label: "Warehouse",
    type: "select",
    required: true,
    sourcePath: apiRoutes.herd.warehouses,
    sourceValue: "warehouse_id",
  },
  { name: "purchase_price", label: "Purchase price ৳", type: "number" },
  {
    name: "status",
    label: "Status",
    type: "select",
    options: [
      { value: "active", label: "Active" },
      { value: "sold", label: "Sold" },
      { value: "deceased", label: "Deceased" },
    ],
  },
];

export function HerdWorkspace() {
  const [search, setSearch] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [status, setStatus] = useState("");
  const [category, setCategory] = useState("");
  const [sex, setSex] = useState("");

  const query = useMemo(
    () =>
      new URLSearchParams(
        Object.entries({ search, warehouse_id: warehouse, status, category, sex }).filter(
          ([, value]) => value
        )
      ).toString(),
    [search, warehouse, status, category, sex]
  );

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-5">
        <input
          value={search}
          onChange={(event) => setSearch(event.target.value)}
          placeholder="Search by tag"
          className={ui.input}
        />
        <FilterSelect
          path={apiRoutes.herd.warehouses}
          valueKey="warehouse_id"
          value={warehouse}
          onChange={setWarehouse}
          placeholder="All warehouses"
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={ui.select}
        >
          <option value="">All statuses</option>
          <option value="active">Active</option>
          <option value="sold">Sold</option>
          <option value="deceased">Deceased</option>
        </select>
        <input
          value={category}
          onChange={(event) => setCategory(event.target.value)}
          placeholder="Category"
          className={ui.input}
        />
        <select
          value={sex}
          onChange={(event) => setSex(event.target.value)}
          className={ui.select}
        >
          <option value="">All sexes</option>
          <option value="female">Female</option>
          <option value="male">Male</option>
        </select>
      </div>

      <DataWorkbench
        title="Cows"
        description="Search and register animals. Select a tag to open its record."
        path={apiRoutes.herd.cows}
        columns={cowColumns}
        fields={cowFields}
        query={query}
        rowHref={(row) => `/herd/${String(row.cow_id)}`}
      />
    </div>
  );
}

export function PurchasesWorkspace() {
  const [liveWeight, setLiveWeight] = useState("350");
  const [growthPercent, setGrowthPercent] = useState("61");
  const [offered, setOffered] = useState("");
  const [market, setMarket] = useState("");
  const preview = useMemo(() => {
    const liveWeightKg = Number(liveWeight);
    const growthPotentialPercent = Number(growthPercent);
    const cowPrice = Number(offered);
    const marketPricePerKg = Number(market);

    if (
      !Number.isFinite(liveWeightKg) || liveWeightKg <= 0 ||
      !Number.isFinite(growthPotentialPercent) || growthPotentialPercent < 40 || growthPotentialPercent > 80 ||
      !Number.isFinite(cowPrice) || cowPrice <= 0 ||
      !Number.isFinite(marketPricePerKg) || marketPricePerKg <= 0
    ) {
      return null;
    }

    const roundMoneyOrWeight = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const est_net_weight_kg = roundMoneyOrWeight(liveWeightKg * growthPotentialPercent / 100);
    const net_price_per_kg = roundMoneyOrWeight(cowPrice / est_net_weight_kg);
    const price_difference_per_kg = roundMoneyOrWeight(marketPricePerKg - net_price_per_kg);

    return {
      est_net_weight_kg,
      net_price_per_kg,
      market_price_per_kg: marketPricePerKg,
      price_difference_per_kg,
      total_projected_margin: roundMoneyOrWeight(price_difference_per_kg * est_net_weight_kg),
      is_profitable: net_price_per_kg < marketPricePerKg,
    };
  }, [liveWeight, growthPercent, offered, market]);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);
  const [decision, setDecision] = useState("returned");
  const [revision, setRevision] = useState(0);
  const [convertRow, setConvertRow] = useState<Record<string, unknown> | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertValues, setConvertValues] = useState({
    tag_number: "",
    sex: "female",
    category: "Milking cow",
    warehouse_id: "",
    birth_date: "",
    notes: "",
  });

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && convertRow) {
        setConvertRow(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [convertRow]);

  async function saveEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = event.currentTarget;
    setSaving(true);
    setError("");
    setNotice("");
    const formData = new FormData(event.currentTarget);
    try {
      await apiRequest(apiRoutes.evaluations.root, {
        method: "POST",
        body: {
          evaluation_date: formData.get("evaluation_date"),
          supplier_id: formData.get("supplier_id") || null,
          live_weight_kg: Number(liveWeight),
          growth_potential: "good",
          custom_net_weight_percent: Number(growthPercent),
          offered_price: Number(offered),
          market_price_per_kg: Number(market),
          decision,
          notes: formData.get("notes") || null,
        },
      });
      setNotice("Evaluation saved.");
      form.reset();
      setRevision((value) => value + 1);
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  async function returnEvaluation(row: Record<string, unknown>) {
    setError("");
    try {
      await apiRequest(apiRoutes.evaluations.update(String(row.evaluation_id)), {
        method: "PATCH",
        body: { decision: "returned" },
      });
      setRevision((value) => value + 1);
      setNotice("Evaluation marked returned.");
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  async function convertToCow(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!convertRow) return;
    setConvertBusy(true);
    setError("");
    try {
      await apiRequest(apiRoutes.evaluations.convert(String(convertRow.evaluation_id)), {
        method: "POST",
        body: {
          ...convertValues,
          birth_date: convertValues.birth_date || null,
          notes: convertValues.notes || null,
        },
      });
      setConvertRow(null);
      setRevision((value) => value + 1);
      setNotice("Cow registered from this purchase.");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setConvertBusy(false);
    }
  }

  return (
    <div className="space-y-5">
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <div className="grid gap-4 xl:grid-cols-[1.1fr_0.9fr]">
        {/* Form Card */}
        <form onSubmit={saveEvaluation} className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Evaluate an animal</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Enter the measured live weight and compare the estimated meat price with the market rate.
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Evaluation date</span>
              <input
                name="evaluation_date"
                type="date"
                required
                defaultValue={today()}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Supplier</span>
              <select name="supplier_id" className={ui.select}>
                <option value="">Unknown / bazar</option>
                <RemoteOptions
                  path={apiRoutes.herd.suppliers}
                  valueKey="supplier_id"
                  labelKey="name"
                />
              </select>
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Live weight (kg)</span>
              <input
                type="number"
                min="1"
                step="0.1"
                required
                value={liveWeight}
                onChange={(event) => setLiveWeight(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Growth potential (%)</span>
              <input
                type="number"
                min="40"
                max="80"
                step="0.01"
                required
                value={growthPercent}
                onChange={(event) => setGrowthPercent(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Cow price (৳)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={offered}
                onChange={(event) => setOffered(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Market price (৳/kg)</span>
              <input
                type="number"
                min="0"
                step="0.01"
                required
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">Decision</span>
              <select
                value={decision}
                onChange={(event) => setDecision(event.target.value)}
                className={ui.select}
              >
                <option value="returned">Return</option>
                <option value="bought">Bought</option>
              </select>
            </label>
            <label className="text-[12px] font-medium text-ink sm:col-span-2">
              <span className="block mb-1">Notes</span>
              <textarea name="notes" rows={2} className={ui.textarea} />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={saving} className={btn("primary", "md")}>
              {saving ? "Saving…" : "Save evaluation"}
            </button>
          </div>
        </form>

        {/* Calculation Preview Card */}
        <div className="rounded-[8px] border border-line bg-surface p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Calculation preview</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              Updates as you change the weight or prices.
            </p>
            {preview ? (
              <div className="mt-4 space-y-2.5">
                <div className="rounded-[6px] border border-line bg-subtle p-3 text-[12px] text-muted">
                  <p>Net weight = live weight × growth potential</p>
                  <p className="mt-1 font-medium text-ink tabular-nums">
                    {Number(liveWeight).toFixed(2)} kg × {Number(growthPercent).toFixed(2)}% = {Number(preview.est_net_weight_kg).toFixed(2)} kg
                  </p>
                  <p className="mt-2">Meat price = cow price ÷ net weight</p>
                  <p className="mt-1 font-medium text-ink tabular-nums">
                    {money(offered)} ÷ {Number(preview.est_net_weight_kg).toFixed(2)} kg = {money(preview.net_price_per_kg)}/kg
                  </p>
                </div>
                {[
                  ["Estimated net weight", `${Number(preview.est_net_weight_kg).toFixed(2)} kg`],
                  ["Cow meat price", `${money(preview.net_price_per_kg)}/kg`],
                  ["Market price per kg", money(preview.market_price_per_kg)],
                  ["Projected margin", money(preview.total_projected_margin)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between border-b border-line pb-2 text-[13px]"
                  >
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-ink tabular-nums">{value}</span>
                  </div>
                ))}

                {/* Verdict Banner (not color alone: includes icon and label) */}
                <div
                  className={`mt-4 flex items-center gap-2.5 rounded-[6px] border p-3 ${
                    preview.is_profitable
                      ? "border-accent/40 bg-accent-soft text-accent"
                      : "border-warn/40 bg-warn-soft text-warn"
                  }`}
                >
                  <Icon
                    name={preview.is_profitable ? "check" : "alert"}
                    className="size-5 shrink-0"
                  />
                  <div>
                    <p className="text-[13px] font-semibold leading-tight">
                      {preview.is_profitable ? "Meat price is below market" : Number(preview.price_difference_per_kg) === 0 ? "Meat price matches market" : "Meat price is above market"}
                    </p>
                    <p className="text-[12px] opacity-90">
                      {preview.is_profitable
                        ? `${money(Math.abs(Number(preview.price_difference_per_kg)))} per kg below market.`
                        : Number(preview.price_difference_per_kg) === 0
                          ? "The estimated price per kg equals the market rate."
                          : `${money(Math.abs(Number(preview.price_difference_per_kg)))} per kg above market.`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-[6px] border border-line bg-subtle p-6 text-center text-[13px] text-muted">
                Enter a live weight, growth potential, cow price, and market rate to see the comparison.
              </div>
            )}
          </div>
        </div>
      </div>

      {/* Convert to Cow Modal */}
      {convertRow && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget) setConvertRow(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Register purchased cow"
            onSubmit={convertToCow}
            className="w-full max-w-xl rounded-[8px] border border-line bg-surface p-5 shadow-overlay space-y-4"
          >
            <div>
              <h2 className="text-[16px] font-semibold text-ink">Register purchased cow</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                The cow and its initial tag and warehouse history will be created from this evaluation.
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">Tag number</span>
                <input
                  required
                  value={convertValues.tag_number}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, tag_number: event.target.value }))
                  }
                  className={ui.input}
                />
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">Sex</span>
                <select
                  value={convertValues.sex}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, sex: event.target.value }))
                  }
                  className={ui.select}
                >
                  <option value="female">Female</option>
                  <option value="male">Male</option>
                </select>
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">Category</span>
                <input
                  required
                  value={convertValues.category}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, category: event.target.value }))
                  }
                  className={ui.input}
                />
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">Warehouse</span>
                <select
                  required
                  value={convertValues.warehouse_id}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, warehouse_id: event.target.value }))
                  }
                  className={ui.select}
                >
                  <option value="">Choose warehouse</option>
                  <RemoteOptions
                    path={apiRoutes.herd.warehouses}
                    valueKey="warehouse_id"
                    labelKey="name"
                  />
                </select>
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">Birth date</span>
                <input
                  type="date"
                  value={convertValues.birth_date}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, birth_date: event.target.value }))
                  }
                  className={ui.input}
                />
              </label>
              <label className="text-[12px] font-medium text-ink sm:col-span-2">
                <span className="block mb-1">Notes</span>
                <textarea
                  rows={2}
                  value={convertValues.notes}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, notes: event.target.value }))
                  }
                  className={ui.textarea}
                />
              </label>
            </div>
            <div className="flex justify-end gap-2 pt-2">
              <button
                type="button"
                onClick={() => setConvertRow(null)}
                className={btn("secondary", "md")}
              >
                Cancel
              </button>
              <button disabled={convertBusy} className={btn("primary", "md")}>
                {convertBusy ? "Registering…" : "Register cow"}
              </button>
            </div>
          </form>
        </div>
      )}

      <DataWorkbench
        key={revision}
        title="Purchase evaluations"
        description="Review saved buy and return decisions. Register a bought animal to add it to the herd."
        path={apiRoutes.evaluations.root}
        columns={[
          { key: "evaluation_date", label: "Date" },
          { key: "supplier_name", label: "Supplier" },
          { key: "live_weight_kg", label: "Live kg" },
          { key: "est_net_weight_kg", label: "Estimated kg" },
          { key: "offered_price", label: "Offered ৳" },
          { key: "net_price_per_kg", label: "Net ৳/kg" },
          { key: "is_profitable", label: "Profitable" },
          { key: "decision", label: "Decision" },
        ]}
        fields={[]}
        showCreate={false}
        rowActions={(row) =>
          row.cow_id ? (
            <span className="text-[12px] font-medium text-accent">Registered</span>
          ) : row.decision === "returned" ? (
            <span className="text-[12px] text-muted">Closed</span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConvertRow(row)}
                className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
              >
                Register cow
              </button>
              <button
                type="button"
                onClick={() => void returnEvaluation(row)}
                className="text-[12px] font-medium text-muted hover:underline cursor-pointer"
              >
                Return
              </button>
            </div>
          )
        }
      />
    </div>
  );
}

export function BreedingWorkspace() {
  return (
    <div className="space-y-6">
      <DataWorkbench
        title="Breeding records"
        description="Record heat, insemination, sire or semen details, and outcome."
        path={apiRoutes.health.breeding}
        columns={[
          { key: "cow_tag_number", label: "Cow" },
          { key: "heat_date", label: "Heat date" },
          { key: "seed_date", label: "Insemination" },
          { key: "method", label: "Method" },
          { key: "semen_code", label: "Semen code" },
          { key: "doctor_name", label: "Doctor" },
          { key: "outcome", label: "Outcome" },
        ]}
        fields={[
          {
            name: "cow_id",
            label: "Cow",
            type: "select",
            sourcePath: apiRoutes.herd.cows,
            sourceValue: "cow_id",
            sourceLabel: "current_tag_number",
            required: true,
          },
          { name: "heat_date", label: "Heat date", type: "date" },
          { name: "seed_date", label: "Insemination date", type: "date", required: true },
          {
            name: "method",
            label: "Method",
            type: "select",
            required: true,
            options: [
              { value: "artificial_insemination", label: "Artificial insemination" },
              { value: "natural", label: "Natural" },
            ],
          },
          { name: "semen_code", label: "Semen code" },
          { name: "semen_provider", label: "Semen provider" },
          { name: "doctor_name", label: "Doctor" },
          { name: "cost", label: "Cost ৳", type: "number" },
          {
            name: "outcome",
            label: "Outcome",
            type: "select",
            options: [
              { value: "pending", label: "Pending" },
              { value: "successful", label: "Successful" },
              { value: "failed", label: "Failed" },
            ],
          },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
      />
      <DataWorkbench
        title="Pregnancy checks"
        description="Log pregnancy results and expected calving dates."
        path={apiRoutes.health.pregnancy}
        columns={[
          { key: "cow_tag_number", label: "Cow" },
          { key: "report_date", label: "Check date" },
          { key: "status", label: "Result" },
          { key: "expected_calving_date", label: "Expected calving" },
          { key: "actual_calving_date", label: "Actual calving" },
          { key: "notes", label: "Notes" },
        ]}
        fields={[
          {
            name: "cow_id",
            label: "Cow",
            type: "select",
            sourcePath: apiRoutes.herd.cows,
            sourceValue: "cow_id",
            sourceLabel: "current_tag_number",
            required: true,
          },
          { name: "report_date", label: "Report date", type: "date", required: true },
          {
            name: "status",
            label: "Status",
            type: "select",
            options: [
              { value: "confirmed", label: "Confirmed" },
              { value: "suspected", label: "Suspected" },
              { value: "failed", label: "Not pregnant / failed" },
              { value: "calved", label: "Calved" },
              { value: "aborted", label: "Aborted" },
            ],
          },
          { name: "expected_calving_date", label: "Expected calving", type: "date" },
          { name: "actual_calving_date", label: "Actual calving", type: "date" },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
      />
    </div>
  );
}

export function HealthWorkspace() {
  const [records, setRecords] = useState<Record<string, unknown>[]>([]);
  const dueThrough = dateAfter(today(), 14);
  const upcoming = useMemo(
    () =>
      records
        .filter((row) => typeof row.next_due_date === "string" && row.next_due_date <= dueThrough)
        .sort((a, b) => String(a.next_due_date).localeCompare(String(b.next_due_date))),
    [records, dueThrough]
  );

  return (
    <div className="space-y-5">
      {/* Neutral Care Panel */}
      <section className="rounded-[8px] border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold text-ink">Due and overdue care</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          Upcoming vaccinations, deworming, and health checks due within 14 days.
        </p>
        {upcoming.length ? (
          <div className="mt-3 flex flex-wrap gap-2">
            {upcoming.map((row) => {
              const overdue = String(row.next_due_date) < today();
              return (
                <Badge
                  key={String(row.health_id)}
                  tone={overdue ? "bad" : "warn"}
                  className="px-2.5 py-1 text-[12px]"
                >
                  {String(row.record_type)} · Cow {String(row.cow_tag_number ?? "—")} ·{" "}
                  {overdue ? "overdue" : "due"} {String(row.next_due_date)}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">No care due in the next 14 days.</p>
        )}
      </section>

      <DataWorkbench
        title="Health records"
        description="Vaccinations, deworming, treatment, and checkups."
        path={apiRoutes.health.records}
        columns={[
          { key: "record_date", label: "Date" },
          { key: "cow_tag_number", label: "Cow" },
          { key: "record_type", label: "Type" },
          { key: "vet_name", label: "Vet" },
          { key: "cost", label: "Cost ৳" },
          { key: "next_due_date", label: "Next due" },
          { key: "details", label: "Details" },
        ]}
        onRows={setRecords}
        fields={[
          {
            name: "cow_id",
            label: "Cow",
            type: "select",
            sourcePath: apiRoutes.herd.cows,
            sourceValue: "cow_id",
            sourceLabel: "current_tag_number",
            required: true,
          },
          {
            name: "record_type",
            label: "Type",
            type: "select",
            required: true,
            options: [
              { value: "treatment", label: "Treatment" },
              { value: "vaccination", label: "Vaccination" },
              { value: "deworming", label: "Deworming" },
              { value: "checkup", label: "Checkup" },
            ],
          },
          { name: "record_date", label: "Date", type: "date", required: true },
          { name: "vet_name", label: "Vet" },
          { name: "cost", label: "Cost ৳", type: "number" },
          { name: "next_due_date", label: "Next due", type: "date" },
          { name: "details", label: "Details", type: "textarea" },
        ]}
      />
    </div>
  );
}

export function ExpensesWorkspace() {
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);

  const total = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const query = new URLSearchParams(
    Object.entries({
      category_id: category,
      warehouse_id: warehouse,
      start_date: start,
      end_date: end,
    }).filter(([, value]) => value)
  ).toString();

  return (
    <div className="space-y-4">
      <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
        <FilterSelect
          path={apiRoutes.feeding.categories}
          valueKey="category_id"
          value={category}
          onChange={setCategory}
          placeholder="All categories"
        />
        <FilterSelect
          path={apiRoutes.herd.warehouses}
          valueKey="warehouse_id"
          value={warehouse}
          onChange={setWarehouse}
          placeholder="All warehouses"
        />
        <label className="text-[12px] font-medium text-ink">
          <span className="block mb-1">From</span>
          <input
            type="date"
            value={start}
            onChange={(event) => setStart(event.target.value)}
            className={ui.input}
          />
        </label>
        <label className="text-[12px] font-medium text-ink">
          <span className="block mb-1">To</span>
          <input
            type="date"
            value={end}
            onChange={(event) => setEnd(event.target.value)}
            className={ui.input}
          />
        </label>
      </div>

      <div className="flex items-center justify-between rounded-[8px] border border-line bg-surface px-4 py-3">
        <span className="text-[12px] font-medium text-muted">Total in filtered results</span>
        <strong className="text-[15px] font-semibold text-ink tabular-nums">
          ৳{" "}
          {new Intl.NumberFormat("en-BD", {
            minimumFractionDigits: 2,
            maximumFractionDigits: 2,
          }).format(total)}
        </strong>
      </div>

      <DataWorkbench
        title="Expenses"
        description="Filter and record farm and animal expenses."
        path={apiRoutes.feeding.expenses}
        query={query}
        onRows={setExpenses}
        columns={[
          { key: "expense_date", label: "Date" },
          { key: "category_name", label: "Category" },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "cow_tag_number", label: "Cow" },
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
            sourceLabel: "name",
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
            name: "cow_id",
            label: "Cow",
            type: "select",
            sourcePath: apiRoutes.herd.cows,
            sourceValue: "cow_id",
            sourceLabel: "current_tag_number",
          },
          { name: "expense_date", label: "Date", type: "date", required: true },
          { name: "amount", label: "Amount ৳", type: "number", required: true },
          { name: "description", label: "Description", type: "textarea" },
        ]}
      />
    </div>
  );
}

export function MilkSalesWorkspace() {
  const [tab, setTab] = useState("milk");
  const tabs = [
    { key: "milk", label: "Milk records" },
    { key: "invoices", label: "Sales invoices" },
    { key: "customers", label: "Customers" },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "milk" && (
        <DataWorkbench
          title="Milk production"
          description="Record per-cow production sessions."
          addLabel="Add milk record"
          path={apiRoutes.sales.milk}
          columns={[
            { key: "production_date", label: "Date" },
            { key: "cow_tag_number", label: "Cow" },
            { key: "session", label: "Session" },
            { key: "liters", label: "Liters" },
          ]}
          fields={[
            {
              name: "cow_id",
              label: "Cow",
              type: "select",
              sourcePath: apiRoutes.herd.cows,
              sourceValue: "cow_id",
              sourceLabel: "current_tag_number",
              required: true,
            },
            { name: "production_date", label: "Date", type: "date", required: true },
            {
              name: "session",
              label: "Session",
              type: "select",
              required: true,
              options: [
                { value: "morning", label: "Morning" },
                { value: "noon", label: "Noon" },
                { value: "evening", label: "Evening" },
              ],
            },
            { name: "liters", label: "Liters", type: "number", required: true },
          ]}
        />
      )}

      {tab === "customers" && (
        <DataWorkbench
          title="Customers"
          description="Maintain customers and review their outstanding balance."
          path={apiRoutes.sales.customers}
          columns={[
            { key: "name", label: "Customer" },
            { key: "phone", label: "Phone" },
            { key: "customer_type", label: "Type" },
            { key: "total_invoiced", label: "Invoiced ৳" },
            { key: "total_paid", label: "Paid ৳" },
            { key: "current_balance", label: "Balance ৳" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "phone", label: "Phone" },
            {
              name: "customer_type",
              label: "Customer type",
              type: "select",
              options: [
                { value: "individual", label: "Individual" },
                { value: "dairy_shop", label: "Dairy shop" },
                { value: "wholesaler", label: "Wholesaler" },
                { value: "meat_buyer", label: "Meat buyer" },
              ],
            },
          ]}
        />
      )}

      {tab === "invoices" && (
        <DataWorkbench
          title="Sales invoices"
          description="Create an invoice with one line item. Select an invoice to record payments or update its status."
          path={apiRoutes.sales.invoices}
          columns={[
            { key: "invoice_number", label: "Invoice" },
            { key: "customer_name", label: "Customer" },
            { key: "invoice_date", label: "Date" },
            { key: "status", label: "Status" },
            { key: "total_amount", label: "Total ৳" },
            { key: "paid_amount", label: "Paid ৳" },
            { key: "outstanding_balance", label: "Balance ৳" },
          ]}
          rowHref={(row) => `/milk-sales/invoices/${String(row.invoice_id)}`}
          fields={[
            {
              name: "customer_id",
              label: "Customer",
              type: "select",
              sourcePath: apiRoutes.sales.customers,
              sourceValue: "customer_id",
              sourceLabel: "name",
              required: true,
            },
            { name: "invoice_date", label: "Invoice date", type: "date", required: true },
            { name: "due_date", label: "Due date", type: "date" },
            {
              name: "item_type",
              label: "Item",
              type: "select",
              required: true,
              options: [
                { value: "milk", label: "Milk" },
                { value: "animal", label: "Animal" },
                { value: "other", label: "Other" },
              ],
            },
            { name: "description", label: "Description", required: true },
            { name: "quantity", label: "Quantity", type: "number", required: true },
            { name: "unit_price", label: "Unit price ৳", type: "number", required: true },
            { name: "discount", label: "Discount ৳", type: "number" },
          ]}
          buildBody={(values) => ({
            customer_id: values.customer_id,
            invoice_date: values.invoice_date,
            due_date: values.due_date || null,
            discount: Number(values.discount || 0),
            lines: [
              {
                item_type: values.item_type,
                description: values.description,
                quantity: Number(values.quantity),
                unit_price: Number(values.unit_price),
              },
            ],
          })}
        />
      )}
    </div>
  );
}

export function PayrollWorkspace() {
  const [tab, setTab] = useState("workers");
  const tabs = [
    { key: "workers", label: "Workers" },
    { key: "attendance", label: "Attendance" },
    { key: "salary", label: "Salary payments" },
    { key: "substitutes", label: "Substitutes" },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "workers" && (
        <DataWorkbench
          title="Workers"
          description="Add staff and keep their employment details current."
          path={apiRoutes.labor.workers}
          columns={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "phone", label: "Phone" },
            { key: "join_date", label: "Joined" },
            { key: "monthly_salary", label: "Monthly salary ৳" },
            { key: "status", label: "Status" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "phone", label: "Phone" },
            { name: "role", label: "Role" },
            { name: "join_date", label: "Join date", type: "date", required: true },
            { name: "monthly_salary", label: "Monthly salary ৳", type: "number", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />
      )}

      {tab === "attendance" && <AttendanceWorkspace />}

      {tab === "salary" && (
        <DataWorkbench
          title="Salary payments"
          description="Record a worker’s salary settlement for a month."
          addLabel="Add salary payment"
          path={apiRoutes.labor.salaries}
          columns={[
            { key: "worker_name", label: "Worker" },
            { key: "pay_month", label: "Pay month" },
            { key: "base_salary", label: "Base ৳" },
            { key: "absence_deduction", label: "Deduction ৳" },
            { key: "bonus", label: "Bonus ৳" },
            { key: "net_paid", label: "Net ৳" },
            { key: "paid_date", label: "Paid date" },
          ]}
          fields={[
            {
              name: "worker_id",
              label: "Worker",
              type: "select",
              sourcePath: apiRoutes.labor.workers,
              sourceValue: "worker_id",
              required: true,
            },
            { name: "pay_month", label: "Pay month", type: "date", required: true },
            { name: "base_salary", label: "Base salary ৳", type: "number", required: true },
            { name: "absence_deduction", label: "Absence deduction ৳", type: "number" },
            { name: "bonus", label: "Bonus ৳", type: "number" },
            { name: "paid_date", label: "Paid date", type: "date", required: true },
            {
              name: "status",
              label: "Status",
              type: "select",
              options: [
                { value: "paid", label: "Paid" },
                { value: "pending", label: "Pending" },
                { value: "cancelled", label: "Cancelled" },
              ],
            },
          ]}
        />
      )}

      {tab === "substitutes" && (
        <DataWorkbench
          title="Substitute and mill charges"
          description="Record one-day substitute costs and other mill charges."
          addLabel="Add charge"
          path={apiRoutes.labor.substitutes}
          columns={[
            { key: "charge_date", label: "Date" },
            { key: "charge_type", label: "Type" },
            { key: "substitute_name", label: "Substitute" },
            { key: "amount", label: "Amount ৳" },
            { key: "description", label: "Description" },
          ]}
          fields={[
            { name: "charge_date", label: "Date", type: "date", required: true },
            {
              name: "charge_type",
              label: "Type",
              type: "select",
              required: true,
              options: [
                { value: "substitute_worker", label: "Substitute worker" },
                { value: "worker_food", label: "Worker food" },
                { value: "other", label: "Other" },
              ],
            },
            { name: "substitute_name", label: "Substitute name" },
            { name: "amount", label: "Amount ৳", type: "number", required: true },
            { name: "description", label: "Description", type: "textarea" },
          ]}
        />
      )}
    </div>
  );
}

export function AttendanceWorkspace({
  initialDate,
  embedded = false,
}: {
  initialDate?: string;
  embedded?: boolean;
} = {}) {
  const [date, setDate] = useState(initialDate ?? today());
  const [workers, setWorkers] = useState<Record<string, unknown>[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, { present: boolean; note: string }>
  >({});
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    if (initialDate && initialDate !== date) {
      setDate(initialDate);
    }
  }, [initialDate, date]);

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const [workerRows, attendanceRows] = await Promise.all([
        apiRequest<Record<string, unknown>[]>(
          apiQuery(apiRoutes.labor.workers, { status: "active" })
        ),
        apiRequest<Record<string, unknown>[]>(
          apiQuery(apiRoutes.labor.attendance, { attendance_date: date })
        ),
      ]);
      setWorkers(workerRows);
      setAttendance(
        Object.fromEntries(
          workerRows.map((worker) => {
            const workerId = String(worker.worker_id);
            const existing = attendanceRows.find((row) => row.worker_id === worker.worker_id);
            return [
              workerId,
              {
                present: existing ? Boolean(existing.is_present) : true,
                note: String(existing?.note ?? ""),
              },
            ];
          })
        )
      );
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setLoading(false);
    }
  }, [date]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load();
    }, 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  async function save() {
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.labor.attendanceBatch, {
        method: "POST",
        body: {
          attendance_date: date,
          records: workers.map((worker) => ({
            worker_id: worker.worker_id,
            is_present: attendance[String(worker.worker_id)]?.present ?? true,
            note: attendance[String(worker.worker_id)]?.note || null,
          })),
        },
      });
      setNotice("Attendance saved.");
    } catch (cause) {
      setError(messageFor(cause));
    } finally {
      setSaving(false);
    }
  }

  const content = (
    <div className="space-y-3.5">
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <div className="rounded-[6px] border border-line bg-surface overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-[13px] text-muted">Loading attendance…</p>
        ) : workers.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-muted">
            No active workers found. Add a worker first.
          </p>
        ) : (
          <div className="divide-y divide-line">
            {workers.map((worker) => {
              const id = String(worker.worker_id);
              const value = attendance[id] ?? { present: true, note: "" };
              const initial = String(worker.name ?? "W").slice(0, 1).toUpperCase();
              return (
                <div
                  key={id}
                  className="flex flex-wrap items-center justify-between gap-3 px-3.5 py-2.5"
                >
                  <div className="flex items-center gap-2.5 min-w-[140px]">
                    <div className="size-8 rounded-full border border-line bg-subtle text-ink font-semibold flex items-center justify-center text-[13px] shrink-0">
                      {initial}
                    </div>
                    <div>
                      <p className="text-[13px] font-semibold text-ink leading-tight">
                        {String(worker.name)}
                      </p>
                      <p className="text-[11px] text-muted">{String(worker.role ?? "Worker")}</p>
                    </div>
                  </div>

                  <div className="flex flex-1 items-center justify-end gap-2.5 max-sm:w-full">
                    <Segmented
                      name={`att-${id}`}
                      size="sm"
                      value={value.present ? "present" : "absent"}
                      onChange={(next) =>
                        setAttendance((current) => ({
                          ...current,
                          [id]: { ...value, present: next === "present" },
                        }))
                      }
                      options={[
                        { value: "present", label: "Present", tone: "accent" },
                        { value: "absent", label: "Absent", tone: "warn" },
                      ]}
                    />
                    {!value.present && (
                      <input
                        value={value.note}
                        onChange={(event) =>
                          setAttendance((current) => ({
                            ...current,
                            [id]: { ...value, note: event.target.value },
                          }))
                        }
                        placeholder="Reason for absence"
                        className={`${ui.input} !h-8 w-44 sm:w-56 text-[12px]`}
                      />
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end border-t border-line bg-subtle px-3.5 py-2.5">
          <button
            onClick={() => void save()}
            disabled={saving || workers.length === 0}
            className={btn("primary", "sm")}
          >
            {saving ? "Saving…" : "Save attendance"}
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) {
    return content;
  }

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Daily attendance</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            Mark active workers present or absent for {date}.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <input
            type="date"
            value={date}
            onChange={(event) => setDate(event.target.value)}
            className={`${ui.input} !h-8 w-auto`}
          />
          <button onClick={() => void load()} className={btn("secondary", "sm")}>
            Load day
          </button>
        </div>
      </div>
      {content}
    </section>
  );
}

function FilterSelect({
  path,
  valueKey,
  value,
  onChange,
  placeholder,
}: {
  path: string;
  valueKey: string;
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={ui.select}>
      <option value="">{placeholder}</option>
      <RemoteOptions path={path} valueKey={valueKey} labelKey="name" />
    </select>
  );
}

function RemoteOptions({
  path,
  valueKey,
  labelKey,
}: {
  path: string;
  valueKey: string;
  labelKey: string;
}) {
  const [items, setItems] = useState<Record<string, unknown>[]>([]);
  useEffect(() => {
    void apiRequest<Record<string, unknown>[]>(path)
      .then(setItems)
      .catch(() => setItems([]));
  }, [path]);
  return (
    <>
      {items.map((item, index) => (
        <option key={String(item[valueKey] ?? index)} value={String(item[valueKey] ?? "")}>
          {String(item[labelKey] ?? "")}
        </option>
      ))}
    </>
  );
}

function today() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

function dateAfter(dateValue: string, days: number) {
  const date = new Date(`${dateValue}T12:00:00+06:00`);
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function money(value: unknown) {
  return value == null
    ? "—"
    : `৳ ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(Number(value))}`;
}

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : "Request failed. Please try again.";
}
