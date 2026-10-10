type PagePlaceholderProps = {
  title: string;
  titleBn: string;
};

export function PagePlaceholder({ title, titleBn }: PagePlaceholderProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1440px] flex-col px-8 py-8">
      <div>
        <h1 className="text-2xl font-semibold tracking-tight text-stone-900">{title}</h1>
        <p className="mt-1 text-sm text-stone-500">{titleBn}</p>
      </div>
      <div className="mt-7 flex min-h-64 flex-1 items-center justify-center rounded-xl border border-dashed border-stone-300 bg-white/60">
        <p className="text-sm text-stone-400">This page is ready for its first feature.</p>
      </div>
    </section>
  );
}
