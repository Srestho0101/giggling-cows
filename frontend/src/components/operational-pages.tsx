"use client";

import React, { useCallback, useEffect, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { DataWorkbench, Notice, type FormField, type TableColumn } from "@/components/data-workbench";
import { Icon } from "@/components/icons";
import { Badge, btn, DateInput, Segmented, StatTile, Tabs, ui } from "@/components/ui";
import { apiRequest, apiRoutes, apiQuery } from "@/lib/api";
import { MilkRecordsWorkspace } from "@/components/milk-records-workspace";
import { SalesInvoicesManager } from "@/components/sales-invoices-manager";
import { BreedingWorkspaceView } from "@/components/breeding/breeding-workspace";
import { useI18n } from "@/lib/i18n";

const cowColumns: TableColumn[] = [
  { key: "current_tag_number", label: "Tag" },
  { key: "category", label: "Category" },
  { key: "cow_type", label: "Cow type" },
  { key: "breed", label: "Breed" },
  { key: "color", label: "Color" },
  { key: "marking", label: "Marking" },
  { key: "sex", label: "Sex" },
  { key: "days_on_farm", label: "Days on farm" },
  { key: "birth_date", label: "Birth date" },
  { key: "age", label: "Age" },
  { key: "age_group", label: "Age group" },
  { key: "dam_tag", label: "Dam" },
  { key: "sire_tag", label: "Sire" },
  { key: "warehouse_name", label: "Shed" },
  { key: "status", label: "Status" },
  { key: "latest_weight_kg", label: "Latest kg" },
];

const cowFields: FormField[] = [
  { name: "current_tag_number", label: "Tag", required: true },
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
  {
    name: "gives_milk",
    label: "Milking",
    type: "select",
    options: [
      { value: "false", label: "No" },
      { value: "true", label: "Yes" },
    ],
    defaultValue: "false",
    showWhen: { field: "sex", equals: ["female"] },
  },
  {
    name: "category",
    label: "Category",
    type: "select",
    required: true,
    options: [
      { value: "dairy", label: "Dairy" },
      { value: "beef", label: "Beef" },
      { value: "duel-purpose", label: "Dual-purpose" },
    ],
  },
  {
    name: "cow_type",
    label: "Cow type",
    type: "select",
    options: [
      { value: "Bull Calf", label: "Bull Calf" },
      { value: "Heifer Calf", label: "Heifer Calf" },
      { value: "Bull", label: "Bull" },
      { value: "Cow", label: "Cow" },
      { value: "Heifer", label: "Heifer" },
      { value: "Ox", label: "Ox" },
    ],
  },
  {
    name: "breed",
    label: "Breed / calf type",
    type: "select",
    requiredOnCreate: true,
    options: [
      { value: "deshi", label: "Deshi" },
      { value: "friesian", label: "Friesian" },
      { value: "other", label: "Other / Unknown" },
    ],
  },
  { name: "color", label: "Color", placeholder: "e.g. Black & white, Red" },
  { name: "marking", label: "Marking", placeholder: "e.g. White star on forehead" },
  { name: "birth_date", label: "Birth date", type: "date" },
  {
    name: "acquisition_type",
    label: "Acquisition",
    type: "select",
    required: true,
    options: [
      { value: "born_on_farm", label: "Born on Farm" },
      { value: "bought_from_supplier", label: "Bought from Supplier" },
      { value: "bought_from_bazar", label: "Bought from Bazar" },
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
    label: "Dam (optional)",
    type: "select",
    sourcePath: `${apiRoutes.herd.cows}?sex=female`,
    sourceValue: "cow_id",
    sourceLabel: "current_tag_number",
  },
  {
    name: "sire_id",
    label: "Sire (optional)",
    type: "select",
    sourcePath: `${apiRoutes.herd.cows}?sex=male`,
    sourceValue: "cow_id",
    sourceLabel: "current_tag_number",
  },
  {
    name: "warehouse_id",
    label: "Shed",
    type: "select",
    required: true,
    sourcePath: apiRoutes.herd.warehouses,
    sourceValue: "warehouse_id",
  },
  {
    name: "purchase_price",
    label: "Purchase price ৳",
    type: "number",
    showWhen: {
      field: "acquisition_type",
      equals: ["bought_from_supplier", "bought_from_bazar"],
    },
  },
  {
    name: "status",
    label: "Status",
    type: "select",
    editOnly: true,
    options: [
      { value: "active", label: "Active" },
      { value: "sold", label: "Sold" },
      { value: "deceased", label: "Deceased" },
    ],
  },
];

export function HerdWorkspace() {
  const { tr } = useI18n();
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
          placeholder={tr("Search by tag")}
          className={ui.input}
        />
        <FilterSelect
          path={apiRoutes.herd.warehouses}
          valueKey="warehouse_id"
          value={warehouse}
          onChange={setWarehouse}
          placeholder={tr("All sheds")}
        />
        <select
          value={status}
          onChange={(event) => setStatus(event.target.value)}
          className={ui.select}
        >
          <option value="">{tr("All statuses")}</option>
          <option value="active">{tr("Active")}</option>
          <option value="sold">{tr("Sold")}</option>
          <option value="deceased">{tr("Deceased")}</option>
        </select>
        <CategoryFilterSelect
          value={category}
          onChange={setCategory}
          placeholder={tr("All categories")}
        />
        <select
          value={sex}
          onChange={(event) => setSex(event.target.value)}
          className={ui.select}
        >
          <option value="">{tr("All sexes")}</option>
          <option value="female">{tr("Female", "গাভী / বকনা")}</option>
          <option value="male">{tr("Male", "ষাঁড় / বাছুর")}</option>
        </select>
      </div>

      <DataWorkbench
        title="Cows"
        singularLabel="Cow"
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
          await apiRequest(apiRoutes.herd.cow(String(row.cow_id)), {
            method: "PATCH",
            body: { is_archived: true },
          });
        }}
        columns={cowColumns}
        fields={cowFields}
        query={query}
        rowHref={(row) => `/herd/${String(row.cow_id)}`}
        invalidateKeys={[["herd-cows"], ["global-cow-search"], ["milk-workspace-cows"]]}
      />
    </div>
  );
}

