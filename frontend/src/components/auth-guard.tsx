"use client";

import { useEffect, type ReactNode } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export function AuthGuard({ children }: { children: ReactNode }) {
  const { session, loading, configured } = useAuth();
  const router = useRouter();

  useEffect(() => {
    if (loading) return;
    if (!configured) return; // allow local development without Supabase
    if (!session) {
      router.replace("/login");
    }
  }, [session, loading, configured, router]);

  if (loading) {
    return (
      <div className="grid min-h-screen place-items-center bg-[var(--bg)] text-[var(--muted)]">
        <div className="flex flex-col items-center gap-3">
          <div className="size-8 animate-spin rounded-full border-2 border-[var(--accent)] border-t-transparent" />
          <p className="text-sm">Checking session…</p>
        </div>
      </div>
    );
  }

  if (configured && !session) {
    return null; // redirect in progress
  }

  return <>{children}</>;
}
