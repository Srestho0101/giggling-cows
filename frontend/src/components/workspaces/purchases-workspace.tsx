"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFarm } from "@/context/farm-context";

type EvaluationRecord = {
  id: string;
  date: string;
  supplier: string;
  weight: number;
  offeredPrice: number;
  marketPrice: number;
  netWeight: number;
  netPricePerKg: number;
  decision: "bought" | "returned" | "pending";
};

export function PurchasesWorkspace() {
  const router = useRouter();
  const { language, toast, addCow } = useFarm();

  const [supplier, setSupplier] = useState("Bazar vendor");
  const [liveWeight, setLiveWeight] = useState("350");
  const [growthPotential, setGrowthPotential] = useState("60"); // 60% or 54%
  const [offeredPrice, setOfferedPrice] = useState("105000");
  const [marketPricePerKg, setMarketPricePerKg] = useState("520");

  const [history, setHistory] = useState<EvaluationRecord[]>([
    {
      id: "ev-1",
      date: "09 Oct 2026",
      supplier: "Haque Traders",
      weight: 380,
      offeredPrice: 114000,
      marketPrice: 520,
      netWeight: 228,
      netPricePerKg: 500,
      decision: "bought",
    },
    {
      id: "ev-2",
      date: "05 Oct 2026",
      supplier: "Bazar vendor",
      weight: 310,
      offeredPrice: 102000,
      marketPrice: 510,
      netWeight: 167.4,
      netPricePerKg: 609,
      decision: "returned",
    },
  ]);

  // Buy Registration Modal State
  const [buyModalOpen, setBuyModalOpen] = useState(false);
  const [newTag, setNewTag] = useState("");
  const [newWarehouse, setNewWarehouse] = useState("Shed A");

  // Live calculation
  const w = parseFloat(liveWeight) || 0;
  const pc = parseFloat(growthPotential) || 60;
  const o = parseFloat(offeredPrice) || 0;
  const m = parseFloat(marketPricePerKg) || 0;

  const netWeight = (w * pc) / 100;
  const netPricePerKg = netWeight ? o / netWeight : 0;
  const isProfitable = netPricePerKg > 0 && netPricePerKg < m;
  const diffPerKg = Math.abs(m - netPricePerKg);

  const handleBuyClick = () => {
    // Generate suggested tag
    setNewTag(`10${Math.floor(70 + Math.random() * 20)}`);
    setBuyModalOpen(true);
  };

  const handleConfirmBuy = (e: React.FormEvent) => {
    e.preventDefault();
    if (!newTag.trim()) return;

    // Add to herd
    addCow({
      tag: newTag.trim(),
      cat: "Milking cow",
      sex: "F",
      age: "3 y",
      wh: newWarehouse,
      st: "Active",
      wt: w,
      source: `Bought from ${supplier}`,
    });

    // Add to history
    setHistory((prev) => [
      {
        id: "ev-" + Date.now(),
        date: "10 Oct 2026",
        supplier,
        weight: w,
        offeredPrice: o,
        marketPrice: m,
        netWeight,
        netPricePerKg,
        decision: "bought",
      },
      ...prev,
    ]);

    setBuyModalOpen(false);
    toast(language === "bn" ? `গরু ${newTag} কেনা হয়েছে এবং পালে যোগ করা হয়েছে` : `Cow ${newTag} bought and registered into herd`);
  };

  const handleReturnClick = () => {
    setHistory((prev) => [
      {
        id: "ev-" + Date.now(),
        date: "10 Oct 2026",
        supplier,
        weight: w,
        offeredPrice: o,
        marketPrice: m,
        netWeight,
        netPricePerKg,
        decision: "returned",
      },
      ...prev,
    ]);
    toast(language === "bn" ? "বিক্রেতাকে ফেরত হিসেবে চিহ্নিত করা হয়েছে" : "Marked as returned to seller");
  };

  return (
    <section className="screen active" id="purchases">
      <div className="two">
        {/* Left Card: Purchase evaluator */}
        <div className="card">
          <h2>{language === "bn" ? "ক্রয় মূল্যায়নকারী" : "Purchase evaluator"}</h2>

          <div className="row">
            <label>{language === "bn" ? "সাপ্লায়ার" : "Supplier"}</label>
            <select
              value={supplier}
              onChange={(e) => setSupplier(e.target.value)}
            >
              <option>Bazar vendor</option>
              <option>Haque Traders</option>
              <option>Rahman Livestock</option>
            </select>
          </div>

          <div className="row">
            <label>{language === "bn" ? "জীবন্ত ওজন কেজি" : "Live weight kg"}</label>
            <input
              id="pw"
              value={liveWeight}
              onChange={(e) => setLiveWeight(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div className="row">
            <label>{language === "bn" ? "বৃদ্ধি সম্ভাবনা" : "Growth potential"}</label>
            <select
              id="pg"
              value={growthPotential}
              onChange={(e) => setGrowthPotential(e.target.value)}
            >
              <option value="60">{language === "bn" ? "ভালো (৬০–৬২%)" : "Good (60–62%)"}</option>
              <option value="54">{language === "bn" ? "সাধারণ (৫৪–৫৫%)" : "Poor (54–55%)"}</option>
            </select>
          </div>

          <div className="row">
            <label>{language === "bn" ? "প্রস্তাবিত দাম ৳" : "Offered price ৳"}</label>
            <input
              id="pp"
              value={offeredPrice}
              onChange={(e) => setOfferedPrice(e.target.value)}
              inputMode="decimal"
            />
          </div>

          <div className="row">
            <label>{language === "bn" ? "বাজার দর ৳/কেজি" : "Market ৳/kg"}</label>
            <input
              id="pm"
              value={marketPricePerKg}
              onChange={(e) => setMarketPricePerKg(e.target.value)}
              inputMode="decimal"
            />
          </div>
        </div>

        {/* Right Card: Result */}
        <div className="card">
          <h2>{language === "bn" ? "ফলাফল" : "Result"}</h2>

          <table>
            <tbody id="pres">
              <tr>
                <td>{language === "bn" ? "আনুমানিক মাংসের ওজন" : "Estimated net weight"}</td>
                <td className="num">{netWeight.toFixed(0)} kg</td>
              </tr>
              <tr>
                <td>{language === "bn" ? "কেজি প্রতি কার্যকর মূল্য" : "Net price per kg"}</td>
                <td className="num">৳ {netPricePerKg.toFixed(2)}</td>
              </tr>
              <tr>
                <td>{language === "bn" ? "বাজার দর প্রতি কেজি" : "Market price per kg"}</td>
                <td className="num">৳ {m.toFixed(2)}</td>
              </tr>
            </tbody>
          </table>

          {/* Verdict Box */}
          <div className={`verdict ${isProfitable ? "yes" : "no"}`} id="pv">
            {isProfitable ? "✔" : "✖"}
            <div>
              {isProfitable
                ? language === "bn"
                  ? "লাভজনক"
                  : "Profitable"
                : language === "bn"
                ? "অলাভজনক"
                : "Not profitable"}
              <small>
                {isProfitable
                  ? language === "bn"
                    ? `বাজারের চেয়ে প্রতি কেজিতে ৳ ${diffPerKg.toFixed(2)} সাশ্রয়`
                    : `৳ ${diffPerKg.toFixed(2)} per kg below market`
                  : language === "bn"
                  ? `বাজারের চেয়ে প্রতি কেজিতে ৳ ${diffPerKg.toFixed(2)} বেশি`
                  : `৳ ${diffPerKg.toFixed(2)} per kg above market`}
              </small>
            </div>
          </div>

          <div style={{ display: "flex", gap: 8 }}>
            <button id="buy" onClick={handleBuyClick}>
              {language === "bn" ? "কিনুন" : "Buy"}
            </button>
            <button className="ghost" id="ret" onClick={handleReturnClick}>
              {language === "bn" ? "বিক্রেতাকে ফেরত দিন" : "Return to seller"}
            </button>
          </div>
        </div>
      </div>

      {/* Evaluation History Table */}
      <div className="card scroll" style={{ marginTop: 14 }}>
        <h2>{language === "bn" ? "মূল্যায়নের ইতিহাস" : "Evaluation history"}</h2>
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "তারিখ" : "Date"}</th>
              <th>{language === "bn" ? "সাপ্লায়ার" : "Supplier"}</th>
              <th className="num">{language === "bn" ? "ওজন (কেজি)" : "Weight kg"}</th>
              <th className="num">{language === "bn" ? "দাম ৳" : "Offered ৳"}</th>
              <th className="num">{language === "bn" ? "মাংস দর ৳/কেজি" : "Net ৳/kg"}</th>
              <th>{language === "bn" ? "সিদ্ধান্ত" : "Decision"}</th>
            </tr>
          </thead>
          <tbody>
            {history.map((h) => (
              <tr key={h.id}>
                <td>{h.date}</td>
                <td>{h.supplier}</td>
                <td className="num">{h.weight}</td>
                <td className="num">৳ {h.offeredPrice.toLocaleString()}</td>
                <td className="num">৳ {h.netPricePerKg.toFixed(1)}</td>
                <td>
                  <span className={`tag ${h.decision === "bought" ? "good" : "bad"}`}>
                    {h.decision === "bought"
                      ? language === "bn"
                        ? "কেনা হয়েছে"
                        : "Bought"
                      : language === "bn"
                      ? "ফেরত"
                      : "Returned"}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Buy & Register Modal */}
      {buyModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setBuyModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "ক্রয় নিশ্চিত করুন ও পালে যুক্ত করুন" : "Confirm purchase & register cow"}
              <small style={{ cursor: "pointer" }} onClick={() => setBuyModalOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleConfirmBuy} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "ট্যাগ নম্বর" : "Tag number"} *</label>
                <input
                  required
                  value={newTag}
                  onChange={(e) => setNewTag(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "শেড" : "Warehouse"}</label>
                <select
                  value={newWarehouse}
                  onChange={(e) => setNewWarehouse(e.target.value)}
                >
                  <option value="Shed A">Shed A</option>
                  <option value="Shed B">Shed B</option>
                </select>
              </div>

              <div className="preview">
                {language === "bn"
                  ? `ওজন: ${w} কেজি · মূল্য: ৳ ${o.toLocaleString()} · সাপ্লায়ার: ${supplier}`
                  : `Weight: ${w} kg · Price: ৳ ${o.toLocaleString()} · Supplier: ${supplier}`}
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "ক্রয় নিশ্চিত করুন" : "Confirm purchase"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setBuyModalOpen(false)}
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