export function PurchasesWorkspace() {
  const { tr, money, num } = useI18n();
  const queryClient = useQueryClient();

  const [evalDate, setEvalDate] = useState(today);
  const [supplierId, setSupplierId] = useState("");
  const [liveWeight, setLiveWeight] = useState("350");
  const [dressingPercent, setDressingPercent] = useState("61");
  const [offered, setOffered] = useState("");
  const [market, setMarket] = useState("");
  const [notes, setNotes] = useState("");
  const [manualDecision, setManualDecision] = useState<string | null>(null);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [saving, setSaving] = useState(false);

  const [convertRow, setConvertRow] = useState<Record<string, unknown> | null>(null);
  const [convertBusy, setConvertBusy] = useState(false);
  const [convertValues, setConvertValues] = useState({
    tag_number: "",
    sex: "female",
    category: "beef",
    warehouse_id: "",
    birth_date: "",
    notes: "",
  });

  const preview = useMemo(() => {
    const liveWeightKg = Number(liveWeight);
    const netPct = Number(dressingPercent);
    const cowPrice = Number(offered);
    const marketPricePerKg = Number(market);

    if (
      !Number.isFinite(liveWeightKg) || liveWeightKg <= 0 ||
      !Number.isFinite(netPct) || netPct < 40 || netPct > 80 ||
      !Number.isFinite(cowPrice) || cowPrice <= 0 ||
      !Number.isFinite(marketPricePerKg) || marketPricePerKg <= 0
    ) {
      return null;
    }

    const roundMoneyOrWeight = (value: number) => Math.round((value + Number.EPSILON) * 100) / 100;
    const est_net_weight_kg = roundMoneyOrWeight(liveWeightKg * netPct / 100);
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
  }, [liveWeight, dressingPercent, offered, market]);

  const decision = manualDecision ?? (preview ? (preview.is_profitable ? "bought" : "returned") : "pending");

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && convertRow) {
        setConvertRow(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [convertRow]);

  async function refreshEvaluations() {
    await queryClient.invalidateQueries({ queryKey: ["data-workbench", apiRoutes.evaluations.root] });
  }

  async function saveEvaluation(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.evaluations.root, {
        method: "POST",
        body: {
          evaluation_date: evalDate,
          supplier_id: supplierId || null,
          live_weight_kg: Number(liveWeight),
          growth_potential: Number(dressingPercent) >= 58 ? "good" : "poor",
          custom_net_weight_percent: Number(dressingPercent),
          offered_price: Number(offered),
          market_price_per_kg: Number(market),
          decision,
          notes: notes.trim() || null,
        },
      });
      setNotice(tr("Evaluation saved.", "মূল্যায়ন সংরক্ষিত হয়েছে।"));
      setEvalDate(today());
      setSupplierId("");
      setLiveWeight("350");
      setDressingPercent("61");
      setOffered("");
      setMarket("");
      setNotes("");
      setManualDecision(null);
      await refreshEvaluations();
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
      await refreshEvaluations();
      setNotice(tr("Evaluation marked returned.", "মূল্যায়ন ফেরত হিসেবে চিহ্নিত হয়েছে।"));
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
      await Promise.all([
        refreshEvaluations(),
        queryClient.invalidateQueries({ queryKey: ["data-workbench", apiRoutes.herd.cows] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setNotice(tr("Cow registered from this purchase.", "এই ক্রয় থেকে গরু নিবন্ধিত হয়েছে।"));
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
            <h2 className="text-[15px] font-semibold text-ink">{tr("Evaluate an animal")}</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {tr(
                "Enter the measured live weight and compare the estimated meat price with the market rate.",
                "জীবন্ত ওজন লিখে বাজার দরের সাথে আনুমানিক মাংসের দাম তুলনা করুন।"
              )}
            </p>
          </div>
          <div className="grid gap-3 sm:grid-cols-2">
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Evaluation date")}</span>
              <DateInput value={evalDate} onChange={setEvalDate} required />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Supplier")}</span>
              <select
                value={supplierId}
                onChange={(event) => setSupplierId(event.target.value)}
                className={ui.select}
              >
                <option value="">{tr("Unknown / bazar", "অজানা / বাজার")}</option>
                <RemoteOptions
                  path={apiRoutes.herd.suppliers}
                  valueKey="supplier_id"
                  labelKey="name"
                />
              </select>
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Live weight (kg)")}</span>
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
              <span className="block mb-1">{tr("Meat yield / Dressing (%)")}</span>
              <input
                type="number"
                min="40"
                max="80"
                step="0.01"
                required
                value={dressingPercent}
                onChange={(event) => setDressingPercent(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Cow price (৳)")}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={offered}
                onChange={(event) => setOffered(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Market price (৳/kg)")}</span>
              <input
                type="number"
                min="0.01"
                step="0.01"
                required
                value={market}
                onChange={(event) => setMarket(event.target.value)}
                className={ui.input}
              />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("Decision")}</span>
              <select
                value={decision}
                onChange={(event) => setManualDecision(event.target.value)}
                className={ui.select}
              >
                <option value="pending">{tr("Pending", "অপেক্ষমাণ")}</option>
                <option value="returned">{tr("Return", "ফেরত")}</option>
                <option value="bought">{tr("Bought", "ক্রয়কৃত")}</option>
              </select>
            </label>
            <label className="text-[12px] font-medium text-ink sm:col-span-2">
              <span className="block mb-1">{tr("Notes")}</span>
              <textarea
                rows={2}
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                className={ui.textarea}
              />
            </label>
          </div>
          <div className="flex flex-wrap gap-2 pt-1">
            <button disabled={saving} className={btn("primary", "md")}>
              {saving ? tr("Saving…") : tr("Save evaluation")}
            </button>
          </div>
        </form>

        {/* Calculation Preview Card */}
        <div className="rounded-[8px] border border-line bg-surface p-4 flex flex-col justify-between">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{tr("Calculation preview")}</h2>
            <p className="mt-0.5 text-[12px] text-muted">
              {tr("Updates as you change the weight or prices.", "ওজন বা দাম পরিবর্তন করলে সাথে সাথে হিসাব আপডেট হয়।")}
            </p>
            {preview ? (
              <div className="mt-4 space-y-2.5">
                <div className="rounded-[6px] border border-line bg-subtle p-3 text-[12px] text-muted">
                  <p>{tr("Net meat weight = live weight × dressing (%)", "নিট মাংস = জীবন্ত ওজন × ড্রেসিং (%)")}</p>
                  <p className="mt-1 font-medium text-ink tabular-nums">
                    {num(liveWeight)} kg × {num(dressingPercent)}% = {num(preview.est_net_weight_kg)} kg
                  </p>
                  <p className="mt-2">{tr("Cow price per kg = cow price ÷ live weight", "জীবন্ত কেজি প্রতি দাম = গরুর দাম ÷ জীবন্ত ওজন")}</p>
                  <p className="mt-1 font-medium text-ink tabular-nums">
                    {money(offered)} ÷ {num(liveWeight)} kg = {money(Number(offered) / Number(liveWeight))}/kg
                  </p>
                  <p className="mt-2">{tr("Dressed meat price = cow price ÷ net meat weight", "মাংস প্রতি দাম = গরুর দাম ÷ নিট মাংস")}</p>
                  <p className="mt-1 font-medium text-ink tabular-nums">
                    {money(offered)} ÷ {num(preview.est_net_weight_kg)} kg = {money(preview.net_price_per_kg)}/kg
                  </p>
                </div>
                {[
                  [tr("Estimated meat weight", "আনুমানিক মাংস"), `${num(preview.est_net_weight_kg)} kg`],
                  [tr("Cow meat price", "গরুর মাংসের দাম"), `${money(preview.net_price_per_kg)}/kg`],
                  [tr("Market price per kg", "বাজার দর/কেজি"), money(preview.market_price_per_kg)],
                  [tr("Projected margin", "সম্ভাব্য লাভ"), money(preview.total_projected_margin)],
                ].map(([label, value]) => (
                  <div
                    key={label}
                    className="flex justify-between border-b border-line pb-2 text-[13px]"
                  >
                    <span className="text-muted">{label}</span>
                    <span className="font-semibold text-ink tabular-nums">{value}</span>
                  </div>
                ))}

                {/* Verdict Banner */}
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
                      {preview.is_profitable
                        ? tr("Meat price is below market", "মাংসের দাম বাজার দরের চেয়ে কম")
                        : Number(preview.price_difference_per_kg) === 0
                          ? tr("Meat price matches market", "মাংসের দাম বাজার দরের সমান")
                          : tr("Meat price is above market", "মাংসের দাম বাজার দরের চেয়ে বেশি")}
                    </p>
                    <p className="text-[12px] opacity-90">
                      {preview.is_profitable
                        ? `${money(Math.abs(Number(preview.price_difference_per_kg)))} ${tr("per kg below market.", "প্রতি কেজিতে কম।")}`
                        : Number(preview.price_difference_per_kg) === 0
                          ? tr("The estimated price per kg equals the market rate.")
                          : `${money(Math.abs(Number(preview.price_difference_per_kg)))} ${tr("per kg above market.", "প্রতি কেজিতে বেশি।")}`}
                    </p>
                  </div>
                </div>
              </div>
            ) : (
              <div className="mt-8 rounded-[6px] border border-line bg-subtle p-6 text-center text-[13px] text-muted">
                {tr(
                  "Enter a live weight, meat yield (%), cow price, and market rate to see the comparison.",
                  "তুলনা দেখতে জীবন্ত ওজন, মাংস প্রাপ্তি (%), গরুর দাম এবং বাজার দর লিখুন।"
                )}
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
            aria-label={tr("Register purchased cow", "ক্রয়কৃত গরু নিবন্ধন")}
            onSubmit={convertToCow}
            className="w-full max-w-xl rounded-[8px] border border-line bg-surface p-5 text-ink shadow-overlay space-y-4"
          >
            <div>
              <h2 className="text-[16px] font-semibold text-ink">{tr("Register purchased cow", "ক্রয়কৃত গরু নিবন্ধন")}</h2>
              <p className="mt-0.5 text-[12px] text-muted">
                {tr(
                  "The cow and its initial tag and shed history will be created from this evaluation.",
                  "এই মূল্যায়ন থেকে গরুর প্রাথমিক ট্যাগ ও শেডের ইতিহাস তৈরি হবে।"
                )}
              </p>
            </div>
            <div className="grid gap-3 sm:grid-cols-2">
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">{tr("Tag number")}</span>
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
                <span className="block mb-1">{tr("Sex")}</span>
                <select
                  value={convertValues.sex}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, sex: event.target.value }))
                  }
                  className={ui.select}
                >
                  <option value="female">{tr("Female", "গাভী/বকনা")}</option>
                  <option value="male">{tr("Male", "ষাঁড়/বাছুর")}</option>
                </select>
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">{tr("Category")}</span>
                <select
                  required
                  value={convertValues.category}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, category: event.target.value }))
                  }
                  className={ui.select}
                >
                  <option value="dairy">{tr("Dairy", "দুগ্ধবতী")}</option>
                  <option value="beef">{tr("Beef", "মাংস উৎপাদন")}</option>
                  <option value="duel-purpose">{tr("Dual-purpose")}</option>
                </select>
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">{tr("Shed")}</span>
                <select
                  required
                  value={convertValues.warehouse_id}
                  onChange={(event) =>
                    setConvertValues((v) => ({ ...v, warehouse_id: event.target.value }))
                  }
                  className={ui.select}
                >
                  <option value="">{tr("Choose shed", "শেড নির্বাচন করুন")}</option>
                  <RemoteOptions
                    path={apiRoutes.herd.warehouses}
                    valueKey="warehouse_id"
                    labelKey="name"
                  />
                </select>
              </label>
              <label className="text-[12px] font-medium text-ink">
                <span className="block mb-1">{tr("Birth date")}</span>
                <DateInput
                  value={convertValues.birth_date}
                  onChange={(nextIso) =>
                    setConvertValues((v) => ({ ...v, birth_date: nextIso }))
                  }
                />
              </label>
              <label className="text-[12px] font-medium text-ink sm:col-span-2">
                <span className="block mb-1">{tr("Notes")}</span>
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
                {tr("Cancel")}
              </button>
              <button disabled={convertBusy} className={btn("primary", "md")}>
                {convertBusy ? tr("Registering…", "নিবন্ধন হচ্ছে…") : tr("Register cow")}
              </button>
            </div>
          </form>
        </div>
      )}

      <DataWorkbench
        title="Purchase evaluations"
        singularLabel="Purchase evaluation"
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
        fields={[
          { name: "evaluation_date", label: "Evaluation date", type: "date", required: true },
          {
            name: "supplier_id",
            label: "Supplier",
            type: "select",
            sourcePath: apiRoutes.herd.suppliers,
            sourceValue: "supplier_id",
          },
          { name: "live_weight_kg", label: "Live weight (kg)", type: "number", min: "1", required: true },
          { name: "net_weight_percent", label: "Meat yield / Dressing (%)", type: "number", min: "40", max: "80", required: true },
          { name: "offered_price", label: "Cow price (৳)", type: "number", min: "0.01", required: true },
          { name: "market_price_per_kg", label: "Market price (৳/kg)", type: "number", min: "0.01", required: true },
          {
            name: "decision",
            label: "Decision",
            type: "select",
            required: true,
            options: [
              { value: "pending", label: "Pending" },
              { value: "bought", label: "Bought" },
              { value: "returned", label: "Returned" },
            ],
          },
          { name: "notes", label: "Notes", type: "textarea" },
        ]}
        buildBody={(vals) => ({
          evaluation_date: vals.evaluation_date,
          supplier_id: vals.supplier_id || null,
          live_weight_kg: Number(vals.live_weight_kg),
          growth_potential: Number(vals.net_weight_percent) >= 58 ? "good" : "poor",
          custom_net_weight_percent: Number(vals.net_weight_percent),
          offered_price: Number(vals.offered_price),
          market_price_per_kg: Number(vals.market_price_per_kg),
          decision: vals.decision,
          notes: vals.notes?.trim() || null,
        })}
        showCreate={false}
        rowActions={(row) =>
          row.cow_id ? (
            <span className="text-[12px] font-medium text-accent">{tr("Registered")}</span>
          ) : row.decision === "returned" ? (
            <span className="text-[12px] text-muted">{tr("Closed")}</span>
          ) : (
            <div className="flex items-center gap-2">
              <button
                type="button"
                onClick={() => setConvertRow(row)}
                className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
              >
                {tr("Register cow")}
              </button>
              <button
                type="button"
                onClick={() => void returnEvaluation(row)}
                className="text-[12px] font-medium text-muted hover:underline cursor-pointer"
              >
                {tr("Return")}
              </button>
            </div>
          )
        }
      />
    </div>
  );
}

