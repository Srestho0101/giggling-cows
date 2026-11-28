import { formatIsoDate } from "@/components/workspace-date";

export type MilkSession = "morning" | "noon" | "evening";

export type WeightRecord = {
  weight_id: string;
  cow_id: string;
  weigh_date: string;
  weight_kg: string | number;
  is_archived: boolean;
  created_at?: string | null;
};

export type WarehouseHistoryItem = {
  movement_id: string;
  cow_id: string;
  warehouse_id: string;
  warehouse_name?: string | null;
  moved_in_date: string;
  moved_out_date?: string | null;
  reason?: string | null;
};

export type OffspringItem = {
  cow_id: string;
  current_tag_number: string;
  sex: string;
  category: string;
  cow_type?: string | null;
  birth_date?: string | null;
  status: string;
  other_parent_id?: string | null;
  other_parent_tag?: string | null;
  conception_method?: string | null;
  birth_weight_kg?: string | number | null;
};

export type CowPedigreeNode = {
  cow_id?: string | null;
  sire_registry_id?: string | null;
  label: string;
  is_external: boolean;
};

export type CowPedigree = {
  dam?: CowPedigreeNode | null;
  sire?: CowPedigreeNode | null;
  maternal_grand_dam?: CowPedigreeNode | null;
  maternal_grand_sire?: CowPedigreeNode | null;
  paternal_grand_dam?: CowPedigreeNode | null;
  paternal_grand_sire?: CowPedigreeNode | null;
  related_sire_ids: string[];
  related_sire_cow_ids: string[];
};

export type CowOriginContext = {
  calving_id: string;
  pregnancy_id: string;
  breeding_id?: string | null;
  dam_id: string;
  dam_tag?: string | null;
  sire_display_name?: string | null;
  conception_method?: string | null;
  insemination_date?: string | null;
  calving_date: string;
  gestation_days?: number | null;
  calving_ease: string;
  birth_weight_kg?: string | number | null;
  littermates: OffspringItem[];
};

export type CowReproductiveSummary = {
  state: "open" | "bred" | "suspected_pregnant" | "pregnant" | "vwp";
  days_pregnant?: number | null;
  days_since_breeding?: number | null;
  expected_calving_date?: string | null;
  dry_off_date?: string | null;
  next_breeding_eligible_date?: string | null;
  active_pregnancy_id?: string | null;
  latest_open_breeding_id?: string | null;
};

export type CowSaleRecord = {
  sale_date?: string | null;
  sale_price?: string | number | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  buyer_address?: string | null;
  buyer_type?: string | null;
  customer_id?: string | null;
  invoice_id?: string | null;
  invoice_number?: string | null;
  invoice_status?: string | null;
  paid_amount?: string | number | null;
  outstanding_balance?: string | number | null;
  notes?: string | null;
};

export type CowDetail = {
  cow_id: string;
  current_tag_number: string;
  sex: "male" | "female";
  category: string;
  cow_type?: string | null;
  breed?: "deshi" | "friesian" | "other" | null;
  color?: string | null;
  marking?: string | null;
  profile_picture_url?: string | null;
  birth_date?: string | null;
  acquisition_type: "born_on_farm" | "bought_from_supplier" | "bought_from_bazar";
  acquisition_date: string;
  purchase_price?: string | number | null;
  supplier_id?: string | null;
  supplier_name?: string | null;
  dam_id?: string | null;
  dam_tag?: string | null;
  sire_id?: string | null;
  sire_tag?: string | null;
  sire_registry_id?: string | null;
  sire_display_name?: string | null;
  origin_calving_id?: string | null;
  birth_weight_kg?: string | number | null;
  warehouse_id: string;
  warehouse_name?: string | null;
  status: "active" | "sold" | "deceased" | "archived";
  gives_milk: boolean;
  milking_sessions: MilkSession[];
  sold_date?: string | null;
  sale_price?: string | number | null;
  buyer_name?: string | null;
  buyer_phone?: string | null;
  buyer_address?: string | null;
  sale_notes?: string | null;
  notes?: string | null;
  is_archived: boolean;
  age?: string | null;
  age_group?: string | null;
  latest_weight_kg?: string | number | null;
  days_on_farm?: number | null;
  warehouse_history: WarehouseHistoryItem[];
  weight_records: WeightRecord[];
  offspring: OffspringItem[];
  sale_record?: CowSaleRecord | null;
  origin_context?: CowOriginContext | null;
  pedigree?: CowPedigree | null;
  reproductive_summary?: CowReproductiveSummary | null;
};

export type HealthRecord = {
  health_id: string;
  cow_id: string;
  record_type: string;
  record_date: string;
  vet_name?: string | null;
  details?: string | null;
  cost: string | number;
  next_due_date?: string | null;
  is_archived: boolean;
};

export type SireItem = {
  sire_id: string;
  source_type: "on_farm" | "external_semen";
  cow_id?: string | null;
  cow_tag_number?: string | null;
  bull_name?: string | null;
  semen_code?: string | null;
  provider?: string | null;
  breed?: string | null;
  notes?: string | null;
  display_name?: string | null;
  is_archived: boolean;
};

export type BreedingRecord = {
  breeding_id: string;
  cow_id: string;
  cow_tag_number?: string | null;
  heat_date?: string | null;
  seed_date: string;
  conception_date?: string | null;
  method: string;
  sire_id?: string | null;
  sire_registry_id?: string | null;
  sire_tag_number?: string | null;
  sire_display_name?: string | null;
  semen_code?: string | null;
  semen_provider?: string | null;
  doctor_name?: string | null;
  cost: string | number;
  outcome: string;
  notes?: string | null;
  is_archived: boolean;
};

