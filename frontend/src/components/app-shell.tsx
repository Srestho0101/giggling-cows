"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AppShellProps = { children: React.ReactNode };
type Language = "en" | "bn";

function getBangladeshCalendarDate() {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((part) => [part.type, part.value]));
  return new Date(Number(values.year), Number(values.month) - 1, Number(values.day), 12);
}

const navigation = [
  { href: "/today", en: "Today", bn: "আজ", icon: "today" },
  { href: "/herd", en: "Herd", bn: "পাল", icon: "herd" },
  { href: "/purchases", en: "Purchases", bn: "ক্রয়", icon: "purchases" },
  { href: "/breeding", en: "Breeding", bn: "প্রজনন", icon: "breeding" },
  { href: "/health", en: "Health", bn: "স্বাস্থ্য", icon: "health" },
  { href: "/expenses", en: "Expenses", bn: "খরচ", icon: "expenses" },
  { href: "/milk-sales", en: "Milk and Sales", bn: "দুধ ও বিক্রয়", icon: "sales" },
  { href: "/payroll", en: "Payroll", bn: "বেতন", icon: "payroll" },
  { href: "/reports", en: "Reports", bn: "রিপোর্ট", icon: "reports" },
  { href: "/masters", en: "Masters", bn: "মৌলিক তথ্য", icon: "masters" },
] as const;