export function BreedingWorkspace() {
  return <BreedingWorkspaceView />;
}

export function HealthWorkspace() {
  const { tr, date: fmtDate, enumLabel } = useI18n();
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
      {/* Care Alert Panel */}
      <section className="rounded-[8px] border border-line bg-surface p-4">
        <h2 className="text-[15px] font-semibold text-ink">{tr("Due and overdue care")}</h2>
        <p className="mt-0.5 text-[12px] text-muted">
          {tr(
            "Upcoming vaccinations, deworming, and health checks due within 14 days.",
            "আগামী ১৪ দিনের মধ্যে নির্ধারিত টিকা, কৃমিনাশক ও স্বাস্থ্য পরীক্ষা।"
          )}
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
                  {enumLabel(row.record_type)} · {tr("Cow")} {String(row.cow_tag_number ?? "—")} ·{" "}
                  {overdue ? tr("overdue", "মেয়াদোত্তীর্ণ") : tr("due", "নির্ধারিত")}{" "}
                  {fmtDate(String(row.next_due_date))}
                </Badge>
              );
            })}
          </div>
        ) : (
          <p className="mt-3 text-[13px] text-muted">{tr("No care due in the next 14 days.")}</p>
        )}
      </section>

      <DataWorkbench
        title="Health records"
        singularLabel="Health record"
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

type FeedTypeRow = {
  feed_type_id: string;
  name: string;
  name_bn: string;
  unit: string;
  unit_cost: string | number;
  stock_quantity: string | number;
  reorder_level: string | number;
  category_name?: string | null;
};

