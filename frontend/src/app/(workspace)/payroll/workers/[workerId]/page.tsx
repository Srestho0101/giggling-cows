"use client";

import Link from "next/link";
import { useParams } from "next/navigation";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { apiRequest, apiRoutes } from "@/lib/api";

type Worker = {
  worker_id: string;
  name: string;
  phone?: string | null;
  role: string;
  join_date: string;
  monthly_salary: number | string;
  weekly_holidays: number[];
  status: string;
  is_archived: boolean;
};

type Attendance = {
  attendance_id: string;
  attendance_date: string;
  is_present: boolean;
  note?: string | null;
};

type SalaryPayment = {
  payment_id: string;
  pay_month: string;
  base_salary: number | string;
  absence_deduction: number | string;
  bonus: number | string;
  net_paid: number | string;
  paid_date: string;
  status: string;
  is_void: boolean;
  void_reason?: string | null;
};

function currentMonth() {
  const now = new Date();
  return `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
}

function money(value: number | string | undefined) {
  return `৳ ${Number(value ?? 0).toLocaleString("en-BD", { maximumFractionDigits: 2 })}`;
}

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];
const fieldClass = "mt-1 block w-full rounded-md border border-stone-200 bg-white px-3 py-2 text-sm text-stone-800";

export default function WorkerProfilePage() {
  const { workerId } = useParams<{ workerId: string }>();
  const router = useRouter();
  const [worker, setWorker] = useState<Worker | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [editValues, setEditValues] = useState({
    name: "", phone: "", role: "", join_date: "", monthly_salary: "", status: "active", weekly_holidays: [] as number[],
  });

  const load = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const monthDate = `${month}-01`;
      const [workerData, attendanceData, paymentData] = await Promise.all([
        apiRequest<Worker>(apiRoutes.labor.worker(workerId)),
        apiRequest<Attendance[]>(`${apiRoutes.labor.attendance}?month=${monthDate}&worker_id=${workerId}`),
        apiRequest<SalaryPayment[]>(`${apiRoutes.labor.salaries}?worker_id=${workerId}&include_void=true`),
      ]);
      setWorker(workerData);
      setAttendance(attendanceData);
      setPayments(paymentData);
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load this worker profile.");
    } finally {
      setLoading(false);
    }
  }, [month, workerId]);

  useEffect(() => {
    const timer = window.setTimeout(() => void load(), 0);
    return () => window.clearTimeout(timer);
  }, [load]);

  const monthDays = useMemo(() => {
    const [year, monthNumber] = month.split("-").map(Number);
    return Number.isFinite(year) && Number.isFinite(monthNumber)
      ? new Date(year, monthNumber, 0).getDate()
      : 0;
  }, [month]);
  const attendanceByDate = useMemo(
    () => new Map(attendance.map((row) => [row.attendance_date, row])),
    [attendance],
  );
  const holidays = new Set((worker?.weekly_holidays ?? []).map(Number));
  const dates = Array.from({ length: monthDays }, (_, index) => {
    const day = index + 1;
    const date = `${month}-${String(day).padStart(2, "0")}`;
    const weekday = (new Date(`${date}T00:00:00`).getDay() + 6) % 7;
    return { date, day, weekday, isHoliday: holidays.has(weekday) };
  });
  const holidayCount = dates.filter((day) => day.isHoliday).length;
  const countedAttendance = attendance.filter((row) => {
    const weekday = (new Date(`${row.attendance_date}T00:00:00`).getDay() + 6) % 7;
    return !holidays.has(weekday);
  });
  const presentCount = countedAttendance.filter((row) => row.is_present).length;
  const absentCount = countedAttendance.filter((row) => !row.is_present).length;
  const notRecordedCount = Math.max(0, monthDays - holidayCount - presentCount - absentCount);

  function startEdit() {
    if (!worker) return;
    setEditValues({
      name: worker.name,
      phone: worker.phone ?? "",
      role: worker.role,
      join_date: worker.join_date,
      monthly_salary: String(worker.monthly_salary),
      status: worker.status,
      weekly_holidays: [...(worker.weekly_holidays ?? [])],
    });
    setEditOpen(true);
    setError("");
    setNotice("");
  }

  async function saveWorker(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.labor.worker(workerId), {
        method: "PATCH",
        body: {
          ...editValues,
          monthly_salary: Number(editValues.monthly_salary),
          phone: editValues.phone || null,
          weekly_holidays: editValues.weekly_holidays,
        },
      });
      setEditOpen(false);
      setNotice("Worker details updated.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this worker.");
    } finally {
      setSaving(false);
    }
  }

  async function toggleArchive() {
    if (!worker) return;
    const archive = !worker.is_archived;
    if (!window.confirm(`${archive ? "Archive" : "Restore"} ${worker.name}?`)) return;
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.labor.worker(workerId), { method: "PATCH", body: { is_archived: archive } });
      setNotice(archive ? "Worker archived." : "Worker restored.");
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update worker archive status.");
    }
  }

  async function removeWorker() {
    if (!worker || !window.confirm(`Permanently remove ${worker.name}? This is only available when the worker has no attendance or salary history.`)) return;
    setError("");
    try {
      await apiRequest(apiRoutes.labor.worker(workerId), { method: "DELETE" });
      router.push("/payroll");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not remove this worker.");
    }
  }

  return (
    <ModulePage title="Worker profile" subtitle="Employment, monthly attendance, and salary history.">
      <div className="mb-4">
        <Link href="/payroll" className="text-sm font-medium text-emerald-800 hover:underline">← Back to payroll</Link>
      </div>
      {loading && <p className="text-sm text-stone-500">Loading worker profile…</p>}
      {error && <Notice>{error}</Notice>}
      {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
      {worker && <div className="space-y-5">
        <section className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div>
              <p className="text-xs font-medium uppercase tracking-wide text-stone-500">Worker</p>
              <h2 className="mt-1 text-xl font-semibold text-stone-900">{worker.name}</h2>
              <p className="mt-1 text-sm capitalize text-stone-500">{worker.role.replaceAll("_", " ")} · {worker.status}</p>
              {worker.is_archived && <p className="mt-2 inline-flex rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-600">Archived</p>}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <div className="rounded-lg bg-emerald-50 px-4 py-3">
                <p className="text-xs text-emerald-800">Current monthly salary</p>
                <p className="mt-1 text-lg font-semibold text-emerald-950">{money(worker.monthly_salary)}</p>
              </div>
              <button type="button" onClick={startEdit} className="rounded-md border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">Edit</button>
              <button type="button" onClick={() => void toggleArchive()} className="rounded-md border border-stone-200 px-3 py-2 text-sm font-medium text-stone-700 hover:bg-stone-50">{worker.is_archived ? "Restore" : "Archive"}</button>
              <button type="button" onClick={() => void removeWorker()} className="rounded-md border border-rose-200 px-3 py-2 text-sm font-medium text-rose-700 hover:bg-rose-50">Remove</button>
            </div>
          </div>
          <dl className="mt-5 grid gap-4 border-t border-stone-100 pt-4 sm:grid-cols-2 xl:grid-cols-4">
            <div><dt className="text-xs text-stone-500">Phone</dt><dd className="mt-1 text-sm font-medium text-stone-800">{worker.phone || "—"}</dd></div>
            <div><dt className="text-xs text-stone-500">Joined</dt><dd className="mt-1 text-sm font-medium text-stone-800">{worker.join_date}</dd></div>
            <div><dt className="text-xs text-stone-500">Status</dt><dd className="mt-1 text-sm font-medium capitalize text-stone-800">{worker.status}</dd></div>
            <div><dt className="text-xs text-stone-500">Weekly holidays</dt><dd className="mt-1 text-sm font-medium text-stone-800">{worker.weekly_holidays?.length ? worker.weekly_holidays.map((day) => WEEKDAYS[day]).join(", ") : "None"}</dd></div>
          </dl>
        </section>

        {editOpen && <form onSubmit={(event) => void saveWorker(event)} className="rounded-xl border border-stone-200 bg-white p-5 shadow-sm">
          <h3 className="text-sm font-semibold text-stone-900">Edit worker details</h3>
          <div className="mt-4 grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            <label className="text-xs font-medium text-stone-600">Name<input required maxLength={150} value={editValues.name} onChange={(event) => setEditValues((current) => ({ ...current, name: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-stone-600">Phone<input maxLength={50} value={editValues.phone} onChange={(event) => setEditValues((current) => ({ ...current, phone: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-stone-600">Role<input required maxLength={50} value={editValues.role} onChange={(event) => setEditValues((current) => ({ ...current, role: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-stone-600">Join date<input required type="date" value={editValues.join_date} onChange={(event) => setEditValues((current) => ({ ...current, join_date: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-stone-600">Monthly salary ৳<input required type="number" min="0" step="0.01" value={editValues.monthly_salary} onChange={(event) => setEditValues((current) => ({ ...current, monthly_salary: event.target.value }))} className={fieldClass} /></label>
            <label className="text-xs font-medium text-stone-600">Employment status<select value={editValues.status} onChange={(event) => setEditValues((current) => ({ ...current, status: event.target.value }))} className={fieldClass}><option value="active">Active</option><option value="inactive">Inactive</option></select></label>
            <fieldset className="sm:col-span-2 xl:col-span-3">
              <legend className="text-xs font-medium text-stone-600">Weekly holidays</legend>
              <div className="mt-2 grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">{WEEKDAYS.map((day, index) => <label key={day} className="flex items-center gap-2 rounded-md border border-stone-200 px-3 py-2 text-xs text-stone-700"><input type="checkbox" checked={editValues.weekly_holidays.includes(index)} onChange={(event) => setEditValues((current) => ({ ...current, weekly_holidays: event.target.checked ? [...new Set([...current.weekly_holidays, index])].sort((a, b) => a - b) : current.weekly_holidays.filter((value) => value !== index) }))} />{day}</label>)}</div>
            </fieldset>
          </div>
          <div className="mt-4 flex justify-end gap-2"><button type="button" onClick={() => setEditOpen(false)} className="rounded-md border border-stone-200 px-3 py-2 text-sm text-stone-700">Cancel</button><button disabled={saving} className="rounded-md bg-emerald-800 px-3 py-2 text-sm font-medium text-white disabled:opacity-50">{saving ? "Saving…" : "Save changes"}</button></div>
        </form>}

        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="flex flex-wrap items-center justify-between gap-3 border-b border-stone-100 p-4">
            <div><h3 className="text-sm font-semibold text-stone-900">Monthly attendance</h3><p className="mt-1 text-xs text-stone-500">Every day is listed. Unrecorded days are shown separately.</p></div>
            <label className="text-xs font-medium text-stone-600">Month<input aria-label="Attendance month" type="month" value={month} onChange={(event) => setMonth(event.target.value)} className="ml-2 rounded-md border border-stone-200 bg-white px-2.5 py-2 text-sm text-stone-800" /></label>
          </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
            <Summary label="Recorded present" value={presentCount} />
            <Summary label="Recorded absent" value={absentCount} />
            <Summary label="Holiday" value={holidayCount} />
            <Summary label="Not recorded" value={notRecordedCount} />
            <Summary label="Days in month" value={monthDays} />
          </div>
          <div className="overflow-x-auto">
            <table className="w-full min-w-[560px] text-left text-xs">
              <thead className="bg-stone-50 text-stone-500"><tr><th className="px-4 py-2.5">Date</th><th className="px-4 py-2.5">Day</th><th className="px-4 py-2.5">Attendance</th><th className="px-4 py-2.5">Note</th></tr></thead>
              <tbody className="divide-y divide-stone-100">{dates.map(({ date, isHoliday }) => {
                const record = attendanceByDate.get(date);
                const weekday = new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long" });
                return <tr key={date}>
                  <td className="whitespace-nowrap px-4 py-3 text-stone-800">{date}</td>
                  <td className="px-4 py-3 text-stone-600">{weekday}</td>
                  <td className="px-4 py-3"><span className={`rounded-full px-2.5 py-1 font-medium ${isHoliday ? "bg-amber-50 text-amber-800" : record ? record.is_present ? "bg-emerald-50 text-emerald-800" : "bg-rose-50 text-rose-700" : "bg-stone-100 text-stone-500"}`}>{isHoliday ? "Holiday" : record ? record.is_present ? "Present" : "Absent" : "Not recorded"}</span></td>
                  <td className="px-4 py-3 text-stone-600">{isHoliday ? "Excluded from attendance" : record?.note || "—"}</td>
                </tr>;
              })}</tbody>
            </table>
          </div>
        </section>

        <section className="overflow-hidden rounded-xl border border-stone-200 bg-white shadow-sm">
          <div className="border-b border-stone-100 p-4"><h3 className="text-sm font-semibold text-stone-900">Salary payment history</h3><p className="mt-1 text-xs text-stone-500">Base, deductions, bonuses, net paid, and settlement status.</p></div>
          {payments.length ? <div className="overflow-x-auto"><table className="w-full min-w-[760px] text-left text-xs">
            <thead className="bg-stone-50 text-stone-500"><tr><th className="px-4 py-2.5">Pay month</th><th className="px-4 py-2.5">Base</th><th className="px-4 py-2.5">Deduction</th><th className="px-4 py-2.5">Bonus</th><th className="px-4 py-2.5">Net</th><th className="px-4 py-2.5">Paid date</th><th className="px-4 py-2.5">Status</th></tr></thead>
            <tbody className="divide-y divide-stone-100">{payments.map((payment) => <tr key={payment.payment_id} className={payment.is_void ? "bg-stone-50 text-stone-400" : "text-stone-700"}>
              <td className="whitespace-nowrap px-4 py-3">{payment.pay_month.slice(0, 7)}</td><td className="px-4 py-3">{money(payment.base_salary)}</td><td className="px-4 py-3">{money(payment.absence_deduction)}</td><td className="px-4 py-3">{money(payment.bonus)}</td><td className="px-4 py-3 font-semibold">{money(payment.net_paid)}</td><td className="px-4 py-3">{payment.paid_date}</td><td className="px-4 py-3 capitalize">{payment.is_void ? `Voided${payment.void_reason ? `: ${payment.void_reason}` : ""}` : payment.status}</td>
            </tr>)}</tbody>
          </table></div> : <p className="p-5 text-sm text-stone-500">No salary payments recorded yet.</p>}
        </section>
      </div>}
    </ModulePage>
  );
}

function Summary({ label, value }: { label: string; value: number }) {
  return <div className="rounded-lg bg-stone-50 px-3 py-2.5"><p className="text-[11px] text-stone-500">{label}</p><p className="mt-1 text-base font-semibold text-stone-800">{value}</p></div>;
}
