export type UserRole = "admin" | "manager" | "data_entry";

export interface CurrentUser {
  id: string;
  email: string | null;
  role: UserRole;
  permissions: {
    can_manage_users: boolean;
    can_view_financial_reports: boolean;
    can_record_payments: boolean;
    can_edit_operational_data: boolean;
  };
}

export interface Warehouse {
  warehouse_id: string;
  name: string;
  housing_type: string;
  capacity: number;
  is_archived: boolean;
  current_occupancy: number;
  created_at: string;
}

export interface Supplier {
  supplier_id: string;
  name: string;
  phone: string | null;
  supplier_type: string;
  is_archived: boolean;
  created_at: string;
}

export interface Cow {
  cow_id: string;
  current_tag_number: string;
  sex: "male" | "female";
  category: string;
  birth_date: string | null;
  acquisition_type: "born_on_farm" | "bought_from_supplier" | "bought_from_bazar";
  acquisition_date: string;
  purchase_price: string | null;
  supplier_id: string | null;
  supplier_name: string | null;
  dam_id: string | null;
  dam_tag: string | null;
  sire_id: string | null;
  sire_tag: string | null;
  warehouse_id: string;
  warehouse_name: string | null;
  status: "active" | "sold" | "deceased" | "archived";
  notes: string | null;
  latest_weight_kg: string | null;
  is_archived: boolean;
  created_at: string;
}

export interface CowDetail extends Cow {
  id_history: {
    history_id: string;
    tag_number: string;
    tag_type: string;
    assigned_date: string;
    removed_date: string | null;
    reason: string | null;
  }[];
  warehouse_history: {
    movement_id: string;
    warehouse_id: string;
    warehouse_name: string | null;
    moved_in_date: string;
    moved_out_date: string | null;
    reason: string | null;
  }[];
  weight_records: {
    weight_id: string;
    weigh_date: string;
    weight_kg: string;
  }[];
}

export interface MarketPrice {
  market_price_id: string;
  price_date: string;
  price_per_kg_net: string;
  source: string | null;
}

export interface PurchaseEvaluation {
  evaluation_id: string;
  evaluation_date: string;
  supplier_id: string | null;
  supplier_name: string | null;
  live_weight_kg: string;
  growth_potential: "good" | "poor";
  net_weight_percent: string;
  est_net_weight_kg: string;
  offered_price: string;
  net_price_per_kg: string;
  market_price_id: string | null;
  market_price_per_kg: string;
  is_profitable: boolean;
  decision: "bought" | "returned" | "pending";
  cow_id: string | null;
  cow_tag_number: string | null;
  notes: string | null;
  created_at: string;
}

export interface EvaluationPreviewResult {
  live_weight_kg: string;
  growth_potential: string;
  net_weight_percent: string;
  est_net_weight_kg: string;
  offered_price: string;
  net_price_per_kg: string;
  market_price_per_kg: string;
  is_profitable: boolean;
  price_difference_per_kg: string;
  total_projected_margin: string;
}

export interface ExpenseCategory {
  category_id: string;
  name: string;
  name_bn: string;
  category_group: "food" | "miscellaneous";
}

export interface FeedType {
  feed_type_id: string;
  category_id: string;
  category_name?: string;
  name: string;
  name_bn: string;
  unit: string;
  unit_cost: string;
  is_archived: boolean;
}

export interface FeedingRecord {
  feeding_id: string;
  feed_type_id: string;
  feed_name: string | null;
  feed_name_bn: string | null;
  unit: string | null;
  cow_id: string | null;
  cow_tag_number: string | null;
  feeding_date: string;
  quantity: string;
  cost: string;
  notes: string | null;
}

export interface Expense {
  expense_id: string;
  category_id: string;
  category_name: string | null;
  category_name_bn: string | null;
  warehouse_id: string | null;
  warehouse_name: string | null;
  cow_id: string | null;
  cow_tag_number: string | null;
  expense_date: string;
  amount: string;
  description: string | null;
}

export interface Worker {
  worker_id: string;
  name: string;
  phone: string | null;
  role: string;
  join_date: string;
  monthly_salary: string;
  status: "active" | "inactive";
}

export interface WorkerAttendance {
  attendance_id: string;
  worker_id: string;
  worker_name: string | null;
  attendance_date: string;
  is_present: boolean;
  note: string | null;
}

