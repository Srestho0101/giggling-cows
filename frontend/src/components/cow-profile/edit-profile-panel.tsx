"use client";

import React, { useState } from "react";
import { btn, ui } from "@/components/ui";
import { apiRequest, apiRoutes } from "@/lib/api";
import type {
  CowDetail,
  CowListOption,
  SupplierOption,
} from "@/components/cow-profile/types";

type EditProfilePanelProps = {
  cow: CowDetail;
  suppliers: SupplierOption[];
  cows: CowListOption[];
  onSaved: () => Promise<void>;
  onCancel: () => void;
  onError: (message: string) => void;
  onNotice: (message: string) => void;
};

export function EditProfilePanel({
  cow,
  suppliers,
  cows,
  onSaved,
  onCancel,
  onError,
  onNotice,
}: EditProfilePanelProps) {
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    current_tag_number: cow.current_tag_number,
    sex: cow.sex,
    category: cow.category,
    breed: cow.breed ?? "",
    birth_date: cow.birth_date ?? "",
    acquisition_type: cow.acquisition_type,
    acquisition_date: cow.acquisition_date,
    purchase_price: cow.purchase_price != null ? String(cow.purchase_price) : "",
    supplier_id: cow.supplier_id ?? "",
    dam_id: cow.dam_id ?? "",
    sire_id: cow.sire_id ?? "",
    notes: cow.notes ?? "",
  });

  const femaleCows = cows.filter((item) => item.cow_id !== cow.cow_id && item.sex === "female");
  const maleCows = cows.filter((item) => item.cow_id !== cow.cow_id && item.sex === "male");
  const isBornOnFarm = values.acquisition_type === "born_on_farm";

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setSaving(true);
    onError("");
    onNotice("");
    try {
      const body: Record<string, unknown> = {
        current_tag_number: values.current_tag_number.trim(),
        sex: values.sex,
        category: values.category.trim(),
        breed: values.breed || null,
        birth_date: values.birth_date || null,
        acquisition_type: values.acquisition_type,
        acquisition_date: values.acquisition_date,
        purchase_price: values.purchase_price !== "" ? Number(values.purchase_price) : null,
        notes: values.notes.trim() || null,
      };
      if (isBornOnFarm) {
        body.dam_id = values.dam_id || null;
        body.sire_id = values.sire_id || null;
      } else {
        body.supplier_id = values.supplier_id || null;
      }
      await apiRequest(apiRoutes.herd.cow(cow.cow_id), { method: "PATCH", body });
      onNotice("Cow profile updated.");
      await onSaved();
      onCancel();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : "Could not update cow profile.");
    } finally {
      setSaving(false);
    }
  }

  return (
    <form
      onSubmit={(event) => void handleSubmit(event)}
      className="rounded-[8px] border border-line bg-surface p-4 space-y-4"
    >
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-line pb-3">
        <div>
          <h3 className="text-[14px] font-semibold text-ink">Edit cow details</h3>
          <p className="text-[12px] text-muted">
            Changing the tag number here also closes the previous tag and appends a tag history entry.
          </p>
        </div>
        <button type="button" onClick={onCancel} className={btn("quiet", "sm")}>
          Cancel
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={ui.label}>
          Tag number *
          <input
            required
            maxLength={50}
            value={values.current_tag_number}
            onChange={(e) => setValues((c) => ({ ...c, current_tag_number: e.target.value }))}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          Sex *
          <select
            value={values.sex}
            onChange={(e) => setValues((c) => ({ ...c, sex: e.target.value as "male" | "female" }))}
            className={ui.select}
          >
            <option value="female">Female</option>
            <option value="male">Male</option>
          </select>
        </label>
        <label className={ui.label}>
          Category *
          <input
            required
            maxLength={50}
            value={values.category}
            onChange={(e) => setValues((c) => ({ ...c, category: e.target.value }))}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          Breed / calf type
          <select
            value={values.breed}
            onChange={(e) => setValues((c) => ({ ...c, breed: e.target.value }))}
            className={ui.select}
          >
            <option value="">Not specified</option>
            <option value="deshi">Deshi</option>
            <option value="friesian">Friesian</option>
            <option value="other">Other / unknown</option>
          </select>
        </label>
        <label className={ui.label}>
          Birth date
          <input
            type="date"
            value={values.birth_date}
            onChange={(e) => setValues((c) => ({ ...c, birth_date: e.target.value }))}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          Acquisition type *
          <select
            value={values.acquisition_type}
            onChange={(e) => {
              const nextType = e.target.value as CowDetail["acquisition_type"];
              setValues((c) => ({
                ...c,
                acquisition_type: nextType,
                supplier_id: nextType === "born_on_farm" ? "" : c.supplier_id,
                dam_id: nextType === "born_on_farm" ? c.dam_id : "",
                sire_id: nextType === "born_on_farm" ? c.sire_id : "",
              }));
            }}
            className={ui.select}
          >
            <option value="born_on_farm">Born on farm</option>
            <option value="bought_from_supplier">Bought from supplier</option>
            <option value="bought_from_bazar">Bought from bazar</option>
          </select>
        </label>
        <label className={ui.label}>
          Acquisition date *
          <input
            required
            type="date"
            value={values.acquisition_date}
            onChange={(e) => setValues((c) => ({ ...c, acquisition_date: e.target.value }))}
            className={ui.input}
          />
        </label>

        {isBornOnFarm ? (
          <>
            <label className={ui.label}>
              Dam (Mother)
              <select
                value={values.dam_id}
                onChange={(e) => setValues((c) => ({ ...c, dam_id: e.target.value }))}
                className={ui.select}
              >
                <option value="">None / unknown</option>
                {femaleCows.map((item) => (
                  <option key={item.cow_id} value={item.cow_id}>
                    {item.current_tag_number}
                  </option>
                ))}
              </select>
            </label>
            <label className={ui.label}>
              Sire (Father)
              <select
                value={values.sire_id}
                onChange={(e) => setValues((c) => ({ ...c, sire_id: e.target.value }))}
                className={ui.select}
              >
                <option value="">None / unknown</option>
                {maleCows.map((item) => (
                  <option key={item.cow_id} value={item.cow_id}>
                    {item.current_tag_number}
                  </option>
                ))}
              </select>
            </label>
          </>
        ) : (
          <label className={ui.label}>
            Supplier
            <select
              value={values.supplier_id}
              onChange={(e) => setValues((c) => ({ ...c, supplier_id: e.target.value }))}
              className={ui.select}
            >
              <option value="">None / unspecified</option>
              {suppliers.map((item) => (
                <option key={item.supplier_id} value={item.supplier_id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={ui.label}>
          Purchase price (৳)
          <input
            type="number"
            min="0"
            step="0.01"
            value={values.purchase_price}
            onChange={(e) => setValues((c) => ({ ...c, purchase_price: e.target.value }))}
            className={ui.input}
          />
        </label>

        <label className={`${ui.label} sm:col-span-2 lg:col-span-3`}>
          Notes
          <textarea
            rows={2}
            value={values.notes}
            onChange={(e) => setValues((c) => ({ ...c, notes: e.target.value }))}
            placeholder="Temperament, yield notes, markings, etc."
            className={ui.textarea}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btn("secondary", "sm")}>
          Cancel
        </button>
        <button type="submit" disabled={saving} className={btn("primary", "sm")}>
          {saving ? "Saving…" : "Save changes"}
        </button>
      </div>
    </form>
  );
}
