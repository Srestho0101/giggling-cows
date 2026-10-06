import {
  BreedingRecord,
  Cow,
  CowDetail,
  Customer,
  DashboardOverview,
  EvaluationPreviewResult,
  Expense,
  ExpenseCategory,
  FeedingRecord,
  FeedType,
  HealthRecord,
  MarketPrice,
  MilkProduction,
  MillCharge,
  PregnancyReport,
  ProfitabilityReport,
  PurchaseEvaluation,
  SalaryPayment,
  SalesInvoice,
  Supplier,
  Warehouse,
  Worker,
  WorkerAttendance,
} from "@/types/models";

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL || "http://127.0.0.1:8000/api/v1";

async function request<T>(
  path: string,
  options: RequestInit = {},
  authHeaders: Record<string, string> = {}
): Promise<T> {
  const url = `${API_BASE_URL}${path}`;
  const headers = {
    "Content-Type": "application/json",
    ...authHeaders,
    ...options.headers,
  };

  const response = await fetch(url, {
    ...options,
    headers,
  });

  if (!response.ok) {
    let errorDetail = "API Request Failed";
    try {
      const errJson = await response.json();
      errorDetail = errJson.detail || JSON.stringify(errJson);
    } catch {
      errorDetail = await response.text();
    }
    throw new Error(errorDetail);
  }

  return response.json();
}

