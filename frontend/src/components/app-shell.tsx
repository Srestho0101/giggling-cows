"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useRef, useState } from "react";

type AppShellProps = { children: React.ReactNode };
type Language = "en" | "bn";
type ThemeMode = "system" | "light" | "dark";

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
  const [theme, setTheme] = useState<ThemeMode>("system");
  const [searchOpen, setSearchOpen] = useState(false);
  const searchInput = useRef<HTMLInputElement>(null);
  const activePage = navigation.find((item) => pathname.startsWith(item.href)) ?? navigation[0];

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
      return;
    }
    root.setAttribute("data-theme", theme);
  }, [theme]);

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
    <div className="min-h-screen bg-[var(--bg)] text-[var(--text)]">
      <aside className="fixed inset-y-0 left-0 z-20 flex w-[160px] flex-col bg-[var(--nav)] px-[8px] py-[12px] text-[var(--navtxt)]">
        <div className="flex items-center gap-2 px-2 pb-3 text-[var(--navhi)]">
          <span className="grid size-[24px] place-items-center rounded-[7px] bg-[var(--hay)] text-[13px] font-bold text-[#0f172a]">🐄</span>
          <span className="text-[14px] font-bold">Cow Farm</span>
        </div>

        <nav aria-label={language === "bn" ? "প্রধান নেভিগেশন" : "Main navigation"} className="flex-1 space-y-[2px] overflow-y-auto">
          {navigation.map((item) => {
            const selected = pathname.startsWith(item.href);
            return (
              <Link
                key={item.href}
                href={item.href}
                aria-current={selected ? "page" : undefined}
                className={`flex items-center gap-[9px] rounded-[7px] px-[9px] py-[7px] text-[12px] font-medium transition-colors ${
                  selected ? "bg-white/10 text-[var(--navhi)] shadow-[inset_3px_0_0_var(--hay)]" : "text-[var(--navtxt)] hover:bg-white/5 hover:text-[var(--navhi)]"
                }`}
              >
                <NavIcon name={item.icon} />
                <span>{language === "bn" ? item.bn : item.en}</span>
                {item.href === "/health" && <span className="ml-auto rounded-full bg-[var(--warn)] px-[6px] py-[1px] text-[9px] font-semibold text-[var(--on-accent)]">1</span>}
              </Link>
            );
          })}
        </nav>

        <div className="mt-auto border-t border-white/10 px-[8px] pt-[10px] text-[11px] text-[var(--navtxt)] opacity-75">Karim is absent today</div>
      </aside>

      <div className="ml-[160px] min-h-screen">
        <header className="sticky top-0 z-10 flex h-[52px] items-center gap-[10px] border-b border-[var(--line)] bg-[var(--bar)] px-[16px] backdrop-blur-md">
          <h1 className="min-w-[90px] flex-1 text-[17px] font-bold text-[var(--text)]">{language === "bn" ? activePage.bn : activePage.en}</h1>

          <div className="relative">
            <input
              type="search"
              aria-label="Search cows"
              onFocus={() => setSearchOpen(true)}
              placeholder={language === "bn" ? "গরু খুঁজুন..." : "Search cows..."}
              className="h-8 w-[150px] rounded-[8px] border border-[var(--line)] bg-[var(--card)] pl-[11px] pr-[34px] text-[12px] text-[var(--text)] placeholder:text-[var(--muted)]"
            />
            <kbd className="pointer-events-none absolute right-[8px] top-1/2 -translate-y-1/2 rounded-[5px] border border-[var(--line)] bg-[var(--card)] px-[4px] py-[1px] text-[9px] text-[var(--muted)]">Ctrl K</kbd>
          </div>

          <div className="flex items-center rounded-[8px] border border-[var(--line)] bg-[var(--card)]">
            <button type="button" aria-label="Previous day" onClick={() => shiftDate(-1)} className="h-8 px-[7px] text-[var(--muted)] hover:text-[var(--text)]">‹</button>
            <span className="min-w-[100px] text-center text-[12px] font-semibold tabular-nums">{formattedDate}</span>
            <button type="button" aria-label="Next day" onClick={() => shiftDate(1)} className="h-8 px-[7px] text-[var(--muted)] hover:text-[var(--text)]">›</button>
          </div>

          <div className="flex rounded-[8px] border border-[var(--line)] bg-[var(--card)] p-[2px]">
            <button type="button" onClick={() => setLanguage("bn")} className={`rounded-[6px] px-[8px] py-[4px] text-[11px] font-medium ${language === "bn" ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)]"}`}>বাংলা</button>
            <button type="button" onClick={() => setLanguage("en")} className={`rounded-[6px] px-[8px] py-[4px] text-[11px] font-medium ${language === "en" ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)]"}`}>English</button>
          </div>

          <div className="flex rounded-[8px] border border-[var(--line)] bg-[var(--card)] p-[2px]">
            {(["system", "light", "dark"] as const).map((mode) => (
              <button
                key={mode}
                type="button"
                onClick={() => setTheme(mode)}
                className={`rounded-[6px] px-[8px] py-[4px] text-[10px] font-medium ${theme === mode ? "bg-[var(--accent)] text-[var(--on-accent)]" : "text-[var(--muted)]"}`}
              >
                {mode === "system" ? "Auto" : mode === "light" ? "Light" : "Dark"}
              </button>
            ))}
          </div>
        </header>

        <main>{children}</main>
      </div>

      {searchOpen && (
        <div className="fixed inset-0 z-50 flex items-start justify-center bg-stone-950/30 px-4 pt-[18vh]" onMouseDown={(event) => {
          if (event.target === event.currentTarget) setSearchOpen(false);
        }}>
          <div role="dialog" aria-modal="true" aria-label="Search cows" className="w-full max-w-xl overflow-hidden rounded-xl border border-[var(--line)] bg-[var(--card)] shadow-2xl">
            <div className="flex items-center gap-3 border-b border-[var(--line)] px-4">
              <SearchIcon />
              <input
                ref={searchInput}
                type="search"
                placeholder={language === "bn" ? "ট্যাগ বা নাম দিয়ে খুঁজুন" : "Search by cow tag or name"}
                className="h-14 flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--muted)]"
              />
              <button type="button" onClick={() => setSearchOpen(false)} className="rounded border border-[var(--line)] px-1.5 py-0.5 text-[10px] text-[var(--muted)]">ESC</button>
            </div>
            <p className="px-4 py-5 text-xs text-[var(--muted)]">{language === "bn" ? "গরু অনুসন্ধান শীঘ্রই যুক্ত হবে" : "Cow search will be connected here."}</p>
          </div>
        </div>
      )}
    </div>
  );
}

function SearchIcon() {
  return <svg aria-hidden="true" viewBox="0 0 24 24" fill="none" className="size-4 shrink-0 text-[var(--muted)]"><circle cx="10.8" cy="10.8" r="6.8" stroke="currentColor" strokeWidth="1.7" /><path d="m16 16 4.3 4.3" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" /></svg>;
}
