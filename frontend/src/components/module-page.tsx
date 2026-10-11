export function ModulePage({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[1240px] px-[16px] py-[12px]">
      <div className="mb-[10px]">
        <h1 className="text-[17px] font-bold text-[var(--text)]">{title}</h1>
        <p className="mt-0.5 text-[11px] text-[var(--muted)]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
