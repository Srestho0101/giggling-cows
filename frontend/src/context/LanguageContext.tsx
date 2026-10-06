"use client";

import React, { createContext, useContext, useEffect, useState } from "react";
import en from "@/locales/en.json";
import bn from "@/locales/bn.json";

type Locale = "en" | "bn";

interface LanguageContextType {
  locale: Locale;
  setLocale: (l: Locale) => void;
  toggleLocale: () => void;
  t: (path: string, fallback?: string) => string;
}

const dictionaries: Record<Locale, any> = { en, bn };

const LanguageContext = createContext<LanguageContextType>({
  locale: "bn",
  setLocale: () => {},
  toggleLocale: () => {},
  t: (path) => path,
});

export const LanguageProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const [locale, setLocaleState] = useState<Locale>("bn");

  useEffect(() => {
    const saved = localStorage.getItem("cowfarm_locale") as Locale;
    if (saved && (saved === "en" || saved === "bn")) {
      setLocaleState(saved);
    }
  }, []);

  const setLocale = (l: Locale) => {
    setLocaleState(l);
    localStorage.setItem("cowfarm_locale", l);
  };

  const toggleLocale = () => {
    const next = locale === "bn" ? "en" : "bn";
    setLocale(next);
  };

  const t = (path: string, fallback?: string): string => {
    const parts = path.split(".");
    let curr = dictionaries[locale];
    for (const p of parts) {
      if (curr && typeof curr === "object" && p in curr) {
        curr = curr[p];
      } else {
        // Fallback to english
        let enCurr = dictionaries["en"];
        for (const ep of parts) {
          if (enCurr && typeof enCurr === "object" && ep in enCurr) {
            enCurr = enCurr[ep];
          } else {
            return fallback || path;
          }
        }
        return typeof enCurr === "string" ? enCurr : fallback || path;
      }
    }
    return typeof curr === "string" ? curr : fallback || path;
  };

  return (
    <LanguageContext.Provider value={{ locale, setLocale, toggleLocale, t }}>
      {children}
    </LanguageContext.Provider>
  );
};

export const useLanguage = () => useContext(LanguageContext);
