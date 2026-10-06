"use client";

import React, { useEffect, useState } from "react";
import { Users, Check, X as XIcon, DollarSign, Coffee, Plus, Calendar } from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { MillCharge, SalaryPayment, Worker, WorkerAttendance } from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function LaborPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders, user } = useAuth();

  const [activeTab, setActiveTab] = useState<"attendance" | "workers" | "salaries" | "mill">("attendance");
  const [workers, setWorkers] = useState<Worker[]>([]);
  const [attendanceDate, setAttendanceDate] = useState(new Date().toISOString().split("T")[0]);
  const [attendanceList, setAttendanceList] = useState<WorkerAttendance[]>([]);
  const [salaries, setSalaries] = useState<SalaryPayment[]>([]);
  const [millCharges, setMillCharges] = useState<MillCharge[]>([]);
  const [loading, setLoading] = useState(true);

  // Modals
  const [isWorkerModalOpen, setIsWorkerModalOpen] = useState(false);
  const [isSalaryModalOpen, setIsSalaryModalOpen] = useState(false);
  const [isMillModalOpen, setIsMillModalOpen] = useState(false);

  // Forms
  const [workerForm, setWorkerForm] = useState({
    name: "",
    phone: "",
    role: "caretaker",
    join_date: new Date().toISOString().split("T")[0],
    monthly_salary: "15000",
  });

  const [salaryForm, setSalaryForm] = useState({
    worker_id: "",
    pay_month: new Date().toISOString().slice(0, 7) + "-01",
    base_salary: "15000",
    absence_deduction: "0",
    bonus: "0",
    paid_date: new Date().toISOString().split("T")[0],
  });

  const [millForm, setMillForm] = useState({
    charge_date: new Date().toISOString().split("T")[0],
    charge_type: "worker_food",
    amount: "500",
    substitute_name: "",
    description: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const auth = getAuthHeaders();
      const [wRes, attRes, salRes, millRes] = await Promise.all([
        api.getWorkers(auth),
        api.getDailyAttendance(attendanceDate, auth),
        api.getSalaryPayments(auth).catch(() => []),
        api.getMillCharges(auth),
      ]);
      setWorkers(wRes);
      setAttendanceList(attRes);
      setSalaries(salRes);
      setMillCharges(millRes);

      if (wRes.length > 0 && !salaryForm.worker_id) {
        setSalaryForm((prev) => ({
          ...prev,
          worker_id: wRes[0].worker_id,
          base_salary: wRes[0].monthly_salary,
        }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [attendanceDate]);

  const toggleAttendanceStatus = (workerId: string) => {
    setAttendanceList((prev) =>
      prev.map((item) =>
        item.worker_id === workerId ? { ...item, is_present: !item.is_present } : item
      )
    );
  };

  const handleSaveAttendance = async () => {
    try {
      await api.saveBatchAttendance(
        {
          attendance_date: attendanceDate,
          records: attendanceList.map((a) => ({
            worker_id: a.worker_id,
            is_present: a.is_present,
            note: a.note || undefined,
          })),
        },
        getAuthHeaders()
      );
      alert("Attendance saved successfully!");
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateWorker = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createWorker(
        {
          ...workerForm,
          monthly_salary: parseFloat(workerForm.monthly_salary),
        },
        getAuthHeaders()
      );
      setIsWorkerModalOpen(false);
      setWorkerForm({
        name: "",
        phone: "",
        role: "caretaker",
        join_date: new Date().toISOString().split("T")[0],
        monthly_salary: "15000",
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createSalaryPayment(
        {
          worker_id: salaryForm.worker_id,
          pay_month: salaryForm.pay_month,
          base_salary: parseFloat(salaryForm.base_salary),
          absence_deduction: parseFloat(salaryForm.absence_deduction || "0"),
          bonus: parseFloat(salaryForm.bonus || "0"),
          paid_date: salaryForm.paid_date,
          status: "paid",
        },
        getAuthHeaders()
      );
      setIsSalaryModalOpen(false);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateMill = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      await api.createMillCharge(
        {
          charge_date: millForm.charge_date,
          charge_type: millForm.charge_type,
          amount: parseFloat(millForm.amount),
          substitute_name: millForm.substitute_name || undefined,
          description: millForm.description || undefined,
        },
        getAuthHeaders()
      );
      setIsMillModalOpen(false);
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
            {t("labor.title")}
          </h1>
          <p className="text-sm text-zinc-500">{t("labor.subtitle")}</p>
        </div>

        <div className="flex items-center gap-2">
          {activeTab === "workers" && (
            <button
              onClick={() => setIsWorkerModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Plus className="w-4 h-4" />
              <span>{t("labor.add_worker")}</span>
            </button>
          )}

          {activeTab === "salaries" && user.permissions.can_record_payments && (
            <button
              onClick={() => setIsSalaryModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <DollarSign className="w-4 h-4" />
              <span>{t("labor.record_payment")}</span>
            </button>
          )}

          {activeTab === "mill" && (
            <button
              onClick={() => setIsMillModalOpen(true)}
              className="flex items-center gap-1.5 px-3 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 shadow-xs"
            >
              <Coffee className="w-4 h-4" />
              <span>{t("labor.record_mill_charge")}</span>
            </button>
          )}
        </div>
      </div>

      {/* Tabs */}
      <div className="flex items-center border-b border-zinc-200 dark:border-zinc-800 gap-6 text-sm font-semibold">
        <button
          onClick={() => setActiveTab("attendance")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "attendance"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Calendar className="w-4 h-4" />
          <span>{t("labor.attendance_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("workers")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "workers"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Users className="w-4 h-4" />
          <span>{t("labor.workers_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("salaries")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "salaries"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <DollarSign className="w-4 h-4" />
          <span>{t("labor.salaries_tab")}</span>
        </button>

        <button
          onClick={() => setActiveTab("mill")}
          className={`pb-3 flex items-center gap-2 border-b-2 transition ${
            activeTab === "mill"
              ? "border-emerald-600 text-emerald-600"
              : "border-transparent text-zinc-500 hover:text-zinc-800"
          }`}
        >
          <Coffee className="w-4 h-4" />
          <span>{t("labor.mill_charges_tab")}</span>
        </button>
      </div>

      {/* ATTENDANCE TAB */}
      {activeTab === "attendance" && (
        <div className="space-y-4">
          <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col sm:flex-row sm:items-center justify-between gap-3 shadow-xs">
            <div className="flex items-center gap-3">
              <span className="text-xs font-semibold text-zinc-500">Attendance Date:</span>
              <input
                type="date"
                value={attendanceDate}
                onChange={(e) => setAttendanceDate(e.target.value)}
                className="px-3 py-1.5 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-semibold"
              />
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={() =>
                  setAttendanceList((prev) => prev.map((a) => ({ ...a, is_present: true })))
                }
                className="px-3 py-1.5 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold hover:bg-zinc-50"
              >
                {t("labor.mark_all_present")}
              </button>
              <button
                onClick={handleSaveAttendance}
                className="px-4 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs hover:bg-emerald-500 shadow-xs"
              >
                {t("labor.save_attendance")}
              </button>
            </div>
          </div>

          <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
            <div className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {attendanceList.length === 0 ? (
                <div className="p-8 text-center text-sm text-zinc-400">
                  No active workers registered yet.
                </div>
              ) : (
                attendanceList.map((item) => (
                  <div
                    key={item.worker_id}
                    onClick={() => toggleAttendanceStatus(item.worker_id)}
                    className="p-4 flex items-center justify-between hover:bg-zinc-50 dark:hover:bg-zinc-800/40 cursor-pointer transition select-none"
                  >
                    <div className="flex items-center gap-3">
                      <div
                        className={`w-8 h-8 rounded-full flex items-center justify-center font-bold text-xs ${
                          item.is_present
                            ? "bg-emerald-100 text-emerald-700 dark:bg-emerald-950 dark:text-emerald-300"
                            : "bg-red-100 text-red-700 dark:bg-red-950 dark:text-red-300"
                        }`}
                      >
                        {item.is_present ? <Check className="w-4 h-4" /> : <XIcon className="w-4 h-4" />}
                      </div>
                      <div>
                        <div className="font-bold text-sm text-zinc-900 dark:text-zinc-100">
                          {item.worker_name}
                        </div>
                        <div className="text-xs text-zinc-400">
                          Click to toggle: {item.is_present ? "Present (উপস্থিত)" : "Absent (অনুপস্থিত)"}
                        </div>
                      </div>
                    </div>

                    <div>
                      <span
                        className={`px-3 py-1 rounded-full text-xs font-bold ${
                          item.is_present
                            ? "bg-emerald-50 text-emerald-700 border border-emerald-200"
                            : "bg-red-50 text-red-700 border border-red-200"
                        }`}
                      >
                        {item.is_present ? "Present" : "Absent"}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>
        </div>
      )}

      {/* WORKERS DIRECTORY TAB */}
      {activeTab === "workers" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Name</th>
                <th className="px-4 py-3">Phone</th>
                <th className="px-4 py-3">Role</th>
                <th className="px-4 py-3">Monthly Salary</th>
                <th className="px-4 py-3">Joined</th>
                <th className="px-4 py-3">Status</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {workers.map((w) => (
                <tr key={w.worker_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                  <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">{w.name}</td>
                  <td className="px-4 py-3 text-zinc-500">{w.phone || "-"}</td>
                  <td className="px-4 py-3 capitalize text-zinc-700 dark:text-zinc-300">{w.role}</td>
                  <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-zinc-100">
                    {formatBDT(w.monthly_salary, locale)}
                  </td>
                  <td className="px-4 py-3 text-zinc-500">{formatDate(w.join_date, locale)}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 rounded-full text-[11px] font-semibold bg-emerald-100 text-emerald-800">
                      {w.status}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {/* SALARIES TAB */}
      {activeTab === "salaries" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Paid Date</th>
                <th className="px-4 py-3">Worker</th>
                <th className="px-4 py-3">Pay Month</th>
                <th className="px-4 py-3">Base Salary</th>
                <th className="px-4 py-3">Deductions</th>
                <th className="px-4 py-3">Bonus</th>
                <th className="px-4 py-3 font-bold">Net Paid</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {salaries.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-6 text-center text-zinc-400">
                    No salary payments logged yet.
                  </td>
                </tr>
              ) : (
                salaries.map((s) => (
                  <tr key={s.payment_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(s.paid_date, locale)}</td>
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100">
                      {s.worker_name}
                    </td>
                    <td className="px-4 py-3">{s.pay_month}</td>
                    <td className="px-4 py-3">{formatBDT(s.base_salary, locale)}</td>
                    <td className="px-4 py-3 text-red-600">
                      - {formatBDT(s.absence_deduction, locale)}
                    </td>
                    <td className="px-4 py-3 text-emerald-600">
                      + {formatBDT(s.bonus, locale)}
                    </td>
                    <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-zinc-100">
                      {formatBDT(s.net_paid, locale)}
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* MILL CHARGES TAB */}
      {activeTab === "mill" && (
        <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 text-xs font-semibold text-zinc-500 uppercase">
              <tr>
                <th className="px-4 py-3">Date</th>
                <th className="px-4 py-3">Charge Type</th>
                <th className="px-4 py-3">Amount</th>
                <th className="px-4 py-3">Substitute Name</th>
                <th className="px-4 py-3">Description</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800 text-xs">
              {millCharges.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-6 text-center text-zinc-400">
                    No mill charges logged yet.
                  </td>
                </tr>
              ) : (
                millCharges.map((m) => (
                  <tr key={m.mill_charge_id} className="hover:bg-zinc-50 dark:hover:bg-zinc-800/40">
                    <td className="px-4 py-3 text-zinc-500">{formatDate(m.charge_date, locale)}</td>
                    <td className="px-4 py-3 capitalize font-semibold">{m.charge_type.replace("_", " ")}</td>
                    <td className="px-4 py-3 font-extrabold text-zinc-900 dark:text-zinc-100">
                      {formatBDT(m.amount, locale)}
                    </td>
                    <td className="px-4 py-3">{m.substitute_name || "-"}</td>
                    <td className="px-4 py-3 text-zinc-500">{m.description || "-"}</td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      )}

      {/* ADD WORKER MODAL */}
      {isWorkerModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">{t("labor.add_worker")}</h2>
            <form onSubmit={handleCreateWorker} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Name *</label>
                <input
                  type="text"
                  required
                  value={workerForm.name}
                  onChange={(e) => setWorkerForm({ ...workerForm, name: e.target.value })}
                  placeholder="e.g. Kashem Ali"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Phone</label>
                  <input
                    type="text"
                    value={workerForm.phone}
                    onChange={(e) => setWorkerForm({ ...workerForm, phone: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Role</label>
                  <select
                    value={workerForm.role}
                    onChange={(e) => setWorkerForm({ ...workerForm, role: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  >
                    <option value="caretaker">Caretaker</option>
                    <option value="milker">Milker</option>
                    <option value="feeder">Feeder</option>
                    <option value="manager">Manager</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block font-semibold mb-1">Monthly Salary (BDT) *</label>
                <input
                  type="number"
                  required
                  value={workerForm.monthly_salary}
                  onChange={(e) => setWorkerForm({ ...workerForm, monthly_salary: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsWorkerModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Worker
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* RECORD SALARY MODAL */}
      {isSalaryModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {t("labor.record_payment")}
            </h2>
            <form onSubmit={handleCreateSalary} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Worker *</label>
                <select
                  value={salaryForm.worker_id}
                  onChange={(e) => {
                    const wid = e.target.value;
                    const w = workers.find((x) => x.worker_id === wid);
                    setSalaryForm({
                      ...salaryForm,
                      worker_id: wid,
                      base_salary: w ? w.monthly_salary : salaryForm.base_salary,
                    });
                  }}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  {workers.map((w) => (
                    <option key={w.worker_id} value={w.worker_id}>
                      {w.name} ({w.role})
                    </option>
                  ))}
                </select>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Base Salary</label>
                  <input
                    type="number"
                    value={salaryForm.base_salary}
                    onChange={(e) => setSalaryForm({ ...salaryForm, base_salary: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Absence Deduction</label>
                  <input
                    type="number"
                    value={salaryForm.absence_deduction}
                    onChange={(e) => setSalaryForm({ ...salaryForm, absence_deduction: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-red-600"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block font-semibold mb-1">Bonus</label>
                  <input
                    type="number"
                    value={salaryForm.bonus}
                    onChange={(e) => setSalaryForm({ ...salaryForm, bonus: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-emerald-600"
                  />
                </div>
                <div>
                  <label className="block font-semibold mb-1">Payment Date</label>
                  <input
                    type="date"
                    value={salaryForm.paid_date}
                    onChange={(e) => setSalaryForm({ ...salaryForm, paid_date: e.target.value })}
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsSalaryModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Confirm Salary Payment
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MILL CHARGE MODAL */}
      {isMillModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-md rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              {t("labor.record_mill_charge")}
            </h2>
            <form onSubmit={handleCreateMill} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Charge Type</label>
                <select
                  value={millForm.charge_type}
                  onChange={(e) => setMillForm({ ...millForm, charge_type: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                >
                  <option value="worker_food">Worker Food (শ্রমিকদের খাবার)</option>
                  <option value="substitute_worker">Substitute Worker (বদলি শ্রমিক)</option>
                  <option value="other">Other Charge (অন্যান্য)</option>
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Amount (BDT) *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={millForm.amount}
                  onChange={(e) => setMillForm({ ...millForm, amount: e.target.value })}
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              {millForm.charge_type === "substitute_worker" && (
                <div>
                  <label className="block font-semibold mb-1">Substitute Worker Name</label>
                  <input
                    type="text"
                    value={millForm.substitute_name}
                    onChange={(e) => setMillForm({ ...millForm, substitute_name: e.target.value })}
                    placeholder="e.g. Daily hire Kashem"
                    className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                  />
                </div>
              )}
              <div>
                <label className="block font-semibold mb-1">Description / Memo</label>
                <input
                  type="text"
                  value={millForm.description}
                  onChange={(e) => setMillForm({ ...millForm, description: e.target.value })}
                  placeholder="Notes on charge"
                  className="w-full px-3 py-2 text-sm rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2 border-t">
                <button
                  type="button"
                  onClick={() => setIsMillModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white font-semibold text-xs"
                >
                  Save Charge
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
