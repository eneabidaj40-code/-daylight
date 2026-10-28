import type { Assessment, Settings, Subject } from "./model";

export function calculateGrade(
  assessments: Assessment[],
  target: number,
  scenarios: Record<string, number> = {},
) {
  const totalWeight = assessments.reduce((n, a) => n + a.weight, 0);
  let earned = 0,
    completedWeight = 0;
  for (const a of assessments) {
    const simulated = scenarios[a.id];
    if (a.completed || simulated !== undefined) {
      earned += ((simulated ?? a.score) / a.maxScore) * a.weight;
      completedWeight += a.weight;
    }
  }
  const valid = assessments.length > 0 && Math.abs(totalWeight - 100) < 0.001;
  const remaining = Math.max(0, totalWeight - completedWeight);
  const maximum = earned + remaining;
  const secured = valid && earned >= target - 0.000001;
  const required =
    remaining > 0 ? Math.max(0, ((target - earned) / remaining) * 100) : null;
  return {
    valid,
    totalWeight,
    earned,
    completedWeight,
    remaining,
    completedAverage: completedWeight ? (earned / completedWeight) * 100 : null,
    required,
    maximum,
    secured,
    achievable: valid && maximum >= target - 0.000001,
  };
}
export function gradeBand(score: number, scale: Settings["gradeScale"]) {
  return (
    [...scale].sort((a, b) => b.min - a.min).find((g) => score >= g.min) ?? {
      letter: "—",
      min: 0,
      points: 0,
    }
  );
}
export function semesterGPA(
  subjects: Subject[],
  scale: Settings["gradeScale"],
  projected = false,
  scenarios: Record<string, number> = {},
) {
  let points = 0,
    credits = 0;
  for (const subject of subjects) {
    const grade = calculateGrade(subject.assessments, subject.target);
    const score =
      scenarios[subject.id] ??
      (projected ? subject.target : grade.completedAverage);
    if (
      score === null ||
      (!projected && !grade.valid && scenarios[subject.id] === undefined)
    )
      continue;
    credits += subject.credits;
    points += gradeBand(score, scale).points * subject.credits;
  }
  return { gpa: credits ? points / credits : null, credits, points };
}
