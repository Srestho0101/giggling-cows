"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFarm, type Cow } from "@/context/farm-context";

export function HerdWorkspace() {
  const router = useRouter();
  const { language, cows, addCow } = useFarm();

  const [searchTag, setSearchTag] = useState("");
  const [selectedWh, setSelectedWh] = useState("");
  const [selectedStatus, setSelectedStatus] = useState("");
  const [newCowModalOpen, setNewCowModalOpen] = useState(false);

  // New Cow form state
  const [formTag, setFormTag] = useState("");
  const [formCat, setFormCat] = useState("Milking cow");
  const [formSex, setFormSex] = useState<"F" | "M">("F");
  const [formAge, setFormAge] = useState("3 y");
  const [formWh, setFormWh] = useState("Shed A");
  const [formStatus, setFormStatus] = useState<"Active" | "Pregnant" | "Sold" | "Deceased">("Active");
  const [formWt, setFormWt] = useState("380");
  const [formSource, setFormSource] = useState("Born on farm");

  const filteredCows = cows.filter((c) => {
    const matchTag = c.tag.toLowerCase().includes(searchTag.trim().toLowerCase());
    const matchWh = !selectedWh || c.wh === selectedWh;
    const matchStatus = !selectedStatus || c.st === selectedStatus;
    return matchTag && matchWh && matchStatus;
  });

  const handleCreateCow = (e: React.FormEvent) => {
    e.preventDefault();
    if (!formTag.trim()) return;
    addCow({
      tag: formTag.trim(),
      cat: formCat,
      sex: formSex,
      age: formAge,
      wh: formWh,
      st: formStatus,
      wt: parseFloat(formWt) || 350,
      source: formSource,
    });
    setNewCowModalOpen(false);
    setFormTag("");
  };

  return (
    <section className="screen active" id="herd">
      <div className="filters">
        <input
          className="grow"
          id="hq"
          placeholder={language === "bn" ? "ট্যাগ দিয়ে খুঁজুন" : "Search tag"}
          value={searchTag}
          onChange={(e) => setSearchTag(e.target.value)}
        />
        <select
          id="hw"
          value={selectedWh}
          onChange={(e) => setSelectedWh(e.target.value)}
        >
          <option value="">{language === "bn" ? "সব শেড / গোয়াল" : "All warehouses"}</option>
          <option value="Shed A">Shed A</option>
          <option value="Shed B">Shed B</option>
          <option value="Male Shed">Male Shed</option>
          <option value="Female & Kids Shed">Female & Kids Shed</option>
        </select>
        <select
          id="hs"
          value={selectedStatus}
          onChange={(e) => setSelectedStatus(e.target.value)}
        >
          <option value="">{language === "bn" ? "সব অবস্থা" : "All status"}</option>
          <option value="Active">{language === "bn" ? "সক্রিয়" : "Active"}</option>
          <option value="Pregnant">{language === "bn" ? "গর্ভবতী" : "Pregnant"}</option>
        </select>
        <button type="button" onClick={() => setNewCowModalOpen(true)}>
          {language === "bn" ? "+ নতুন গরু" : "+ New cow"}
        </button>
      </div>

      <div className="card scroll">
        <table>
          <thead>
            <tr>
              <th>{language === "bn" ? "ট্যাগ" : "Tag"}</th>
              <th>{language === "bn" ? "শ্রেণী" : "Category"}</th>
              <th>{language === "bn" ? "লিঙ্গ" : "Sex"}</th>
              <th>{language === "bn" ? "বয়স" : "Age"}</th>
              <th>{language === "bn" ? "শেড" : "Warehouse"}</th>
              <th>{language === "bn" ? "অবস্থা" : "Status"}</th>
              <th className="num">{language === "bn" ? "বর্তমান ওজন" : "Latest weight"}</th>
            </tr>
          </thead>
          <tbody id="herdrows">
            {filteredCows.length > 0 ? (
              filteredCows.map((c) => (
                <tr
                  key={c.cow_id}
                  className="clickable"
                  onClick={() => router.push(`/herd/${c.tag}`)}
                >
                  <td>
                    <b>{c.tag}</b>
                  </td>
                  <td>{c.cat}</td>
                  <td>{c.sex}</td>
                  <td>{c.age}</td>
                  <td>{c.wh}</td>
                  <td>
                    <span className={`tag ${c.st === "Active" ? "good" : c.st === "Pregnant" ? "warn" : ""}`}>
                      {c.st === "Active" && language === "bn"
                        ? "সক্রিয়"
                        : c.st === "Pregnant" && language === "bn"
                        ? "গর্ভবতী"
                        : c.st}
                    </span>
                  </td>
                  <td className="num">{c.wt} kg</td>
                </tr>
              ))
            ) : (
              <tr>
                <td colSpan={7} className="muted" style={{ textAlign: "center", padding: "16px 0" }}>
                  {language === "bn" ? "কোনো গরু পাওয়া যায়নি।" : "No cows match these filters."}
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      <div className="muted" style={{ marginTop: 10 }}>
        {language === "bn" ? "প্রোফাইল দেখতে যে কোনো সারিতে ক্লিক করুন।" : "Click a row to open the cow profile."}
      </div>

      {/* New Cow Modal */}
      {newCowModalOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setNewCowModalOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "নতুন গরু নিবন্ধন করুন" : "Register new cow"}
              <small style={{ cursor: "pointer" }} onClick={() => setNewCowModalOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleCreateCow} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "ট্যাগ নম্বর" : "Tag number"} *</label>
                <input
                  required
                  placeholder="e.g. 1075"
                  value={formTag}
                  onChange={(e) => setFormTag(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "শ্রেণী" : "Category"}</label>
                <select
                  value={formCat}
                  onChange={(e) => setFormCat(e.target.value)}
                >
                  <option value="Milking cow">{language === "bn" ? "দুধেল গাভী" : "Milking cow"}</option>
                  <option value="Heifer">{language === "bn" ? "বকনা" : "Heifer"}</option>
                  <option value="Bull calf">{language === "bn" ? "ষাঁড় বাছুর" : "Bull calf"}</option>
                  <option value="Bull">{language === "bn" ? "ষাঁড়" : "Bull"}</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "লিঙ্গ" : "Sex"}</label>
                <select
                  value={formSex}
                  onChange={(e) => setFormSex(e.target.value as "F" | "M")}
                >
                  <option value="F">{language === "bn" ? "স্ত্রী (F)" : "Female (F)"}</option>
                  <option value="M">{language === "bn" ? "পুরুষ (M)" : "Male (M)"}</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "বয়স" : "Age"}</label>
                <input
                  value={formAge}
                  placeholder="e.g. 3 y"
                  onChange={(e) => setFormAge(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "শেড" : "Warehouse"}</label>
                <select
                  value={formWh}
                  onChange={(e) => setFormWh(e.target.value)}
                >
                  <option value="Shed A">Shed A</option>
                  <option value="Shed B">Shed B</option>
                  <option value="Male Shed">Male Shed</option>
                  <option value="Female & Kids Shed">Female & Kids Shed</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "অবস্থা" : "Status"}</label>
                <select
                  value={formStatus}
                  onChange={(e) => setFormStatus(e.target.value as any)}
                >
                  <option value="Active">{language === "bn" ? "সক্রিয়" : "Active"}</option>
                  <option value="Pregnant">{language === "bn" ? "গর্ভবতী" : "Pregnant"}</option>
                </select>
              </div>

              <div className="row">
                <label>{language === "bn" ? "ওজন (কেজি)" : "Weight (kg)"}</label>
                <input
                  type="number"
                  value={formWt}
                  onChange={(e) => setFormWt(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "উৎস" : "Source"}</label>
                <select
                  value={formSource}
                  onChange={(e) => setFormSource(e.target.value)}
                >
                  <option value="Born on farm">{language === "bn" ? "খামারে জন্ম" : "Born on farm"}</option>
                  <option value="Bought from supplier">{language === "bn" ? "সাপ্লায়ার থেকে ক্রয়" : "Bought from supplier"}</option>
                  <option value="Bought from bazar">{language === "bn" ? "হাট থেকে ক্রয়" : "Bought from bazar"}</option>
                </select>
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "সংরক্ষণ করুন" : "Save cow"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setNewCowModalOpen(false)}
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
