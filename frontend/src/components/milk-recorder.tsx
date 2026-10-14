"use client";

import React, { useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, btn, Segmented, ui } from "@/components/ui";
import { usePreference } from "@/lib/preferences";
import { apiRequest, apiRoutes, apiQuery } from "@/lib/api";

type CowItem = {
  cow_id: string;
  current_tag_number: string;
  status?: string;
};

type MilkRecordItem = {
  milk_id?: string;
  cow_id: string;
  cow_tag_number?: string;
  production_date: string;
  session: "morning" | "evening";
  liters: number;
};

function defaultSessionInDhaka(): "morning" | "evening" {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    const hour = hourPart ? Number(hourPart.value) : 12;
    return hour < 15 ? "morning" : "evening";
  } catch {
    return "morning";
  }
}

const subscribeNever = () => () => {};

export function MilkRecorder({ date, isReady }: { date: string; isReady: boolean }) {
  const [tags, setTags] = useState<string[]>([]);
  const [pendingTag, setPendingTag] = useState("");
  const [litersInput, setLitersInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const tagInputRef = useRef<HTMLInputElement>(null);
  const queryClient = useQueryClient();

  // Target preference
  const [targetPref, setTargetPref] = usePreference<string>("cf-milk-target", "120");
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(targetPref);

  // Default session in Asia/Dhaka without hydration mismatch
  const clientDefaultSession = useSyncExternalStore<"morning" | "evening">(
    subscribeNever,
    defaultSessionInDhaka,
    () => "morning"
  );
  const [sessionOverride, setSessionOverride] = useState<"morning" | "evening" | null>(null);
  const session: "morning" | "evening" = sessionOverride ?? clientDefaultSession;

  // Fetch cows for tag validation and datalist
  const cowsQuery = useQuery({
    queryKey: ["herd-cows"],
    queryFn: () => apiRequest<CowItem[]>(apiRoutes.herd.cows),
    staleTime: 60_000,
  });

  const cows = useMemo(() => cowsQuery.data ?? [], [cowsQuery.data]);
  const cowTagMap = useMemo(() => {
    const map = new Map<string, string>();
    cows.forEach((cow) => {
      if (cow.current_tag_number) {
        map.set(String(cow.current_tag_number).trim(), String(cow.cow_id));
      }
    });
    return map;
  }, [cows]);

  // Fetch today's milk records
  const milkQuery = useQuery({
    queryKey: ["milk-records", date],
    queryFn: () =>
      apiRequest<MilkRecordItem[]>(
        apiQuery(apiRoutes.sales.milk, { start_date: date, end_date: date })
      ),
    enabled: isReady && Boolean(date),
    staleTime: 30_000,
    retry: 1,
  });

  const dayRecords = useMemo(() => milkQuery.data ?? [], [milkQuery.data]);
  const totalDayLiters = useMemo(
    () => dayRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0),
    [dayRecords]
  );

  const targetLiters = Math.max(1, parseFloat(targetPref) || 120);
  const percentOfTarget = Math.round((totalDayLiters / targetLiters) * 100);
  const gaugeFillHeight = Math.min(100, Math.max(0, percentOfTarget));

  // Tag manipulation
  function addTagsFromText(text: string) {
    const clean = text.trim();
    if (!clean) return;
    const items = clean.split(/[,\s]+/).filter(Boolean);
    const updated = [...tags];
    for (const item of items) {
      if (!updated.includes(item)) {
        updated.push(item);
      }
    }
    setTags(updated);
    setPendingTag("");
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((t) => t !== tagToRemove));
  }

  function handleTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      addTagsFromText(pendingTag);
    } else if (event.key === "Backspace" && !pendingTag && tags.length > 0) {
      event.preventDefault();
      setTags((current) => current.slice(0, -1));
    }
  }

  function handleTagPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    addTagsFromText(pasted);
  }

  // Live preview line calculation
  const totalLitersNum = parseFloat(litersInput) || 0;
  const livePreview = useMemo(() => {
    if (tags.length === 0) {
      return "Add at least one cow tag";
    }
    const count = tags.length;
    const avg = totalLitersNum > 0 ? (totalLitersNum / count).toFixed(2) : "0.00";
    return `${count} cow${count > 1 ? "s" : ""} · ${totalLitersNum.toFixed(2)} L · about ${avg} L each`;
  }, [tags.length, totalLitersNum]);

  // Saving group
  async function handleSaveGroup(event: React.FormEvent) {
    event.preventDefault();
    setError("");
    setNotice("");

    if (!isReady || !date) {
      setError("Waiting for date synchronization.");
      return;
    }

    if (tags.length === 0) {
      setError("Please add at least one cow tag.");
      return;
    }

    if (Number.isNaN(totalLitersNum) || totalLitersNum <= 0 || totalLitersNum > 999999.99) {
      setError("Please enter a valid positive number of liters (maximum 999,999.99).");
      return;
    }

    const n = tags.length;
    const totalCents = Math.round(totalLitersNum * 100);
    if (totalCents < n) {
      setError(`Total liters (${totalLitersNum} L) must be divisible into at least 0.01 L per cow.`);
      return;
    }

    // Verify all tags exist in herd
    const missingTags: string[] = [];
    for (const tag of tags) {
      if (cowsQuery.isSuccess && !cowTagMap.has(tag)) {
        missingTags.push(tag);
      }
    }
    if (missingTags.length > 0) {
      setError(`Cow tag(s) not found in herd: ${missingTags.join(", ")}`);
      return;
    }

    // Cent-accurate allocation
    const baseCents = Math.floor(totalCents / n);
    const extraCents = totalCents - baseCents * n;

    const allocations = tags.map((tag, idx) => {
      const cowId = cowTagMap.get(tag)!;
      const cents = baseCents + (idx < extraCents ? 1 : 0);
      return {
        tag,
        cow_id: cowId,
        liters: Number((cents / 100).toFixed(2)),
      };
    });

    setSaving(true);

    try {
      const results = await Promise.allSettled(
        allocations.map((item) =>
          apiRequest(apiRoutes.sales.milk, {
            method: "POST",
            body: {
              cow_id: item.cow_id,
              production_date: date,
              session,
              liters: item.liters,
            },
          })
        )
      );

      const failedTags: string[] = [];
      let failedLitersSum = 0;
      let failureReason = "";

      results.forEach((res, idx) => {
        if (res.status === "rejected") {
          const item = allocations[idx];
          failedTags.push(item.tag);
          failedLitersSum += item.liters;
          if (!failureReason && res.reason instanceof Error) {
            failureReason = res.reason.message;
          }
        }
      });

      // Invalidate relevant queries
      await queryClient.invalidateQueries({ queryKey: ["milk-records"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (failedTags.length === 0) {
        setTags([]);
        setLitersInput("");
        setNotice(
          `Saved ${totalLitersNum.toFixed(2)} L across ${allocations.length} cow${
            allocations.length > 1 ? "s" : ""
          } (${session}).`
        );
      } else {
        setTags(failedTags);
        setLitersInput(failedLitersSum.toFixed(2));
        setError(
          `Could not save milk for tag(s): ${failedTags.join(", ")}. ${failureReason || "Please retry."}`
        );
      }
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Failed to save milk records.");
    } finally {
      setSaving(false);
    }
  }

  function handleSaveTarget() {
    const val = parseFloat(targetInput);
    if (!Number.isNaN(val) && val > 0) {
      setTargetPref(String(val));
    }
    setIsEditingTarget(false);
  }

  return (
    <div className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">Record milk</h2>
          <p className="text-[12px] text-muted">
            Allocate a group yield across multiple cows for {date || "today"}.
          </p>
        </div>

        {/* Session selector */}
        <Segmented<"morning" | "evening">
          name="milk-session"
          size="sm"
          value={session}
          onChange={(s) => setSessionOverride(s)}
          options={[
            { value: "morning", label: "Morning" },
            { value: "evening", label: "Evening" },
          ]}
        />
      </div>

      {error && (
        <div
          role="alert"
          className="rounded-[6px] border border-warn/30 bg-warn-soft p-3 text-[13px] text-warn"
        >
          {error}
        </div>
      )}
      {notice && (
        <div
          role="status"
          className="rounded-[6px] border border-accent/30 bg-accent-soft p-3 text-[13px] text-accent"
        >
          {notice}
        </div>
      )}

      {/* Main Row: Entry on Left, Gauge on Right */}
      <div className="grid gap-4 sm:grid-cols-[1fr_auto]">
        {/* Entry Form */}
        <form onSubmit={handleSaveGroup} className="space-y-3">
          <div>
            <label htmlFor="cow-tags-input" className="block mb-1 text-[12px] font-medium text-ink">
              Cow tags
            </label>
            {/* Chips field */}
            <div
              onClick={() => tagInputRef.current?.focus()}
              className="flex min-h-10 flex-wrap items-center gap-1.5 rounded-[6px] border border-line-strong bg-field p-1.5 cursor-text focus-within:border-accent"
            >
              {tags.map((tag) => (
                <span
                  key={tag}
                  className="inline-flex items-center gap-1 rounded-[4px] bg-accent-soft px-2 py-0.5 text-[12px] font-medium text-accent"
                >
                  <span>{tag}</span>
                  <button
                    type="button"
                    aria-label={`Remove cow ${tag}`}
                    onClick={(e) => {
                      e.stopPropagation();
                      removeTag(tag);
                    }}
                    className="hover:opacity-75 cursor-pointer ml-0.5 font-bold"
                  >
                    ×
                  </button>
                </span>
              ))}
              <input
                id="cow-tags-input"
                ref={tagInputRef}
                list="cow-tags-datalist"
                placeholder={tags.length === 0 ? "Type a tag, press Enter or comma..." : ""}
                value={pendingTag}
                onChange={(e) => setPendingTag(e.target.value)}
                onKeyDown={handleTagKeyDown}
                onPaste={handleTagPaste}
                onBlur={() => {
                  if (pendingTag.trim()) {
                    addTagsFromText(pendingTag);
                  }
                }}
                className="min-w-[120px] flex-1 border-0 bg-transparent px-1 py-0.5 text-[13px] text-ink outline-none placeholder:text-muted"
              />
              <datalist id="cow-tags-datalist">
                {cows.map((c) => (
                  <option key={c.cow_id} value={c.current_tag_number} />
                ))}
              </datalist>
            </div>
          </div>

          <div>
            <label htmlFor="total-liters" className="block mb-1 text-[12px] font-medium text-ink">
              Total liters
            </label>
            <input
              id="total-liters"
              type="number"
              step="0.01"
              min="0.01"
              max="999999.99"
              placeholder="e.g. 42.60"
              value={litersInput}
              onChange={(e) => setLitersInput(e.target.value)}
              className={ui.input}
            />
          </div>

          {/* Live preview banner */}
          <div className="rounded-[6px] bg-accent-soft/70 px-3 py-2 text-[12px] font-medium text-accent">
            {livePreview}
          </div>

          <button
            type="submit"
            disabled={saving || tags.length === 0 || totalLitersNum <= 0}
            className={btn("primary", "md")}
          >
            {saving ? "Saving…" : "Save group"}
          </button>
        </form>

        {/* Tank Gauge Card */}
        <div className="flex flex-col items-center justify-between rounded-[6px] border border-line bg-subtle p-3.5 sm:w-[190px]">
          <div className="flex items-center gap-3">
            {/* CSS-Only Vertical Gauge without gradient */}
            <div
              role="img"
              aria-label={`Milk tank: ${totalDayLiters.toFixed(1)} liters of ${targetLiters} liter target (${percentOfTarget}%)`}
              className="relative h-[130px] w-[64px] overflow-hidden rounded-[8px_8px_14px_14px] border-2 border-line bg-field shrink-0"
            >
              {/* Ticks at 25%, 50%, 75% */}
              <div className="absolute inset-x-0 bottom-[25%] border-t border-dashed border-line-strong/40" />
              <div className="absolute inset-x-0 bottom-[50%] border-t border-dashed border-line-strong/40" />
              <div className="absolute inset-x-0 bottom-[75%] border-t border-dashed border-line-strong/40" />

              {/* Flat milk fill with 2px top edge */}
              <div
                style={{ height: `${gaugeFillHeight}%` }}
                className="absolute inset-x-0 bottom-0 bg-milk transition-all duration-500"
              >
                <div className="absolute inset-x-0 top-0 h-[2px] bg-milk-strong" />
              </div>
            </div>

            <div className="space-y-1">
              <p className="text-[24px] font-bold tracking-tight text-ink tabular-nums leading-none">
                {totalDayLiters.toFixed(1)}
              </p>
              <div className="text-[12px] text-muted">
                {isEditingTarget ? (
                  <div className="flex items-center gap-1 mt-1">
                    <input
                      type="number"
                      value={targetInput}
                      onChange={(e) => setTargetInput(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter") handleSaveTarget();
                        if (e.key === "Escape") setIsEditingTarget(false);
                      }}
                      className="w-16 h-6 px-1 text-[11px] rounded border border-line bg-field"
                    />
                    <button
                      type="button"
                      onClick={handleSaveTarget}
                      className="text-[11px] text-accent font-medium"
                    >
                      OK
                    </button>
                  </div>
                ) : (
                  <button
                    type="button"
                    onClick={() => {
                      setTargetInput(targetPref);
                      setIsEditingTarget(true);
                    }}
                    title="Click to edit daily target"
                    className="text-left text-muted hover:text-ink hover:underline cursor-pointer"
                  >
                    of {targetLiters} L target
                  </button>
                )}
              </div>
              <p className="text-[12px] font-semibold text-accent">{percentOfTarget}% of target</p>
            </div>
          </div>

          <p className="mt-2 text-[11px] text-muted text-center">
            {dayRecords.length > 0
              ? `${dayRecords.length} records · avg ${(totalDayLiters / dayRecords.length).toFixed(1)} L`
              : "No records today"}
          </p>
        </div>
      </div>

      {/* Day List Table */}
      <div className="space-y-2 pt-2">
        <h3 className="text-[13px] font-semibold text-ink">Recorded today ({date})</h3>
        <div className="overflow-x-auto rounded-[6px] border border-line">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-subtle text-[12px] text-muted">
                <th className="px-3 py-2 font-medium">Cow</th>
                <th className="px-3 py-2 font-medium">Session</th>
                <th className="px-3 py-2 font-medium text-right">Liters</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {dayRecords.length === 0 ? (
                <tr>
                  <td colSpan={3} className="px-3 py-6 text-center text-muted">
                    No milk recorded for this date yet. Use the form above to add records.
                  </td>
                </tr>
              ) : (
                <>
                  {dayRecords.map((r, i) => (
                    <tr key={r.milk_id ?? `milk-${i}`} className="hover:bg-wash transition-colors">
                      <td className="px-3 py-2 font-medium text-ink">
                        {r.cow_tag_number ?? `Cow ${r.cow_id}`}
                      </td>
                      <td className="px-3 py-2">
                        <Badge tone={r.session === "morning" ? "good" : "neutral"}>
                          {r.session === "morning" ? "Morning" : "Evening"}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {Number(r.liters).toFixed(2)}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-subtle font-semibold border-t border-line">
                    <td colSpan={2} className="px-3 py-2 text-ink">
                      Total
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {totalDayLiters.toFixed(2)} L
                    </td>
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">
          Milk records are saved per cow in the database. There is no API to edit or delete milk records.
        </p>
      </div>
    </div>
  );
}
