"use client";

import { useState } from "react";
import { useFarm, type BreedingRecord } from "@/context/farm-context";

export function BreedingWorkspace() {
  const { language, breedingRecords, updatePregnancyStatus, addBreedingRecord, cows } = useFarm();

  const [filter, setFilter] = useState("all");
  const [newModalOpen, setNewModalOpen] = useState(false);

  // Form state
  const [cowTag, setCowTag] = useState("1061");
  const [heatDate, setHeatDate] = useState("10 Oct");
  const [insemDate, setInsemDate] = useState("11 Oct");
  const [method, setMethod] = useState("Injection");

  const filteredRecords = breedingRecords.filter((b) => {
    if (filter === "pending") return b.s === "p";
    if (filter === "calving") return b.s === "y";
    return true;
  });

  const handleCreateBreeding = (e: React.FormEvent) => {
    e.preventDefault();
    addBreedingRecord({
      c: cowTag,
      h: heatDate,
      i: insemDate,
      m: method,
      s: "p",
    });
    setNewModalOpen(false);
  };

  return (
    <section className="screen active" id="breeding">
      <div className="filters">
        <select value={filter} onChange={(e) => setFilter(e.target.value)}>
          <option value="all">{language === "bn" ? "সব রেকর্ড" : "All"}</option>
          <option value="pending">{language === "bn" ? "গর্ভধারণ পরীক্ষা বাকি" : "Pending pregnancy check"}</option>
          <option value="calving">{language === "bn" ? "৩০ দিনে বাছুর প্রসব" : "Calving in 30 days"}</option>
        </select>
        <button type="button" onClick={() => setNewModalOpen(true)}>
          {language === "bn" ? "+ নতুন প্রজনন রেকর্ড" : "+ New breeding record"}
        </button>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "গরু" : "Cow"}</th>
              <th>{language === "bn" ? "হিট" : "Heat"}</th>
              <th>{language === "bn" ? "গর্ভাধান" : "Insemination"}</th>
              <th>{language === "bn" ? "পদ্ধতি" : "Method"}</th>
              <th>{language === "bn" ? "অবস্থা" : "Status"}</th>
              <th>{language === "bn" ? "পদক্ষেপ" : "Action"}</th>
            </tr>
          </thead>
          <tbody id="brows">
            {filteredRecords.map((b) => (
              <tr key={b.id}>
                <td>
                  <b>{b.c}</b>
                </td>
                <td>{b.h}</td>
                <td>{b.i}</td>
                <td>{b.m}</td>
                <td>
                  <span className={`tag ${b.s === "p" ? "warn" : b.s === "y" ? "good" : "bad"}`}>
                    {b.s === "p"
                      ? language === "bn"
                        ? "পরীক্ষা বাকি ১৭ অক্টো"
                        : "Check due 17 Oct"
                      : b.s === "y"
                      ? language === "bn"
                        ? "গর্ভ নিশ্চিত"
                        : "Confirmed"
                      : language === "bn"
                      ? "গর্ভবতী নয়"
                      : "Not pregnant"}
                  </span>
                </td>
                <td>
                  {b.s === "p" ? (
                    <div style={{ display: "flex", gap: 4 }}>
                      <button
                        className="ghost sm"
                        onClick={() => updatePregnancyStatus(b.id, "y")}
                      >
                        {language === "bn" ? "গর্ভ নিশ্চিত" : "Confirmed"}
                      </button>
                      <button
                        className="ghost sm"
                        onClick={() => updatePregnancyStatus(b.id, "n")}
                      >
                        {language === "bn" ? "গর্ভবতী নয়" : "Not pregnant"}
                      </button>
                    </div>
                  ) : b.s === "y" ? (
                    <span className="muted">
                      {language === "bn"
                        ? `প্রসবের সম্ভাব্য তারিখ ${b.calving || "২২ জুন ২০২৭"}`
                        : `Calving ${b.calving || "22 Jun 2027"}`}
                    </span>
                  ) : (
                    <span className="muted">
                      {language === "bn" ? "পুনরায় গর্ভাধানের জন্য প্রস্তুত" : "Ready to re-breed"}
                    </span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Breeding Modal */}
      {newModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "নতুন প্রজনন রেকর্ড যোগ করুন" : "Add new breeding record"}
              <small style={{ cursor: "pointer" }} onClick={() => setNewModalOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleCreateBreeding} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "গরুর ট্যাগ" : "Cow tag"}</label>
                <select
                  value={cowTag}
                  onChange={(e) => setCowTag(e.target.value)}
                >
                  {cows.map((c) => (
                    <option key={c.cow_id} value={c.tag}>
                      {c.tag} ({c.cat})
                    </option>
                  ))}
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "হিটের তারিখ" : "Heat date"}</label>
                <input
                  value={heatDate}
                  onChange={(e) => setHeatDate(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "ইনসেমিনেশন তারিখ" : "Insemination"}</label>
                <input
                  value={insemDate}
                  onChange={(e) => setInsemDate(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "পদ্ধতি" : "Method"}</label>
                <select
                  value={method}
                  onChange={(e) => setMethod(e.target.value)}
                >
                  <option value="Injection">{language === "bn" ? "কৃত্রিম প্রজনন / ইনজেকশন" : "Artificial Insemination / Injection"}</option>
                  <option value="Natural">{language === "bn" ? "ষাঁড় দিয়ে স্বাভাবিক প্রজনন" : "Natural mating"}</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "সংরক্ষণ করুন" : "Save record"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setNewModalOpen(false)}
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
