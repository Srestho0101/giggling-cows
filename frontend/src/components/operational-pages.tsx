"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { DataWorkbench, Notice, type FormField, type TableColumn } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import { Icon } from "@/components/icons";
import { Badge, btn, Segmented, Tabs, ui } from "@/components/ui";
import { apiRequest, apiRoutes, apiQuery } from "@/lib/api";
import { MilkRecordsWorkspace } from "@/components/milk-records-workspace";

const cowColumns: TableColumn[] = [
  { key: "current_tag_number", label: "Tag" },
  { key: "category", label: "Category" },
  { key: "breed", label: "Breed" },
  { key: "sex", label: "Sex" },
  { key: "birth_date", label: "Birth date" },
  { key: "age", label: "Age" },
  { key: "age_group", label: "Age group" },
  { key: "dam_tag", label: "Dam" },
  { key: "sire_tag", label: "Sire" },
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
  {
    name: "breed",
    label: "Breed / calf type",
    type: "select",
    requiredOnCreate: true,
    options: [
      { value: "deshi", label: "Deshi" },
      { value: "friesian", label: "Friesian" },
      { value: "other", label: "Other / unknown" },
    ],
  },
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
    showWhen: {
      field: "acquisition_type",
      equals: ["bought_from_supplier", "bought_from_bazar"],
    },
  },
  {
    name: "dam_id",
    label: "Dam",
    type: "select",
    required: true,
    sourcePath: `${apiRoutes.herd.cows}?sex=female`,
    sourceValue: "cow_id",
    sourceLabel: "current_tag_number",
    showWhen: { field: "acquisition_type", equals: ["born_on_farm"] },
  },
  {
    name: "sire_id",
    label: "Sire (optional)",
    type: "select",
    sourcePath: `${apiRoutes.herd.cows}?sex=male`,
    sourceValue: "cow_id",
    sourceLabel: "current_tag_number",
    showWhen: { field: "acquisition_type", equals: ["born_on_farm"] },
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
        updatePath={(row) => apiRoutes.herd.cow(String(row.cow_id))}
        lifecycle={{
          includeQuery: "include_archived=true",
          entityType: "cows",
          idKey: "cow_id",
          isInactive: (row) => row.is_archived === true || row.status === "archived",
          restoreBody: () => ({ is_archived: false }),
          restoreLabel: () => "Unarchive",
        }}
        deleteLabel="Archive"
        onDelete={async (row) => {
          if (!window.confirm("Archive this cow?")) return;
          await apiRequest(apiRoutes.herd.cow(String(row.cow_id)), { method: "PATCH", body: { is_archived: true } });
        }}
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
                  <p className="mt-2">Cow price per kg = cow price ÷ cow total weight</p>
                  <p className="mt-1 font-medium text-ink tabular-nums">
                    {money(offered)} ÷ {Number(liveWeight).toFixed(2)} kg = {money(Number(offered) / Number(liveWeight))}/kg
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
        updatePath={(row) => apiRoutes.evaluations.update(String(row.evaluation_id))}
        lifecycle={{
          includeQuery: "include_archived=true",
          entityType: "purchase_evaluations",
          idKey: "evaluation_id",
          isInactive: (row) => row.is_archived === true,
          restoreBody: () => ({ is_archived: false }),
          restoreLabel: () => "Unarchive",
        }}
        deleteLabel="Archive"
        onDelete={async (row) => {
          if (!window.confirm("Archive this purchase evaluation?")) return;
          await apiRequest(apiRoutes.evaluations.update(String(row.evaluation_id)), {
            method: "PATCH",
            body: { is_archived: true },
          });
        }}
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
        updatePath={(row) => apiRoutes.health.breedingRecord(String(row.breeding_id))}
        lifecycle={{
          includeQuery: "include_archived=true",
          entityType: "breeding_records",
          idKey: "breeding_id",
          isInactive: (row) => row.is_archived === true,
          restoreBody: () => ({ is_archived: false }),
          restoreLabel: () => "Unarchive",
        }}
        deleteLabel="Archive"
        onDelete={async (row) => {
          if (!window.confirm("Archive this breeding record?")) return;
          await apiRequest(apiRoutes.health.breedingRecord(String(row.breeding_id)), {
            method: "PATCH",
            body: { is_archived: true },
          });
        }}
        columns={[
          { key: "cow_tag_number", label: "Cow" },
          { key: "heat_date", label: "Heat date" },
          { key: "seed_date", label: "Insemination" },
          { key: "method", label: "Method" },
          { key: "semen_code", label: "Semen code" },
          { key: "doctor_name", label: "Doctor" },
          { key: "outcome", label: "Outcome" },
          { key: "is_archived", label: "Archived" },
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
          {
            name: "is_archived",
            label: "Archived",
            type: "select",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
      />
      <DataWorkbench
        title="Pregnancy checks"
        description="Log pregnancy results and expected calving dates."
        path={apiRoutes.health.pregnancy}
        updatePath={(row) => apiRoutes.health.pregnancyReport(String(row.pregnancy_id))}
        lifecycle={{
          includeQuery: "include_archived=true",
          entityType: "pregnancy_reports",
          idKey: "pregnancy_id",
          isInactive: (row) => row.is_archived === true,
          restoreBody: () => ({ is_archived: false }),
          restoreLabel: () => "Unarchive",
        }}
        deleteLabel="Archive"
        onDelete={async (row) => {
          if (!window.confirm("Archive this pregnancy report?")) return;
          await apiRequest(apiRoutes.health.pregnancyReport(String(row.pregnancy_id)), {
            method: "PATCH",
            body: { is_archived: true },
          });
        }}
        columns={[
          { key: "cow_tag_number", label: "Cow" },
          { key: "report_date", label: "Check date" },
          { key: "status", label: "Result" },
          { key: "expected_calving_date", label: "Expected calving" },
          { key: "actual_calving_date", label: "Actual calving" },
          { key: "notes", label: "Notes" },
          { key: "is_archived", label: "Archived" },
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
          {
            name: "is_archived",
            label: "Archived",
            type: "select",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
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
        updatePath={(row) => apiRoutes.health.record(String(row.health_id))}
        lifecycle={{
          includeQuery: "include_archived=true",
          entityType: "health_records",
          idKey: "health_id",
          isInactive: (row) => row.is_archived === true,
          restoreBody: () => ({ is_archived: false }),
          restoreLabel: () => "Unarchive",
        }}
        deleteLabel="Archive"
        onDelete={async (row) => {
          if (!window.confirm("Archive this health record?")) return;
          await apiRequest(apiRoutes.health.record(String(row.health_id)), {
            method: "PATCH",
            body: { is_archived: true },
          });
        }}
        columns={[
          { key: "record_date", label: "Date" },
          { key: "cow_tag_number", label: "Cow" },
          { key: "record_type", label: "Type" },
          { key: "vet_name", label: "Vet" },
          { key: "cost", label: "Cost ৳" },
          { key: "next_due_date", label: "Next due" },
          { key: "details", label: "Details" },
          { key: "is_archived", label: "Archived" },
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
          {
            name: "is_archived",
            label: "Archived",
            type: "select",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
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
        updatePath={(row) => apiRoutes.feeding.expense(String(row.expense_id))}
        lifecycle={{
          includeQuery: "include_archived=true&include_void=true",
          entityType: "expenses",
          idKey: "expense_id",
          isInactive: (row) => row.is_archived === true || row.is_void === true,
          restoreBody: (row) => row.is_archived === true ? { is_archived: false } : { is_void: false },
          restoreLabel: (row) => row.is_archived === true ? "Unarchive" : "Unvoid",
        }}
        deleteLabel="Void"
        onDelete={async (row) => {
          const reason = window.prompt("Reason for voiding this expense:");
          if (reason === null) return;
          if (!reason.trim()) {
            window.alert("A reason is required to void an expense.");
            return;
          }
          await apiRequest(apiRoutes.feeding.expense(String(row.expense_id)), {
            method: "PATCH",
            body: { is_void: true, void_reason: reason.trim() },
          });
        }}
        query={query}
        onRows={setExpenses}
        columns={[
          { key: "expense_date", label: "Date" },
          { key: "category_name", label: "Category" },
          { key: "warehouse_name", label: "Warehouse" },
          { key: "cow_tag_number", label: "Cow" },
          { key: "amount", label: "Amount ৳" },
          { key: "description", label: "Description" },
          { key: "is_archived", label: "Archived" },
          { key: "is_void", label: "Voided" },
          { key: "void_reason", label: "Void reason" },
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
          {
            name: "is_archived",
            label: "Archived",
            type: "select",
            options: [
              { value: "true", label: "Yes" },
              { value: "false", label: "No" },
            ],
          },
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
        <MilkRecordsWorkspace />
      )}

      {tab === "customers" && (
        <DataWorkbench
          title="Customers"
          description="Maintain customers and review their outstanding balance."
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
          updatePath={(row) => apiRoutes.sales.invoiceStatus(String(row.invoice_id))}
          lifecycle={{
            includeQuery: "include_void=true",
            entityType: "sales_invoices",
            idKey: "invoice_id",
            isInactive: (row) => row.status === "void",
            restoreBody: () => ({ status: "issued" }),
            restoreLabel: () => "Reissue",
          }}
          deleteLabel="Void"
          onDelete={async (row) => {
            const reason = window.prompt("Reason for voiding this invoice:");
            if (reason === null) return;
            if (!reason.trim()) {
              window.alert("A reason is required to void an invoice.");
              return;
            }
            await apiRequest(apiRoutes.sales.invoiceStatus(String(row.invoice_id)), {
              method: "PATCH",
              body: { status: "void", void_reason: reason.trim() },
            });
          }}
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

type PayrollWorker = { worker_id: string; name: string; monthly_salary: number | string; weekly_holidays?: number[] };
type PayrollAttendance = { is_present: boolean; is_archived: boolean };
const WEEKDAY_LABELS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

function weekdayIndex(date: string) {
  return (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
}

function workerHasHoliday(worker: Record<string, unknown>, date: string) {
  const holidays = Array.isArray(worker.weekly_holidays) ? worker.weekly_holidays : [];
  return holidays.some((day) => Number(day) === weekdayIndex(date));
}

function localDateString() {
  const today = new Date();
  return `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, "0")}-${String(today.getDate()).padStart(2, "0")}`;
}

function monthString(date: string) {
  return date.slice(0, 7);
}

function SalaryPaymentEntry({ onSaved }: { onSaved: () => void }) {
  const [workers, setWorkers] = useState<PayrollWorker[]>([]);
  const [workerId, setWorkerId] = useState("");
  const [payMonth, setPayMonth] = useState(monthString(localDateString()));
  const [paidDate, setPaidDate] = useState(localDateString());
  const [bonus, setBonus] = useState("");
  const [status, setStatus] = useState("paid");
  const [absentDays, setAbsentDays] = useState(0);
  const [attendanceLoading, setAttendanceLoading] = useState(false);
  const [attendanceError, setAttendanceError] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    apiRequest<PayrollWorker[]>(apiRoutes.labor.workers)
      .then((rows) => { if (!cancelled) setWorkers(rows); })
      .catch((cause) => { if (!cancelled) setError(cause instanceof Error ? cause.message : "Could not load workers."); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    if (!workerId || !payMonth) {
      setAbsentDays(0);
      setAttendanceLoading(false);
      setAttendanceError(false);
      return;
    }
    let cancelled = false;
    setAttendanceLoading(true);
    setAttendanceError(false);
    setAbsentDays(0);
    apiRequest<PayrollAttendance[]>(`${apiRoutes.labor.attendance}?month=${payMonth}-01&worker_id=${workerId}`)
      .then((rows) => {
        if (!cancelled) setAbsentDays(rows.filter((row) => !row.is_present && !row.is_archived).length);
      })
      .catch((cause) => {
        if (!cancelled) {
          setAttendanceError(true);
          setError(cause instanceof Error ? cause.message : "Could not load monthly attendance.");
        }
      })
      .finally(() => { if (!cancelled) setAttendanceLoading(false); });
    return () => { cancelled = true; };
  }, [workerId, payMonth]);

  const worker = workers.find((row) => row.worker_id === workerId);
  const baseSalary = Number(worker?.monthly_salary ?? 0);
  const [year, monthNumber] = payMonth.split("-").map(Number);
  const daysInMonth = year && monthNumber ? new Date(year, monthNumber, 0).getDate() : 0;
  const weeklyHolidayDays = worker?.weekly_holidays ?? [];
  const holidayDatesInMonth = daysInMonth
    ? Array.from({ length: daysInMonth }, (_, index) => {
      const date = `${payMonth}-${String(index + 1).padStart(2, "0")}`;
      return weeklyHolidayDays.includes(weekdayIndex(date));
    }).filter(Boolean).length
    : 0;
  const absenceDeduction = daysInMonth > 0
    ? Math.round((baseSalary / daysInMonth * absentDays + Number.EPSILON) * 100) / 100
    : 0;
  const netAmount = Math.max(0, baseSalary - absenceDeduction + Number(bonus || 0));

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workerId || !worker || !payMonth) return;
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.labor.salaries, {
        method: "POST",
        body: {
          worker_id: workerId,
          pay_month: `${payMonth}-01`,
          base_salary: baseSalary,
          absence_deduction: absenceDeduction,
          bonus: Number(bonus || 0),
          paid_date: paidDate,
          status,
        },
      });
      setNotice("Salary payment saved.");
      setBonus("");
      setWorkerId("");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not save salary payment.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3.5">
      <div>
        <h2 className="text-[15px] font-semibold text-ink">Add salary payment</h2>
        <p className="mt-0.5 text-[12px] text-muted">Base salary and absence deduction are calculated from the worker record and selected month’s attendance.</p>
      </div>
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <form onSubmit={(event) => void submit(event)} className="rounded-[6px] border border-line bg-subtle p-4 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Worker<span className="ml-1 text-warn">*</span></span>
            <select required value={workerId} onChange={(event) => {
              const nextWorkerId = event.target.value;
              setWorkerId(nextWorkerId);
              setAbsentDays(0);
              setAttendanceLoading(Boolean(nextWorkerId && payMonth));
              setAttendanceError(false);
              setError("");
            }} className={ui.select}>
              <option value="">Choose worker</option>
              {workers.map((row) => <option key={row.worker_id} value={row.worker_id}>{row.name}</option>)}
            </select>
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Pay month<span className="ml-1 text-warn">*</span></span>
            <input required type="month" value={payMonth} onChange={(event) => {
              const nextMonth = event.target.value;
              setPayMonth(nextMonth);
              setAbsentDays(0);
              setAttendanceLoading(Boolean(workerId && nextMonth));
              setAttendanceError(false);
              setError("");
            }} className={ui.input} />
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Base salary ৳</span>
            <input readOnly value={worker ? baseSalary.toFixed(2) : ""} placeholder="Select a worker" className={`${ui.input} bg-stone-100`} />
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Absent days</span>
            <input readOnly value={attendanceLoading ? "Loading attendance…" : absentDays} className={`${ui.input} bg-stone-100`} />
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Absence deduction ৳</span>
            <input readOnly value={worker ? absenceDeduction.toFixed(2) : ""} placeholder="Calculated from attendance" className={`${ui.input} bg-stone-100`} />
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Bonus ৳ <span className="font-normal text-muted">(optional)</span></span>
            <input type="number" min="0" step="0.01" value={bonus} onChange={(event) => setBonus(event.target.value)} placeholder="Leave blank if none" className={ui.input} />
            <span className="mt-1 block font-normal text-muted">Usually paid twice a year at 50% of monthly salary; enter an amount when applicable.</span>
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Net salary ৳</span>
            <input readOnly value={worker ? netAmount.toFixed(2) : ""} className={`${ui.input} bg-stone-100`} />
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Paid date<span className="ml-1 text-warn">*</span></span>
            <input required type="date" value={paidDate} onChange={(event) => setPaidDate(event.target.value)} className={ui.input} />
          </label>
          <label className="text-[12px] font-medium text-ink"><span className="mb-1 block">Status</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={ui.select}>
              <option value="paid">Paid</option><option value="pending">Pending</option><option value="cancelled">Cancelled</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-muted">Daily salary: monthly salary ÷ {daysInMonth || "number of"} days in the selected month. Deduction: daily salary × recorded absent days. Unrecorded days are not treated as absences.</p>
        {worker && <p className="text-[11px] text-muted">{weeklyHolidayDays.length ? `${weeklyHolidayDays.map((day) => WEEKDAY_LABELS[day]).join(", ")} (${holidayDatesInMonth} date${holidayDatesInMonth === 1 ? "" : "s"} this month)` : "No weekly holidays set"}; holidays are excluded from attendance and deductions.</p>}
        {attendanceError && <p role="alert" className="text-xs text-warn">Attendance could not be loaded. Retry by changing the worker or month before saving.</p>}
        <div className="flex justify-end"><button type="submit" disabled={saving || attendanceLoading || attendanceError || !workerId || !daysInMonth} className={btn("primary", "sm")}>{saving ? "Saving…" : "Save salary payment"}</button></div>
      </form>
    </section>
  );
}

export function PayrollWorkspace() {
  const [tab, setTab] = useState("workers");
  const [salaryRefreshKey, setSalaryRefreshKey] = useState(0);
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
          rowHref={(row) => `/payroll/workers/${String(row.worker_id)}`}
          updatePath={(row) => apiRoutes.labor.worker(String(row.worker_id))}
          deletePath={(row) => apiRoutes.labor.worker(String(row.worker_id))}
          deleteLabel="Remove"
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "workers",
            idKey: "worker_id",
            isInactive: (row) => row.is_archived === true,
            archiveBody: () => ({ is_archived: true }),
            archiveLabel: "Archive",
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          columns={[
            { key: "name", label: "Name" },
            { key: "role", label: "Role" },
            { key: "phone", label: "Phone" },
            { key: "join_date", label: "Joined" },
            { key: "monthly_salary", label: "Monthly salary ৳" },
            { key: "weekly_holidays", label: "Weekly holidays" },
            { key: "status", label: "Status" },
            { key: "is_archived", label: "Archived" },
          ]}
          fields={[
            { name: "name", label: "Name", required: true },
            { name: "phone", label: "Phone" },
            { name: "role", label: "Role" },
            { name: "join_date", label: "Join date", type: "date", required: true },
            { name: "monthly_salary", label: "Monthly salary ৳", type: "number", required: true },
            { name: "weekly_holidays", label: "Weekly holidays", type: "weekdays" },
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
        <div className="space-y-4">
          <SalaryPaymentEntry onSaved={() => setSalaryRefreshKey((key) => key + 1)} />
          <DataWorkbench
            title="Salary payments"
            description="Salary settlements, including their recorded attendance deduction and bonus."
            path={apiRoutes.labor.salaries}
            refreshKey={salaryRefreshKey}
            updatePath={(row) => apiRoutes.labor.salary(String(row.payment_id))}
            lifecycle={{
              includeQuery: "include_void=true",
              entityType: "salary_payments",
              idKey: "payment_id",
              isInactive: (row) => row.is_void === true,
              restoreBody: () => ({ is_void: false }),
              restoreLabel: () => "Unvoid",
            }}
            deleteLabel="Void"
            onDelete={async (row) => {
              const reason = window.prompt("Reason for voiding this salary payment:");
              if (reason === null) return;
              if (!reason.trim()) {
                window.alert("A reason is required to void a salary payment.");
                return;
              }
              await apiRequest(apiRoutes.labor.salary(String(row.payment_id)), {
                method: "PATCH",
                body: { is_void: true, void_reason: reason.trim() },
              });
            }}
            columns={[
              { key: "worker_name", label: "Worker" },
              { key: "pay_month", label: "Pay month" },
              { key: "base_salary", label: "Base ৳" },
              { key: "absence_deduction", label: "Deduction ৳" },
              { key: "bonus", label: "Bonus ৳" },
              { key: "net_paid", label: "Net ৳" },
              { key: "paid_date", label: "Paid date" },
              { key: "is_void", label: "Voided" },
              { key: "void_reason", label: "Void reason" },
            ]}
            fields={[
              { name: "worker_id", label: "Worker", type: "select", sourcePath: apiRoutes.labor.workers, sourceValue: "worker_id", required: true },
              { name: "pay_month", label: "Pay month", type: "date", required: true },
              { name: "base_salary", label: "Base salary ৳", type: "number", required: true },
              { name: "absence_deduction", label: "Absence deduction ৳", type: "number" },
              { name: "bonus", label: "Bonus ৳", type: "number" },
              { name: "paid_date", label: "Paid date", type: "date", required: true },
              { name: "status", label: "Status", type: "select", options: [
                { value: "paid", label: "Paid" },
                { value: "pending", label: "Pending" },
                { value: "cancelled", label: "Cancelled" },
              ] },
            ]}
          />
        </div>
      )}

      {tab === "substitutes" && (
        <DataWorkbench
          title="Substitute and mill charges"
          description="Record one-day substitute costs and other mill charges."
          addLabel="Add charge"
          path={apiRoutes.labor.substitutes}
          updatePath={(row) => apiRoutes.labor.substitute(String(row.mill_charge_id))}
          lifecycle={{
            includeQuery: "include_archived=true&include_void=true",
            entityType: "mill_charges",
            idKey: "mill_charge_id",
            isInactive: (row) => row.is_archived === true || row.is_void === true,
            restoreBody: (row) => row.is_archived === true ? { is_archived: false } : { is_void: false },
            restoreLabel: (row) => row.is_archived === true ? "Unarchive" : "Unvoid",
          }}
          deleteLabel="Void"
          onDelete={async (row) => {
            const reason = window.prompt("Reason for voiding this charge:");
            if (reason === null) return;
            if (!reason.trim()) {
              window.alert("A reason is required to void a charge.");
              return;
            }
            await apiRequest(apiRoutes.labor.substitute(String(row.mill_charge_id)), {
              method: "PATCH",
              body: { is_void: true, void_reason: reason.trim() },
            });
          }}
          columns={[
            { key: "charge_date", label: "Date" },
            { key: "charge_type", label: "Type" },
            { key: "substitute_name", label: "Substitute" },
            { key: "amount", label: "Amount ৳" },
            { key: "description", label: "Description" },
            { key: "is_archived", label: "Archived" },
            { key: "is_void", label: "Voided" },
            { key: "void_reason", label: "Void reason" },
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
    Record<string, { present: boolean; note: string; attendanceId?: string; isArchived?: boolean; isSaved?: boolean }>
  >({});
  const [showArchivedAttendance, setShowArchivedAttendance] = useState(false);
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
          apiQuery(apiRoutes.labor.attendance, {
            attendance_date: date,
            include_archived: showArchivedAttendance,
          })
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
                attendanceId: existing?.created_at ? String(existing.attendance_id) : undefined,
                isArchived: Boolean(existing?.is_archived),
                isSaved: Boolean(existing?.created_at),
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
  }, [date, showArchivedAttendance]);

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
          records: workers.filter((worker) => !workerHasHoliday(worker, date)).map((worker) => ({
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

  async function setArchived(record: { attendanceId?: string }, archived: boolean) {
    if (!record.attendanceId) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.labor.attendanceRecord(record.attendanceId), {
        method: "PATCH",
        body: { is_archived: archived },
      });
      setNotice(archived ? "Attendance archived." : "Attendance restored.");
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  const content = (
    <div className="space-y-3.5">
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <label className="flex items-center gap-2 text-xs text-muted">
        <input
          type="checkbox"
          checked={showArchivedAttendance}
          onChange={(event) => setShowArchivedAttendance(event.target.checked)}
        />
        Show archived attendance
      </label>

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
              const value = attendance[id] ?? { present: true, note: "", isArchived: false };
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
                    {workerHasHoliday(worker, date) ? (
                      <span className="rounded-full bg-amber-50 px-3 py-1.5 text-[12px] font-medium text-amber-800">Holiday · attendance excluded</span>
                    ) : <>
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
                        disabled={value.isArchived}
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
                      {value.isSaved && value.attendanceId ? (
                        <>
                          <button
                            type="button"
                            onClick={() => void setArchived(value, !value.isArchived)}
                            className="text-[11px] font-medium text-accent hover:underline"
                          >
                            {value.isArchived ? "Restore" : "Archive"}
                          </button>
                          <SafeDataHistory entityType="worker_attendances" entityId={value.attendanceId} />
                        </>
                      ) : null}
                    </>}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end border-t border-line bg-subtle px-3.5 py-2.5">
          <button
            onClick={() => void save()}
            disabled={saving || workers.length === 0 || workers.every((worker) => workerHasHoliday(worker, date))}
            className={btn("primary", "sm")}
          >
            {saving ? "Saving…" : workers.length > 0 && workers.every((worker) => workerHasHoliday(worker, date)) ? "All workers on holiday" : "Save attendance"}
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
