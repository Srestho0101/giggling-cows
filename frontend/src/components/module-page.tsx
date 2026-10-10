export function ModulePage({ title, subtitle, children }: { title: string; subtitle: React.ReactNode; children: React.ReactNode }) {
  return (
    <section className="mx-auto min-h-[calc(100vh-5rem)] max-w-[1440px] px-8 py-8">
      <div className="mb-7 border-b border-stone-200 pb-5">
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-1.5 text-sm text-stone-500">{subtitle}</p>
      </div>
      {children}
    </section>
  );
}
