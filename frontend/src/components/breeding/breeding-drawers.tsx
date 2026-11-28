"use client";

import React, { useMemo, useState } from "react";
import { btn, Segmented, ui } from "@/components/ui";
import { shiftIsoDate, todayInDhaka } from "@/components/workspace-date";
import { apiRequest, apiRoutes } from "@/lib/api";
import type {
  BreedingRecord,
  CowListOption,
  PregnancyReport,
  SireItem,
  WarehouseOption,
} from "@/components/cow-profile/types";

type BreedingFormModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
  fixedCowId?: string;
  cows?: CowListOption[];
  sires: SireItem[];
  initialRecord?: BreedingRecord | null;
  relatedSireIds?: string[];
  relatedSireCowIds?: string[];
};

export function BreedingFormModal({
  open,
  onClose,
  onSaved,
  onError,
  onNotice,
  fixedCowId,
  cows = [],
  sires,
  initialRecord = null,
  relatedSireIds = [],
  relatedSireCowIds = [],
}: BreedingFormModalProps) {
  const today = todayInDhaka();
  const isEdit = Boolean(initialRecord);
  const [cowId, setCowId] = useState(initialRecord?.cow_id ?? fixedCowId ?? "");
  const [heatDate, setHeatDate] = useState(initialRecord?.heat_date ?? "");
  const [seedDate, setSeedDate] = useState(initialRecord?.seed_date ?? today);
  const [method, setMethod] = useState(initialRecord?.method ?? "artificial_insemination");
  const [sourceMode, setSourceMode] = useState<"registry" | "new_semen">(
    initialRecord?.sire_registry_id || initialRecord?.sire_id ? "registry" : initialRecord?.semen_code ? "new_semen" : "registry"
  );
  const [sireRegistryId, setSireRegistryId] = useState(initialRecord?.sire_registry_id ?? "");
  const [semenCode, setSemenCode] = useState(initialRecord?.semen_code ?? "");
  const [semenProvider, setSemenProvider] = useState(initialRecord?.semen_provider ?? "");
  const [doctorName, setDoctorName] = useState(initialRecord?.doctor_name ?? "");
  const [cost, setCost] = useState(initialRecord?.cost != null ? String(initialRecord.cost) : "");
  const [outcome, setOutcome] = useState(initialRecord?.outcome ?? "pending");
  const [notes, setNotes] = useState(initialRecord?.notes ?? "");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const femaleCows = useMemo(
    () => cows.filter((c) => c.sex === "female" && c.status === "active"),
    [cows]
  );

  const selectedSire = useMemo(
    () => sires.find((s) => s.sire_id === sireRegistryId) ?? null,
    [sires, sireRegistryId]
  );

  const inbreedingWarning = useMemo(() => {
    if (!selectedSire) return false;
    if (relatedSireIds.includes(selectedSire.sire_id)) return true;
    if (selectedSire.cow_id && relatedSireCowIds.includes(selectedSire.cow_id)) return true;
    return false;
  }, [selectedSire, relatedSireIds, relatedSireCowIds]);

  if (!open) return null;

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const targetCowId = fixedCowId || cowId;
    if (!targetCowId) {
      setFormError("Please select a cow.");
      return;
    }
    if (heatDate && seedDate && seedDate < heatDate) {
      setFormError("Insemination date cannot be earlier than heat date.");
      return;
    }
    if (sourceMode === "registry" && !sireRegistryId) {
      setFormError("Please select a sire from the registry or switch to New AI semen.");
      return;
    }
    if (sourceMode === "new_semen" && !semenCode.trim()) {
      setFormError("Please enter a semen code.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        heat_date: heatDate || null,
        seed_date: seedDate,
        method,
        doctor_name: doctorName.trim() || null,
        cost: cost !== "" ? Number(cost) : 0,
        outcome,
        notes: notes.trim() || null,
      };
      if (!isEdit) body.cow_id = targetCowId;

      if (sourceMode === "registry" && selectedSire) {
        body.sire_registry_id = selectedSire.sire_id;
        body.sire_id = selectedSire.source_type === "on_farm" ? selectedSire.cow_id : null;
        body.semen_code = selectedSire.source_type === "external_semen" ? selectedSire.semen_code : null;
        body.semen_provider = selectedSire.source_type === "external_semen" ? selectedSire.provider : null;
      } else {
        body.sire_registry_id = null;
        body.sire_id = null;
        body.semen_code = semenCode.trim();
        body.semen_provider = semenProvider.trim() || null;
      }

      if (isEdit && initialRecord) {
        await apiRequest(apiRoutes.health.breedingRecord(initialRecord.breeding_id), {
          method: "PATCH",
          body,
        });
        onNotice("Breeding record updated.");
      } else {
        await apiRequest(apiRoutes.health.breeding, {
          method: "POST",
          body,
        });
        onNotice("Breeding record saved.");
      }
      await onSaved();
      onClose();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Could not save breeding record.";
      setFormError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-xl max-h-[90vh] overflow-y-auto rounded-[10px] border border-line bg-surface p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <h3 className="text-[15px] font-semibold text-ink">
            {isEdit ? "Edit breeding record" : "Log breeding"}
          </h3>
          <button type="button" onClick={onClose} className={btn("quiet", "sm")}>
            Cancel
          </button>
        </div>

        {formError ? (
          <p className="rounded-[6px] border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {formError}
          </p>
        ) : null}

        {inbreedingWarning ? (
          <p className="rounded-[6px] border border-warn/40 bg-warn/10 px-3 py-2 text-[12.5px] text-warn">
            Inbreeding warning: the selected sire matches this cow&apos;s own sire or grand-sire.
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {!fixedCowId && !isEdit ? (
            <label className={`${ui.label} sm:col-span-2`}>
              Cow *
              <select required value={cowId} onChange={(e) => setCowId(e.target.value)} className={ui.select}>
                <option value="">Choose female cow</option>
                {femaleCows.map((c) => (
                  <option key={c.cow_id} value={c.cow_id}>
                    {c.current_tag_number}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={ui.label}>
            Heat date
            <input type="date" value={heatDate} onChange={(e) => setHeatDate(e.target.value)} className={ui.input} />
          </label>
          <label className={ui.label}>
            Insemination date *
            <input type="date" required value={seedDate} onChange={(e) => setSeedDate(e.target.value)} className={ui.input} />
          </label>

          <label className={ui.label}>
            Method *
            <select value={method} onChange={(e) => setMethod(e.target.value)} className={ui.select}>
              <option value="artificial_insemination">Artificial insemination</option>
              <option value="natural">Natural</option>
            </select>
          </label>
          <label className={ui.label}>
            Outcome
            <select value={outcome} onChange={(e) => setOutcome(e.target.value)} className={ui.select}>
              <option value="pending">Pending</option>
              <option value="successful">Successful</option>
              <option value="failed">Failed</option>
            </select>
          </label>

          <div className="sm:col-span-2">
            <span className="mb-1.5 block text-[12px] font-medium text-muted">Sire / Semen source</span>
            <Segmented
              name="breeding_source_mode"
              size="sm"
              value={sourceMode}
              onChange={setSourceMode}
              options={[
                { value: "registry", label: "Sire registry (On-farm / AI)" },
                { value: "new_semen", label: "New AI semen straw" },
              ]}
            />
          </div>

          {sourceMode === "registry" ? (
            <label className={`${ui.label} sm:col-span-2`}>
              Sire *
              <select
                required
                value={sireRegistryId}
                onChange={(e) => setSireRegistryId(e.target.value)}
                className={ui.select}
              >
                <option value="">Choose sire</option>
                {sires.filter((s) => !s.is_archived).map((s) => (
                  <option key={s.sire_id} value={s.sire_id}>
                    {s.display_name || s.semen_code || s.bull_name || "Sire"} ({s.source_type === "on_farm" ? "On-farm" : "External AI"})
                  </option>
                ))}
              </select>
            </label>
          ) : (
            <>
              <label className={ui.label}>
                Semen code *
                <input
                  required
                  value={semenCode}
                  onChange={(e) => setSemenCode(e.target.value)}
                  placeholder="e.g. HF-2026-220"
                  className={ui.input}
                />
              </label>
              <label className={ui.label}>
                Semen provider
                <input
                  value={semenProvider}
                  onChange={(e) => setSemenProvider(e.target.value)}
                  placeholder="e.g. BRAC, DLS, American Dairy"
                  className={ui.input}
                />
              </label>
            </>
          )}

          <label className={ui.label}>
            Doctor / Technician
            <input value={doctorName} onChange={(e) => setDoctorName(e.target.value)} className={ui.input} />
          </label>
          <label className={ui.label}>
            Cost (৳)
            <input type="number" min="0" step="0.01" value={cost} onChange={(e) => setCost(e.target.value)} className={ui.input} />
          </label>
          <label className={`${ui.label} sm:col-span-2`}>
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={ui.textarea} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btn("secondary", "sm")}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btn("primary", "sm")}>
            {saving ? "Saving…" : isEdit ? "Update breeding" : "Save breeding"}
          </button>
        </div>
      </form>
    </div>
  );
}

type PregnancyCheckModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
  fixedCowId?: string;
  cows?: CowListOption[];
  breedingRecords: BreedingRecord[];
  initialReport?: PregnancyReport | null;
  defaultBreedingId?: string | null;
};

export function PregnancyCheckModal({
  open,
  onClose,
  onSaved,
  onError,
  onNotice,
  fixedCowId,
  cows = [],
  breedingRecords,
  initialReport = null,
  defaultBreedingId = null,
}: PregnancyCheckModalProps) {
  const today = todayInDhaka();
  const isEdit = Boolean(initialReport);
  const [cowId, setCowId] = useState(initialReport?.cow_id ?? fixedCowId ?? "");
  const [reportDate, setReportDate] = useState(initialReport?.report_date ?? today);
  const [status, setStatus] = useState(initialReport?.status ?? "confirmed");

  const activeCowId = fixedCowId || cowId;
  const cowBreedings = useMemo(
    () =>
      breedingRecords
        .filter((b) => !b.is_archived && (!activeCowId || b.cow_id === activeCowId))
        .slice()
        .sort((a, b) => b.seed_date.localeCompare(a.seed_date)),
    [breedingRecords, activeCowId]
  );

  const [breedingId, setBreedingId] = useState<string>(() => {
    if (initialReport?.breeding_id) return initialReport.breeding_id;
    if (defaultBreedingId) return defaultBreedingId;
    const plausible = cowBreedings.find((b) => b.outcome === "pending") ?? cowBreedings[0];
    return plausible?.breeding_id ?? "";
  });

  const [expectedCalving, setExpectedCalving] = useState<string>(() => {
    if (initialReport?.expected_calving_date) return initialReport.expected_calving_date;
    const matched = cowBreedings.find((b) => b.breeding_id === (defaultBreedingId || cowBreedings[0]?.breeding_id));
    return matched ? shiftIsoDate(matched.seed_date, 283) : "";
  });

  const [notes, setNotes] = useState(initialReport?.notes ?? "");
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  const femaleCows = useMemo(
    () => cows.filter((c) => c.sex === "female" && c.status === "active"),
    [cows]
  );

  if (!open) return null;

  function handleBreedingChange(nextId: string) {
    setBreedingId(nextId);
    const br = cowBreedings.find((b) => b.breeding_id === nextId);
    if (br && (status === "confirmed" || status === "suspected") && !expectedCalving) {
      setExpectedCalving(shiftIsoDate(br.seed_date, 283));
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    const targetCowId = fixedCowId || cowId;
    if (!targetCowId) {
      setFormError("Please select a cow.");
      return;
    }
    if (
      reportDate &&
      expectedCalving &&
      (status === "confirmed" || status === "suspected") &&
      expectedCalving < reportDate
    ) {
      setFormError("Expected calving date cannot be earlier than check date.");
      return;
    }

    setSaving(true);
    try {
      const body: Record<string, unknown> = {
        breeding_id: breedingId || null,
        report_date: reportDate,
        status,
        expected_calving_date: expectedCalving || null,
        notes: notes.trim() || null,
      };
      if (!isEdit) body.cow_id = targetCowId;

      if (isEdit && initialReport) {
        await apiRequest(apiRoutes.health.pregnancyReport(initialReport.pregnancy_id), {
          method: "PATCH",
          body,
        });
        onNotice("Pregnancy check updated.");
      } else {
        await apiRequest(apiRoutes.health.pregnancy, {
          method: "POST",
          body,
        });
        onNotice("Pregnancy check saved.");
      }
      await onSaved();
      onClose();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Could not save pregnancy check.";
      setFormError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-lg rounded-[10px] border border-line bg-surface p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <h3 className="text-[15px] font-semibold text-ink">
            {isEdit ? "Edit pregnancy check" : "Log pregnancy check"}
          </h3>
          <button type="button" onClick={onClose} className={btn("quiet", "sm")}>
            Cancel
          </button>
        </div>

        {formError ? (
          <p className="rounded-[6px] border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {formError}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-2">
          {!fixedCowId && !isEdit ? (
            <label className={`${ui.label} sm:col-span-2`}>
              Cow *
              <select required value={cowId} onChange={(e) => setCowId(e.target.value)} className={ui.select}>
                <option value="">Choose female cow</option>
                {femaleCows.map((c) => (
                  <option key={c.cow_id} value={c.cow_id}>
                    {c.current_tag_number}
                  </option>
                ))}
              </select>
            </label>
          ) : null}

          <label className={ui.label}>
            Check date *
            <input type="date" required value={reportDate} onChange={(e) => setReportDate(e.target.value)} className={ui.input} />
          </label>
          <label className={ui.label}>
            Result *
            <select value={status} onChange={(e) => setStatus(e.target.value)} className={ui.select}>
              <option value="confirmed">Confirmed</option>
              <option value="suspected">Suspected</option>
              <option value="failed">Not pregnant / failed</option>
              <option value="aborted">Aborted</option>
            </select>
          </label>

          <label className={`${ui.label} sm:col-span-2`}>
            Linked breeding attempt
            <select value={breedingId} onChange={(e) => handleBreedingChange(e.target.value)} className={ui.select}>
              <option value="">None (e.g. bought already pregnant)</option>
              {cowBreedings.map((b) => (
                <option key={b.breeding_id} value={b.breeding_id}>
                  {b.seed_date} · {b.sire_display_name || b.semen_code || "Sire"} ({b.outcome})
                </option>
              ))}
            </select>
          </label>

          {(status === "confirmed" || status === "suspected") ? (
            <label className={`${ui.label} sm:col-span-2`}>
              Expected calving date (auto +283d from service)
              <input
                type="date"
                value={expectedCalving}
                onChange={(e) => setExpectedCalving(e.target.value)}
                className={ui.input}
              />
            </label>
          ) : null}

          <label className={`${ui.label} sm:col-span-2`}>
            Notes
            <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={ui.textarea} />
          </label>
        </div>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btn("secondary", "sm")}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btn("primary", "sm")}>
            {saving ? "Saving…" : isEdit ? "Update check" : "Save check"}
          </button>
        </div>
      </form>
    </div>
  );
}

type CalfDraft = {
  current_tag_number: string;
  sex: "female" | "male";
  category: string;
  breed: string;
  birth_weight_kg: string;
  warehouse_id: string;
};

type CalvingDrawerModalProps = {
  open: boolean;
  onClose: () => void;
  onSaved: () => Promise<void> | void;
  onError: (msg: string) => void;
  onNotice: (msg: string) => void;
  pregnancyId: string;
  damTag: string;
  warehouses: WarehouseOption[];
  defaultBreed?: string | null;
};

export function CalvingDrawerModal({
  open,
  onClose,
  onSaved,
  onError,
  onNotice,
  pregnancyId,
  damTag,
  warehouses,
  defaultBreed,
}: CalvingDrawerModalProps) {
  const today = todayInDhaka();
  const defaultWarehouseId = warehouses[0]?.warehouse_id ?? "";
  const [calvingDate, setCalvingDate] = useState(today);
  const [calvingEase, setCalvingEase] = useState<"normal" | "assisted" | "c_section">("normal");
  const [liveCount, setLiveCount] = useState(1);
  const [stillbornCount, setStillbornCount] = useState(0);
  const [notes, setNotes] = useState("");
  const [registerCalves, setRegisterCalves] = useState(true);
  const [calves, setCalves] = useState<CalfDraft[]>([
    {
      current_tag_number: "",
      sex: "female",
      category: "dairy",
      breed: defaultBreed || "deshi",
      birth_weight_kg: "",
      warehouse_id: defaultWarehouseId,
    },
  ]);
  const [formError, setFormError] = useState("");
  const [saving, setSaving] = useState(false);

  if (!open) return null;

  function syncLiveCount(nextCount: number) {
    const safe = Math.max(0, Math.min(4, nextCount));
    setLiveCount(safe);
    setCalves((prev) => {
      const next = prev.slice(0, safe);
      while (next.length < safe) {
        next.push({
          current_tag_number: "",
          sex: "female",
          category: "dairy",
          breed: defaultBreed || "deshi",
          birth_weight_kg: "",
          warehouse_id: defaultWarehouseId,
        });
      }
      return next;
    });
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setFormError("");
    if (liveCount === 0 && stillbornCount === 0) {
      setFormError("Record at least one live or stillborn calf.");
      return;
    }
    if (registerCalves && liveCount > 0) {
      for (let i = 0; i < calves.length; i += 1) {
        if (!calves[i].current_tag_number.trim()) {
          setFormError(`Please enter a tag for calf #${i + 1}.`);
          return;
        }
        if (!calves[i].warehouse_id) {
          setFormError(`Please select a shed for calf #${i + 1}.`);
          return;
        }
      }
    }

    setSaving(true);
    try {
      await apiRequest(apiRoutes.health.calve(pregnancyId), {
        method: "POST",
        body: {
          calving_date: calvingDate,
          calving_ease: calvingEase,
          live_count: liveCount,
          stillborn_count: stillbornCount,
          notes: notes.trim() || null,
          calves:
            registerCalves && liveCount > 0
              ? calves.map((c) => ({
                  current_tag_number: c.current_tag_number.trim(),
                  sex: c.sex,
                  category: c.category,
                  breed: c.breed || null,
                  birth_weight_kg: c.birth_weight_kg !== "" ? Number(c.birth_weight_kg) : null,
                  warehouse_id: c.warehouse_id,
                }))
              : [],
        },
      });
      onNotice("Calving recorded and newborn profile(s) linked.");
      await onSaved();
      onClose();
    } catch (cause) {
      const msg = cause instanceof Error ? cause.message : "Could not record calving.";
      setFormError(msg);
      onError(msg);
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <form
        onSubmit={(e) => void handleSubmit(e)}
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-2xl max-h-[90vh] overflow-y-auto rounded-[10px] border border-line bg-surface p-5 shadow-xl space-y-4"
      >
        <div className="flex items-center justify-between gap-2 border-b border-line pb-3">
          <div>
            <h3 className="text-[15px] font-semibold text-ink">Record calving — Cow {damTag}</h3>
            <p className="text-[12px] text-muted">
              Step 1: Calving event details · Step 2: Register newborn calf profile(s)
            </p>
          </div>
          <button type="button" onClick={onClose} className={btn("quiet", "sm")}>
            Cancel
          </button>
        </div>

        {formError ? (
          <p className="rounded-[6px] border border-danger/30 bg-danger/10 px-3 py-2 text-[12.5px] text-danger">
            {formError}
          </p>
        ) : null}

        <div className="grid gap-3 sm:grid-cols-4">
          <label className={ui.label}>
            Calving date *
            <input type="date" required max={today} value={calvingDate} onChange={(e) => setCalvingDate(e.target.value)} className={ui.input} />
          </label>
          <label className={ui.label}>
            Calving ease *
            <select
              value={calvingEase}
              onChange={(e) => setCalvingEase(e.target.value as "normal" | "assisted" | "c_section")}
              className={ui.select}
            >
              <option value="normal">Normal</option>
              <option value="assisted">Assisted</option>
              <option value="c_section">C-section</option>
            </select>
          </label>
          <label className={ui.label}>
            Live calves *
            <input
              type="number"
              min={0}
              max={4}
              value={liveCount}
              onChange={(e) => syncLiveCount(Number(e.target.value))}
              className={ui.input}
            />
          </label>
          <label className={ui.label}>
            Stillborn *
            <input
              type="number"
              min={0}
              max={4}
              value={stillbornCount}
              onChange={(e) => setStillbornCount(Math.max(0, Number(e.target.value)))}
              className={ui.input}
            />
          </label>
        </div>

        {liveCount > 0 ? (
          <div className="space-y-3 rounded-[8px] border border-line bg-subtle p-3.5">
            <div className="flex items-center justify-between gap-2">
              <span className="text-[12.5px] font-semibold text-ink">
                Newborn calf profiles ({liveCount})
              </span>
              <label className="flex items-center gap-2 text-[12px] text-ink">
                <input
                  type="checkbox"
                  checked={registerCalves}
                  onChange={(e) => setRegisterCalves(e.target.checked)}
                />
                Create cow profile(s) now
              </label>
            </div>
            {registerCalves ? (
              <div className="space-y-2.5">
                {calves.map((calf, idx) => (
                  <div key={idx} className="grid gap-2.5 rounded-[6px] border border-line bg-surface p-3 sm:grid-cols-5">
                    <label className={ui.label}>
                      Calf #{idx + 1} Tag *
                      <input
                        required
                        value={calf.current_tag_number}
                        onChange={(e) =>
                          setCalves((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, current_tag_number: e.target.value } : item))
                          )
                        }
                        placeholder="e.g. GC-C09"
                        className={ui.input}
                      />
                    </label>
                    <label className={ui.label}>
                      Sex *
                      <select
                        value={calf.sex}
                        onChange={(e) =>
                          setCalves((prev) =>
                            prev.map((item, i) =>
                              i === idx ? { ...item, sex: e.target.value as "female" | "male" } : item
                            )
                          )
                        }
                        className={ui.select}
                      >
                        <option value="female">Female</option>
                        <option value="male">Male</option>
                      </select>
                    </label>
                    <label className={ui.label}>
                      Breed
                      <select
                        value={calf.breed}
                        onChange={(e) =>
                          setCalves((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, breed: e.target.value } : item))
                          )
                        }
                        className={ui.select}
                      >
                        <option value="deshi">Deshi</option>
                        <option value="friesian">Friesian</option>
                        <option value="other">Other</option>
                      </select>
                    </label>
                    <label className={ui.label}>
                      Birth wt (kg)
                      <input
                        type="number"
                        min="1"
                        step="0.1"
                        value={calf.birth_weight_kg}
                        onChange={(e) =>
                          setCalves((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, birth_weight_kg: e.target.value } : item))
                          )
                        }
                        placeholder="e.g. 28"
                        className={ui.input}
                      />
                    </label>
                    <label className={ui.label}>
                      Shed *
                      <select
                        required
                        value={calf.warehouse_id}
                        onChange={(e) =>
                          setCalves((prev) =>
                            prev.map((item, i) => (i === idx ? { ...item, warehouse_id: e.target.value } : item))
                          )
                        }
                        className={ui.select}
                      >
                        <option value="">Select shed</option>
                        {warehouses.map((w) => (
                          <option key={w.warehouse_id} value={w.warehouse_id}>
                            {w.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>
                ))}
              </div>
            ) : null}
          </div>
        ) : null}

        <label className={ui.label}>
          Calving notes
          <textarea rows={2} value={notes} onChange={(e) => setNotes(e.target.value)} className={ui.textarea} />
        </label>

        <div className="flex justify-end gap-2 pt-1">
          <button type="button" onClick={onClose} className={btn("secondary", "sm")}>
            Cancel
          </button>
          <button type="submit" disabled={saving} className={btn("primary", "sm")}>
            {saving ? "Saving…" : "Confirm calving"}
          </button>
        </div>
      </form>
    </div>
  );
}
