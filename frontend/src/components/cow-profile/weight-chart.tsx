"use client";

import React, { useMemo } from "react";
import {
  daysBetween,
  formatDisplayDate,
  formatNumber,
  type WeightRecord,
} from "@/components/cow-profile/types";

export function WeightTrendChart({ records }: { records: WeightRecord[] }) {
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
        Log at least 2 active weight measurements to view growth rate and trend chart.
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
            <span className="text-muted">Start:</span>{" "}
            <strong className="font-semibold text-ink tabular-nums">{formatNumber(firstKg)} kg</strong>{" "}
            <span className="text-muted">({formatDisplayDate(first.weigh_date)})</span>
          </span>
          <span>
            <span className="text-muted">Latest:</span>{" "}
            <strong className="font-semibold text-ink tabular-nums">{formatNumber(latestKg)} kg</strong>
          </span>
          <span>
            <span className="text-muted">Net change:</span>{" "}
            <strong className={`font-semibold tabular-nums ${netGain >= 0 ? "text-accent" : "text-warn"}`}>
              {netGain >= 0 ? "+" : ""}
              {formatNumber(netGain)} kg
            </strong>
          </span>
          {adg !== null ? (
            <span>
              <span className="text-muted">Avg daily gain:</span>{" "}
              <strong className={`font-semibold tabular-nums ${adg >= 0 ? "text-accent" : "text-warn"}`}>
                {adg >= 0 ? "+" : ""}
                {formatNumber(adg, 2)} kg/day
              </strong>
            </span>
          ) : null}
        </div>
      </div>

      <svg
        viewBox={`0 0 ${width} ${height}`}
        className="h-24 w-full overflow-visible"
        role="img"
        aria-label="Weight progression chart"
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
            <title>{`${formatDisplayDate(point.date)}: ${formatNumber(point.val)} kg`}</title>
          </circle>
        ))}
      </svg>
    </div>
  );
}
