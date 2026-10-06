export function formatBDT(
  amount: number | string | null | undefined,
  locale: "en" | "bn" = "en"
): string {
  if (amount === null || amount === undefined || amount === "") return "৳ 0.00";
  const num = typeof amount === "string" ? parseFloat(amount) : amount;
  if (isNaN(num)) return "৳ 0.00";

  const formatted = num.toLocaleString("en-IN", {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });

  if (locale === "bn") {
    return `৳ ${toBengaliDigits(formatted)}`;
  }
  return `৳ ${formatted}`;
}

export function toBengaliDigits(input: string | number): string {
  const bengaliDigits = ["০", "১", "২", "৩", "৪", "৫", "৬", "৭", "৮", "৯"];
  return String(input).replace(/[0-9]/g, (digit) => bengaliDigits[parseInt(digit, 10)]);
}

export function formatDate(
  dateStr: string | null | undefined,
  locale: "en" | "bn" = "en"
): string {
  if (!dateStr) return "-";
  try {
    const d = new Date(dateStr);
    if (isNaN(d.getTime())) return dateStr;
    const options: Intl.DateTimeFormatOptions = {
      year: "numeric",
      month: "short",
      day: "numeric",
    };
    if (locale === "bn") {
      return d.toLocaleDateString("bn-BD", options);
    }
    return d.toLocaleDateString("en-US", options);
  } catch {
    return dateStr;
  }
}
