"use client";

import React, { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  LayoutDashboard,
  Beef,
  Scale,
  Utensils,
  Users,
  HeartPulse,
  Receipt,
  TrendingUp,
  Globe,
  ShieldCheck,
  Menu,
  X,
} from "lucide-react";
import { useLanguage } from "@/context/LanguageContext";
import { useAuth } from "@/context/AuthContext";
import { UserRole } from "@/types/models";

export const Navigation: React.FC = () => {
  const pathname = usePathname();
  const { locale, toggleLocale, t } = useLanguage();
  const { role, switchRole, user } = useAuth();
  const [mobileOpen, setMobileOpen] = useState(false);

  const navItems = [
    { href: "/", label: t("nav.dashboard"), icon: LayoutDashboard },
    { href: "/herd", label: t("nav.herd"), icon: Beef },
    { href: "/evaluations", label: t("nav.evaluations"), icon: Scale },
    { href: "/feeding", label: t("nav.feeding"), icon: Utensils },
    { href: "/labor", label: t("nav.labor"), icon: Users },
    { href: "/health", label: t("nav.health"), icon: HeartPulse },
    { href: "/sales", label: t("nav.sales"), icon: Receipt },
    ...(user.permissions.can_view_financial_reports
      ? [{ href: "/reports", label: t("nav.reports"), icon: TrendingUp }]
      : []),
  ];

  return (
    <>
      {/* Top Navbar */}
      <header className="sticky top-0 z-40 bg-white/80 dark:bg-zinc-900/80 backdrop-blur-md border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <button
              onClick={() => setMobileOpen(!mobileOpen)}
              className="md:hidden p-2 rounded-lg text-zinc-600 dark:text-zinc-400 hover:bg-zinc-100 dark:hover:bg-zinc-800"
            >
              {mobileOpen ? <X className="w-5 h-5" /> : <Menu className="w-5 h-5" />}
            </button>
            <Link href="/" className="flex items-center gap-2">
              <div className="w-9 h-9 rounded-xl bg-emerald-600 text-white flex items-center justify-center font-bold text-lg shadow-sm">
                🐄
              </div>
              <div>
                <span className="font-bold text-lg text-zinc-900 dark:text-zinc-100 block leading-tight">
                  {t("app_name")}
                </span>
                <span className="text-xs text-zinc-500 dark:text-zinc-400 hidden sm:block">
                  {t("tagline")}
                </span>
              </div>
            </Link>
          </div>

          <div className="flex items-center gap-2 sm:gap-4">
            {/* Language Switcher */}
            <button
              onClick={toggleLocale}
              className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg border border-zinc-200 dark:border-zinc-700 bg-zinc-50 dark:bg-zinc-800 text-xs font-semibold text-zinc-700 dark:text-zinc-200 hover:bg-zinc-100 transition shadow-xs"
              title="Toggle Language (English / বাংলা)"
            >
              <Globe className="w-3.5 h-3.5 text-emerald-600 dark:text-emerald-400" />
              <span>{locale === "bn" ? "English" : "বাংলা"}</span>
            </button>

            {/* Role Switcher for Testing & Auth */}
            <div className="flex items-center gap-1.5 bg-emerald-50 dark:bg-emerald-950/40 border border-emerald-200 dark:border-emerald-800 px-2.5 py-1 rounded-lg">
              <ShieldCheck className="w-4 h-4 text-emerald-600 dark:text-emerald-400" />
              <select
                value={role}
                onChange={(e) => switchRole(e.target.value as UserRole)}
                className="bg-transparent text-xs font-medium text-emerald-900 dark:text-emerald-200 outline-none cursor-pointer"
              >
                <option value="admin">Admin ({t("roles.admin")})</option>
                <option value="manager">Manager ({t("roles.manager")})</option>
                <option value="data_entry">Data Entry ({t("roles.data_entry")})</option>
              </select>
            </div>
          </div>
        </div>
      </header>

      {/* Secondary Desktop Horizontal Navigation Bar */}
      <nav className="hidden md:block bg-zinc-50 dark:bg-zinc-950 border-b border-zinc-200 dark:border-zinc-800">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex items-center space-x-1 py-1.5 overflow-x-auto">
            {navItems.map((item) => {
              const Icon = item.icon;
              const isActive = pathname === item.href;
              return (
                <Link
                  key={item.href}
                  href={item.href}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition shrink-0 ${
                    isActive
                      ? "bg-emerald-600 text-white shadow-xs"
                      : "text-zinc-600 dark:text-zinc-400 hover:text-zinc-900 dark:hover:text-zinc-100 hover:bg-zinc-200/60 dark:hover:bg-zinc-800"
                  }`}
                >
                  <Icon className="w-4 h-4" />
                  <span>{item.label}</span>
                </Link>
              );
            })}
          </div>
        </div>
      </nav>

      {/* Mobile Drawer */}
      {mobileOpen && (
        <div className="md:hidden fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex">
          <div className="w-72 bg-white dark:bg-zinc-900 h-full p-4 flex flex-col justify-between shadow-xl">
            <div>
              <div className="flex items-center justify-between pb-4 border-b border-zinc-200 dark:border-zinc-800">
                <span className="font-bold text-zinc-900 dark:text-zinc-100">
                  {t("app_name")}
                </span>
                <button
                  onClick={() => setMobileOpen(false)}
                  className="p-1 rounded-lg text-zinc-500 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                >
                  <X className="w-5 h-5" />
                </button>
              </div>

              <div className="mt-4 space-y-1">
                {navItems.map((item) => {
                  const Icon = item.icon;
                  const isActive = pathname === item.href;
                  return (
                    <Link
                      key={item.href}
                      href={item.href}
                      onClick={() => setMobileOpen(false)}
                      className={`flex items-center gap-3 px-3 py-2 rounded-lg text-sm font-medium transition ${
                        isActive
                          ? "bg-emerald-600 text-white"
                          : "text-zinc-700 dark:text-zinc-300 hover:bg-zinc-100 dark:hover:bg-zinc-800"
                      }`}
                    >
                      <Icon className="w-5 h-5" />
                      <span>{item.label}</span>
                    </Link>
                  );
                })}
              </div>
            </div>

            <div className="pt-4 border-t border-zinc-200 dark:border-zinc-800 text-xs text-zinc-400">
              Role: <span className="font-semibold text-emerald-600">{role}</span>
            </div>
          </div>
          <div className="flex-1" onClick={() => setMobileOpen(false)} />
        </div>
      )}
    </>
  );
};
