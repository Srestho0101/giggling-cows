export type AuthSession = {
  access_token: string;
  refresh_token: string;
  expires_at: number;
  user: { id: string; email?: string };
};

const SESSION_KEY = "cow-farm.auth-session";

function supabaseConfig() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL?.replace(/\/$/, "");
  const anonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !anonKey) throw new Error("Supabase authentication is not configured. Set NEXT_PUBLIC_SUPABASE_URL and NEXT_PUBLIC_SUPABASE_ANON_KEY.");
  return { url, anonKey };
}

function expiresAt(result: { expires_at?: number; expires_in?: number }) {
  return result.expires_at ?? Math.floor(Date.now() / 1000) + (result.expires_in ?? 3600);
}

async function authRequest<T>(path: string, body?: unknown, accessToken?: string, method?: "GET" | "POST" | "PUT"): Promise<T> {
  const { url, anonKey } = supabaseConfig();
  const response = await fetch(`${url}/auth/v1${path}`, {
    method: method ?? (body === undefined ? "GET" : "POST"),
    headers: {
      apikey: anonKey,
      ...(body === undefined ? {} : { "Content-Type": "application/json" }),
      ...(accessToken ? { Authorization: `Bearer ${accessToken}` } : {}),
    },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  const payload = await response.json().catch(() => undefined);
  if (!response.ok) {
    const message = typeof payload?.msg === "string" ? payload.msg : typeof payload?.message === "string" ? payload.message : typeof payload?.error_description === "string" ? payload.error_description : "Authentication request failed.";
    throw new Error(message);
  }
  return payload as T;
}

export async function signInWithPassword(email: string, password: string): Promise<AuthSession> {
  const result = await authRequest<{ access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user: AuthSession["user"] }>(
    "/token?grant_type=password", { email, password },
  );
  return { ...result, expires_at: expiresAt(result) };
}

export async function refreshAuthSession(session: AuthSession): Promise<AuthSession> {
  const result = await authRequest<{ access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user?: AuthSession["user"] }>(
    "/token?grant_type=refresh_token", { refresh_token: session.refresh_token },
  );
  return { ...result, user: result.user ?? session.user, expires_at: expiresAt(result) };
}

export async function getAuthUser(accessToken: string): Promise<AuthSession["user"]> {
  return authRequest<AuthSession["user"]>("/user", undefined, accessToken);
}

export async function verifyInviteToken(tokenHash: string): Promise<AuthSession> {
  const result = await authRequest<{ access_token: string; refresh_token: string; expires_at?: number; expires_in?: number; user: AuthSession["user"] }>(
    "/verify", { token_hash: tokenHash, type: "invite" },
  );
  return { ...result, expires_at: expiresAt(result) };
}

export async function setUserPassword(accessToken: string, password: string) {
  return authRequest<AuthSession["user"]>("/user", { password }, accessToken, "PUT");
}

export async function revokeAuthSession(accessToken: string) {
  await authRequest<unknown>("/logout", {}, accessToken);
}

export function readStoredSession(): AuthSession | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.localStorage.getItem(SESSION_KEY);
    if (!raw) return null;
    const session = JSON.parse(raw) as AuthSession;
    if (!session.access_token || !session.refresh_token || !session.user?.id) return null;
    return session;
  } catch {
    return null;
  }
}

export function storeSession(session: AuthSession | null) {
  if (typeof window === "undefined") return;
  if (session) window.localStorage.setItem(SESSION_KEY, JSON.stringify(session));
  else window.localStorage.removeItem(SESSION_KEY);
}

export function getStoredAccessToken() {
  return readStoredSession()?.access_token;
}
