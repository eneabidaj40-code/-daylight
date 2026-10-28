import {
  type Activity,
  type AppState,
  type Occurrence,
  type Subject,
  palette,
  activitySchema,
} from "./model";
import {
  activeExamPeriods,
  campusTrip,
  classesSuspended,
  recurringClasses,
} from "./academic";
import {
  addDays,
  at,
  clockTime,
  dayKey,
  daysBetween,
  duration,
  overlap,
  weekday,
} from "./time";
import { calculateGrade } from "./grades";

const isoAdd = (value: string, m: number) =>
  new Date(Date.parse(value) + m * 60000).toISOString();
export function occurrences(
  state: AppState,
  first: string,
  last: string,
): Occurrence[] {
  const tz = state.settings.timezone;
  const rangeStart = at(first, "00:00", tz),
    rangeEnd = at(addDays(last, 1), "00:00", tz);
  const result: Occurrence[] = state.activities
    .filter((a) => a.start < rangeEnd && a.end > rangeStart)
    .map((a) => ({ ...a, source: "activity", sourceId: a.id }));
  const create = (
    source: Occurrence["source"],
    sourceId: string,
    id: string,
    title: string,
    start: string,
    end: string,
    category: Occurrence["category"],
    description = "",
    subjectId?: string,
    fixed = true,
    color = palette[category],
  ) => {
    const completion = state.completions[id];
    if (completion?.skipped) return;
    result.push({
      id,
      source,
      sourceId,
      title,
      start,
      end,
      category,
      description,
      color,
      fixed,
      subjectId,
      completed: completion?.completed ?? false,
      completedMinutes: Math.min(
        completion?.completedMinutes ?? 0,
        Math.max(0, (Date.parse(end) - Date.parse(start)) / 60000),
      ),
    });
  };
  for (let date = first; date <= last; date = addDays(date, 1)) {
    let mealHandled = false;
    const classes = recurringClasses(state, date);
    for (const c of classes) {
      const subject = state.subjects.find((s) => s.id === c.subjectId);
      create(
        "class",
        c.id,
        `class:${c.id}:${date}`,
        subject?.name ?? "University",
        at(date, c.startTime, tz),
        at(date, c.endTime, tz),
        "university",
        [c.room && `Room ${c.room}`, c.professor].filter(Boolean).join(" · "),
        c.subjectId,
        true,
        subject?.color,
      );
    }
    const trip = campusTrip(state, date);
    if (trip) {
      const start = trip.first,
        end = trip.last;
      if (state.settings.commuteTo)
        create(
          "routine",
          date,
          `travel-to:${date}`,
          "Travel to university",
          isoAdd(start, -state.settings.commuteTo),
          start,
          "travel",
          "Based on your first class and travel preferences.",
        );
      const home = trip.arrival;
      if (trip.departure > end)
        create(
          "routine",
          date,
          `travel-wait:${date}`,
          "Wait for the bus",
          end,
          trip.departure,
          "travel",
          "Waiting after your final campus commitment.",
        );
      if (home > trip.departure)
        create(
          "routine",
          date,
          `travel-home:${date}`,
          "Travel home",
          trip.departure,
          home,
          "travel",
          [
            "Based on your final campus commitment and return commute rule.",
            ...trip.warnings,
          ].join(" "),
        );
      mealHandled = trip.mealHandled;
      const recoveryMinutes = trip.recoveryMinutes;
      if (recoveryMinutes)
        create(
          "routine",
          date,
          `rest:${date}`,
          mealHandled ? "Lunch & recharge" : "Recharge after university",
          home,
          isoAdd(home, recoveryMinutes),
          "break",
          mealHandled
            ? "Your meal is combined with recovery after university because its preferred time overlaps class, travel, or rest."
            : "Protected rest time from your preferences.",
        );
    }
    for (const w of state.workouts.filter(
      (w) =>
        w.weekday === weekday(date) && date >= w.startDate && date <= w.endDate,
    )) {
      const start = at(date, w.startTime, tz);
      create(
        "workout",
        w.id,
        `workout:${w.id}:${date}`,
        w.name,
        start,
        isoAdd(start, w.duration),
        "workout",
        w.exercises
          .map((e) => `${e.name} · ${e.sets} × ${e.reps}`)
          .join("\n")
          .slice(0, 5000),
        undefined,
        !w.flexible,
      );
    }
    if (state.settings.mealMinutes && !mealHandled) {
      const start = at(date, state.settings.mealTime, tz),
        end = isoAdd(start, state.settings.mealMinutes);
      create(
        "routine",
        date,
        `meal:${date}`,
        "Meal break",
        start,
        end,
        "break",
        "Daily meal from your preferences. Adjust its time in Settings.",
      );
    }
  }
  for (const e of state.exams.filter(
    (e) => e.date >= first && e.date <= last,
  )) {
    const subject = state.subjects.find((s) => s.id === e.subjectId),
      start = at(e.date, e.time, tz);
    create(
      "exam",
      e.id,
      `exam:${e.id}`,
      e.name,
      start,
      isoAdd(start, e.duration),
      "exam",
      subject?.name ?? "",
      e.subjectId,
    );
    const occurrence = result.find((a) => a.id === `exam:${e.id}`);
    if (occurrence) occurrence.completed = e.completed;
  }
  return result.sort((a, b) => a.start.localeCompare(b.start));
}

