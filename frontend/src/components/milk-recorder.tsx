"use client";

import React, { useEffect, useMemo, useRef, useState, useSyncExternalStore } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { Badge, btn, Segmented, ui } from "@/components/ui";
import { usePreference } from "@/lib/preferences";
import { apiRequest, apiRoutes, apiQuery } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type MilkSession = "morning" | "noon" | "evening";

type CowItem = {
  cow_id: string;
  current_tag_number: string;
  category?: string;
  status?: string;
  gives_milk?: boolean;
  milking_sessions?: MilkSession[];
};

type MilkRecordItem = {
  milk_id?: string;
  cow_id: string;
  cow_tag_number?: string;
  production_date: string;
  session: MilkSession;
  liters: number;
};

const SESSION_LABELS: Record<MilkSession, string> = {
  morning: "Morning",
  noon: "Noon",
  evening: "Evening",
};

function defaultSessionInDhaka(): MilkSession {
  try {
    const parts = new Intl.DateTimeFormat("en-US", {
      timeZone: "Asia/Dhaka",
      hour: "numeric",
      hour12: false,
    }).formatToParts(new Date());
    const hourPart = parts.find((p) => p.type === "hour");
    const hour = hourPart ? Number(hourPart.value) : 12;
    if (hour < 11) return "morning";
    if (hour < 15) return "noon";
    return "evening";
  } catch {
    return "morning";
  }
}

const subscribeNever = () => () => {};

