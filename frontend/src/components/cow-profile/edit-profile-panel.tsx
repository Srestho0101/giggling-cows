"use client";

import React, { useState } from "react";
import { btn, ui } from "@/components/ui";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";
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
  const { tr } = useI18n();
  const [saving, setSaving] = useState(false);
  const [values, setValues] = useState({
    current_tag_number: cow.current_tag_number,
    sex: cow.sex,
    category: cow.category,
    cow_type: cow.cow_type ?? "",
    gives_milk: Boolean(cow.gives_milk),
    breed: cow.breed ?? "",
    color: cow.color ?? "",
    marking: cow.marking ?? "",
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
    if (values.birth_date && values.acquisition_date && values.acquisition_date < values.birth_date) {
      onError(tr("Acquisition date cannot be earlier than birth date.", "সংগ্রহের তারিখ জন্ম তারিখের আগে হতে পারবে না।"));
      setSaving(false);
      return;
    }
    try {
      const body: Record<string, unknown> = {
        current_tag_number: values.current_tag_number.trim(),
        sex: values.sex,
        category: values.category.trim(),
        cow_type: values.cow_type.trim() || null,
        gives_milk: values.sex === "female" ? values.gives_milk : false,
        breed: values.breed || null,
        color: values.color.trim() || null,
        marking: values.marking.trim() || null,
        birth_date: values.birth_date || null,
        acquisition_type: values.acquisition_type,
        acquisition_date: isBornOnFarm && values.birth_date ? values.birth_date : values.acquisition_date,
        purchase_price: isBornOnFarm
          ? 0
          : values.purchase_price !== ""
            ? Number(values.purchase_price)
            : null,
        dam_id: values.dam_id || null,
        sire_id: values.sire_id || null,
        supplier_id: !isBornOnFarm ? (values.supplier_id || null) : null,
        notes: values.notes.trim() || null,
      };
      await apiRequest(apiRoutes.herd.cow(cow.cow_id), { method: "PATCH", body });
      onNotice(tr("Cow profile updated.", "গরুর প্রোফাইল আপডেট হয়েছে।"));
      await onSaved();
      onCancel();
    } catch (cause) {
      onError(cause instanceof Error ? cause.message : tr("Could not update cow profile.", "গরুর প্রোফাইল আপডেট করা যায়নি।"));
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
          <h3 className="text-[14px] font-semibold text-ink">{tr("Edit cow details", "গরুর তথ্য সম্পাদনা")}</h3>
          <p className="text-[12px] text-muted">
            {tr("Update tag, physical details, acquisition, and lineage information.", "ট্যাগ, শারীরিক বিবরণ, সংগ্রহ ও বংশতালিকা আপডেট করুন।")}
          </p>
        </div>
        <button type="button" onClick={onCancel} className={btn("quiet", "sm")}>
          {tr("Cancel")}
        </button>
      </div>

      <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-3">
        <label className={ui.label}>
          {tr("Tag")} *
          <input
            required
            maxLength={50}
            value={values.current_tag_number}
            onChange={(e) => setValues((c) => ({ ...c, current_tag_number: e.target.value }))}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          {tr("Sex")} *
          <select
            value={values.sex}
            onChange={(e) => setValues((c) => ({ ...c, sex: e.target.value as "male" | "female" }))}
            className={ui.select}
          >
            <option value="female">{tr("Female")}</option>
            <option value="male">{tr("Male")}</option>
          </select>
        </label>
        <label className={ui.label}>
          {tr("Category")} *
          <select
            required
            value={values.category}
            onChange={(e) => setValues((c) => ({ ...c, category: e.target.value }))}
            className={ui.select}
          >
            <option value="dairy">{tr("Dairy")}</option>
            <option value="beef">{tr("Beef")}</option>
            <option value="duel-purpose">{tr("Dual-purpose")}</option>
          </select>
        </label>
        <label className={ui.label}>
          {tr("Cow type")}
          <select
            value={values.cow_type}
            onChange={(e) => setValues((c) => ({ ...c, cow_type: e.target.value }))}
            className={ui.select}
          >
            <option value="">{tr("None / unspecified", "নির্ধারিত নয়")}</option>
            <option value="Bull Calf">{tr("Bull Calf")}</option>
            <option value="Heifer Calf">{tr("Heifer Calf")}</option>
            <option value="Bull">{tr("Bull")}</option>
            <option value="Cow">{tr("Cow")}</option>
            <option value="Heifer">{tr("Heifer")}</option>
            <option value="Ox">{tr("Ox")}</option>
          </select>
        </label>
        {values.sex === "female" && (
          <label className={ui.label}>
            {tr("Milking")}
            <select
              value={values.gives_milk ? "true" : "false"}
              onChange={(e) => setValues((c) => ({ ...c, gives_milk: e.target.value === "true" }))}
              className={ui.select}
            >
              <option value="false">{tr("No")}</option>
              <option value="true">{tr("Yes")}</option>
            </select>
          </label>
        )}
        <label className={ui.label}>
          {tr("Breed / calf type")}
          <select
            value={values.breed}
            onChange={(e) => setValues((c) => ({ ...c, breed: e.target.value }))}
            className={ui.select}
          >
            <option value="">{tr("Not specified", "নির্ধারিত নয়")}</option>
            <option value="deshi">{tr("Deshi")}</option>
            <option value="friesian">{tr("Friesian")}</option>
            <option value="other">{tr("Other / Unknown")}</option>
          </select>
        </label>
        <label className={ui.label}>
          {tr("Color")}
          <input
            maxLength={80}
            placeholder={tr("e.g. Black & white, Red, Brown", "যেমন: সাদা-কালো, লাল, বাদামী")}
            value={values.color}
            onChange={(e) => setValues((c) => ({ ...c, color: e.target.value }))}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          {tr("Marking")}
          <input
            maxLength={200}
            placeholder={tr("e.g. White star on forehead, spotted", "যেমন: কপালে সাদা তারা, ছোপ ছোপ দাগ")}
            value={values.marking}
            onChange={(e) => setValues((c) => ({ ...c, marking: e.target.value }))}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          {tr("Birth date")}
          <input
            type="date"
            value={values.birth_date}
            onChange={(e) => {
              const nextBirth = e.target.value;
              setValues((c) => ({
                ...c,
                birth_date: nextBirth,
                acquisition_date:
                  c.acquisition_type === "born_on_farm" && nextBirth ? nextBirth : c.acquisition_date,
              }));
            }}
            className={ui.input}
          />
        </label>
        <label className={ui.label}>
          {tr("Acquisition")} *
          <select
            value={values.acquisition_type}
            onChange={(e) => {
              const nextType = e.target.value as CowDetail["acquisition_type"];
              setValues((c) => ({
                ...c,
                acquisition_type: nextType,
                acquisition_date:
                  nextType === "born_on_farm" && c.birth_date ? c.birth_date : c.acquisition_date,
                purchase_price: nextType === "born_on_farm" ? "0" : c.purchase_price,
                supplier_id: nextType === "born_on_farm" ? "" : c.supplier_id,
                dam_id: nextType === "born_on_farm" ? c.dam_id : "",
                sire_id: nextType === "born_on_farm" ? c.sire_id : "",
              }));
            }}
            className={ui.select}
          >
            <option value="born_on_farm">{tr("Born on Farm")}</option>
            <option value="bought_from_supplier">{tr("Bought from Supplier")}</option>
            <option value="bought_from_bazar">{tr("Bought from Bazar")}</option>
          </select>
        </label>
        <label className={ui.label}>
          {tr("Acquisition date")} *
          <input
            required
            type="date"
            min={values.birth_date || undefined}
            disabled={isBornOnFarm && Boolean(values.birth_date)}
            value={isBornOnFarm && values.birth_date ? values.birth_date : values.acquisition_date}
            onChange={(e) => setValues((c) => ({ ...c, acquisition_date: e.target.value }))}
            className={`${ui.input} disabled:opacity-65 disabled:cursor-not-allowed`}
          />
        </label>

        <label className={ui.label}>
          {isBornOnFarm ? tr("Dam") : tr("Dam (optional)")}
          <select
            value={values.dam_id}
            onChange={(e) => setValues((c) => ({ ...c, dam_id: e.target.value }))}
            className={ui.select}
          >
            <option value="">{tr("None / unknown", "নেই / অজানা")}</option>
            {femaleCows.map((item) => (
              <option key={item.cow_id} value={item.cow_id}>
                {item.current_tag_number}
              </option>
            ))}
          </select>
        </label>
        <label className={ui.label}>
          {tr("Sire (optional)")}
          <select
            value={values.sire_id}
            onChange={(e) => setValues((c) => ({ ...c, sire_id: e.target.value }))}
            className={ui.select}
          >
            <option value="">{tr("None / unknown", "নেই / অজানা")}</option>
            {maleCows.map((item) => (
              <option key={item.cow_id} value={item.cow_id}>
                {item.current_tag_number}
              </option>
            ))}
          </select>
        </label>
        {!isBornOnFarm && (
          <label className={ui.label}>
            {tr("Supplier")}
            <select
              value={values.supplier_id}
              onChange={(e) => setValues((c) => ({ ...c, supplier_id: e.target.value }))}
              className={ui.select}
            >
              <option value="">{tr("None / unspecified", "নির্ধারিত নয়")}</option>
              {suppliers.map((item) => (
                <option key={item.supplier_id} value={item.supplier_id}>
                  {item.name}
                </option>
              ))}
            </select>
          </label>
        )}

        <label className={ui.label}>
          {tr("Purchase price ৳")}
          <input
            type="number"
            min="0"
            step="0.01"
            disabled={isBornOnFarm}
            value={isBornOnFarm ? "0" : values.purchase_price}
            onChange={(e) => setValues((c) => ({ ...c, purchase_price: e.target.value }))}
            className={`${ui.input} disabled:opacity-65 disabled:cursor-not-allowed`}
          />
        </label>

        <label className={`${ui.label} sm:col-span-2 lg:col-span-3`}>
          {tr("Notes")}
          <textarea
            rows={2}
            value={values.notes}
            onChange={(e) => setValues((c) => ({ ...c, notes: e.target.value }))}
            placeholder={tr("Temperament, yield notes, markings, etc.", "স্বভাব, দুধের পরিমাণ বা অন্যান্য তথ্য")}
            className={ui.textarea}
          />
        </label>
      </div>

      <div className="flex justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} className={btn("secondary", "sm")}>
          {tr("Cancel")}
        </button>
        <button type="submit" disabled={saving} className={btn("primary", "sm")}>
          {saving ? tr("Saving…") : tr("Save changes")}
        </button>
      </div>
    </form>
  );
}