function NavIcon({ name }: { name: string }) {
  const common = {
    fill: "none",
    stroke: "currentColor",
    strokeWidth: 1.7,
    strokeLinecap: "round" as const,
    strokeLinejoin: "round" as const,
    viewBox: "0 0 24 24",
    className: "size-[18px] shrink-0",
    "aria-hidden": true as const,
  };

  const iconPaths: Record<string, React.ReactNode> = {
    today: <><path d="M4 10.5 12 4l8 6.5" /><path d="M6.5 9v10h11V9M9.5 19v-6h5v6" /></>,
    herd: <><path d="M7 8.5 5 6l-2 1v4l2 1M17 8.5 19 6l2 1v4l-2 1" /><path d="M5 11c0-3 2.5-5 7-5s7 2 7 5v4c0 3-2.5 5-7 5s-7-2-7-5zM9 12h.01M15 12h.01M10 16h4" /></>,
    purchases: <><path d="M4 7h16l-1 13H5L4 7Z" /><path d="M9 9V6a3 3 0 0 1 6 0v3M9 13h6" /></>,
    breeding: <><path d="M12 20s-7-4.3-7-10a4 4 0 0 1 7-2.6A4 4 0 0 1 19 10c0 5.7-7 10-7 10Z" /><path d="M9.5 12h5" /></>,
    health: <><path d="M12 21s8-4 8-11V5l-8-3-8 3v5c0 7 8 11 8 11Z" /><path d="M9 12h6M12 9v6" /></>,
    expenses: <><rect x="3" y="5" width="18" height="14" rx="2" /><path d="M3 10h18M7 15h3" /></>,
    sales: <><path d="M3 5h2l2.2 10.2a2 2 0 0 0 2 1.6h8a2 2 0 0 0 1.9-1.4L21 9H7" /><circle cx="10" cy="20" r="1" /><circle cx="18" cy="20" r="1" /></>,
    payroll: <><rect x="4" y="3" width="16" height="18" rx="2" /><path d="M8 8h8M8 12h3M8 16h8" /></>,
    reports: <><path d="M4 19V5M4 19h17" /><path d="m7 15 4-4 3 2 5-6" /></>,
    masters: <><path d="M4 6h16M4 12h16M4 18h16" /><circle cx="8" cy="6" r="1.5" fill="currentColor" /><circle cx="15" cy="12" r="1.5" fill="currentColor" /><circle cx="10" cy="18" r="1.5" fill="currentColor" /></>,
  };

  return <svg {...common}>{iconPaths[name]}</svg>;
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const [language, setLanguage] = useState<Language>("en");
  const [date, setDate] = useState(getBangladeshCalendarDate);
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const activePage = navigation.find((item) => pathname.startsWith(item.href)) ?? navigation[0];

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
      }
      if (event.key === "Escape") setSearchOpen(false);
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) searchInput.current?.focus();
  }, [searchOpen]);

  const locale = language === "bn" ? "bn-BD" : "en-GB";
  const formattedDate = new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "Asia/Dhaka",
  }).format(date);

  function shiftDate(days: number) {
    setDate((current) => {
      const next = new Date(current);
      next.setDate(next.getDate() + days);
      return next;
    });
  }

  return (
    <div className="min-h-screen bg-[#f5f6f4] text-stone-900">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[232px] flex-col bg-[#1f2a23] text-[#dfe7df]">
        <Link href="/today" className="flex h-[68px] items-center gap-3 border-b border-white/10 px-5 text-white">
          <span className="grid size-9 place-items-center rounded-lg bg-emerald-700 text-xs font-bold tracking-wide text-white">CF</span>
          <span className="text-[15px] font-semibold tracking-wide">Cow Farm</span>
        </Link>

        <nav aria-label={language === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"} className="flex-1 space-y-1 overflow-y-auto px-3 py-5">
          {navigation.map((item) => {
            const selected = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={`flex h-10 items-center gap-3 rounded-md px-3 text-[13px] transition-colors ${
                  selected ? "bg-[#34443a] font-medium text-white" : "text-[#c3cec4] hover:bg-white/5 hover:text-white"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{language === "bn" ? item.bn : item.en}</span>
              </Link>
            );
          })}
        </nav>

        <div className="border-t border-white/10 p-4">
          <div className="flex items-center gap-3 rounded-lg px-2 py-2">
            <div className="grid size-8 place-items-center rounded-full bg-[#49604f] text-xs font-semibold text-white">CF</div>
            <div className="min-w-0 flex-1">
              <p className="truncate text-xs font-medium text-white">Farm account</p>
              <p className="mt-0.5 text-[11px] text-[#aab8ac]">Owner</p>
            </div>
            <button type="button" aria-label="Account menu" className="rounded p-1 text-[#c3cec4] hover:bg-white/10">···</button>
          </div>
        </div>
      </aside>

      <div className="ml-[232px] min-h-screen">
        <header className="sticky top-0 z-10 flex h-[68px] items-center gap-5 border-b border-[#dde1da] bg-white/95 px-7 backdrop-blur">
          <h1 className="min-w-36 flex-1 text-[15px] font-semibold text-stone-800">{language === "bn" ? activePage.bn : activePage.en}</h1>
          <button
            type="button"
            onClick={() => setSearchOpen(true)}
            className="flex h-9 w-[250px] items-center gap-2 rounded-md border border-stone-200 bg-stone-50 px-3 text-left text-xs text-stone-500 hover:bg-stone-100"
          >
            <SearchIcon />
            <span className="flex-1">{language === "bn" ? "গরু খুঁজুন..." : "Search cows..."}</span>
            <kbd className="rounded border border-stone-200 bg-white px-1.5 py-0.5 font-sans text-[10px]">Ctrl K</kbd>
          </button>
          <div className="flex h-9 items-center rounded-md border border-stone-200 bg-white">
            <button type="button" aria-label="Previous day" onClick={() => shiftDate(-1)} className="h-full px-2.5 text-stone-500 hover:text-stone-900">‹</button>
            <span className="min-w-[112px] text-center text-xs font-medium tabular-nums">{formattedDate}</span>
            <button type="button" aria-label="Next day" onClick={() => shiftDate(1)} className="h-full px-2.5 text-stone-500 hover:text-stone-900">›</button>
          </div>
          <button
            type="button"
            onClick={() => setLanguage((current) => current === "en" ? "bn" : "en")}
            className="h-9 rounded-md border border-stone-200 px-3 text-xs font-medium text-stone-600 hover:bg-stone-50"
            aria-label="Change language"
          >
            {language === "bn" ? "বাংলা · English" : "English · বাংলা"}
          </button>
          <button type="button" aria-label="User menu" className="grid size-9 place-items-center rounded-full bg-[#e4efe7] text-xs font-semibold text-[#1f5a38]">CF</button>
        </header>

        <main>{children}</main>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/30 px-4 pt-[18vh]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-label="Search cows" className="w-full max-w-xl overflow-hidden rounded-xl border border-stone-200 bg-white shadow-2xl">
            <div className="flex items-center gap-3 border-b border-stone-100 px-4">
              <SearchIcon />
              <input
                ref={searchInput}
                type="search"
                placeholder={language === "bn" ? "ট্যাগ বা নাম দিয়ে খুঁজুন" : "Search by cow tag or name"}
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-stone-400"
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="rounded border border-stone-200 px-1.5 py-0.5 text-[10px] text-stone-500">ESC</button>
            </div>
            <p className="px-4 py-5 text-xs text-stone-400">{language === "bn" ? "গরু অনুসন্ধান শীঘ্রই যুক্ত হবে" : "Cow search will be connected here."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-stone-400"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.3 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
