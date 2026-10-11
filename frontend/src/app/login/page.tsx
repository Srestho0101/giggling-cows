"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import { useFarm } from "@/context/farm-context";

export default function LoginPage() {
  const router = useRouter();
  const { language } = useFarm();
  const [username, setUsername] = useState("");
  const [password, setPassword] = useState("");

  const handleSignIn = (e: React.FormEvent) => {
    e.preventDefault();
    router.push("/today");
  };

  return (
    <main
      style={{
        minHeight: "100vh",
        display: "grid",
        placeItems: "center",
        background: "var(--bg)",
        padding: 20,
      }}
    >
      <section
        className="card"
        style={{
          width: "100%",
          maxWidth: 380,
          padding: 28,
        }}
      >
        <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 18 }}>
          <div
            style={{
              width: 32,
              height: 32,
              borderRadius: 9,
              background: "var(--hay)",
              display: "grid",
              placeItems: "center",
              fontSize: 18,
            }}
          >
            🐄
          </div>
          <h1 style={{ fontSize: 18, margin: 0, fontWeight: 700 }}>Cow Farm</h1>
        </div>

        <p className="muted" style={{ marginBottom: 18 }}>
          {language === "bn"
            ? "খামার ব্যবস্থাপনায় প্রবেশ করতে সাইন ইন করুন"
            : "Sign in to access dairy management"}
        </p>

        <form onSubmit={handleSignIn}>
          <div style={{ marginBottom: 12 }}>
            <label className="muted" style={{ display: "block", marginBottom: 5 }}>
              {language === "bn" ? "ব্যবহারকারীর নাম / ইমেইল" : "Username or email"}
            </label>
            <input
              required
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              placeholder="admin@cowfarm.local"
            />
          </div>

          <div style={{ marginBottom: 18 }}>
            <label className="muted" style={{ display: "block", marginBottom: 5 }}>
              {language === "bn" ? "পাসওয়ার্ড" : "Password"}
            </label>
            <input
              type="password"
              required
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
            />
          </div>

          <button type="submit" style={{ width: "100%", padding: "10px 0" }}>
            {language === "bn" ? "প্রবেশ করুন" : "Sign in"}
          </button>
        </form>
      </section>
    </main>
  );
}
