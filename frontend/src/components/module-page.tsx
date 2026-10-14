import React from "react";

export function ModulePage({
  title,
  subtitle,
  children,
}: {
  title: string;
  subtitle?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <section aria-label={title} className="mx-auto max-w-[1280px] px-4 py-4 sm:px-6 sm:py-5">
      {subtitle && <p className="mb-4 text-[13px] text-muted">{subtitle}</p>}
      {children}
    </section>
  );
}
