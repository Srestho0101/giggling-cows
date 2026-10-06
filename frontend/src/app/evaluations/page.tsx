"use client";

import React, { useEffect, useState } from "react";
import {
  Scale,
  TrendingUp,
  TrendingDown,
  CheckCircle2,
  XCircle,
  Clock,
  ArrowRight,
  Plus,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import {
  EvaluationPreviewResult,
  MarketPrice,
  PurchaseEvaluation,
  Supplier,
  Warehouse,
} from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function EvaluationsPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders } = useAuth();

  const [evaluations, setEvaluations] = useState<PurchaseEvaluation[]>([]);
  const [marketPrices, setMarketPrices] = useState<MarketPrice[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [loading, setLoading] = useState(true);

  // Calculator Form State
  const [calcForm, setCalcForm] = useState({
    evaluation_date: new Date().toISOString().split("T")[0],
    supplier_id: "",
    live_weight_kg: "450",
    growth_potential: "good" as "good" | "poor",
    offered_price: "160000",
    market_price_per_kg: "650",
    notes: "",
  });

  const [preview, setPreview] = useState<EvaluationPreviewResult | null>(null);

  // Convert Modal State
  const [convertEval, setConvertEval] = useState<PurchaseEvaluation | null>(null);
  const [convertForm, setConvertForm] = useState({
    tag_number: "",
    sex: "male" as "male" | "female",
    category: "bull",
    warehouse_id: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const auth = getAuthHeaders();
      const [evalsRes, mpRes, suppRes, whRes] = await Promise.all([
        api.getEvaluations(auth),
        api.getMarketPrices(auth),
        api.getSuppliers(auth),
        api.getWarehouses(auth),
      ]);
      setEvaluations(evalsRes);
      setMarketPrices(mpRes);
      setSuppliers(suppRes);
      setWarehouses(whRes);

      if (mpRes.length > 0 && !calcForm.market_price_per_kg) {
        setCalcForm((prev) => ({ ...prev, market_price_per_kg: mpRes[0].price_per_kg_net }));
      }
      if (whRes.length > 0 && !convertForm.warehouse_id) {
        setConvertForm((prev) => ({ ...prev, warehouse_id: whRes[0].warehouse_id }));
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

  // Recalculate preview whenever calculator inputs change
  useEffect(() => {
    const liveWeight = parseFloat(calcForm.live_weight_kg);
    const offered = parseFloat(calcForm.offered_price);
    const market = parseFloat(calcForm.market_price_per_kg);

    if (liveWeight > 0 && offered > 0 && market > 0) {
      api
        .previewEvaluation(
          {
            live_weight_kg: liveWeight,
            growth_potential: calcForm.growth_potential,
            offered_price: offered,
            market_price_per_kg: market,
          },
          getAuthHeaders()
        )
        .then((res) => setPreview(res))
        .catch(() => {});
    }
  }, [
    calcForm.live_weight_kg,
    calcForm.growth_potential,
    calcForm.offered_price,
    calcForm.market_price_per_kg,
  ]);

  const handleSaveEvaluation = async (decision: "bought" | "returned" | "pending") => {
    try {
      const payload = {
        evaluation_date: calcForm.evaluation_date,
        supplier_id: calcForm.supplier_id || undefined,
        live_weight_kg: parseFloat(calcForm.live_weight_kg),
        growth_potential: calcForm.growth_potential,
        offered_price: parseFloat(calcForm.offered_price),
        market_price_per_kg: parseFloat(calcForm.market_price_per_kg),
        decision,
        notes: calcForm.notes || undefined,
      };

      const created = await api.createEvaluation(payload, getAuthHeaders());
      loadData();

      if (decision === "bought") {
        setConvertEval(created);
        setConvertForm({
          tag_number: `COW-${Math.floor(100 + Math.random() * 900)}`,
          sex: "male",
          category: "bull",
          warehouse_id: warehouses[0]?.warehouse_id || "",
        });
      }
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleConfirmConvert = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!convertEval) return;
    try {
      await api.convertEvaluationToCow(
        convertEval.evaluation_id,
        {
          tag_number: convertForm.tag_number.trim(),
          sex: convertForm.sex,
          category: convertForm.category,
          warehouse_id: convertForm.warehouse_id,
        },
        getAuthHeaders()
      );
      setConvertEval(null);
      loadData();
      alert("Successfully converted to registered cow!");
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      <div>
        <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
          {t("evaluations.title")}
        </h1>
        <p className="text-sm text-zinc-500">
          {t("evaluations.subtitle")}
        </p>
      </div>

      {/* CALCULATOR & PREVIEW GRID */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-6">
        {/* Left Form: Inputs */}
        <div className="lg:col-span-5 p-5 rounded-2xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div className="flex items-center gap-2 border-b border-zinc-100 dark:border-zinc-800 pb-3">
            <Scale className="w-5 h-5 text-emerald-600" />
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {t("evaluations.calculator_title")}
            </h2>
          </div>

          <div className="space-y-3 text-xs">
            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                {t("evaluations.live_weight")} *
              </label>
              <input
                type="number"
                step="0.1"
                value={calcForm.live_weight_kg}
                onChange={(e) => setCalcForm({ ...calcForm, live_weight_kg: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              />
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                {t("evaluations.growth_potential")} *
              </label>
              <select
                value={calcForm.growth_potential}
                onChange={(e) =>
                  setCalcForm({ ...calcForm, growth_potential: e.target.value as any })
                }
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              >
                <option value="good">{t("evaluations.growth_good")}</option>
                <option value="poor">{t("evaluations.growth_poor")}</option>
              </select>
            </div>

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("evaluations.offered_price")} *
                </label>
                <input
                  type="number"
                  value={calcForm.offered_price}
                  onChange={(e) => setCalcForm({ ...calcForm, offered_price: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>

              <div>
                <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                  {t("evaluations.market_price")} *
                </label>
                <input
                  type="number"
                  value={calcForm.market_price_per_kg}
                  onChange={(e) => setCalcForm({ ...calcForm, market_price_per_kg: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
            </div>

            <div>
              <label className="block font-semibold text-zinc-700 dark:text-zinc-300 mb-1">
                Supplier (বিক্রেতা / ব্যাপারি)
              </label>
              <select
                value={calcForm.supplier_id}
                onChange={(e) => setCalcForm({ ...calcForm, supplier_id: e.target.value })}
                className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
              >
                <option value="">Market Bazar Vendor (অজ্ঞাত / হাট)</option>
                {suppliers.map((s) => (
                  <option key={s.supplier_id} value={s.supplier_id}>
                    {s.name} ({s.supplier_type})
                  </option>
                ))}
              </select>
            </div>
          </div>
        </div>

        {/* Right Panel: Live Calculation & Decision Verdict */}
        <div className="lg:col-span-7 flex flex-col justify-between p-5 rounded-2xl bg-zinc-50 dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 shadow-xs space-y-4">
          <div>
            <div className="text-xs font-semibold uppercase text-zinc-400 tracking-wider mb-2">
              Decision Analysis
            </div>

            {preview ? (
              <div className="space-y-4">
                {/* Profitability Banner */}
                <div
                  className={`p-4 rounded-xl flex items-center gap-3 border ${
                    preview.is_profitable
                      ? "bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 text-emerald-800 dark:text-emerald-200"
                      : "bg-red-50 dark:bg-red-950/40 border-red-300 text-red-800 dark:text-red-200"
                  }`}
                >
                  {preview.is_profitable ? (
                    <TrendingUp className="w-8 h-8 text-emerald-600 shrink-0" />
                  ) : (
                    <TrendingDown className="w-8 h-8 text-red-600 shrink-0" />
                  )}
                  <div>
                    <div className="text-base font-extrabold">
                      {preview.is_profitable
                        ? t("evaluations.profitable")
                        : t("evaluations.unprofitable")}
                    </div>
                    <div className="text-xs">
                      {preview.is_profitable
                        ? `Projected margin: +${formatBDT(preview.total_projected_margin, locale)} (${preview.price_difference_per_kg} BDT/kg below market)`
                        : `Overpriced by ${Math.abs(parseFloat(preview.price_difference_per_kg))} BDT/kg over market snapshot`}
                    </div>
                  </div>
                </div>

                {/* Metrics Breakdown Cards */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] text-zinc-400 block">Est. Net Meat %</span>
                    <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      {preview.net_weight_percent}%
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] text-zinc-400 block">{t("evaluations.est_net_weight")}</span>
                    <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      {preview.est_net_weight_kg} kg
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] text-zinc-400 block">{t("evaluations.net_price_per_kg")}</span>
                    <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      ৳ {preview.net_price_per_kg}
                    </span>
                  </div>
                  <div className="p-3 bg-white dark:bg-zinc-800 rounded-xl border border-zinc-200 dark:border-zinc-700">
                    <span className="text-[11px] text-zinc-400 block">Market Ref / kg</span>
                    <span className="text-base font-black text-zinc-900 dark:text-zinc-100">
                      ৳ {preview.market_price_per_kg}
                    </span>
                  </div>
                </div>
              </div>
            ) : (
              <div className="py-8 text-center text-zinc-400 text-sm">
                Enter weight and price parameters to preview decision metrics.
              </div>
            )}
          </div>

          {/* Action Decision Buttons */}
          <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 flex flex-wrap items-center gap-2">
            <button
              onClick={() => handleSaveEvaluation("bought")}
              className="px-4 py-2 rounded-xl bg-emerald-600 hover:bg-emerald-500 text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5"
            >
              <CheckCircle2 className="w-4 h-4" />
              <span>Buy & Register Cow</span>
            </button>

            <button
              onClick={() => handleSaveEvaluation("returned")}
              className="px-4 py-2 rounded-xl bg-red-600 hover:bg-red-500 text-white font-semibold text-xs transition shadow-xs flex items-center gap-1.5"
            >
              <XCircle className="w-4 h-4" />
              <span>Reject / Return to Seller</span>
            </button>

            <button
              onClick={() => handleSaveEvaluation("pending")}
              className="px-4 py-2 rounded-xl border border-zinc-300 dark:border-zinc-700 text-zinc-700 dark:text-zinc-300 text-xs font-semibold hover:bg-zinc-100 transition flex items-center gap-1.5"
            >
              <Clock className="w-4 h-4" />
              <span>Save Pending Decision</span>
            </button>
          </div>
        </div>
      </div>

      {/* EVALUATION HISTORY TABLE */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="p-4 border-b border-zinc-200 dark:border-zinc-800 font-bold text-sm text-zinc-900 dark:text-zinc-100">
          Evaluation History & Buy Records
        </div>
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Supplier</th>
                <th className="px-4 py-3">Live Wt</th>
                <th className="px-4 py-3">Est. Net Wt</th>
                <th className="px-4 py-3">Offered Price</th>
                <th className="px-4 py-3">Net Price / kg</th>
                <th className="px-4 py-3">Verdict</th>
                <th className="px-4 py-3">Decision</th>
                <th className="px-4 py-3 text-right">Action</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {evaluations.length === 0 ? (
                <tr>
                  <td colSpan={9} className="px-4 py-6 text-center text-zinc-400">
                    No evaluations recorded yet.
                  </td>
                </tr>
              ) : (
                evaluations.map((ev) => (
                  <tr key={ev.evaluation_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(ev.evaluation_date, locale)}</td>
                    <td className="px-4 py-3 font-medium text-zinc-800 dark:text-zinc-200">
                      {ev.supplier_name || "Bazar Vendor"}
                    </td>
                    <td className="px-4 py-3">{ev.live_weight_kg} kg</td>
                    <td className="px-4 py-3 font-semibold">{ev.est_net_weight_kg} kg</td>
                    <td className="px-4 py-3 font-bold">{formatBDT(ev.offered_price, locale)}</td>
                    <td className="px-4 py-3">৳ {ev.net_price_per_kg}</td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold ${
                          ev.is_profitable
                            ? "bg-emerald-100 text-emerald-800"
                            : "bg-red-100 text-red-800"
                        }`}
                      >
                        {ev.is_profitable ? "Profitable" : "Unfavorable"}
                      </span>
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-[11px] font-semibold capitalize ${
                          ev.decision === "bought"
                            ? "bg-blue-100 text-blue-800"
                            : ev.decision === "returned"
                            ? "bg-zinc-200 text-zinc-800"
                            : "bg-amber-100 text-amber-800"
                        }`}
                      >
                        {ev.decision}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      {ev.decision === "bought" && !ev.cow_id && (
                        <button
                          onClick={() => {
                            setConvertEval(ev);
                            setConvertForm({
                              tag_number: `COW-${Math.floor(100 + Math.random() * 900)}`,
                              sex: "male",
                              category: "bull",
                              warehouse_id: warehouses[0]?.warehouse_id || "",
                            });
                          }}
                          className="px-2.5 py-1 rounded-md bg-emerald-600 text-white font-semibold text-[11px] hover:bg-emerald-500"
                        >
                          Register Cow
                        </button>
                      )}
                      {ev.cow_tag_number && (
                        <span className="font-semibold text-emerald-600">
                          Cow: {ev.cow_tag_number}
                        </span>
                      )}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* CONVERT EVALUATION TO COW MODAL */}
      {convertEval && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b pb-3">
              <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
                Register Bought Animal
              </h2>
              <button onClick={() => setConvertEval(null)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleConfirmConvert} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">New Tag Number *</label>
                <input
                  type="text"
                  required
                  value={convertForm.tag_number}
                  onChange={(e) => setConvertForm({ ...convertForm, tag_number: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Sex *</label>
                  <select
                    value={convertForm.sex}
                    onChange={(e) => setConvertForm({ ...convertForm, sex: e.target.value as any })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="male">Male (নর)</option>
                    <option value="female">Female (মাদি)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Category *</label>
                  <select
                    value={convertForm.category}
                    onChange={(e) => setConvertForm({ ...convertForm, category: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="bull">Bull (ষাঁড়)</option>
                    <option value="dairy">Dairy Cow (গাভী)</option>
                    <option value="heifer">Heifer (বকনা)</option>
                    <option value="calf">Calf (বাছুর)</option>
                  </select>
                </div>
              </div>

              <div>
                <label className="block font-semibold mb-1">Destination Warehouse *</label>
                <select
                  value={convertForm.warehouse_id}
                  onChange={(e) => setConvertForm({ ...convertForm, warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setConvertEval(null)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Complete Registration
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
