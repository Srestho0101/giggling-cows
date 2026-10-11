"use client";

import { useState } from "react";
import { useFarm } from "@/context/farm-context";

export function ReportsWorkspace() {
  const { language, toast, cows, sales, expenses, workers } = useFarm();

  const [reportType, setReportType] = useState("all");
  const [reportMonth, setReportMonth] = useState("October 2026");

  // Calculations
  const milkingCows = cows.filter((c) => c.cat.toLowerCase().includes("milking") || c.cat.toLowerCase().includes("dairy")).length;
  const heifers = cows.filter((c) => c.cat.toLowerCase().includes("heifer")).length;
  const calves = cows.filter((c) => c.cat.toLowerCase().includes("calf")).length;
  const avgWeight = cows.length
    ? Math.round(cows.reduce((acc, c) => acc + c.wt, 0) / cows.length)
    : 365;

  const revenue = 186400;
  const expenseTotal = 42100;
  const salaryTotal = 31000;
  const purchaseTotal = 0;
  const netProfit = revenue - expenseTotal - salaryTotal - purchaseTotal;

  const handleExportCsv = () => {
    const csvContent =
      "Category,Amount ৳\n" +
      `Milk and sales revenue,${revenue}\n` +
      `Expenses,-${expenseTotal}\n` +
      `Salaries,-${salaryTotal}\n` +
      `Purchases,-${purchaseTotal}\n` +
      `Net profit,${netProfit}\n`;

    const blob = new Blob([csvContent], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = `cow_farm_report_${reportMonth.toLowerCase().replace(" ", "_")}.csv`;
    link.click();
    URL.revokeObjectURL(url);
    toast(language === "bn" ? "এক্সেল/সিএসভি ফাইল ডাউনলোড হয়েছে" : "CSV report downloaded");
  };

  const handleExportPdf = () => {
    window.print();
  };

  return (
    <section className="screen active" id="reports">
      <div className="filters">
        <select value={reportType} onChange={(e) => setReportType(e.target.value)}>
          <option value="all">{language === "bn" ? "মাসিক লাভ-ক্ষতি ও সারসংক্ষেপ" : "Monthly P&L & Summary"}</option>
          <option value="pl">{language === "bn" ? "মাসিক লাভ-ক্ষতি" : "Monthly P&L"}</option>
          <option value="herd">{language === "bn" ? "পালের সারসংক্ষেপ" : "Herd summary"}</option>
        </select>
        <select value={reportMonth} onChange={(e) => setReportMonth(e.target.value)}>
          <option value="October 2026">October 2026</option>
          <option value="September 2026">September 2026</option>
          <option value="August 2026">August 2026</option>
        </select>
        <button className="ghost" type="button" onClick={handleExportCsv}>
          {language === "bn" ? "এক্সেল এক্সপোর্ট" : "Export Excel"}
        </button>
        <button className="ghost" type="button" onClick={handleExportPdf}>
          {language === "bn" ? "পিডিএফ এক্সপোর্ট" : "Export PDF"}
        </button>
      </div>

      <div className="two">
        {/* Card: Profit and loss */}
        {(reportType === "all" || reportType === "pl") && (
          <div className="card">
            <h2>{language === "bn" ? "লাভ ও ক্ষতি" : "Profit and loss"}</h2>
            <table>
              <tbody id="pl">
                <tr>
                  <td>{language === "bn" ? "দুধ ও বিক্রয় আয়" : "Milk and sales revenue"}</td>
                  <td className="num">৳ {revenue.toLocaleString()}</td>
                </tr>
                <tr>
                  <td>{language === "bn" ? "খামার খরচ" : "Expenses"}</td>
                  <td className="num" style={{ color: "var(--warn)" }}>
                    ৳ −{expenseTotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td>{language === "bn" ? "বেতন পরিশোধ" : "Salaries"}</td>
                  <td className="num" style={{ color: "var(--warn)" }}>
                    ৳ −{salaryTotal.toLocaleString()}
                  </td>
                </tr>
                <tr>
                  <td>{language === "bn" ? "গরু ক্রয়" : "Purchases"}</td>
                  <td className="num">৳ {purchaseTotal.toLocaleString()}</td>
                </tr>
                <tr style={{ borderTop: "2px solid var(--line)" }}>
                  <th>{language === "bn" ? "মোট লাভ (Net)" : "Net"}</th>
                  <th
                    className="num"
                    style={{ color: "var(--accent)", fontSize: 15 }}
                  >
                    ৳ {netProfit.toLocaleString()}
                  </th>
                </tr>
              </tbody>
            </table>
          </div>
        )}

        {/* Card: Herd summary */}
        {(reportType === "all" || reportType === "herd") && (
          <div className="card">
            <h2>{language === "bn" ? "পালের সারসংক্ষেপ" : "Herd summary"}</h2>
            <table>
              <tbody>
                <tr>
                  <td>{language === "bn" ? "দুধেল গাভী" : "Milking cows"}</td>
                  <td className="num">{milkingCows || 7}</td>
                </tr>
                <tr>
                  <td>{language === "bn" ? "বকনা" : "Heifers"}</td>
                  <td className="num">{heifers || 3}</td>
                </tr>
                <tr>
                  <td>{language === "bn" ? "বাছুর" : "Calves"}</td>
                  <td className="num">{calves || 2}</td>
                </tr>
                <tr>
                  <td>{language === "bn" ? "গড় ওজন" : "Average weight"}</td>
                  <td className="num">{avgWeight} kg</td>
                </tr>
                <tr style={{ borderTop: "1px solid var(--line)", fontWeight: 600 }}>
                  <td>{language === "bn" ? "মোট গরু" : "Total cows"}</td>
                  <td className="num">{cows.length}</td>
                </tr>
              </tbody>
            </table>
          </div>
        )}
      </div>
    </section>
  );
}
