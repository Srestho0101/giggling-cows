export default function LoginPage() {
  return (
    <main className="grid min-h-screen place-items-center bg-canvas px-4">
      <section className="w-full max-w-sm rounded-[8px] border border-line bg-surface p-6">
        <div className="flex items-center gap-2.5">
          <svg viewBox="0 0 28 28" className="size-7 shrink-0" aria-hidden="true">
            <rect width="28" height="28" rx="7" fill="var(--hay)" />
            <path d="M14 6c-3 4.5-6 8-6 11a6 6 0 0 0 12 0c0-3-3-6.5-6-11Z" fill="#0b0d0f" />
          </svg>
          <span className="text-[16px] font-bold text-ink">Cow Farm</span>
        </div>
        <h1 className="mt-5 text-[18px] font-semibold text-ink">Sign in</h1>
        <p className="mt-1 text-[13px] text-muted">
          The sign-in form will be added in the authentication step.
        </p>
      </section>
    </main>
  );
}