export interface SalaryPayment {
  payment_id: string;
  worker_id: string;
  worker_name: string | null;
  pay_month: string;
  base_salary: string;
  absence_deduction: string;
  bonus: string;
  net_paid: string;
  paid_date: string;
  status: "paid" | "pending" | "cancelled";
}

export interface MillCharge {
  mill_charge_id: string;
  charge_date: string;
  charge_type: "worker_food" | "substitute_worker" | "other";
  amount: string;
  substitute_name: string | null;
  description: string | null;
}

export interface HealthRecord {
  health_id: string;
  cow_id: string;
  cow_tag_number: string | null;
  record_type: "treatment" | "vaccination" | "deworming" | "checkup";
  record_date: string;
  vet_name: string | null;
  details: string | null;
  cost: string;
  next_due_date: string | null;
}

export interface BreedingRecord {
  breeding_id: string;
  cow_id: string;
  cow_tag_number: string | null;
  heat_date: string | null;
  seed_date: string;
  conception_date: string | null;
  method: "artificial_insemination" | "natural";
  sire_id: string | null;
  sire_tag_number: string | null;
  semen_code: string | null;
  semen_provider: string | null;
  doctor_name: string | null;
  cost: string;
  outcome: "pending" | "successful" | "failed";
  notes: string | null;
}

export interface PregnancyReport {
  pregnancy_id: string;
  cow_id: string;
  cow_tag_number: string | null;
  breeding_id: string | null;
  report_date: string;
  status: "confirmed" | "suspected" | "failed" | "calved" | "aborted";
  expected_calving_date: string | null;
  actual_calving_date: string | null;
  notes: string | null;
}

export interface Customer {
  customer_id: string;
  name: string;
  phone: string | null;
  customer_type: "individual" | "dairy_shop" | "wholesaler" | "meat_buyer";
  is_archived: boolean;
  total_invoiced: string;
  total_paid: string;
  current_balance: string;
}

export interface MilkProduction {
  milk_id: string;
  cow_id: string;
  cow_tag_number: string | null;
  production_date: string;
  session: "morning" | "evening";
  liters: string;
}

export interface SalesInvoiceLine {
  line_id: string;
  invoice_id: string;
  item_type: "milk" | "animal" | "other";
  cow_id: string | null;
  cow_tag_number: string | null;
  description: string;
  quantity: string;
  unit_price: string;
  line_total: string;
}

export interface SalePayment {
  payment_id: string;
  invoice_id: string;
  payment_date: string;
  amount: string;
  payment_method: "cash" | "bank" | "bKash" | "Nagad" | "other";
  reference_number: string | null;
  notes: string | null;
}

export interface SalesInvoice {
  invoice_id: string;
  invoice_number: string;
  customer_id: string;
  customer_name: string | null;
  invoice_date: string;
  due_date: string | null;
  status: "draft" | "issued" | "partially_paid" | "paid" | "void";
  subtotal: string;
  discount: string;
  total_amount: string;
  paid_amount: string;
  outstanding_balance: string;
  notes: string | null;
  lines: SalesInvoiceLine[];
  payments: SalePayment[];
}

export interface DashboardOverview {
  total_cows: number;
  active_cows: number;
  sold_cows: number;
  deceased_cows: number;
  cows_by_category: Record<string, number>;
  cows_by_warehouse: Record<string, number>;
  milk_today_liters: string;
  milk_this_week_liters: string;
  milk_this_month_liters: string;
  month_invoiced_revenue: string;
  month_cash_collected: string;
  month_total_expenses: string;
  total_unpaid_receivables: string;
  alerts: {
    id: string;
    cow_tag: string;
    item_type: string;
    due_date: string;
    days_overdue: number;
    description: string;
  }[];
}

export interface ProfitabilityReport {
  start_date: string;
  end_date: string;
  milk_revenue: string;
  cow_sales_revenue: string;
  other_sales_revenue: string;
  total_invoiced_revenue: string;
  cash_collected: string;
  receivables_uncollected: string;
  cow_acquisition_cost: string;
  feed_consumption_cost: string;
  general_expenses: string;
  health_and_breeding_cost: string;
  labor_salary_paid: string;
  mill_charges: string;
  total_costs: string;
  accrual_net_profit: string;
  cash_net_margin: string;
  profit_margin_percent: string;
}
