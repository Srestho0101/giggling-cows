"use client";

import { useCallback, useSyncExternalStore } from "react";

const memoryStore = new Map<string, string>();
const listeners = new Set<() => void>();

function notify() {
  listeners.forEach((listener) => listener());
}

if (typeof window !== "undefined") {
  window.addEventListener("storage", () => {
    notify();
  });
}

function getStoredValue(key: string, fallback: string): string {
  if (typeof window === "undefined") return fallback;
  try {
    const value = window.localStorage.getItem(key);
    return value !== null ? value : fallback;
  } catch {
    return memoryStore.get(key) ?? fallback;
  }
}

function setStoredValue(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    memoryStore.set(key, value);
  }
  notify();
}

export function usePreference<T extends string>(key: string, fallback: T): [T, (next: T) => void] {
  const subscribe = useCallback((onStoreChange: () => void) => {
    listeners.add(onStoreChange);
    return () => {
      listeners.delete(onStoreChange);
    };
  }, []);

  const getSnapshot = useCallback(() => {
    return getStoredValue(key, fallback) as T;
  }, [key, fallback]);

  const getServerSnapshot = useCallback(() => {
    return fallback;
  }, [fallback]);

  const value = useSyncExternalStore(subscribe, getSnapshot, getServerSnapshot);

  const setValue = useCallback(
    (next: T) => {
      setStoredValue(key, next);
    },
    [key]
  );

  return [value, setValue];
}