export function ExpensesWorkspace() {
  const { tr, money, num, lang } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("expenses");
  const [category, setCategory] = useState("");
  const [warehouse, setWarehouse] = useState("");
  const [start, setStart] = useState("");
  const [end, setEnd] = useState("");
  const [expenses, setExpenses] = useState<Record<string, unknown>[]>([]);
  const [feedingRows, setFeedingRows] = useState<Record<string, unknown>[]>([]);

  // Restock modal state
  const [restockTarget, setRestockTarget] = useState<FeedTypeRow | null>(null);
  const [restockQty, setRestockQty] = useState("");
  const [restockCost, setRestockCost] = useState("");
  const [restockDate, setRestockDate] = useState(today);
  const [restockNotes, setRestockNotes] = useState("");
  const [restockBusy, setRestockBusy] = useState(false);
  const [restockError, setRestockError] = useState("");
  const [restockNotice, setRestockNotice] = useState("");

  const total = expenses.reduce((sum, item) => sum + Number(item.amount ?? 0), 0);
  const feedTotalCost = feedingRows.reduce((sum, item) => sum + Number(item.cost ?? 0), 0);

  const milkStatsQuery = useQuery({
    queryKey: ["expenses-feed-milk-ratio", start, end],
    queryFn: () =>
      apiRequest<{ liters: number }[]>(
        apiQuery(apiRoutes.sales.milk, {
          start_date: start || undefined,
          end_date: end || undefined,
        })
      ),
    enabled: tab === "feeding",
    staleTime: 30_000,
  });

  const totalMilkLiters = (milkStatsQuery.data ?? []).reduce(
    (sum, item) => sum + Number(item.liters ?? 0),
    0
  );
  const feedCostPerLiter = totalMilkLiters > 0 ? feedTotalCost / totalMilkLiters : null;

  const feedTypesQuery = useQuery({
    queryKey: ["feed-inventory-types"],
    queryFn: () => apiRequest<FeedTypeRow[]>(apiRoutes.feeding.feedTypes),
    enabled: tab === "inventory",
    staleTime: 30_000,
  });

  const query = new URLSearchParams(
    Object.entries({
      category_id: category,
      warehouse_id: warehouse,
      start_date: start,
      end_date: end,
    }).filter(([, value]) => value)
  ).toString();

  const feedingQuery = new URLSearchParams(
    Object.entries({
      start_date: start,
      end_date: end,
    }).filter(([, value]) => value)
  ).toString();

  async function submitRestock(event: React.FormEvent) {
    event.preventDefault();
    if (!restockTarget) return;
    const qty = Number(restockQty);
    if (!Number.isFinite(qty) || qty <= 0) {
      setRestockError(tr("Enter a positive quantity.", "০-এর বেশি পরিমাণ লিখুন।"));
      return;
    }
    setRestockBusy(true);
    setRestockError("");
    setRestockNotice("");
    try {
      await apiRequest(apiRoutes.feeding.stockEntries, {
        method: "POST",
        body: {
          feed_type_id: restockTarget.feed_type_id,
          entry_date: restockDate,
          quantity_added: qty,
          unit_cost: restockCost ? Number(restockCost) : undefined,
          notes: restockNotes.trim() || null,
        },
      });
      setRestockNotice(tr("Feed stock updated.", "খাদ্য মজুদ আপডেট হয়েছে।"));
      setRestockTarget(null);
      setRestockQty("");
      setRestockCost("");
      setRestockNotes("");
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["feed-inventory-types"] }),
        queryClient.invalidateQueries({ queryKey: ["data-workbench", apiRoutes.feeding.stockEntries] }),
      ]);
    } catch (cause) {
      setRestockError(messageFor(cause));
    } finally {
      setRestockBusy(false);
    }
  }

  const tabs = [
    { key: "expenses", label: tr("Expenses") },
    { key: "feeding", label: tr("Daily Feeding Log") },
    { key: "inventory", label: tr("Feed Inventory") },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "expenses" && (
        <>
          <div className="grid gap-2.5 sm:grid-cols-2 xl:grid-cols-4">
            <FilterSelect
              path={apiRoutes.feeding.categories}
              valueKey="category_id"
              value={category}
              onChange={setCategory}
              placeholder={tr("All categories")}
            />
            <FilterSelect
              path={apiRoutes.herd.warehouses}
              valueKey="warehouse_id"
              value={warehouse}
              onChange={setWarehouse}
              placeholder={tr("All sheds")}
            />
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("From")}</span>
              <DateInput value={start} onChange={setStart} />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("To")}</span>
              <DateInput value={end} onChange={setEnd} />
            </label>
          </div>

          <div className="flex items-center justify-between rounded-[8px] border border-line bg-surface px-4 py-3">
            <span className="text-[12px] font-medium text-muted">{tr("Total in filtered results")}</span>
            <strong className="text-[15px] font-semibold text-ink tabular-nums">
              {money(total)}
            </strong>
          </div>

          <DataWorkbench
            title="Expenses"
            singularLabel="Expense"
            description="Filter and record farm and animal expenses."
            path={apiRoutes.feeding.expenses}
            updatePath={(row) => apiRoutes.feeding.expense(String(row.expense_id))}
            lifecycle={{
              includeQuery: "include_archived=true&include_void=true",
              entityType: "expenses",
              idKey: "expense_id",
              isInactive: (row) => row.is_archived === true || row.is_void === true,
              restoreBody: (row) => (row.is_archived === true ? { is_archived: false } : { is_void: false }),
              restoreLabel: (row) => (row.is_archived === true ? "Unarchive" : "Unvoid"),
            }}
            deleteLabel="Void"
            deleteConfirmMode="reason"
            onDelete={async (row, reason) => {
              await apiRequest(apiRoutes.feeding.expense(String(row.expense_id)), {
                method: "PATCH",
                body: { is_void: true, void_reason: reason },
              });
            }}
            query={query}
            onRows={setExpenses}
            columns={[
              { key: "expense_date", label: "Date" },
              { key: "category_name", label: "Category" },
              { key: "warehouse_name", label: "Shed" },
              { key: "cow_tag_number", label: "Cow" },
              { key: "amount", label: "Amount ৳" },
              { key: "description", label: "Description" },
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
                label: "Shed",
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
        </>
      )}

      {tab === "feeding" && (
        <>
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("From")}</span>
              <DateInput value={start} onChange={setStart} />
            </label>
            <label className="text-[12px] font-medium text-ink">
              <span className="block mb-1">{tr("To")}</span>
              <DateInput value={end} onChange={setEnd} />
            </label>
            <StatTile
              label={tr("Total feed cost", "মোট খাদ্য খরচ")}
              value={money(feedTotalCost)}
            />
            <StatTile
              label={tr("Feed cost per liter")}
              value={feedCostPerLiter !== null ? `${money(feedCostPerLiter)}/L` : "—"}
              subtext={`${num(totalMilkLiters)} L ${tr("milk produced", "দুধ উৎপাদন")}`}
            />
          </div>

          <DataWorkbench
            title="Daily Feeding Log"
            singularLabel="Feeding record"
            description="Record daily herd or per-cow feed rations. Cost and feed stock update automatically."
            path={apiRoutes.feeding.records}
            updatePath={(row) => apiRoutes.feeding.record(String(row.feeding_id))}
            query={feedingQuery}
            onRows={setFeedingRows}
            invalidateKeys={[["feed-inventory-types"]]}
            lifecycle={{
              includeQuery: "include_archived=true",
              entityType: "feeding_records",
              idKey: "feeding_id",
              isInactive: (row) => row.is_archived === true,
              restoreBody: () => ({ is_archived: false }),
              restoreLabel: () => "Unarchive",
            }}
            deleteLabel="Archive"
            onDelete={async (row) => {
              await apiRequest(apiRoutes.feeding.record(String(row.feeding_id)), {
                method: "PATCH",
                body: { is_archived: true },
              });
            }}
            columns={[
              { key: "feeding_date", label: "Date" },
              { key: "feed_name", label: "Feed type", },
              { key: "cow_tag_number", label: "Cow" },
              { key: "quantity", label: "Quantity" },
              { key: "unit", label: "Unit" },
              { key: "cost", label: "Cost ৳" },
              { key: "notes", label: "Notes" },
            ]}
            fields={[
              {
                name: "feed_type_id",
                label: "Feed type",
                type: "select",
                sourcePath: apiRoutes.feeding.feedTypes,
                sourceValue: "feed_type_id",
                sourceLabel: "name",
                required: true,
              },
              {
                name: "cow_id",
                label: "Cow (optional — leave blank for whole herd)",
                type: "select",
                sourcePath: `${apiRoutes.herd.cows}?status=active`,
                sourceValue: "cow_id",
                sourceLabel: "current_tag_number",
              },
              { name: "feeding_date", label: "Date", type: "date", required: true, defaultValue: today() },
              { name: "quantity", label: "Quantity", type: "number", min: "0.01", required: true },
              { name: "custom_unit_cost", label: "Unit cost override ৳ (optional)", type: "number" },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </>
      )}

      {tab === "inventory" && (
        <div className="space-y-4">
          {restockNotice ? <Notice tone="success">{restockNotice}</Notice> : null}

          <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3.5">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div>
                <h2 className="text-[15px] font-semibold text-ink">{tr("Feed Inventory")}</h2>
                <p className="mt-0.5 text-[12px] text-muted">
                  {tr(
                    "Track on-hand feed stock (silage, straw, concentrate, bran) and restock purchases.",
                    "খাদ্যের বর্তমান মজুদ দেখুন এবং নতুন ক্রয় যোগ করুন।"
                  )}
                </p>
              </div>
            </div>

            {feedTypesQuery.isLoading ? (
              <p className="py-6 text-center text-[13px] text-muted">{tr("Loading…", "লোড হচ্ছে…")}</p>
            ) : (
              <div className="overflow-x-auto rounded-[6px] border border-line">
                <table className="w-full text-left border-collapse text-[13.5px]">
                  <thead>
                    <tr className="border-b border-line bg-subtle text-[12px] text-muted">
                      <th className="px-3.5 py-2.5 font-medium">{tr("Feed type")}</th>
                      <th className="px-3.5 py-2.5 font-medium text-right">{tr("Current stock")}</th>
                      <th className="px-3.5 py-2.5 font-medium text-right">{tr("Reorder level")}</th>
                      <th className="px-3.5 py-2.5 font-medium text-right">{tr("Cost per unit ৳")}</th>
                      <th className="px-3.5 py-2.5 font-medium min-w-[105px]">{tr("Status")}</th>
                      <th className="px-3.5 py-2.5 font-medium text-right">{tr("Actions")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {(feedTypesQuery.data ?? []).map((ft) => {
                      const stock = Number(ft.stock_quantity ?? 0);
                      const reorder = Number(ft.reorder_level ?? 0);
                      const isLow = stock <= reorder;
                      return (
                        <tr key={ft.feed_type_id} className="hover:bg-wash transition-colors">
                          <td className="px-3.5 py-2.5 font-medium text-ink">
                            {lang === "bn" ? ft.name_bn : ft.name}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-ink">
                            {num(stock)} {ft.unit}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-muted">
                            {num(reorder)} {ft.unit}
                          </td>
                          <td className="px-3.5 py-2.5 text-right tabular-nums text-ink">
                            {money(ft.unit_cost)}
                          </td>
                          <td className="px-3.5 py-2.5">
                            <Badge tone={isLow ? "warn" : "good"}>
                              {isLow ? tr("Low stock") : tr("In stock")}
                            </Badge>
                          </td>
                          <td className="px-3.5 py-2.5 text-right">
                            <button
                              type="button"
                              onClick={() => {
                                setRestockTarget(ft);
                                setRestockCost(String(ft.unit_cost));
                                setRestockQty("");
                                setRestockDate(today());
                                setRestockError("");
                              }}
                              className={btn("secondary", "sm")}
                            >
                              {tr("Restock feed")}
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </section>

          {restockTarget && (
            <div
              role="presentation"
              onClick={(e) => {
                if (e.target === e.currentTarget && !restockBusy) setRestockTarget(null);
              }}
              className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
            >
              <form
                role="dialog"
                aria-modal="true"
                aria-label={tr("Restock feed")}
                onSubmit={(e) => void submitRestock(e)}
                className="w-full max-w-md rounded-[8px] border border-line bg-surface p-5 text-ink shadow-overlay space-y-4"
              >
                <div>
                  <h3 className="text-[16px] font-semibold text-ink">
                    {tr("Restock feed")} — {lang === "bn" ? restockTarget.name_bn : restockTarget.name}
                  </h3>
                  <p className="mt-0.5 text-[12px] text-muted">
                    {tr("Current stock")}: {num(restockTarget.stock_quantity)} {restockTarget.unit}
                  </p>
                </div>
                {restockError ? <Notice>{restockError}</Notice> : null}
                <div className="grid gap-3 sm:grid-cols-2">
                  <label className="text-[12px] font-medium text-ink">
                    <span className="block mb-1">{tr("Date")} *</span>
                    <DateInput value={restockDate} onChange={setRestockDate} required />
                  </label>
                  <label className="text-[12px] font-medium text-ink">
                    <span className="block mb-1">{tr("Quantity")} ({restockTarget.unit}) *</span>
                    <input
                      type="number"
                      min="0.01"
                      step="0.01"
                      required
                      autoFocus
                      value={restockQty}
                      onChange={(e) => setRestockQty(e.target.value)}
                      className={ui.input}
                    />
                  </label>
                  <label className="text-[12px] font-medium text-ink sm:col-span-2">
                    <span className="block mb-1">{tr("Cost per unit ৳")}</span>
                    <input
                      type="number"
                      min="0"
                      step="0.01"
                      value={restockCost}
                      onChange={(e) => setRestockCost(e.target.value)}
                      className={ui.input}
                    />
                  </label>
                  <label className="text-[12px] font-medium text-ink sm:col-span-2">
                    <span className="block mb-1">{tr("Notes")}</span>
                    <textarea
                      rows={2}
                      value={restockNotes}
                      onChange={(e) => setRestockNotes(e.target.value)}
                      className={ui.textarea}
                    />
                  </label>
                </div>
                <div className="flex justify-end gap-2">
                  <button
                    type="button"
                    disabled={restockBusy}
                    onClick={() => setRestockTarget(null)}
                    className={btn("secondary", "md")}
                  >
                    {tr("Cancel")}
                  </button>
                  <button type="submit" disabled={restockBusy} className={btn("primary", "md")}>
                    {restockBusy ? tr("Saving…") : tr("Save record")}
                  </button>
                </div>
              </form>
            </div>
          )}

          <DataWorkbench
            title="Feed stock purchases"
            singularLabel="Stock entry"
            description="History of feed restocking entries."
            path={apiRoutes.feeding.stockEntries}
            updatePath={(row) => apiRoutes.feeding.stockEntry(String(row.stock_entry_id))}
            invalidateKeys={[["feed-inventory-types"]]}
            lifecycle={{
              includeQuery: "include_archived=true",
              entityType: "feed_stock_entries",
              idKey: "stock_entry_id",
              isInactive: (row) => row.is_archived === true,
              restoreBody: () => ({ is_archived: false }),
              restoreLabel: () => "Unarchive",
            }}
            deleteLabel="Archive"
            onDelete={async (row) => {
              await apiRequest(apiRoutes.feeding.stockEntry(String(row.stock_entry_id)), {
                method: "PATCH",
                body: { is_archived: true },
              });
            }}
            columns={[
              { key: "entry_date", label: "Date" },
              { key: "feed_name", label: "Feed type" },
              { key: "quantity_added", label: "Quantity" },
              { key: "unit", label: "Unit" },
              { key: "unit_cost", label: "Unit cost ৳" },
              { key: "total_cost", label: "Total cost ৳" },
              { key: "notes", label: "Notes" },
            ]}
            fields={[
              {
                name: "feed_type_id",
                label: "Feed type",
                type: "select",
                sourcePath: apiRoutes.feeding.feedTypes,
                sourceValue: "feed_type_id",
                sourceLabel: "name",
                required: true,
              },
              { name: "entry_date", label: "Date", type: "date", required: true, defaultValue: today() },
              { name: "quantity_added", label: "Quantity", type: "number", min: "0.01", required: true },
              { name: "unit_cost", label: "Cost per unit ৳", type: "number" },
              { name: "notes", label: "Notes", type: "textarea" },
            ]}
          />
        </div>
      )}
    </div>
  );
}

export function MilkSalesWorkspace() {
  const { tr } = useI18n();
  const [tab, setTab] = useState("milk");
  const tabs = [
    { key: "milk", label: tr("Milk records") },
    { key: "invoices", label: tr("Sales invoices") },
    { key: "customers", label: tr("Customers") },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "milk" && <MilkRecordsWorkspace />}

      {tab === "customers" && (
        <DataWorkbench
          title="Customers"
          singularLabel="Customer"
          description="Maintain customers and review their outstanding balance."
          path={apiRoutes.sales.customers}
          updatePath={(row) => apiRoutes.sales.customer(String(row.customer_id))}
          lifecycle={{
            includeQuery: "include_archived=true",
            entityType: "customers",
            idKey: "customer_id",
            isInactive: (row) => row.is_archived === true,
            archiveBody: () => ({ is_archived: true }),
            archiveLabel: "Archive",
            restoreBody: () => ({ is_archived: false }),
            restoreLabel: () => "Unarchive",
          }}
          invalidateKeys={[["sales-customers-options"], ["sales-invoices"]]}
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

      {tab === "invoices" && <SalesInvoicesManager defaultDate={today()} />}
    </div>
  );
}

type PayrollWorker = {
  worker_id: string;
  name: string;
  monthly_salary: number | string;
  weekly_holidays?: number[];
  outstanding_advance?: number | string;
};
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
  const todayDate = new Date();
  return `${todayDate.getFullYear()}-${String(todayDate.getMonth() + 1).padStart(2, "0")}-${String(todayDate.getDate()).padStart(2, "0")}`;
}

function monthString(date: string) {
  return date.slice(0, 7);
}

function SalaryPaymentEntry({ onSaved }: { onSaved: () => void }) {
  const { tr, money, num } = useI18n();
  const [workerId, setWorkerId] = useState("");
  const [payMonth, setPayMonth] = useState(monthString(localDateString()));
  const [paidDate, setPaidDate] = useState(localDateString());
  const [dayBasis, setDayBasis] = useState<"calendar" | "fixed_30">("calendar");
  const [advanceDeduction, setAdvanceDeduction] = useState("");
  const [overtimePay, setOvertimePay] = useState("");
  const [bonus, setBonus] = useState("");
  const [status, setStatus] = useState("paid");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const workersQuery = useQuery({
    queryKey: ["payroll-workers-options"],
    queryFn: () => apiRequest<PayrollWorker[]>(apiRoutes.labor.workers),
    staleTime: 30_000,
  });

  const attendanceQuery = useQuery({
    queryKey: ["payroll-worker-attendance", workerId, payMonth],
    queryFn: () =>
      apiRequest<PayrollAttendance[]>(`${apiRoutes.labor.attendance}?month=${payMonth}-01&worker_id=${workerId}`),
    enabled: Boolean(workerId && payMonth),
    staleTime: 15_000,
  });

  const workers = workersQuery.data ?? [];
  const absentDays = useMemo(
    () => (attendanceQuery.data ?? []).filter((row) => !row.is_present && !row.is_archived).length,
    [attendanceQuery.data]
  );

  const worker = workers.find((row) => row.worker_id === workerId);
  const baseSalary = Number(worker?.monthly_salary ?? 0);
  const outstandingAdvance = Number(worker?.outstanding_advance ?? 0);
  const [year, monthNumber] = payMonth.split("-").map(Number);
  const daysInMonth = year && monthNumber ? new Date(year, monthNumber, 0).getDate() : 0;
  const divisorDays = dayBasis === "fixed_30" ? 30 : daysInMonth;
  const weeklyHolidayDays = worker?.weekly_holidays ?? [];
  const holidayDatesInMonth = daysInMonth
    ? Array.from({ length: daysInMonth }, (_, index) => {
        const d = `${payMonth}-${String(index + 1).padStart(2, "0")}`;
        return weeklyHolidayDays.includes(weekdayIndex(d));
      }).filter(Boolean).length
    : 0;
  const absenceDeduction =
    divisorDays > 0
      ? Math.round((baseSalary / divisorDays * absentDays + Number.EPSILON) * 100) / 100
      : 0;
  const advDedNum = Number(advanceDeduction || 0);
  const overtimeNum = Number(overtimePay || 0);
  const bonusNum = Number(bonus || 0);
  const netAmount = Math.max(0, baseSalary - absenceDeduction - advDedNum + bonusNum + overtimeNum);

  async function submit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!workerId || !worker || !payMonth) return;
    if (baseSalary - absenceDeduction - advDedNum + bonusNum + overtimeNum < 0) {
      setError(tr("Net salary cannot be negative.", "নিট বেতন ঋণাত্মক হতে পারবে না।"));
      return;
    }
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
          advance_deduction: advDedNum,
          bonus: bonusNum,
          overtime_pay: overtimeNum,
          payroll_day_basis: dayBasis,
          paid_date: paidDate,
          status,
        },
      });
      setNotice(tr("Salary payment saved.", "বেতন পরিশোধ সংরক্ষিত হয়েছে।"));
      setBonus("");
      setAdvanceDeduction("");
      setOvertimePay("");
      setWorkerId("");
      onSaved();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Could not save salary payment."));
    } finally {
      setSaving(false);
    }
  }

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3.5">
      <div className="flex flex-wrap items-start justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{tr("Add salary payment")}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {tr(
              "Base salary, absence deduction, advances (ogrim), overtime, and bonuses are settled here.",
              "মূল বেতন, অনুপস্থিতি কর্তন, অগ্রিম (অগ্রিম/বাকি), ওভারটাইম ও বোনাস হিসাব করুন।"
            )}
          </p>
        </div>
        <div className="flex items-center gap-2 text-[12px]">
          <span className="text-muted">{tr("Day divisor", "দিন হিসাব")}:</span>
          <Segmented<"calendar" | "fixed_30">
            name="payroll_day_basis"
            size="sm"
            value={dayBasis}
            onChange={setDayBasis}
            options={[
              { value: "calendar", label: tr("Calendar days", "মাসের দিন") },
              { value: "fixed_30", label: tr("30-day basis", "৩০ দিন") },
            ]}
          />
        </div>
      </div>
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}
      <form onSubmit={(event) => void submit(event)} className="rounded-[6px] border border-line bg-subtle p-4 space-y-3.5">
        <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Worker")}<span className="ml-1 text-warn">*</span></span>
            <select
              required
              value={workerId}
              onChange={(event) => {
                const nextId = event.target.value;
                setWorkerId(nextId);
                const selectedW = workers.find((w) => w.worker_id === nextId);
                setAdvanceDeduction(
                  selectedW && Number(selectedW.outstanding_advance ?? 0) > 0
                    ? String(selectedW.outstanding_advance)
                    : ""
                );
                setError("");
              }}
              className={ui.select}
            >
              <option value="">{tr("Choose worker", "কর্মী নির্বাচন করুন")}</option>
              {workers.map((row) => (
                <option key={row.worker_id} value={row.worker_id}>
                  {row.name}
                </option>
              ))}
            </select>
            {worker && outstandingAdvance > 0 ? (
              <span className="mt-1 block text-[11px] text-caution">
                {tr("Outstanding advance")}: {money(outstandingAdvance)}
              </span>
            ) : null}
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Pay month")}<span className="ml-1 text-warn">*</span></span>
            <input
              required
              type="month"
              value={payMonth}
              onChange={(event) => {
                setPayMonth(event.target.value);
                setError("");
              }}
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Base salary ৳")}</span>
            <input
              readOnly
              value={worker ? baseSalary.toFixed(2) : ""}
              placeholder={tr("Select a worker", "কর্মী নির্বাচন করুন")}
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Absent days")}</span>
            <input
              readOnly
              value={attendanceQuery.isLoading ? tr("Loading…", "লোড হচ্ছে…") : String(absentDays)}
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Absence deduction ৳")}</span>
            <input
              readOnly
              value={worker ? absenceDeduction.toFixed(2) : ""}
              placeholder={tr("Calculated from attendance", "উপস্থিতি থেকে হিসাব")}
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Advance deduction ৳")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={advanceDeduction}
              onChange={(event) => setAdvanceDeduction(event.target.value)}
              placeholder="0.00"
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Overtime pay ৳")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={overtimePay}
              onChange={(event) => setOvertimePay(event.target.value)}
              placeholder="0.00"
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Bonus ৳")}</span>
            <input
              type="number"
              min="0"
              step="0.01"
              value={bonus}
              onChange={(event) => setBonus(event.target.value)}
              placeholder="0.00"
              className={ui.input}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Net salary ৳")}</span>
            <input
              readOnly
              value={worker ? netAmount.toFixed(2) : ""}
              className={`${ui.input} font-semibold`}
            />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Paid date")}<span className="ml-1 text-warn">*</span></span>
            <DateInput required value={paidDate} onChange={setPaidDate} />
          </label>
          <label className="text-[12px] font-medium text-ink">
            <span className="mb-1 block">{tr("Status")}</span>
            <select value={status} onChange={(event) => setStatus(event.target.value)} className={ui.select}>
              <option value="paid">{tr("Paid", "পরিশোধিত")}</option>
              <option value="pending">{tr("Pending", "অপেক্ষমাণ")}</option>
              <option value="cancelled">{tr("Cancelled", "বাতিল")}</option>
            </select>
          </label>
        </div>
        <p className="text-[11px] text-muted">
          {tr(
            `Daily salary: monthly salary ÷ ${divisorDays || "days"} days (${dayBasis === "fixed_30" ? "fixed 30-day" : "actual calendar days"}). Net = base − absence − advance + overtime + bonus.`,
            `দৈনিক বেতন: মাসিক বেতন ÷ ${num(divisorDays || 0, 0)} দিন। নিট = মূল − অনুপস্থিতি − অগ্রিম + ওভারটাইম + বোনাস।`
          )}
        </p>
        {worker && (
          <p className="text-[11px] text-muted">
            {weeklyHolidayDays.length
              ? `${weeklyHolidayDays.map((day) => WEEKDAY_LABELS[day]).join(", ")} (${holidayDatesInMonth} day${holidayDatesInMonth === 1 ? "" : "s"} this month)`
              : tr("No weekly holidays set", "কোনো সাপ্তাহিক ছুটি নেই")}
            ; {tr("holidays are excluded from attendance and deductions.", "ছুটির দিন উপস্থিতি ও কর্তন থেকে বাদ।")}
          </p>
        )}
        {attendanceQuery.isError && (
          <p role="alert" className="text-xs text-warn">
            {tr("Attendance could not be loaded. Retry by changing the worker or month before saving.")}
          </p>
        )}
        <div className="flex justify-end">
          <button
            type="submit"
            disabled={saving || attendanceQuery.isLoading || attendanceQuery.isError || !workerId || !daysInMonth}
            className={btn("primary", "sm")}
          >
            {saving ? tr("Saving…") : tr("Save salary payment")}
          </button>
        </div>
      </form>
    </section>
  );
}

