type PagePlaceholderProps = {
  title: string;
  titleBn: string;
};

export function PagePlaceholder({ title, titleBn }: PagePlaceholderProps) {
  return (
    <section className="mx-auto flex min-h-[calc(100vh-5rem)] max-w-[1280px] flex-col px-4 py-6 sm:px-6">
      <div>
        <h2 className="text-[18px] font-semibold text-ink">{title}</h2>
        <p className="mt-1 text-[13px] text-muted">{titleBn}</p>
      </div>
      <div className="mt-6 flex min-h-64 flex-1 items-center justify-center rounded-[8px] border border-dashed border-line bg-surface">
        <p className="text-[13px] text-muted">This page is ready for its first feature.</p>
      </div>
    </section>
  );
}
