"use client";

import Link from "next/link";
import { useParams, useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { ModulePage } from "@/components/module-page";
import { Notice } from "@/components/data-workbench";
import { Badge, btn, DateInput, statusTone, ui } from "@/components/ui";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

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
  outstanding_advance?: number | string;
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
  advance_deduction?: number | string;
  overtime_pay?: number | string;
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

const WEEKDAYS = ["Monday", "Tuesday", "Wednesday", "Thursday", "Friday", "Saturday", "Sunday"];

export default function WorkerProfilePage() {
  const { workerId } = useParams<{ workerId: string }>();
  const router = useRouter();
  const { tr, money, num, date: fmtDate, enumLabel } = useI18n();

  const [worker, setWorker] = useState<Worker | null>(null);
  const [month, setMonth] = useState(currentMonth);
  const [attendance, setAttendance] = useState<Attendance[]>([]);
  const [payments, setPayments] = useState<SalaryPayment[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [editOpen, setEditOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);
  const [editValues, setEditValues] = useState({
    name: "",
    phone: "",
    role: "",
    join_date: "",
    monthly_salary: "",
    status: "active",
    weekly_holidays: [] as number[],
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
    [attendance]
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
      setNotice(tr("Changes saved."));
      await load();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not update this worker.");
    } finally {
      setSaving(false);
    }
  }

  function requestToggleArchive() {
    if (!worker) return;
    const archive = !worker.is_archived;
    setConfirmModal({
      title: `${archive ? tr("Archive") : tr("Restore")} ${worker.name}?`,
      mode: "confirm",
      confirmLabel: archive ? tr("Archive") : tr("Restore"),
      tone: archive ? "danger" : "primary",
      onConfirm: async () => {
        await apiRequest(apiRoutes.labor.worker(workerId), {
          method: "PATCH",
          body: { is_archived: archive },
        });
        setNotice(archive ? tr("Record archived.") : tr("Record restored."));
        await load();
      },
    });
  }

  function requestRemoveWorker() {
    if (!worker) return;
    setConfirmModal({
      title: `${tr("Remove")} ${worker.name}?`,
      description: tr(
        "Permanent removal is only allowed when the worker has no attendance or salary history.",
        "উপস্থিতি বা বেতনের ইতিহাস না থাকলেই কেবল স্থায়ীভাবে অপসারণ করা যাবে।"
      ),
      mode: "confirm",
      confirmLabel: tr("Remove"),
      tone: "danger",
      onConfirm: async () => {
        await apiRequest(apiRoutes.labor.worker(workerId), { method: "DELETE" });
        router.push("/payroll");
      },
    });
  }

  return (
    <ModulePage
      title={tr("Worker profile", "কর্মীর প্রোফাইল")}
      subtitle={tr("Employment, monthly attendance, advances, and salary history.", "চাকরি, মাসিক উপস্থিতি, অগ্রিম এবং বেতনের ইতিহাস।")}
    >
      <div className="mb-4">
        <Link href="/payroll" className={ui.link}>
          ← {tr("Back to payroll", "বেতনে ফিরে যান")}
        </Link>
      </div>
      {loading && <p className="text-sm text-muted">{tr("Loading…", "লোড হচ্ছে…")}</p>}
      {error && <Notice>{error}</Notice>}
      {notice && <div className="mb-4"><Notice tone="success">{notice}</Notice></div>}
      {worker && (
        <div className="space-y-5">
          <section className="rounded-[8px] border border-line bg-surface p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs font-medium uppercase tracking-wide text-muted">{tr("Worker")}</p>
                <div className="mt-1 flex flex-wrap items-center gap-2">
                  <h2 className="text-xl font-semibold text-ink">{worker.name}</h2>
                  <Badge tone={statusTone(worker.status)}>{enumLabel(worker.status)}</Badge>
                  {worker.is_archived && <Badge tone="warn">{enumLabel("archived")}</Badge>}
                </div>
                <p className="mt-1 text-sm text-muted">{enumLabel(worker.role)}</p>
              </div>
              <div className="flex flex-wrap items-center gap-2">
                <div className="rounded-[6px] border border-accent/30 bg-accent-soft px-4 py-2.5">
                  <p className="text-xs text-accent">{tr("Monthly salary ৳")}</p>
                  <p className="mt-0.5 text-lg font-semibold text-ink tabular-nums">{money(worker.monthly_salary)}</p>
                </div>
                <div className="rounded-[6px] border border-line bg-subtle px-4 py-2.5">
                  <p className="text-xs text-muted">{tr("Outstanding advance")}</p>
                  <p className="mt-0.5 text-lg font-semibold text-ink tabular-nums">
                    {money(worker.outstanding_advance ?? 0)}
                  </p>
                </div>
                <button type="button" onClick={startEdit} className={btn("secondary", "md")}>
                  {tr("Edit")}
                </button>
                <button type="button" onClick={requestToggleArchive} className={btn("secondary", "md")}>
                  {worker.is_archived ? tr("Restore") : tr("Archive")}
                </button>
                <button type="button" onClick={requestRemoveWorker} className={btn("danger", "md")}>
                  {tr("Remove")}
                </button>
              </div>
            </div>
            <dl className="mt-5 grid gap-4 border-t border-line pt-4 sm:grid-cols-2 xl:grid-cols-4">
              <div>
                <dt className="text-xs text-muted">{tr("Phone")}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{worker.phone || "—"}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{tr("Joined")}</dt>
                <dd className="mt-1 text-sm font-medium text-ink tabular-nums">{fmtDate(worker.join_date)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{tr("Status")}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">{enumLabel(worker.status)}</dd>
              </div>
              <div>
                <dt className="text-xs text-muted">{tr("Weekly holidays")}</dt>
                <dd className="mt-1 text-sm font-medium text-ink">
                  {worker.weekly_holidays?.length
                    ? worker.weekly_holidays.map((day) => WEEKDAYS[day]).join(", ")
                    : tr("None")}
                </dd>
              </div>
            </dl>
          </section>

          {editOpen && (
            <form onSubmit={(event) => void saveWorker(event)} className="rounded-[8px] border border-line bg-surface p-5 space-y-4">
              <h3 className="text-sm font-semibold text-ink">{tr("Edit worker details", "কর্মীর তথ্য সম্পাদনা")}</h3>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                <label className="text-xs font-medium text-ink">
                  <span className="mb-1 block">{tr("Name")}</span>
                  <input required maxLength={150} value={editValues.name} onChange={(e) => setEditValues((c) => ({ ...c, name: e.target.value }))} className={ui.input} />
                </label>
                <label className="text-xs font-medium text-ink">
                  <span className="mb-1 block">{tr("Phone")}</span>
                  <input maxLength={50} value={editValues.phone} onChange={(e) => setEditValues((c) => ({ ...c, phone: e.target.value }))} className={ui.input} />
                </label>
                <label className="text-xs font-medium text-ink">
                  <span className="mb-1 block">{tr("Role")}</span>
                  <input required maxLength={50} value={editValues.role} onChange={(e) => setEditValues((c) => ({ ...c, role: e.target.value }))} className={ui.input} />
                </label>
                <label className="text-xs font-medium text-ink">
                  <span className="mb-1 block">{tr("Joined")}</span>
                  <DateInput required value={editValues.join_date} onChange={(next) => setEditValues((c) => ({ ...c, join_date: next }))} />
                </label>
                <label className="text-xs font-medium text-ink">
                  <span className="mb-1 block">{tr("Monthly salary ৳")}</span>
                  <input required type="number" min="0" step="0.01" value={editValues.monthly_salary} onChange={(e) => setEditValues((c) => ({ ...c, monthly_salary: e.target.value }))} className={ui.input} />
                </label>
                <label className="text-xs font-medium text-ink">
                  <span className="mb-1 block">{tr("Status")}</span>
                  <select value={editValues.status} onChange={(e) => setEditValues((c) => ({ ...c, status: e.target.value }))} className={ui.select}>
                    <option value="active">{tr("Active")}</option>
                    <option value="inactive">{tr("Inactive", "নিষ্ক্রিয়")}</option>
                  </select>
                </label>
                <fieldset className="sm:col-span-2 xl:col-span-3">
                  <legend className="text-xs font-medium text-ink mb-2">{tr("Weekly holidays")}</legend>
                  <div className="grid grid-cols-2 gap-2 sm:grid-cols-4 xl:grid-cols-7">
                    {WEEKDAYS.map((day, index) => (
                      <label key={day} className="flex items-center gap-2 rounded-[5px] border border-line bg-subtle px-3 py-2 text-xs text-ink cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editValues.weekly_holidays.includes(index)}
                          onChange={(e) =>
                            setEditValues((c) => ({
                              ...c,
                              weekly_holidays: e.target.checked
                                ? [...new Set([...c.weekly_holidays, index])].sort((a, b) => a - b)
                                : c.weekly_holidays.filter((v) => v !== index),
                            }))
                          }
                        />
                        {day}
                      </label>
                    ))}
                  </div>
                </fieldset>
              </div>
              <div className="flex justify-end gap-2">
                <button type="button" onClick={() => setEditOpen(false)} className={btn("secondary", "sm")}>{tr("Cancel")}</button>
                <button disabled={saving} className={btn("primary", "sm")}>{saving ? tr("Saving…") : tr("Save changes")}</button>
              </div>
            </form>
          )}

          <section className="overflow-hidden rounded-[8px] border border-line bg-surface">
            <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line p-4">
              <div>
                <h3 className="text-sm font-semibold text-ink">{tr("Monthly attendance", "মাসিক উপস্থিতি")}</h3>
                <p className="mt-1 text-xs text-muted">{tr("Every day is listed. Unrecorded days are shown separately.")}</p>
              </div>
              <label className="text-xs font-medium text-muted flex items-center gap-2">
                {tr("Pay month")}
                <input
                  aria-label="Attendance month"
                  type="month"
                  value={month}
                  onChange={(event) => setMonth(event.target.value)}
                  className={`${ui.input} w-auto`}
                />
              </label>
            </div>
            <div className="grid grid-cols-2 gap-3 p-4 sm:grid-cols-3 xl:grid-cols-5">
              <Summary label={tr("Present")} value={num(presentCount, 0)} />
              <Summary label={tr("Absent")} value={num(absentCount, 0)} />
              <Summary label={tr("Holiday", "ছুটি")} value={num(holidayCount, 0)} />
              <Summary label={tr("Not recorded", "রেকর্ড নেই")} value={num(notRecordedCount, 0)} />
              <Summary label={tr("Days in month", "মাসের দিন")} value={num(monthDays, 0)} />
            </div>
            <div className="overflow-x-auto">
              <table className="w-full min-w-[560px] text-left text-xs">
                <thead className="bg-subtle text-muted">
                  <tr>
                    <th className="px-4 py-2.5">{tr("Date")}</th>
                    <th className="px-4 py-2.5">{tr("Day", "বার")}</th>
                    <th className="px-4 py-2.5">{tr("Attendance")}</th>
                    <th className="px-4 py-2.5">{tr("Notes")}</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-line">
                  {dates.map(({ date, isHoliday }) => {
                    const record = attendanceByDate.get(date);
                    const weekday = new Date(`${date}T00:00:00`).toLocaleDateString("en", { weekday: "long" });
                    return (
                      <tr key={date}>
                        <td className="whitespace-nowrap px-4 py-3 text-ink tabular-nums">{fmtDate(date)}</td>
                        <td className="px-4 py-3 text-muted">{weekday}</td>
                        <td className="px-4 py-3">
                          <Badge tone={isHoliday ? "warn" : record ? (record.is_present ? "good" : "bad") : "neutral"}>
                            {isHoliday
                              ? tr("Holiday", "ছুটি")
                              : record
                                ? record.is_present
                                  ? tr("Present")
                                  : tr("Absent")
                                : tr("Not recorded", "রেকর্ড নেই")}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-muted">
                          {isHoliday ? tr("Excluded from attendance") : record?.note || "—"}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          </section>

          <section className="overflow-hidden rounded-[8px] border border-line bg-surface">
            <div className="border-b border-line p-4">
              <h3 className="text-sm font-semibold text-ink">{tr("Salary payment history", "বেতন পরিশোধের ইতিহাস")}</h3>
              <p className="mt-1 text-xs text-muted">
                {tr("Base, absence deduction, advance deduction, overtime, bonus, and net paid.")}
              </p>
            </div>
            {payments.length ? (
              <div className="overflow-x-auto">
                <table className="w-full min-w-[820px] text-left text-xs">
                  <thead className="bg-subtle text-muted">
                    <tr>
                      <th className="px-4 py-2.5">{tr("Pay month")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Base ৳")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Deduction ৳")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Advance deduction ৳")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Overtime pay ৳")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Bonus ৳")}</th>
                      <th className="px-4 py-2.5 text-right">{tr("Net ৳")}</th>
                      <th className="px-4 py-2.5">{tr("Paid date")}</th>
                      <th className="px-4 py-2.5">{tr("Status")}</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-line">
                    {payments.map((payment) => (
                      <tr key={payment.payment_id} className={payment.is_void ? "bg-subtle text-muted" : "text-ink"}>
                        <td className="whitespace-nowrap px-4 py-3 tabular-nums">{fmtDate(payment.pay_month.slice(0, 7))}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(payment.base_salary)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(payment.absence_deduction)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(payment.advance_deduction ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(payment.overtime_pay ?? 0)}</td>
                        <td className="px-4 py-3 text-right tabular-nums">{money(payment.bonus)}</td>
                        <td className="px-4 py-3 text-right font-semibold tabular-nums">{money(payment.net_paid)}</td>
                        <td className="px-4 py-3 tabular-nums">{fmtDate(payment.paid_date)}</td>
                        <td className="px-4 py-3">
                          {payment.is_void
                            ? `${tr("Voided")}${payment.void_reason ? `: ${payment.void_reason}` : ""}`
                            : enumLabel(payment.status)}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="p-5 text-sm text-muted">{tr("No salary payments recorded yet.")}</p>
            )}
          </section>
        </div>
      )}

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </ModulePage>
  );
}

function Summary({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-[6px] border border-line bg-subtle px-3 py-2.5">
      <p className="text-[11px] text-muted">{label}</p>
      <p className="mt-1 text-base font-semibold text-ink tabular-nums">{value}</p>
    </div>
  );
}
