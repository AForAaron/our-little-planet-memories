export default function ProtectedLoading() {
  return (
    <main className="page-shell max-w-[1100px] py-7" aria-busy="true" aria-label="正在加载页面">
      <div className="h-5 w-28 animate-pulse rounded-full bg-[var(--color-control)]" />
      <div className="mt-8 h-10 w-64 animate-pulse rounded-[14px] bg-[var(--color-control)]" />
      <div className="mt-4 h-5 max-w-xl animate-pulse rounded-full bg-[var(--color-control)]" />
      <section className="mt-10 grid gap-[18px] sm:grid-cols-2 lg:grid-cols-3">
        {Array.from({ length: 6 }, (_, index) => (
          <div key={index} className="surface min-h-48 animate-pulse rounded-[22px] bg-[var(--color-surface-soft)]" />
        ))}
      </section>
    </main>
  );
}
