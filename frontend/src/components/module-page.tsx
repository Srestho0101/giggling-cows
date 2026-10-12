export function ModulePage({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto max-w-[1240px] px-[24px] py-[20px] max-[900px]:px-[14px] max-[900px]:py-[14px]">
      <div className="mb-[16px]">
        <h1 className="text-[18px] font-bold tracking-[-.015em] text-[var(--text)]">{title}</h1>
        <p className="mt-1 text-[12px] text-[var(--muted)]">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
