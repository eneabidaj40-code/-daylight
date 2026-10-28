import { describe, expect, it } from "vitest";
import { campusTrip, recurringClasses } from "./academic";
import {
  conflictFor,
  generatePlan,
  occurrences,
  validatePlan,
} from "./schedule";
import { stateSchema } from "./model";
import { addDays, at, duration, overlap } from "./time";
import { date, tz, now, fixture, period, event } from "./test/fixtures";

describe("academic periods share one occurrence filter", () => {
  it("suspends a Monday lecture inclusively, keeps its timetable and restores it afterward", () => {
    const s = fixture(),
      saved = structuredClone(s.classes);
    s.examPeriods = [{ ...period }];
    expect(recurringClasses(s, date)).toEqual([]);
    expect(recurringClasses(s, addDays(date, 7))).toHaveLength(1);
    expect(s.classes).toEqual(saved);
    s.examPeriods[0].endDate = addDays(date, 7);
    expect(recurringClasses(s, addDays(date, 7))).toEqual([]);
    expect(recurringClasses(s, addDays(date, 14))).toHaveLength(1);
  });
  it("does not block an exam or study, and creates no phantom travel/rest", () => {
    const s = fixture();
    s.examPeriods = [period];
    const events = occurrences(s, date, date);
    expect(events.map((a) => a.source)).toEqual(["exam"]);
    expect(events[0].fixed).toBe(true);
    expect(conflictFor(events[0], s)).toBeUndefined();
    const study = event("12:00", "13:00", "study", "study");
    expect(conflictFor(study, s)).toBeUndefined();
    const plan = generatePlan(s, date, 1, now);
    expect(
      plan.activities.some(
        (a) =>
          a.category === "study" &&
          a.start >= at(date, "11:30", tz) &&
          a.start < at(date, "14:00", tz),
      ),
    ).toBe(true);
    expect(validatePlan(plan, s, now)).toBeNull();
    for (const a of plan.activities) expect(overlap(a, events[0])).toBe(false);
  });
  it("suspends only recurring classes, preserving personal and independent university commitments", () => {
    const s = fixture();
    s.examPeriods = [period];
    s.activities = [
      event("15:00", "16:00"),
      event("17:00", "18:00", "independent", "university"),
    ];
    expect(occurrences(s, date, date).map((a) => a.id)).toEqual([
      "exam:exam",
      "personal",
      "independent",
    ]);
    expect(conflictFor(event("17:30", "18:30", "new"), s)?.id).toBe(
      "independent",
    );
  });
  it("handles overlapping periods, global/per-period switches and semester boundaries", () => {
    const s = fixture();
    s.examPeriods = [
      { ...period },
      { ...period, id: "other", endDate: addDays(date, 9) },
    ];
    expect(
      occurrences(s, date, addDays(date, 14)).filter(
        (a) => a.source === "class",
      ),
    ).toHaveLength(1);
    s.settings.suspendClassesDuringExamPeriods = false;
    expect(recurringClasses(s, date)).toHaveLength(1);
    s.settings.suspendClassesDuringExamPeriods = true;
    s.examPeriods.forEach((p) => (p.suspendClasses = false));
    expect(recurringClasses(s, date)).toHaveLength(1);
    expect(recurringClasses(s, addDays(date, -7))).toEqual([]);
    expect(recurringClasses(s, addDays(date, 63))).toEqual([]);
  });
  it("retains the biweekly anchor through a suspension and DST change", () => {
    const s = fixture();
    s.settings.timezone = "America/New_York";
    s.classes[0] = {
      ...s.classes[0],
      startDate: "2026-10-19",
      endDate: "2026-12-31",
      interval: 2,
    };
    s.examPeriods = [
      { ...period, startDate: "2026-11-02", endDate: "2026-11-08" },
    ];
    expect(recurringClasses(s, "2026-11-02")).toEqual([]);
    expect(recurringClasses(s, "2026-11-09")).toEqual([]);
    const restored = occurrences(s, "2026-11-16", "2026-11-16").find(
      (a) => a.source === "class",
    );
    expect(restored?.start).toBe("2026-11-16T14:00:00.000Z");
  });
});

