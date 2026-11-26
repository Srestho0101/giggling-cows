"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import React, { useEffect, useMemo, useRef, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import { Icon, type IconName } from "@/components/icons";
import { Badge, statusTone } from "@/components/ui";
import { useWorkspaceDate } from "@/components/workspace-date";
import { usePreference } from "@/lib/preferences";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type AppShellProps = { children: React.ReactNode };
type ThemeMode = "system" | "light" | "dark";

type DashboardData = {
  alerts?: { id: string; item_type?: string }[];
  health_alert_count?: number;
  breeding_alert_count?: number;
};

type SearchCow = {
  cow_id: string;
  current_tag_number: string;
  category?: string | null;
  cow_type?: string | null;
  breed?: string | null;
  warehouse_name?: string | null;
  status: string;
  is_archived?: boolean;
};

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

function formatHeaderDate(iso: string, locale: string = "en-GB"): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    weekday: "short",
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

export function AppShell({ children }: AppShellProps) {
  const pathname = usePathname();
  const router = useRouter();
  const { lang, setLang, locale, tr, enumLabel } = useI18n();
  const [theme, setTheme] = usePreference<ThemeMode>("cf-theme", "system");
  const [searchOpen, setSearchOpen] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");
  const [activeResultIdx, setActiveResultIdx] = useState(0);
  const [drawerOpen, setDrawerOpen] = useState(false);

  const searchInput = useRef<HTMLInputElement>(null);
  const dateInputRef = useRef<HTMLInputElement>(null);

  const { date, isToday, setDate, shift, reset } = useWorkspaceDate();

  const isTodayPage = pathname === "/today" || pathname.startsWith("/today/");
  const activePage = navigation.find((item) => pathname.startsWith(item.href)) ?? navigation[0];

  // Shared dashboard query for health & breeding badges
  const { data: dashboard } = useQuery({
    queryKey: ["dashboard"],
    queryFn: () => apiRequest<DashboardData>(apiRoutes.reports.dashboard),
    staleTime: 60_000,
    refetchOnWindowFocus: false,
  });

  // Global cow search query (loaded when modal opens or cached)
  const searchCowsQuery = useQuery({
    queryKey: ["global-cow-search"],
    queryFn: () => apiRequest<SearchCow[]>(`${apiRoutes.herd.cows}?include_archived=true`),
    enabled: searchOpen,
    staleTime: 30_000,
  });

  const searchResults = useMemo(() => {
    const all = searchCowsQuery.data ?? [];
    const q = searchTerm.trim().toLowerCase();
    const filtered = !q
      ? all.filter((c) => !c.is_archived)
      : all.filter((c) => {
          const haystack = [
            c.current_tag_number,
            c.category,
            c.cow_type,
            c.breed,
            c.warehouse_name,
            c.status,
          ]
            .filter(Boolean)
            .join(" ")
            .toLowerCase();
          return haystack.includes(q);
        });
    return filtered.slice(0, 12);
  }, [searchCowsQuery.data, searchTerm]);

  const healthAlertCount = dashboard?.health_alert_count ?? 0;
  const breedingAlertCount = dashboard?.breeding_alert_count ?? 0;

  useEffect(() => {
    const root = document.documentElement;
    if (theme === "system") {
      root.removeAttribute("data-theme");
    } else {
      root.setAttribute("data-theme", theme);
    }
  }, [theme]);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        setSearchOpen(true);
        setActiveResultIdx(0);
      }
      if (event.key === "Escape") {
        setSearchOpen(false);
        setDrawerOpen(false);
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, []);

  useEffect(() => {
    if (searchOpen) {
      searchInput.current?.focus();
    }
  }, [searchOpen]);

  function openCowProfile(cowId: string) {
    setSearchOpen(false);
    setSearchTerm("");
    router.push(`/herd/${cowId}`);
  }

  const pageTitle = isTodayPage
    ? isToday
      ? tr("Today")
      : formatHeaderDate(date, locale)
    : lang === "bn"
      ? activePage.bn
      : activePage.en;

  return (
    <div className="min-h-screen bg-canvas text-ink">
      <a
        href="#main-content"
        className="sr-only focus:not-sr-only focus:fixed focus:top-3 focus:left-3 focus:z-50 focus:rounded-[6px] focus:bg-accent focus:px-3.5 focus:py-2 focus:text-on-accent focus:font-semibold"
      >
        {tr("Skip to content")}
      </a>

      {/* Mobile Drawer Backdrop */}
      {drawerOpen && (
        <div
          role="presentation"
          onClick={() => setDrawerOpen(false)}
          className="fixed inset-0 z-40 bg-overlay lg:hidden"
        />
      )}

      {/* Sidebar (Desktop fixed 240px, Mobile drawer) */}
      <aside
        className={`fixed inset-y-0 left-0 z-50 flex w-60 flex-col bg-nav text-nav-ink transition-transform duration-200 lg:translate-x-0 ${
          drawerOpen ? "translate-x-0" : "max-lg:-translate-x-full max-lg:invisible"
        }`}
        aria-label={tr("Main navigation")}
      >
        {/* Brand Row 56px */}
        <div className="flex h-14 items-center justify-between border-b border-nav-line px-4">
          <div className="flex items-center gap-2.5">
            <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
              <rect width="28" height="28" rx="7" fill="var(--hay)" />
              <path d="M14 6c-3 4.5-6 8-6 11a6 6 0 0 0 12 0c0-3-3-6.5-6-11Z" fill="#0b0d0f" />
            </svg>
            <span className="text-[16px] font-bold text-nav-ink-hi">{tr("Cow Farm")}</span>
          </div>
          <button
            type="button"
            aria-label={tr("Close sidebar")}
            onClick={() => setDrawerOpen(false)}
            className="rounded-[6px] p-1.5 text-nav-ink hover:bg-white/10 hover:text-nav-ink-hi lg:hidden"
          >
            <Icon name="close" className="size-5" />
          </button>
        </div>

        {/* Navigation list */}
        <nav className="flex-1 space-y-0.5 overflow-y-auto px-2 py-3">
          {navigation.map((item) => {
            const isSelected = pathname === item.href || pathname.startsWith(`${item.href}/`);
            return (
              <Link
                key={item.href}
                href={item.href}
                onClick={() => setDrawerOpen(false)}
                aria-current={isSelected ? "page" : undefined}
                className={`relative flex items-center gap-3 rounded-[6px] px-3 text-[14px] font-medium transition-colors h-9 max-lg:h-11 ${
                  isSelected
                    ? "bg-white/10 text-nav-ink-hi before:absolute before:inset-y-1.5 before:left-0 before:w-[2px] before:rounded-r before:bg-hay"
                    : "text-nav-ink hover:bg-white/5 hover:text-nav-ink-hi"
                }`}
              >
                <Icon name={item.icon as IconName} className="size-[18px]" />
                <span className="truncate">{lang === "bn" ? item.bn : item.en}</span>
                {item.href === "/health" && healthAlertCount > 0 && (
                  <span className="ml-auto rounded-[4px] bg-warn-soft px-1.5 py-0.5 text-[11px] font-semibold text-warn">
                    {healthAlertCount}
                    <span className="sr-only"> {healthAlertCount === 1 ? "alert" : "alerts"}</span>
                  </span>
                )}
                {item.href === "/breeding" && breedingAlertCount > 0 && (
                  <span className="ml-auto rounded-[4px] bg-accent-soft px-1.5 py-0.5 text-[11px] font-semibold text-accent">
                    {breedingAlertCount}
                    <span className="sr-only"> {breedingAlertCount === 1 ? "calving alert" : "calving alerts"}</span>
                  </span>
                )}
              </Link>
            );
          })}
        </nav>

        {/* Footer controls: language & theme */}
        <div className="border-t border-nav-line p-3 space-y-2">
          {/* Language Switch */}
          <div
            className="flex items-center rounded-[6px] border border-nav-line bg-black/20 p-0.5"
            role="group"
            aria-label="Language selection"
          >
            <button
              type="button"
              aria-pressed={lang === "bn"}
              onClick={() => setLang("bn")}
              className={`flex-1 rounded-[4px] py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                lang === "bn"
                  ? "bg-white/15 text-nav-ink-hi font-semibold"
                  : "text-nav-ink hover:text-nav-ink-hi"
              }`}
            >
              বাংলা
            </button>
            <button
              type="button"
              aria-pressed={lang === "en"}
              onClick={() => setLang("en")}
              className={`flex-1 rounded-[4px] py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                lang === "en"
                  ? "bg-white/15 text-nav-ink-hi font-semibold"
                  : "text-nav-ink hover:text-nav-ink-hi"
              }`}
            >
              English
            </button>
          </div>

          {/* Theme Switch */}
          <div
            className="flex items-center rounded-[6px] border border-nav-line bg-black/20 p-0.5"
            role="group"
            aria-label="Theme mode"
          >
            <button
              type="button"
              aria-pressed={theme === "system"}
              onClick={() => setTheme("system")}
              className={`flex-1 flex items-center justify-center gap-1 rounded-[4px] py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                theme === "system"
                  ? "bg-white/15 text-nav-ink-hi font-semibold"
                  : "text-nav-ink hover:text-nav-ink-hi"
              }`}
              title="Auto (Follow OS theme)"
            >
              <Icon name="monitor" className="size-3.5" />
              <span>{tr("Auto")}</span>
            </button>
            <button
              type="button"
              aria-pressed={theme === "light"}
              onClick={() => setTheme("light")}
              className={`flex-1 flex items-center justify-center gap-1 rounded-[4px] py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                theme === "light"
                  ? "bg-white/15 text-nav-ink-hi font-semibold"
                  : "text-nav-ink hover:text-nav-ink-hi"
              }`}
              title="Light mode"
            >
              <Icon name="sun" className="size-3.5" />
              <span>{tr("Light")}</span>
            </button>
            <button
              type="button"
              aria-pressed={theme === "dark"}
              onClick={() => setTheme("dark")}
              className={`flex-1 flex items-center justify-center gap-1 rounded-[4px] py-1 text-[11px] font-medium transition-colors cursor-pointer ${
                theme === "dark"
                  ? "bg-white/15 text-nav-ink-hi font-semibold"
                  : "text-nav-ink hover:text-nav-ink-hi"
              }`}
              title="Dark mode"
            >
              <Icon name="moon" className="size-3.5" />
              <span>{tr("Dark")}</span>
            </button>
          </div>
        </div>
      </aside>

      {/* Main Workspace */}
      <div className="min-h-screen lg:pl-60">
        {/* Sticky Header */}
        <header className="sticky top-0 z-30 flex flex-wrap items-center justify-between gap-3 border-b border-line bg-canvas px-4 py-2.5 sm:px-6">
          <div className="flex items-center gap-3">
            <button
              type="button"
              aria-label={tr("Open sidebar")}
              onClick={() => setDrawerOpen(true)}
              className="rounded-[6px] p-1.5 text-muted hover:bg-wash hover:text-ink lg:hidden"
            >
              <Icon name="menu" className="size-5" />
            </button>
            <h1 className="text-[18px] font-semibold tracking-tight text-ink">{pageTitle}</h1>
          </div>

          <div className="flex flex-wrap items-center gap-2.5">
            {/* Date control: only on Today page */}
            {isTodayPage && (
              <div className="flex items-center rounded-[6px] border border-line bg-surface p-0.5">
                <button
                  type="button"
                  aria-label={tr("Previous day")}
                  onClick={() => shift(-1)}
                  className="rounded-[4px] p-1 text-muted hover:bg-wash hover:text-ink cursor-pointer"
                >
                  <Icon name="chevron-left" className="size-4" />
                </button>

                <div className="relative inline-flex items-center">
                  <span className="min-w-[124px] px-1 text-center text-[13px] font-semibold tabular-nums text-ink select-none">
                    {formatHeaderDate(date, locale)}
                  </span>
                  <input
                    ref={dateInputRef}
                    type="date"
                    aria-label={tr("Choose date")}
                    value={date}
                    onChange={(event) => {
                      if (event.target.value) setDate(event.target.value);
                    }}
                    onClick={() => {
                      try {
                        dateInputRef.current?.showPicker();
                      } catch {
                        // fallback if showPicker is unsupported
                      }
                    }}
                    className="absolute inset-0 size-full cursor-pointer opacity-0"
                  />
                </div>

                <button
                  type="button"
                  aria-label={tr("Next day")}
                  onClick={() => shift(1)}
                  className="rounded-[4px] p-1 text-muted hover:bg-wash hover:text-ink cursor-pointer"
                >
                  <Icon name="chevron-right" className="size-4" />
                </button>

                {!isToday && (
                  <button
                    type="button"
                    onClick={() => reset()}
                    className="ml-1 rounded-[4px] px-2 py-0.5 text-[12px] font-medium text-accent hover:bg-accent-soft cursor-pointer"
                  >
                    {tr("Today")}
                  </button>
                )}
              </div>
            )}

            {/* Cow Search Trigger */}
            <button
              type="button"
              onClick={() => {
                setSearchOpen(true);
                setActiveResultIdx(0);
              }}
              aria-label={tr("Search cows")}
              className="flex h-9 items-center gap-2 rounded-[6px] border border-line-strong bg-field px-2.5 text-[13px] text-muted hover:border-accent hover:text-ink transition-colors cursor-pointer"
            >
              <Icon name="search" className="size-4 text-muted" />
              <span className="hidden sm:inline">{tr("Search cows...")}</span>
              <kbd className="hidden sm:inline rounded-[4px] border border-line bg-subtle px-1.5 py-0.5 text-[10px] font-medium text-muted">
                Ctrl K
              </kbd>
            </button>
          </div>
        </header>

        {/* Page Content */}
        <main id="main-content">{children}</main>
      </div>

      {/* Global Cow Search Modal */}
      {searchOpen && (
        <div
          role="presentation"
          onClick={(event) => {
            if (event.target === event.currentTarget) setSearchOpen(false);
          }}
          className="fixed inset-0 z-50 flex items-start justify-center bg-overlay p-4 pt-[12vh]"
        >
          <div
            role="dialog"
            aria-modal="true"
            aria-label={tr("Search cows")}
            className="w-full max-w-xl rounded-[8px] border border-line bg-surface text-ink shadow-overlay overflow-hidden"
          >
            <div className="flex items-center gap-3 border-b border-line px-4 py-3">
              <Icon name="search" className="size-4.5 text-muted shrink-0" />
              <input
                ref={searchInput}
                type="search"
                value={searchTerm}
                onChange={(event) => {
                  setSearchTerm(event.target.value);
                  setActiveResultIdx(0);
                }}
                onKeyDown={(event) => {
                  if (event.key === "ArrowDown") {
                    event.preventDefault();
                    setActiveResultIdx((idx) =>
                      searchResults.length ? (idx + 1) % searchResults.length : 0
                    );
                  } else if (event.key === "ArrowUp") {
                    event.preventDefault();
                    setActiveResultIdx((idx) =>
                      searchResults.length
                        ? (idx - 1 + searchResults.length) % searchResults.length
                        : 0
                    );
                  } else if (event.key === "Enter" && searchResults[activeResultIdx]) {
                    event.preventDefault();
                    openCowProfile(searchResults[activeResultIdx].cow_id);
                  }
                }}
                placeholder={tr("Search by cow tag, breed, shed, or category...")}
                className="h-9 flex-1 bg-transparent text-[14px] text-ink outline-none placeholder:text-muted"
              />
              <button
                type="button"
                onClick={() => setSearchOpen(false)}
                className="rounded-[4px] border border-line bg-subtle px-2 py-1 text-[11px] font-medium text-muted hover:text-ink cursor-pointer"
              >
                ESC
              </button>
            </div>

            <div className="max-h-80 overflow-y-auto divide-y divide-line">
              {searchCowsQuery.isLoading ? (
                <p className="px-4 py-6 text-center text-[13px] text-muted">
                  {tr("Loading cows...")}
                </p>
              ) : searchResults.length === 0 ? (
                <p className="px-4 py-6 text-center text-[13px] text-muted">
                  {tr("No matching cows found.")}
                </p>
              ) : (
                searchResults.map((cow, index) => {
                  const selected = index === activeResultIdx;
                  return (
                    <button
                      key={cow.cow_id}
                      type="button"
                      onMouseEnter={() => setActiveResultIdx(index)}
                      onClick={() => openCowProfile(cow.cow_id)}
                      className={`flex w-full items-center justify-between gap-3 px-4 py-2.5 text-left transition-colors cursor-pointer ${
                        selected ? "bg-wash" : "hover:bg-wash"
                      }`}
                    >
                      <div className="min-w-0">
                        <p className="text-[13.5px] font-semibold text-ink">
                          {cow.current_tag_number}
                        </p>
                        <p className="truncate text-[12px] text-muted">
                          {[
                            cow.category ? enumLabel(cow.category) : null,
                            cow.cow_type || null,
                            cow.breed ? enumLabel(cow.breed) : null,
                            cow.warehouse_name || null,
                          ]
                            .filter(Boolean)
                            .join(" · ")}
                        </p>
                      </div>
                      <Badge tone={statusTone(cow.is_archived ? "archived" : cow.status)}>
                        {enumLabel(cow.is_archived ? "archived" : cow.status)}
                      </Badge>
                    </button>
                  );
                })
              )}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
