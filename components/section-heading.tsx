export function SectionHeading({
  title,
  description,
  tone = "coral",
}: {
  title: string;
  description: string;
  tone?: "coral" | "amber" | "pink";
}) {
  const colors = {
    coral: "var(--color-accent)",
    amber: "var(--color-amber)",
    pink: "var(--color-pink)",
  };
  return (
    <div className="mb-5 border-b border-line pb-4">
      <div className="flex flex-wrap items-end gap-x-3 gap-y-1">
        <span className="mb-1 size-3 rounded-[var(--radius-xs)]" style={{ background: colors[tone] }} />
        <h2 className="font-heading text-xl font-bold">{title}</h2>
        <p className="pb-0.5 text-sm text-muted">{description}</p>
      </div>
    </div>
  );
}
