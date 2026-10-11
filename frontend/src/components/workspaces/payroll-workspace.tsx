"use client";

import { useState } from "react";
import { useFarm } from "@/context/farm-context";

export function PayrollWorkspace() {
  const { language, workers, updateWorkerBonus, markAllSalariesPaid } = useFarm();
  const [selectedMonth, setSelectedMonth] = useState("October 2026");

  const totalBase = workers.reduce((acc, w) => acc + w.base, 0);
  const totalAbsence = workers.reduce((acc, w) => acc + w.absence, 0);
  const totalBonus = workers.reduce((acc, w) => acc + w.bonus, 0);
  const totalNet = totalBase - totalAbsence + totalBonus;

  return (
    <section className="screen active" id="payroll">
      <div className="filters">
        <select value={selectedMonth} onChange={(e) => setSelectedMonth(e.target.value)}>
          <option value="October 2026">October 2026</option>
          <option value="September 2026">September 2026</option>
          <option value="August 2026">August 2026</option>
        </select>
        <button id="paid" type="button" onClick={markAllSalariesPaid}>
          {language === "bn" ? "সব বেতন পরিশোধ চিহ্নিত করুন" : "Mark all paid"}
        </button>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "কর্মী" : "Worker"}</th>
              <th className="num">{language === "bn" ? "মূল বেতন ৳" : "Base ৳"}</th>
              <th className="num">{language === "bn" ? "অনুপস্থিতি কর্তন ৳" : "Absence ৳"}</th>
              <th>{language === "bn" ? "বোনাস ৳" : "Bonus ৳"}</th>
              <th className="num">{language === "bn" ? "মোট প্রদেয় ৳" : "Net ৳"}</th>
              <th>{language === "bn" ? "পরিশোধ" : "Paid"}</th>
            </tr>
          </thead>
          <tbody id="prow">
            {workers.map((w) => {
              const netPay = w.base - w.absence + w.bonus;
              return (
                <tr key={w.id}>
                  <td>
                    <b>{w.n}</b>
                  </td>
                  <td className="num">{w.base.toLocaleString()}</td>
                  <td className="num" style={{ color: w.absence > 0 ? "var(--warn)" : "inherit" }}>
                    {w.absence > 0 ? `−${w.absence}` : "0"}
                  </td>
                  <td>
                    <input
                      style={{ width: 90 }}
                      value={w.bonus || ""}
                      placeholder="0"
                      onChange={(e) => updateWorkerBonus(w.id, parseFloat(e.target.value) || 0)}
                      inputMode="numeric"
                    />
                  </td>
                  <td className="num">
                    <b>৳ {netPay.toLocaleString()}</b>
                  </td>
                  <td>
                    <span className={`tag ${w.paid ? "good" : ""}`}>
                      {w.paid
                        ? language === "bn"
                          ? "পরিশোধিত"
                          : "Paid"
                        : language === "bn"
                        ? "বাকি"
                        : "Unpaid"}
                    </span>
                  </td>
                </tr>
              );
            })}
            <tr style={{ fontWeight: 700, borderTop: "2px solid var(--line)" }}>
              <td>{language === "bn" ? "মোট" : "Total"}</td>
              <td className="num">৳ {totalBase.toLocaleString()}</td>
              <td className="num" style={{ color: "var(--warn)" }}>
                {totalAbsence > 0 ? `−৳ ${totalAbsence.toLocaleString()}` : "৳ 0"}
              </td>
              <td>৳ {totalBonus.toLocaleString()}</td>
              <td className="num" style={{ color: "var(--accent)", fontSize: 15 }}>
                ৳ {totalNet.toLocaleString()}
              </td>
              <td></td>
            </tr>
          </tbody>
        </table>
      </div>
    </section>
  );
}
