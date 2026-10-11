"use client";

import { useState } from "react";
import { useFarm, type MilkGroup } from "@/context/farm-context";

export function TodayWorkspace() {
  const {
    language,
    toast,
    milkGroups,
    addMilkGroup,
    updateMilkGroup,
    deleteMilkGroup,
    expenses,
    addExpense,
    workers,
    toggleWorkerAttendance,
    sales,
    addSale,
    cows,
  } = useFarm();

  // Milk form state
  const [tags, setTags] = useState<string[]>(["1047", "1052", "1061"]);
  const [tagInput, setTagInput] = useState("");
  const [litersInput, setLitersInput] = useState("42.60");
  const [editingGroupId, setEditingGroupId] = useState<string | null>(null);

  // Expense form state
  const [expenseCat, setExpenseCat] = useState("Green grass (কাঁচা ঘাস)");
  const [expenseAmt, setExpenseAmt] = useState("350");
  const [expenseWh, setExpenseWh] = useState("Shed A");

  // Sales form state
  const [saleCustomer, setSaleCustomer] = useState("Hotel Golden Sun");
  const [saleItem, setSaleItem] = useState("Milk (L)");
  const [saleQuantity, setSaleQuantity] = useState("20");
  const [saleUnitPrice, setSaleUnitPrice] = useState("95");

  // Substitute modal state
  const [subModalOpen, setSubModalOpen] = useState(false);
  const [subName, setSubName] = useState("");
  const [subCost, setSubCost] = useState("500");

  // Calculations
  const totalLiters = milkGroups.reduce((acc, g) => acc + g.l, 0);
  const totalMilkedCows = milkGroups.reduce((acc, g) => acc + g.c.length, 0);
  const avgPerCow = totalMilkedCows ? totalLiters / totalMilkedCows : 0;
  const targetLiters = 120;
  const gaugePercent = Math.min(100, Math.max(0, (totalLiters / targetLiters) * 100));

  const totalSalesAmount = sales.reduce((acc, s) => acc + s.t, 0);
  const totalExpenseAmount = expenses.reduce((acc, e) => acc + e.a, 0);
  const presentWorkersCount = workers.filter((w) => w.p).length;

  const currentLitersNum = parseFloat(litersInput) || 0;
  const milkPreviewText = tags.length
    ? language === "bn"
      ? `${tags.length} টি গরু · ${currentLitersNum.toFixed(2)} লি · গড়ে ${(currentLitersNum / tags.length).toFixed(2)} লি`
      : `${tags.length} cows · ${currentLitersNum.toFixed(2)} L · about ${(currentLitersNum / tags.length).toFixed(2)} L each`
    : language === "bn"
    ? "কমপক্ষে একটি গরুর ট্যাগ যোগ করুন"
    : "Add at least one cow tag";

  const salePreviewTotal = (parseFloat(saleQuantity) || 0) * (parseFloat(saleUnitPrice) || 0);

  // Milk tags handling
  const handleTagKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      e.preventDefault();
      const val = tagInput.trim();
      if (!val) return;
      if (tags.includes(val)) {
        toast(language === "bn" ? `ট্যাগ ${val} ইতিমধ্যে এই গ্রুপে আছে` : `Tag ${val} is already in this group`);
      } else {
        setTags([...tags, val]);
        setTagInput("");
      }
    } else if (e.key === "Backspace" && !tagInput && tags.length > 0) {
      setTags(tags.slice(0, -1));
    }
  };

  const removeTag = (index: number) => {
    setTags(tags.filter((_, i) => i !== index));
  };

  const handleSaveMilkGroup = () => {
    const l = parseFloat(litersInput);
    if (!tags.length || !l) {
      toast(language === "bn" ? "গরুর ট্যাগ এবং লিটার পরিমাণ দিন" : "Add cow tags and liters first");
      return;
    }
    if (editingGroupId) {
      updateMilkGroup(editingGroupId, tags, l);
      setEditingGroupId(null);
    } else {
      addMilkGroup(tags, l);
    }
    setTags([]);
    setLitersInput("");
  };

  const handleEditGroup = (group: MilkGroup) => {
    setEditingGroupId(group.id);
    setTags([...group.c]);
    setLitersInput(group.l.toString());
    toast(language === "bn" ? "গ্রুপ পরিবর্তন করা হচ্ছে: সংশোধন করে সংরক্ষণ করুন" : "Editing group: change it, then save");
  };

  // Expense handling
  const handleAddExpense = () => {
    const a = parseFloat(expenseAmt);
    if (!a) {
      toast(language === "bn" ? "টাকার পরিমাণ লিখুন" : "Enter an amount");
      return;
    }
    addExpense(expenseCat, expenseWh, a);
    setExpenseAmt("");
  };

  // Sales handling
  const handleAddSale = () => {
    const q = parseFloat(saleQuantity);
    const p = parseFloat(saleUnitPrice);
    if (!q || !p) {
      toast(language === "bn" ? "পরিমাণ এবং মূল্য লিখুন" : "Enter quantity and price");
      return;
    }
    addSale(saleCustomer, saleItem, q, p);
  };

  // Substitute handling
  const handleSaveSubstitute = () => {
    if (!subName.trim()) {
      toast(language === "bn" ? "বদলি কর্মীর নাম দিন" : "Enter substitute name");
      return;
    }
    setSubModalOpen(false);
    toast(
      language === "bn"
        ? `বদলি কর্মী ${subName} এর ৳ ${subCost} মিল চার্জ হিসেবে রেকর্ড করা হয়েছে`
        : `Substitute ${subName} recorded as a mill charge (৳ ${subCost})`
    );
    setSubName("");
  };

  const absentWorkers = workers.filter((w) => !w.p);

  return (
    <section className="screen active" id="today">
      {/* 4 Stats Cards */}
      <div className="stats">
        <div className="stat hot">
          <span className="muted">{language === "bn" ? "আজকের দুধ" : "Milk today"}</span>
          <b id="s-milk">{totalLiters.toFixed(1)} L</b>
        </div>
        <div className="stat">
          <span className="muted">{language === "bn" ? "বিক্রয়" : "Sales"}</span>
          <b id="s-sales">৳ {totalSalesAmount.toLocaleString()}</b>
        </div>
        <div className="stat">
          <span className="muted">{language === "bn" ? "আজকের খরচ" : "Spent today"}</span>
          <b id="s-exp">৳ {totalExpenseAmount.toLocaleString()}</b>
        </div>
        <div className="stat">
          <span className="muted">{language === "bn" ? "উপস্থিত কর্মী" : "Workers present"}</span>
          <b id="s-att">
            {presentWorkersCount} / {workers.length}
          </b>
        </div>
      </div>

      <div className="grid">
        {/* Left Column Stack */}
        <div className="stack">
          {/* Card: Record milk */}
          <div className="card">
            <h2>
              {language === "bn" ? "দুধ রেকর্ড করুন" : "Record milk"}{" "}
              <small>{language === "bn" ? "ট্যাগ লিখুন, Enter চাপুন" : "Type a tag, press Enter"}</small>
            </h2>

            <div className="two" style={{ gridTemplateColumns: "1.4fr 1fr" }}>
              <div>
                <div className="chips" id="chips">
                  {tags.map((t, idx) => (
                    <span key={idx} className="chip">
                      {t}
                      <button
                        type="button"
                        onClick={() => removeTag(idx)}
                        aria-label={`Remove ${t}`}
                      >
                        ✕
                      </button>
                    </span>
                  ))}
                  <input
                    id="tagin"
                    placeholder={language === "bn" ? "গরুর ট্যাগ" : "Cow tag"}
                    inputMode="numeric"
                    value={tagInput}
                    onChange={(e) => setTagInput(e.target.value)}
                    onKeyDown={handleTagKeyDown}
                  />
                </div>

                <div className="row" style={{ marginTop: 10 }}>
                  <label>{language === "bn" ? "মোট লিটার" : "Total liters"}</label>
                  <input
                    id="lit"
                    value={litersInput}
                    onChange={(e) => setLitersInput(e.target.value)}
                    inputMode="decimal"
                  />
                </div>

                <div className="preview" id="mprev">
                  {milkPreviewText}
                </div>

                <button id="savegrp" onClick={handleSaveMilkGroup}>
                  {editingGroupId
                    ? language === "bn"
                      ? "পরিবর্তন সংরক্ষণ করুন"
                      : "Update group"
                    : language === "bn"
                    ? "গ্রুপ সংরক্ষণ করুন"
                    : "Save group"}
                </button>
              </div>

              {/* Tank gauge: the memorable signature element */}
              <div className="tank">
                <div className="gauge" id="gauge">
                  <div className="fill" id="fill" style={{ height: `${gaugePercent}%` }}></div>
                  <span style={{ bottom: "100%", top: "auto" }}>120L</span>
                </div>
                <div>
                  <div className="big" id="gl">
                    {totalLiters.toFixed(1)}
                  </div>
                  <div className="muted">
                    {language === "bn" ? "লিটার (লক্ষ্যমাত্রা ১২০ লিটার)" : "liters of 120 L target"}
                  </div>
                  <div className="muted" id="gc" style={{ marginTop: 6 }}>
                    {totalMilkedCows > 0
                      ? language === "bn"
                        ? `${totalMilkedCows} টি গরু · গড় ${avgPerCow.toFixed(1)} লি`
                        : `${totalMilkedCows} cows · avg ${avgPerCow.toFixed(1)} L`
                      : ""}
                  </div>
                </div>
              </div>
            </div>

            {/* Milk groups table */}
            <table style={{ marginTop: 12 }}>
              <thead>
                <tr>
                  <th>{language === "bn" ? "গরু" : "Cows"}</th>
                  <th className="num">{language === "bn" ? "মোট লি" : "Total L"}</th>
                  <th className="num">{language === "bn" ? "প্রতিটি" : "Each"}</th>
                  <th></th>
                </tr>
              </thead>
              <tbody id="groups">
                {milkGroups.length > 0 ? (
                  milkGroups.map((g) => (
                    <tr key={g.id}>
                      <td>{g.c.join(", ")}</td>
                      <td className="num">{g.l.toFixed(2)}</td>
                      <td className="num">{(g.l / g.c.length).toFixed(2)}</td>
                      <td className="num">
                        <button
                          className="ghost sm"
                          onClick={() => handleEditGroup(g)}
                          style={{ marginRight: 4 }}
                        >
                          {language === "bn" ? "সম্পাদনা" : "Edit"}
                        </button>
                        <button
                          className="danger sm"
                          onClick={() => deleteMilkGroup(g.id)}
                        >
                          {language === "bn" ? "মুছুন" : "Delete"}
                        </button>
                      </td>
                    </tr>
                  ))
                ) : (
                  <tr>
                    <td colSpan={4} className="muted">
                      {language === "bn"
                        ? "এখনো কোনো দুধ রেকর্ড করা হয়নি। উপরে প্রথম গ্রুপ যোগ করুন।"
                        : "No milk recorded yet. Add the first group above."}
                    </td>
                  </tr>
                )}
              </tbody>
            </table>
          </div>

          {/* Card: Expenses today */}
          <div className="card">
            <h2>{language === "bn" ? "আজকের খরচ" : "Expenses today"}</h2>
            <div className="two">
              <div>
                <div className="row">
                  <label>{language === "bn" ? "বিভাগ" : "Category"}</label>
                  <select
                    id="ecat"
                    value={expenseCat}
                    onChange={(e) => setExpenseCat(e.target.value)}
                  >
                    <option>Green grass (কাঁচা ঘাস)</option>
                    <option>Molasses (মলাসেস)</option>
                    <option>Dry straw (শুকনা খড়)</option>
                    <option>Electric bill</option>
                  </select>
                </div>
                <div className="row">
                  <label>{language === "bn" ? "পরিমাণ ৳" : "Amount ৳"}</label>
                  <input
                    id="eamt"
                    value={expenseAmt}
                    onChange={(e) => setExpenseAmt(e.target.value)}
                    inputMode="numeric"
                  />
                </div>
                <div className="row">
                  <label>{language === "bn" ? "শেড" : "Warehouse"}</label>
                  <select
                    id="ewh"
                    value={expenseWh}
                    onChange={(e) => setExpenseWh(e.target.value)}
                  >
                    <option>Shed A</option>
                    <option>Shed B</option>
                  </select>
                </div>
                <button id="addexp" onClick={handleAddExpense}>
                  {language === "bn" ? "খরচ যোগ করুন" : "Add expense"}
                </button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>{language === "bn" ? "বিভাগ" : "Category"}</th>
                    <th>{language === "bn" ? "শেড" : "Shed"}</th>
                    <th className="num">৳</th>
                  </tr>
                </thead>
                <tbody id="exps">
                  {expenses.map((x) => (
                    <tr key={x.id}>
                      <td>{x.c}</td>
                      <td>{x.w}</td>
                      <td className="num">{x.a.toLocaleString()}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </div>

        {/* Right Column Stack */}
        <div className="stack">
          {/* Card: Attendance */}
          <div className="card">
            <h2>
              {language === "bn" ? "উপস্থিতি" : "Attendance"}{" "}
              <small id="attn">
                {language === "bn"
                  ? `${presentWorkersCount} জন উপস্থিত`
                  : `${presentWorkersCount} present`}
              </small>
            </h2>

            <div id="workers">
              {workers.map((w) => (
                <div key={w.id} className={`worker ${w.p ? "" : "absent"}`}>
                  <div className="avatar">{w.n[0]}</div>
                  <div>
                    <div style={{ fontWeight: 600 }}>{w.n}</div>
                    {!w.p && <div className="muted">{w.note || (language === "bn" ? "অনুপস্থিত" : "absent")}</div>}
                  </div>
                  <div className="switch">
                    <button
                      className={`p ${w.p ? "on" : ""}`}
                      onClick={() => toggleWorkerAttendance(w.id, true)}
                    >
                      {language === "bn" ? "উপস্থিত" : "Present"}
                    </button>
                    <button
                      className={`a ${w.p ? "" : "on"}`}
                      onClick={() => toggleWorkerAttendance(w.id, false)}
                    >
                      {language === "bn" ? "অনুপস্থিত" : "Absent"}
                    </button>
                  </div>
                </div>
              ))}
            </div>

            <div id="subnote" className="muted" style={{ margin: "10px 0" }}>
              {absentWorkers.length > 0
                ? language === "bn"
                  ? `${absentWorkers.map((w) => w.n).join(", ")} অনুপস্থিত। কোনো বদলি কর্মী নিযুক্ত করেছেন?`
                  : `${absentWorkers.map((w) => w.n).join(", ")} absent. Hired a substitute?`
                : language === "bn"
                ? "সবাই আজ উপস্থিত আছেন।"
                : "Everyone is present."}
            </div>

            <div style={{ display: "flex", gap: 8 }}>
              <button
                className="ghost"
                id="sub"
                onClick={() => setSubModalOpen(true)}
              >
                {language === "bn" ? "+ বদলি কর্মী রেকর্ড" : "+ Record substitute"}
              </button>
              <button
                id="saveday"
                onClick={() =>
                  toast(language === "bn" ? "আজকের উপস্থিতি সংরক্ষিত হয়েছে" : "Attendance saved")
                }
              >
                {language === "bn" ? "দিন সংরক্ষণ করুন" : "Save day"}
              </button>
            </div>
          </div>

          {/* Card: Sales */}
          <div className="card">
            <h2>{language === "bn" ? "বিক্রয়" : "Sales"}</h2>
            <div className="row">
              <label>{language === "bn" ? "ক্রেতা" : "Customer"}</label>
              <select
                id="scust"
                value={saleCustomer}
                onChange={(e) => setSaleCustomer(e.target.value)}
              >
                <option>Hotel Golden Sun</option>
                <option>Rahman Sweets</option>
                <option>Walk-in</option>
              </select>
            </div>

            <div className="row">
              <label>{language === "bn" ? "পণ্য" : "Item"}</label>
              <select
                value={saleItem}
                onChange={(e) => setSaleItem(e.target.value)}
              >
                <option>Milk (L)</option>
                <option>Cow dung (bag)</option>
              </select>
            </div>

            <div className="row">
              <label>{language === "bn" ? "পরিমাণ" : "Quantity"}</label>
              <input
                id="sq"
                value={saleQuantity}
                onChange={(e) => setSaleQuantity(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="row">
              <label>{language === "bn" ? "দর ৳" : "Unit price ৳"}</label>
              <input
                id="sp"
                value={saleUnitPrice}
                onChange={(e) => setSaleUnitPrice(e.target.value)}
                inputMode="decimal"
              />
            </div>

            <div className="preview" id="sprev">
              {language === "bn"
                ? `মোট ৳ ${salePreviewTotal.toLocaleString()}`
                : `Total ৳ ${salePreviewTotal.toLocaleString()}`}
            </div>

            <button id="addsale" onClick={handleAddSale}>
              {language === "bn" ? "বিক্রয় যোগ করুন" : "Add sale"}
            </button>

            <table style={{ marginTop: 8 }}>
              <tbody id="sales">
                {sales.map((x) => (
                  <tr key={x.id}>
                    <td>{x.c}</td>
                    <td>{x.i}</td>
                    <td className="num">৳ {x.t.toLocaleString()}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      </div>

      {/* Substitute Modal */}
      {subModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSubModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "বদলি কর্মী যোগ করুন" : "Record substitute worker"}
              <small
                style={{ cursor: "pointer" }}
                onClick={() => setSubModalOpen(false)}
              >
                ✕
              </small>
            </h2>
            <div className="row" style={{ marginTop: 12 }}>
              <label>{language === "bn" ? "নাম" : "Worker name"}</label>
              <input
                value={subName}
                placeholder={language === "bn" ? "বদলি কর্মীর নাম" : "Substitute name"}
                onChange={(e) => setSubName(e.target.value)}
              />
            </div>
            <div className="row">
              <label>{language === "bn" ? "খরচ ৳" : "Cost ৳"}</label>
              <input
                value={subCost}
                onChange={(e) => setSubCost(e.target.value)}
                inputMode="numeric"
              />
            </div>
            <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
              <button onClick={handleSaveSubstitute}>
                {language === "bn" ? "সংরক্ষণ করুন" : "Save substitute"}
              </button>
              <button className="ghost" onClick={() => setSubModalOpen(false)}>
                {language === "bn" ? "বাতিল" : "Cancel"}
              </button>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
