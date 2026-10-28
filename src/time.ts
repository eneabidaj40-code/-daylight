import { formatInTimeZone, fromZonedTime } from "date-fns-tz";

export const dayKey = (value: string | Date, tz: string) =>
  formatInTimeZone(value, tz, "yyyy-MM-dd");
export const clockTime = (value: string | Date, tz: string) =>
  formatInTimeZone(value, tz, "HH:mm");
export const localInput = (value: string | Date, tz: string) =>
  formatInTimeZone(value, tz, "yyyy-MM-dd'T'HH:mm");
export const at = (day: string, time: string, tz: string) =>
  fromZonedTime(`${day}T${time}:00`, tz).toISOString();
export const minutes = (time: string) =>
  Number(time.slice(0, 2)) * 60 + Number(time.slice(3));
export const timeOf = (minute: number) =>
  `${String(Math.floor(minute / 60) % 24).padStart(2, "0")}:${String(Math.floor(minute % 60)).padStart(2, "0")}`;
export const addDays = (day: string, n: number) => {
  const date = new Date(`${day}T12:00:00Z`);
  date.setUTCDate(date.getUTCDate() + n);
  return date.toISOString().slice(0, 10);
};
export const daysBetween = (a: string, b: string) =>
  Math.round(
    (Date.parse(`${b}T12:00:00Z`) - Date.parse(`${a}T12:00:00Z`)) / 86400000,
  );
export const weekday = (day: string) =>
  new Date(`${day}T12:00:00Z`).getUTCDay() || 7;
export const weekStart = (day: string) => addDays(day, 1 - weekday(day));
export const duration = (event: { start: string; end: string }) =>
  Math.round((Date.parse(event.end) - Date.parse(event.start)) / 60000);
export const hours = (m: number) =>
  `${(m / 60).toLocaleString(undefined, { maximumFractionDigits: 1 })}h`;
export const humanDuration = (m: number) =>
  m >= 60
    ? `${Math.floor(m / 60)}h${m % 60 ? ` ${Math.round(m % 60)}m` : ""}`
    : `${Math.round(m)}m`;
export const prettyDay = (
  day: string,
  options: Intl.DateTimeFormatOptions = { month: "long", day: "numeric" },
) =>
  new Date(`${day}T12:00:00Z`).toLocaleDateString("en-GB", {
    ...options,
    timeZone: "UTC",
  });
export const overlap = (
  a: { start: string; end: string },
  b: { start: string; end: string },
) =>
  Date.parse(a.start) < Date.parse(b.end) &&
  Date.parse(b.start) < Date.parse(a.end);
export function countdown(iso: string, now: Date) {
  const delta = Date.parse(iso) - now.getTime();
  if (delta <= 0) return "Passed";
  const m = Math.ceil(delta / 60000),
    d = Math.floor(m / 1440);
  return d > 0
    ? `${d}d ${Math.floor((m % 1440) / 60)}h`
    : m >= 60
      ? `${Math.floor(m / 60)}h ${m % 60}m`
      : `${m}m`;
}
