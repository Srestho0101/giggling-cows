"use client";

import React from "react";

export const ui = {
  input:
    "h-9 w-full rounded-[6px] border border-line-strong bg-field px-3 py-1.5 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:bg-subtle",
  textarea:
    "w-full rounded-[6px] border border-line-strong bg-field px-3 py-2 text-[13px] text-ink placeholder:text-muted focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:bg-subtle",
  select:
    "h-9 w-full rounded-[6px] border border-line-strong bg-field px-2.5 py-1.5 text-[13px] text-ink focus:outline-none focus:border-accent transition-colors disabled:opacity-50 disabled:bg-subtle",
  label:
    "block text-[13px] font-medium text-ink [&>input]:mt-1.5 [&>select]:mt-1.5 [&>textarea]:mt-1.5",
  card: "rounded-[8px] border border-line bg-surface p-4",
  link: "text-[13px] font-medium text-accent hover:underline",
};

export type BtnVariant = "primary" | "secondary" | "quiet" | "danger";
export type BtnSize = "sm" | "md";

export function btn(variant: BtnVariant = "primary", size: BtnSize = "md"): string {
  const base =
    "inline-flex items-center justify-center gap-1.5 rounded-[6px] font-medium transition-colors cursor-pointer select-none disabled:opacity-50 disabled:cursor-not-allowed";

  const sizeClass = size === "sm" ? "h-8 px-2.5 text-[12px]" : "h-9 px-3.5 text-[13px]";

  const variantClass = {
    primary: "bg-accent text-on-accent hover:bg-accent-hover font-semibold",
    secondary: "bg-surface border border-line-strong text-ink hover:bg-wash",
    quiet: "bg-transparent text-muted hover:text-ink hover:bg-wash",
    danger: "bg-warn-soft text-warn hover:opacity-90",
  }[variant];

  return `${base} ${sizeClass} ${variantClass}`;
}

export type BadgeTone = "neutral" | "good" | "warn" | "bad";

export function Badge({
  tone = "neutral",
  children,
  className = "",
}: {
  tone?: BadgeTone;
  children: React.ReactNode;
  className?: string;
}) {
  const toneClasses: Record<BadgeTone, string> = {
    neutral: "bg-subtle text-muted border border-line",
    good: "bg-accent-soft text-accent",
    warn: "bg-caution-soft text-caution",
    bad: "bg-warn-soft text-warn",
  };
  return (
    <span
      className={`inline-flex items-center rounded-[4px] px-2 py-0.5 text-[12px] font-medium leading-tight ${toneClasses[tone]} ${className}`}
    >
      {children}
    </span>
  );
}

export function statusTone(status: unknown): BadgeTone {
  const s = String(status ?? "")
    .toLowerCase()
    .trim();
  if (["active", "paid", "issued", "confirmed", "successful", "bought", "calved"].includes(s)) {
    return "good";
  }
  if (["pending", "suspected", "draft"].includes(s)) {
    return "warn";
  }
  if (["failed", "void", "deceased", "cancelled", "canceled", "aborted"].includes(s)) {
    return "bad";
  }
  return "neutral";
}

export function StatTile({
  label,
  value,
  subtext,
  className = "",
}: {
  label: string;
  value: React.ReactNode;
  subtext?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`rounded-[8px] border border-line bg-surface p-3.5 ${className}`}>
      <p className="text-[12px] font-medium text-muted">{label}</p>
      <p className="mt-1 text-[24px] font-semibold tracking-tight text-ink tabular-nums">{value}</p>
      {subtext && <p className="mt-1 text-[12px] text-muted">{subtext}</p>}
    </div>
  );
}

export function Notice({
  children,
  tone = "error",
}: {
  children: React.ReactNode;
  tone?: "error" | "success" | "info";
}) {
  const styles =
    tone === "success"
      ? "border-accent/40 bg-accent-soft text-accent"
      : tone === "info"
        ? "border-milk-strong/40 bg-milk text-ink"
        : "border-warn/40 bg-warn-soft text-warn";
  return (
    <div
      role={tone === "error" ? "alert" : "status"}
      className={`rounded-[6px] border px-3.5 py-2.5 text-[13px] ${styles}`}
    >
      {children}
    </div>
  );
}

export type TabItem = { key: string; label: string };

export function Tabs({
  items,
  active,
  onChange,
  className = "",
}: {
  items: readonly TabItem[];
  active: string;
  onChange: (key: string) => void;
  className?: string;
}) {
  return (
    <div role="tablist" className={`flex items-center gap-1 border-b border-line ${className}`}>
      {items.map((item) => {
        const isSelected = item.key === active;
        return (
          <button
            key={item.key}
            role="tab"
            type="button"
            aria-selected={isSelected}
            onClick={() => onChange(item.key)}
            className={`relative -mb-px px-3.5 py-2 text-[13px] font-medium transition-colors cursor-pointer border-b-2 ${
              isSelected
                ? "border-hay text-ink font-semibold"
                : "border-transparent text-muted hover:text-ink hover:border-line"
            }`}
          >
            {item.label}
          </button>
        );
      })}
    </div>
  );
}

export type SegmentedOption<T extends string = string> = {
  value: T;
  label: React.ReactNode;
  tone?: "accent" | "warn";
};

export function Segmented<T extends string>({
  name,
  options,
  value,
  onChange,
  size = "md",
  ariaLabel,
}: {
  name: string;
  options: readonly SegmentedOption<T>[];
  value: T;
  onChange: (value: T) => void;
  size?: "sm" | "md";
  ariaLabel?: string;
}) {
  return (
    <div
      role="radiogroup"
      aria-label={ariaLabel}
      className="inline-flex rounded-[6px] border border-line bg-subtle p-0.5"
    >
      {options.map((opt) => {
        const isChecked = opt.value === value;
        const tone = opt.tone ?? "accent";
        const activeClass =
          tone === "warn"
            ? "bg-warn text-on-accent font-semibold"
            : "bg-accent text-on-accent font-semibold";
        return (
          <label
            key={opt.value}
            className={`cursor-pointer rounded-[4px] transition-colors select-none text-center ${
              size === "sm" ? "px-2.5 py-1 text-[12px]" : "px-3 py-1.5 text-[13px]"
            } ${
              isChecked ? activeClass : "text-muted hover:text-ink"
            }`}
          >
            <input
              type="radio"
              name={name}
              value={opt.value}
              checked={isChecked}
              onChange={() => onChange(opt.value)}
              className="sr-only"
            />
            {opt.label}
          </label>
        );
      })}
    </div>
  );
}
