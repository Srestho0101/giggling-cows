"use client";

import { useState } from "react";
import { useFarm } from "@/context/farm-context";

export function HealthWorkspace() {
  const { language, healthRecords, addHealthRecord } = useFarm();

  const [modalOpen, setModalOpen] = useState(false);
  const [formDate, setFormDate] = useState("10 Oct");
  const [formCow, setFormCow] = useState("1047, 1052");
  const [formType, setFormType] = useState("Deworming");
  const [formVet, setFormVet] = useState("Dr. Hasan");
  const [formCost, setFormCost] = useState("400");
  const [formDue, setFormDue] = useState("10 Jan");

  const handleCreateRecord = (e: React.FormEvent) => {
    e.preventDefault();
    addHealthRecord({
      date: formDate,
      cow: formCow,
      type: formType,
      vet: formVet,
      cost: parseFloat(formCost) || 0,
      due: formDue,
      overdue: false,
    });
    setModalOpen(false);
  };

  return (
    <section className="screen active" id="health">
      {/* Due / Alert banner */}
      <div className="alert">
        ⚠ {language === "bn" ? "এফএমডি (খুরা রোগ) টিকা · শেড এ · নির্ধারিত ১২ অক্টো" : "FMD vaccine · Shed A · due 12 Oct"}{" "}
        <span>{language === "bn" ? "২ দিন বিলম্বিত" : "Overdue 2 days"}</span>
      </div>

      <div className="filters">
        <button type="button" onClick={() => setModalOpen(true)}>
          {language === "bn" ? "+ নতুন স্বাস্থ্য রেকর্ড" : "+ New health record"}
        </button>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "তারিখ" : "Date"}</th>
              <th>{language === "bn" ? "গরু" : "Cow"}</th>
              <th>{language === "bn" ? "ধরন" : "Type"}</th>
              <th>{language === "bn" ? "ডাক্তার" : "Vet"}</th>
              <th className="num">{language === "bn" ? "খরচ ৳" : "Cost ৳"}</th>
              <th>{language === "bn" ? "পরবর্তী তারিখ" : "Next due"}</th>
            </tr>
          </thead>
          <tbody>
            {healthRecords.map((h) => (
              <tr key={h.id}>
                <td>{h.date}</td>
                <td>{h.cow}</td>
                <td>{h.type}</td>
                <td>{h.vet}</td>
                <td className="num">{h.cost.toLocaleString()}</td>
                <td>
                  {h.overdue ? (
                    <span className="tag bad">{h.due}</span>
                  ) : (
                    <span>{h.due}</span>
                  )}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* New Health Modal */}
      {modalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "নতুন স্বাস্থ্য বা টিকা রেকর্ড" : "Add new health / vaccine record"}
              <small style={{ cursor: "pointer" }} onClick={() => setModalOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleCreateRecord} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "তারিখ" : "Date"}</label>
                <input
                  value={formDate}
                  onChange={(e) => setFormDate(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "গরুর ট্যাগ" : "Cow tag(s)"}</label>
                <input
                  placeholder="e.g. 1047, 1052"
                  value={formCow}
                  onChange={(e) => setFormCow(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "ধরন" : "Type"}</label>
                <select
                  value={formType}
                  onChange={(e) => setFormType(e.target.value)}
                >
                  <option value="Deworming">{language === "bn" ? "কৃমিনাশক (Deworming)" : "Deworming"}</option>
                  <option value="FMD vaccine">{language === "bn" ? "এফএমডি টিকা (FMD vaccine)" : "FMD vaccine"}</option>
                  <option value="Anthrax vaccine">{language === "bn" ? "তড়কা টিকা (Anthrax vaccine)" : "Anthrax vaccine"}</option>
                  <option value="Mastitis treatment">{language === "bn" ? "ওলান পাকা চিকিৎসা (Mastitis)" : "Mastitis treatment"}</option>
                  <option value="General checkup">{language === "bn" ? "সাধারণ চেকআপ" : "General checkup"}</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "চিকিৎসক" : "Vet"}</label>
                <input
                  value={formVet}
                  onChange={(e) => setFormVet(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "খরচ ৳" : "Cost ৳"}</label>
                <input
                  type="number"
                  value={formCost}
                  onChange={(e) => setFormCost(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "পরবর্তী তারিখ" : "Next due"}</label>
                <input
                  value={formDue}
                  onChange={(e) => setFormDue(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "সংরক্ষণ করুন" : "Save record"}
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
