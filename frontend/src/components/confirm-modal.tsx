"use client";

import React, { useEffect, useState } from "react";
import { btn, ui } from "@/components/ui";
import { useI18n } from "@/lib/i18n";

export type ConfirmModalConfig = {
  title: string;
  description?: string;
  mode?: "confirm" | "reason";
  confirmLabel?: string;
  cancelLabel?: string;
  tone?: "primary" | "danger";
  reasonLabel?: string;
  reasonPlaceholder?: string;
  onConfirm: (reason?: string) => Promise<void> | void;
};

export function ConfirmActionModal({
  config,
  onClose,
}: {
  config: ConfirmModalConfig | null;
  onClose: () => void;
}) {
  const { tr } = useI18n();
  const [reason, setReason] = useState("");
  const [validationError, setValidationError] = useState("");
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    if (!config) return;
    function onKeyDown(event: KeyboardEvent) {
      if (event.key === "Escape" && !busy) {
        onClose();
      }
    }
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [config, busy, onClose]);

  if (!config) return null;

  const isReasonMode = config.mode === "reason";
  const tone = config.tone ?? "danger";

  async function handleSubmit(event: React.FormEvent) {
    event.preventDefault();
    if (!config) return;
    const trimmed = reason.trim();
    if (isReasonMode && !trimmed) {
      setValidationError(tr("A reason is required."));
      return;
    }
    setBusy(true);
    setValidationError("");
    try {
      await config.onConfirm(isReasonMode ? trimmed : undefined);
      setReason("");
      onClose();
    } catch (cause) {
      setValidationError(
        cause instanceof Error
          ? cause.message
          : tr("Action failed. Please try again.", "কাজটি সম্পন্ন হয়নি। আবার চেষ্টা করুন।")
      );
    } finally {
      setBusy(false);
    }
  }

  return (
    <div
      role="presentation"
      onClick={(event) => {
        if (event.target === event.currentTarget && !busy) {
          setReason("");
          setValidationError("");
          onClose();
        }
      }}
      className="fixed inset-0 z-50 flex items-center justify-center bg-overlay p-4"
    >
      <form
        role="dialog"
        aria-modal="true"
        aria-label={config.title}
        onSubmit={(event) => void handleSubmit(event)}
        noValidate
        className="w-full max-w-md rounded-[8px] border border-line bg-surface p-5 text-ink shadow-overlay space-y-4"
      >
        <div>
          <h3 className="text-[16px] font-semibold text-ink">{config.title}</h3>
          {config.description ? (
            <p className="mt-1 text-[13px] text-muted">{config.description}</p>
          ) : null}
        </div>

        {validationError ? (
          <div
            role="alert"
            className="rounded-[6px] border border-warn/40 bg-warn-soft px-3 py-2 text-[12.5px] text-warn"
          >
            {validationError}
          </div>
        ) : null}

        {isReasonMode ? (
          <label className="block text-[12.5px] font-medium text-ink">
            <span className="mb-1.5 block">
              {config.reasonLabel ?? tr("Reason for voiding")} <span className="text-warn">*</span>
            </span>
            <textarea
              rows={2}
              autoFocus
              value={reason}
              onChange={(event) => {
                setReason(event.target.value);
                if (validationError) setValidationError("");
              }}
              placeholder={
                config.reasonPlaceholder ??
                tr("Enter a brief reason…", "সংক্ষিপ্ত কারণ লিখুন…")
              }
              className={ui.textarea}
            />
          </label>
        ) : null}

        <div className="flex justify-end gap-2 pt-1">
          <button
            type="button"
            disabled={busy}
            onClick={() => {
              setReason("");
              setValidationError("");
              onClose();
            }}
            className={btn("secondary", "md")}
          >
            {config.cancelLabel ?? tr("Cancel")}
          </button>
          <button
            type="submit"
            autoFocus={!isReasonMode}
            disabled={busy}
            className={btn(tone === "danger" ? "danger" : "primary", "md")}
          >
            {busy
              ? tr("Saving…")
              : config.confirmLabel ?? tr("Confirm")}
          </button>
        </div>
      </form>
    </div>
  );
}
