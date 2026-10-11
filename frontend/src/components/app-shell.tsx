"use client";

import Link from "next/link";
import { usePathname, useRouter } from "next/navigation";
import { useState, useRef, useEffect } from "react";
import { useFarm } from "@/context/farm-context";

const NAV_ITEMS = [
  {
    id: "today",
    href: "/today",
    en: "Today",
    bn: "আজ",
    svg: (
      <>
        <circle cx="12" cy="12" r="4" />
        <path d="M12 3v2M12 19v2M3 12h2M19 12h2" />
      </>
    ),
  },
  {
    id: "herd",
    href: "/herd",
    en: "Herd",
    bn: "পাল",
    svg: (
      <>
        <path d="M4 8l3-3h10l3 3v6a4 4 0 01-4 4H8a4 4 0 01-4-4z" />
        <path d="M9 12v.01M15 12v.01" />
      </>
    ),
  },
  {
    id: "purchases",
    href: "/purchases",
    en: "Purchases",
    bn: "ক্রয়",
    svg: (
      <>
        <path d="M5 7h14l-1 12H6zM9 7a3 3 0 016 0" />
      </>
    ),
  },
  {
    id: "breeding",
    href: "/breeding",
    en: "Breeding",
    bn: "প্রজনন",
    svg: (
      <>
        <path d="M12 20s-7-4.5-7-10a4 4 0 017-2.5A4 4 0 0119 10c0 5.500-7 10-7 10z" />
      </>
    ),
  },
  {
    id: "health",
    href: "/health",
    en: "Health",
    bn: "স্বাস্থ্য",
    badge: 1,
    svg: (
      <>
        <path d="M12 5v14M5 12h14" />
      </>
    ),
  },
  {
    id: "expenses",
    href: "/expenses",
    en: "Expenses",
    bn: "খরচ",
    svg: (
      <>
        <rect x="3" y="6" width="18" height="12" rx="2" />
        <circle cx="12" cy="12" r="2.5" />
      </>
    ),
  },
  {
    id: "payroll",
    href: "/payroll",
    en: "Payroll",
    bn: "বেতন",
    svg: (
      <>
        <circle cx="9" cy="8" r="3" />
        <path d="M3 20c0-3 3-5 6-5s6 2 6 5M17 6a3 3 0 010 6" />
      </>
    ),
  },
  {
    id: "reports",
    href: "/reports",
    en: "Reports",
    bn: "রিপোর্ট",
    svg: (
      <>
        <path d="M5 20V10M12 20V4M19 20v-8" />
      </>
    ),
  },
  {
    id: "masters",
    href: "/masters",
    en: "Masters",
    bn: "মৌলিক তথ্য",
    svg: (
      <>
        <path d="M4 6h16M4 12h16M4 18h10" />
      </>
    ),
  },
];

