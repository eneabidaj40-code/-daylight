import { describe, expect, it } from "vitest";
import {
  emptyState,
  palette,
  type Activity,
  type AppState,
  type Subject,
  stateSchema,
} from "./model";
import {
  archiveWorkoutHistory,
  conflictFor,
  generatePlan,
  occurrences,
  priorities,
  sleepWindow,
  validatePlan,
} from "./schedule";
import { addDays, at, dayKey, duration, overlap, weekday } from "./time";

const date = "2026-11-02",
  tz = "Europe/Tirane",
  now = new Date(at(date, "06:00", tz));
function subject(id = "java"): Subject {
  return {
    id,
    name: id,
    code: "",
    color: "#4b886d",
    credits: 6,
    currentGrade: 70,
    target: 90,
    difficulty: 4,
    priority: 3,
    topics: [
      {
        id: `topic-${id}`,
        name: "Core concepts",
        hours: 40,
        completed: false,
        confidence: 20,
      },
    ],
    assessments: [],
  };
}
function event(
  start: string,
  end: string,
  category: Activity["category"] = "personal",
  id = "fixed",
): Activity {
  return {
    id,
    title: id,
    start: at(date, start, tz),
    end: at(date, end, tz),
    color: palette[category],
    category,
    description: "",
    fixed: true,
    completed: false,
    completedMinutes: 0,
  };
}
function workspace(): AppState {
  const s = emptyState();
  s.subjects = [subject()];
  s.classes = [
    {
      id: "class",
      subjectId: "java",
      weekday: 1,
      startTime: "09:00",
      endTime: "14:00",
      room: "B1",
      professor: "",
      interval: 1,
      startDate: date,
      endDate: addDays(date, 100),
    },
  ];
  s.settings.mealMinutes = 0;
  return s;
}
describe("recurrence and boundaries", () => {
  it("retains workout history when a routine is edited or removed", () => {
    const s = workspace();
    s.workouts = [
      {
        id: "w",
        name: "Run",
        weekday: 1,
        startTime: "08:00",
        duration: 45,
        flexible: true,
        startDate: addDays(date, -7),
        endDate: addDays(date, 30),
        exercises: [],
      },
    ];
    s.completions[`workout:w:${addDays(date, -7)}`] = {
      completed: true,
      completedMinutes: 45,
    };
    const archived = archiveWorkoutHistory(s, "w", now);
    archived.workouts = [];
    const history = occurrences(
      archived,
      addDays(date, -7),
      addDays(date, -7),
    ).filter((a) => a.category === "workout");
    expect(history).toHaveLength(1);
    expect(history[0].completedMinutes).toBe(45);
    expect(history[0].completed).toBe(true);
    expect(archiveWorkoutHistory(archived, "w", now).activities).toHaveLength(
      1,
    );
  });
  it("keeps an empty workspace free of default commitments", () => {
    expect(occurrences(emptyState(), date, date)).toHaveLength(0);
  });
  it("combines meals with post-class recovery when the preferred meal overlaps class", () => {
    const s = workspace();
    s.settings.mealMinutes = 30;
    const events = occurrences(s, date, date),
      recovery = events.find((a) => a.id === `rest:${date}`);
    expect(recovery?.title).toBe("Lunch & recharge");
    expect(recovery?.start).toBe(at(date, "15:00", tz));
    expect(events.some((a) => a.id === `meal:${date}`)).toBe(false);
    for (let i = 0; i < events.length; i++)
      for (let j = i + 1; j < events.length; j++)
        expect(overlap(events[i], events[j])).toBe(false);
  });
  it("does not hide a confirmed conflict behind an ignored routine", () => {
    const s = workspace();
    s.classes = [];
    s.settings.mealMinutes = 30;
    s.activities = [event("12:45", "13:30")];
    expect(
      conflictFor(
        { id: "new", start: at(date, "12:30", tz), end: at(date, "13:00", tz) },
        s,
        [],
        true,
      )?.id,
    ).toBe("fixed");
  });
  it("materializes classes and adjustable commute/rest", () => {
    const s = workspace(),
      events = occurrences(s, date, date);
    expect(events.map((a) => a.title)).toEqual([
      "Travel to university",
      "java",
      "Travel home",
      "Recharge after university",
    ]);
    expect(duration(events[0])).toBe(60);
    expect(events[3].end).toBe(at(date, "16:00", tz));
  });
  it("supports biweekly classes anchored to semester start week", () => {
    const s = workspace();
    s.classes[0].interval = 2;
    expect(
      occurrences(s, addDays(date, 7), addDays(date, 7)).filter(
        (a) => a.source === "class",
      ),
    ).toHaveLength(0);
    expect(
      occurrences(s, addDays(date, 14), addDays(date, 14)).filter(
        (a) => a.source === "class",
      ),
    ).toHaveLength(1);
  });
  it("respects semester boundaries", () => {
    const s = workspace();
    expect(
      occurrences(s, addDays(date, -7), addDays(date, -7)).filter(
        (a) => a.source === "class",
      ),
    ).toHaveLength(0);
  });
  it("allows touching endpoints without overlaps", () => {
    expect(overlap(event("09:00", "10:00"), event("10:00", "11:00"))).toBe(
      false,
    );
    expect(overlap(event("09:00", "10:01"), event("10:00", "11:00"))).toBe(
      true,
    );
  });
  it("materializes completion and skipped workout overrides", () => {
    const s = workspace();
    s.workouts = [
      {
        id: "w",
        name: "Run",
        weekday: weekday(date),
        startTime: "18:00",
        duration: 45,
        flexible: true,
        startDate: date,
        endDate: date,
        exercises: [],
      },
    ];
    s.completions[`workout:w:${date}`] = {
      completed: true,
      completedMinutes: 45,
    };
    expect(
      occurrences(s, date, date).find((a) => a.source === "workout")?.completed,
    ).toBe(true);
    s.completions[`workout:w:${date}`].skipped = true;
    expect(occurrences(s, date, date).some((a) => a.source === "workout")).toBe(
      false,
    );
  });
  it("requires actual minimum sleep over spring daylight saving", () => {
    const s = emptyState();
    const window = sleepWindow(s, "2026-03-28");
    const wake = at("2026-03-29", s.settings.wakeTime, tz);
    expect(
      (Date.parse(wake) - Date.parse(window.end)) / 3600000,
    ).toBeGreaterThanOrEqual(8);
    expect(window.adjusted).toBe(true);
  });
});
describe("deterministic study suggestions", () => {
  it("generates valid persistent records from maximum-length subject and topic names", () => {
    const s = workspace();
    s.subjects[0].name = "S".repeat(200);
    s.subjects[0].topics[0].name = "T".repeat(200);
    const plan = generatePlan(s, date, 1, now);
    s.activities = plan.activities;
    expect(stateSchema.safeParse(s).success).toBe(true);
  });
  it("never overlaps classes, travel, rest, workouts or confirmed study", () => {
    const s = workspace();
    s.activities = [event("17:00", "18:00", "study")];
    s.workouts = [
      {
        id: "w",
        name: "Workout",
        weekday: 1,
        startTime: "19:00",
        duration: 45,
        flexible: true,
        startDate: date,
        endDate: addDays(date, 100),
        exercises: [],
      },
    ];
    const before = structuredClone(s),
      plan = generatePlan(s, date, 7, now),
      blocked = occurrences(s, date, addDays(date, 6));
    expect(plan.activities.length).toBeGreaterThan(0);
    for (const a of plan.activities)
      for (const b of blocked)
        expect(overlap(a, b), `${a.title} overlaps ${b.title}`).toBe(false);
    expect(s).toEqual(before);
    expect(validatePlan(plan, s, now)).toBeNull();
  });
  it("protects sleep and breaks and does not start in the past", () => {
    const s = workspace(),
      later = new Date(at(date, "18:17", tz)),
      plan = generatePlan(s, date, 7, later);
    for (const a of plan.activities) {
      const window = sleepWindow(s, dayKey(a.start, tz));
      expect(a.start >= window.start && a.end <= window.end).toBe(true);
      expect(Date.parse(a.start)).toBeGreaterThanOrEqual(later.getTime());
    }
    for (let i = 0; i < plan.activities.length; i++)
      for (let j = i + 1; j < plan.activities.length; j++)
        expect(overlap(plan.activities[i], plan.activities[j])).toBe(false);
  });
  it("increases recommended study approaching exams without exceeding the ceiling", () => {
    const s = workspace();
    s.classes = [];
    s.exams = [
      {
        id: "e",
        subjectId: "java",
        name: "Exam",
        date: addDays(date, 2),
        time: "09:00",
        duration: 60,
        weight: 60,
        difficulty: 4,
        preparation: 0,
        completed: false,
      },
    ];
    const urgent = generatePlan(s, date, 1, now);
    s.exams[0].date = addDays(date, 60);
    const normal = generatePlan(s, date, 1, now);
    expect(urgent.days[0].recommended).toBeGreaterThan(
      normal.days[0].recommended,
    );
    expect(urgent.days[0].recommended).toBeLessThanOrEqual(
      s.settings.maxDailyHours * 60,
    );
  });
  it("removes passed exams from priority scoring", () => {
    const s = workspace();
    s.subjects[0].topics = [];
    s.exams = [
      {
        id: "e",
        subjectId: "java",
        name: "Exam",
        date,
        time: "05:00",
        duration: 60,
        weight: 80,
        difficulty: 5,
        preparation: 0,
        completed: false,
      },
    ];
    expect(priorities(s, now)).toHaveLength(0);
  });
  it("prioritizes closer assessments when other factors match", () => {
    const s = workspace();
    s.subjects.push(subject("math"));
    s.exams = s.subjects.map((sub, i) => ({
      id: `exam${i}`,
      subjectId: sub.id,
      name: "Exam",
      date: addDays(date, i ? 24 : 3),
      time: "09:00",
      duration: 60,
      weight: 40,
      difficulty: 3,
      preparation: 20,
      completed: false,
    }));
    expect(priorities(s, now)[0].subject.id).toBe("java");
  });
  it("accounts for partial missed study without silently changing old events", () => {
    const s = workspace(),
      a = event("16:00", "18:00", "study");
    a.start = at(addDays(date, -1), "16:00", tz);
    a.end = at(addDays(date, -1), "18:00", tz);
    a.completedMinutes = 60;
    s.activities = [a];
    const plan = generatePlan(s, date, 3, now);
    expect(plan.shortfall).toBe(60);
    expect(s.activities[0].completedMinutes).toBe(60);
    expect(plan.explanations.some((x) => x.includes("Catch-up"))).toBe(true);
  });
  it("explains insufficient time without removing commitments", () => {
    const s = workspace();
    s.classes = [];
    s.activities = [event("07:00", "23:00")];
    const plan = generatePlan(s, date, 1, now);
    expect(plan.activities).toHaveLength(0);
    expect(plan.explanations.some((x) => x.includes("fit."))).toBe(true);
    expect(s.activities).toHaveLength(1);
  });
  it("does not over-plan completed topics or remaining estimated workload", () => {
    const s = workspace();
    s.classes = [];
    s.subjects[0].topics[0].hours = 1;
    const plan = generatePlan(s, date, 7, now);
    expect(
      plan.activities
        .filter((a) => a.category === "study")
        .reduce((n, a) => n + duration(a), 0),
    ).toBeLessThanOrEqual(60);
    s.subjects[0].topics[0].completed = true;
    expect(generatePlan(s, date, 7, now).activities).toHaveLength(0);
  });
  it("gives identical allocations for identical input", () => {
    const s = workspace();
    expect(generatePlan(s, date, 7, now).activities).toEqual(
      generatePlan(s, date, 7, now).activities,
    );
  });
  it("revalidates conflicts introduced after generation", () => {
    const s = workspace(),
      plan = generatePlan(s, date, 1, now);
    const a = plan.activities[0];
    s.activities.push({ ...a, id: "new-confirmed" });
    expect(validatePlan(plan, s, now)).toContain("overlaps");
  });
  it("rejects overlapping edits, sleep violations and stale sessions", () => {
    const s = workspace(),
      plan = generatePlan(s, date, 1, now);
    plan.activities.push({ ...plan.activities[0], id: "duplicate" });
    expect(validatePlan(plan, s, now)).toContain("overlap");
    plan.activities = [
      {
        ...plan.activities[0],
        start: at(date, "03:00", tz),
        end: at(date, "04:00", tz),
      },
    ];
    expect(validatePlan(plan, s, new Date(at(date, "01:00", tz)))).toContain(
      "waking",
    );
    expect(validatePlan(plan, s, now)).toContain("already started");
  });
  it("rejects modifications beyond the daily study ceiling", () => {
    const s = workspace();
    s.classes = [];
    s.settings.maxDailyHours = 3.5;
    const plan = generatePlan(s, date, 1, now);
    plan.activities = [
      {
        ...plan.activities[0],
        start: at(date, "07:00", tz),
        end: at(date, "14:00", tz),
      },
    ];
    expect(validatePlan(plan, s, now)).toContain("ceiling");
  });
  it("supports collision lookup across midnight", () => {
    const s = workspace();
    s.classes = [];
    s.activities = [
      { ...event("22:00", "23:00"), end: at(addDays(date, 1), "01:00", tz) },
    ];
    expect(
      conflictFor(
        {
          id: "new",
          start: at(addDays(date, 1), "00:30", tz),
          end: at(addDays(date, 1), "02:00", tz),
        },
        s,
      )?.id,
    ).toBe("fixed");
  });
  it("returns safe empty plans with no subjects", () => {
    const plan = generatePlan(emptyState(), date, 7, now);
    expect(plan.activities).toEqual([]);
    expect(plan.explanations[0]).toContain("unfinished topic");
  });
});