export type PregnancyReport = {
  pregnancy_id: string;
  cow_id: string;
  cow_tag_number?: string | null;
  breeding_id?: string | null;
  episode_id?: string | null;
  report_date: string;
  status: string;
  expected_calving_date?: string | null;
  actual_calving_date?: string | null;
  notes?: string | null;
  is_archived: boolean;
};

export type CalvingCalfSummary = {
  cow_id: string;
  current_tag_number: string;
  sex: string;
  birth_weight_kg?: string | number | null;
  status: string;
};

export type CalvingEvent = {
  calving_id: string;
  pregnancy_id: string;
  dam_id: string;
  dam_tag_number?: string | null;
  calving_date: string;
  calving_ease: "normal" | "assisted" | "c_section";
  live_count: number;
  stillborn_count: number;
  notes?: string | null;
  calves: CalvingCalfSummary[];
};

export type PregnancyEpisode = {
  pregnancy_id: string;
  cow_id: string;
  cow_tag_number?: string | null;
  breeding_id?: string | null;
  breeding_seed_date?: string | null;
  sire_registry_id?: string | null;
  sire_display_name?: string | null;
  status: "suspected" | "confirmed" | "calved" | "aborted" | "failed";
  confirmed_date?: string | null;
  expected_calving_date?: string | null;
  dry_off_date?: string | null;
  ended_at?: string | null;
  next_breeding_eligible_date?: string | null;
  notes?: string | null;
  is_archived: boolean;
  checks: PregnancyReport[];
  calving_event?: CalvingEvent | null;
};

export type BreedingActionQueueItem = {
  cow_id: string;
  cow_tag_number: string;
  bucket: "due_for_check" | "due_for_dry_off" | "calving_due" | "open_over_90_days";
  reference_date: string;
  days_value: number;
  breeding_id?: string | null;
  pregnancy_id?: string | null;
  detail: string;
};

export type BreedingSummary = {
  conception_rate_pct?: number | null;
  avg_services_per_conception?: number | null;
  active_pregnant_count: number;
  due_for_check: BreedingActionQueueItem[];
  due_for_dry_off: BreedingActionQueueItem[];
  calving_due: BreedingActionQueueItem[];
  open_over_90_days: BreedingActionQueueItem[];
};

export type MilkRecord = {
  milk_id: string;
  cow_id: string;
  production_date: string;
  session: MilkSession;
  liters: string | number;
  is_archived: boolean;
  is_void: boolean;
  void_reason?: string | null;
};

export type CowExpense = {
  expense_id: string;
  category_name?: string | null;
  expense_date: string;
  amount: string | number;
  description?: string | null;
  is_archived: boolean;
  is_void: boolean;
};

export type CowFeedingRecord = {
  feeding_id: string;
  feed_name?: string | null;
  unit?: string | null;
  feeding_date: string;
  quantity: string | number;
  cost: string | number;
  notes?: string | null;
  is_archived: boolean;
};

export type WarehouseOption = {
  warehouse_id: string;
  name: string;
  housing_type: string;
  capacity: number;
  current_occupancy?: number;
};

export type SupplierOption = {
  supplier_id: string;
  name: string;
};

export type CowListOption = {
  cow_id: string;
  current_tag_number: string;
  sex: string;
  status: string;
};

export function formatMoney(value: string | number | null | undefined): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return `৳ ${new Intl.NumberFormat("en-BD", { maximumFractionDigits: 2 }).format(num)}`;
}

export function formatNumber(value: string | number | null | undefined, digits = 2): string {
  if (value === null || value === undefined || value === "") return "—";
  const num = Number(value);
  if (!Number.isFinite(num)) return "—";
  return new Intl.NumberFormat("en-BD", { minimumFractionDigits: digits, maximumFractionDigits: digits }).format(num);
}

export function formatDisplayDate(iso: string | null | undefined): string {
  if (!iso) return "—";
  return formatIsoDate(iso);
}

export function breedLabel(value: string | null | undefined): string {
  if (value === "deshi") return "Deshi";
  if (value === "friesian") return "Friesian";
  if (value === "other") return "Other / unknown";
  return "—";
}

export function acquisitionLabel(value: string | null | undefined): string {
  if (value === "born_on_farm") return "Born on farm";
  if (value === "bought_from_supplier") return "Bought from supplier";
  if (value === "bought_from_bazar") return "Bought from bazar";
  return value ? value.replaceAll("_", " ") : "—";
}

export function daysBetween(startIso: string, endIso: string): number | null {
  if (!startIso || !endIso) return null;
  const start = Date.parse(`${startIso}T00:00:00Z`);
  const end = Date.parse(`${endIso}T00:00:00Z`);
  if (!Number.isFinite(start) || !Number.isFinite(end)) return null;
  return Math.round((end - start) / 86_400_000);
}

export function computeAgeFromBirthDate(birthDate: string | null | undefined, referenceIso: string): string | null {
  if (!birthDate || !referenceIso || birthDate > referenceIso) return null;
  const [by, bm, bd] = birthDate.split("-").map(Number);
  const [ry, rm, rd] = referenceIso.split("-").map(Number);
  if (!by || !bm || !bd || !ry || !rm || !rd) return null;
  let months = (ry - by) * 12 + (rm - bm);
  if (rd < bd) months -= 1;
  months = Math.max(months, 0);
  const years = Math.floor(months / 12);
  const remMonths = months % 12;
  const parts: string[] = [];
  if (years > 0) parts.push(`${years} ${years === 1 ? "year" : "years"}`);
  if (remMonths > 0 || years === 0) parts.push(`${remMonths} ${remMonths === 1 ? "month" : "months"}`);
  return parts.join(", ");
}

export function sessionLabel(session: MilkSession): string {
  if (session === "morning") return "Morning";
  if (session === "noon") return "Noon";
  return "Evening";
}
