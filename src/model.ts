import { z } from "zod";

const id = z.string().min(1).max(200);
const name = z.string().trim().min(1).max(200);
const date = z
  .string()
  .regex(/^\d{4}-\d{2}-\d{2}$/)
  .refine(
    (v) =>
      !isNaN(Date.parse(v)) && new Date(v).toISOString().slice(0, 10) === v,
    "Invalid date",
  );
const time = z.string().regex(/^([01]\d|2[0-3]):[0-5]\d$/);
const iso = z
  .string()
  .datetime({ offset: true })
  .transform((v) => new Date(v).toISOString());
const percent = z.number().min(0).max(100);
const positive = z.number().positive().max(100000);
const color = z.string().regex(/^#[0-9a-fA-F]{6}$/);
export const categories = [
  "university",
  "study",
  "workout",
  "travel",
  "break",
  "exam",
  "personal",
] as const;
export const palette: Record<Category, string> = {
  university: "#7689b8",
  study: "#4b886d",
  workout: "#bc8d58",
  travel: "#86959f",
  break: "#9a9e6b",
  exam: "#bd737b",
  personal: "#9c87b0",
};
export const labels: Record<Category, string> = {
  university: "University",
  study: "Studying",
  workout: "Workout",
  travel: "Travel",
  break: "Break & rest",
  exam: "Exam",
  personal: "Personal",
};
export type Category = (typeof categories)[number];
export const topicSchema = z.object({
  id,
  name,
  hours: z.number().min(0.25).max(1000),
  completed: z.boolean(),
  confidence: percent,
  deadline: date.optional(),
});
export const assessmentSchema = z
  .object({
    id,
    name,
    weight: percent,
    maxScore: positive,
    score: z.number().min(0),
    date: date.optional(),
    completed: z.boolean(),
  })
  .refine((v) => v.score <= v.maxScore, "Score cannot exceed maximum");
export const subjectSchema = z.object({
  id,
  name,
  code: z.string().max(80),
  color,
  credits: positive,
  currentGrade: percent,
  target: percent,
  difficulty: z.number().int().min(1).max(5),
  priority: z.number().int().min(1).max(5),
  topics: z.array(topicSchema).max(5000),
  assessments: z.array(assessmentSchema).max(5000),
});
export const activitySchema = z
  .object({
    id,
    title: name,
    start: iso,
    end: iso,
    category: z.enum(categories),
    description: z.string().max(5000),
    color,
    fixed: z.boolean(),
    completed: z.boolean(),
    completedMinutes: z.number().min(0).max(100000),
    subjectId: id.optional(),
    requiresUniversityTrip: z.boolean().optional(),
  })
  .refine(
    (v) => Date.parse(v.end) > Date.parse(v.start),
    "End must follow start",
  )
  .refine(
    (v) => (Date.parse(v.end) - Date.parse(v.start)) / 60000 <= 1440,
    "Activities must be at most 24 hours",
  )
  .refine(
    (v) =>
      v.completedMinutes <=
      (Date.parse(v.end) - Date.parse(v.start)) / 60000 + 0.01,
    "Completed time exceeds duration",
  );
export const classSchema = z
  .object({
    id,
    subjectId: id,
    weekday: z.number().int().min(1).max(7),
    startTime: time,
    endTime: time,
    room: z.string().max(200),
    professor: z.string().max(200),
    interval: z.number().int().min(1).max(4),
    startDate: date,
    endDate: date,
  })
  .refine((v) => v.endTime > v.startTime, "Class end must follow start")
  .refine((v) => v.endDate >= v.startDate, "Semester end must follow start");
export const examSchema = z.object({
  id,
  subjectId: id,
  componentId: id.optional(),
  name,
  date,
  time,
  duration: z.number().int().min(1).max(720),
  weight: percent,
  difficulty: z.number().int().min(1).max(5),
  preparation: percent,
  completed: z.boolean(),
  requiresUniversityTrip: z.boolean().optional(),
});
export const exerciseSchema = z.object({
  id,
  name,
  sets: z.number().int().min(1).max(100),
  reps: z.string().min(1).max(100),
});
export const workoutSchema = z
  .object({
    id,
    name,
    weekday: z.number().int().min(1).max(7),
    startTime: time,
    duration: z.number().int().min(5).max(480),
    flexible: z.boolean(),
    startDate: date,
    endDate: date,
    exercises: z.array(exerciseSchema).max(500),
  })
  .refine((v) => v.endDate >= v.startDate, "Routine end must follow start")
  .refine(
    (v) =>
      Number(v.startTime.slice(0, 2)) * 60 +
        Number(v.startTime.slice(3)) +
        v.duration <=
      1440,
    "Workout must finish before midnight",
  );
export const settingsSchema = z
  .object({
    name: z.string().max(100),
    theme: z.enum(["light", "dark", "system"]),
    timezone: z.string().refine((v) => {
      try {
        new Intl.DateTimeFormat("en", { timeZone: v }).format();
        return true;
      } catch {
        return false;
      }
    }, "Unknown IANA timezone"),
    wakeTime: time,
    bedTime: time,
    minSleep: z.number().min(4).max(12),
    commuteTo: z.number().int().min(0).max(240),
    commuteHome: z.number().int().min(0).max(240),
    suspendClassesDuringExamPeriods: z.boolean().default(true),
    restMinutes: z.number().int().min(0).max(240),
    mealTime: time,
    mealMinutes: z.number().int().min(0).max(180),
    dailyHours: z.number().min(0.5).max(12),
    maxDailyHours: z.number().min(0.5).max(12),
    focusMinutes: z.number().int().min(15).max(180),
    breakMinutes: z.number().int().min(5).max(60),
    weights: z.object({
      urgency: z.number().min(0).max(5),
      difficulty: z.number().min(0).max(5),
      gradeGap: z.number().min(0).max(5),
      assessment: z.number().min(0).max(5),
      workload: z.number().min(0).max(5),
    }),
    gradeScale: z
      .array(
        z.object({
          letter: name,
          min: percent,
          points: z.number().min(0).max(10),
        }),
      )
      .min(1)
      .max(30),
    reminders: z.boolean(),
    reminderMinutes: z.number().int().min(0).max(120),
  })
  .refine(
    (v) => v.wakeTime < v.bedTime,
    "Bedtime must be later than wake-up time for day-based planning",
  )
  .refine(
    (v) => v.maxDailyHours >= v.dailyHours,
    "Daily ceiling must be at least the normal study target",
  )
  .refine(
    (v) =>
      v.gradeScale.some((g) => g.min === 0) &&
      new Set(v.gradeScale.map((g) => g.min)).size === v.gradeScale.length,
    "Grade boundaries must be unique and include 0",
  );
export const examPeriodSchema = z
  .object({
    id,
    name,
    startDate: date,
    endDate: date,
    suspendClasses: z.boolean().default(true),
  })
  .refine(
    (p) => p.endDate >= p.startDate,
    "Exam period end must follow its start",
  );
export const commuteRuleSchema = z
  .object({
    id,
    weekday: z.number().int().min(1).max(7).optional(),
    date: date.optional(),
    mode: z.enum(["after-class", "departure"]),
    departureTime: time.optional(),
    waitingMinutes: z.number().int().min(0).max(360),
    durationMinutes: z.number().int().min(0).max(480),
    arrivalTime: time.optional(),
  })
  .refine(
    (r) => (r.weekday !== undefined) !== (r.date !== undefined),
    "Choose either a weekday or a date override",
  )
  .refine(
    (r) => r.mode !== "departure" || !!r.departureTime,
    "Enter the bus departure time",
  )
  .refine(
    (r) =>
      !r.arrivalTime ||
      r.mode !== "departure" ||
      r.arrivalTime >= r.departureTime!,
    "Arrival cannot precede departure",
  );

export const stateSchema = z
  .object({
    version: z.union([z.literal(1), z.literal(2)]),
    example: z.boolean(),
    settings: settingsSchema,
    subjects: z.array(subjectSchema).max(1000),
    activities: z.array(activitySchema).max(100000),
    classes: z.array(classSchema).max(5000),
    exams: z.array(examSchema).max(10000),
    workouts: z.array(workoutSchema).max(1000),
    completions: z.record(
      z.string(),
      z.object({
        completed: z.boolean(),
        completedMinutes: z.number().min(0).max(1440),
        skipped: z.boolean().optional(),
        movedTo: id.optional(),
      }),
    ),
    previousSemesters: z
      .array(
        z.object({
          id,
          name,
          credits: positive,
          gpa: z.number().min(0).max(10),
        }),
      )
      .max(100),
    rejectedDays: z.array(date).max(10000),
    examPeriods: z.array(examPeriodSchema).max(1000).default([]),
    commuteRules: z.array(commuteRuleSchema).max(5000).default([]),
    acceptedSuggestionIds: z.array(id).max(100000).default([]),
  })
  .superRefine((s, ctx) => {
    const ids = new Set<string>();
    for (const row of [
      ...s.subjects,
      ...s.activities,
      ...s.classes,
      ...s.exams,
      ...s.workouts,
      ...s.previousSemesters,
      ...s.examPeriods,
      ...s.commuteRules,
      ...s.subjects.flatMap((x) => [...x.topics, ...x.assessments]),
      ...s.workouts.flatMap((x) => x.exercises),
    ]) {
      if (ids.has(row.id))
        ctx.addIssue({ code: "custom", message: "Duplicate record IDs" });
      ids.add(row.id);
    }
    const subjects = new Set(s.subjects.map((x) => x.id));
    for (const row of [...s.activities, ...s.classes, ...s.exams]) {
      if (row.subjectId && !subjects.has(row.subjectId))
        ctx.addIssue({
          code: "custom",
          message: "A linked subject is missing",
        });
    }
    for (const exam of s.exams)
      if (
        exam.componentId &&
        !s.subjects
          .find((x) => x.id === exam.subjectId)
          ?.assessments.some((a) => a.id === exam.componentId)
      )
        ctx.addIssue({
          code: "custom",
          message: "An exam links to a missing assessment",
        });
    const ruleKeys = s.commuteRules.map((r) =>
      r.date ? `date:${r.date}` : `weekday:${r.weekday}`,
    );
    if (new Set(ruleKeys).size !== ruleKeys.length)
      ctx.addIssue({
        code: "custom",
        message: "Only one commuting rule is allowed per weekday or date",
      });
    if (
      new Set(s.acceptedSuggestionIds).size !== s.acceptedSuggestionIds.length
    )
      ctx.addIssue({
        code: "custom",
        message: "Duplicate proposal acceptance receipts",
      });
  })
  .transform((s) => ({ ...s, version: 2 as const }));
export type Subject = z.infer<typeof subjectSchema>;
export type Topic = z.infer<typeof topicSchema>;
export type Assessment = z.infer<typeof assessmentSchema>;
export type Activity = z.infer<typeof activitySchema>;
export type ClassEntry = z.infer<typeof classSchema>;
export type Exam = z.infer<typeof examSchema>;
export type Workout = z.infer<typeof workoutSchema>;
export type Settings = z.infer<typeof settingsSchema>;
export type ExamPeriod = z.infer<typeof examPeriodSchema>;
export type CommuteRule = z.infer<typeof commuteRuleSchema>;
export type AppState = z.infer<typeof stateSchema>;
export type Occurrence = Activity & {
  source: "activity" | "class" | "exam" | "workout" | "routine";
  sourceId: string;
};
export const uid = () => crypto.randomUUID();
export function emptyState(): AppState {
  return {
    version: 2,
    example: false,
    subjects: [],
    activities: [],
    classes: [],
    exams: [],
    workouts: [],
    completions: {},
    previousSemesters: [],
    rejectedDays: [],
    examPeriods: [],
    commuteRules: [],
    acceptedSuggestionIds: [],
    settings: {
      name: "",
      theme: "light",
      timezone: "Europe/Tirane",
      wakeTime: "07:00",
      bedTime: "23:00",
      minSleep: 8,
      commuteTo: 60,
      commuteHome: 60,
      suspendClassesDuringExamPeriods: true,
      restMinutes: 60,
      mealTime: "12:30",
      mealMinutes: 0,
      dailyHours: 3.5,
      maxDailyHours: 6,
      focusMinutes: 50,
      breakMinutes: 10,
      weights: {
        urgency: 2,
        difficulty: 1,
        gradeGap: 1,
        assessment: 1,
        workload: 1,
      },
      reminders: false,
      reminderMinutes: 15,
      gradeScale: [
        { letter: "AA", min: 90, points: 4 },
        { letter: "BA", min: 85, points: 3.5 },
        { letter: "BB", min: 80, points: 3 },
        { letter: "CB", min: 75, points: 2.5 },
        { letter: "CC", min: 70, points: 2 },
        { letter: "DC", min: 65, points: 1.5 },
        { letter: "DD", min: 60, points: 1 },
        { letter: "FD", min: 50, points: 0.5 },
        { letter: "FF", min: 0, points: 0 },
      ],
    },
  };
}