export function PayrollWorkspace() {
  const { tr } = useI18n();
  const queryClient = useQueryClient();
  const [tab, setTab] = useState("workers");
  const [salaryRefreshKey, setSalaryRefreshKey] = useState(0);
  const tabs = [
    { key: "workers", label: tr("Workers") },
    { key: "attendance", label: tr("Attendance") },
    { key: "advances", label: tr("Advances (Ogrim)") },
    { key: "salary", label: tr("Salary payments") },
    { key: "substitutes", label: tr("Substitutes") },
  ] as const;

  return (
    <div className="space-y-4">
      <Tabs items={tabs} active={tab} onChange={setTab} />

      {tab === "workers" && (
        <DataWorkbench
          title="Workers"
          singularLabel="Worker"
          description="Add staff and keep their employment details current."
          path={apiRoutes.labor.workers}
          rowHref={(row) => `/payroll/workers/${String(row.worker_id)}`}
          updatePath={(row) => apiRoutes.labor.worker(String(row.worker_id))}
          deletePath={(row) => apiRoutes.labor.worker(String(row.worker_id))}
          deleteLabel="Remove"
          invalidateKeys={[["payroll-workers-options"]]}
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
            { key: "outstanding_advance", label: "Outstanding advance" },
            { key: "weekly_holidays", label: "Weekly holidays" },
            { key: "status", label: "Status" },
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
              defaultValue: "active",
              options: [
                { value: "active", label: "Active" },
                { value: "inactive", label: "Inactive" },
              ],
            },
          ]}
        />
      )}

      {tab === "attendance" && <AttendanceWorkspace />}

      {tab === "advances" && (
        <DataWorkbench
          title="Advances (Ogrim)"
          singularLabel="Worker advance"
          description="Record mid-month cash advances (ogrim) and track balances deducted at month-end salary settlement."
          path={apiRoutes.labor.advances}
          updatePath={(row) => apiRoutes.labor.advance(String(row.advance_id))}
          invalidateKeys={[["payroll-workers-options"], ["data-workbench", apiRoutes.labor.workers]]}
          lifecycle={{
            includeQuery: "include_void=true",
            entityType: "worker_advances",
            idKey: "advance_id",
            isInactive: (row) => row.is_void === true,
            restoreBody: () => ({ is_void: false }),
            restoreLabel: () => "Unvoid",
          }}
          deleteLabel="Void"
          deleteConfirmMode="reason"
          onDelete={async (row, reason) => {
            await apiRequest(apiRoutes.labor.advance(String(row.advance_id)), {
              method: "PATCH",
              body: { is_void: true, void_reason: reason },
            });
          }}
          columns={[
            { key: "advance_date", label: "Date" },
            { key: "worker_name", label: "Worker" },
            { key: "amount", label: "Amount ৳" },
            { key: "notes", label: "Notes" },
            { key: "is_void", label: "Voided" },
            { key: "void_reason", label: "Void reason" },
          ]}
          fields={[
            {
              name: "worker_id",
              label: "Worker",
              type: "select",
              sourcePath: apiRoutes.labor.workers,
              sourceValue: "worker_id",
              sourceLabel: "name",
              required: true,
            },
            { name: "advance_date", label: "Date", type: "date", required: true, defaultValue: today() },
            { name: "amount", label: "Amount ৳", type: "number", min: "0.01", required: true },
            { name: "notes", label: "Notes", type: "textarea" },
          ]}
        />
      )}

      {tab === "salary" && (
        <div className="space-y-4">
          <SalaryPaymentEntry
            onSaved={() => {
              setSalaryRefreshKey((key) => key + 1);
              void queryClient.invalidateQueries({ queryKey: ["payroll-workers-options"] });
            }}
          />
          <DataWorkbench
            title="Salary payments"
            singularLabel="Salary payment"
            description="Salary settlements, including attendance deduction, advance deduction, overtime, and bonus."
            path={apiRoutes.labor.salaries}
            refreshKey={salaryRefreshKey}
            updatePath={(row) => apiRoutes.labor.salary(String(row.payment_id))}
            invalidateKeys={[["payroll-workers-options"], ["data-workbench", apiRoutes.labor.workers]]}
            lifecycle={{
              includeQuery: "include_void=true",
              entityType: "salary_payments",
              idKey: "payment_id",
              isInactive: (row) => row.is_void === true,
              restoreBody: () => ({ is_void: false }),
              restoreLabel: () => "Unvoid",
            }}
            deleteLabel="Void"
            deleteConfirmMode="reason"
            onDelete={async (row, reason) => {
              await apiRequest(apiRoutes.labor.salary(String(row.payment_id)), {
                method: "PATCH",
                body: { is_void: true, void_reason: reason },
              });
            }}
            columns={[
              { key: "worker_name", label: "Worker" },
              { key: "pay_month", label: "Pay month" },
              { key: "base_salary", label: "Base ৳" },
              { key: "absence_deduction", label: "Deduction ৳" },
              { key: "advance_deduction", label: "Advance deduction ৳" },
              { key: "overtime_pay", label: "Overtime pay ৳" },
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
              { name: "advance_deduction", label: "Advance deduction ৳", type: "number" },
              { name: "overtime_pay", label: "Overtime pay ৳", type: "number" },
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
        </div>
      )}

      {tab === "substitutes" && (
        <DataWorkbench
          title="Substitute and mill charges"
          singularLabel="Substitute or mill charge"
          description="Record one-day substitute costs and other mill charges."
          addLabel="Add charge"
          path={apiRoutes.labor.substitutes}
          updatePath={(row) => apiRoutes.labor.substitute(String(row.mill_charge_id))}
          lifecycle={{
            includeQuery: "include_archived=true&include_void=true",
            entityType: "mill_charges",
            idKey: "mill_charge_id",
            isInactive: (row) => row.is_archived === true || row.is_void === true,
            restoreBody: (row) => (row.is_archived === true ? { is_archived: false } : { is_void: false }),
            restoreLabel: (row) => (row.is_archived === true ? "Unarchive" : "Unvoid"),
          }}
          deleteLabel="Void"
          deleteConfirmMode="reason"
          onDelete={async (row, reason) => {
            await apiRequest(apiRoutes.labor.substitute(String(row.mill_charge_id)), {
              method: "PATCH",
              body: { is_void: true, void_reason: reason },
            });
          }}
          columns={[
            { key: "charge_date", label: "Date" },
            { key: "charge_type", label: "Type" },
            { key: "substitute_name", label: "Substitute" },
            { key: "amount", label: "Amount ৳" },
            { key: "description", label: "Description" },
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
                { value: "substitute_worker", label: "Substitute Worker" },
                { value: "worker_food", label: "Worker Food" },
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
  const { tr, date: fmtDate } = useI18n();
  const [selectedDate, setSelectedDate] = useState(initialDate ?? today());
  const date = initialDate ?? selectedDate;
  const [workers, setWorkers] = useState<Record<string, unknown>[]>([]);
  const [attendance, setAttendance] = useState<
    Record<string, { present: boolean; note: string; attendanceId?: string; isArchived?: boolean; isSaved?: boolean }>
  >({});
  const [showArchivedAttendance, setShowArchivedAttendance] = useState(false);
  const [loading, setLoading] = useState(false);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

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
          records: workers
            .filter((worker) => !workerHasHoliday(worker, date))
            .map((worker) => ({
              worker_id: worker.worker_id,
              is_present: attendance[String(worker.worker_id)]?.present ?? true,
              note: attendance[String(worker.worker_id)]?.note || null,
            })),
        },
      });
      setNotice(tr("Attendance saved.", "উপস্থিতি সংরক্ষিত হয়েছে।"));
      await load();
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
      setNotice(archived ? tr("Record archived.") : tr("Record restored."));
      await load();
    } catch (cause) {
      setError(messageFor(cause));
    }
  }

  const content = (
    <div className="space-y-3.5">
      {error && <Notice>{error}</Notice>}
      {notice && <Notice tone="success">{notice}</Notice>}

      <label className="flex items-center gap-2 text-xs text-muted cursor-pointer">
        <input
          type="checkbox"
          checked={showArchivedAttendance}
          onChange={(event) => setShowArchivedAttendance(event.target.checked)}
        />
        {tr("Show archived attendance", "আর্কাইভকৃত উপস্থিতি দেখুন")}
      </label>

      <div className="rounded-[6px] border border-line bg-surface overflow-hidden">
        {loading ? (
          <p className="p-8 text-center text-[13px] text-muted">{tr("Loading attendance…", "উপস্থিতি লোড হচ্ছে…")}</p>
        ) : workers.length === 0 ? (
          <p className="p-8 text-center text-[13px] text-muted">
            {tr("No active workers found. Add a worker first.", "কোনো সক্রিয় কর্মী নেই। আগে কর্মী যোগ করুন।")}
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

                  <div className="flex flex-1 flex-wrap items-center justify-end gap-2.5 max-sm:w-full">
                    {workerHasHoliday(worker, date) ? (
                      <span className="rounded-full bg-caution-soft px-3 py-1.5 text-[12px] font-medium text-caution">
                        {tr("Holiday · attendance excluded", "সাপ্তাহিক ছুটি · উপস্থিতি প্রযোজ্য নয়")}
                      </span>
                    ) : (
                      <>
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
                            { value: "present", label: tr("Present"), tone: "accent" },
                            { value: "absent", label: tr("Absent"), tone: "warn" },
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
                            placeholder={tr("Reason for absence", "অনুপস্থিতির কারণ")}
                            className={`${ui.input} !h-8 w-44 sm:w-56 text-[12px]`}
                          />
                        )}
                        {value.isSaved && value.attendanceId ? (
                          <button
                            type="button"
                            onClick={() => void setArchived(value, !value.isArchived)}
                            className="text-[11px] font-medium text-accent hover:underline cursor-pointer"
                          >
                            {value.isArchived ? tr("Restore") : tr("Archive")}
                          </button>
                        ) : null}
                      </>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}
        <div className="flex justify-end border-t border-line bg-subtle px-3.5 py-2.5">
          <button
            type="button"
            onClick={() => void save()}
            disabled={saving || workers.length === 0 || workers.every((worker) => workerHasHoliday(worker, date))}
            className={btn("primary", "sm")}
          >
            {saving
              ? tr("Saving…")
              : workers.length > 0 && workers.every((worker) => workerHasHoliday(worker, date))
                ? tr("All workers on holiday", "সব কর্মীর ছুটি")
                : tr("Save attendance")}
          </button>
        </div>
      </div>
    </div>
  );

  if (embedded) return content;

  return (
    <section className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{tr("Daily attendance")}</h2>
          <p className="mt-0.5 text-[12px] text-muted">
            {tr(`Mark active workers present or absent for ${fmtDate(date)}.`, `${fmtDate(date)} তারিখের উপস্থিতি চিহ্নিত করুন।`)}
          </p>
        </div>
        <div className="flex items-center gap-2">
          <DateInput value={date} onChange={(next) => { if (next) setSelectedDate(next); }} className="!h-8 w-36" />
          <button type="button" onClick={() => void load()} className={btn("secondary", "sm")}>
            {tr("Load day")}
          </button>
        </div>
      </div>
      {content}
    </section>
  );
}

function CategoryFilterSelect({
  value,
  onChange,
  placeholder,
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
}) {
  const { tr, enumLabel } = useI18n();
  const [categories, setCategories] = useState<string[]>([
    "dairy",
    "beef",
    "duel-purpose",
  ]);
  useEffect(() => {
    void apiRequest<Record<string, unknown>[]>(apiRoutes.herd.cows)
      .then((cows) => {
        const defaults = ["dairy", "beef", "duel-purpose"];
        const fromDb = cows
          .map((c) => String(c.category ?? "").trim())
          .filter(Boolean);
        setCategories(Array.from(new Set([...defaults, ...fromDb])));
      })
      .catch(() => {});
  }, []);
  return (
    <select value={value} onChange={(event) => onChange(event.target.value)} className={ui.select}>
      <option value="">{placeholder}</option>
      {categories.map((cat) => (
        <option key={cat} value={cat}>
          {cat === "dairy" || cat === "beef" || cat === "duel-purpose"
            ? enumLabel(cat)
            : tr(cat.charAt(0).toUpperCase() + cat.slice(1))}
        </option>
      ))}
    </select>
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

function messageFor(cause: unknown) {
  return cause instanceof Error ? cause.message : "Request failed. Please try again.";
}
