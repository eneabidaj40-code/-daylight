import { describe, expect, it } from "vitest";
import { acceptProposal, modifyProposal } from "./proposals";
import { generatePlan, priorities, validatePlan } from "./schedule";
import { emptyState, stateSchema } from "./model";
import { addDays, at, duration, localInput } from "./time";
import { date, tz, now, fixture, event } from "./test/fixtures";

describe("generation diagnostics and exact priorities", () => {
  it("generates when free and identifies blocking commitments when full", () => {
    const s = fixture();
    s.classes = [];
    s.exams = [];
    expect(generatePlan(s, date, 1, now).activities.length).toBeGreaterThan(0);
    s.activities = [event("07:00", "23:00", "All day shift")];
    const plan = generatePlan(s, date, 1, now);
    expect(plan.activities).toEqual([]);
    expect(plan.explanations.join(" ")).toContain(
      "all available hours are blocked by All day shift",
    );
    expect(plan.explanations.join(" ")).toContain("Sleep");
  });
  it("explains missing topics/exams, ceiling, elapsed window, and covered workload", () => {
    expect(
      generatePlan(emptyState(), date, 1, now).explanations.join(" "),
    ).toContain("No subjects");
    const s = fixture();
    s.classes = [];
    s.exams = [];
    s.subjects[0].topics = [];
    expect(generatePlan(s, date, 1, now).explanations.join(" ")).toContain(
      "No unfinished topics or future exams",
    );
    s.subjects = fixture().subjects;
    s.activities = [event("07:00", "13:00", "Confirmed study", "study")];
    expect(generatePlan(s, date, 1, now).explanations.join(" ")).toContain(
      "daily study ceiling",
    );
    s.activities = [];
    expect(
      generatePlan(
        s,
        date,
        1,
        new Date(at(date, "23:00", tz)),
      ).explanations.join(" "),
    ).toContain("waking window has ended");
    s.subjects[0].topics[0].hours = 1;
    s.activities = [
      {
        ...event("14:00", "15:00", "Already planned", "study"),
        subjectId: "java",
      },
    ];
    expect(generatePlan(s, date, 1, now).explanations.join(" ")).toContain(
      "already covers",
    );
  });
  it("uses exact exam cutoff within a day, and increases priority as the clock approaches it", () => {
    const s = fixture();
    s.classes = [];
    s.subjects[0].topics = [];
    const plan = generatePlan(s, date, 1, now);
    expect(plan.activities.some((a) => a.category === "study")).toBe(true);
    for (const a of plan.activities.filter((a) => a.category === "study"))
      expect(a.end <= at(date, "10:00", tz)).toBe(true);
    expect(
      generatePlan(s, date, 1, new Date(at(date, "10:01", tz))).activities,
    ).toEqual([]);
    const far = priorities(s, new Date(at(addDays(date, -3), "06:00", tz)))[0]
      .score;
    expect(priorities(s, now)[0].score).toBeGreaterThan(far);
    expect(
      priorities(s, new Date(at(date, "09:00", tz)))[0].score,
    ).toBeGreaterThan(priorities(s, now)[0].score);
  });
  it("raises recommendations near exams, respects configured max and grade targets", () => {
    const s = fixture();
    s.classes = [];
    s.exams[0].date = addDays(date, 60);
    const far = generatePlan(s, date, 1, now);
    s.exams[0].date = addDays(date, 2);
    const near = generatePlan(s, date, 1, now);
    expect(near.days[0].recommended).toBeGreaterThan(far.days[0].recommended);
    expect(near.days[0].scheduled).toBeLessThanOrEqual(
      s.settings.maxDailyHours * 60,
    );
    const highTarget = priorities(s, now)[0].score;
    s.subjects[0].target = 60;
    expect(priorities(s, now)[0].score).toBeLessThan(highTarget);
  });
  it("rejects bad inputs and malformed time edits with a useful error", () => {
    const s = fixture();
    expect(() => generatePlan(s, "2026-02-30", 1, now)).toThrow(
      "valid planning",
    );
    expect(() => generatePlan(s, date, 0, now)).toThrow("1 and 31");
    expect(() => generatePlan(s, addDays(date, -1), 1, now)).toThrow("future");
    const plan = generatePlan(s, date, 1, now);
    plan.activities[0].start = "bad";
    expect(validatePlan(plan, s, now)).toContain("invalid dates");
  });
});

