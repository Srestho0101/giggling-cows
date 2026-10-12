"use client";

import { FormEvent, useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/components/providers";
import { getAuthUser, setUserPassword, verifyInviteToken } from "@/lib/auth";

export default function LoginPage() {
  const { ready, session, signIn } = useAuth();
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [inviteToken, setInviteToken] = useState("");
  const [inviteReady, setInviteReady] = useState(false);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState("");

  useEffect(() => {
    const fragment = new URLSearchParams(window.location.hash.replace(/^#/, ""));
    const query = new URLSearchParams(window.location.search);
    const type = fragment.get("type") ?? query.get("type");
    const accessToken = fragment.get("access_token");
    const tokenHash = query.get("token_hash");
    if (type !== "invite" || (!accessToken && !tokenHash)) return;

    query.delete("token_hash");
    query.delete("type");
    window.history.replaceState(null, "", `${window.location.pathname}${query.size ? `?${query}` : ""}`);
    setInviteReady(true);
    void (async () => {
      try {
        const token = accessToken ?? (await verifyInviteToken(tokenHash!)).access_token;
        const user = await getAuthUser(token);
        setEmail(user.email ?? "");
        setInviteToken(token);
      } catch {
        setMessage("This invite link is invalid or has expired. Ask your farm administrator to send a new invite.");
      }
    })();
  }, []);

  useEffect(() => {
    if (ready && session) {
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/today");
    }
  }, [ready, session, router]);

  async function handleSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setBusy(true);
    setMessage("");
    try {
      if (inviteReady && inviteToken) {
        if (password.length < 8) throw new Error("Choose a password with at least 8 characters.");
        if (password !== confirmPassword) throw new Error("The passwords do not match.");
        await setUserPassword(inviteToken, password);
      }
      await signIn(email, password);
      const next = new URLSearchParams(window.location.search).get("next");
      router.replace(next?.startsWith("/") && !next.startsWith("//") ? next : "/today");
    } catch (cause) {
      setMessage(cause instanceof Error ? cause.message : "Could not sign in. Please try again.");
    } finally {
      setBusy(false);
    }
  }

  return (
    <main className="grid min-h-screen place-items-center bg-[#f5f6f4] px-6">
      <section className="w-full max-w-md rounded-xl border border-stone-200 bg-white p-8 shadow-sm">
        <div className="grid size-10 place-items-center rounded-lg bg-emerald-700 text-xs font-bold tracking-wide text-white">CF</div>
        <h1 className="mt-5 text-2xl font-semibold tracking-tight text-stone-900">{inviteReady ? "Set your password" : "Sign in"}</h1>
        <p className="mt-2 text-sm text-stone-500">{inviteReady ? "Choose a password for your farm account to finish accepting the invite." : "Sign in with your farm account."}</p>
        <form onSubmit={handleSubmit} className="mt-7 space-y-4">
          <label className="block text-sm font-medium text-stone-700">Email
            <input autoComplete="username" type="email" required readOnly={inviteReady} value={email} onChange={(event) => setEmail(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15 read-only:bg-stone-50" />
          </label>
          <label className="block text-sm font-medium text-stone-700">Password
            <input autoComplete={inviteReady ? "new-password" : "current-password"} type="password" minLength={inviteReady ? 8 : undefined} required value={password} onChange={(event) => setPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
          </label>
          {inviteReady && <label className="block text-sm font-medium text-stone-700">Confirm password
            <input autoComplete="new-password" type="password" minLength={8} required value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} className="mt-1.5 h-11 w-full rounded-lg border border-stone-300 px-3 font-normal outline-none focus:border-emerald-700 focus:ring-2 focus:ring-emerald-700/15" />
          </label>}
          {message && <p role="alert" className="rounded-lg bg-red-50 px-3 py-2 text-sm text-red-700">{message}</p>}
          <button disabled={busy || (inviteReady && !inviteToken)} type="submit" className="h-11 w-full rounded-lg bg-emerald-700 px-4 text-sm font-semibold text-white hover:bg-emerald-800 disabled:cursor-wait disabled:opacity-60">{busy ? "Please wait…" : inviteReady ? "Set password and continue" : "Sign in"}</button>
        </form>
        <p className="mt-5 text-center text-xs text-stone-500">Need an account? Ask your farm administrator to invite you.</p>
      </section>
    </main>
  );
}
