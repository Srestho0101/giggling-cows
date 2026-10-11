"use client";

import { useState } from "react";
import { useFarm } from "@/context/farm-context";

export function ExpensesWorkspace() {
  const { language, expenses, addExpense } = useFarm();

  const [searchDate, setSearchDate] = useState("");
  const [selectedCat, setSelectedCat] = useState("");
  const [selectedWh, setSelectedWh] = useState("");
  const [modalOpen, setModalOpen] = useState(false);

  // Form state
  const [formDate, setFormDate] = useState("10 Oct");
  const [formCat, setFormCat] = useState("Green grass (কাঁচা ঘাস)");
  const [formWh, setFormWh] = useState("Shed A");
  const [formCow, setFormCow] = useState("");
  const [formAmt, setFormAmt] = useState("500");
  const [formNote, setFormNote] = useState("");

  const filteredExpenses = expenses.filter((e) => {
    const matchCat = !selectedCat || e.c.includes(selectedCat);
    const matchWh = !selectedWh || e.w === selectedWh;
    return matchCat && matchWh;
  });

  const totalFiltered = filteredExpenses.reduce((acc, e) => acc + e.a, 0);

  const handleCreateExpense = (e: React.FormEvent) => {
    e.preventDefault();
    const a = parseFloat(formAmt);
    if (!a) return;
    addExpense(formCat, formWh, a, formNote);
    setModalOpen(false);
  };

  return (
    <section className="screen active" id="expenses">
      <div className="filters">
        <input
          placeholder={language === "bn" ? "তারিখ ফিল্টার" : "Date range"}
          value={searchDate}
          onChange={(e) => setSearchDate(e.target.value)}
        />
        <select
          value={selectedCat}
          onChange={(e) => setSelectedCat(e.target.value)}
        >
          <option value="">{language === "bn" ? "সব বিভাগ" : "All categories"}</option>
          <option value="Green grass">Green grass (কাঁচা ঘাস)</option>
          <option value="Molasses">Molasses (মলাসেস)</option>
          <option value="Dry straw">Dry straw (শুকনা খড়)</option>
          <option value="Electric bill">Electric bill</option>
        </select>
        <select
          value={selectedWh}
          onChange={(e) => setSelectedWh(e.target.value)}
        >
          <option value="">{language === "bn" ? "সব শেড" : "All warehouses"}</option>
          <option value="Shed A">Shed A</option>
          <option value="Shed B">Shed B</option>
        </select>
        <button type="button" onClick={() => setModalOpen(true)}>
          {language === "bn" ? "+ খরচ যোগ করুন" : "+ Add expense"}
        </button>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "তারিখ" : "Date"}</th>
              <th>{language === "bn" ? "বিভাগ" : "Category"}</th>
              <th>{language === "bn" ? "শেড" : "Warehouse"}</th>
              <th>{language === "bn" ? "গরু" : "Cow"}</th>
              <th className="num">{language === "bn" ? "পরিমাণ ৳" : "Amount ৳"}</th>
              <th>{language === "bn" ? "মন্তব্য" : "Note"}</th>
            </tr>
          </thead>
          <tbody>
            {filteredExpenses.map((x) => (
              <tr key={x.id}>
                <td>{x.date}</td>
                <td>{x.c}</td>
                <td>{x.w}</td>
                <td>{x.cow || "—"}</td>
                <td className="num">{x.a.toLocaleString()}</td>
                <td className="muted">{x.note || "—"}</td>
              </tr>
            ))}
            {filteredExpenses.length > 0 && (
              <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
                <td colSpan={4}>{language === "bn" ? "মোট খরচ" : "Total expenses"}</td>
                <td className="num" style={{ color: "var(--warn)" }}>
                  ৳ {totalFiltered.toLocaleString()}
                </td>
                <td></td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add Expense Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "নতুন খরচ যোগ করুন" : "Add farm expense"}
              <small style={{ cursor: "pointer" }} onClick={() => setModalOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleCreateExpense} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "তারিখ" : "Date"}</label>
                <input
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "বিভাগ" : "Category"}</label>
                <select
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                >
                  <option value="Green grass (কাঁচা ঘাস)">Green grass (কাঁচা ঘাস)</option>
                  <option value="Molasses (মলাসেস)">Molasses (মলাসেস)</option>
                  <option value="Dry straw (শুকনা খড়)">Dry straw (শুকনা খড়)</option>
                  <option value="Electric bill">Electric bill</option>
                  <option value="Medicine">Medicine (ওষুধ)</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "শেড" : "Warehouse"}</label>
                <select
                  value={formWh}
                  onChange={(e) => setFormWh(e.target.value)}
                >
                  <option value="Shed A">Shed A</option>
                  <option value="Shed B">Shed B</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "গরুর ট্যাগ" : "Cow (optional)"}</label>
                <input
                  placeholder="Optional tag (e.g. 1047)"
                  value={formCow}
                  onChange={(e) => setFormCow(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "পরিমাণ ৳" : "Amount ৳"} *</label>
                <input
                  type="number"
                  required
                  value={formAmt}
                  onChange={(e) => setFormAmt(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "মন্তব্য" : "Note"}</label>
                <input
                  placeholder="e.g. 2 bags, receipt #402"
                  value={formNote}
                  onChange={(e) => setFormNote(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "সংরক্ষণ করুন" : "Save expense"}
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