describe("proposal lifecycle", () => {
  it("accepts as calendar events without changing any confirmed event or subject", () => {
    const s = fixture();
    s.classes = [];
    s.exams = [];
    s.activities = [event("12:00", "13:00", "Workout", "workout")];
    const before = structuredClone(s),
      plan = generatePlan(s, date, 1, now);
    const saved = acceptProposal(s, plan, undefined, now);
    expect(saved.activities.length).toBe(
      s.activities.length + plan.activities.length,
    );
    expect(saved.activities[0]).toEqual(before.activities[0]);
    expect(saved.subjects).toEqual(before.subjects);
    expect(s).toEqual(before);
    expect(stateSchema.safeParse(saved).success).toBe(true);
  });
  it("partial acceptance then repeated/all acceptance cannot duplicate sessions", () => {
    const s = fixture();
    s.classes = [];
    s.exams = [];
    const plan = generatePlan(s, date, 1, now),
      first = plan.activities[0];
    const partial = acceptProposal(s, plan, [first.id], now);
    expect(partial.activities).toHaveLength(1);
    const all = acceptProposal(partial, plan, undefined, now);
    expect(all.activities).toHaveLength(plan.activities.length);
    expect(
      acceptProposal(
        all,
        plan,
        undefined,
        new Date(at(addDays(date, 1), "06:00", tz)),
      ),
    ).toEqual(all);
    expect(new Set(all.activities.map((a) => a.id)).size).toBe(
      all.activities.length,
    );
  });
  it("validates modified times against overlaps, sleep, invalid intervals and daily limits", () => {
    const s = fixture();
    s.classes = [];
    s.exams = [];
    s.activities = [event("16:00", "18:00")];
    const plan = generatePlan(s, date, 1, now),
      first = plan.activities[0];
    let changed = modifyProposal(plan, first.id, "start", `${date}T16:00`, tz);
    changed = modifyProposal(changed, first.id, "end", `${date}T17:00`, tz);
    expect(() => acceptProposal(s, changed, [first.id], now)).toThrow(
      "overlaps",
    );
    changed = modifyProposal(
      plan,
      first.id,
      "end",
      localInput(first.start, tz),
      tz,
    );
    expect(() => acceptProposal(s, changed, [first.id], now)).toThrow(
      "invalid",
    );
    expect(() =>
      modifyProposal(plan, first.id, "start", "2026-03-29T02:30", tz),
    ).toThrow("does not exist");
    const good = {
      ...plan,
      activities: [
        { ...first, start: at(date, "14:00", tz), end: at(date, "15:00", tz) },
      ],
    };
    const saved = acceptProposal(s, good, undefined, now);
    expect(
      saved.activities.some((a) => a.start === at(date, "14:00", tz)),
    ).toBe(true);
  });
  it("regenerates a new current proposal around accepted sessions", () => {
    const s = fixture();
    s.classes = [];
    s.exams = [];
    const plan = generatePlan(s, date, 1, now);
    const saved = acceptProposal(s, plan, [plan.activities[0].id], now);
    const next = generatePlan(saved, date, 1, now);
    expect(next.id).not.toBe(plan.id);
    expect(validatePlan(next, saved, now)).toBeNull();
    expect(next.days[0].existing).toBe(duration(plan.activities[0]));
  });
  it("revalidates latest commitments and subject deletions at acceptance", () => {
    const s = fixture();
    s.classes = [];
    s.exams = [];
    const plan = generatePlan(s, date, 1, now);
    s.activities = [{ ...plan.activities[0], id: "another-tab" }];
    expect(() => acceptProposal(s, plan, undefined, now)).toThrow("overlaps");
    s.activities = [];
    s.subjects = [];
    expect(() => acceptProposal(s, plan, undefined, now)).toThrow(
      "subject no longer exists",
    );
  });
});