export function conflictFor(
  activity: Pick<Activity, "id" | "start" | "end">,
  state: AppState,
  ignoreIds: string[] = [],
  ignoreRoutines = false,
) {
  const first = addDays(dayKey(activity.start, state.settings.timezone), -1),
    last = dayKey(activity.end, state.settings.timezone);
  return occurrences(state, first, last).find(
    (a) =>
      a.id !== activity.id &&
      !ignoreIds.includes(a.id) &&
      (!ignoreRoutines || a.source !== "routine") &&
      overlap(a, activity),
  );
}
export function sleepWindow(state: AppState, date: string) {
  const s = state.settings;
  const start = at(date, s.wakeTime, s.timezone),
    preferredEnd = at(date, s.bedTime, s.timezone);
  // Actual elapsed hours matter on daylight-saving transitions, too.
  const nextWake = at(addDays(date, 1), s.wakeTime, s.timezone);
  const sleepStart = isoAdd(nextWake, -s.minSleep * 60);
  const end = new Date(
    Math.min(Date.parse(preferredEnd), Date.parse(sleepStart)),
  ).toISOString();
  return { start, end, adjusted: end < preferredEnd };
}
export type Priority = {
  subject: Subject;
  score: number;
  reason: string;
  examDays: number | null;
  examAt: string | null;
  examHours: number | null;
  workload: number;
};
export function priorities(state: AppState, now: Date): Priority[] {
  const today = dayKey(now, state.settings.timezone),
    weights = state.settings.weights;
  return state.subjects
    .map((subject) => {
      const exams = state.exams
        .filter(
          (e) =>
            e.subjectId === subject.id &&
            !e.completed &&
            Date.parse(at(e.date, e.time, state.settings.timezone)) >
              now.getTime(),
        )
        .sort((a, b) =>
          `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`),
        );
      const exam = exams[0],
        examDays = exam ? Math.max(0, daysBetween(today, exam.date)) : null;
      const examAt = exam
        ? at(exam.date, exam.time, state.settings.timezone)
        : null;
      const examHours = examAt
        ? (Date.parse(examAt) - now.getTime()) / 3600000
        : null;
      const topics = subject.topics.filter((t) => !t.completed);
      const workload = topics.reduce((n, t) => n + t.hours * 60, 0);
      const grade = calculateGrade(subject.assessments, subject.target);
      const gap =
        Math.max(
          0,
          subject.target - (grade.completedAverage ?? subject.currentGrade),
        ) / 100;
      const urgency =
        examDays === null
          ? 0
          : (3 / (1 + (examHours ?? 0) / 168)) *
            (1 - ((exam?.preparation ?? 0) / 100) * 0.8);
      const dueTopic = topics.some(
        (t) => t.deadline && daysBetween(today, t.deadline) <= 7,
      )
        ? 0.7
        : 0;
      const score = Math.max(
        0.01,
        ((0.3 +
          weights.urgency * (urgency + dueTopic) +
          weights.difficulty *
            ((subject.difficulty + (exam?.difficulty ?? subject.difficulty)) /
              10) +
          weights.gradeGap * gap +
          (weights.assessment * (exam?.weight ?? 0)) / 100 +
          weights.workload * Math.min(2, workload / 600)) *
          subject.priority) /
          3,
      );
      const reason = [
        exam
          ? `${exam.name} ${examDays === 0 ? "today" : `in ${examDays} days`} (${exam.weight}% weight, ${exam.preparation}% prepared)`
          : "No upcoming assessment",
        `${topics.length} topics · ${Math.round((workload / 60) * 10) / 10}h remaining`,
        `difficulty ${subject.difficulty}/5`,
        gap > 0
          ? `${Math.round(gap * 100)} points to target pace`
          : "at target pace",
      ].join(" · ");
      return { subject, score, reason, examDays, examAt, examHours, workload };
    })
    .filter((p) => p.workload > 0 || p.examDays !== null)
    .sort((a, b) => b.score - a.score);
}
export type Suggestion = {
  id: string;
  activities: Activity[];
  priorities: Priority[];
  explanations: string[];
  days: {
    date: string;
    recommended: number;
    scheduled: number;
    existing: number;
    available: number;
  }[];
  shortfall: number;
  generatedAt: string;
};
export function generatePlan(
  state: AppState,
  first: string,
  dayCount: number,
  now = new Date(),
): Suggestion {
  if (!Number.isFinite(now.getTime()))
    throw new Error("The current time is invalid.");
  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(first) ||
    !Number.isFinite(Date.parse(first)) ||
    new Date(first).toISOString().slice(0, 10) !== first
  )
    throw new Error("Choose a valid planning start date.");
  if (!Number.isInteger(dayCount) || dayCount < 1 || dayCount > 31)
    throw new Error("Choose a planning window between 1 and 31 days.");
  if (first < dayKey(now, state.settings.timezone))
    throw new Error("Choose today or a future planning date.");
  const tz = state.settings.timezone,
    today = dayKey(now, tz),
    last = addDays(first, dayCount - 1);
  const occupied = occurrences(state, addDays(first, -1), addDays(last, 1));
  const previous = occurrences(
    state,
    addDays(today, -7),
    addDays(today, -1),
  ).filter((a) => a.category === "study" && Date.parse(a.end) < now.getTime());
  const shortfall = previous.reduce(
    (n, a) =>
      n +
      Math.max(
        0,
        duration(a) - (a.completed ? duration(a) : a.completedMinutes),
      ),
    0,
  );
  const activities: Activity[] = [],
    explanations: string[] = [],
    days: Suggestion["days"] = [];
  const priority = priorities(state, now);
  const allocated: Record<string, number> = {};
  const topicBudget = Object.fromEntries(
    priority.map((p) => [
      p.subject.id,
      p.workload > 0
        ? p.workload
        : Math.max(
            60,
            360 *
              (1 -
                (state.exams.find(
                  (e) =>
                    e.subjectId === p.subject.id &&
                    !e.completed &&
                    Date.parse(at(e.date, e.time, tz)) > now.getTime(),
                )?.preparation ?? 0) /
                  100),
          ),
    ]),
  );
  // Confirmed future study counts toward the remaining workload; it is never replaced.
  for (const a of occupied.filter(
    (a) =>
      a.category === "study" &&
      a.subjectId &&
      Date.parse(a.end) > now.getTime(),
  ))
    allocated[a.subjectId!] = (allocated[a.subjectId!] ?? 0) + duration(a);
  if (!priority.length)
    explanations.push(
      !state.subjects.length
        ? "No subjects are configured. Add a subject with unfinished topics or a future exam, including its date and time."
        : "No unfinished topics or future exams are available. Add topic workload or an upcoming exam with its exact date and time; completed topics and past exams cannot generate study.",
    );
  if (shortfall)
    explanations.push(
      `${Math.round(shortfall)} minutes of unfinished study in the last 7 days. Catch-up is spread across this window, within your daily ceiling and remaining workload.`,
    );
  let sequence = 0;
  for (let date = first; date <= last; date = addDays(date, 1)) {
    if (classesSuspended(state, date))
      explanations.push(
        `${date}: ${activeExamPeriods(state, date)
          .filter((p) => p.suspendClasses)
          .map((p) => p.name)
          .join(
            ", ",
          )} suspends recurring classes. Released time is available for study; actual exams and independent commitments remain protected.`,
      );
    explanations.push(
      ...(campusTrip(state, date)?.warnings.map((w) => `${date}: ${w}`) ?? []),
    );
    const window = sleepWindow(state, date);
    if (window.adjusted && !explanations.some((x) => x.includes("bedtime")))
      explanations.push(
        "Your study window ends earlier than your preferred bedtime to protect your minimum sleep.",
      );
    const dailyPriorities = priorities(
      state,
      new Date(Math.max(now.getTime(), Date.parse(at(date, "00:00", tz)))),
    );
    const eligible = dailyPriorities.filter(
      (p) => (allocated[p.subject.id] ?? 0) < (topicBudget[p.subject.id] ?? 0),
    );
    const nearest = eligible
      .map((p) => (p.examHours === null ? null : p.examHours / 24))
      .filter((d): d is number => d !== null);
    const examBoost = nearest.length
      ? Math.max(0, (14 - Math.min(...nearest)) / 14) * 120
      : 0;
    const workloadPace = eligible.reduce(
      (n, p) =>
        n +
        Math.max(
          0,
          (topicBudget[p.subject.id] ?? 0) - (allocated[p.subject.id] ?? 0),
        ) /
          Math.max(1, p.examDays ?? 14),
      0,
    );
    const recommended = eligible.length
      ? Math.min(
          state.settings.maxDailyHours * 60,
          Math.max(
            state.settings.dailyHours * 60 +
              examBoost +
              Math.min(60, shortfall / dayCount),
            workloadPace,
          ),
        )
      : 0;
    const existing = occupied
      .filter((a) => dayKey(a.start, tz) === date && a.category === "study")
      .reduce((n, a) => n + duration(a), 0);
    const startMs = Math.max(Date.parse(window.start), now.getTime() + 60000),
      endMs = Date.parse(window.end);
    const blocks = occupied
      .filter((a) => Date.parse(a.start) < endMs && Date.parse(a.end) > startMs)
      .sort((a, b) => a.start.localeCompare(b.start));
    const free: [number, number][] = [];
    let cursor = Math.ceil(startMs / 300000) * 300000;
    for (const block of blocks) {
      const start = Date.parse(block.start),
        end = Date.parse(block.end);
      if (start > cursor) free.push([cursor, Math.min(start, endMs)]);
      cursor = Math.max(cursor, end);
    }
    if (cursor < endMs) free.push([cursor, endMs]);
    const available = free.reduce(
      (n, [s, e]) => n + Math.max(0, (e - s) / 60000),
      0,
    );
    let scheduled = 0;
    for (const [start, end] of free) {
      let position = start;
      while (
        position + 15 * 60000 <= end &&
        scheduled + existing + 15 <= recommended
      ) {
        const candidates = priorities(state, new Date(position)).filter(
          (p) =>
            (p.workload > 0 ||
              (p.examAt !== null &&
                position + 15 * 60000 <= Date.parse(p.examAt))) &&
            (allocated[p.subject.id] ?? 0) + 15 <=
              (topicBudget[p.subject.id] ?? 0),
        );
        candidates.sort(
          (a, b) =>
            b.score / (1 + (allocated[b.subject.id] ?? 0) / 60) -
            a.score / (1 + (allocated[a.subject.id] ?? 0) / 60),
        );
        const p = candidates[0];
        if (!p) break;
        const length =
          Math.floor(
            Math.min(
              state.settings.focusMinutes,
              (end - position) / 60000,
              recommended - existing - scheduled,
              (topicBudget[p.subject.id] ?? 0) - (allocated[p.subject.id] ?? 0),
              p.workload === 0 && p.examAt
                ? (Date.parse(p.examAt) - position) / 60000
                : Infinity,
            ) / 5,
          ) * 5;
        if (length < 15) break;
        const topic = p.subject.topics
          .filter((t) => !t.completed)
          .sort(
            (a, b) =>
              (a.deadline ?? "9999").localeCompare(b.deadline ?? "9999") ||
              a.confidence - b.confidence,
          )[0];
        activities.push({
          id: `suggestion-${++sequence}`,
          title:
            `${p.subject.name}${topic ? ` · ${topic.name}` : " · exam preparation"}`.slice(
              0,
              200,
            ),
          start: new Date(position).toISOString(),
          end: new Date(position + length * 60000).toISOString(),
          category: "study",
          color: p.subject.color,
          subjectId: p.subject.id,
          description: `Suggested study session. ${p.reason}. Topic completion and confidence are updated manually.`,
          fixed: false,
          completed: false,
          completedMinutes: 0,
        });
        position += length * 60000;
        scheduled += length;
        allocated[p.subject.id] = (allocated[p.subject.id] ?? 0) + length;
        if (
          state.settings.breakMinutes > 0 &&
          position + state.settings.breakMinutes * 60000 <= end
        ) {
          activities.push({
            id: `suggestion-${++sequence}`,
            title: "Take a breather",
            start: new Date(position).toISOString(),
            end: new Date(
              position + state.settings.breakMinutes * 60000,
            ).toISOString(),
            category: "break",
            color: palette.break,
            description: "A protected break between focus sessions.",
            fixed: false,
            completed: false,
            completedMinutes: 0,
          });
        }
        position += state.settings.breakMinutes * 60000;
      }
    }
    days.push({ date, recommended, scheduled, existing, available });
    if (!scheduled && priority.length) {
      const commitments = blocks.map(
        (a) => `${a.title} (${clockTime(a.start, tz)}–${clockTime(a.end, tz)})`,
      );
      if (existing >= state.settings.maxDailyHours * 60)
        explanations.push(
          `${date}: the daily study ceiling of ${state.settings.maxDailyHours}h is already filled by ${Math.round(existing)} confirmed minutes.`,
        );
      else if (!eligible.length)
        explanations.push(
          `${date}: existing confirmed study already covers the remaining workload, or the relevant exam has passed.`,
        );
      else if (endMs <= startMs)
        explanations.push(
          `${date}: the protected waking window has ended. Plan a future date.`,
        );
      else if (!available)
        explanations.push(
          `${date}: all available hours are blocked by ${commitments.join(", ") || "protected sleep"}. Sleep ${state.settings.bedTime}–${state.settings.wakeTime} is protected.`,
        );
      else if (existing + 15 > recommended)
        explanations.push(
          `${date}: confirmed study already meets today's recommended target within the daily ceiling of ${state.settings.maxDailyHours}h.`,
        );
      else
        explanations.push(
          `${date}: no eligible 15-minute study slot remains before the exam, within the remaining workload and daily ceiling. Blocking commitments: ${commitments.join(", ") || "none"}.`,
        );
    }
    if (
      scheduled + existing + 15 < recommended &&
      eligible.some(
        (p) =>
          (allocated[p.subject.id] ?? 0) + 15 <=
          (topicBudget[p.subject.id] ?? 0),
      )
    )
      explanations.push(
        `${date}: ${Math.round(scheduled + existing)} of ${Math.round(recommended)} recommended minutes fit. Protect sleep and commitments; split topics, adjust flexible activities yourself, or reduce scope.`,
      );
  }
  explanations.push(
    "Priority combines assessment urgency, assessment weight, difficulty, grade gap, unfinished topics, and your priority setting. Weights are editable in Settings. Study time does not predict a grade.",
  );
  return {
    id: crypto.randomUUID(),
    activities,
    priorities: priority,
    explanations,
    days,
    shortfall,
    generatedAt: now.toISOString(),
  };
}
export function validatePlan(
  plan: Suggestion,
  state: AppState,
  now = new Date(),
): string | null {
  if (new Set(plan.activities.map((a) => a.id)).size !== plan.activities.length)
    return "The proposal contains duplicate sessions. Regenerate it.";
  for (const a of plan.activities) {
    if (!activitySchema.safeParse(a).success)
      return "A suggested session has invalid dates, times, or duration. Correct it before accepting.";
    if (
      Date.parse(a.end) <= Date.parse(a.start) ||
      Date.parse(a.start) < now.getTime()
    )
      return "A suggested session is invalid or has already started. Regenerate your plan.";
    const conflict = conflictFor(a, state);
    if (conflict)
      return `“${a.title}” overlaps “${conflict.title}”. Modify or regenerate the suggestion.`;
    const day = dayKey(a.start, state.settings.timezone),
      window = sleepWindow(state, day);
    if (a.start < window.start || a.end > window.end)
      return "A suggestion falls outside your protected waking hours.";
    if (
      a.category === "study" &&
      (!a.subjectId || !state.subjects.some((s) => s.id === a.subjectId))
    )
      return "A suggested subject no longer exists. Regenerate the plan.";
  }
  for (let i = 0; i < plan.activities.length; i++)
    for (let j = i + 1; j < plan.activities.length; j++)
      if (overlap(plan.activities[i], plan.activities[j]))
        return "Suggested sessions overlap each other. Adjust their times.";
  for (const date of new Set(
    plan.activities.map((a) => dayKey(a.start, state.settings.timezone)),
  )) {
    const study = [
      ...occurrences(state, date, date),
      ...plan.activities.filter(
        (a) => dayKey(a.start, state.settings.timezone) === date,
      ),
    ]
      .filter((a) => a.category === "study")
      .reduce((n, a) => n + duration(a), 0);
    if (study > state.settings.maxDailyHours * 60 + 0.01)
      return `${date} exceeds your daily study ceiling. Shorten or remove a session.`;
  }
  return null;
}
export function calendarWallTime(iso: string, tz: string) {
  return `${dayKey(iso, tz)}T${clockTime(iso, tz)}`;
}

// Routine edits affect future occurrences; past workout records remain inspectable.
export function archiveWorkoutHistory(
  state: AppState,
  workoutId: string,
  now = new Date(),
): AppState {
  const workout = state.workouts.find((w) => w.id === workoutId);
  if (!workout) return state;
  const today = dayKey(now, state.settings.timezone);
  if (workout.startDate > today) return state;
  const past = occurrences(state, workout.startDate, today).filter(
    (a) =>
      a.source === "workout" &&
      a.sourceId === workoutId &&
      Date.parse(a.end) <= now.getTime(),
  );
  const archived: Activity[] = past.map((a) => ({
    id: crypto.randomUUID(),
    title: a.title,
    start: a.start,
    end: a.end,
    category: a.category,
    description: a.description,
    color: a.color,
    fixed: a.fixed,
    completed: a.completed,
    completedMinutes: a.completedMinutes,
  }));
  return {
    ...state,
    activities: [...state.activities, ...archived],
    completions: {
      ...state.completions,
      ...Object.fromEntries(
        past.map((a) => [
          a.id,
          {
            completed: a.completed,
            completedMinutes: a.completedMinutes,
            skipped: true,
          },
        ]),
      ),
    },
  };
}
