"use client";

export default function ProtectedError({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="page-shell grid min-h-[58vh] max-w-[760px] place-items-center py-10">
      <section className="surface w-full rounded-[24px] p-8 text-center sm:p-10">
        <span className="eyebrow">暂时没有抵达</span>
        <h1 className="mt-4 font-heading text-2xl font-semibold text-text">这一页加载得有点慢</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-7 text-muted">
          网络或服务暂时没有回应。重新尝试不会丢失已保存的内容。
        </p>
        <button type="button" className="button-primary mt-7" onClick={reset}>
          重新尝试
        </button>
      </section>
    </main>
  );
}
