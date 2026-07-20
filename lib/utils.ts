export const APP_TIME_ZONE = "Asia/Shanghai";

const SHANGHAI_UTC_OFFSET = "+08:00";
const LOCAL_DATE_TIME_PATTERN =
  /^(\d{4})-(\d{2})-(\d{2})T(\d{2}):(\d{2})$/;
const ABSOLUTE_DATE_TIME_PATTERN = /(?:Z|[+-]\d{2}:\d{2})$/i;

function dateTimeParts(value: Date) {
  return Object.fromEntries(
    new Intl.DateTimeFormat("en-CA", {
      timeZone: APP_TIME_ZONE,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
      hour: "2-digit",
      minute: "2-digit",
      hourCycle: "h23",
    })
      .formatToParts(value)
      .filter(({ type }) => type !== "literal")
      .map(({ type, value: part }) => [type, part]),
  );
}

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
    timeZone: APP_TIME_ZONE,
  }).format(new Date(value));
}

export function formatTimelineDateParts(value: string) {
  const parts = dateTimeParts(new Date(value));
  return {
    monthDay: `${parts.month}.${parts.day}`,
    year: parts.year,
  };
}

export function toAppDateTimeInput(value?: string) {
  const date = value ? new Date(value) : new Date();
  if (Number.isNaN(date.getTime())) return "";
  const parts = dateTimeParts(date);
  return `${parts.year}-${parts.month}-${parts.day}T${parts.hour}:${parts.minute}`;
}

export function appDateTimeInputToIso(value: string) {
  if (!LOCAL_DATE_TIME_PATTERN.test(value)) {
    throw new Error("发生时间格式不正确。");
  }
  const date = new Date(`${value}:00${SHANGHAI_UTC_OFFSET}`);
  if (
    Number.isNaN(date.getTime()) ||
    toAppDateTimeInput(date.toISOString()) !== value
  ) {
    throw new Error("发生时间格式不正确。");
  }
  return date.toISOString();
}

export function parseAbsoluteDateTime(value: string) {
  if (!ABSOLUTE_DATE_TIME_PATTERN.test(value)) return null;
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? null : date;
}

export function nextMilestone(days: number) {
  const milestones = [100, 365, 500, 1000, 1500, 2000, 2500, 3000, 3650];
  const next = milestones.find((item) => item > days) ?? Math.ceil(days / 1000) * 1000;
  return { next, remaining: next - days, progress: Math.min(100, (days / next) * 100) };
}