export const api = {
  // DASHBOARD
  getDashboard: (auth: Record<string, string>) =>
    request<DashboardOverview>("/reports/dashboard", {}, auth),

  getProfitability: (startDate?: string, endDate?: string, auth: Record<string, string> = {}) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    return request<ProfitabilityReport>(`/reports/profitability?${params.toString()}`, {}, auth);
  },

  getProfitabilityCSVUrl: (startDate?: string, endDate?: string) => {
    const params = new URLSearchParams();
    if (startDate) params.append("start_date", startDate);
    if (endDate) params.append("end_date", endDate);
    return `${API_BASE_URL}/reports/profitability/csv?${params.toString()}`;
  },

  // HERD
  getCows: (params: { warehouse_id?: string; status?: string; search?: string } = {}, auth: Record<string, string> = {}) => {
    const q = new URLSearchParams();
    if (params.warehouse_id) q.append("warehouse_id", params.warehouse_id);
    if (params.status) q.append("status", params.status);
    if (params.search) q.append("search", params.search);
    return request<Cow[]>(`/herd/cows?${q.toString()}`, {}, auth);
  },

  getCow: (id: string, auth: Record<string, string> = {}) =>
    request<CowDetail>(`/herd/cows/${id}`, {}, auth),

  createCow: (data: any, auth: Record<string, string> = {}) =>
    request<CowDetail>("/herd/cows", { method: "POST", body: JSON.stringify(data) }, auth),

  updateCow: (id: string, data: any, auth: Record<string, string> = {}) =>
    request<CowDetail>(`/herd/cows/${id}`, { method: "PATCH", body: JSON.stringify(data) }, auth),

  addWeightRecord: (cowId: string, data: { weigh_date: string; weight_kg: number }, auth: Record<string, string> = {}) =>
    request(`/herd/cows/${cowId}/weight`, { method: "POST", body: JSON.stringify(data) }, auth),

  moveWarehouse: (cowId: string, data: { warehouse_id: string; moved_in_date: string; reason?: string }, auth: Record<string, string> = {}) =>
    request<CowDetail>(`/herd/cows/${cowId}/move`, { method: "POST", body: JSON.stringify(data) }, auth),

  getWarehouses: (auth: Record<string, string> = {}) =>
    request<Warehouse[]>("/herd/warehouses", {}, auth),

  getSuppliers: (auth: Record<string, string> = {}) =>
    request<Supplier[]>("/herd/suppliers", {}, auth),

  // EVALUATIONS
  getMarketPrices: (auth: Record<string, string> = {}) =>
    request<MarketPrice[]>("/evaluations/market-prices", {}, auth),

  createMarketPrice: (data: { price_date: string; price_per_kg_net: number; source?: string }, auth: Record<string, string> = {}) =>
    request<MarketPrice>("/evaluations/market-prices", { method: "POST", body: JSON.stringify(data) }, auth),

  previewEvaluation: (data: any, auth: Record<string, string> = {}) =>
    request<EvaluationPreviewResult>("/evaluations/calculate-preview", { method: "POST", body: JSON.stringify(data) }, auth),

  getEvaluations: (auth: Record<string, string> = {}) =>
    request<PurchaseEvaluation[]>("/evaluations", {}, auth),

  createEvaluation: (data: any, auth: Record<string, string> = {}) =>
    request<PurchaseEvaluation>("/evaluations", { method: "POST", body: JSON.stringify(data) }, auth),

  convertEvaluationToCow: (evalId: string, data: any, auth: Record<string, string> = {}) =>
    request<CowDetail>(`/evaluations/${evalId}/convert-to-cow`, { method: "POST", body: JSON.stringify(data) }, auth),

  // FEEDING & EXPENSES
  getExpenseCategories: (auth: Record<string, string> = {}) =>
    request<ExpenseCategory[]>("/feeding/categories", {}, auth),

  getFeedTypes: (auth: Record<string, string> = {}) =>
    request<FeedType[]>("/feeding/feed-types", {}, auth),

  getFeedingRecords: (auth: Record<string, string> = {}) =>
    request<FeedingRecord[]>("/feeding/feeding-records", {}, auth),

  createFeedingRecord: (data: any, auth: Record<string, string> = {}) =>
    request<FeedingRecord>("/feeding/feeding-records", { method: "POST", body: JSON.stringify(data) }, auth),

  getExpenses: (auth: Record<string, string> = {}) =>
    request<Expense[]>("/feeding/expenses", {}, auth),

  createExpense: (data: any, auth: Record<string, string> = {}) =>
    request<Expense>("/feeding/expenses", { method: "POST", body: JSON.stringify(data) }, auth),

  // LABOR
  getWorkers: (auth: Record<string, string> = {}) =>
    request<Worker[]>("/labor/workers", {}, auth),

  createWorker: (data: any, auth: Record<string, string> = {}) =>
    request<Worker>("/labor/workers", { method: "POST", body: JSON.stringify(data) }, auth),

  getDailyAttendance: (dateStr: string, auth: Record<string, string> = {}) =>
    request<WorkerAttendance[]>(`/labor/attendance?attendance_date=${dateStr}`, {}, auth),

  saveBatchAttendance: (data: { attendance_date: string; records: { worker_id: string; is_present: boolean; note?: string }[] }, auth: Record<string, string> = {}) =>
    request<WorkerAttendance[]>("/labor/attendance/batch", { method: "POST", body: JSON.stringify(data) }, auth),

  getSalaryPayments: (auth: Record<string, string> = {}) =>
    request<SalaryPayment[]>("/labor/salary-payments", {}, auth),

  createSalaryPayment: (data: any, auth: Record<string, string> = {}) =>
    request<SalaryPayment>("/labor/salary-payments", { method: "POST", body: JSON.stringify(data) }, auth),

  getMillCharges: (auth: Record<string, string> = {}) =>
    request<MillCharge[]>("/labor/mill-charges", {}, auth),

  createMillCharge: (data: any, auth: Record<string, string> = {}) =>
    request<MillCharge>("/labor/mill-charges", { method: "POST", body: JSON.stringify(data) }, auth),

  // HEALTH & BREEDING
  getHealthRecords: (auth: Record<string, string> = {}) =>
    request<HealthRecord[]>("/health/records", {}, auth),

  createHealthRecord: (data: any, auth: Record<string, string> = {}) =>
    request<HealthRecord>("/health/records", { method: "POST", body: JSON.stringify(data) }, auth),

  getBreedingRecords: (auth: Record<string, string> = {}) =>
    request<BreedingRecord[]>("/health/breeding", {}, auth),

  createBreedingRecord: (data: any, auth: Record<string, string> = {}) =>
    request<BreedingRecord>("/health/breeding", { method: "POST", body: JSON.stringify(data) }, auth),

  getPregnancyReports: (auth: Record<string, string> = {}) =>
    request<PregnancyReport[]>("/health/pregnancy", {}, auth),

  createPregnancyReport: (data: any, auth: Record<string, string> = {}) =>
    request<PregnancyReport>("/health/pregnancy", { method: "POST", body: JSON.stringify(data) }, auth),

  // SALES & INVOICES
  getCustomers: (auth: Record<string, string> = {}) =>
    request<Customer[]>("/sales/customers", {}, auth),

  createCustomer: (data: any, auth: Record<string, string> = {}) =>
    request<Customer>("/sales/customers", { method: "POST", body: JSON.stringify(data) }, auth),

  getMilkRecords: (auth: Record<string, string> = {}) =>
    request<MilkProduction[]>("/sales/milk", {}, auth),

  createMilkRecord: (data: any, auth: Record<string, string> = {}) =>
    request<MilkProduction>("/sales/milk", { method: "POST", body: JSON.stringify(data) }, auth),

  getInvoices: (auth: Record<string, string> = {}) =>
    request<SalesInvoice[]>("/sales/invoices", {}, auth),

  getInvoice: (id: string, auth: Record<string, string> = {}) =>
    request<SalesInvoice>(`/sales/invoices/${id}`, {}, auth),

  createInvoice: (data: any, auth: Record<string, string> = {}) =>
    request<SalesInvoice>("/sales/invoices", { method: "POST", body: JSON.stringify(data) }, auth),

  updateInvoiceStatus: (id: string, status: string, auth: Record<string, string> = {}) =>
    request<SalesInvoice>(`/sales/invoices/${id}/status`, { method: "PATCH", body: JSON.stringify({ status }) }, auth),

  recordPayment: (invoiceId: string, data: any, auth: Record<string, string> = {}) =>
    request(`/sales/invoices/${invoiceId}/payments`, { method: "POST", body: JSON.stringify(data) }, auth),
};
