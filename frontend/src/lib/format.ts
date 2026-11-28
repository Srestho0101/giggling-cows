export type AppLanguage = "en" | "bn";

export function numberLocale(lang: AppLanguage = "en"): string {
  return lang === "bn" ? "bn-BD" : "en-BD";
}

export function formatNumber(
  value: unknown,
  digits = 2,
  lang: AppLanguage = "en"
): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(numberLocale(lang), {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(num);
}

export function formatInteger(value: unknown, lang: AppLanguage = "en"): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat(numberLocale(lang), {
    maximumFractionDigits: 0,
  }).format(num);
}

export function formatMoney(value: unknown, lang: AppLanguage = "en"): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `৳ ${new Intl.NumberFormat(numberLocale(lang), {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  }).format(num)}`;
}

const BANGLA_DIGITS = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];

export function toDisplayDigits(text: string, lang: AppLanguage = "en"): string {
  if (lang !== "bn") return text;
  return text.replace(/\d/g, (d) => BANGLA_DIGITS[Number(d)] ?? d);
}

/** Format ISO YYYY-MM-DD (or YYYY-MM) as DD/MM/YYYY (or MM/YYYY). */
export function formatDateDisplay(
  iso: string | null | undefined,
  lang: AppLanguage = "en"
): string {
  if (!iso) return "—";
  const clean = iso.trim();
  const ymd = clean.match(/^(\d{4})-(\d{2})-(\d{2})/);
  if (ymd) {
    return toDisplayDigits(`${ymd[3]}/${ymd[2]}/${ymd[1]}`, lang);
  }
  const ym = clean.match(/^(\d{4})-(\d{2})$/);
  if (ym) {
    return toDisplayDigits(`${ym[2]}/${ym[1]}`, lang);
  }
  return toDisplayDigits(clean, lang);
}

export function isoToDmy(iso: string | null | undefined): string {
  if (!iso) return "";
  const m = iso.trim().match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (!m) return "";
  return `${m[3]}/${m[2]}/${m[1]}`;
}

export function dmyToIso(dmy: string): string | null {
  const trimmed = dmy.trim();
  if (!trimmed) return "";
  const isoMatch = trimmed.match(/^(\d{4})-(\d{2})-(\d{2})$/);
  if (isoMatch) return trimmed;
  const dmyMatch = trimmed.match(/^(\d{1,2})[/-](\d{1,2})[/-](\d{4})$/);
  if (!dmyMatch) return null;
  const day = Number(dmyMatch[1]);
  const month = Number(dmyMatch[2]);
  const year = Number(dmyMatch[3]);
  if (month < 1 || month > 12 || day < 1 || day > 31) return null;
  const dt = new Date(Date.UTC(year, month - 1, day));
  if (
    dt.getUTCFullYear() !== year ||
    dt.getUTCMonth() !== month - 1 ||
    dt.getUTCDate() !== day
  ) {
    return null;
  }
  return `${year}-${String(month).padStart(2, "0")}-${String(day).padStart(2, "0")}`;
}

