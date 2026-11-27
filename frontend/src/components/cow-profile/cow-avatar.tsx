"use client";

import React, { useRef, useState } from "react";
import { apiRoutes, apiUpload, apiRequest, resolveMediaUrl } from "@/lib/api";

type CowAvatarProps = {
  cowId: string;
  tag: string;
  profilePictureUrl?: string | null;
  size?: "sm" | "md" | "lg" | "xl";
  editable?: boolean;
  onUpdated?: () => Promise<void> | void;
  onError?: (message: string) => void;
  onNotice?: (message: string) => void;
};

const sizeMap = {
  sm: "h-7 w-7 text-[11px]",
  md: "h-10 w-10 text-[13px]",
  lg: "h-14 w-14 text-[16px]",
  xl: "h-20 w-20 sm:h-24 sm:w-24 text-[22px]",
};

export function CowAvatar({
  cowId,
  tag,
  profilePictureUrl,
  size = "md",
  editable = false,
  onUpdated,
  onError,
  onNotice,
}: CowAvatarProps) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [imgFailed, setImgFailed] = useState(false);

  const resolvedUrl = !imgFailed ? resolveMediaUrl(profilePictureUrl) : null;

  async function handleFileChange(event: React.ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    event.target.value = "";
    if (!file) return;

    setUploading(true);
    onError?.("");
    onNotice?.("");
    try {
      const formData = new FormData();
      formData.append("file", file);
      await apiUpload(apiRoutes.herd.profilePicture(cowId), formData);
      setImgFailed(false);
      onNotice?.("Profile picture updated.");
      await onUpdated?.();
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "Could not upload profile picture.");
    } finally {
      setUploading(false);
    }
  }

  async function handleRemove() {
    setUploading(true);
    onError?.("");
    onNotice?.("");
    try {
      await apiRequest(apiRoutes.herd.profilePicture(cowId), { method: "DELETE" });
      setPreviewOpen(false);
      onNotice?.("Profile picture removed.");
      await onUpdated?.();
    } catch (cause) {
      onError?.(cause instanceof Error ? cause.message : "Could not remove profile picture.");
    } finally {
      setUploading(false);
    }
  }

  const initials = (tag || "C").slice(0, 2).toUpperCase();

  return (
    <>
      <div className="relative inline-flex shrink-0">
        <button
          type="button"
          onClick={() => {
            if (resolvedUrl) setPreviewOpen(true);
            else if (editable) inputRef.current?.click();
          }}
          title={
            resolvedUrl
              ? `View ${tag} photo`
              : editable
                ? `Upload photo for ${tag}`
                : tag
          }
          className={`relative overflow-hidden rounded-full border-2 border-line-strong bg-subtle ring-2 ring-surface shadow-sm flex items-center justify-center font-semibold text-muted select-none transition hover:border-accent ${
            sizeMap[size]
          } ${resolvedUrl || editable ? "cursor-pointer" : "cursor-default"}`}
        >
          {resolvedUrl ? (
            // eslint-disable-next-line @next/next/no-img-element
            <img
              src={resolvedUrl}
              alt={`Cow ${tag}`}
              onError={() => setImgFailed(true)}
              className="h-full w-full rounded-full object-cover"
            />
          ) : (
            <span className="flex flex-col items-center justify-center leading-none">
              <svg
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="1.6"
                className={size === "sm" ? "h-4 w-4" : size === "xl" ? "h-9 w-9" : "h-5 w-5"}
                aria-hidden="true"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6.5 7.5C5 6 3.5 6.5 3 8c1.5 1 2.5 1 3.5.5M17.5 7.5C19 6 20.5 6.5 21 8c-1.5 1-2.5 1-3.5.5M7 9.5a5 5 0 0 1 10 0v3.2a4.5 4.5 0 0 1-1.6 3.5l-.4.3a4.5 4.5 0 0 1-6 0l-.4-.3A4.5 4.5 0 0 1 7 12.7V9.5Z"
                />
                <circle cx="10" cy="11.5" r="0.7" fill="currentColor" />
                <circle cx="14" cy="11.5" r="0.7" fill="currentColor" />
                <path strokeLinecap="round" d="M10.2 15.2h.01M13.8 15.2h.01" />
              </svg>
              {size === "xl" ? (
                <span className="mt-1 text-[10px] font-medium tracking-wide">{initials}</span>
              ) : null}
            </span>
          )}
          {uploading ? (
            <span className="absolute inset-0 flex items-center justify-center rounded-full bg-black/45 text-[11px] font-medium text-white">
              …
            </span>
          ) : null}
        </button>

        {editable ? (
          <>
            <input
              ref={inputRef}
              type="file"
              accept="image/jpeg,image/png,image/webp,image/gif"
              onChange={(e) => void handleFileChange(e)}
              className="hidden"
            />
            <button
              type="button"
              disabled={uploading}
              onClick={() => inputRef.current?.click()}
              title={resolvedUrl ? "Change profile picture" : "Upload profile picture"}
              className="absolute -bottom-0.5 -right-0.5 flex h-7 w-7 items-center justify-center rounded-full border-2 border-surface bg-ink text-surface shadow-sm transition hover:opacity-90 disabled:opacity-50"
            >
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" className="h-3.5 w-3.5">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M4 8.5A2.5 2.5 0 0 1 6.5 6H8l1.2-1.8A1.5 1.5 0 0 1 10.45 3.5h3.1a1.5 1.5 0 0 1 1.25.7L16 6h1.5A2.5 2.5 0 0 1 20 8.5v9a2.5 2.5 0 0 1-2.5 2.5h-11A2.5 2.5 0 0 1 4 17.5v-9Z"
                />
                <circle cx="12" cy="12.5" r="3" />
              </svg>
            </button>
          </>
        ) : null}
      </div>

      {previewOpen && resolvedUrl ? (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-black/70 p-4"
          onClick={() => setPreviewOpen(false)}
        >
          <div
            className="w-full max-w-md rounded-[12px] border border-line bg-surface p-4 shadow-xl"
            onClick={(e) => e.stopPropagation()}
          >
            <div className="flex items-center justify-between gap-3 pb-3">
              <h3 className="text-[14px] font-semibold text-ink">Cow {tag}</h3>
              <button
                type="button"
                onClick={() => setPreviewOpen(false)}
                className="rounded-[6px] px-2 py-1 text-[12px] text-muted hover:bg-subtle hover:text-ink"
              >
                Close
              </button>
            </div>
            <div className="flex justify-center py-2">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={resolvedUrl}
                alt={`Cow ${tag}`}
                className="h-64 w-64 rounded-full border-2 border-line-strong object-cover shadow-md"
              />
            </div>
            {editable ? (
              <div className="mt-4 flex flex-wrap justify-end gap-2 border-t border-line pt-3">
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => {
                    setPreviewOpen(false);
                    inputRef.current?.click();
                  }}
                  className="rounded-[6px] border border-line-strong bg-surface px-3 py-1.5 text-[12.5px] font-medium text-ink hover:bg-subtle"
                >
                  Change photo
                </button>
                <button
                  type="button"
                  disabled={uploading}
                  onClick={() => void handleRemove()}
                  className="rounded-[6px] border border-danger/30 bg-danger/10 px-3 py-1.5 text-[12.5px] font-medium text-danger hover:bg-danger/15"
                >
                  Remove photo
                </button>
              </div>
            ) : null}
          </div>
        </div>
      ) : null}
    </>
  );
}
