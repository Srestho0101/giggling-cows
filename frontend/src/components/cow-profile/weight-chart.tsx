"use client";

import React, { useMemo } from "react";
import {
  daysBetween,
  type WeightRecord,
} from "@/components/cow-profile/types";
import { useI18n } from "@/lib/i18n";

export function WeightTrendChart({ records }: { records: WeightRecord[] }) {
  const { tr, num, date: fmtDate } = useI18n();
  const chronological = useMemo(
    () =>
      records
        .filter((row) => !row.is_archived)
        .slice()
        .sort((a, b) => a.weigh_date.localeCompare(b.weigh_date)),
    [records]
  );

  if (chronological.length < 2) {
    return (
      <p className="text-[12px] text-muted">
        {tr(
          "Log at least 2 active weight measurements to view growth rate and trend chart.",
          "ওজন বৃদ্ধির হার ও চার্ট দেখতে কমপক্ষে ২টি ওজনের তথ্য লিখুন।"
        )}
      </p>
    );
  }

  const weights = chronological.map((row) => Number(row.weight_kg));
  const first = chronological[0];
  const latest = chronological[chronological.length - 1];
  const firstKg = weights[0];
  const latestKg = weights[weights.length - 1];
  const netGain = latestKg - firstKg;
  const spanDays = daysBetween(first.weigh_date, latest.weigh_date) ?? 0;
  const adg = spanDays > 0 ? netGain / spanDays : null;

  const minWeight = Math.min(...weights);
  const maxWeight = Math.max(...weights);
  const pad = Math.max(1, (maxWeight - minWeight) * 0.15);
  const yMin = minWeight - pad;
  const yMax = maxWeight + pad;
  const width = 460;
  const height = 104;
  const padX = 10;
  const padY = 12;
  const innerW = width - padX * 2;
  const innerH = height - padY * 2;

  const points = chronological.map((row, idx) => {
    const x = padX + (idx / (chronological.length - 1)) * innerW;
    const val = Number(row.weight_kg);
    const y = padY + (1 - (val - yMin) / Math.max(1, yMax - yMin)) * innerH;
    return { x, y, val, date: row.weigh_date };
  });

  const polyline = points.map((p) => `${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(" ");
  const area = `${points[0].x.toFixed(1)},${height - padY} ${polyline} ${points[points.length - 1].x.toFixed(1)},${height - padY}`;

  return (
    <div className="space-y-2.5">
      <div className="flex flex-wrap items-center justify-between gap-3 text-[12px]">
        <div className="flex flex-wrap items-center gap-4">
          <span>
            <span className="text-muted">{tr("Start:", "শুরু:")}</span>{" "}
            <strong className="font-semibold text-ink tabular-nums">{num(firstKg)} {tr("kg", "কেজি")}</strong>{" "}
            <span className="text-muted">({fmtDate(first.weigh_date)})</span>
          </span>
          <span>
            <span className="text-muted">{tr("Latest:", "সর্বশেষ:")}</span>{" "}
            <strong className="font-semibold text-ink tabular-nums">{num(latestKg)} {tr("kg", "কেজি")}</strong>
          </span>
          <span>
            <span className="text-muted">{tr("Net change:", "মোট পরিবর্তন:")}</span>{" "}
            <strong className={`font-semibold tabular-nums ${netGain >= 0 ? "text-accent" : "text-warn"}`}>
              {netGain >= 0 ? "+" : ""}
              {num(netGain)} {tr("kg", "কেজি")}
            </strong>
          </span>
          {adg !== null ? (
            <span>
              <span className="text-muted">{tr("Avg daily gain:", "দৈনিক গড় বৃদ্ধি:")}</span>{" "}
              <strong className={`font-semibold tabular-nums ${adg >= 0 ? "text-accent" : "text-warn"}`}>
                {adg >= 0 ? "+" : ""}
                {num(adg, 2)} {tr("kg/day", "কেজি/দিন")}
              </strong>
            </span>
          ) : null}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label={tr("Weight progression chart", "ওজন বৃদ্ধির চার্ট")}
      >
        <line x1={padX} y1={padY} x2={width - padX} y2={padY} className="stroke-line" strokeDasharray="3 3" />
        <line x1={padX} y1={height - padY} x2={width - padX} y2={height - padY} className="stroke-line" />
        <polygon points={area} className="fill-accent-soft opacity-70" />
        <polyline
          fill="none"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
          points={polyline}
          className="stroke-accent"
        />
        {points.map((point, index) => (
          <circle
            key={`${point.date}-${index}`}
            cx={point.x}
            cy={point.y}
            r={index === points.length - 1 ? 4 : 2.75}
            className="fill-accent stroke-surface"
            strokeWidth="1.5"
          >
            <title>{`${fmtDate(point.date)}: ${num(point.val)} ${tr("kg", "কেজি")}`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
