"use client";

import React from "react";
import { useI18n } from "@/lib/i18n";

export function ModulePage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  const { tr } = useI18n();
  const translatedSubtitle = typeof subtitle === "string" ? tr(subtitle) : subtitle;
  return (
    <section aria-label={tr(title)} className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 sm:py-5">
      {translatedSubtitle && <p className="mb-4 text-[13px] text-muted">{translatedSubtitle}</p>}
      {children}
    </section>
  );
}
