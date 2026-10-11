"use client";

import { useState } from "react";
import { useFarm, type MasterItem } from "@/context/farm-context";

export function MastersWorkspace() {
  const { language, masters, addMasterItem } = useFarm();

  const [selectedCat, setSelectedCat] = useState<MasterItem["category"]>("warehouses");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formName, setFormName] = useState("");
  const [formNameBn, setFormNameBn] = useState("");
  const [formType, setFormType] = useState("Housing");

  const filteredItems = masters.filter((m) => m.category === selectedCat);

  const handleCreateMaster = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formName.trim()) return;
    addMasterItem({
      category: selectedCat,
      name: formName.trim(),
      nameBn: formNameBn.trim() || formName.trim(),
      type: formType,
    });
    setModalOpen(false);
    setFormName("");
    setFormNameBn("");
  };

  return (
    <section className="screen active" id="masters">
      <div className="filters">
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value as MasterItem["category"])}
        >
          <option value="warehouses">{language === "bn" ? "শেড / গোয়াল (Warehouses)" : "Warehouses"}</option>
          <option value="suppliers">{language === "bn" ? "সাপ্লায়ার (Suppliers)" : "Suppliers"}</option>
          <option value="customers">{language === "bn" ? "ক্রেতা (Customers)" : "Customers"}</option>
          <option value="expense_categories">{language === "bn" ? "খরচের খাত (Expense categories)" : "Expense categories"}</option>
          <option value="market_prices">{language === "bn" ? "বাজার দর (Market prices)" : "Market prices"}</option>
        </select>
        <button type="button" onClick={() => setModalOpen(true)}>
          {language === "bn" ? "+ নতুন তথ্য যোগ" : "+ Add"}
        </button>
      </div>

      <div className="card">
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "নাম" : "Name"}</th>
              <th>{language === "bn" ? "নাম (বাংলা)" : "Name (বাংলা)"}</th>
              <th>{language === "bn" ? "ধরন" : "Type"}</th>
              <th></th>
            </tr>
          </thead>
          <tbody>
            {filteredItems.map((item) => (
              <tr key={item.id}>
                <td>
                  <b>{item.name}</b>
                </td>
                <td>{item.nameBn}</td>
                <td>{item.type}</td>
                <td className="muted" style={{ cursor: "pointer", textAlign: "right" }}>
                  {language === "bn" ? "সম্পাদনা" : "Edit"}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add Master Item Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "নতুন মৌলিক তথ্য যোগ করুন" : "Add master record"}
              <small style={{ cursor: "pointer" }} onClick={() => setModalOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleCreateMaster} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "নাম (English)" : "Name"} *</label>
                <input
                  required
                  placeholder="e.g. Shed C, Rahim Agro"
                  value={formName}
                  onChange={(e) => setFormName(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "নাম (বাংলা)" : "Name (বাংলা)"}</label>
                <input
                  placeholder="যেমন: শেড সি, রহিম এগ্রো"
                  value={formNameBn}
                  onChange={(e) => setFormNameBn(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "ধরন" : "Type"}</label>
                <input
                  placeholder="e.g. Housing, Buyer, Feed"
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "সংরক্ষণ করুন" : "Save item"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setModalOpen(false)}
                >
                  {language === "bn" ? "বাতিল" : "Cancel"}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </section>
  );
}
