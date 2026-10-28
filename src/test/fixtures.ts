import { emptyState, palette, type Activity, type AppState } from "../model";
import { addDays, at } from "../time";
export const date = "2026-11-02",
  tz = "Europe/Tirane",
  now = new Date(at(date, "06:00", tz));
export function fixture(): AppState {
  const s = emptyState();
  s.subjects = [
    {
      id: "java",
      name: "Programming",
      code: "CS",
      color: "#4b886d",
      credits: 6,
      currentGrade: 70,
      target: 90,
      difficulty: 4,
      priority: 3,
      assessments: [
        {
          id: "midterm-grade",
          name: "Midterm",
          weight: 40,
          score: 80,
          maxScore: 100,
          completed: true,
        },
      ],
      topics: [
        {
          id: "core",
          name: "Core concepts",
          hours: 40,
          completed: false,
          confidence: 20,
        },
      ],
    },
  ];
  s.classes = [
    {
      id: "lecture",
      subjectId: "java",
      weekday: 1,
      startTime: "09:00",
      endTime: "14:00",
      room: "B1",
      professor: "Professor",
      interval: 1,
      startDate: date,
      endDate: addDays(date, 60),
    },
  ];
  s.exams = [
    {
      id: "exam",
      subjectId: "java",
      componentId: "midterm-grade",
      name: "Programming midterm",
      date,
      time: "10:00",
      duration: 90,
      weight: 40,
      difficulty: 4,
      preparation: 0,
      completed: false,
    },
  ];
  return s;
}
export function event(
  start = "09:00",
  end = "10:00",
  id = "personal",
  category: Activity["category"] = "personal",
  day = date,
): Activity {
  return {
    id,
    title: id,
    start: at(day, start, tz),
    end: at(day, end, tz),
    category,
    color: palette[category],
    description: "",
    fixed: true,
    completed: false,
    completedMinutes: 0,
  };
}
export const period = {
  id: "midterm",
  name: "Midterm Week",
  startDate: date,
  endDate: addDays(date, 6),
  suspendClasses: true,
};
export function legacyFixture() {
  const raw = JSON.parse(JSON.stringify(fixture()));
  raw.activities = [
    event("18:00", "19:00", "Existing personal event"),
    {
      ...event("16:00", "17:00", "Existing study", "study"),
      subjectId: "java",
      completed: true,
      completedMinutes: 60,
    },
  ];
  raw.workouts = [
    {
      id: "existing-workout",
      name: "Run",
      weekday: 3,
      startTime: "18:00",
      duration: 45,
      flexible: false,
      startDate: date,
      endDate: addDays(date, 30),
      exercises: [
        { id: "existing-exercise", name: "Run", sets: 1, reps: "5 km" },
      ],
    },
  ];
  raw.completions = {
    "workout:existing-workout:2026-11-04": {
      completed: true,
      completedMinutes: 45,
    },
  };
  raw.previousSemesters = [
    { id: "previous", name: "Spring", credits: 30, gpa: 3.4 },
  ];
  raw.rejectedDays = [addDays(date, -1)];
  raw.settings.name = "Migration fixture";
  raw.settings.commuteTo = 45;
  raw.version = 1;
  delete raw.examPeriods;
  delete raw.commuteRules;
  delete raw.acceptedSuggestionIds;
  delete raw.settings.suspendClassesDuringExamPeriods;
  return raw;
}
