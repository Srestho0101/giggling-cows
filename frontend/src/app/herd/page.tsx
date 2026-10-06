"use client";

import React, { useEffect, useState } from "react";
import {
  Beef,
  Plus,
  Search,
  Filter,
  Warehouse as WarehouseIcon,
  Scale,
  MoveRight,
  X,
  History,
  Tag,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { api } from "@/lib/api";
import { Cow, CowDetail, Supplier, Warehouse } from "@/types/models";
import { formatBDT, formatDate } from "@/lib/formatters";

export default function HerdPage() {
  const { t, locale } = useLanguage();
  const { getAuthHeaders, user } = useAuth();

  const [cows, setCows] = useState<Cow[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);

  // Filters
  const [search, setSearch] = useState("");
  const [selectedWarehouse, setSelectedWarehouse] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("active");

  // Modals
  const [isAddModalOpen, setIsAddModalOpen] = useState(false);
  const [detailCow, setDetailCow] = useState<CowDetail | null>(null);
  const [isWeighModalOpen, setIsWeighModalOpen] = useState(false);
  const [isMoveModalOpen, setIsMoveModalOpen] = useState(false);

  // Forms
  const [newCowForm, setNewCowForm] = useState({
    current_tag_number: "",
    sex: "female",
    category: "dairy",
    acquisition_type: "born_on_farm",
    acquisition_date: new Date().toISOString().split("T")[0],
    purchase_price: "",
    warehouse_id: "",
    supplier_id: "",
    notes: "",
  });

  const [weighForm, setWeighForm] = useState({
    weigh_date: new Date().toISOString().split("T")[0],
    weight_kg: "",
  });

  const [moveForm, setMoveForm] = useState({
    warehouse_id: "",
    moved_in_date: new Date().toISOString().split("T")[0],
    reason: "",
  });

  const loadData = async () => {
    try {
      setLoading(true);
      const auth = getAuthHeaders();
      const [cowsRes, whRes, suppRes] = await Promise.all([
        api.getCows(
          {
            warehouse_id: selectedWarehouse || undefined,
            status: selectedStatus || undefined,
            search: search || undefined,
          },
          auth
        ),
        api.getWarehouses(auth),
        api.getSuppliers(auth),
      ]);
      setCows(cowsRes);
      setWarehouses(whRes);
      setSuppliers(suppRes);
      if (!newCowForm.warehouse_id && whRes.length > 0) {
        setNewCowForm((prev) => ({ ...prev, warehouse_id: whRes[0].warehouse_id }));
      }
    } catch (err: any) {
      console.error(err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [selectedWarehouse, selectedStatus]);

  const handleSearchSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    loadData();
  };

  const handleOpenDetail = async (cowId: string) => {
    try {
      const detail = await api.getCow(cowId, getAuthHeaders());
      setDetailCow(detail);
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleCreateCow = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const payload: any = {
        current_tag_number: newCowForm.current_tag_number.trim(),
        sex: newCowForm.sex,
        category: newCowForm.category,
        acquisition_type: newCowForm.acquisition_type,
        acquisition_date: newCowForm.acquisition_date,
        warehouse_id: newCowForm.warehouse_id,
        notes: newCowForm.notes || undefined,
      };

      if (newCowForm.acquisition_type !== "born_on_farm") {
        if (newCowForm.purchase_price) {
          payload.purchase_price = parseFloat(newCowForm.purchase_price);
        }
        if (newCowForm.supplier_id) {
          payload.supplier_id = newCowForm.supplier_id;
        }
      }

      await api.createCow(payload, getAuthHeaders());
      setIsAddModalOpen(false);
      setNewCowForm({
        current_tag_number: "",
        sex: "female",
        category: "dairy",
        acquisition_type: "born_on_farm",
        acquisition_date: new Date().toISOString().split("T")[0],
        purchase_price: "",
        warehouse_id: warehouses[0]?.warehouse_id || "",
        supplier_id: "",
        notes: "",
      });
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleAddWeight = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCow) return;
    try {
      await api.addWeightRecord(
        detailCow.cow_id,
        {
          weigh_date: weighForm.weigh_date,
          weight_kg: parseFloat(weighForm.weight_kg),
        },
        getAuthHeaders()
      );
      setIsWeighModalOpen(false);
      setWeighForm({ weigh_date: new Date().toISOString().split("T")[0], weight_kg: "" });
      handleOpenDetail(detailCow.cow_id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  const handleMoveWarehouse = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!detailCow) return;
    try {
      await api.moveWarehouse(
        detailCow.cow_id,
        {
          warehouse_id: moveForm.warehouse_id,
          moved_in_date: moveForm.moved_in_date,
          reason: moveForm.reason || undefined,
        },
        getAuthHeaders()
      );
      setIsMoveModalOpen(false);
      handleOpenDetail(detailCow.cow_id);
      loadData();
    } catch (err: any) {
      alert(err.message);
    }
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
        <div>
          <h1 className="text-2xl font-bold tracking-tight text-zinc-900 dark:text-zinc-100">
            {t("herd.title")}
          </h1>
          <p className="text-sm text-zinc-500">
            Track cattle profiles, warehouses, movements, tags, and weight records
          </p>
        </div>
        <button
          onClick={() => setIsAddModalOpen(true)}
          className="flex items-center gap-1.5 px-3.5 py-2 text-xs font-semibold rounded-lg bg-emerald-600 text-white hover:bg-emerald-500 transition shadow-xs"
        >
          <Plus className="w-4 h-4" />
          <span>{t("herd.add_cow")}</span>
        </button>
      </div>

      {/* Warehouse Occupancy Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        {warehouses.map((wh) => (
          <div
            key={wh.warehouse_id}
            onClick={() => setSelectedWarehouse(selectedWarehouse === wh.warehouse_id ? "" : wh.warehouse_id)}
            className={`p-4 rounded-xl border cursor-pointer transition shadow-xs ${
              selectedWarehouse === wh.warehouse_id
                ? "border-emerald-600 bg-emerald-50/50 dark:bg-emerald-950/20"
                : "border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 hover:border-zinc-300"
            }`}
          >
            <div className="flex items-center justify-between mb-1">
              <span className="text-xs font-bold text-zinc-800 dark:text-zinc-200">
                {wh.name}
              </span>
              <WarehouseIcon className="w-4 h-4 text-zinc-400" />
            </div>
            <div className="flex items-baseline justify-between mt-2">
              <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                {wh.current_occupancy} <span className="text-xs font-normal text-zinc-400">/ {wh.capacity}</span>
              </span>
              <span className="text-xs text-zinc-500">
                {Math.round((wh.current_occupancy / wh.capacity) * 100)}% capacity
              </span>
            </div>
          </div>
        ))}
      </div>

      {/* Filter and Search Bar */}
      <div className="p-4 rounded-xl bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 flex flex-col md:flex-row items-center justify-between gap-3 shadow-xs">
        <form onSubmit={handleSearchSubmit} className="relative w-full md:w-80">
          <Search className="w-4 h-4 absolute left-3 top-3 text-zinc-400" />
          <input
            type="text"
            placeholder={t("herd.search_placeholder")}
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-3 py-2 text-sm rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 focus:outline-none focus:ring-1 focus:ring-emerald-500"
          />
        </form>

        <div className="flex items-center gap-2 w-full md:w-auto">
          <select
            value={selectedWarehouse}
            onChange={(e) => setSelectedWarehouse(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-200"
          >
            <option value="">{t("herd.all_warehouses")}</option>
            {warehouses.map((w) => (
              <option key={w.warehouse_id} value={w.warehouse_id}>
                {w.name}
              </option>
            ))}
          </select>

          <select
            value={selectedStatus}
            onChange={(e) => setSelectedStatus(e.target.value)}
            className="px-3 py-2 text-xs rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 font-medium text-zinc-700 dark:text-zinc-200"
          >
            <option value="">{t("herd.all_statuses")}</option>
            <option value="active">Active (চলমান)</option>
            <option value="sold">Sold (বিক্রিত)</option>
            <option value="deceased">Deceased (মৃত)</option>
          </select>
        </div>
      </div>

      {/* Cows Table */}
      <div className="rounded-2xl border border-zinc-200 dark:border-zinc-800 bg-white dark:bg-zinc-900 overflow-hidden shadow-xs">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-sm">
            <thead className="bg-zinc-50 dark:bg-zinc-800/60 border-b border-zinc-200 dark:border-zinc-800 text-xs font-semibold text-zinc-500 uppercase tracking-wider">
              <tr>
                <th className="px-4 py-3.5">{t("herd.tag_number")}</th>
                <th className="px-4 py-3.5">{t("herd.category")}</th>
                <th className="px-4 py-3.5">{t("herd.sex")}</th>
                <th className="px-4 py-3.5">{t("herd.warehouse")}</th>
                <th className="px-4 py-3.5">{t("herd.weight")}</th>
                <th className="px-4 py-3.5">{t("herd.status")}</th>
                <th className="px-4 py-3.5 text-right">{t("herd.actions")}</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-zinc-200 dark:divide-zinc-800">
              {loading ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    Loading herd records...
                  </td>
                </tr>
              ) : cows.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-8 text-center text-zinc-400">
                    No cows found matching the filter criteria.
                  </td>
                </tr>
              ) : (
                cows.map((cow) => (
                  <tr
                    key={cow.cow_id}
                    className="hover:bg-zinc-50/70 dark:hover:bg-zinc-800/40 transition cursor-pointer"
                    onClick={() => handleOpenDetail(cow.cow_id)}
                  >
                    <td className="px-4 py-3 font-bold text-zinc-900 dark:text-zinc-100 flex items-center gap-2">
                      <Tag className="w-3.5 h-3.5 text-emerald-600" />
                      <span>{cow.current_tag_number}</span>
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-300">
                      {cow.category}
                    </td>
                    <td className="px-4 py-3 capitalize text-zinc-600 dark:text-zinc-300">
                      {cow.sex}
                    </td>
                    <td className="px-4 py-3 text-zinc-600 dark:text-zinc-300">
                      {cow.warehouse_name || "-"}
                    </td>
                    <td className="px-4 py-3 font-semibold text-zinc-800 dark:text-zinc-200">
                      {cow.latest_weight_kg ? `${cow.latest_weight_kg} kg` : "-"}
                    </td>
                    <td className="px-4 py-3">
                      <span
                        className={`inline-flex px-2 py-0.5 rounded-full text-xs font-semibold capitalize ${
                          cow.status === "active"
                            ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950 dark:text-emerald-300"
                            : cow.status === "sold"
                            ? "bg-blue-100 text-blue-800 dark:bg-blue-950 dark:text-blue-300"
                            : "bg-zinc-100 text-zinc-800 dark:bg-zinc-800 dark:text-zinc-300"
                        }`}
                      >
                        {cow.status}
                      </span>
                    </td>
                    <td className="px-4 py-3 text-right">
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleOpenDetail(cow.cow_id);
                        }}
                        className="text-xs font-semibold text-emerald-600 hover:text-emerald-700"
                      >
                        {t("herd.view_detail")}
                      </button>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* DETAIL MODAL / DRAWER */}
      {detailCow && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-2xl rounded-2xl max-h-[90vh] overflow-y-auto p-6 shadow-2xl space-y-6">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-4">
              <div>
                <div className="flex items-center gap-2">
                  <span className="text-2xl font-black text-zinc-900 dark:text-zinc-100">
                    {detailCow.current_tag_number}
                  </span>
                  <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-100 text-emerald-800">
                    {detailCow.status}
                  </span>
                </div>
                <p className="text-xs text-zinc-500">
                  Acquisition: {detailCow.acquisition_type} • Date: {formatDate(detailCow.acquisition_date, locale)}
                </p>
              </div>
              <button
                onClick={() => setDetailCow(null)}
                className="p-1 rounded-lg text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Quick Actions for this Cow */}
            <div className="flex items-center gap-2">
              <button
                onClick={() => setIsWeighModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                <Scale className="w-3.5 h-3.5 text-blue-600" />
                <span>{t("herd.record_weight")}</span>
              </button>
              <button
                onClick={() => {
                  setMoveForm({
                    warehouse_id: detailCow.warehouse_id,
                    moved_in_date: new Date().toISOString().split("T")[0],
                    reason: "",
                  });
                  setIsMoveModalOpen(true);
                }}
                className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 text-xs font-semibold text-zinc-700 dark:text-zinc-300 hover:bg-zinc-50"
              >
                <MoveRight className="w-3.5 h-3.5 text-purple-600" />
                <span>{t("herd.move_warehouse")}</span>
              </button>
            </div>

            {/* Details Grid */}
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 bg-zinc-50 dark:bg-zinc-800/40 p-4 rounded-xl text-xs">
              <div>
                <span className="text-zinc-400 block">Category</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                  {detailCow.category}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Sex</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200 capitalize">
                  {detailCow.sex}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Current Shed</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {detailCow.warehouse_name || "-"}
                </span>
              </div>
              <div>
                <span className="text-zinc-400 block">Purchase Price</span>
                <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                  {detailCow.purchase_price ? formatBDT(detailCow.purchase_price, locale) : "N/A"}
                </span>
              </div>
            </div>

            {/* Weight Records History */}
            <div>
              <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-2">
                Weight Growth History
              </h3>
              {detailCow.weight_records.length === 0 ? (
                <div className="text-xs text-zinc-400 py-2">No weight entries recorded yet.</div>
              ) : (
                <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                  {detailCow.weight_records.map((w) => (
                    <div key={w.weight_id} className="p-2.5 flex justify-between">
                      <span className="text-zinc-500">{formatDate(w.weigh_date, locale)}</span>
                      <span className="font-bold text-zinc-800 dark:text-zinc-200">
                        {w.weight_kg} kg
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {/* Warehouse Movement History */}
            <div>
              <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-2">
                Warehouse Movement History
              </h3>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {detailCow.warehouse_history.map((m) => (
                  <div key={m.movement_id} className="p-2.5 flex justify-between">
                    <div>
                      <span className="font-semibold text-zinc-800 dark:text-zinc-200">
                        {m.warehouse_name || "Shed"}
                      </span>
                      {m.reason && <span className="text-zinc-400 text-[11px] block">{m.reason}</span>}
                    </div>
                    <span className="text-zinc-500">
                      {formatDate(m.moved_in_date, locale)} {m.moved_out_date ? `→ ${formatDate(m.moved_out_date, locale)}` : "(Current)"}
                    </span>
                  </div>
                ))}
              </div>
            </div>

            {/* Tag ID History */}
            <div>
              <h3 className="text-xs font-bold uppercase text-zinc-500 tracking-wider mb-2">
                Tag Change History
              </h3>
              <div className="border border-zinc-200 dark:border-zinc-800 rounded-xl divide-y divide-zinc-100 dark:divide-zinc-800 text-xs">
                {detailCow.id_history.map((h) => (
                  <div key={h.history_id} className="p-2.5 flex justify-between">
                    <span className="font-bold text-zinc-800 dark:text-zinc-200">{h.tag_number}</span>
                    <span className="text-zinc-500">{formatDate(h.assigned_date, locale)}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ADD COW MODAL */}
      {isAddModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-lg rounded-2xl p-6 shadow-2xl space-y-4">
            <div className="flex items-center justify-between border-b border-zinc-100 dark:border-zinc-800 pb-3">
              <h2 className="text-lg font-bold text-zinc-900 dark:text-zinc-100">
                {t("herd.add_cow")}
              </h2>
              <button onClick={() => setIsAddModalOpen(false)}>
                <X className="w-5 h-5 text-zinc-400" />
              </button>
            </div>

            <form onSubmit={handleCreateCow} className="space-y-4 text-xs">
              <div>
                <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                  Tag Number (ট্যাগ নম্বর) *
                </label>
                <input
                  type="text"
                  required
                  value={newCowForm.current_tag_number}
                  onChange={(e) => setNewCowForm({ ...newCowForm, current_tag_number: e.target.value })}
                  placeholder="e.g. COW-101"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm focus:ring-1 focus:ring-emerald-500"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                    Category *
                  </label>
                  <select
                    value={newCowForm.category}
                    onChange={(e) => setNewCowForm({ ...newCowForm, category: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  >
                    <option value="dairy">Dairy Cow (দুগ্ধবতী গাভী)</option>
                    <option value="bull">Bull / Ox (ষাঁড় / বলদ)</option>
                    <option value="heifer">Heifer (বকনা বাছুর)</option>
                    <option value="calf">Calf (বাছুর)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                    Sex *
                  </label>
                  <select
                    value={newCowForm.sex}
                    onChange={(e) => setNewCowForm({ ...newCowForm, sex: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  >
                    <option value="female">Female (মাদি)</option>
                    <option value="male">Male (নর)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                    Acquisition Type *
                  </label>
                  <select
                    value={newCowForm.acquisition_type}
                    onChange={(e) => setNewCowForm({ ...newCowForm, acquisition_type: e.target.value as any })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  >
                    <option value="born_on_farm">Born on Farm (খামারে জন্ম)</option>
                    <option value="bought_from_supplier">Bought from Supplier (খামারি)</option>
                    <option value="bought_from_bazar">Bought from Bazar (হাট)</option>
                  </select>
                </div>
                <div>
                  <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                    Warehouse / Shed *
                  </label>
                  <select
                    value={newCowForm.warehouse_id}
                    onChange={(e) => setNewCowForm({ ...newCowForm, warehouse_id: e.target.value })}
                    className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                  >
                    {warehouses.map((w) => (
                      <option key={w.warehouse_id} value={w.warehouse_id}>
                        {w.name}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              {newCowForm.acquisition_type !== "born_on_farm" && (
                <div className="grid grid-cols-2 gap-3 p-3 bg-zinc-50 dark:bg-zinc-800 rounded-xl">
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                      Purchase Price (টাকা)
                    </label>
                    <input
                      type="number"
                      value={newCowForm.purchase_price}
                      onChange={(e) => setNewCowForm({ ...newCowForm, purchase_price: e.target.value })}
                      placeholder="e.g. 120000"
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                    />
                  </div>
                  <div>
                    <label className="block text-zinc-700 dark:text-zinc-300 font-semibold mb-1">
                      Supplier
                    </label>
                    <select
                      value={newCowForm.supplier_id}
                      onChange={(e) => setNewCowForm({ ...newCowForm, supplier_id: e.target.value })}
                      className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-zinc-900 text-sm"
                    >
                      <option value="">Select Supplier</option>
                      {suppliers.map((s) => (
                        <option key={s.supplier_id} value={s.supplier_id}>
                          {s.name}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              )}

              <div className="flex justify-end gap-2 pt-3 border-t border-zinc-100 dark:border-zinc-800">
                <button
                  type="button"
                  onClick={() => setIsAddModalOpen(false)}
                  className="px-4 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 text-xs font-semibold"
                >
                  {t("common.cancel")}
                </button>
                <button
                  type="submit"
                  className="px-4 py-2 rounded-lg bg-emerald-600 text-white text-xs font-semibold hover:bg-emerald-500"
                >
                  {t("common.save")}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* WEIGH MODAL */}
      {isWeighModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Record Weight ({detailCow?.current_tag_number})
            </h2>
            <form onSubmit={handleAddWeight} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Weigh Date</label>
                <input
                  type="date"
                  required
                  value={weighForm.weigh_date}
                  onChange={(e) => setWeighForm({ ...weighForm, weigh_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Weight in kg *</label>
                <input
                  type="number"
                  step="0.01"
                  required
                  value={weighForm.weight_kg}
                  onChange={(e) => setWeighForm({ ...weighForm, weight_kg: e.target.value })}
                  placeholder="e.g. 450.5"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsWeighModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  Save Weight
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* MOVE MODAL */}
      {isMoveModalOpen && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white dark:bg-zinc-900 border border-zinc-200 dark:border-zinc-800 w-full max-w-sm rounded-2xl p-6 shadow-2xl space-y-4">
            <h2 className="text-base font-bold text-zinc-900 dark:text-zinc-100">
              Move Warehouse ({detailCow?.current_tag_number})
            </h2>
            <form onSubmit={handleMoveWarehouse} className="space-y-3 text-xs">
              <div>
                <label className="block font-semibold mb-1">Destination Warehouse</label>
                <select
                  value={moveForm.warehouse_id}
                  onChange={(e) => setMoveForm({ ...moveForm, warehouse_id: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                >
                  {warehouses.map((w) => (
                    <option key={w.warehouse_id} value={w.warehouse_id}>
                      {w.name}
                    </option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block font-semibold mb-1">Transfer Date</label>
                <input
                  type="date"
                  required
                  value={moveForm.moved_in_date}
                  onChange={(e) => setMoveForm({ ...moveForm, moved_in_date: e.target.value })}
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
              <div>
                <label className="block font-semibold mb-1">Reason (Optional)</label>
                <input
                  type="text"
                  value={moveForm.reason}
                  onChange={(e) => setMoveForm({ ...moveForm, reason: e.target.value })}
                  placeholder="e.g. Moved to calving stall"
                  className="w-full px-3 py-2 rounded-lg border border-zinc-300 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-sm"
                />
              </div>
              <div className="flex justify-end gap-2 pt-2">
                <button
                  type="button"
                  onClick={() => setIsMoveModalOpen(false)}
                  className="px-3 py-1.5 rounded-lg border text-xs"
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-semibold"
                >
                  Transfer
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
