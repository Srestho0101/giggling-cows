"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import { getAuthUser, readStoredSession, refreshAuthSession, revokeAuthSession, signInWithPassword, storeSession, type AuthSession } from "@/lib/auth";

type AuthContextValue = {
  session: AuthSession | null;
  ready: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | null>(null);

export function useAuth() {
  const context = useContext(AuthContext);
  if (!context) throw new Error("useAuth must be used inside Providers");
  return context;
}

export function Providers({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<AuthSession | null>(null);
  const [ready, setReady] = useState(false);

  const clearSession = useCallback(() => {
    storeSession(null);
    setSession(null);
  }, []);

  useEffect(() => {
    let active = true;
    const restore = async () => {
      let saved = readStoredSession();
      if (saved) {
        try {
          if (saved.expires_at <= Math.floor(Date.now() / 1000) + 30) saved = await refreshAuthSession(saved);
          const user = await getAuthUser(saved.access_token);
          saved = { ...saved, user };
          storeSession(saved);
          if (active) setSession(saved);
        } catch {
          clearSession();
        }
      }
      if (active) setReady(true);
    };
    void restore();
    const onExpired = () => clearSession();
    window.addEventListener("cowfarm:auth-expired", onExpired);
    return () => {
      active = false;
      window.removeEventListener("cowfarm:auth-expired", onExpired);
    };
  }, [clearSession]);

  useEffect(() => {
    if (!session) return;
    const delay = Math.max(0, session.expires_at * 1000 - Date.now() - 60_000);
    const timer = window.setTimeout(() => {
      void refreshAuthSession(session).then((nextSession) => {
        storeSession(nextSession);
        setSession(nextSession);
      }).catch(clearSession);
    }, delay);
    return () => window.clearTimeout(timer);
  }, [session, clearSession]);

  const signIn = useCallback(async (email: string, password: string) => {
    const nextSession = await signInWithPassword(email, password);
    storeSession(nextSession);
    setSession(nextSession);
  }, []);

  const signOut = useCallback(async () => {
    const current = session;
    clearSession();
    if (current) {
      try { await revokeAuthSession(current.access_token); } catch { /* Local sign-out still succeeds. */ }
    }
  }, [clearSession, session]);

  const auth = useMemo(() => ({ session, ready, signIn, signOut }), [session, ready, signIn, signOut]);
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          queries: {
            staleTime: 30_000,
            refetchOnWindowFocus: true,
            refetchOnReconnect: true,
            retry: 1,
          },
        },
      }),
  );

  return <AuthContext.Provider value={auth}><QueryClientProvider client={queryClient}>{children}</QueryClientProvider></AuthContext.Provider>;
}