export function MilkRecorder({ date, isReady }: { date: string; isReady: boolean }) {
  const { tr, num, date: fmtDate, enumLabel } = useI18n();
  const [tags, setTags] = useState<string[]>([]);
  const [pendingTag, setPendingTag] = useState("");
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [highlightedIndex, setHighlightedIndex] = useState(0);
  const [litersInput, setLitersInput] = useState("");
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [unscheduledConfirm, setUnscheduledConfirm] = useState<{
    cows: { tag: string; scheduled: MilkSession[] }[];
  } | null>(null);

  // In-app modal states replacing native window.prompt()
  const [editTarget, setEditTarget] = useState<MilkRecordItem | null>(null);
  const [editLiters, setEditLiters] = useState("");
  const [editError, setEditError] = useState("");
  const [editBusy, setEditBusy] = useState(false);

  const [voidTarget, setVoidTarget] = useState<MilkRecordItem | null>(null);
  const [voidReason, setVoidReason] = useState("");
  const [voidError, setVoidError] = useState("");
  const [voidBusy, setVoidBusy] = useState(false);

  const tagInputRef = useRef<HTMLInputElement>(null);
  const tagPickerRef = useRef<HTMLDivElement>(null);
  const queryClient = useQueryClient();

  // Target preference
  const [targetPref, setTargetPref] = usePreference<string>("cf-milk-target", "120");
  const [isEditingTarget, setIsEditingTarget] = useState(false);
  const [targetInput, setTargetInput] = useState<string>(targetPref);

  // Default session in Asia/Dhaka without hydration mismatch
  const clientDefaultSession = useSyncExternalStore<MilkSession>(
    subscribeNever,
    defaultSessionInDhaka,
    () => "morning"
  );
  const [sessionOverride, setSessionOverride] = useState<MilkSession | null>(null);
  const session: MilkSession = sessionOverride ?? clientDefaultSession;

  // Close modals on Escape
  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape") {
        setDropdownOpen(false);
        if (editTarget && !editBusy) setEditTarget(null);
        if (voidTarget && !voidBusy) setVoidTarget(null);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [editTarget, editBusy, voidTarget, voidBusy]);

  // Fetch active cows for tag validation & dark-mode autocomplete
  const cowsQuery = useQuery({
    queryKey: ["herd-cows"],
    queryFn: () => apiRequest<CowItem[]>(apiRoutes.herd.cows),
    staleTime: 60_000,
  });

  const cows = useMemo(
    () => (cowsQuery.data ?? []).filter((c) => !c.status || c.status === "active"),
    [cowsQuery.data]
  );

  const cowByTagMap = useMemo(() => {
    const map = new Map<string, CowItem>();
    cows.forEach((cow) => {
      if (cow.current_tag_number) {
        map.set(String(cow.current_tag_number).trim(), cow);
      }
    });
    return map;
  }, [cows]);

  const cowByLowerTagMap = useMemo(() => {
    const map = new Map<string, CowItem>();
    cows.forEach((cow) => {
      if (cow.current_tag_number) {
        map.set(String(cow.current_tag_number).trim().toLowerCase(), cow);
      }
    });
    return map;
  }, [cows]);

  const suggestions = useMemo(() => {
    const q = pendingTag.trim().toLowerCase();
    return cows
      .filter((c) => !tags.includes(c.current_tag_number.trim()))
      .filter((c) => {
        if (!q) return true;
        return (
          c.current_tag_number.toLowerCase().includes(q) ||
          (c.category ?? "").toLowerCase().includes(q)
        );
      })
      .sort((a, b) => {
        const aMilking = a.gives_milk ? 0 : 1;
        const bMilking = b.gives_milk ? 0 : 1;
        if (aMilking !== bMilking) return aMilking - bMilking;
        return a.current_tag_number.localeCompare(b.current_tag_number, undefined, { numeric: true });
      })
      .slice(0, 12);
  }, [cows, pendingTag, tags]);

  // Fetch today's milk records
  const milkQuery = useQuery({
    queryKey: ["milk-records", date],
    queryFn: () =>
      apiRequest<MilkRecordItem[]>(
        apiQuery(apiRoutes.sales.milk, { start_date: date, end_date: date })
      ),
    enabled: isReady && Boolean(date),
    staleTime: 60_000,
  });

  const dayRecords = useMemo(() => milkQuery.data ?? [], [milkQuery.data]);
  const totalDayLiters = useMemo(
    () => dayRecords.reduce((sum, r) => sum + Number(r.liters || 0), 0),
    [dayRecords]
  );

  const targetLiters = Math.max(1, parseFloat(targetPref) || 120);
  const percentOfTarget = Math.round((totalDayLiters / targetLiters) * 100);
  const gaugeFillHeight = Math.min(100, Math.max(0, percentOfTarget));

  // Tag manipulation — strictly validate against active herd tags
  function addTagsFromText(text: string, { silentInvalid = false }: { silentInvalid?: boolean } = {}) {
    const clean = text.trim();
    if (!clean) return;
    const items = clean.split(/[,\s]+/).filter(Boolean);
    const updated = [...tags];
    const invalid: string[] = [];

    for (const item of items) {
      const matchedCow = cowByTagMap.get(item) ?? cowByLowerTagMap.get(item.toLowerCase());
      if (cowsQuery.isSuccess && !matchedCow) {
        invalid.push(item);
        continue;
      }
      const canonical = matchedCow ? matchedCow.current_tag_number.trim() : item;
      if (!updated.includes(canonical)) {
        updated.push(canonical);
      }
    }

    setTags(updated);
    setUnscheduledConfirm(null);
    if (invalid.length > 0) {
      if (!silentInvalid) {
        setError(`Unknown or inactive cow tag(s): ${invalid.join(", ")}. Select a cow from the roster.`);
      }
    } else {
      setError("");
      setPendingTag("");
    }
  }

  function selectSuggestion(tag: string) {
    if (!tags.includes(tag)) {
      setTags((current) => [...current, tag]);
    }
    setPendingTag("");
    setError("");
    setUnscheduledConfirm(null);
    setDropdownOpen(false);
    setHighlightedIndex(0);
    tagInputRef.current?.focus();
  }

  function removeTag(tagToRemove: string) {
    setTags((current) => current.filter((t) => t !== tagToRemove));
    setUnscheduledConfirm(null);
  }

  function handleTagKeyDown(event: React.KeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown") {
      event.preventDefault();
      setDropdownOpen(true);
      setHighlightedIndex((i) => (suggestions.length ? (i + 1) % suggestions.length : 0));
    } else if (event.key === "ArrowUp") {
      event.preventDefault();
      setDropdownOpen(true);
      setHighlightedIndex((i) =>
        suggestions.length ? (i - 1 + suggestions.length) % suggestions.length : 0
      );
    } else if (event.key === "Enter" || event.key === ",") {
      event.preventDefault();
      if (event.key === "Enter" && dropdownOpen && suggestions[highlightedIndex] && pendingTag.trim()) {
        // Prefer exact match if typed, otherwise pick highlighted suggestion
        const exact = cowByLowerTagMap.get(pendingTag.trim().toLowerCase());
        if (exact) {
          addTagsFromText(exact.current_tag_number);
          setDropdownOpen(false);
        } else {
          selectSuggestion(suggestions[highlightedIndex].current_tag_number.trim());
        }
      } else {
        addTagsFromText(pendingTag);
      }
    } else if (event.key === "Escape") {
      setDropdownOpen(false);
    } else if (event.key === "Backspace" && !pendingTag && tags.length > 0) {
      event.preventDefault();
      setTags((current) => current.slice(0, -1));
      setUnscheduledConfirm(null);
    }
  }

  function handleTagPaste(event: React.ClipboardEvent<HTMLInputElement>) {
    event.preventDefault();
    const pasted = event.clipboardData.getData("text");
    addTagsFromText(pasted);
  }

  function handleTagBlur(event: React.FocusEvent<HTMLInputElement>) {
    // Only close dropdown if focus left the tag picker container
    if (tagPickerRef.current?.contains(event.relatedTarget as Node)) {
      return;
    }
    setDropdownOpen(false);
    const trimmed = pendingTag.trim();
    if (!trimmed) return;
    // Only auto-convert on blur if it is an exact valid cow tag; never turn stray numbers like "1.50" into pills
    const exact = cowByTagMap.get(trimmed) ?? cowByLowerTagMap.get(trimmed.toLowerCase());
    if (exact) {
      addTagsFromText(exact.current_tag_number, { silentInvalid: true });
    }
  }

  // Live preview line calculation & inline validation
  const trimmedLiters = litersInput.trim();
  const parsedLiters = trimmedLiters === "" ? NaN : Number(trimmedLiters);
  const totalLitersNum = Number.isFinite(parsedLiters) ? parsedLiters : 0;
  const litersInvalidMessage = useMemo(() => {
    if (!trimmedLiters) return "";
    if (!Number.isFinite(parsedLiters) || parsedLiters <= 0) {
      return tr(
        "Enter a positive number of liters greater than 0.",
        "০-এর বেশি সঠিক লিটার সংখ্যা লিখুন।"
      );
    }
    if (parsedLiters > 999999.99) {
      return tr(
        "Maximum allowed is 999,999.99 liters.",
        "সর্বোচ্চ ৯৯৯,৯৯৯.৯৯ লিটার পর্যন্ত লেখা যাবে।"
      );
    }
    return "";
  }, [trimmedLiters, parsedLiters, tr]);

  const livePreview = useMemo(() => {
    if (tags.length === 0) {
      return tr("Add at least one cow tag");
    }
    if (totalLitersNum <= 0) {
      return tr("Enter a positive number of liters (> 0)");
    }
    const count = tags.length;
    const avg = num(totalLitersNum / count);
    return `${num(count, 0)} ${tr(count > 1 ? "cows" : "cow", "টি গরু")} · ${num(totalLitersNum)} L · ${tr("about", "প্রায়")} ${avg} L ${tr("each", "প্রতিটি")}`;
  }, [tags.length, totalLitersNum, num, tr]);

  // Saving group (with unscheduled session guard)
  async function saveGroup({ allowUnscheduled = false }: { allowUnscheduled?: boolean } = {}) {
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

    // Verify all tags exist in active herd
    const missingTags: string[] = [];
    for (const tag of tags) {
      if (cowsQuery.isSuccess && !cowByTagMap.has(tag)) {
        missingTags.push(tag);
      }
    }
    if (missingTags.length > 0) {
      setError(`Cow tag(s) not found in active herd: ${missingTags.join(", ")}`);
      return;
    }

    // Check milking schedule guard unless user explicitly confirmed
    if (!allowUnscheduled && cowsQuery.isSuccess) {
      const unscheduled = tags
        .map((tag) => cowByTagMap.get(tag)!)
        .filter((cow) => !cow.gives_milk || !(cow.milking_sessions ?? []).includes(session))
        .map((cow) => ({
          tag: cow.current_tag_number,
          scheduled: cow.gives_milk ? cow.milking_sessions ?? [] : [],
        }));

      if (unscheduled.length > 0) {
        setUnscheduledConfirm({ cows: unscheduled });
        return;
      }
    }

    setUnscheduledConfirm(null);

    // Cent-accurate allocation
    const baseCents = Math.floor(totalCents / n);
    const extraCents = totalCents - baseCents * n;

    const allocations = tags.map((tag, idx) => {
      const cowId = cowByTagMap.get(tag)!.cow_id;
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

      await queryClient.invalidateQueries({ queryKey: ["milk-records"] });
      await queryClient.invalidateQueries({ queryKey: ["cow-milk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });

      if (failedTags.length === 0) {
        setTags([]);
        setPendingTag("");
        setLitersInput("");
        setNotice(
          `Saved ${totalLitersNum.toFixed(2)} L across ${allocations.length} cow${
            allocations.length > 1 ? "s" : ""
          } (${SESSION_LABELS[session]}).`
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

  function handleSaveGroup(event: React.FormEvent) {
    event.preventDefault();
    void saveGroup({ allowUnscheduled: false });
  }

  function handleSaveTarget() {
    const val = parseFloat(targetInput);
    if (!Number.isNaN(val) && val > 0) {
      setTargetPref(String(val));
    }
    setIsEditingTarget(false);
  }

  function openEditModal(record: MilkRecordItem) {
    if (!record.milk_id) return;
    setEditTarget(record);
    setEditLiters(Number(record.liters).toFixed(2));
    setEditError("");
  }

  async function submitEditModal(event: React.FormEvent) {
    event.preventDefault();
    if (!editTarget?.milk_id) return;
    const val = parseFloat(editLiters);
    if (Number.isNaN(val) || val <= 0 || val > 999999.99) {
      setEditError("Please enter a valid positive number of liters (0.01 to 999,999.99).");
      return;
    }
    setEditBusy(true);
    setEditError("");
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.sales.milkRecord(editTarget.milk_id), {
        method: "PATCH",
        body: { liters: Number(val.toFixed(2)) },
      });
      await queryClient.invalidateQueries({ queryKey: ["milk-records"] });
      await queryClient.invalidateQueries({ queryKey: ["cow-milk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setNotice(`Updated milk yield for ${editTarget.cow_tag_number ?? "Cow"} to ${val.toFixed(2)} L.`);
      setEditTarget(null);
    } catch (cause) {
      setEditError(cause instanceof Error ? cause.message : "Failed to update milk record.");
    } finally {
      setEditBusy(false);
    }
  }

  function openVoidModal(record: MilkRecordItem) {
    if (!record.milk_id) return;
    setVoidTarget(record);
    setVoidReason("");
    setVoidError("");
  }

  async function submitVoidModal(event: React.FormEvent) {
    event.preventDefault();
    if (!voidTarget?.milk_id) return;
    if (!voidReason.trim()) {
      setVoidError("Reason is required to void a milk entry.");
      return;
    }
    setVoidBusy(true);
    setVoidError("");
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.sales.milkRecord(voidTarget.milk_id), {
        method: "PATCH",
        body: { is_void: true, void_reason: voidReason.trim() },
      });
      await queryClient.invalidateQueries({ queryKey: ["milk-records"] });
      await queryClient.invalidateQueries({ queryKey: ["cow-milk"] });
      await queryClient.invalidateQueries({ queryKey: ["dashboard"] });
      setNotice(`Voided milk record for ${voidTarget.cow_tag_number ?? "Cow"}.`);
      setVoidTarget(null);
    } catch (cause) {
      setVoidError(cause instanceof Error ? cause.message : "Failed to void milk record.");
    } finally {
      setVoidBusy(false);
    }
  }

  return (
    <div className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
      {/* Header */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h2 className="text-[15px] font-semibold text-ink">{tr("Record milk")}</h2>
          <p className="text-[12px] text-muted">
            {tr(
              `Allocate a group yield across multiple cows for ${date ? fmtDate(date) : "today"}.`,
              `${date ? fmtDate(date) : "আজকের"} জন্য একাধিক গরুর দুধ বণ্টন করুন।`
            )}
          </p>
        </div>

        {/* Session selector */}
        <Segmented<MilkSession>
          name="milk-session"
          size="sm"
          value={session}
          onChange={(s) => {
            setSessionOverride(s);
            setUnscheduledConfirm(null);
          }}
          options={[
            { value: "morning", label: tr("Morning") },
            { value: "noon", label: tr("Noon") },
            { value: "evening", label: tr("Evening") },
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
          <div ref={tagPickerRef} className="relative">
            <label htmlFor="cow-tags-input" className="block mb-1 text-[12px] font-medium text-ink">
              Cow tags
            </label>
            {/* Chips field */}
            <div
              onClick={() => {
                tagInputRef.current?.focus();
                setDropdownOpen(true);
              }}
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
                role="combobox"
                aria-expanded={dropdownOpen}
                aria-autocomplete="list"
                aria-controls="cow-tags-listbox"
                autoComplete="off"
                placeholder={tags.length === 0 ? "Type tag, Enter to add" : "Add tag…"}
                value={pendingTag}
                onFocus={() => setDropdownOpen(true)}
                onChange={(e) => {
                  setPendingTag(e.target.value);
                  setDropdownOpen(true);
                  setHighlightedIndex(0);
                }}
                onKeyDown={handleTagKeyDown}
                onPaste={handleTagPaste}
                onBlur={handleTagBlur}
                className="min-w-[160px] flex-1 border-0 bg-transparent px-1 py-0.5 text-[13px] text-ink outline-none placeholder:text-muted"
              />
            </div>

            {/* Dark-mode-aware custom autocomplete popover */}
            {dropdownOpen && suggestions.length > 0 && (
              <ul
                id="cow-tags-listbox"
                role="listbox"
                className="absolute left-0 right-0 top-full z-20 mt-1 max-h-52 overflow-y-auto rounded-[6px] border border-line bg-surface py-1 shadow-overlay"
              >
                {suggestions.map((c, idx) => {
                  const tag = c.current_tag_number.trim();
                  const isScheduled =
                    Boolean(c.gives_milk) && (c.milking_sessions ?? []).includes(session);
                  const active = idx === highlightedIndex;
                  return (
                    <li
                      key={c.cow_id}
                      role="option"
                      aria-selected={active}
                      onMouseDown={(e) => {
                        e.preventDefault();
                        selectSuggestion(tag);
                      }}
                      onMouseEnter={() => setHighlightedIndex(idx)}
                      className={`flex cursor-pointer items-center justify-between gap-2 px-3 py-1.5 text-[12.5px] transition-colors ${
                        active ? "bg-wash text-ink" : "text-ink hover:bg-wash"
                      }`}
                    >
                      <span className="flex items-center gap-2 font-medium">
                        <span>{tag}</span>
                        {c.category && <span className="text-[11px] text-muted">{c.category}</span>}
                      </span>
                      <span className="text-[11px] text-muted">
                        {isScheduled
                          ? `${SESSION_LABELS[session]} scheduled`
                          : c.gives_milk
                            ? "Other session"
                            : "Not milking"}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>

          <div>
            <label htmlFor="total-liters" className="block mb-1 text-[12px] font-medium text-ink">
              {tr("Total liters")}
            </label>
            <input
              id="total-liters"
              type="number"
              step="0.01"
              min="0.01"
              max="999999.99"
              placeholder="e.g. 42.60"
              aria-invalid={Boolean(litersInvalidMessage)}
              value={litersInput}
              onChange={(e) => setLitersInput(e.target.value)}
              className={`${ui.input} ${litersInvalidMessage ? "border-warn" : ""}`}
            />
            {litersInvalidMessage ? (
              <p role="alert" className="mt-1 text-[11.5px] font-medium text-warn">
                {litersInvalidMessage}
              </p>
            ) : null}
          </div>

          {/* Live preview banner */}
          <div className="rounded-[6px] bg-accent-soft/70 px-3 py-2 text-[12px] font-medium text-accent">
            {livePreview}
          </div>

          {/* Non-blocking unscheduled milking warning */}
          {unscheduledConfirm && (
            <div
              role="alert"
              className="rounded-[6px] border border-warn/40 bg-warn-soft p-3 text-[12.5px] text-warn space-y-2"
            >
              <p className="font-medium">
                {unscheduledConfirm.cows
                  .map((c) => {
                    const schedText =
                      c.scheduled.length > 0
                        ? `only scheduled for ${c.scheduled.map((s) => enumLabel(s)).join(", ")}`
                        : "not on the milking roster";
                    return `Cow ${c.tag} isn't scheduled for ${enumLabel(session)} (${schedText})`;
                  })
                  .join("; ")}{" "}
                — {tr("log anyway?", "তবুও সংরক্ষণ করবেন?")}
              </p>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => void saveGroup({ allowUnscheduled: true })}
                  className={btn("primary", "sm")}
                >
                  {saving ? tr("Saving…") : tr("Log anyway", "তবুও সংরক্ষণ করুন")}
                </button>
                <button
                  type="button"
                  disabled={saving}
                  onClick={() => setUnscheduledConfirm(null)}
                  className={btn("secondary", "sm")}
                >
                  {tr("Cancel")}
                </button>
              </div>
            </div>
          )}

          <button
            type="submit"
            disabled={saving || tags.length === 0 || Boolean(litersInvalidMessage) || totalLitersNum <= 0}
            className={btn("primary", "md")}
          >
            {saving ? tr("Saving…") : tr("Save group")}
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
                {totalDayLiters.toFixed(2)}
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
                      className="w-16 h-6 px-1 text-[11px] rounded border border-line bg-field text-ink"
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
              ? `${dayRecords.length} records · avg ${(totalDayLiters / dayRecords.length).toFixed(2)} L`
              : "No records today"}
          </p>
        </div>
      </div>

      {/* Day List Table */}
      <div className="space-y-2 pt-2">
        <h3 className="text-[13px] font-semibold text-ink">
          {tr("Recorded today")} ({fmtDate(date)})
        </h3>
        <div className="overflow-x-auto rounded-[6px] border border-line">
          <table className="w-full text-left border-collapse text-[13px]">
            <thead>
              <tr className="border-b border-line bg-subtle text-[12px] text-muted">
                <th className="px-3 py-2 font-medium">{tr("Cow")}</th>
                <th className="px-3 py-2 font-medium">{tr("Session")}</th>
                <th className="px-3 py-2 font-medium text-right">{tr("Liters")}</th>
                <th className="px-3 py-2 font-medium text-right">{tr("Actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {dayRecords.length === 0 ? (
                <tr>
                  <td colSpan={4} className="px-3 py-6 text-center text-muted">
                    {tr("No milk recorded for this date yet. Use the form above to add records.")}
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
                          {enumLabel(r.session)}
                        </Badge>
                      </td>
                      <td className="px-3 py-2 text-right tabular-nums text-ink">
                        {num(r.liters)}
                      </td>
                      <td className="px-3 py-2 text-right">
                        {r.milk_id && (
                          <div className="flex items-center justify-end gap-2.5 text-[12px]">
                            <button
                              type="button"
                              onClick={() => openEditModal(r)}
                              className="font-medium text-accent hover:underline cursor-pointer"
                            >
                              {tr("Edit")}
                            </button>
                            <button
                              type="button"
                              onClick={() => openVoidModal(r)}
                              className="font-medium text-warn hover:underline cursor-pointer"
                            >
                              {tr("Void")}
                            </button>
                          </div>
                        )}
                      </td>
                    </tr>
                  ))}
                  <tr className="bg-subtle font-semibold border-t border-line">
                    <td colSpan={2} className="px-3 py-2 text-ink">
                      {tr("Total")}
                    </td>
                    <td className="px-3 py-2 text-right tabular-nums text-ink">
                      {num(totalDayLiters)} L
                    </td>
                    <td />
                  </tr>
                </>
              )}
            </tbody>
          </table>
        </div>
        <p className="text-[11px] text-muted">
          Milk records are preserved for audit safety. You can adjust liters or void erroneous entries without database deletion.
        </p>
      </div>

      {/* Edit Milk Yield Modal (Replaces window.prompt) */}
      {editTarget && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !editBusy) setEditTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Edit milk yield"
            onSubmit={(e) => void submitEditModal(e)}
            noValidate
            className="w-full max-w-md rounded-[8px] border border-line bg-surface p-5 shadow-overlay space-y-4"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-ink">
                Update milk yield — Cow {editTarget.cow_tag_number ?? "Cow"}
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                {editTarget.production_date} · {SESSION_LABELS[editTarget.session]} session
              </p>
            </div>
            {editError && (
              <div role="alert" className="rounded-[6px] border border-warn/30 bg-warn-soft p-2.5 text-[12.5px] text-warn">
                {editError}
              </div>
            )}
            <label className={ui.label}>
              Yield (liters) *
              <input
                type="number"
                step="0.01"
                min="0.01"
                max="999999.99"
                autoFocus
                value={editLiters}
                onChange={(e) => {
                  setEditLiters(e.target.value);
                  if (editError) setEditError("");
                }}
                className={ui.input}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={editBusy}
                onClick={() => setEditTarget(null)}
                className={btn("secondary", "md")}
              >
                Cancel
              </button>
              <button type="submit" disabled={editBusy} className={btn("primary", "md")}>
                {editBusy ? "Saving…" : "Save changes"}
              </button>
            </div>
          </form>
        </div>
      )}

      {/* Void Milk Record Modal (Replaces window.prompt) */}
      {voidTarget && (
        <div
          role="presentation"
          onClick={(e) => {
            if (e.target === e.currentTarget && !voidBusy) setVoidTarget(null);
          }}
          className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
        >
          <form
            role="dialog"
            aria-modal="true"
            aria-label="Void milk record"
            onSubmit={(e) => void submitVoidModal(e)}
            noValidate
            className="w-full max-w-md rounded-[8px] border border-line bg-surface p-5 shadow-overlay space-y-4"
          >
            <div>
              <h3 className="text-[15px] font-semibold text-ink">
                Void milk record — Cow {voidTarget.cow_tag_number ?? "Cow"}
              </h3>
              <p className="mt-0.5 text-[12px] text-muted">
                {voidTarget.production_date} · {SESSION_LABELS[voidTarget.session]} ·{" "}
                {Number(voidTarget.liters).toFixed(2)} L
              </p>
            </div>
            {voidError && (
              <div role="alert" className="rounded-[6px] border border-warn/30 bg-warn-soft p-2.5 text-[12.5px] text-warn">
                {voidError}
              </div>
            )}
            <label className={ui.label}>
              Reason for voiding *
              <textarea
                rows={2}
                autoFocus
                placeholder="e.g. Wrong cow tagged, duplicate entry"
                value={voidReason}
                onChange={(e) => {
                  setVoidReason(e.target.value);
                  if (voidError) setVoidError("");
                }}
                className={ui.textarea}
              />
            </label>
            <div className="flex justify-end gap-2 pt-1">
              <button
                type="button"
                disabled={voidBusy}
                onClick={() => setVoidTarget(null)}
                className={btn("secondary", "md")}
              >
                Cancel
              </button>
              <button type="submit" disabled={voidBusy} className={btn("danger", "md")}>
                {voidBusy ? "Voiding…" : "Void entry"}
              </button>
            </div>
          </form>
        </div>
      )}
    </div>
  );
}
