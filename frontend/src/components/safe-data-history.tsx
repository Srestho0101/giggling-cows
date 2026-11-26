"use client";

import { useState } from "react";
import { apiRequest, apiRoutes } from "@/lib/api";
import { useI18n } from "@/lib/i18n";

type OperationEvent = {
  event_id: string;
  operation: string;
  actor_email?: string | null;
  reason?: string | null;
  occurred_at: string;
};

export function SafeDataHistory({ entityType, entityId, entityLabel }: { entityType: string; entityId: string; entityLabel?: string }) {
  const { tr, locale } = useI18n();
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [events, setEvents] = useState<OperationEvent[]>([]);

  async function showHistory() {
    setOpen(true);
    setLoading(true);
    setError("");
    try {
      setEvents(await apiRequest<OperationEvent[]>(apiRoutes.audit.safeDataOperations(entityType, entityId)));
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : "Could not load operation history.");
    } finally {
      setLoading(false);
    }
  }

  return (
    <>
      <button type="button" onClick={() => void showHistory()} className="font-medium text-muted hover:underline cursor-pointer">
        {tr("History")}
      </button>
      {open && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4" role="presentation" onClick={() => setOpen(false)}>
          <section
            role="dialog"
            aria-modal="true"
            aria-label={tr("Archive and void history", "আর্কাইভ ও বাতিল ইতিহাস")}
            className="max-h-[80vh] w-full max-w-xl overflow-y-auto rounded-lg border border-line bg-surface p-5 text-ink shadow-overlay"
            onClick={(event) => event.stopPropagation()}
          >
            <div className="flex items-start justify-between gap-4">
              <div>
                <h2 className="text-base font-semibold text-ink">{tr("Archive and void history", "আর্কাইভ ও বাতিল ইতিহাস")}</h2>
                <p className="mt-1 text-xs text-muted">
                  {entityLabel ? `${entityType.replaceAll("_", " ")} · ${entityLabel}` : entityType.replaceAll("_", " ")}
                </p>
              </div>
              <button type="button" onClick={() => setOpen(false)} className="text-sm text-muted hover:text-ink cursor-pointer">{tr("Close")}</button>
            </div>
            {loading ? <p className="mt-5 text-sm text-muted">{tr("Loading history…", "ইতিহাস লোড হচ্ছে…")}</p> : null}
            {error ? <p role="alert" className="mt-5 text-sm text-warn">{error}</p> : null}
            {!loading && !error && events.length === 0 ? (
              <p className="mt-5 text-sm text-muted">{tr("No lifecycle actions have been recorded for this row yet.", "এই রেকর্ডের কোনো ইতিহাস এখনও নেই।")}</p>
            ) : null}
            <ol className="mt-4 space-y-3">
              {events.map((item) => (
                <li key={item.event_id} className="rounded-md border border-line p-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <strong className="text-sm capitalize text-ink">{item.operation.replaceAll("_", " ")}</strong>
                    <time className="text-xs text-muted" dateTime={item.occurred_at}>{new Date(item.occurred_at).toLocaleString(locale)}</time>
                  </div>
                  <p className="mt-1 text-xs text-muted">By {item.actor_email ?? "Unknown user"}</p>
                  {item.reason ? <p className="mt-2 text-sm text-ink">Reason: {item.reason}</p> : null}
                </li>
              ))}
            </ol>
          </section>
        </div>
      )}
    </>
  );
}
