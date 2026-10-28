import {
  type Activity,
  type AppState,
  type Occurrence,
  type Subject,
  palette,
} from "./model";
import {
  addDays,
  at,
  clockTime,
  dayKey,
  daysBetween,
  duration,
  overlap,
  weekday,
  weekStart,
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
    const classes = state.classes.filter(
      (c) =>
        date >= c.startDate &&
        date <= c.endDate &&
        weekday(date) === c.weekday &&
        Math.floor(daysBetween(weekStart(c.startDate), weekStart(date)) / 7) %
          c.interval ===
          0,
    );
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
    if (classes.length) {
      const firstClass = [...classes].sort((a, b) =>
        a.startTime.localeCompare(b.startTime),
      )[0];
      const lastClass = [...classes].sort((a, b) =>
        b.endTime.localeCompare(a.endTime),
      )[0];
      const start = at(date, firstClass.startTime, tz),
        end = at(date, lastClass.endTime, tz);
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
      const home = isoAdd(end, state.settings.commuteHome);
      if (state.settings.commuteHome)
        create(
          "routine",
          date,
          `travel-home:${date}`,
          "Travel home",
          end,
          home,
          "travel",
          "Based on your last class and travel preferences.",
        );
      const meal = {
        start: at(date, state.settings.mealTime, tz),
        end: isoAdd(
          at(date, state.settings.mealTime, tz),
          state.settings.mealMinutes,
        ),
      };
      mealHandled =
        state.settings.mealMinutes > 0 &&
        [
          ...classes.map((c) => ({
            start: at(date, c.startTime, tz),
            end: at(date, c.endTime, tz),
          })),
          { start: isoAdd(start, -state.settings.commuteTo), end: start },
          { start: end, end: home },
          { start: home, end: isoAdd(home, state.settings.restMinutes) },
        ].some(
          (block) =>
            Date.parse(block.end) > Date.parse(block.start) &&
            overlap(meal, block),
        );
      const recoveryMinutes = Math.max(
        state.settings.restMinutes,
        mealHandled ? state.settings.mealMinutes : 0,
      );
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
          : (3 / (1 + examDays / 7)) *
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
      return { subject, score, reason, examDays, workload };
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
      "Add an unfinished topic or an upcoming assessment to give your study plan a purpose.",
    );
  if (shortfall)
    explanations.push(
      `${Math.round(shortfall)} minutes of unfinished study in the last 7 days. Catch-up is spread across this window, within your daily ceiling and remaining workload.`,
    );
  let sequence = 0;
  for (let date = first; date <= last; date = addDays(date, 1)) {
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
      .map((p) => p.examDays)
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
    const startMs = Math.max(Date.parse(window.start), now.getTime()),
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
        const candidates = dailyPriorities.filter(
          (p) =>
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
        if (position + state.settings.breakMinutes * 60000 <= end) {
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
  for (const a of plan.activities) {
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
