"use client";

import React, { createContext, useContext, useState, useSyncExternalStore } from "react";

export function todayInDhaka(): string {
  const parts = new Intl.DateTimeFormat("en-CA", {
    timeZone: "Asia/Dhaka",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).formatToParts(new Date());
  const values = Object.fromEntries(parts.map((p) => [p.type, p.value]));
  return `${values.year}-${values.month}-${values.day}`;
}

export function shiftIsoDate(iso: string, days: number): string {
  if (!iso) return "";
  const [year, month, day] = iso.split("-").map(Number);
  const d = new Date(Date.UTC(year, month - 1, day));
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}

export function formatIsoDate(iso: string, locale: string = "en-GB"): string {
  if (!iso) return "—";
  const date = new Date(`${iso}T00:00:00Z`);
  return new Intl.DateTimeFormat(locale, {
    day: "2-digit",
    month: "short",
    year: "numeric",
    timeZone: "UTC",
  }).format(date);
}

const subscribeNever = () => () => {};

export type WorkspaceDateContextValue = {
  date: string;
  isToday: boolean;
  isReady: boolean;
  setDate: (date: string) => void;
  shift: (days: number) => void;
  reset: () => void;
};

const WorkspaceDateContext = createContext<WorkspaceDateContextValue | null>(null);

export function WorkspaceDateProvider({ children }: { children: React.ReactNode }) {
  const clientToday = useSyncExternalStore(subscribeNever, todayInDhaka, () => "");
  const [overrideDate, setOverrideDate] = useState<string | null>(null);

  const date = overrideDate ?? clientToday;
  const isReady = date !== "";
  const isToday = isReady && (overrideDate === null || overrideDate === clientToday);

  const setDate = (next: string) => {
    setOverrideDate(next);
  };

  const shift = (days: number) => {
    const base = overrideDate ?? clientToday;
    if (base) {
      setOverrideDate(shiftIsoDate(base, days));
    }
  };

  const reset = () => {
    setOverrideDate(null);
  };

  return (
    <WorkspaceDateContext.Provider
      value={{
        date,
        isToday,
        isReady,
        setDate,
        shift,
        reset,
      }}
    >
      {children}
    </WorkspaceDateContext.Provider>
  );
}

export function useWorkspaceDate(): WorkspaceDateContextValue {
  const context = useContext(WorkspaceDateContext);
  if (!context) {
    throw new Error("useWorkspaceDate must be used within a WorkspaceDateProvider");
  }
  return context;
}
