"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/contexts/AuthContext";

export default function LoginPage() {
  const { signIn, signUp, session, loading, configured } = useAuth();
  const router = useRouter();

  const [mode, setMode] = useState<"signin" | "signup">("signin");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [message, setMessage] = useState<string | null>(null);

  useEffect(() => {
    if (!loading && session) {
      router.replace("/today");
    }
  }, [session, loading, router]);

  async function handleSubmit(event: FormEvent) {
    event.preventDefault();
    setError(null);
    setMessage(null);
    setSubmitting(true);

    try {
      if (mode === "signin") {
        await signIn(email.trim(), password);
        router.replace("/today");
      } else {
        await signUp(email.trim(), password);
        setMessage("Account created. Check your email to confirm, or sign in if confirmation is disabled.");
        setMode("signin");
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : "Authentication failed";
      setError(msg);
    } finally {
      setSubmitting(false);
    }
  }

  if (loading) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f4]">
        <div className="size-8 animate-spin rounded-full border-2 border-emerald-700 border-t-transparent" />
      </main>
    );
  }

  if (!configured) {
    return (
      <main className="grid min-h-screen place-items-center bg-[#f5f6f4] px-6">
        <section className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
          <div className="grid size-10 place-items-center rounded-lg bg-emerald-700 text-xs font-bold tracking-wide text-white">
            CF
          </div>
          <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-900">Supabase not configured</h1>
          <p className="mt-2 text-sm text-stone-500">
            Add <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_SUPABASE_URL</code> and{" "}
            <code className="rounded bg-stone-100 px-1">NEXT_PUBLIC_SUPABASE_ANON_KEY</code> to{" "}
            <code className="rounded bg-stone-100 px-1">frontend/.env.local</code>, then restart the
            dev server.
          </p>
          <p className="mt-4 text-sm text-stone-500">
            With <code className="rounded bg-stone-100 px-1">DEBUG=True</code> on the backend you can
            still use the app without a real login.
          </p>
        </section>
      </main>
    );
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f4] px-6">
      <section className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="grid size-10 place-items-center rounded-lg bg-emerald-700 text-xs font-bold tracking-wide text-white">
          CF
        </div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-900">
          {mode === "signin" ? "Sign in" : "Create account"}
        </h1>
        <p className="mt-2 text-sm text-stone-500">
          {mode === "signin"
            ? "Sign in to manage your cow farm."
            : "Create an account to get started."}
        </p>

        <form onSubmit={handleSubmit} className="mt-6 space-y-4">
          <div>
            <label htmlFor="email" className="mb-1.5 block text-sm font-medium text-stone-700">
              Email
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-emerald-600 focus:bg-white"
              placeholder="you@farm.local"
            />
          </div>

          <div>
            <label htmlFor="password" className="mb-1.5 block text-sm font-medium text-stone-700">
              Password
            </label>
            <input
              id="password"
              type="password"
              autoComplete={mode === "signin" ? "current-password" : "new-password"}
              required
              minLength={6}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="h-10 w-full rounded-lg border border-stone-200 bg-stone-50 px-3 text-sm text-stone-900 outline-none focus:border-emerald-600 focus:bg-white"
              placeholder="••••••••"
            />
          </div>

          {error && (
            <div className="rounded-lg border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              {error}
            </div>
          )}

          {message && (
            <div className="rounded-lg border border-emerald-200 bg-emerald-50 px-3 py-2 text-sm text-emerald-800">
              {message}
            </div>
          )}

          <button
            type="submit"
            disabled={submitting}
            className="flex h-10 w-full items-center justify-center rounded-lg bg-emerald-700 text-sm font-semibold text-white transition hover:bg-emerald-800 disabled:opacity-60"
          >
            {submitting ? "Please wait…" : mode === "signin" ? "Sign in" : "Create account"}
          </button>
        </form>

        <p className="mt-5 text-center text-sm text-stone-500">
          {mode === "signin" ? (
            <>
              No account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signup");
                  setError(null);
                  setMessage(null);
                }}
                className="font-medium text-emerald-700 hover:underline"
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                onClick={() => {
                  setMode("signin");
                  setError(null);
                  setMessage(null);
                }}
                className="font-medium text-emerald-700 hover:underline"
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </section>
    </main>
  );
}
