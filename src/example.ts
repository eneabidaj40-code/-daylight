import { emptyState, palette, uid, type AppState, type Subject } from "./model";
import { addDays, at, dayKey, weekday } from "./time";

export function exampleState(): AppState {
  const state = emptyState();
  state.example = true;
  state.settings.mealMinutes = 30;
  const today = dayKey(new Date(), state.settings.timezone),
    start = addDays(today, -21),
    end = addDays(today, 100);
  const subjects: Subject[] = [
    {
      id: uid(),
      name: "Object-Oriented Programming",
      code: "CS 201",
      color: "#4b886d",
      credits: 6,
      currentGrade: 86,
      target: 90,
      difficulty: 4,
      priority: 4,
      topics: [
        "Classes & objects",
        "Inheritance",
        "Polymorphism",
        "Interfaces",
      ].map((name, i) => ({
        id: uid(),
        name,
        hours: 3,
        completed: i === 0,
        confidence: i === 0 ? 90 : 35,
        deadline: addDays(today, 8),
      })),
      assessments: [
        {
          id: uid(),
          name: "Weekly exercises",
          weight: 10,
          maxScore: 100,
          score: 90,
          completed: true,
        },
        {
          id: uid(),
          name: "Coursework",
          weight: 10,
          maxScore: 100,
          score: 85,
          completed: true,
        },
        {
          id: uid(),
          name: "Midterm",
          weight: 30,
          maxScore: 100,
          score: 0,
          completed: false,
        },
        {
          id: uid(),
          name: "Project",
          weight: 10,
          maxScore: 100,
          score: 0,
          completed: false,
        },
        {
          id: uid(),
          name: "Final assessment",
          weight: 40,
          maxScore: 100,
          score: 0,
          completed: false,
        },
      ],
    },
    {
      id: uid(),
      name: "Mathematics II",
      code: "MATH 102",
      color: "#7689b8",
      credits: 5,
      currentGrade: 82,
      target: 90,
      difficulty: 5,
      priority: 3,
      topics: [
        "Integration techniques",
        "Series & sequences",
        "Differential equations",
      ].map((name) => ({
        id: uid(),
        name,
        hours: 4,
        completed: false,
        confidence: 45,
      })),
      assessments: [
        {
          id: uid(),
          name: "Problem sets",
          weight: 20,
          maxScore: 50,
          score: 41,
          completed: true,
        },
        {
          id: uid(),
          name: "Written exam",
          weight: 80,
          maxScore: 100,
          score: 0,
          completed: false,
        },
      ],
    },
    {
      id: uid(),
      name: "Data Structures",
      code: "CS 204",
      color: "#b58a62",
      credits: 6,
      currentGrade: 91,
      target: 90,
      difficulty: 3,
      priority: 3,
      topics: ["Trees", "Graphs", "Hash tables"].map((name, i) => ({
        id: uid(),
        name,
        hours: 2,
        completed: i === 0,
        confidence: i === 0 ? 95 : 60,
      })),
      assessments: [
        {
          id: uid(),
          name: "Lab portfolio",
          weight: 40,
          maxScore: 100,
          score: 91,
          completed: true,
        },
        {
          id: uid(),
          name: "Practical exam",
          weight: 60,
          maxScore: 100,
          score: 0,
          completed: false,
        },
      ],
    },
  ];
  state.subjects = subjects;
  state.classes = [
    {
      id: uid(),
      subjectId: subjects[0].id,
      weekday: weekday(today),
      startTime: "09:00",
      endTime: "11:00",
      room: "B-204",
      professor: "Dr. Martin",
      interval: 1,
      startDate: start,
      endDate: end,
    },
    {
      id: uid(),
      subjectId: subjects[1].id,
      weekday: ((weekday(today) + 1) % 7) + 1,
      startTime: "10:00",
      endTime: "12:00",
      room: "A-102",
      professor: "",
      interval: 1,
      startDate: start,
      endDate: end,
    },
  ];
  state.exams = [
    {
      id: uid(),
      name: "Programming midterm",
      subjectId: subjects[0].id,
      componentId: subjects[0].assessments[2].id,
      date: addDays(today, 8),
      time: "10:00",
      duration: 120,
      weight: 30,
      difficulty: 4,
      preparation: 35,
      completed: false,
    },
    {
      id: uid(),
      name: "Mathematics written exam",
      subjectId: subjects[1].id,
      componentId: subjects[1].assessments[1].id,
      date: addDays(today, 22),
      time: "09:00",
      duration: 120,
      weight: 80,
      difficulty: 5,
      preparation: 20,
      completed: false,
    },
  ];
  state.workouts = [
    {
      id: uid(),
      name: "Upper body & a little reset",
      weekday: weekday(today),
      startTime: "19:00",
      duration: 45,
      flexible: true,
      startDate: start,
      endDate: end,
      exercises: [
        { id: uid(), name: "Push-ups", sets: 3, reps: "12" },
        { id: uid(), name: "Dumbbell rows", sets: 3, reps: "10 / side" },
        { id: uid(), name: "Plank", sets: 3, reps: "45 sec" },
      ],
    },
  ];
  for (let i = -6; i <= 0; i++) {
    const date = addDays(today, i),
      sub = subjects[(i + 6) % 3];
    state.activities.push({
      id: uid(),
      title: `${sub.name} · focused practice`,
      start: at(date, "16:00", state.settings.timezone),
      end: at(date, "17:30", state.settings.timezone),
      category: "study",
      description:
        "Example study session. Replace this with your own schedule.",
      color: sub.color,
      fixed: false,
      completed: i < -1,
      completedMinutes: i < -1 ? 90 : i < 0 ? 30 : 0,
      subjectId: sub.id,
    });
  }
  state.activities.push({
    id: uid(),
    title: "A walk and a fresh perspective",
    start: at(today, "18:00", state.settings.timezone),
    end: at(today, "18:30", state.settings.timezone),
    category: "personal",
    description: "Example personal activity.",
    color: palette.personal,
    fixed: false,
    completed: false,
    completedMinutes: 0,
  });
  return state;
}