const ENUM_LABELS: Record<string, { en: string; bn: string }> = {
  // Statuses
  active: { en: "Active", bn: "সক্রিয়" },
  inactive: { en: "Inactive", bn: "নিষ্ক্রিয়" },
  sold: { en: "Sold", bn: "বিক্রিত" },
  deceased: { en: "Deceased", bn: "মৃত" },
  archived: { en: "Archived", bn: "আর্কাইভড" },
  draft: { en: "Draft", bn: "খসড়া" },
  issued: { en: "Issued", bn: "ইস্যুকৃত" },
  partially_paid: { en: "Partially Paid", bn: "আংশিক পরিশোধিত" },
  paid: { en: "Paid", bn: "পরিশোধিত" },
  void: { en: "Void", bn: "বাতিল" },
  pending: { en: "Pending", bn: "অপেক্ষমাণ" },
  cancelled: { en: "Cancelled", bn: "বাতিল" },
  canceled: { en: "Cancelled", bn: "বাতিল" },
  confirmed: { en: "Confirmed", bn: "নিশ্চিত" },
  suspected: { en: "Suspected", bn: "সম্ভাব্য" },
  failed: { en: "Failed", bn: "ব্যর্থ" },
  successful: { en: "Successful", bn: "সফল" },
  calved: { en: "Calved", bn: "বাচ্চা প্রসব করেছে" },
  aborted: { en: "Aborted", bn: "গর্ভপাত" },
  bought: { en: "Bought", bn: "ক্রয়কৃত" },
  returned: { en: "Returned", bn: "ফেরত" },
  // Categories & cow types
  dairy: { en: "Dairy", bn: "দুগ্ধবতী" },
  beef: { en: "Beef", bn: "মাংস উৎপাদন" },
  "duel-purpose": { en: "Dual-purpose", bn: "দ্বৈত-উদ্দেশ্য" },
  "dual-purpose": { en: "Dual-purpose", bn: "দ্বৈত-উদ্দেশ্য" },
  female: { en: "Female", bn: "গাভী / বকনা" },
  male: { en: "Male", bn: "ষাঁড় / বাছুর" },
  deshi: { en: "Deshi", bn: "দেশি" },
  friesian: { en: "Friesian", bn: "ফ্রিজিয়ান" },
  other: { en: "Other / Unknown", bn: "অন্যান্য / অজানা" },
  "bull calf": { en: "Bull Calf", bn: "এঁড়ে বাছুর" },
  "heifer calf": { en: "Heifer Calf", bn: "বকনা বাছুর" },
  bull: { en: "Bull", bn: "ষাঁড়" },
  cow: { en: "Cow", bn: "গাভী" },
  heifer: { en: "Heifer", bn: "বকনা" },
  ox: { en: "Ox", bn: "বলদ" },
  "deshi calf": { en: "Deshi Calf", bn: "দেশি বাছুর" },
  "friesian calf": { en: "Friesian Calf", bn: "ফ্রিজিয়ান বাছুর" },
  calf: { en: "Calf", bn: "বাছুর" },
  medium: { en: "Medium", bn: "মাঝারি" },
  adult: { en: "Adult", bn: "প্রাপ্তবয়স্ক" },
  // Customer / supplier types
  individual: { en: "Individual", bn: "ব্যক্তিগত ক্রেতা" },
  dairy_shop: { en: "Dairy Shop", bn: "দুগ্ধ দোকান" },
  wholesaler: { en: "Wholesaler", bn: "পাইকার" },
  meat_buyer: { en: "Meat Buyer", bn: "মাংস ক্রেতা" },
  farm: { en: "Farm", bn: "খামার" },
  market: { en: "Market", bn: "বাজার" },
  // Acquisition types
  born_on_farm: { en: "Born on Farm", bn: "খামারে জন্ম" },
  bought_from_supplier: { en: "Bought from Supplier", bn: "সরবরাহকারী থেকে কেনা" },
  bought_from_bazar: { en: "Bought from Bazar", bn: "হাট/বাজার থেকে কেনা" },
  // Breeding & health
  artificial_insemination: { en: "Artificial Insemination", bn: "কৃত্রিম প্রজনন" },
  natural: { en: "Natural", bn: "স্বাভাবিক প্রজনন" },
  on_farm: { en: "On-farm", bn: "খামারের ষাঁড়" },
  external_semen: { en: "External AI", bn: "বাইরের সিমেন" },
  normal: { en: "Normal", bn: "স্বাভাবিক" },
  assisted: { en: "Assisted", bn: "সহায়তাপ্রাপ্ত" },
  c_section: { en: "C-section", bn: "সিজারিয়ান" },
  treatment: { en: "Treatment", bn: "চিকিৎসা" },
  vaccination: { en: "Vaccination", bn: "টিকা" },
  deworming: { en: "Deworming", bn: "কৃমিনাশক" },
  checkup: { en: "Checkup", bn: "স্বাস্থ্য পরীক্ষা" },
  // Sessions & invoice items
  morning: { en: "Morning", bn: "সকাল" },
  noon: { en: "Noon", bn: "দুপুর" },
  evening: { en: "Evening", bn: "সন্ধ্যা" },
  milk: { en: "Milk", bn: "দুধ" },
  animal: { en: "Animal", bn: "গরু" },
  // Labor & charges
  caretaker: { en: "Caretaker", bn: "তত্ত্বাবধায়ক" },
  milker: { en: "Milker", bn: "দোহনকারী" },
  cleaner: { en: "Cleaner", bn: "পরিচ্ছন্নতাকর্মী" },
  night_guard: { en: "Night Guard", bn: "নৈশপ্রহরী" },
  substitute_worker: { en: "Substitute Worker", bn: "বদলি শ্রমিক" },
  worker_food: { en: "Worker Food", bn: "শ্রমিকদের খাবার" },
  // Market price basis
  dressed_meat: { en: "Dressed Meat", bn: "ড্রেসড মাংস" },
  live_weight: { en: "Live Weight", bn: "জীবন্ত ওজন" },
  // Housing & groups
  tie_stall: { en: "Tie Stall", bn: "বাঁধা স্টল" },
  shed: { en: "Shed", bn: "শেড" },
  pen: { en: "Pen", bn: "খোঁয়াড়" },
  isolation: { en: "Isolation", bn: "আইসোলেশন" },
  food: { en: "Food", bn: "খাদ্য" },
  miscellaneous: { en: "Miscellaneous", bn: "বিবিধ" },
};

export function formatEnumLabel(value: unknown, lang: AppLanguage = "en"): string {
  if (value === null || value === undefined || value === "") return "—";
  const raw = String(value).trim();
  const key = raw.toLowerCase();
  const mapped = ENUM_LABELS[key];
  if (mapped) return mapped[lang];
  return raw
    .replaceAll("_", " ")
    .replace(/\b\w/g, (ch) => ch.toUpperCase());
}

export function formatDaysOnFarm(
  value: unknown,
  lang: AppLanguage = "en"
): string {
  if (value === null || value === undefined || value === "") return "—";
  const n = Number(value);
  if (!Number.isFinite(n) || n < 0) return "—";
  const numStr = formatInteger(n, lang);
  if (lang === "bn") return `${numStr} দিন`;
  return `${numStr} ${n === 1 ? "day" : "days"}`;
}

export function formatAgeDisplay(
  value: string | null | undefined,
  lang: AppLanguage = "en"
): string {
  if (!value) return "—";
  const trimmed = value.trim();
  if (!trimmed) return "—";
  if (lang !== "bn") return trimmed;
  return toDisplayDigits(
    trimmed
      .replace(/\byears?\b/gi, "বছর")
      .replace(/\bmonths?\b/gi, "মাস")
      .replace(/\bdays?\b/gi, "দিন"),
    "bn"
  );
}

export const isMoneyKey = (key: string): boolean =>
  /(amount|price|cost|salary|paid|balance|total_invoiced|outstanding|bonus|deduction|overtime|net_price_per_kg|price_per_kg_net|offered_price|unit_cost|total_cost)$/i.test(
    key
  );

export const isNumericKey = (key: string): boolean =>
  isMoneyKey(key) ||
  /(total|liters|weight|quantity|kg|capacity|occupancy|percent|reorder_level|stock_quantity)$/i.test(
    key
  );
