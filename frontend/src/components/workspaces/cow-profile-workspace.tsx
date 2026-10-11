"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFarm, type Cow } from "@/context/farm-context";

const TABS = ["Overview", "Weight", "Milk", "Breeding", "Health", "Expenses", "History"] as const;
type TabType = (typeof TABS)[number];

export function CowProfileWorkspace({ cowTag }: { cowTag: string }) {
  const router = useRouter();
  const { language, cows, logCowWeight, breedingRecords, healthRecords, milkGroups } = useFarm();

  const cow: Cow | undefined = cows.find(
    (c) => c.tag.toLowerCase() === cowTag.toLowerCase() || c.cow_id === cowTag
  );

  const [activeTab, setActiveTab] = useState<TabType>("Overview");
  const [logWeightOpen, setLogWeightOpen] = useState(false);
  const [newWeight, setNewWeight] = useState("");
  const [weightDate, setWeightDate] = useState("10 Oct 2026");

  if (!cow) {
    return (
      <section className="screen active">
        <button className="ghost sm" onClick={() => router.push("/herd")}>
          {language === "bn" ? "◀ পালে ফিরে যান" : "◀ Back to herd"}
        </button>
        <div className="card" style={{ marginTop: 14, textAlign: "center", padding: 32 }}>
          <p className="muted">
            {language === "bn"
              ? `ট্যাগ ${cowTag} এর কোনো গরু খুঁজে পাওয়া যায়নি।`
              : `Cow with tag ${cowTag} was not found.`}
          </p>
        </div>
      </section>
    );
  }

  // Weight history calculation and sparkline
  const weightsList =
    cow.weightHistory && cow.weightHistory.length > 0
      ? cow.weightHistory
      : [
          { date: "01 Oct 2026", weight: cow.wt },
          { date: "24 Sep 2026", weight: cow.wt - 4 },
          { date: "17 Sep 2026", weight: cow.wt - 9 },
          { date: "10 Sep 2026", weight: cow.wt - 14 },
        ];

  const wValues = weightsList.map((w) => w.weight).reverse();
  const maxW = Math.max(...wValues, 1);
  const minW = Math.min(...wValues, 0) - 10;
  const range = maxW - minW || 1;

  const pointsStr = wValues
    .map((w, idx) => {
      const x = 15 + idx * (170 / Math.max(1, wValues.length - 1));
      const y = 52 - ((w - minW) / range) * 42;
      return `${x.toFixed(1)},${y.toFixed(1)}`;
    })
    .join(" ");

  const cowBreeding = breedingRecords.filter((b) => b.c === cow.tag);
  const cowHealth = healthRecords.filter((h) => h.cow.includes(cow.tag));
  const cowMilkGroups = milkGroups.filter((g) => g.c.includes(cow.tag));

  const handleSaveWeight = (e: React.FormEvent) => {
    e.preventDefault();
    const w = parseFloat(newWeight);
    if (!w) return;
    logCowWeight(cow.cow_id, w, weightDate);
    setLogWeightOpen(false);
    setNewWeight("");
  };

  return (
    <section className="screen active" id="cow">
      <button className="ghost sm" id="back" onClick={() => router.push("/herd")}>
        {language === "bn" ? "◀ পালে ফিরে যান" : "◀ Back to herd"}
      </button>

      <div className="card" style={{ marginTop: 12 }}>
        <h2 id="cowh">
          {language === "bn" ? `গরু ${cow.tag}` : `Cow ${cow.tag}`}
          <span className="tag">{cow.cat}</span>
          <span className="tag">{cow.wh}</span>
          <span className={`tag ${cow.st === "Active" ? "good" : "warn"}`}>
            {cow.st === "Active" && language === "bn"
              ? "সক্রিয়"
              : cow.st === "Pregnant" && language === "bn"
              ? "গর্ভবতী"
              : cow.st}
          </span>
        </h2>

        {/* Tab Strip */}
        <div className="tabs" id="ctabs">
          {TABS.map((t) => (
            <button
              key={t}
              className={activeTab === t ? "on" : ""}
              onClick={() => setActiveTab(t)}
            >
              {language === "bn"
                ? t === "Overview"
                  ? "সাধারণ তথ্য"
                  : t === "Weight"
                  ? "ওজন"
                  : t === "Milk"
                  ? "দুধ"
                  : t === "Breeding"
                  ? "প্রজনন"
                  : t === "Health"
                  ? "স্বাস্থ্য"
                  : t === "Expenses"
                  ? "খরচ"
                  : "ইতিহাস"
                : t}
            </button>
          ))}
        </div>

        {/* Tab Body */}
        <div id="cbody">
          {activeTab === "Overview" && (
            <div className="stats" style={{ margin: 0 }}>
              <div className="stat">
                <span className="muted">{language === "bn" ? "ওজন" : "Weight"}</span>
                <b>{cow.wt} kg</b>
              </div>
              <div className="stat">
                <span className="muted">{language === "bn" ? "বয়স" : "Age"}</span>
                <b>{cow.age}</b>
              </div>
              <div className="stat">
                <span className="muted">{language === "bn" ? "লিঙ্গ" : "Sex"}</span>
                <b>
                  {cow.sex === "F"
                    ? language === "bn"
                      ? "স্ত্রী (Female)"
                      : "Female"
                    : language === "bn"
                    ? "পুরুষ (Male)"
                    : "Male"}
                </b>
              </div>
              <div className="stat">
                <span className="muted">{language === "bn" ? "উৎস" : "Source"}</span>
                <b>{cow.source || (language === "bn" ? "খামারে জন্ম" : "Born on farm")}</b>
              </div>
            </div>
          )}

          {activeTab === "Weight" && (
            <div>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
                <svg viewBox="0 0 200 60" style={{ width: 240, maxWidth: "100%", height: 60 }}>
                  <polyline
                    fill="none"
                    stroke="var(--accent)"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    points={pointsStr}
                  />
                </svg>
                <button className="ghost sm" onClick={() => setLogWeightOpen(true)}>
                  {language === "bn" ? "+ নতুন ওজন পরিমাপ" : "+ Log weight"}
                </button>
              </div>

              <table>
                <thead>
                  <tr>
                    <th>{language === "bn" ? "তারিখ" : "Date"}</th>
                    <th className="num">{language === "bn" ? "ওজন" : "Weight"}</th>
                  </tr>
                </thead>
                <tbody>
                  {weightsList.map((item, idx) => (
                    <tr key={idx}>
                      <td>{item.date}</td>
                      <td className="num">{item.weight} kg</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}

          {activeTab === "Milk" && (
            <div>
              <div className="preview">
                {language === "bn"
                  ? "দুধের পরিমাণ গ্রুপ-ভিত্তিক অনুমান, প্রতিটি গ্রুপের গরুদের মধ্যে সমানভাবে বিভক্ত।"
                  : "Milk figures are group-based estimates, split evenly across the cows in each group."}
              </div>
              {cowMilkGroups.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>{language === "bn" ? "গ্রুপের গরুরা" : "Group cows"}</th>
                      <th className="num">{language === "bn" ? "গ্রুপ মোট লিটার" : "Group total L"}</th>
                      <th className="num">{language === "bn" ? "এই গরুর ভাগ" : "Cow share"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowMilkGroups.map((g) => (
                      <tr key={g.id}>
                        <td>{g.c.join(", ")}</td>
                        <td className="num">{g.l.toFixed(2)} L</td>
                        <td className="num">{(g.l / g.c.length).toFixed(2)} L</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted">
                  {language === "bn"
                    ? "আজকের কোনো গ্রুপে এই গরু এখনো রেকর্ড করা হয়নি।"
                    : "No milk recorded for this cow today."}
                </div>
              )}
            </div>
          )}

          {activeTab === "Breeding" && (
            <div>
              {cowBreeding.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>{language === "bn" ? "হিটের তারিখ" : "Heat date"}</th>
                      <th>{language === "bn" ? "গর্ভাধানের তারিখ" : "Insemination"}</th>
                      <th>{language === "bn" ? "পদ্ধতি" : "Method"}</th>
                      <th>{language === "bn" ? "অবস্থা" : "Status"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowBreeding.map((b) => (
                      <tr key={b.id}>
                        <td>{b.h}</td>
                        <td>{b.i}</td>
                        <td>{b.m}</td>
                        <td>
                          <span className={`tag ${b.s === "y" ? "good" : b.s === "p" ? "warn" : "bad"}`}>
                            {b.s === "y"
                              ? language === "bn"
                                ? "গর্ভ নিশ্চিত"
                                : "Confirmed"
                              : b.s === "p"
                              ? language === "bn"
                                ? "পরীক্ষা বাকি"
                                : "Check due"
                              : language === "bn"
                              ? "গর্ভবতী নয়"
                              : "Not pregnant"}
                          </span>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted">
                  {language === "bn"
                    ? "প্রজনন স্ক্রিনে এই গরুর পূর্ণ রেকর্ড দেখতে পারেন।"
                    : "See the Breeding screen for this cow's records."}
                </div>
              )}
            </div>
          )}

          {activeTab === "Health" && (
            <div>
              {cowHealth.length > 0 ? (
                <table>
                  <thead>
                    <tr>
                      <th>{language === "bn" ? "তারিখ" : "Date"}</th>
                      <th>{language === "bn" ? "ধরন" : "Type"}</th>
                      <th>{language === "bn" ? "ডাক্তার" : "Vet"}</th>
                      <th>{language === "bn" ? "পরবর্তী তারিখ" : "Next due"}</th>
                    </tr>
                  </thead>
                  <tbody>
                    {cowHealth.map((h) => (
                      <tr key={h.id}>
                        <td>{h.date}</td>
                        <td>{h.type}</td>
                        <td>{h.vet}</td>
                        <td>{h.due}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted">
                  {language === "bn"
                    ? "১০ সেপ্টেম্বর এফএমডি টিকা সম্পন্ন। পরবর্তী ১২ অক্টোবর।"
                    : "FMD vaccine on 10 Sep. Next due 12 Oct."}
                </div>
              )}
            </div>
          )}

          {activeTab === "Expenses" && (
            <div className="muted">
              {language === "bn"
                ? "এই মাসে এই গরুর নামে সরাসরি কোনো খরচ নেই।"
                : "No cow-specific expenses this month."}
            </div>
          )}

          {activeTab === "History" && (
            <div className="muted">
              {language === "bn"
                ? `ট্যাগ ${cow.tag} জন্মের সময় নির্ধারিত। ০৩ জানুয়ারি ২০২৫ এ ${cow.wh}-এ স্থানান্তর করা হয়।`
                : `Tag ${cow.tag} assigned on birth. Moved to ${cow.wh} on 03 Jan 2025.`}
            </div>
          )}
        </div>
      </div>

      {/* Log Weight Modal */}
      {logWeightOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setLogWeightOpen(false);
          }}
        >
          <div className="modal-card">
            <h2>
              {language === "bn" ? "নতুন ওজন পরিমাপ সংরক্ষণ" : "Log weight measurement"}
              <small style={{ cursor: "pointer" }} onClick={() => setLogWeightOpen(false)}>
                ✕
              </small>
            </h2>

            <form onSubmit={handleSaveWeight} style={{ marginTop: 12 }}>
              <div className="row">
                <label>{language === "bn" ? "তারিখ" : "Date"}</label>
                <input
                  value={weightDate}
                  onChange={(e) => setWeightDate(e.target.value)}
                />
              </div>

              <div className="row">
                <label>{language === "bn" ? "ওজন (কেজি)" : "Weight (kg)"} *</label>
                <input
                  type="number"
                  required
                  placeholder="e.g. 420"
                  value={newWeight}
                  onChange={(e) => setNewWeight(e.target.value)}
                />
              </div>

              <div style={{ display: "flex", gap: 8, marginTop: 14 }}>
                <button type="submit">
                  {language === "bn" ? "সংরক্ষণ করুন" : "Save weight"}
                </button>
                <button
                  type="button"
                  className="ghost"
                  onClick={() => setLogWeightOpen(false)}
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
