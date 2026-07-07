export function daysTogether(since?: string | null) {
  if (!since) return 0;
  const start = new Date(`${since}T00:00:00`);
  const now = new Date();
  return Math.max(1, Math.floor((now.getTime() - start.getTime()) / 86_400_000) + 1);
}

export function formatDate(value: string, withTime = false) {
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "long",
    day: "numeric",
    ...(withTime ? { hour: "2-digit", minute: "2-digit" } : {}),
  }).format(new Date(value));
}

export function nextMilestone(days: number) {
  const milestones = [100, 365, 500, 1000, 1500, 2000, 2500, 3000, 3650];
  const next = milestones.find((item) => item > days) ?? Math.ceil(days / 1000) * 1000;
  return { next, remaining: next - days, progress: Math.min(100, (days / next) * 100) };
}
