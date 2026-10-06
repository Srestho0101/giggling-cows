"use client";

import React, { useEffect, useState } from "react";
import { HeartPulse, Plus, X, Syringe, Sparkles, Baby, Calendar } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { BreedingRecord, Cow, HealthRecord, PregnancyReport } from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function HealthPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders } = useAuth();

  const [activeTab, setActiveTab] = useState<"health" | "breeding" | "pregnancy">("health");
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>([]);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>([]);
  const [pregnancyReports, setPregnancyReports] = useState<PregnancyReport[]>([]);
  const [cows, setCows] = useState<Cow[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isHealthModalOpen, setIsHealthModalOpen] = useState(false);
  const [isBreedingModalOpen, setIsBreedingModalOpen] = useState(false);
  const [isPregnancyModalOpen, setIsPregnancyModalOpen] = useState(false);

  // Forms
  const [healthForm, setHealthForm] = useState({
    cow_id: "",
    record_type: "vaccination",
    record_date: new Date().toISOString().split("T")[0],
    vet_name: "",
    details: "",
    cost: "0",
    next_due_date: "",
  });

  const [breedingForm, setBreedingForm] = useState({
    cow_id: "",
    seed_date: new Date().toISOString().split("T")[0],
    method: "artificial_insemination",
    sire_source: "semen" as "semen" | "bull",
    sire_id: "",
    semen_code: "HOLSTEIN-AI-01",
    semen_provider: "BRAC / Government AI",
    doctor_name: "",
    cost: "500",
    notes: "",
  });

  const [pregnancyForm, setPregnancyForm] = useState({
    cow_id: "",
    breeding_id: "",
    report_date: new Date().toISOString().split("T")[0],
    status: "confirmed",
    expected_calving_date: "",
    notes: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const auth = getAuthHeaders();
      const [hRes, bRes, pRes, cowsRes] = await Promise.all([
        api.getHealthRecords(auth),
        api.getBreedingRecords(auth),
        api.getPregnancyReports(auth),
        api.getCows({ status: "active" }, auth),
      ]);
      setHealthRecords(hRes);
      setBreedingRecords(bRes);
      setPregnancyReports(pRes);
      setCows(cowsRes);

      if (cowsRes.length > 0) {
        if (!healthForm.cow_id) setHealthForm((prev) => ({ ...prev, cow_id: cowsRes[0].cow_id }));
        if (!breedingForm.cow_id) setBreedingForm((prev) => ({ ...prev, cow_id: cowsRes[0].cow_id }));
        if (!pregnancyForm.cow_id) setPregnancyForm((prev) => ({ ...prev, cow_id: cowsRes[0].cow_id }));
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

  const handleCreateHealth = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createHealthRecord(
        {
          cow_id: healthForm.cow_id,
          record_type: healthForm.record_type,
          record_date: healthForm.record_date,
          vet_name: healthForm.vet_name || undefined,
          details: healthForm.details || undefined,
          cost: parseFloat(healthForm.cost || "0"),
          next_due_date: healthForm.next_due_date || undefined,
        },
        getAuthHeaders()
      );
      setIsHealthModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateBreeding = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        cow_id: breedingForm.cow_id,
        seed_date: breedingForm.seed_date,
        method: breedingForm.method,
        doctor_name: breedingForm.doctor_name || undefined,
        cost: parseFloat(breedingForm.cost || "0"),
        outcome: "pending",
        notes: breedingForm.notes || undefined,
      };

      if (breedingForm.sire_source === "bull") {
        if (!breedingForm.sire_id) throw new Error("Please select an on-farm sire bull.");
        payload.sire_id = breedingForm.sire_id;
      } else {
        if (!breedingForm.semen_code) throw new Error("Please enter semen code.");
        payload.semen_code = breedingForm.semen_code;
        payload.semen_provider = breedingForm.semen_provider || undefined;
      }

      await api.createBreedingRecord(payload, getAuthHeaders());
      setIsBreedingModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreatePregnancy = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createPregnancyReport(
        {
          cow_id: pregnancyForm.cow_id,
          breeding_id: pregnancyForm.breeding_id || undefined,
          report_date: pregnancyForm.report_date,
          status: pregnancyForm.status,
          expected_calving_date: pregnancyForm.expected_calving_date || undefined,
          notes: pregnancyForm.notes || undefined,
        },
        getAuthHeaders()
      );
      setIsPregnancyModalOpen(false);
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
            {t("health.title")}
          </h1>
          <p className="text-sm text-zinc-500">{t("health.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "health" && (
            <button
              onClick={() => setIsHealthModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("health.log_health")}</span>
            </button>
          )}

          {activeTab === "breeding" && (
            <button
              onClick={() => setIsBreedingModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("health.log_breeding")}</span>
            </button>
          )}

          {activeTab === "pregnancy" && (
            <button
              onClick={() => setIsPregnancyModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("health.log_pregnancy")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("health")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "health"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Syringe className="w-4 h-4" />
          <span>{t("health.records_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("breeding")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "breeding"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Sparkles className="w-4 h-4" />
          <span>{t("health.breeding_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("pregnancy")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "pregnancy"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Baby className="w-4 h-4" />
          <span>{t("health.pregnancy_tab")}</span>
        </button>
      </div>

      {/* HEALTH TAB */}
      {activeTab === "health" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Cow</th>
                <th className="px-4 py-3">Type</th>
                <th className="px-4 py-3">Details</th>
                <th className="px-4 py-3">Vet</th>
                <th className="px-4 py-3">Cost</th>
                <th className="px-4 py-3">Next Due</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {healthRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                    No health records found.
                  </td>
                </tr>
              ) : (
                healthRecords.map((h) => (
                  <tr key={h.health_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(h.record_date, locale)}</td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{h.cow_tag_number}</td>
                    <td className="px-4 py-3 capitalize font-semibold">{h.record_type}</td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">{h.details || "-"}</td>
                    <td className="px-4 py-3">{h.vet_name || "-"}</td>
                    <td className="px-4 py-3 font-extrabold">{formatBDT(h.cost, locale)}</td>
                    <td className="px-4 py-3 font-semibold text-amber-600">
                      {h.next_due_date ? formatDate(h.next_due_date, locale) : "-"}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* BREEDING TAB */}
      {activeTab === "breeding" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Insemination Date</th>
                <th className="px-4 py-3">Cow (Dam)</th>
                <th className="px-4 py-3">Method</th>
                <th className="px-4 py-3">Sire / Semen Source</th>
                <th className="px-4 py-3">Doctor</th>
                <th className="px-4 py-3">Outcome</th>
                <th className="px-4 py-3">Cost</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {breedingRecords.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                    No breeding attempts recorded yet.
                  </td>
                </tr>
              ) : (
                breedingRecords.map((b) => (
                  <tr key={b.breeding_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(b.seed_date, locale)}</td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{b.cow_tag_number}</td>
                    <td className="px-4 py-3 capitalize">{b.method.replace("_", " ")}</td>
                    <td className="px-4 py-3 font-semibold">
                      {b.sire_tag_number ? (
                        <span>Bull: {b.sire_tag_number}</span>
                      ) : (
                        <span>
                          Semen: {b.semen_code} ({b.semen_provider || "AI"})
                        </span>
                      )}
                    </td>
                    <td className="px-4 py-3">{b.doctor_name || "-"}</td>
                    <td className="px-4 py-3 capitalize">
                      <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-amber-50 text-amber-800 border border-amber-200">
                        {b.outcome}
                      </span>
                    </td>
                    <td className="px-4 py-3 font-extrabold">{formatBDT(b.cost, locale)}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* PREGNANCY TAB */}
      {activeTab === "pregnancy" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Report Date</th>
                <th className="px-4 py-3">Cow</th>
                <th className="px-4 py-3">Status</th>
                <th className="px-4 py-3 font-bold text-emerald-600">Expected Calving</th>
                <th className="px-4 py-3">Actual Calving</th>
                <th className="px-4 py-3">Notes</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {pregnancyReports.length === 0 ? (
                <tr>
                  <td colSpan={6} className="px-4 py-6 text-center text-zinc-400">
                    No pregnancy reports recorded yet.
                  </td>
                </tr>
              ) : (
                pregnancyReports.map((p) => (
                  <tr key={p.pregnancy_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(p.report_date, locale)}</td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{p.cow_tag_number}</td>
                    <td className="px-4 py-3 capitalize font-semibold">{p.status}</td>
                    <td className="px-4 py-3 font-extrabold text-emerald-600">
                      {p.expected_calving_date ? formatDate(p.expected_calving_date, locale) : "-"}
                    </td>
                    <td className="px-4 py-3">
                      {p.actual_calving_date ? formatDate(p.actual_calving_date, locale) : "Pending"}
                    </td>
                    <td className="px-4 py-3 text-zinc-400">{p.notes || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* HEALTH MODAL */}
      {isHealthModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold">{t("health.log_health")}</h2>
            <form onSubmit={handleCreateHealth} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Target Cow *</label>
                <select
                  value={healthForm.cow_id}
                  onChange={(e) => setHealthForm({ ...healthForm, cow_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {cows.map((c) => (
                    <option key={c.cow_id} value={c.cow_id}>
                      {c.current_tag_number} ({c.category})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Record Type</label>
                  <select
                    value={healthForm.record_type}
                    onChange={(e) => setHealthForm({ ...healthForm, record_type: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="vaccination">Vaccination (টিকা)</option>
                    <option value="deworming">Deworming (কৃমিনাশক)</option>
                    <option value="treatment">Treatment (চিকিৎসা)</option>
                    <option value="checkup">Routine Checkup (নিয়মিত পরীক্ষা)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Event Date</label>
                  <input
                    type="date"
                    required
                    value={healthForm.record_date}
                    onChange={(e) => setHealthForm({ ...healthForm, record_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Details / Medicine Given</label>
                <input
                  type="text"
                  value={healthForm.details}
                  onChange={(e) => setHealthForm({ ...healthForm, details: e.target.value })}
                  placeholder="e.g. Anthrax vaccination dose 1"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Doctor / Vet</label>
                  <input
                    type="text"
                    value={healthForm.vet_name}
                    onChange={(e) => setHealthForm({ ...healthForm, vet_name: e.target.value })}
                    placeholder="Dr. Rahman"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Cost (BDT)</label>
                  <input
                    type="number"
                    value={healthForm.cost}
                    onChange={(e) => setHealthForm({ ...healthForm, cost: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Next Due Date (For Alerts)</label>
                <input
                  type="date"
                  value={healthForm.next_due_date}
                  onChange={(e) => setHealthForm({ ...healthForm, next_due_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsHealthModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* BREEDING MODAL */}
      {isBreedingModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold">{t("health.log_breeding")}</h2>
            <form onSubmit={handleCreateBreeding} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Mother Cow (Dam) *</label>
                <select
                  value={breedingForm.cow_id}
                  onChange={(e) => setBreedingForm({ ...breedingForm, cow_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {cows
                    .filter((c) => c.sex === "female")
                    .map((c) => (
                      <option key={c.cow_id} value={c.cow_id}>
                        {c.current_tag_number} ({c.category})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Insemination Date *</label>
                  <input
                    type="date"
                    required
                    value={breedingForm.seed_date}
                    onChange={(e) => setBreedingForm({ ...breedingForm, seed_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Sire Source *</label>
                  <select
                    value={breedingForm.sire_source}
                    onChange={(e) =>
                      setBreedingForm({ ...breedingForm, sire_source: e.target.value as any })
                    }
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                  >
                    <option value="semen">Purchased Semen (AI)</option>
                    <option value="bull">On-farm Bull</option>
                  </select>
                </div>
              </div>

              {breedingForm.sire_source === "semen" ? (
                <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <div>
                    <label className="block font-semibold mb-1">Semen Code *</label>
                    <input
                      type="text"
                      required
                      value={breedingForm.semen_code}
                      onChange={(e) => setBreedingForm({ ...breedingForm, semen_code: e.target.value })}
                      placeholder="e.g. HF-9921"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>
                  <div>
                    <label className="block font-semibold mb-1">AI Provider</label>
                    <input
                      type="text"
                      value={breedingForm.semen_provider}
                      onChange={(e) => setBreedingForm({ ...breedingForm, semen_provider: e.target.value })}
                      placeholder="BRAC / Gov"
                      className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900"
                    />
                  </div>
                </div>
              ) : (
                <div>
                  <label className="block font-semibold mb-1">Select On-farm Sire Bull *</label>
                  <select
                    value={breedingForm.sire_id}
                    onChange={(e) => setBreedingForm({ ...breedingForm, sire_id: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="">Select Sire</option>
                    {cows
                      .filter((c) => c.sex === "male")
                      .map((c) => (
                        <option key={c.cow_id} value={c.cow_id}>
                          {c.current_tag_number} ({c.category})
                        </option>
                      ))}
                  </select>
                </div>
              )}

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Doctor / Inseminator</label>
                  <input
                    type="text"
                    value={breedingForm.doctor_name}
                    onChange={(e) => setBreedingForm({ ...breedingForm, doctor_name: e.target.value })}
                    placeholder="Doctor Name"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Cost (BDT)</label>
                  <input
                    type="number"
                    value={breedingForm.cost}
                    onChange={(e) => setBreedingForm({ ...breedingForm, cost: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsBreedingModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Record Breeding
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* PREGNANCY MODAL */}
      {isPregnancyModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold">{t("health.log_pregnancy")}</h2>
            <form onSubmit={handleCreatePregnancy} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Cow *</label>
                <select
                  value={pregnancyForm.cow_id}
                  onChange={(e) => setPregnancyForm({ ...pregnancyForm, cow_id: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {cows
                    .filter((c) => c.sex === "female")
                    .map((c) => (
                      <option key={c.cow_id} value={c.cow_id}>
                        {c.current_tag_number} ({c.category})
                      </option>
                    ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Status</label>
                  <select
                    value={pregnancyForm.status}
                    onChange={(e) => setPregnancyForm({ ...pregnancyForm, status: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold"
                  >
                    <option value="confirmed">Confirmed (নিশ্চিত)</option>
                    <option value="suspected">Suspected (সম্ভাব্য)</option>
                    <option value="calved">Calved (বাছুর প্রসব করেছে)</option>
                    <option value="failed">Failed / Empty (খালি)</option>
                  </select>
                </div>
                <div>
                  <label className="block font-semibold mb-1">Check Date</label>
                  <input
                    type="date"
                    required
                    value={pregnancyForm.report_date}
                    onChange={(e) => setPregnancyForm({ ...pregnancyForm, report_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Expected Calving Date (For Alerts)</label>
                <input
                  type="date"
                  value={pregnancyForm.expected_calving_date}
                  onChange={(e) => setPregnancyForm({ ...pregnancyForm, expected_calving_date: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-bold text-emerald-600"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsPregnancyModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Pregnancy Record
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
