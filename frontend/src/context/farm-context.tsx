"use client";

import React, { createContext, useContext, useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { apiRequest, apiRoutes } from "@/lib/api";

export type Language = "bn" | "en";
export type ThemeMode = "system" | "light" | "dark";

export type Cow = {
  cow_id: string;
  tag: string;
  cat: string;
  sex: "F" | "M";
  age: string;
  wh: string;
  st: "Active" | "Pregnant" | "Sold" | "Deceased";
  wt: number;
  weightHistory?: { date: string; weight: number }[];
  source?: string;
  notes?: string;
};

export type MilkGroup = {
  id: string;
  c: string[];
  l: number;
};

export type ExpenseItem = {
  id: string;
  date: string;
  c: string; // category
  w: string; // warehouse
  cow?: string;
  a: number; // amount
  note?: string;
};

export type Worker = {
  id: string;
  n: string;
  p: boolean; // present
  note?: string;
  base: number;
  absence: number;
  bonus: number;
  paid: boolean;
};

export type SaleItem = {
  id: string;
  date: string;
  c: string; // customer
  i: string; // item
  q: number;
  p: number;
  t: number; // total
};

export type BreedingRecord = {
  id: string;
  c: string; // cow tag
  h: string; // heat date
  i: string; // insemination date
  m: string; // method
  s: "p" | "y" | "n"; // pending, confirmed (yes), not pregnant (no)
  calving?: string;
};

export type HealthRecord = {
  id: string;
  date: string;
  cow: string;
  type: string;
  vet: string;
  cost: number;
  due: string;
  overdue?: boolean;
};

export type MasterItem = {
  id: string;
  category: "warehouses" | "suppliers" | "customers" | "expense_categories" | "market_prices";
  name: string;
  nameBn: string;
  type: string;
};

const INITIAL_COWS: Cow[] = [
  {
    cow_id: "c-1047",
    tag: "1047",
    cat: "Milking cow",
    sex: "F",
    age: "5 y",
    wh: "Shed A",
    st: "Active",
    wt: 412,
    source: "Born on farm",
    weightHistory: [
      { date: "01 Oct 2026", weight: 412 },
      { date: "24 Sep 2026", weight: 408 },
      { date: "17 Sep 2026", weight: 403 },
      { date: "10 Sep 2026", weight: 398 },
    ],
  },
  {
    cow_id: "c-1052",
    tag: "1052",
    cat: "Milking cow",
    sex: "F",
    age: "4 y",
    wh: "Shed A",
    st: "Active",
    wt: 398,
    source: "Born on farm",
    weightHistory: [
      { date: "01 Oct 2026", weight: 398 },
      { date: "24 Sep 2026", weight: 394 },
      { date: "17 Sep 2026", weight: 389 },
    ],
  },
  {
    cow_id: "c-1061",
    tag: "1061",
    cat: "Heifer",
    sex: "F",
    age: "2 y",
    wh: "Shed B",
    st: "Pregnant",
    wt: 340,
    source: "Bought from supplier",
    weightHistory: [
      { date: "01 Oct 2026", weight: 340 },
      { date: "24 Sep 2026", weight: 335 },
      { date: "17 Sep 2026", weight: 330 },
    ],
  },
  {
    cow_id: "c-1030",
    tag: "1030",
    cat: "Bull calf",
    sex: "M",
    age: "1 y",
    wh: "Shed B",
    st: "Active",
    wt: 210,
    source: "Born on farm",
    weightHistory: [
      { date: "01 Oct 2026", weight: 210 },
      { date: "24 Sep 2026", weight: 205 },
      { date: "17 Sep 2026", weight: 198 },
    ],
  },
  {
    cow_id: "c-1012",
    tag: "1012",
    cat: "Milking cow",
    sex: "F",
    age: "6 y",
    wh: "Shed A",
    st: "Active",
    wt: 430,
    source: "Born on farm",
  },
  {
    cow_id: "c-1019",
    tag: "1019",
    cat: "Milking cow",
    sex: "F",
    age: "4 y",
    wh: "Shed A",
    st: "Active",
    wt: 385,
    source: "Born on farm",
  },
];

const INITIAL_GROUPS: MilkGroup[] = [
  { id: "g1", c: ["1012", "1019"], l: 28 },
  { id: "g2", c: ["1047", "1052", "1061"], l: 42.6 },
  { id: "g3", c: ["1030", "1044"], l: 26.1 },
];

const INITIAL_EXPENSES: ExpenseItem[] = [
  { id: "e1", date: "10 Oct 2026", c: "Molasses (মলাসেস)", w: "Shed A", a: 600, note: "2 drums" },
  { id: "e2", date: "10 Oct 2026", c: "Electric bill", w: "Shed B", a: 2400, note: "September bill" },
  { id: "e3", date: "08 Oct 2026", c: "Green grass (কাঁচা ঘাস)", w: "Shed A", a: 350, note: "Bundle" },
];

const INITIAL_WORKERS: Worker[] = [
  { id: "w1", n: "Rahim", p: true, base: 12000, absence: 0, bonus: 0, paid: false },
  { id: "w2", n: "Karim", p: false, note: "sick", base: 11000, absence: 367, bonus: 0, paid: false },
  { id: "w3", n: "Salam", p: true, base: 10500, absence: 0, bonus: 0, paid: false },
  { id: "w4", n: "Jamal", p: true, base: 10500, absence: 0, bonus: 0, paid: false },
];

const INITIAL_SALES: SaleItem[] = [
  { id: "s1", date: "10 Oct 2026", c: "Hotel Golden Sun", i: "Milk 20 L", q: 20, p: 95, t: 1900 },
];

const INITIAL_BREEDING: BreedingRecord[] = [
  { id: "b1", c: "1061", h: "02 Oct", i: "03 Oct", m: "Injection", s: "p" },
  { id: "b2", c: "1052", h: "28 Sep", i: "29 Sep", m: "Injection", s: "y", calving: "22 Jun 2027" },
];

const INITIAL_HEALTH: HealthRecord[] = [
  { id: "h1", date: "28 Sep", cow: "1030", type: "Deworming", vet: "Dr. Hasan", cost: 350, due: "28 Dec", overdue: false },
  { id: "h2", date: "10 Sep", cow: "1047, 1052, 1061", type: "FMD vaccine", vet: "Dr. Hasan", cost: 900, due: "12 Oct", overdue: true },
];

const INITIAL_MASTERS: MasterItem[] = [
  { id: "m1", category: "warehouses", name: "Shed A", nameBn: "শেড এ", type: "Housing" },
  { id: "m2", category: "warehouses", name: "Shed B", nameBn: "শেড বি", type: "Housing" },
  { id: "m3", category: "suppliers", name: "Rahman Livestock", nameBn: "রহমান লাইভস্টক", type: "Registered supplier" },
  { id: "m4", category: "suppliers", name: "Bazar vendor", nameBn: "বাজারের বিক্রেতা", type: "Open market" },
  { id: "m5", category: "customers", name: "Hotel Golden Sun", nameBn: "হোটেল গোল্ডেন সান", type: "Regular buyer" },
  { id: "m6", category: "customers", name: "Rahman Sweets", nameBn: "রহমান সুইটস", type: "Confectionery" },
  { id: "m7", category: "expense_categories", name: "Green grass (কাঁচা ঘাস)", nameBn: "কাঁচা ঘাস", type: "Feed" },
  { id: "m8", category: "expense_categories", name: "Molasses (মলাসেস)", nameBn: "মলাসেস", type: "Feed" },
  { id: "m9", category: "expense_categories", name: "Dry straw (শুকনা খড়)", nameBn: "শুকনা খড়", type: "Feed" },
  { id: "m10", category: "expense_categories", name: "Electric bill", nameBn: "বিদ্যুৎ বিল", type: "Utility" },
  { id: "m11", category: "market_prices", name: "Beef live weight", nameBn: "মাংসের বাজার দর", type: "৳ 520 / kg" },
];

type FarmContextType = {
  language: Language;
  setLanguage: (lang: Language) => void;
  theme: ThemeMode;
  setTheme: (theme: ThemeMode) => void;
  farmDate: Date;
  shiftDate: (days: number) => void;
  formattedDate: string;
  toast: (msg: string) => void;
  toastMsg: string;
  isToastVisible: boolean;
  searchOpen: boolean;
  setSearchOpen: (open: boolean) => void;
  cows: Cow[];
  addCow: (cow: Omit<Cow, "cow_id">) => Cow;
  logCowWeight: (cowId: string, weight: number, dateStr?: string) => void;
  findCowByTag: (tag: string) => Cow | undefined;
  findCowById: (id: string) => Cow | undefined;
  milkGroups: MilkGroup[];
  addMilkGroup: (tags: string[], liters: number) => void;
  updateMilkGroup: (id: string, tags: string[], liters: number) => void;
  deleteMilkGroup: (id: string) => void;
  expenses: ExpenseItem[];
  addExpense: (category: string, warehouse: string, amount: number, note?: string) => void;
  workers: Worker[];
  toggleWorkerAttendance: (workerId: string, present: boolean) => void;
  updateWorkerBonus: (workerId: string, bonus: number) => void;
  markAllSalariesPaid: () => void;
  sales: SaleItem[];
  addSale: (customer: string, item: string, quantity: number, unitPrice: number) => void;
  breedingRecords: BreedingRecord[];
  updatePregnancyStatus: (id: string, status: "y" | "n") => void;
  addBreedingRecord: (record: Omit<BreedingRecord, "id">) => void;
  healthRecords: HealthRecord[];
  addHealthRecord: (record: Omit<HealthRecord, "id">) => void;
  masters: MasterItem[];
  addMasterItem: (item: Omit<MasterItem, "id">) => void;
  t: (key: string) => string;
};

const FarmContext = createContext<FarmContextType | null>(null);

export function FarmProvider({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const [language, setLanguageState] = useState<Language>("bn");
  const [theme, setThemeState] = useState<ThemeMode>("system");
  const [farmDate, setFarmDate] = useState<Date>(() => new Date(2026, 9, 10)); // 10 Oct 2026 default as demo
  const [toastMsg, setToastMsg] = useState("");
  const [isToastVisible, setIsToastVisible] = useState(false);
  const [searchOpen, setSearchOpen] = useState(false);

  // Core entities
  const [cows, setCows] = useState<Cow[]>(INITIAL_COWS);
  const [milkGroups, setMilkGroups] = useState<MilkGroup[]>(INITIAL_GROUPS);
  const [expenses, setExpenses] = useState<ExpenseItem[]>(INITIAL_EXPENSES);
  const [workers, setWorkers] = useState<Worker[]>(INITIAL_WORKERS);
  const [sales, setSales] = useState<SaleItem[]>(INITIAL_SALES);
  const [breedingRecords, setBreedingRecords] = useState<BreedingRecord[]>(INITIAL_BREEDING);
  const [healthRecords, setHealthRecords] = useState<HealthRecord[]>(INITIAL_HEALTH);
  const [masters, setMasters] = useState<MasterItem[]>(INITIAL_MASTERS);

  // Initialize theme and language from storage
  useEffect(() => {
    if (typeof window === "undefined") return;
    const storedLang = localStorage.getItem("cowfarm_lang") as Language | null;
    if (storedLang) setLanguageState(storedLang);

    const storedTheme = localStorage.getItem("cowfarm_theme") as ThemeMode | null;
    if (storedTheme) setThemeState(storedTheme);
  }, []);

  const setLanguage = (lang: Language) => {
    setLanguageState(lang);
    if (typeof window !== "undefined") localStorage.setItem("cowfarm_lang", lang);
  };

  const setTheme = (mode: ThemeMode) => {
    setThemeState(mode);
    if (typeof window !== "undefined") {
      localStorage.setItem("cowfarm_theme", mode);
      const root = document.documentElement;
      if (mode === "system") {
        root.removeAttribute("data-theme");
      } else {
        root.setAttribute("data-theme", mode);
      }
    }
  };

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  // Load live cows from backend API if reachable
  useEffect(() => {
    let active = true;
    apiRequest<Record<string, unknown>[]>(apiRoutes.herd.cows)
      .then((remoteCows) => {
        if (!active || !Array.isArray(remoteCows) || remoteCows.length === 0) return;
        const mapped: Cow[] = remoteCows.map((rc) => ({
          cow_id: String(rc.cow_id ?? rc.id ?? Math.random()),
          tag: String(rc.current_tag_number ?? rc.tag ?? ""),
          cat: String(rc.category ?? "Milking cow"),
          sex: rc.sex === "male" || rc.sex === "M" ? "M" : "F",
          age: rc.birth_date ? `${new Date().getFullYear() - new Date(String(rc.birth_date)).getFullYear()} y` : "3 y",
          wh: String(rc.warehouse_name ?? "Shed A"),
          st: rc.status === "pregnant" ? "Pregnant" : rc.status === "sold" ? "Sold" : rc.status === "deceased" ? "Deceased" : "Active",
          wt: Number(rc.latest_weight_kg ?? 380),
          source: String(rc.acquisition_type ?? "Born on farm"),
          notes: String(rc.notes ?? ""),
        }));

        // Merge with existing initial demo cows so we keep all tags
        setCows((prev) => {
          const existingTags = new Set(prev.map((c) => c.tag));
          const newOnes = mapped.filter((c) => !existingTags.has(c.tag));
          return [...prev, ...newOnes];
        });
      })
      .catch(() => {
        // Safe offline fallback: keep INITIAL_COWS
      });
    return () => {
      active = false;
    };
  }, []);

  const toast = useCallback((msg: string) => {
    setToastMsg(msg);
    setIsToastVisible(true);
    setTimeout(() => {
      setIsToastVisible(false);
    }, 2200);
  }, []);

  const shiftDate = useCallback((days: number) => {
    setFarmDate((cur) => {
      const next = new Date(cur);
      next.setDate(next.getDate() + days);
      return next;
    });
  }, []);

  const formattedDate = farmDate.toLocaleDateString(language === "bn" ? "bn-BD" : "en-GB", {
    day: "2-digit",
    month: "short",
    year: "numeric",
  });

  // Hotkey listener for Ctrl+K
  useEffect(() => {
    function handleKeyDown(e: KeyboardEvent) {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === "k") {
        e.preventDefault();
        setSearchOpen(true);
      }
      if (e.key === "Escape") {
        setSearchOpen(false);
      }
    }
    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, []);

  // Herd mutations
  const addCow = useCallback((cowData: Omit<Cow, "cow_id">) => {
    const newCow: Cow = {
      ...cowData,
      cow_id: "c-" + Date.now(),
      weightHistory: [{ date: "10 Oct 2026", weight: cowData.wt }],
    };
    setCows((prev) => [newCow, ...prev]);
    toast(language === "bn" ? `গরু ${newCow.tag} যুক্ত করা হয়েছে` : `Cow ${newCow.tag} added to herd`);
    return newCow;
  }, [language, toast]);

  const logCowWeight = useCallback((cowId: string, weight: number, dateStr?: string) => {
    const dStr = dateStr ?? "10 Oct 2026";
    setCows((prev) =>
      prev.map((c) => {
        if (c.cow_id !== cowId && c.tag !== cowId) return c;
        const currentHist = c.weightHistory ?? [];
        return {
          ...c,
          wt: weight,
          weightHistory: [{ date: dStr, weight }, ...currentHist],
        };
      })
    );
    toast(language === "bn" ? "ওজন সংরক্ষিত হয়েছে" : "Weight record saved");
  }, [language, toast]);

  const findCowByTag = useCallback(
    (tag: string) => cows.find((c) => c.tag.toLowerCase() === tag.trim().toLowerCase()),
    [cows]
  );

  const findCowById = useCallback(
    (id: string) => cows.find((c) => c.cow_id === id || c.tag === id),
    [cows]
  );

  // Milk group operations
  const addMilkGroup = useCallback(
    (tags: string[], liters: number) => {
      const newGroup: MilkGroup = { id: "g-" + Date.now(), c: tags, l: liters };
      setMilkGroups((prev) => [...prev, newGroup]);
      toast(language === "bn" ? "গ্রুপ সংরক্ষিত হয়েছে" : "Group saved");
    },
    [language, toast]
  );

  const updateMilkGroup = useCallback(
    (id: string, tags: string[], liters: number) => {
      setMilkGroups((prev) => prev.map((g) => (g.id === id ? { ...g, c: tags, l: liters } : g)));
      toast(language === "bn" ? "গ্রুপ পরিবর্তন করা হয়েছে" : "Group updated");
    },
    [language, toast]
  );

  const deleteMilkGroup = useCallback(
    (id: string) => {
      setMilkGroups((prev) => prev.filter((g) => g.id !== id));
      toast(language === "bn" ? "গ্রুপ মুছে ফেলা হয়েছে" : "Group deleted");
    },
    [language, toast]
  );

  // Expenses operations
  const addExpense = useCallback(
    (category: string, warehouse: string, amount: number, note?: string) => {
      const newExp: ExpenseItem = {
        id: "e-" + Date.now(),
        date: "10 Oct 2026",
        c: category,
        w: warehouse,
        a: amount,
        note,
      };
      setExpenses((prev) => [newExp, ...prev]);
      toast(language === "bn" ? "খরচ যোগ করা হয়েছে" : "Expense added");
    },
    [language, toast]
  );

  // Worker attendance operations
  const toggleWorkerAttendance = useCallback(
    (workerId: string, present: boolean) => {
      setWorkers((prev) =>
        prev.map((w) => {
          if (w.id !== workerId) return w;
          return {
            ...w,
            p: present,
            absence: present ? 0 : Math.round(w.base / 30),
          };
        })
      );
    },
    []
  );

  const updateWorkerBonus = useCallback((workerId: string, bonus: number) => {
    setWorkers((prev) => prev.map((w) => (w.id === workerId ? { ...w, bonus } : w)));
  }, []);

  const markAllSalariesPaid = useCallback(() => {
    setWorkers((prev) => prev.map((w) => ({ ...w, paid: true })));
    toast(language === "bn" ? "সব বেতন পরিশোধিত হিসেবে চিহ্নিত করা হয়েছে" : "Salaries marked as paid");
  }, [language, toast]);

  // Sales operations
  const addSale = useCallback(
    (customer: string, item: string, quantity: number, unitPrice: number) => {
      const newSale: SaleItem = {
        id: "s-" + Date.now(),
        date: "10 Oct 2026",
        c: customer,
        i: `${item} ${quantity} ${item.includes("Milk") ? "L" : "bag"}`,
        q: quantity,
        p: unitPrice,
        t: quantity * unitPrice,
      };
      setSales((prev) => [...prev, newSale]);
      toast(language === "bn" ? "বিক্রয় যোগ করা হয়েছে" : "Sale added");
    },
    [language, toast]
  );

  // Breeding operations
  const updatePregnancyStatus = useCallback(
    (id: string, status: "y" | "n") => {
      setBreedingRecords((prev) =>
        prev.map((b) => (b.id === id ? { ...b, s: status, calving: status === "y" ? "22 Jun 2027" : undefined } : b))
      );
      toast(language === "bn" ? "গর্ভধারণের ফলাফল সংরক্ষিত হয়েছে" : "Pregnancy check saved");
    },
    [language, toast]
  );

  const addBreedingRecord = useCallback(
    (record: Omit<BreedingRecord, "id">) => {
      setBreedingRecords((prev) => [{ ...record, id: "b-" + Date.now() }, ...prev]);
      toast(language === "bn" ? "নতুন প্রজনন রেকর্ড যুক্ত হয়েছে" : "Breeding record added");
    },
    [language, toast]
  );

  // Health operations
  const addHealthRecord = useCallback(
    (record: Omit<HealthRecord, "id">) => {
      setHealthRecords((prev) => [{ ...record, id: "h-" + Date.now() }, ...prev]);
      toast(language === "bn" ? "চিকিৎসা রেকর্ড যুক্ত হয়েছে" : "Health record added");
    },
    [language, toast]
  );

  // Masters operations
  const addMasterItem = useCallback(
    (item: Omit<MasterItem, "id">) => {
      setMasters((prev) => [...prev, { ...item, id: "m-" + Date.now() }]);
      toast(language === "bn" ? "মৌলিক তথ্য যোগ হয়েছে" : "Master item added");
    },
    [language, toast]
  );

  // Bilingual translation dictionary
  const t = useCallback(
    (key: string): string => {
      const dict: Record<string, { bn: string; en: string }> = {
        app_title: { bn: "Cow Farm", en: "Cow Farm" },
        today: { bn: "আজ", en: "Today" },
        herd: { bn: "পাল", en: "Herd" },
        purchases: { bn: "ক্রয়", en: "Purchases" },
        breeding: { bn: "প্রজনন", en: "Breeding" },
        health: { bn: "স্বাস্থ্য", en: "Health" },
        expenses: { bn: "খরচ", en: "Expenses" },
        payroll: { bn: "বেতন", en: "Payroll" },
        reports: { bn: "রিপোর্ট", en: "Reports" },
        masters: { bn: "মৌলিক তথ্য", en: "Masters" },
        milk_today: { bn: "আজকের দুধ", en: "Milk today" },
        sales_today: { bn: "বিক্রয়", en: "Sales" },
        spent_today: { bn: "আজকের খরচ", en: "Spent today" },
        workers_present: { bn: "উপস্থিত কর্মী", en: "Workers present" },
        record_milk: { bn: "দুধ রেকর্ড করুন", en: "Record milk" },
        press_enter_hint: { bn: "ট্যাগ লিখুন, Enter চাপুন", en: "Type a tag, press Enter" },
        cow_tag: { bn: "গরুর ট্যাগ", en: "Cow tag" },
        total_liters: { bn: "মোট লিটার", en: "Total liters" },
        save_group: { bn: "গ্রুপ সংরক্ষণ করুন", en: "Save group" },
        liters_of_target: { bn: "লিটার (লক্ষ্যমাত্রা ১২০ লিটার)", en: "liters of 120 L target" },
        attendance: { bn: "উপস্থিতি", en: "Attendance" },
        present: { bn: "উপস্থিত", en: "Present" },
        absent: { bn: "অনুপস্থিত", en: "Absent" },
        substitute_record: { bn: "+ বদলি কর্মী রেকর্ড", en: "+ Record substitute" },
        save_day: { bn: "দিন সংরক্ষণ করুন", en: "Save day" },
        add_expense: { bn: "খরচ যোগ করুন", en: "Add expense" },
        add_sale: { bn: "বিক্রয় যোগ করুন", en: "Add sale" },
        search_cow_tag: { bn: "ট্যাগ দিয়ে গরু খুঁজুন", en: "Find cow by tag" },
        new_cow: { bn: "+ নতুন গরু", en: "+ New cow" },
        back_to_herd: { bn: "◀ পালে ফিরে যান", en: "◀ Back to herd" },
        purchase_evaluator: { bn: "ক্রয় মূল্যায়নকারী", en: "Purchase evaluator" },
        estimated_net_weight: { bn: "আনুমানিক মাংসের ওজন", en: "Estimated net weight" },
        net_price_per_kg: { bn: "কেজি প্রতি কার্যকর মূল্য", en: "Net price per kg" },
        market_price_per_kg: { bn: "বাজার দর (প্রতি কেজি)", en: "Market price per kg" },
        profitable: { bn: "লাভজনক", en: "Profitable" },
        not_profitable: { bn: "অলাভজনক", en: "Not profitable" },
        buy: { bn: "কিনুন", en: "Buy" },
        return_seller: { bn: "বিক্রেতাকে ফেরত দিন", en: "Return to seller" },
        mark_all_paid: { bn: "সব বেতন পরিশোধ চিহ্নিত করুন", en: "Mark all paid" },
        export_excel: { bn: "এক্সেল এক্সপোর্ট", en: "Export Excel" },
        export_pdf: { bn: "পিডিএফ এক্সপোর্ট", en: "Export PDF" },
        profit_and_loss: { bn: "লাভ ও ক্ষতি", en: "Profit and loss" },
        herd_summary: { bn: "পালের সারসংক্ষেপ", en: "Herd summary" },
      };
      const entry = dict[key];
      if (!entry) return key;
      return language === "bn" ? entry.bn : entry.en;
    },
    [language]
  );

  return (
    <FarmContext.Provider
      value={{
        language,
        setLanguage,
        theme,
        setTheme,
        farmDate,
        shiftDate,
        formattedDate,
        toast,
        toastMsg,
        isToastVisible,
        searchOpen,
        setSearchOpen,
        cows,
        addCow,
        logCowWeight,
        findCowByTag,
        findCowById,
        milkGroups,
        addMilkGroup,
        updateMilkGroup,
        deleteMilkGroup,
        expenses,
        addExpense,
        workers,
        toggleWorkerAttendance,
        updateWorkerBonus,
        markAllSalariesPaid,
        sales,
        addSale,
        breedingRecords,
        updatePregnancyStatus,
        addBreedingRecord,
        healthRecords,
        addHealthRecord,
        masters,
        addMasterItem,
        t,
      }}
    >
      {children}
    </FarmContext.Provider>
  );
}

export function useFarm() {
  const context = useContext(FarmContext);
  if (!context) throw new Error("useFarm must be used within a FarmProvider");
  return context;
}
