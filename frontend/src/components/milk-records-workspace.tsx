"use client";

import React, { useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, btn, DateInput, Notice, ui } from "@/components/ui";
import { apiQuery, apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type MilkSession = "morning" | "noon" | "evening";
type CowItem = {
  cow_id: string;
  current_tag_number: string;
  sex?: string;
  category?: string;
  cow_type?: string | null;
  status: string;
  gives_milk: boolean;
  milking_sessions: MilkSession[];
};
type SessionBatch = {
  batch_id: string | null;
  production_date: string;
  session: MilkSession;
  total_liters: number;
  cow_ids: string[];
  cow_count: number;
};
type ScheduleDraft = { gives_milk: boolean; milking_sessions: MilkSession[] };

const SESSION_OPTIONS: { value: MilkSession; label: string }[] = [
  { value: "morning", label: "Morning" },
  { value: "noon", label: "Noon" },
  { value: "evening", label: "Evening" },
];

function todayInDhaka() {
  return new Intl.DateTimeFormat("en-CA", { timeZone: "Asia/Dhaka" }).format(new Date());
}

function previousDate(value: string, days: number) {
  const date = new Date(`${value}T12:00:00+06:00`);
  date.setDate(date.getDate() - days);
  return date.toISOString().slice(0, 10);
}

function errorMessage(cause: unknown) {
  return cause instanceof Error ? cause.message : "Request failed. Please try again.";
}

function scheduleFor(cow: CowItem): ScheduleDraft {
  return {
    gives_milk: Boolean(cow.gives_milk),
    milking_sessions: Array.isArray(cow.milking_sessions) ? cow.milking_sessions : [],
  };
}

function sameSessions(left: MilkSession[], right: MilkSession[]) {
  return SESSION_OPTIONS.every(({ value }) => left.includes(value) === right.includes(value));
}

function isLifecycleLactating(cow: CowItem): boolean {
  if (cow.sex === "male") return false;
  const t = (cow.cow_type ?? "").trim().toLowerCase();
  if (t) return t === "cow";
  return cow.category === "dairy";
}

export function MilkRecordsWorkspace() {
  const { tr, num, date: fmtDate, enumLabel } = useI18n();
  const queryClient = useQueryClient();

  const [date, setDate] = useState(todayInDhaka);
  const [session, setSession] = useState<MilkSession>("morning");
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [selectedCowOverride, setSelectedCowOverride] = useState<Record<string, string[]>>({});
  const [totalLitersOverride, setTotalLitersOverride] = useState<Record<string, string>>({});
  const [rosterOpen, setRosterOpen] = useState(false);
  const [showAllFemales, setShowAllFemales] = useState(false);
  const [saving, setSaving] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const cowsQuery = useQuery({
    queryKey: ["milk-workspace-cows"],
    queryFn: () => apiRequest<CowItem[]>(apiQuery(apiRoutes.herd.cows, { status: "active" })),
    staleTime: 60_000,
  });

  const cows = useMemo(
    () => (cowsQuery.data ?? []).filter((cow) => cow.status === "active" && cow.sex !== "male"),
    [cowsQuery.data]
  );

  const batchQueryKey = useMemo(
    () => ["milk-batches", date] as const,
    [date]
  );

  const batchesQuery = useQuery({
    queryKey: batchQueryKey,
    queryFn: () =>
      apiRequest<SessionBatch[]>(
        apiQuery(apiRoutes.sales.milkBatches, {
          start_date: previousDate(date, 6),
          end_date: date,
        })
      ),
    enabled: Boolean(date),
    staleTime: 30_000,
  });

  const batches = useMemo(() => batchesQuery.data ?? [], [batchesQuery.data]);
  const currentBatch = batches.find((item) => item.production_date === date && item.session === session);

  const sessionKey = `${date}:${session}`;
  const totalLiters =
    totalLitersOverride[sessionKey] !== undefined
      ? totalLitersOverride[sessionKey]
      : currentBatch
        ? Number(currentBatch.total_liters).toFixed(2)
        : "";

  const scheduledCows = useMemo(
    () =>
      cows
        .filter((cow) => {
          const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
          return draft.gives_milk && draft.milking_sessions.includes(session);
        })
        .sort((left, right) =>
          left.current_tag_number.localeCompare(right.current_tag_number, undefined, { numeric: true })
        ),
    [cows, scheduleDrafts, session]
  );

  const selectedCowIds = useMemo(() => {
    if (selectedCowOverride[sessionKey] !== undefined) {
      return selectedCowOverride[sessionKey];
    }
    if (currentBatch) return currentBatch.cow_ids;
    return cows
      .filter((cow) => cow.gives_milk && cow.milking_sessions?.includes(session))
      .map((cow) => cow.cow_id);
  }, [selectedCowOverride, sessionKey, currentBatch, cows, session]);

  const rosterCows = useMemo(
    () =>
      cows.filter((cow) => {
        const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
        return showAllFemales || isLifecycleLactating(cow) || draft.gives_milk;
      }),
    [cows, scheduleDrafts, showAllFemales]
  );

  const selectedCount = selectedCowIds.filter((id) =>
    scheduledCows.some((cow) => cow.cow_id === id)
  ).length;
  const trimmedLiters = totalLiters.trim();
  const parsedLiters = trimmedLiters === "" ? NaN : Number(trimmedLiters);
  const litersNumber = Number.isFinite(parsedLiters) ? parsedLiters : 0;
  const totalCents = Math.round(litersNumber * 100);
  const validPositive = Number.isFinite(parsedLiters) && parsedLiters > 0 && parsedLiters <= 999999.99;
  const averageLiters = selectedCount > 0 && validPositive ? (totalCents / 100 / selectedCount).toFixed(2) : "0.00";

  const inlineLitersError = useMemo(() => {
    if (trimmedLiters !== "" && (!Number.isFinite(parsedLiters) || parsedLiters < 0)) {
      return tr("Milk liters cannot be negative.", "দুধের পরিমাণ ঋণাত্মক হতে পারবে না।");
    }
    if (selectedCount > 0 && trimmedLiters !== "" && parsedLiters <= 0) {
      return tr("Enter a positive total greater than 0 L.", "০ লিটারের বেশি পরিমাণ লিখুন।");
    }
    if (trimmedLiters !== "" && parsedLiters > 999999.99) {
      return tr("Maximum allowed is 999,999.99 liters.");
    }
    return "";
  }, [trimmedLiters, parsedLiters, selectedCount, tr]);

  const scheduleIsDirty = cows.some((cow) => {
    const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
    const saved = scheduleFor(cow);
    return draft.gives_milk !== saved.gives_milk || !sameSessions(draft.milking_sessions, saved.milking_sessions);
  });

  function toggleCow(cowId: string) {
    setSelectedCowOverride((prev) => {
      const current = prev[sessionKey] ?? selectedCowIds;
      const next = current.includes(cowId)
        ? current.filter((id) => id !== cowId)
        : [...current, cowId];
      return { ...prev, [sessionKey]: next };
    });
  }

  function updateSchedule(cowId: string, update: (current: ScheduleDraft) => ScheduleDraft) {
    setScheduleDrafts((current) => {
      const base = current[cowId] ?? scheduleFor(cows.find((c) => c.cow_id === cowId) ?? {
        cow_id: cowId,
        current_tag_number: "",
        status: "active",
        gives_milk: false,
        milking_sessions: [],
      });
      return {
        ...current,
        [cowId]: update(base),
      };
    });
  }

  function syncRosterFromLifecycle() {
    const nextDrafts: Record<string, ScheduleDraft> = {};
    for (const cow of cows) {
      const shouldMilk = isLifecycleLactating(cow);
      const existing = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
      nextDrafts[cow.cow_id] = shouldMilk
        ? {
            gives_milk: true,
            milking_sessions:
              existing.milking_sessions.length > 0
                ? existing.milking_sessions
                : ["morning", "noon", "evening"],
          }
        : { gives_milk: false, milking_sessions: [] };
    }
    setScheduleDrafts(nextDrafts);
    setNotice(
      tr(
        "Synced roster from cow lifecycle types. Click Save roster to apply.",
        "গরুর ধরন অনুযায়ী দোহন তালিকা প্রস্তুত হয়েছে। সংরক্ষণ করতে Save roster চাপুন।"
      )
    );
  }

  async function saveRoster() {
    setError("");
    setNotice("");
    setSavingRoster(true);
    try {
      await apiRequest(apiRoutes.sales.milkCowSchedules, {
        method: "PUT",
        body: {
          records: cows.map((cow) => ({
            cow_id: cow.cow_id,
            ...(scheduleDrafts[cow.cow_id] ?? scheduleFor(cow)),
          })),
        },
      });
      setScheduleDrafts({});
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["milk-workspace-cows"] }),
        queryClient.invalidateQueries({ queryKey: ["herd-cows"] }),
      ]);
      setNotice(tr("Milking roster saved.", "দোহন তালিকা সংরক্ষিত হয়েছে।"));
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSavingRoster(false);
    }
  }

  async function saveMilkBatch(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");
    if (selectedCount > 0 && (!Number.isFinite(parsedLiters) || parsedLiters <= 0)) {
      setError(tr("Enter a positive total amount of milk.", "০-এর বেশি সঠিক পরিমাণ লিখুন।"));
      return;
    }
    if (selectedCount === 0 && Number.isFinite(parsedLiters) && parsedLiters > 0) {
      setError(tr("Select at least one cow or set total to 0.", "কমপক্ষে একটি গরু নির্বাচন করুন।"));
      return;
    }
    if (selectedCount > 0 && totalCents < selectedCount) {
      setError(tr("There must be at least 0.01 liters for every checked cow.", "প্রতিটি নির্বাচিত গরুর জন্য কমপক্ষে ০.০১ লিটার থাকতে হবে।"));
      return;
    }
    if (trimmedLiters && !/^\d{1,6}(\.\d{1,2})?$/.test(trimmedLiters)) {
      setError(tr("Enter liters using no more than two decimal places.", "সর্বোচ্চ দুই দশমিক পর্যন্ত লিখুন।"));
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest<SessionBatch>(apiRoutes.sales.milkBatches, {
        method: "POST",
        body: {
          production_date: date,
          session,
          total_liters: Number.isFinite(parsedLiters) ? Number(parsedLiters.toFixed(2)) : 0,
          cow_ids: scheduledCows.filter((cow) => selectedCowIds.includes(cow.cow_id)).map((cow) => cow.cow_id),
        },
      });
      setTotalLitersOverride((prev) => ({ ...prev, [sessionKey]: Number(result.total_liters).toFixed(2) }));
      setSelectedCowOverride((prev) => ({ ...prev, [sessionKey]: result.cow_ids }));
      await Promise.all([
        queryClient.invalidateQueries({ queryKey: ["milk-batches"] }),
        queryClient.invalidateQueries({ queryKey: ["milk-records"] }),
        queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      ]);
      setNotice(
        tr(
          `Saved ${result.total_liters} L across ${result.cow_count} cow${result.cow_count === 1 ? "" : "s"}.`,
          `${num(result.cow_count, 0)}টি গরুর জন্য ${num(result.total_liters)} লিটার সংরক্ষিত হয়েছে।`
        )
      );
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  const loadingCows = cowsQuery.isLoading;
  const loadingBatch = batchesQuery.isLoading;
  const submitDisabled =
    saving ||
    scheduleIsDirty ||
    Boolean(inlineLitersError) ||
    (selectedCount > 0 && !validPositive) ||
    (selectedCount === 0 && !trimmedLiters);

  return (
    <div className="space-y-4">
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">{tr("Record milk collection")}</h2>
            <p className="mt-1 text-[12px] text-muted">
              {tr("Enter the session total. It will be shared evenly across checked cows.", "সেশনের মোট দুধ লিখুন। নির্বাচিত গরুগুলোর মধ্যে সমানভাবে ভাগ হবে।")}
            </p>
          </div>
          {currentBatch && <Badge tone="good">{tr("Saved session", "সংরক্ষিত সেশন")}</Badge>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(160px,220px)_1fr]">
          <label className={ui.label}>
            {tr("Date")}
            <div className="mt-1.5">
              <DateInput value={date} onChange={(next) => { if (next) setDate(next); }} required />
            </div>
          </label>
          <div>
            <span className={ui.label}>{tr("Milking session")}</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SESSION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSession(option.value)}
                  className={`${btn(session === option.value ? "primary" : "secondary", "sm")} min-w-24`}
                  aria-pressed={session === option.value}
                >
                  {tr(option.label)}
                </button>
              ))}
            </div>
          </div>
        </div>

        {loadingCows || loadingBatch ? (
          <p className="py-10 text-center text-[13px] text-muted">{tr("Loading milking roster…", "দোহন তালিকা লোড হচ্ছে…")}</p>
        ) : scheduledCows.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-line-strong bg-subtle/40 px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-ink">
              {tr(
                `No cows are scheduled for ${SESSION_OPTIONS.find((option) => option.value === session)?.label.toLowerCase()} milking.`,
                `${enumLabel(session)} সেশনের জন্য কোনো গরু নির্ধারিত নেই।`
              )}
            </p>
            <p className="mt-1 text-[12px] text-muted">
              {tr("Add cows to this session in the milking roster below.", "নিচের দোহন তালিকা থেকে গরু যুক্ত করুন।")}
            </p>
            <button type="button" onClick={() => setRosterOpen(true)} className={`${btn("secondary", "sm")} mt-3`}>
              {tr("Configure roster", "তালিকা সাজান")}
            </button>
          </div>
        ) : (
          <form onSubmit={(e) => void saveMilkBatch(e)} noValidate className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <p className="text-[12px] text-muted">
                <span className="font-semibold text-ink">{num(selectedCount, 0)} / {num(scheduledCows.length, 0)}</span>{" "}
                {tr("scheduled cows selected", "টি নির্ধারিত গরু নির্বাচিত")}
              </p>
              <button
                type="button"
                className="text-[12px] font-medium text-accent hover:underline cursor-pointer"
                onClick={() =>
                  setSelectedCowOverride((prev) => ({
                    ...prev,
                    [sessionKey]: selectedCount === scheduledCows.length ? [] : scheduledCows.map((cow) => cow.cow_id),
                  }))
                }
              >
                {selectedCount === scheduledCows.length ? tr("Uncheck all", "সব বাতিল করুন") : tr("Check all", "সব নির্বাচন করুন")}
              </button>
            </div>

            <div className="divide-y divide-line">
              {scheduledCows.map((cow) => {
                const lifecycleOk = isLifecycleLactating(cow);
                return (
                  <label key={cow.cow_id} className="flex cursor-pointer items-center gap-3 py-2.5">
                    <input
                      type="checkbox"
                      checked={selectedCowIds.includes(cow.cow_id)}
                      onChange={() => toggleCow(cow.cow_id)}
                      className="size-4 accent-emerald-700"
                    />
                    <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                      <span className="flex flex-wrap items-center gap-2">
                        <span className="text-[13px] font-semibold text-ink">{cow.current_tag_number}</span>
                        {cow.cow_type ? <Badge tone={lifecycleOk ? "neutral" : "warn"}>{cow.cow_type}</Badge> : null}
                        {cow.category && <span className="text-[11px] text-muted">{enumLabel(cow.category)}</span>}
                      </span>
                      <span className="text-[12px] text-muted">
                        {selectedCowIds.includes(cow.cow_id) ? tr("Included", "অন্তর্ভুক্ত") : tr("Not milked", "দোহন হয়নি")}
                      </span>
                    </span>
                  </label>
                );
              })}
            </div>

            <div className="mt-4 grid gap-3 rounded-md bg-subtle/60 p-3 sm:grid-cols-[minmax(180px,260px)_1fr] sm:items-end">
              <label className={ui.label}>
                {tr("Total milk collected (L)", "মোট সংগৃহীত দুধ (লিটার)")}
                <input
                  type="number"
                  min="0.01"
                  max="999999.99"
                  step="0.01"
                  aria-invalid={Boolean(inlineLitersError)}
                  value={totalLiters}
                  onChange={(event) =>
                    setTotalLitersOverride((prev) => ({ ...prev, [sessionKey]: event.target.value }))
                  }
                  placeholder="0.00"
                  className={`${ui.input} ${inlineLitersError ? "border-warn" : ""}`}
                />
                {inlineLitersError ? (
                  <span role="alert" className="mt-1 block text-[11.5px] font-medium text-warn">
                    {inlineLitersError}
                  </span>
                ) : null}
              </label>
              <div className="flex items-center justify-between gap-4 pb-1 sm:justify-start sm:gap-8">
                <div>
                  <p className="text-[11px] text-muted">{tr("Per checked cow", "প্রতি গরুতে")}</p>
                  <p className="text-[14px] font-semibold text-ink tabular-nums">{num(averageLiters)} L</p>
                </div>
                <div>
                  <p className="text-[11px] text-muted">{tr("Session total", "সেশন মোট")}</p>
                  <p className="text-[14px] font-semibold text-ink tabular-nums">
                    {validPositive ? num(litersNumber) : num(0)} L
                  </p>
                </div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted">
                {tr("Each cow gets an equal share; spare hundredths are distributed one by one.", "প্রতিটি গরু সমান ভাগ পাবে।")}
              </p>
              <button type="submit" disabled={submitDisabled} className={btn("primary", "md")}>
                {saving ? tr("Saving…") : tr("Save session total")}
              </button>
            </div>
            {scheduleIsDirty && (
              <p className="mt-2 text-right text-[11px] text-caution">
                {tr("Save roster changes before recording this session.", "সেশন সংরক্ষণের আগে দোহন তালিকার পরিবর্তন সংরক্ষণ করুন।")}
              </p>
            )}
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">{tr("Milking roster")}</h2>
            <p className="mt-0.5 text-[11px] text-muted">
              {tr("Choose which cows give milk and the sessions they attend.", "কোন গরু কোন সেশনে দুধ দেয় তা নির্ধারণ করুন।")}
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {rosterOpen && (
              <button type="button" onClick={syncRosterFromLifecycle} className={btn("secondary", "sm")}>
                {tr("Sync lactating cows")}
              </button>
            )}
            <button type="button" onClick={() => setRosterOpen((open) => !open)} className={btn("secondary", "sm")} aria-expanded={rosterOpen}>
              {rosterOpen ? tr("Hide roster") : tr("Edit roster")}
            </button>
          </div>
        </div>
        {rosterOpen && (
          <div>
            <div className="flex items-center justify-between border-b border-line bg-subtle/40 px-4 py-2 text-[12px] text-muted">
              <label className="flex items-center gap-2 cursor-pointer">
                <input
                  type="checkbox"
                  checked={showAllFemales}
                  onChange={(e) => setShowAllFemales(e.target.checked)}
                />
                {tr("Show heifers and calves too (manual override)", "বকনা ও বাছুরসহ সব গাভী দেখান")}
              </label>
            </div>
            {loadingCows ? (
              <p className="p-5 text-center text-[12px] text-muted">{tr("Loading cows...")}</p>
            ) : rosterCows.length === 0 ? (
              <p className="p-5 text-center text-[12px] text-muted">
                {tr("No active female cows found. Add cows to the herd first.", "কোনো সক্রিয় গাভী পাওয়া যায়নি।")}
              </p>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(140px,1fr)_110px_repeat(3,minmax(95px,130px))] gap-2 border-b border-line bg-subtle px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid">
                  <span>{tr("Cow")}</span>
                  <span>{tr("Milking")}</span>
                  <span>{tr("Morning")}</span>
                  <span>{tr("Noon")}</span>
                  <span>{tr("Evening")}</span>
                </div>
                <div className="divide-y divide-line">
                  {rosterCows.map((cow) => {
                    const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
                    const lifecycleOk = isLifecycleLactating(cow);
                    return (
                      <div key={cow.cow_id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(140px,1fr)_110px_repeat(3,minmax(95px,130px))] sm:items-center">
                        <div>
                          <div className="flex items-center gap-1.5">
                            <p className="text-[13px] font-semibold text-ink">{cow.current_tag_number}</p>
                            {cow.cow_type ? (
                              <Badge tone={!lifecycleOk && draft.gives_milk ? "warn" : "neutral"}>
                                {cow.cow_type}
                              </Badge>
                            ) : null}
                          </div>
                          <p className="text-[10px] text-muted">{enumLabel(cow.category ?? "dairy")}</p>
                        </div>
                        <label className="flex items-center gap-2 text-[12px] text-ink cursor-pointer">
                          <input
                            type="checkbox"
                            checked={draft.gives_milk}
                            onChange={(event) =>
                              updateSchedule(cow.cow_id, () =>
                                event.target.checked
                                  ? { gives_milk: true, milking_sessions: ["morning", "noon", "evening"] }
                                  : { gives_milk: false, milking_sessions: [] }
                              )
                            }
                            className="size-4 accent-emerald-700"
                          />
                          <span className="sm:hidden">{tr("Milking")}</span>
                          <span className="hidden sm:inline">{draft.gives_milk ? tr("Yes") : tr("No")}</span>
                        </label>
                        {SESSION_OPTIONS.map((option) => (
                          <label key={option.value} className={`flex items-center gap-2 text-[12px] cursor-pointer ${draft.gives_milk ? "text-ink" : "text-muted"}`}>
                            <input
                              type="checkbox"
                              checked={draft.milking_sessions.includes(option.value)}
                              disabled={!draft.gives_milk}
                              onChange={(event) =>
                                updateSchedule(cow.cow_id, (current) => {
                                  const nextSessions = event.target.checked
                                    ? [...current.milking_sessions, option.value]
                                    : current.milking_sessions.filter((value) => value !== option.value);
                                  return { gives_milk: nextSessions.length > 0, milking_sessions: nextSessions };
                                })
                              }
                              className="size-4 accent-emerald-700"
                            />
                            <span>{tr(option.label)}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle/50 px-4 py-3">
                  <p className="text-[11px] text-muted">
                    {tr("Newly enabled cows start in all three sessions. Adjust each session as needed.", "নতুন সক্রিয় গরু তিনটি সেশনেই যুক্ত হবে।")}
                  </p>
                  <button type="button" disabled={!scheduleIsDirty || savingRoster} onClick={() => void saveRoster()} className={btn("primary", "sm")}>
                    {savingRoster ? tr("Saving…") : tr("Save roster")}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink">{tr("Recent milk sessions")}</h2>
          <p className="mt-0.5 text-[11px] text-muted">
            {tr("Session totals from the selected day and previous six days.", "নির্বাচিত দিন এবং আগের ৬ দিনের সেশন মোট।")}
          </p>
        </div>
        {loadingBatch ? (
          <p className="p-5 text-center text-[12px] text-muted">{tr("Loading recent sessions…", "সাম্প্রতিক সেশন লোড হচ্ছে…")}</p>
        ) : batches.length === 0 ? (
          <p className="p-5 text-center text-[12px] text-muted">
            {tr("No milk sessions recorded in this date range.", "এই সময়ে কোনো দুধ সেশন রেকর্ড করা হয়নি।")}
          </p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead className="bg-subtle text-[10px] uppercase tracking-wide text-muted">
                <tr>
                  <th className="px-4 py-2.5 font-semibold">{tr("Date")}</th>
                  <th className="px-4 py-2.5 font-semibold">{tr("Session")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{tr("Cows")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{tr("Total")}</th>
                  <th className="px-4 py-2.5 text-right font-semibold">{tr("Average", "গড়")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {batches.map((item) => (
                  <tr key={`${item.production_date}-${item.session}`}>
                    <td className="px-4 py-2.5 text-ink tabular-nums">{fmtDate(item.production_date)}</td>
                    <td className="px-4 py-2.5 text-ink">{enumLabel(item.session)}</td>
                    <td className="px-4 py-2.5 text-right text-ink tabular-nums">{num(item.cow_count, 0)}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink tabular-nums">{num(item.total_liters)} L</td>
                    <td className="px-4 py-2.5 text-right text-muted tabular-nums">
                      {item.cow_count ? num(Number(item.total_liters) / item.cow_count) : num(0)} L
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>
    </div>
  );
}
