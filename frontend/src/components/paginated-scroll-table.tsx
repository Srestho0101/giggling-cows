"use client";

import React, { useMemo, useState } from "react";

export type PaginatedColumn<T> = {
  key: string;
  label: string;
  align?: "left" | "right";
  render: (row: T) => React.ReactNode;
};

type PaginatedTableCardProps<T> = {
  title: string;
  subtitle?: React.ReactNode;
  rows: T[];
  rowKey: (row: T, index: number) => string;
  columns: PaginatedColumn<T>[];
  emptyMessage?: string;
  headerActions?: React.ReactNode;
  topContent?: React.ReactNode;
  defaultPageSize?: number;
  pageSizeOptions?: number[];
  scrollHeightClass?: string;
};

export function PaginatedTableCard<T>({
  title,
  subtitle,
  rows,
  rowKey,
  columns,
  emptyMessage = "No records yet.",
  headerActions,
  topContent,
  defaultPageSize = 10,
  pageSizeOptions = [5, 10, 20, 50],
  scrollHeightClass = "max-h-[260px]",
}: PaginatedTableCardProps<T>) {
  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  const total = rows.length;
  const totalPages = Math.max(1, Math.ceil(total / pageSize));
  const currentPage = Math.min(page, totalPages);

  const pageRows = useMemo(() => {
    const start = (currentPage - 1) * pageSize;
    return rows.slice(start, start + pageSize);
  }, [rows, currentPage, pageSize]);

  const startItem = total === 0 ? 0 : (currentPage - 1) * pageSize + 1;
  const endItem = Math.min(currentPage * pageSize, total);

  const pageNumbers = useMemo(() => {
    if (totalPages <= 5) {
      return Array.from({ length: totalPages }, (_, index) => index + 1);
    }
    const items: (number | "ellipsis")[] = [1];
    const left = Math.max(2, currentPage - 1);
    const right = Math.min(totalPages - 1, currentPage + 1);
    if (left > 2) items.push("ellipsis");
    for (let p = left; p <= right; p += 1) items.push(p);
    if (right < totalPages - 1) items.push("ellipsis");
    items.push(totalPages);
    return items;
  }, [currentPage, totalPages]);

  return (
    <section className="flex flex-col overflow-hidden rounded-[8px] border border-line bg-surface">
      <div className="flex flex-wrap items-center justify-between gap-3 border-b border-line px-4 py-3">
        <div className="min-w-0">
          <div className="flex items-center gap-2">
            <h3 className="text-[14px] font-semibold text-ink">{title}</h3>
            <span className="inline-flex items-center rounded-[4px] border border-line bg-subtle px-1.5 py-0.5 text-[11px] font-medium text-muted tabular-nums">
              {total}
            </span>
          </div>
          {subtitle ? <p className="mt-0.5 text-[12px] text-muted">{subtitle}</p> : null}
        </div>
        {headerActions ? <div className="flex flex-wrap items-center gap-3">{headerActions}</div> : null}
      </div>

      {topContent ? <div className="border-b border-line bg-subtle/60 px-4 py-3">{topContent}</div> : null}

      {total > 0 ? (
        <div className={`${scrollHeightClass} overflow-auto`}>
          <table className="w-full border-collapse text-left text-[12.5px]">
            <thead className="sticky top-0 z-10 border-b border-line bg-subtle text-[11.5px] font-medium text-muted">
              <tr>
                {columns.map((column) => (
                  <th
                    key={column.key}
                    className={`whitespace-nowrap px-3.5 py-2.5 ${
                      column.align === "right" ? "text-right" : "text-left"
                    }`}
                  >
                    {column.label}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-line">
              {pageRows.map((row, index) => (
                <tr key={rowKey(row, index)} className="transition-colors hover:bg-wash">
                  {columns.map((column) => (
                    <td
                      key={column.key}
                      className={`whitespace-nowrap px-3.5 py-2.5 text-ink ${
                        column.align === "right" ? "text-right tabular-nums" : "text-left"
                      }`}
                    >
                      {column.render(row)}
                    </td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="px-4 py-8 text-center text-[13px] text-muted">{emptyMessage}</p>
      )}

      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-line bg-subtle/70 px-4 py-2.5 text-[12px] text-muted">
        <span className="tabular-nums">
          {total === 0 ? "0 records" : `Showing ${startItem}–${endItem} of ${total}`}
        </span>
        <div className="flex flex-wrap items-center gap-2">
          <label className="flex items-center gap-1.5">
            <span>Rows</span>
            <select
              aria-label={`${title} rows per page`}
              value={pageSize}
              onChange={(event) => {
                setPageSize(Number(event.target.value));
                setPage(1);
              }}
              className="h-7 rounded-[5px] border border-line-strong bg-field px-1.5 text-[12px] text-ink"
            >
              {pageSizeOptions.map((size) => (
                <option key={size} value={size}>
                  {size}
                </option>
              ))}
            </select>
          </label>
          <div className="flex items-center gap-1">
            <button
              type="button"
              aria-label={`Previous ${title} page`}
              disabled={currentPage <= 1}
              onClick={() => setPage(Math.max(1, currentPage - 1))}
              className="h-7 rounded-[5px] border border-line bg-surface px-2 text-[12px] font-medium text-ink transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:opacity-45"
            >
              Prev
            </button>
            {pageNumbers.map((item, idx) =>
              item === "ellipsis" ? (
                <span key={`ellipsis-${idx}`} className="px-1 text-muted">
                  …
                </span>
              ) : (
                <button
                  key={item}
                  type="button"
                  aria-current={item === currentPage ? "page" : undefined}
                  onClick={() => setPage(item)}
                  className={`h-7 min-w-7 rounded-[5px] border px-2 text-[12px] font-medium tabular-nums transition-colors ${
                    item === currentPage
                      ? "border-accent bg-accent text-on-accent"
                      : "border-line bg-surface text-ink hover:bg-wash"
                  }`}
                >
                  {item}
                </button>
              )
            )}
            <button
              type="button"
              aria-label={`Next ${title} page`}
              disabled={currentPage >= totalPages}
              onClick={() => setPage(Math.min(totalPages, currentPage + 1))}
              className="h-7 rounded-[5px] border border-line bg-surface px-2 text-[12px] font-medium text-ink transition-colors hover:bg-wash disabled:cursor-not-allowed disabled:opacity-45"
            >
              Next
            </button>
          </div>
        </div>
      </div>
    </section>
  );
}