export function AppShell({ children }: { children: React.ReactNode }) {
  const pathname = usePathname();
  const router = useRouter();
  const {
    language,
    setLanguage,
    theme,
    setTheme,
    shiftDate,
    formattedDate,
    toast,
    toastMsg,
    isToastVisible,
    searchOpen,
    setSearchOpen,
    cows,
    findCowByTag,
    workers,
  } = useFarm();

  const [headerSearch, setHeaderSearch] = useState("");
  const modalInputRef = useRef<HTMLInputElement>(null);
  const [modalQuery, setModalQuery] = useState("");

  const absentWorkers = workers.filter((w) => !w.p);
  const sideFootText =
    absentWorkers.length > 0
      ? language === "bn"
        ? `${absentWorkers.map((w) => w.n).join(", ")} আজ অনুপস্থিত`
        : `${absentWorkers.map((w) => w.n).join(", ")} is absent today`
      : language === "bn"
      ? "সবাই আজ উপস্থিত"
      : "Everyone is present today";

  // Determine current page title
  let currentTitle = language === "bn" ? "আজ" : "Today";
  const activeNav = NAV_ITEMS.find((item) => pathname.startsWith(item.href));
  if (activeNav) {
    currentTitle = language === "bn" ? activeNav.bn : activeNav.en;
  }
  if (pathname.startsWith("/herd/")) {
    const cowTag = pathname.split("/herd/")[1];
    currentTitle = language === "bn" ? `গরু ${cowTag}` : `Cow ${cowTag}`;
  }

  const handleHeaderSearchKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      const q = headerSearch.trim();
      if (!q) return;
      const cow = findCowByTag(q);
      if (cow) {
        setHeaderSearch("");
        router.push(`/herd/${cow.tag}`);
      } else {
        toast(language === "bn" ? "এই ট্যাগের কোনো গরু পাওয়া যায়নি" : "No cow with that tag");
      }
    }
  };

  useEffect(() => {
    if (searchOpen) {
      setTimeout(() => {
        modalInputRef.current?.focus();
      }, 50);
    } else {
      setModalQuery("");
    }
  }, [searchOpen]);

  const filteredCows = modalQuery.trim()
    ? cows.filter(
        (c) =>
          c.tag.toLowerCase().includes(modalQuery.trim().toLowerCase()) ||
          c.cat.toLowerCase().includes(modalQuery.trim().toLowerCase()) ||
          c.wh.toLowerCase().includes(modalQuery.trim().toLowerCase())
      )
    : cows.slice(0, 8);

  return (
    <div className="app">
      <aside id="nav">
        <div className="brand">
          <i>🐄</i>Cow Farm
        </div>

        {NAV_ITEMS.map((item) => {
          const isActive =
            pathname === item.href ||
            (item.href === "/herd" && pathname.startsWith("/herd")) ||
            (pathname === "/" && item.href === "/today");
          return (
            <Link
              key={item.id}
              href={item.href}
              className={isActive ? "active" : ""}
            >
              <svg viewBox="0 0 24 24">{item.svg}</svg>
              <span>{language === "bn" ? item.bn : item.en}</span>
              {item.badge ? <span className="badge">{item.badge}</span> : null}
            </Link>
          );
        })}

        <div className="side-foot">{sideFootText}</div>
      </aside>

      <main>
        <header>
          <h1 id="title">{currentTitle}</h1>

          <div className="search">
            <input
              id="q"
              placeholder={language === "bn" ? "ট্যাগ দিয়ে গরু খুঁজুন" : "Find cow by tag"}
              value={headerSearch}
              onChange={(e) => setHeaderSearch(e.target.value)}
              onKeyDown={handleHeaderSearchKeyDown}
            />
            <kbd onClick={() => setSearchOpen(true)} style={{ cursor: "pointer" }}>
              Ctrl K
            </kbd>
          </div>

          <div className="date">
            <button
              className="ghost"
              id="prev"
              onClick={() => shiftDate(-1)}
              aria-label="Previous day"
            >
              ◀
            </button>
            <span id="dt">{formattedDate}</span>
            <button
              className="ghost"
              id="next"
              onClick={() => shiftDate(1)}
              aria-label="Next day"
            >
              ▶
            </button>
          </div>

          <div className="seg" id="lang">
            <button
              className={language === "bn" ? "on" : ""}
              onClick={() => setLanguage("bn")}
            >
              বাংলা
            </button>
            <button
              className={language === "en" ? "on" : ""}
              onClick={() => setLanguage("en")}
            >
              English
            </button>
          </div>

          <div className="seg" id="theme" aria-label="Theme">
            <button
              className={theme === "system" ? "on" : ""}
              onClick={() => setTheme("system")}
            >
              Auto
            </button>
            <button
              className={theme === "light" ? "on" : ""}
              onClick={() => setTheme("light")}
            >
              Light
            </button>
            <button
              className={theme === "dark" ? "on" : ""}
              onClick={() => setTheme("dark")}
            >
              Dark
            </button>
          </div>
        </header>

        {children}
      </main>

      {/* Ctrl+K Search Modal */}
      {searchOpen && (
        <div
          className="modal-backdrop"
          onClick={(e) => {
            if (e.target === e.currentTarget) setSearchOpen(false);
          }}
        >
          <div className="modal-card" style={{ maxWidth: 480 }}>
            <h2 style={{ margin: "0 0 10px" }}>
              {language === "bn" ? "গরু অনুসন্ধান" : "Find cow"}
              <small style={{ cursor: "pointer" }} onClick={() => setSearchOpen(false)}>
                ESC
              </small>
            </h2>
            <input
              ref={modalInputRef}
              placeholder={language === "bn" ? "ট্যাগ নম্বর লিখুন (যেমন: 1047)..." : "Type cow tag (e.g. 1047)..."}
              value={modalQuery}
              onChange={(e) => setModalQuery(e.target.value)}
              style={{ marginBottom: 12 }}
            />
            <div style={{ maxHeight: 260, overflowY: "auto" }}>
              {filteredCows.length > 0 ? (
                <table>
                  <tbody>
                    {filteredCows.map((c) => (
                      <tr
                        key={c.cow_id}
                        className="clickable"
                        onClick={() => {
                          setSearchOpen(false);
                          router.push(`/herd/${c.tag}`);
                        }}
                      >
                        <td>
                          <b>{c.tag}</b>
                        </td>
                        <td>{c.cat}</td>
                        <td>{c.wh}</td>
                        <td className="num">{c.wt} kg</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              ) : (
                <div className="muted" style={{ padding: "12px 0", textAlign: "center" }}>
                  {language === "bn" ? "কোনো গরু পাওয়া যায়নি" : "No cow matches this tag."}
                </div>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Global Toast Notification */}
      <div className={`toast ${isToastVisible ? "show" : ""}`} id="toast">
        {toastMsg}
      </div>
    </div>
  );
}
