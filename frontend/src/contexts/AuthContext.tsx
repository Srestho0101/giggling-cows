"use client";

import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";
import type { Session, User } from "@supabase/supabase-js";
import { getSupabase, isSupabaseConfigured } from "@/lib/supabase";
import { apiRequest, apiRoutes } from "@/lib/api";

export type AppRole = "admin" | "manager" | "data_entry";

export type UserProfile = {
  id: string;
  email: string | null;
  role: AppRole;
  permissions: {
    can_manage_users: boolean;
    can_view_financial_reports: boolean;
    can_record_payments: boolean;
    can_edit_operational_data: boolean;
  };
};

type AuthContextValue = {
  session: Session | null;
  user: User | null;
  profile: UserProfile | null;
  accessToken: string | null;
  loading: boolean;
  configured: boolean;
  signIn: (email: string, password: string) => Promise<void>;
  signUp: (email: string, password: string) => Promise<void>;
  signOut: () => Promise<void>;
  refreshProfile: () => Promise<void>;
};

const AuthContext = createContext<AuthContextValue | undefined>(undefined);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [profile, setProfile] = useState<UserProfile | null>(null);
  const [loading, setLoading] = useState(true);

  const configured = isSupabaseConfigured;

  const loadProfile = useCallback(async (token: string) => {
    try {
      const data = await apiRequest<UserProfile>(apiRoutes.auth.me, {
        accessToken: token,
      });
      setProfile(data);
    } catch {
      // Backend may be unreachable during local setup; keep session but clear profile
      setProfile(null);
    }
  }, []);

  useEffect(() => {
    if (!configured) {
      setLoading(false);
      return;
    }

    const supabase = getSupabase();

    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      if (data.session?.access_token) {
        void loadProfile(data.session.access_token).finally(() => setLoading(false));
      } else {
        setLoading(false);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
      if (nextSession?.access_token) {
        void loadProfile(nextSession.access_token);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, [configured, loadProfile]);

  const signIn = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) throw error;
  }, []);

  const signUp = useCallback(async (email: string, password: string) => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signUp({ email, password });
    if (error) throw error;
  }, []);

  const signOut = useCallback(async () => {
    const supabase = getSupabase();
    const { error } = await supabase.auth.signOut();
    if (error) throw error;
    setProfile(null);
  }, []);

  const refreshProfile = useCallback(async () => {
    if (session?.access_token) {
      await loadProfile(session.access_token);
    }
  }, [session, loadProfile]);

  const value = useMemo<AuthContextValue>(
    () => ({
      session,
      user: session?.user ?? null,
      profile,
      accessToken: session?.access_token ?? null,
      loading,
      configured,
      signIn,
      signUp,
      signOut,
      refreshProfile,
    }),
    [session, profile, loading, configured, signIn, signUp, signOut, refreshProfile],
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error("useAuth must be used within an AuthProvider");
  }
  return ctx;
}