describe("editable campus return rules", () => {
  it("uses weekday-specific departure, duration, waiting and independent outbound travel", () => {
    const s = fixture();
    s.exams = [];
    s.classes.push({ ...s.classes[0], id: "tuesday", weekday: 2 });
    s.settings.commuteTo = 35;
    s.commuteRules = [
      {
        id: "mon",
        weekday: 1,
        mode: "departure",
        departureTime: "15:30",
        waitingMinutes: 0,
        durationMinutes: 45,
      },
      {
        id: "tue",
        weekday: 2,
        mode: "after-class",
        waitingMinutes: 20,
        durationMinutes: 70,
      },
    ];
    const mon = campusTrip(s, date)!,
      tue = campusTrip(s, addDays(date, 1))!;
    expect(mon.outbound).toBe(at(date, "08:25", tz));
    expect(mon.departure).toBe(at(date, "15:30", tz));
    expect(mon.arrival).toBe(at(date, "16:15", tz));
    expect(mon.restEnd).toBe(at(date, "17:15", tz));
    expect(tue.arrival).toBe(at(addDays(date, 1), "15:30", tz));
    const waiting = occurrences(s, date, date).find((a) =>
      a.id.startsWith("travel-wait"),
    );
    expect(duration(waiting!)).toBe(90);
    const plan = generatePlan(s, date, 1, now);
    for (const a of plan.activities)
      for (const blocked of occurrences(s, date, date))
        expect(overlap(a, blocked)).toBe(false);
  });
  it("gives date overrides precedence and supports manually edited arrival home", () => {
    const s = fixture();
    s.exams = [];
    s.commuteRules = [
      {
        id: "mon",
        weekday: 1,
        mode: "after-class",
        waitingMinutes: 0,
        durationMinutes: 60,
      },
      {
        id: "override",
        date,
        mode: "departure",
        departureTime: "15:30",
        waitingMinutes: 0,
        durationMinutes: 45,
        arrivalTime: "17:00",
      },
    ];
    expect(campusTrip(s, date)?.arrival).toBe(at(date, "17:00", tz));
    expect(campusTrip(s, date)?.restEnd).toBe(at(date, "18:00", tz));
    expect(campusTrip(s, addDays(date, 7))?.arrival).toBe(
      at(addDays(date, 7), "15:00", tz),
    );
  });
  it("never departs before final class and reports incompatible arrival rules", () => {
    const s = fixture();
    s.exams = [];
    s.commuteRules = [
      {
        id: "mon",
        weekday: 1,
        mode: "departure",
        departureTime: "12:00",
        waitingMinutes: 0,
        durationMinutes: 60,
        arrivalTime: "13:00",
      },
    ];
    const trip = campusTrip(s, date)!;
    expect(trip.departure).toBe(at(date, "14:00", tz));
    expect(trip.arrival).toBe(at(date, "15:00", tz));
    expect(trip.warnings).toHaveLength(2);
  });
  it("requires an actual explicitly configured trip during exam suspension", () => {
    const s = fixture();
    s.examPeriods = [period];
    expect(campusTrip(s, date)).toBeNull();
    s.exams[0].requiresUniversityTrip = true;
    expect(campusTrip(s, date)?.departure).toBe(at(date, "11:30", tz));
    expect(
      occurrences(s, date, date).filter((a) => a.id.startsWith("travel-home")),
    ).toHaveLength(1);
    s.exams = [];
    s.activities = [
      { ...event("14:00", "15:00"), requiresUniversityTrip: true },
    ];
    expect(campusTrip(s, date)?.arrival).toBe(at(date, "16:00", tz));
    expect(campusTrip(s, addDays(date, 1))).toBeNull();
  });
  it("validates backwards periods and duplicate weekday/date rules", () => {
    const s = fixture();
    s.examPeriods = [{ ...period, endDate: addDays(date, -1) }];
    expect(stateSchema.safeParse(s).success).toBe(false);
    s.examPeriods = [];
    s.commuteRules = [
      {
        id: "a",
        weekday: 1,
        mode: "after-class",
        waitingMinutes: 0,
        durationMinutes: 20,
      },
      {
        id: "b",
        weekday: 1,
        mode: "after-class",
        waitingMinutes: 10,
        durationMinutes: 30,
      },
    ];
    expect(stateSchema.safeParse(s).success).toBe(false);
  });
});
