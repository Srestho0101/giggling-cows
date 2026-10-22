"use client";

import React, { useEffect, useMemo, useRef, useState } from "react";
import { Badge, btn, ui } from "@/components/ui";
import { apiQuery, apiRequest, apiRoutes } from "@/lib/api";

type MilkSession = "morning" | "noon" | "evening";
type CowItem = {
  cow_id: string;
  current_tag_number: string;
  category?: string;
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

export function MilkRecordsWorkspace() {
  const [date, setDate] = useState(todayInDhaka);
  const [session, setSession] = useState<MilkSession>("morning");
  const [cows, setCows] = useState<CowItem[]>([]);
  const cowsRef = useRef<CowItem[]>([]);
  const [scheduleDrafts, setScheduleDrafts] = useState<Record<string, ScheduleDraft>>({});
  const [batches, setBatches] = useState<SessionBatch[]>([]);
  const [selectedCowIds, setSelectedCowIds] = useState<string[]>([]);
  const [totalLiters, setTotalLiters] = useState("");
  const [rosterOpen, setRosterOpen] = useState(false);
  const [loadingCows, setLoadingCows] = useState(true);
  const [loadingBatch, setLoadingBatch] = useState(true);
  const [saving, setSaving] = useState(false);
  const [savingRoster, setSavingRoster] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  useEffect(() => {
    let cancelled = false;
    setLoadingCows(true);
    apiRequest<CowItem[]>(apiQuery(apiRoutes.herd.cows, { status: "active" }))
      .then((items) => {
        if (cancelled) return;
        const activeCows = items.filter((cow) => cow.status === "active");
        cowsRef.current = activeCows;
        setCows(activeCows);
        setScheduleDrafts(Object.fromEntries(activeCows.map((cow) => [cow.cow_id, scheduleFor(cow)])));
        if (!activeCows.some((cow) => cow.gives_milk && cow.milking_sessions?.length)) setRosterOpen(true);
      })
      .catch((cause) => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) setLoadingCows(false); });
    return () => { cancelled = true; };
  }, []);

  useEffect(() => {
    cowsRef.current = cows;
  }, [cows]);

  useEffect(() => {
    if (loadingCows || !date) return;
    let cancelled = false;
    setLoadingBatch(true);
    setError("");
    const query = apiQuery(apiRoutes.sales.milkBatches, {
      start_date: previousDate(date, 6),
      end_date: date,
    });
    apiRequest<SessionBatch[]>(query)
      .then((items) => {
        if (cancelled) return;
        setBatches(items);
        const existing = items.find((item) => item.production_date === date && item.session === session);
        setTotalLiters(existing ? Number(existing.total_liters).toFixed(2) : "");
        setSelectedCowIds(existing
          ? existing.cow_ids
          : cowsRef.current
              .filter((cow) => {
                return cow.gives_milk && cow.milking_sessions?.includes(session);
              })
              .map((cow) => cow.cow_id));
      })
      .catch((cause) => { if (!cancelled) setError(errorMessage(cause)); })
      .finally(() => { if (!cancelled) setLoadingBatch(false); });
    return () => { cancelled = true; };
  }, [date, session, loadingCows]);

  const scheduledCows = useMemo(
    () => cows
      .filter((cow) => {
        const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
        return draft.gives_milk && draft.milking_sessions.includes(session);
      })
      .sort((left, right) => left.current_tag_number.localeCompare(right.current_tag_number, undefined, { numeric: true })),
    [cows, scheduleDrafts, session],
  );

  const selectedCount = selectedCowIds.filter((id) => scheduledCows.some((cow) => cow.cow_id === id)).length;
  const litersNumber = Number(totalLiters);
  const totalCents = Number.isFinite(litersNumber) ? Math.round(litersNumber * 100) : 0;
  const averageLiters = selectedCount > 0 ? (totalCents / 100 / selectedCount).toFixed(2) : "0.00";
  const currentBatch = batches.find((item) => item.production_date === date && item.session === session);
  const scheduleIsDirty = cows.some((cow) => {
    const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
    const saved = scheduleFor(cow);
    return draft.gives_milk !== saved.gives_milk || !sameSessions(draft.milking_sessions, saved.milking_sessions);
  });

  function toggleCow(cowId: string) {
    setSelectedCowIds((current) => current.includes(cowId)
      ? current.filter((id) => id !== cowId)
      : [...current, cowId]);
  }

  function updateSchedule(cowId: string, update: (current: ScheduleDraft) => ScheduleDraft) {
    setScheduleDrafts((current) => ({
      ...current,
      [cowId]: update(current[cowId] ?? { gives_milk: false, milking_sessions: [] }),
    }));
  }

  async function saveRoster() {
    setError("");
    setNotice("");
    setSavingRoster(true);
    const previouslyScheduled = new Set(cows
      .filter((cow) => cow.gives_milk && cow.milking_sessions?.includes(session))
      .map((cow) => cow.cow_id));
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
      const nextCows = cows.map((cow) => ({ ...cow, ...(scheduleDrafts[cow.cow_id] ?? scheduleFor(cow)) }));
      setCows(nextCows);
      const nextRoster = nextCows.filter((cow) => {
        const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
        return draft.gives_milk && draft.milking_sessions.includes(session);
      });
      setSelectedCowIds((current) => {
        if (!currentBatch) return nextRoster.map((cow) => cow.cow_id);
        const nextIds = new Set(nextRoster.map((cow) => cow.cow_id));
        const newlyScheduled = nextRoster.filter((cow) => !previouslyScheduled.has(cow.cow_id)).map((cow) => cow.cow_id);
        return [...current.filter((id) => nextIds.has(id)), ...newlyScheduled.filter((id) => !current.includes(id))];
      });
      setNotice("Milking roster saved.");
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
    if (selectedCount > 0 && (!Number.isFinite(litersNumber) || litersNumber <= 0)) {
      setError("Enter a positive total amount of milk.");
      return;
    }
    if (selectedCount === 0 && Number.isFinite(litersNumber) && litersNumber > 0) {
      setError("Set the total to 0 when no cows are selected.");
      return;
    }
    if (selectedCount > 0 && totalCents < selectedCount) {
      setError("There must be at least 0.01 liters for every checked cow.");
      return;
    }
    if (totalLiters.trim() && (!Number.isFinite(litersNumber) || litersNumber < 0 || litersNumber > 999999.99)) {
      setError("Enter a valid total in liters with up to two decimal places.");
      return;
    }
    if (totalLiters.trim() && !/^\d{1,6}(\.\d{1,2})?$/.test(totalLiters.trim())) {
      setError("Enter liters using no more than two decimal places.");
      return;
    }

    setSaving(true);
    try {
      const result = await apiRequest<SessionBatch>(apiRoutes.sales.milkBatches, {
        method: "POST",
        body: {
          production_date: date,
          session,
          total_liters: Number.isFinite(litersNumber) ? Number(litersNumber.toFixed(2)) : 0,
          cow_ids: scheduledCows.filter((cow) => selectedCowIds.includes(cow.cow_id)).map((cow) => cow.cow_id),
        },
      });
      setTotalLiters(Number(result.total_liters).toFixed(2));
      setSelectedCowIds(result.cow_ids);
      setBatches((current) => [result, ...current.filter((item) => !(item.production_date === result.production_date && item.session === result.session))]);
      setNotice(`Saved ${result.total_liters} L across ${result.cow_count} cow${result.cow_count === 1 ? "" : "s"}.`);
    } catch (cause) {
      setError(errorMessage(cause));
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="space-y-4">
      {error && <div role="alert" className="rounded-md border border-red-200 bg-red-50 px-3 py-2.5 text-[13px] text-red-800">{error}</div>}
      {notice && <div role="status" className="rounded-md border border-emerald-200 bg-emerald-50 px-3 py-2.5 text-[13px] text-emerald-800">{notice}</div>}

      <section className="rounded-lg border border-line bg-surface p-4 sm:p-5">
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div>
            <h2 className="text-[15px] font-semibold text-ink">Record milk collection</h2>
            <p className="mt-1 text-[12px] text-muted">Enter the session total. It will be shared evenly across checked cows.</p>
          </div>
          {currentBatch && <Badge tone="good">Saved session</Badge>}
        </div>

        <div className="mt-4 grid gap-3 sm:grid-cols-[minmax(160px,220px)_1fr]">
          <label className={ui.label}>
            Date
            <input type="date" required value={date} onChange={(event) => { if (event.target.value) setDate(event.target.value); }} className={ui.input} />
          </label>
          <div>
            <span className={ui.label}>Milking session</span>
            <div className="mt-1.5 flex flex-wrap gap-2">
              {SESSION_OPTIONS.map((option) => (
                <button
                  key={option.value}
                  type="button"
                  onClick={() => setSession(option.value)}
                  className={`${btn(session === option.value ? "primary" : "secondary", "sm")} min-w-24`}
                  aria-pressed={session === option.value}
                >{option.label}</button>
              ))}
            </div>
          </div>
        </div>

        {loadingCows || loadingBatch ? (
          <p className="py-10 text-center text-[13px] text-muted">Loading milking roster…</p>
        ) : scheduledCows.length === 0 ? (
          <div className="mt-4 rounded-md border border-dashed border-line-strong bg-subtle/40 px-4 py-8 text-center">
            <p className="text-[13px] font-medium text-ink">No cows are scheduled for {SESSION_OPTIONS.find((option) => option.value === session)?.label.toLowerCase()} milking.</p>
            <p className="mt-1 text-[12px] text-muted">Add cows to this session in the milking roster below.</p>
            <button type="button" onClick={() => setRosterOpen(true)} className={`${btn("secondary", "sm")} mt-3`}>Configure roster</button>
          </div>
        ) : (
          <form onSubmit={saveMilkBatch} className="mt-4">
            <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-2.5">
              <p className="text-[12px] text-muted">
                <span className="font-semibold text-ink">{selectedCount} of {scheduledCows.length}</span> scheduled cows selected
              </p>
              <button
                type="button"
                className="text-[12px] font-medium text-accent hover:underline"
                onClick={() => setSelectedCowIds(selectedCount === scheduledCows.length ? [] : scheduledCows.map((cow) => cow.cow_id))}
              >{selectedCount === scheduledCows.length ? "Uncheck all" : "Check all"}</button>
            </div>

            <div className="divide-y divide-line">
              {scheduledCows.map((cow) => (
                <label key={cow.cow_id} className="flex cursor-pointer items-center gap-3 py-2.5">
                  <input
                    type="checkbox"
                    checked={selectedCowIds.includes(cow.cow_id)}
                    onChange={() => toggleCow(cow.cow_id)}
                    className="size-4 accent-emerald-700"
                  />
                  <span className="flex min-w-0 flex-1 items-center justify-between gap-3">
                    <span>
                      <span className="block text-[13px] font-semibold text-ink">{cow.current_tag_number}</span>
                      {cow.category && <span className="text-[11px] text-muted">{cow.category}</span>}
                    </span>
                    <span className="text-[12px] text-muted">{selectedCowIds.includes(cow.cow_id) ? "Included" : "Not milked"}</span>
                  </span>
                </label>
              ))}
            </div>

            <div className="mt-4 grid gap-3 rounded-md bg-subtle/60 p-3 sm:grid-cols-[minmax(180px,260px)_1fr] sm:items-end">
              <label className={ui.label}>
                Total milk collected (L)
                <input
                  type="number"
                  min="0"
                  max="999999.99"
                  step="0.01"
                  value={totalLiters}
                  onChange={(event) => setTotalLiters(event.target.value)}
                  placeholder="0.00"
                  className={ui.input}
                />
              </label>
              <div className="flex items-center justify-between gap-4 pb-1 sm:justify-start sm:gap-8">
                <div><p className="text-[11px] text-muted">Per checked cow</p><p className="text-[14px] font-semibold text-ink">{averageLiters} L avg.</p></div>
                <div><p className="text-[11px] text-muted">Session total</p><p className="text-[14px] font-semibold text-ink">{Number.isFinite(litersNumber) ? litersNumber.toFixed(2) : "0.00"} L</p></div>
              </div>
            </div>
            <div className="mt-3 flex flex-wrap items-center justify-between gap-2">
              <p className="text-[11px] text-muted">Each cow gets an equal share; spare hundredths are distributed one by one.</p>
              <button type="submit" disabled={saving || scheduleIsDirty} className={btn("primary", "md")}>{saving ? "Saving…" : "Save session total"}</button>
            </div>
            {scheduleIsDirty && <p className="mt-2 text-right text-[11px] text-amber-700">Save roster changes before recording this session.</p>}
          </form>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line px-4 py-3.5">
          <div>
            <h2 className="text-[14px] font-semibold text-ink">Milking roster</h2>
            <p className="mt-0.5 text-[11px] text-muted">Choose which cows give milk and the sessions they attend.</p>
          </div>
          <button type="button" onClick={() => setRosterOpen((open) => !open)} className={btn("secondary", "sm")} aria-expanded={rosterOpen}>
            {rosterOpen ? "Hide roster" : "Edit roster"}
          </button>
        </div>
        {rosterOpen && (
          <div>
            {loadingCows ? <p className="p-5 text-center text-[12px] text-muted">Loading cows…</p> : cows.length === 0 ? (
              <p className="p-5 text-center text-[12px] text-muted">No active cows found. Add cows to the herd first.</p>
            ) : (
              <>
                <div className="hidden grid-cols-[minmax(140px,1fr)_110px_repeat(3,minmax(95px,130px))] gap-2 border-b border-line bg-subtle px-4 py-2 text-[10px] font-semibold uppercase tracking-wide text-muted sm:grid">
                  <span>Cow</span><span>Gives milk</span><span>Morning</span><span>Noon</span><span>Evening</span>
                </div>
                <div className="divide-y divide-line">
                  {cows.map((cow) => {
                    const draft = scheduleDrafts[cow.cow_id] ?? scheduleFor(cow);
                    return (
                      <div key={cow.cow_id} className="grid gap-2 px-4 py-3 sm:grid-cols-[minmax(140px,1fr)_110px_repeat(3,minmax(95px,130px))] sm:items-center">
                        <div><p className="text-[13px] font-semibold text-ink">{cow.current_tag_number}</p><p className="text-[10px] text-muted">{cow.category ?? "Cow"}</p></div>
                        <label className="flex items-center gap-2 text-[12px] text-ink">
                          <input
                            type="checkbox"
                            checked={draft.gives_milk}
                            onChange={(event) => updateSchedule(cow.cow_id, (current) => event.target.checked
                              ? { gives_milk: true, milking_sessions: ["morning", "noon", "evening"] }
                              : { gives_milk: false, milking_sessions: [] })}
                            className="size-4 accent-emerald-700"
                          />
                          <span className="sm:hidden">Gives milk</span><span className="hidden sm:inline">{draft.gives_milk ? "Yes" : "No"}</span>
                        </label>
                        {SESSION_OPTIONS.map((option) => (
                          <label key={option.value} className={`flex items-center gap-2 text-[12px] ${draft.gives_milk ? "text-ink" : "text-muted"}`}>
                            <input
                              type="checkbox"
                              checked={draft.milking_sessions.includes(option.value)}
                              disabled={!draft.gives_milk}
                              onChange={(event) => updateSchedule(cow.cow_id, (current) => {
                                const nextSessions = event.target.checked
                                  ? [...current.milking_sessions, option.value]
                                  : current.milking_sessions.filter((value) => value !== option.value);
                                return { gives_milk: nextSessions.length > 0, milking_sessions: nextSessions };
                              })}
                              className="size-4 accent-emerald-700"
                            />
                            <span className="sm:hidden">{option.label}</span><span className="hidden sm:inline">{option.label}</span>
                          </label>
                        ))}
                      </div>
                    );
                  })}
                </div>
                <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle/50 px-4 py-3">
                  <p className="text-[11px] text-muted">Newly enabled cows start in all three sessions. Adjust each session as needed.</p>
                  <button type="button" disabled={!scheduleIsDirty || savingRoster} onClick={saveRoster} className={btn("primary", "sm")}>
                    {savingRoster ? "Saving roster…" : "Save roster"}
                  </button>
                </div>
              </>
            )}
          </div>
        )}
      </section>

      <section className="overflow-hidden rounded-lg border border-line bg-surface">
        <div className="border-b border-line px-4 py-3.5">
          <h2 className="text-[14px] font-semibold text-ink">Recent milk sessions</h2>
          <p className="mt-0.5 text-[11px] text-muted">Session totals from the selected day and previous six days.</p>
        </div>
        {loadingBatch ? <p className="p-5 text-center text-[12px] text-muted">Loading recent sessions…</p> : batches.length === 0 ? (
          <p className="p-5 text-center text-[12px] text-muted">No milk sessions recorded in this date range.</p>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[520px] text-left text-[12px]">
              <thead className="bg-subtle text-[10px] uppercase tracking-wide text-muted"><tr>
                <th className="px-4 py-2.5 font-semibold">Date</th><th className="px-4 py-2.5 font-semibold">Session</th><th className="px-4 py-2.5 text-right font-semibold">Cows</th><th className="px-4 py-2.5 text-right font-semibold">Total</th><th className="px-4 py-2.5 text-right font-semibold">Average</th>
              </tr></thead>
              <tbody className="divide-y divide-line">
                {batches.map((item) => (
                  <tr key={`${item.production_date}-${item.session}`}>
                    <td className="px-4 py-2.5 text-ink">{item.production_date}</td>
                    <td className="px-4 py-2.5 capitalize text-ink">{item.session}</td>
                    <td className="px-4 py-2.5 text-right text-ink">{item.cow_count}</td>
                    <td className="px-4 py-2.5 text-right font-medium text-ink">{Number(item.total_liters).toFixed(2)} L</td>
                    <td className="px-4 py-2.5 text-right text-muted">{item.cow_count ? (Number(item.total_liters) / item.cow_count).toFixed(2) : "0.00"} L</td>
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
