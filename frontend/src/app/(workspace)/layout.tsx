"use client";

import { AppShell } from "@/components/app-shell";
import { useAuth } from "@/components/providers";
import { usePathname, useRouter } from "next/navigation";
import { useEffect } from "react";

export default function WorkspaceLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  const { ready, session } = useAuth();
  const router = useRouter();
  const pathname = usePathname();

  useEffect(() => {
    if (ready && !session) router.replace(`/login?next=${encodeURIComponent(pathname)}`);
  }, [ready, session, pathname, router]);

  if (!ready || !session) return <main className="grid min-h-screen place-items-center bg-[#f5f6f4] text-sm text-stone-500">Checking your session…</main>;
  return <AppShell>{children}</AppShell>;
}
