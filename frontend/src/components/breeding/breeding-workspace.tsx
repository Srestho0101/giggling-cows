"use client";

import Link from "next/link";
import { useRouter } from "next/navigation";
import React, { useCallback, useMemo, useState } from "react";
import { useQuery, useQueryClient } from "@tanstack/react-query";
import { ConfirmActionModal, type ConfirmModalConfig } from "@/components/confirm-modal";
import { Notice } from "@/components/data-workbench";
import { SafeDataHistory } from "@/components/safe-data-history";
import {
  BreedingFormModal,
  CalvingDrawerModal,
  PregnancyCheckModal,
} from "@/components/breeding/breeding-drawers";
import { Badge, btn, StatTile, statusTone, Tabs, ui } from "@/components/ui";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
import {
  type BreedingActionQueueItem,
  type BreedingRecord,
  type BreedingSummary,
  type CowListOption,
  type PregnancyEpisode,
  type SireItem,
  type WarehouseOption,
} from "@/components/cow-profile/types";

export function BreedingWorkspaceView() {
  const { lang, tr, money, num, integer, date: fmtDate, enumLabel } = useI18n();
  const router = useRouter();
  const queryClient = useQueryClient();
  const [activeTab, setActiveTab] = useState("queue");
  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");

  const [breedingModalOpen, setBreedingModalOpen] = useState(false);
  const [breedingFixedCowId, setBreedingFixedCowId] = useState<string | undefined>(undefined);
  const [editingBreeding, setEditingBreeding] = useState<BreedingRecord | null>(null);

  const [checkModalOpen, setCheckModalOpen] = useState(false);
  const [checkFixedCowId, setCheckFixedCowId] = useState<string | undefined>(undefined);
  const [checkDefaultBreedingId, setCheckDefaultBreedingId] = useState<string | null>(null);

  const [calvingTarget, setCalvingTarget] = useState<{
    pregnancyId: string;
    damTag: string;
  } | null>(null);

  const [sireFormOpen, setSireFormOpen] = useState(false);
  const [bullName, setBullName] = useState("");
  const [semenCode, setSemenCode] = useState("");
  const [provider, setProvider] = useState("");
  const [sireBreed, setSireBreed] = useState("");
  const [sireSaving, setSireSaving] = useState(false);

  const [outcomeFilter, setOutcomeFilter] = useState("");
  const [confirmModal, setConfirmModal] = useState<ConfirmModalConfig | null>(null);

  const summaryQuery = useQuery({
    queryKey: ["breeding-summary"],
    queryFn: () => apiRequest<BreedingSummary>(apiRoutes.health.breedingSummary),
  });
  const breedingsQuery = useQuery({
    queryKey: ["breeding-records"],
    queryFn: () => apiRequest<BreedingRecord[]>(apiRoutes.health.breeding),
  });
  const pregnanciesQuery = useQuery({
    queryKey: ["breeding-pregnancies"],
    queryFn: () => apiRequest<PregnancyEpisode[]>(apiRoutes.health.pregnancies),
  });
  const siresQuery = useQuery({
    queryKey: ["sires"],
    queryFn: () => apiRequest<SireItem[]>(apiRoutes.health.sires),
  });
  const cowsQuery = useQuery({
    queryKey: ["cows-options"],
    queryFn: () => apiRequest<CowListOption[]>(apiRoutes.herd.cows),
    staleTime: 60_000,
  });
  const warehousesQuery = useQuery({
    queryKey: ["warehouses"],
    queryFn: () => apiRequest<WarehouseOption[]>(apiRoutes.herd.warehouses),
    staleTime: 60_000,
  });

  const reloadAll = useCallback(async () => {
    await Promise.all([
      queryClient.invalidateQueries({ queryKey: ["breeding-summary"] }),
      queryClient.invalidateQueries({ queryKey: ["breeding-records"] }),
      queryClient.invalidateQueries({ queryKey: ["breeding-pregnancies"] }),
      queryClient.invalidateQueries({ queryKey: ["sires"] }),
      queryClient.invalidateQueries({ queryKey: ["dashboard"] }),
      queryClient.invalidateQueries({ queryKey: ["herd-cows"] }),
    ]);
  }, [queryClient]);

  const summary = summaryQuery.data;
  const breedings = useMemo(() => breedingsQuery.data ?? [], [breedingsQuery.data]);
  const pregnancies = useMemo(() => pregnanciesQuery.data ?? [], [pregnanciesQuery.data]);
  const sires = useMemo(() => siresQuery.data ?? [], [siresQuery.data]);
  const cows = cowsQuery.data ?? [];
  const warehouses = warehousesQuery.data ?? [];

  const filteredBreedings = useMemo(
    () => (outcomeFilter ? breedings.filter((b) => b.outcome === outcomeFilter) : breedings),
    [breedings, outcomeFilter]
  );

  const activePregnancies = useMemo(
    () => pregnancies.filter((p) => p.status === "confirmed" || p.status === "suspected"),
    [pregnancies]
  );

  async function handleCreateExternalSire(e: React.FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setSireSaving(true);
    setError("");
    setNotice("");
    try {
      await apiRequest(apiRoutes.health.sires, {
        method: "POST",
        body: {
          source_type: "external_semen",
          bull_name: bullName.trim() || null,
          semen_code: semenCode.trim() || null,
          provider: provider.trim() || null,
          breed: sireBreed.trim() || null,
        },
      });
      setBullName("");
      setSemenCode("");
      setProvider("");
      setSireBreed("");
      setSireFormOpen(false);
      setNotice(tr("External AI sire added to registry.", "বাইরের এআই সিমেন তালিকায় যোগ করা হয়েছে।"));
      await reloadAll();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : tr("Could not save sire.", "ষাঁড়/সিমেনের তথ্য সংরক্ষণ করা যায়নি।"));
    } finally {
      setSireSaving(false);
    }
  }

  function formatQueueDetail(item: BreedingActionQueueItem): string {
    if (lang !== "bn") return item.detail;
    const days = integer(Math.abs(item.days_value));
    if (item.bucket === "due_for_check") {
      return `${days} দিন আগে প্রজনন হয়েছে — গর্ভধারণ পরীক্ষা প্রয়োজন`;
    }
    if (item.bucket === "due_for_dry_off") {
      return item.days_value < 0
        ? `দুধ শুকানোর তারিখ ${days} দিন পার হয়েছে`
        : `${days} দিন পর দুধ শুকানোর সময়`;
    }
    if (item.bucket === "calving_due") {
      return item.days_value < 0
        ? `প্রসবের সম্ভাব্য তারিখ ${days} দিন পার হয়েছে`
        : `${days} দিন পর প্রসবের সময়`;
    }
    if (item.bucket === "open_over_90_days") {
      return `${days} দিন ধরে গর্ভধারণ ছাড়াই খালি রয়েছে`;
    }
    return item.detail;
  }

  function renderQueueBucket(
    title: string,
    subtitle: string,
    items: BreedingActionQueueItem[],
    actionLabel: string,
    onAction: (item: BreedingActionQueueItem) => void
  ) {
    return (
      <section className="rounded-[8px] border border-line bg-surface p-4 space-y-2.5">
        <div className="flex items-center justify-between gap-2">
          <div>
            <h3 className="text-[13.5px] font-semibold text-ink">
              {title} ({integer(items.length)})
            </h3>
            <p className="text-[12px] text-muted">{subtitle}</p>
          </div>
        </div>
        {items.length === 0 ? (
          <p className="text-[12.5px] text-muted py-2">{tr("Nothing due right now.", "এই মুহূর্তে কোনো কাজ বাকি নেই।")}</p>
        ) : (
          <div className="divide-y divide-line">
            {items.map((item) => (
              <div key={`${item.bucket}-${item.cow_id}`} className="flex flex-wrap items-center justify-between gap-2 py-2 text-[13px]">
                <div>
                  <Link href={`/herd/${item.cow_id}`} className="font-semibold text-accent hover:underline">
                    {tr("Cow")} {item.cow_tag_number}
                  </Link>
                  <span className="ml-2 text-muted">{formatQueueDetail(item)}</span>
                </div>
                <button
                  type="button"
                  onClick={() => onAction(item)}
                  className={btn("secondary", "sm")}
                >
                  {actionLabel}
                </button>
              </div>
            ))}
          </div>
        )}
      </section>
    );
  }

  const queueTotal =
    (summary?.due_for_check.length ?? 0) +
    (summary?.due_for_dry_off.length ?? 0) +
    (summary?.calving_due.length ?? 0) +
    (summary?.open_over_90_days.length ?? 0);

  return (
    <div className="space-y-5">
      {error ? <Notice>{error}</Notice> : null}
      {notice ? <Notice tone="success">{notice}</Notice> : null}

      {/* Top 3 Herd KPIs */}
      <div className="grid gap-3 sm:grid-cols-3">
        <StatTile
          label={tr("Conception rate", "গর্ভধারণের হার")}
          value={summary?.conception_rate_pct != null ? `${num(summary.conception_rate_pct, 1)}%` : "—"}
          subtext={tr("Successful vs resolved breedings", "সফল বনাম নিষ্পত্তিকৃত প্রজনন")}
        />
        <StatTile
          label={tr("Avg services / conception", "গড় প্রজনন প্রচেষ্টা")}
          value={summary?.avg_services_per_conception != null ? num(summary.avg_services_per_conception, 2) : "—"}
          subtext={tr("Lower is better", "সংখ্যা কম হওয়া ভালো")}
        />
        <StatTile
          label={tr("Active pregnant cows", "বর্তমান গর্ভবতী গরু")}
          value={integer(summary?.active_pregnant_count ?? activePregnancies.length)}
          subtext={tr("Confirmed & suspected episodes", "নিশ্চিত ও সম্ভাব্য গর্ভধারণ")}
        />
      </div>

      {/* Primary Action Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3">
        <Tabs
          active={activeTab}
          onChange={setActiveTab}
          items={[
            { key: "queue", label: `${tr("Action queue", "করণীয় তালিকা")} (${integer(queueTotal)})` },
            { key: "breedings", label: `${tr("Breeding log", "প্রজনন লগ")} (${integer(breedings.length)})` },
            { key: "pregnancies", label: `${tr("Active pregnancies", "সক্রিয় গর্ভধারণ")} (${integer(activePregnancies.length)})` },
            { key: "sires", label: `${tr("Sire registry", "ষাঁড় ও সিমেন তালিকা")} (${integer(sires.length)})` },
          ]}
        />
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => {
              setEditingBreeding(null);
              setBreedingFixedCowId(undefined);
              setBreedingModalOpen(true);
            }}
            className={btn("primary", "sm")}
          >
            {tr("+ Log breeding", "+ প্রজনন লিখুন")}
          </button>
          <button
            type="button"
            onClick={() => {
              setCheckFixedCowId(undefined);
              setCheckDefaultBreedingId(null);
              setCheckModalOpen(true);
            }}
            className={btn("secondary", "sm")}
          >
            {tr("+ Log check", "+ পরীক্ষা লিখুন")}
          </button>
        </div>
      </div>

      {activeTab === "queue" ? (
        <div className="grid gap-4 lg:grid-cols-2">
          {renderQueueBucket(
            tr("Due for pregnancy check", "গর্ভধারণ পরীক্ষার সময় হয়েছে"),
            tr("Pending services 28+ days ago with no active pregnancy.", "২৮+ দিন আগে প্রজনন হয়েছে কিন্তু এখনও পরীক্ষা হয়নি।"),
            summary?.due_for_check ?? [],
            tr("Log check", "পরীক্ষা লিখুন"),
            (item) => {
              setCheckFixedCowId(item.cow_id);
              setCheckDefaultBreedingId(item.breeding_id ?? null);
              setCheckModalOpen(true);
            }
          )}
          {renderQueueBucket(
            tr("Calving due (<14d)", "আসন্ন প্রসব (১৪ দিনের মধ্যে)"),
            tr("Confirmed or suspected pregnancies nearing due date.", "প্রসবের সম্ভাব্য তারিখ কাছাকাছি এসেছে।"),
            summary?.calving_due ?? [],
            tr("Record calving", "বাচ্চা প্রসব লিখুন"),
            (item) => {
              if (item.pregnancy_id) {
                setCalvingTarget({ pregnancyId: item.pregnancy_id, damTag: item.cow_tag_number });
              }
            }
          )}
          {renderQueueBucket(
            tr("Due for dry-off", "দুধ শুকানোর সময়"),
            tr("Confirmed pregnancies approaching 60 days pre-calving.", "প্রসবের ৬০ দিন আগে দুধ দোহন বন্ধ করার সময় হয়েছে।"),
            summary?.due_for_dry_off ?? [],
            tr("View cow", "গরু দেখুন"),
            (item) => {
              router.push(`/herd/${item.cow_id}`);
            }
          )}
          {renderQueueBucket(
            tr("Open > 90 days", "৯০+ দিন ধরে খালি"),
            tr("Adult females past VWP with no active pregnancy for 90+ days.", "৯০ দিনের বেশি সময় ধরে গর্ভধারণ ছাড়াই খালি থাকা গাভী।"),
            summary?.open_over_90_days ?? [],
            tr("Log breeding", "প্রজনন লিখুন"),
            (item) => {
              setEditingBreeding(null);
              setBreedingFixedCowId(item.cow_id);
              setBreedingModalOpen(true);
            }
          )}
        </div>
      ) : null}

      {activeTab === "breedings" ? (
        <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-[14px] font-semibold text-ink">{tr("Breeding log", "প্রজনন লগ")}</h3>
            <select
              value={outcomeFilter}
              onChange={(e) => setOutcomeFilter(e.target.value)}
              className={`${ui.select} w-44`}
            >
              <option value="">{tr("All outcomes", "সকল ফলাফল")}</option>
              <option value="pending">{enumLabel("pending")}</option>
              <option value="successful">{enumLabel("successful")}</option>
              <option value="failed">{enumLabel("failed")}</option>
            </select>
          </div>
          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11.5px] text-muted">
                <tr>
                  <th className="py-2 pr-3">{tr("Cow")}</th>
                  <th className="py-2 pr-3">{tr("Insemination")}</th>
                  <th className="py-2 pr-3">{tr("Method")}</th>
                  <th className="py-2 pr-3">{tr("Sire / Semen", "ষাঁড় / সিমেন")}</th>
                  <th className="py-2 pr-3">{tr("Doctor")}</th>
                  <th className="py-2 pr-3 text-right">{tr("Cost", "খরচ")}</th>
                  <th className="py-2 pr-3">{tr("Outcome")}</th>
                  <th className="py-2 text-right">{tr("Actions")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {filteredBreedings.map((br) => (
                  <tr key={br.breeding_id} className="hover:bg-wash">
                    <td className="py-2 pr-3 font-medium">
                      <Link href={`/herd/${br.cow_id}`} className="text-accent hover:underline">
                        {br.cow_tag_number ?? br.cow_id}
                      </Link>
                    </td>
                    <td className="py-2 pr-3">{fmtDate(br.seed_date)}</td>
                    <td className="py-2 pr-3">{enumLabel(br.method)}</td>
                    <td className="py-2 pr-3">{br.sire_display_name || br.sire_tag_number || br.semen_code || "—"}</td>
                    <td className="py-2 pr-3">{br.doctor_name || "—"}</td>
                    <td className="py-2 pr-3 text-right tabular-nums">{money(br.cost)}</td>
                    <td className="py-2 pr-3">
                      <Badge tone={statusTone(br.outcome)}>
                        <span>{enumLabel(br.outcome)}</span>
                      </Badge>
                    </td>
                    <td className="py-2 text-right">
                      <div className="inline-flex items-center gap-2 text-[12px]">
                        <button
                          type="button"
                          onClick={() => {
                            setEditingBreeding(br);
                            setBreedingFixedCowId(br.cow_id);
                            setBreedingModalOpen(true);
                          }}
                          className="font-medium text-accent hover:underline"
                        >
                          {tr("Edit")}
                        </button>
                        <button
                          type="button"
                          onClick={() =>
                            setConfirmModal({
                              title: tr("Archive breeding record?", "প্রজনন রেকর্ড আর্কাইভ করবেন?"),
                              mode: "confirm",
                              confirmLabel: tr("Archive"),
                              tone: "danger",
                              onConfirm: async () => {
                                await apiRequest(apiRoutes.health.breedingRecord(br.breeding_id), {
                                  method: "PATCH",
                                  body: { is_archived: true },
                                });
                                setNotice(tr("Breeding record archived.", "প্রজনন রেকর্ড আর্কাইভ করা হয়েছে।"));
                                await reloadAll();
                              },
                            })
                          }
                          className="font-medium text-muted hover:underline"
                        >
                          {tr("Archive")}
                        </button>
                        <SafeDataHistory entityType="breeding_records" entityId={br.breeding_id} entityLabel={`${tr("Breeding")} ${fmtDate(br.seed_date)}`} />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      {activeTab === "pregnancies" ? (
        <section className="rounded-[8px] border border-line bg-surface p-4 space-y-3">
          <h3 className="text-[14px] font-semibold text-ink">{tr("Active pregnancies", "সক্রিয় গর্ভধারণ")}</h3>
          {activePregnancies.length === 0 ? (
            <p className="text-[13px] text-muted">{tr("No active pregnancies.", "কোনো সক্রিয় গর্ভধারণের তথ্য নেই।")}</p>
          ) : (
            <div className="divide-y divide-line">
              {activePregnancies.map((ep) => (
                <div key={ep.pregnancy_id} className="flex flex-wrap items-center justify-between gap-3 py-3 text-[13px]">
                  <div>
                    <Link href={`/herd/${ep.cow_id}`} className="font-semibold text-accent hover:underline">
                      {tr("Cow")} {ep.cow_tag_number}
                    </Link>
                    <span className="ml-2">
                      <Badge tone={statusTone(ep.status)}>
                        <span>{enumLabel(ep.status)}</span>
                      </Badge>
                    </span>
                    <p className="mt-0.5 text-[12px] text-muted">
                      {ep.sire_display_name ? `${tr("Sire")}: ${ep.sire_display_name} · ` : ""}
                      {tr("Expected calving:")} {fmtDate(ep.expected_calving_date)}
                      {ep.dry_off_date ? ` · ${tr("Dry-off:", "দুধ শুকানোর তারিখ:")} ${fmtDate(ep.dry_off_date)}` : ""}
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() =>
                        setCalvingTarget({
                          pregnancyId: ep.pregnancy_id,
                          damTag: ep.cow_tag_number ?? tr("Cow"),
                        })
                      }
                      className={btn("primary", "sm")}
                    >
                      {tr("Record calving", "বাচ্চা প্রসব লিখুন")}
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setCheckFixedCowId(ep.cow_id);
                        setCheckDefaultBreedingId(ep.breeding_id ?? null);
                        setCheckModalOpen(true);
                      }}
                      className={btn("secondary", "sm")}
                    >
                      {tr("Log check", "পরীক্ষা লিখুন")}
                    </button>
                  </div>
                </div>
              ))}
            </div>
          )}
        </section>
      ) : null}

      {activeTab === "sires" ? (
        <section className="rounded-[8px] border border-line bg-surface p-4 space-y-4">
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <h3 className="text-[14px] font-semibold text-ink">{tr("Sire registry", "ষাঁড় ও সিমেন তালিকা")}</h3>
              <p className="text-[12px] text-muted">{tr("On-farm bulls and external AI semen straws.", "খামারের ষাঁড় এবং বাইরের কৃত্রিম প্রজননের সিমেন।")}</p>
            </div>
            <button type="button" onClick={() => setSireFormOpen((v) => !v)} className={btn("secondary", "sm")}>
              {sireFormOpen ? tr("Close") : tr("+ Add external AI sire", "+ বাইরের সিমেন যোগ করুন")}
            </button>
          </div>

          {sireFormOpen ? (
            <form onSubmit={(e) => void handleCreateExternalSire(e)} className="grid gap-3 rounded-[6px] border border-line bg-subtle p-3.5 sm:grid-cols-4">
              <label className={ui.label}>
                {tr("Bull name", "ষাঁড়ের নাম")}
                <input value={bullName} onChange={(e) => setBullName(e.target.value)} placeholder={tr("e.g. Raja HF-22", "যেমন: রাজা HF-22")} className={ui.input} />
              </label>
              <label className={ui.label}>
                {tr("Semen code")} *
                <input required value={semenCode} onChange={(e) => setSemenCode(e.target.value)} placeholder="e.g. HF-2026-220" className={ui.input} />
              </label>
              <label className={ui.label}>
                {tr("Provider", "সরবরাহকারী")}
                <input value={provider} onChange={(e) => setProvider(e.target.value)} placeholder={tr("e.g. BRAC / DLS", "যেমন: ব্র্যাক / প্রাণিসম্পদ")} className={ui.input} />
              </label>
              <label className={ui.label}>
                {tr("Breed")}
                <input value={sireBreed} onChange={(e) => setSireBreed(e.target.value)} placeholder={tr("e.g. Friesian", "যেমন: ফ্রিজিয়ান")} className={ui.input} />
              </label>
              <div className="sm:col-span-4 flex justify-end">
                <button type="submit" disabled={sireSaving} className={btn("primary", "sm")}>
                  {sireSaving ? tr("Saving…") : tr("Save AI sire", "সিমেন সংরক্ষণ করুন")}
                </button>
              </div>
            </form>
          ) : null}

          <div className="overflow-x-auto">
            <table className="w-full text-left text-[13px]">
              <thead className="border-b border-line text-[11.5px] text-muted">
                <tr>
                  <th className="py-2 pr-3">{tr("Sire")}</th>
                  <th className="py-2 pr-3">{tr("Type")}</th>
                  <th className="py-2 pr-3">{tr("Semen code")}</th>
                  <th className="py-2 pr-3">{tr("Provider", "সরবরাহকারী")}</th>
                  <th className="py-2 pr-3">{tr("Breed")}</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-line">
                {sires.map((s) => (
                  <tr key={s.sire_id}>
                    <td className="py-2 pr-3 font-medium text-ink">
                      {s.cow_id ? (
                        <Link href={`/herd/${s.cow_id}`} className="text-accent hover:underline">
                          {s.display_name || s.cow_tag_number}
                        </Link>
                      ) : (
                        s.display_name || s.bull_name || s.semen_code
                      )}
                    </td>
                    <td className="py-2 pr-3">{enumLabel(s.source_type)}</td>
                    <td className="py-2 pr-3">{s.semen_code || "—"}</td>
                    <td className="py-2 pr-3">{s.provider || "—"}</td>
                    <td className="py-2 pr-3">{s.breed ? enumLabel(s.breed) : "—"}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>
      ) : null}

      <BreedingFormModal
        key={`ws-bf-${breedingFixedCowId ?? "any"}-${editingBreeding?.breeding_id ?? "new"}-${breedingModalOpen}`}
        open={breedingModalOpen}
        onClose={() => {
          setBreedingModalOpen(false);
          setEditingBreeding(null);
        }}
        onSaved={reloadAll}
        onError={setError}
        onNotice={setNotice}
        fixedCowId={breedingFixedCowId}
        cows={cows}
        sires={sires}
        initialRecord={editingBreeding}
      />

      <PregnancyCheckModal
        key={`ws-pc-${checkFixedCowId ?? "any"}-${checkDefaultBreedingId ?? "none"}-${checkModalOpen}`}
        open={checkModalOpen}
        onClose={() => setCheckModalOpen(false)}
        onSaved={reloadAll}
        onError={setError}
        onNotice={setNotice}
        fixedCowId={checkFixedCowId}
        cows={cows}
        breedingRecords={breedings}
        defaultBreedingId={checkDefaultBreedingId}
      />

      <CalvingDrawerModal
        key={`ws-calv-${calvingTarget?.pregnancyId ?? "closed"}`}
        open={Boolean(calvingTarget)}
        onClose={() => setCalvingTarget(null)}
        onSaved={reloadAll}
        onError={setError}
        onNotice={setNotice}
        pregnancyId={calvingTarget?.pregnancyId ?? ""}
        damTag={calvingTarget?.damTag ?? ""}
        warehouses={warehouses}
      />

      <ConfirmActionModal config={confirmModal} onClose={() => setConfirmModal(null)} />
    </div>
  );
}
