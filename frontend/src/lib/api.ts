const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:8000").replace(/\/$/, "");
// const API_BASE_URL = (process.env.NEXT_PUBLIC_API_URL ?? "https://giggling-cows.onrender.com").replace(/\/$/, "");
const API_PREFIX = "/api/v1";

export type ApiRequestOptions = Omit<RequestInit, "body"> & {
  body?: unknown;
  accessToken?: string;
  retryOnce?: boolean;
};

export class ApiError extends Error {
  readonly status: number;
  readonly payload: unknown;

  constructor(status: number, message: string, payload: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.payload = payload;
  }
}

export function apiUrl(path: string): string {
  const normalizedPath = path.startsWith("/") ? path : `/${path}`;
  return `${API_BASE_URL}${API_PREFIX}${normalizedPath}`;
}

export function apiQuery(path: string, values: Record<string, string | number | boolean | undefined>): string {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(values)) {
    if (value !== undefined && value !== "") query.set(key, String(value));
  }
  const suffix = query.toString();
  return suffix ? `${path}?${suffix}` : path;
}

const REQUEST_TIMEOUT_MS = 25_000;

export async function apiRequest<T>(path: string, options: ApiRequestOptions = {}): Promise<T> {
  const { accessToken, headers, body, signal, retryOnce, ...requestOptions } = options;
  const requestHeaders = new Headers(headers);

  if (body !== undefined && !requestHeaders.has("Content-Type")) {
    requestHeaders.set("Content-Type", "application/json");
  }
  if (accessToken) requestHeaders.set("Authorization", `Bearer ${accessToken}`);

  const method = (requestOptions.method ?? "GET").toUpperCase();
  const isIdempotent = ["GET", "HEAD", "OPTIONS", "PUT", "DELETE"].includes(method) || retryOnce === true;
  const maxAttempts = isIdempotent ? 2 : 1;
  let attempts = 0;

  while (attempts < maxAttempts) {
    attempts++;
    const timeout = new AbortController();
    const timer = setTimeout(() => timeout.abort(), REQUEST_TIMEOUT_MS);
    const onAbort = () => timeout.abort();
    signal?.addEventListener("abort", onAbort);

    try {
      const response = await fetch(apiUrl(path), {
        ...requestOptions,
        headers: requestHeaders,
        signal: timeout.signal,
        body: body === undefined ? undefined : JSON.stringify(body),
      });

      if (!response.ok) {
        if (attempts < maxAttempts && [502, 503, 504].includes(response.status)) {
          await new Promise((res) => setTimeout(res, 1200));
          continue;
        }
        const payload = await response.json().catch(() => undefined);
        const message = getErrorMessage(payload) ?? `API request failed (${response.status})`;
        throw new ApiError(response.status, message, payload);
      }

      if (response.status === 204) return undefined as T;
      return (await response.json()) as T;
    } catch (cause) {
      if (cause instanceof ApiError) throw cause;

      if (cause instanceof DOMException && cause.name === "AbortError") {
        if (attempts < maxAttempts) {
          await new Promise((res) => setTimeout(res, 1200));
          continue;
        }
        throw new ApiError(0, "The API took too long to respond. The server may be waking up — please try again.", null);
      }

      if (attempts < maxAttempts) {
        await new Promise((res) => setTimeout(res, 1200));
        continue;
      }

      const msg = cause instanceof Error ? cause.message : "Network error";
      const friendlyMsg = msg === "Failed to fetch"
        ? "Network connection issue or API unreachable. The server may be waking up — please try again in a moment."
        : msg;
      throw new ApiError(0, friendlyMsg, null);
    } finally {
      clearTimeout(timer);
      signal?.removeEventListener("abort", onAbort);
    }
  }

  throw new ApiError(0, "Request failed after retry", null);
}

function getErrorMessage(payload: unknown): string | undefined {
  if (typeof payload !== "object" || payload === null || !("detail" in payload)) return undefined;
  const detail = payload.detail;
  if (typeof detail === "string") return detail;
  if (Array.isArray(detail)) {
    return detail.map((item) => typeof item === "object" && item !== null && "msg" in item ? String(item.msg) : "Invalid request").join(" ");
  }
  return undefined;
}

export const apiRoutes = {
  audit: {
    safeDataOperations: (entityType: string, entityId: string) =>
      `/audit/safe-data-operations?${new URLSearchParams({ entity_type: entityType, entity_id: entityId })}`,
  },
  auth: { me: "/auth/me" },
  herd: {
    cows: "/herd/cows", cow: (id: string) => `/herd/cows/${id}`,
    weight: (id: string) => `/herd/cows/${id}/weight`,
    weightRecord: (cowId: string, weightId: string) => `/herd/cows/${cowId}/weight/${weightId}`,
    move: (id: string) => `/herd/cows/${id}/move`,
    warehouses: "/herd/warehouses", warehouse: (id: string) => `/herd/warehouses/${id}`,
    suppliers: "/herd/suppliers", supplier: (id: string) => `/herd/suppliers/${id}`,
  },
  evaluations: {
    root: "/evaluations", preview: "/evaluations/calculate-preview", marketPrices: "/evaluations/market-prices",
    marketPrice: (id: string) => `/evaluations/market-prices/${id}`,
    update: (id: string) => `/evaluations/${id}`, convert: (id: string) => `/evaluations/${id}/convert-to-cow`,
  },
  feeding: {
    expenses: "/feeding/expenses", expense: (id: string) => `/feeding/expenses/${id}`,
    categories: "/feeding/categories", category: (id: string) => `/feeding/categories/${id}`,
    feedTypes: "/feeding/feed-types", feedType: (id: string) => `/feeding/feed-types/${id}`,
    records: "/feeding/feeding-records", record: (id: string) => `/feeding/feeding-records/${id}`,
  },
  labor: {
    workers: "/labor/workers", worker: (id: string) => `/labor/workers/${id}`,
    attendance: "/labor/attendance", attendanceRecord: (id: string) => `/labor/attendance/${id}`,
    attendanceBatch: "/labor/attendance/batch",
    salaries: "/labor/salary-payments", salary: (id: string) => `/labor/salary-payments/${id}`,
    substitutes: "/labor/mill-charges", substitute: (id: string) => `/labor/mill-charges/${id}`,
  },
  health: {
    records: "/health/records", record: (id: string) => `/health/records/${id}`,
    breeding: "/health/breeding", breedingRecord: (id: string) => `/health/breeding/${id}`,
    pregnancy: "/health/pregnancy", pregnancyReport: (id: string) => `/health/pregnancy/${id}`,
  },
  sales: {
    customers: "/sales/customers", customer: (id: string) => `/sales/customers/${id}`,
    invoices: "/sales/invoices", invoice: (id: string) => `/sales/invoices/${id}`,
    invoiceStatus: (id: string) => `/sales/invoices/${id}/status`,
    invoicePayments: (id: string) => `/sales/invoices/${id}/payments`,
    voidPayment: (invoiceId: string, paymentId: string) => `/sales/invoices/${invoiceId}/payments/${paymentId}/void`,
    milk: "/sales/milk", milkRecord: (id: string) => `/sales/milk/${id}`,
    milkBatches: "/sales/milk/batches", milkCowSchedules: "/sales/milk/cow-schedules",
  },
  reports: {
    dashboard: "/reports/dashboard",
    profitability: "/reports/profitability",
    profitabilityCsv: "/reports/profitability/csv",
  },
} as const;
