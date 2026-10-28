import { describe, expect, it } from "vitest";
import { calculateGrade, gradeBand, semesterGPA } from "./grades";
import { emptyState, type Assessment, type Subject } from "./model";

const a = (
  id: string,
  weight: number,
  score: number,
  completed: boolean,
  maxScore = 100,
): Assessment => ({ id, name: id, weight, maxScore, score, completed });
const course = (id: string, credits: number, score: number): Subject => ({
  id,
  name: id,
  code: "",
  color: "#4b886d",
  credits,
  currentGrade: 0,
  target: score,
  difficulty: 3,
  priority: 3,
  topics: [],
  assessments: [a(`${id}-a`, 100, score, true)],
});
describe("assessment mathematics", () => {
  const components = [
    a("Quiz", 10, 90, true),
    a("Midterm", 30, 85, true),
    a("Final", 60, 0, false),
  ];
  it("separates earned final points from normalized completed average", () => {
    const g = calculateGrade(components, 90);
    expect(g.earned).toBeCloseTo(34.5);
    expect(g.completedAverage).toBeCloseTo(86.25);
    expect(g.remaining).toBe(60);
    expect(g.required).toBeCloseTo(92.5);
    expect(g.maximum).toBeCloseTo(94.5);
    expect(g.achievable).toBe(true);
  });
  it("supports arbitrary maximum scores", () => {
    const g = calculateGrade(
      [a("Portfolio", 40, 45, true, 50), a("Presentation", 60, 0, false, 20)],
      90,
    );
    expect(g.earned).toBe(36);
    expect(g.required).toBe(90);
  });
  it("counts graded zero as completed weight", () => {
    const g = calculateGrade([a("A", 60, 0, true), a("B", 40, 0, false)], 90);
    expect(g.remaining).toBe(40);
    expect(g.completedAverage).toBe(0);
    expect(g.required).toBe(225);
    expect(g.achievable).toBe(false);
  });
  it("recognizes already secured targets", () => {
    const g = calculateGrade([a("A", 95, 100, true), a("B", 5, 0, false)], 90);
    expect(g.secured).toBe(true);
    expect(g.required).toBe(0);
  });
  it("never divides by zero with all assessments graded", () => {
    const g = calculateGrade([a("A", 100, 85, true)], 90);
    expect(g.required).toBeNull();
    expect(g.maximum).toBe(85);
    expect(g.achievable).toBe(false);
  });
  it("flags missing, excess, and absent weights", () => {
    expect(calculateGrade([], 90).valid).toBe(false);
    expect(calculateGrade([a("A", 110, 90, false)], 90).valid).toBe(false);
    expect(calculateGrade([a("A", 99, 90, false)], 90).valid).toBe(false);
  });
  it("accepts floating point totals within tolerance", () => {
    expect(
      calculateGrade(
        [
          a("A", 33.3333, 90, false),
          a("B", 33.3333, 90, false),
          a("C", 33.3334, 90, false),
        ],
        90,
      ).valid,
    ).toBe(true);
  });
  it("simulates scores without mutating actual grades", () => {
    const before = structuredClone(components);
    const g = calculateGrade(components, 90, { Final: 95 });
    expect(g.earned).toBeCloseTo(91.5);
    expect(g.remaining).toBe(0);
    expect(components).toEqual(before);
  });
  it("supports a simulated zero", () => {
    const g = calculateGrade(components, 90, { Final: 0 });
    expect(g.remaining).toBe(0);
    expect(g.earned).toBeCloseTo(34.5);
  });
});
describe("credit-weighted GPA", () => {
  const scale = emptyState().settings.gradeScale;
  it("uses exact inclusive grade boundaries", () => {
    expect(gradeBand(90, scale).letter).toBe("AA");
    expect(gradeBand(89.99, scale).letter).toBe("BA");
    expect(gradeBand(0, scale).points).toBe(0);
  });
  it("weights unequal course credits", () => {
    const g = semesterGPA([course("A", 6, 90), course("B", 3, 70)], scale);
    expect(g.gpa).toBeCloseTo(10 / 3);
    expect(g.credits).toBe(9);
  });
  it("excludes courses with no graded data from current GPA", () => {
    const c = course("A", 6, 90);
    c.assessments[0].completed = false;
    expect(semesterGPA([c], scale).gpa).toBeNull();
    expect(semesterGPA([c], scale, true).gpa).toBe(4);
  });
  it("does not invent a current GPA from invalid weights", () => {
    const c = course("A", 6, 90);
    c.assessments[0].weight = 40;
    expect(semesterGPA([c], scale).credits).toBe(0);
  });
  it("supports different custom scales and subject final scenarios", () => {
    expect(
      semesterGPA(
        [course("A", 6, 90)],
        [
          { letter: "Pass", min: 50, points: 5 },
          { letter: "Fail", min: 0, points: 0 },
        ],
        true,
        { A: 45 },
      ).gpa,
    ).toBe(0);
  });
});
