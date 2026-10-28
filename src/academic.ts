import type { AppState } from "./model";
import { at, dayKey, daysBetween, overlap, weekday, weekStart } from "./time";

export const isoAdd = (value: string, minutes: number) =>
  new Date(Date.parse(value) + minutes * 60000).toISOString();
export const activeExamPeriods = (state: AppState, date: string) =>
  state.examPeriods.filter((p) => p.startDate <= date && p.endDate >= date);
export const classesSuspended = (state: AppState, date: string) =>
  state.settings.suspendClassesDuringExamPeriods &&
  activeExamPeriods(state, date).some((p) => p.suspendClasses);
export function recurringClasses(state: AppState, date: string) {
  if (classesSuspended(state, date)) return [];
  return state.classes.filter(
    (c) =>
      date >= c.startDate &&
      date <= c.endDate &&
      weekday(date) === c.weekday &&
      Math.floor(daysBetween(weekStart(c.startDate), weekStart(date)) / 7) %
        c.interval ===
        0,
  );
}

// All consumers use the same local academic date and the same trip calculation.
export function campusTrip(state: AppState, date: string) {
  const s = state.settings,
    tz = s.timezone;
  const anchors = [
    ...recurringClasses(state, date)
      .filter((c) => !state.completions[`class:${c.id}:${date}`]?.skipped)
      .map((c) => ({
        start: at(date, c.startTime, tz),
        end: at(date, c.endTime, tz),
      })),
    ...state.exams
      .filter((e) => e.date === date && e.requiresUniversityTrip)
      .map((e) => {
        const start = at(date, e.time, tz);
        return { start, end: isoAdd(start, e.duration) };
      }),
    ...state.activities.filter(
      (a) => a.requiresUniversityTrip && dayKey(a.start, tz) === date,
    ),
  ];
  if (!anchors.length) return null;
  const first = anchors.reduce(
    (v, a) => (a.start < v ? a.start : v),
    anchors[0].start,
  );
  const last = anchors.reduce(
    (v, a) => (a.end > v ? a.end : v),
    anchors[0].end,
  );
  const rule =
    state.commuteRules.find((r) => r.date === date) ??
    state.commuteRules.find((r) => r.weekday === weekday(date));
  const warnings: string[] = [];
  const requested =
    rule?.mode === "departure"
      ? at(date, rule.departureTime!, tz)
      : isoAdd(last, rule?.waitingMinutes ?? 0);
  const departure = requested < last ? last : requested;
  if (requested < last)
    warnings.push(
      "The configured bus leaves before your final campus commitment ends. Departure is moved to the commitment end; check the next bus.",
    );
  let arrival = isoAdd(departure, rule?.durationMinutes ?? s.commuteHome);
  if (rule?.arrivalTime) {
    const manual = at(date, rule.arrivalTime, tz);
    if (manual >= departure) arrival = manual;
    else
      warnings.push(
        "The arrival-home time precedes departure. The configured travel duration is used instead; update the arrival time.",
      );
  }
  const outbound = isoAdd(first, -s.commuteTo);
  const meal = {
    start: at(date, s.mealTime, tz),
    end: isoAdd(at(date, s.mealTime, tz), s.mealMinutes),
  };
  const mealHandled =
    s.mealMinutes > 0 &&
    [
      ...anchors,
      { start: outbound, end: first },
      { start: last, end: arrival },
      { start: arrival, end: isoAdd(arrival, s.restMinutes) },
    ].some((block) => block.end > block.start && overlap(meal, block));
  const recoveryMinutes = Math.max(
    s.restMinutes,
    mealHandled ? s.mealMinutes : 0,
  );
  return {
    first,
    last,
    outbound,
    departure,
    arrival,
    restEnd: isoAdd(arrival, recoveryMinutes),
    recoveryMinutes,
    mealHandled,
    anchors,
    warnings,
    rule,
  };
}
