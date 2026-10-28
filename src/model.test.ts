import { describe, expect, it } from "vitest";
import { emptyState, stateSchema } from "./model";
import { exampleState } from "./example";
import { addDays, at, clockTime, dayKey } from "./time";

describe("validated portable backups", () => {
  it("round trips the empty and example workspaces", () => {
    for (const state of [emptyState(), exampleState()])
      expect(stateSchema.parse(JSON.parse(JSON.stringify(state)))).toEqual(
        state,
      );
  });
  it("rejects unsupported versions and incomplete files", () => {
    expect(stateSchema.safeParse({ ...emptyState(), version: 2 }).success).toBe(
      false,
    );
    expect(stateSchema.safeParse({ version: 1 }).success).toBe(false);
  });
  it("rejects orphaned references and duplicate IDs", () => {
    const s = exampleState();
    s.subjects = [];
    expect(stateSchema.safeParse(s).success).toBe(false);
    const s2 = exampleState();
    s2.subjects[1].id = s2.subjects[0].id;
    expect(stateSchema.safeParse(s2).success).toBe(false);
  });
  it("rejects out of range scores and invalid maximums", () => {
    const s = exampleState();
    s.subjects[0].assessments[0].maxScore = 0;
    expect(stateSchema.safeParse(s).success).toBe(false);
    s.subjects[0].assessments[0].maxScore = 50;
    expect(stateSchema.safeParse(s).success).toBe(false);
  });
  it("rejects impossible calendar dates and reversed activities", () => {
    const s = exampleState();
    s.exams[0].date = "2026-02-30";
    expect(stateSchema.safeParse(s).success).toBe(false);
    const s2 = exampleState();
    s2.activities[0].end = s2.activities[0].start;
    expect(stateSchema.safeParse(s2).success).toBe(false);
  });
  it("normalizes offset timestamps for consistent comparisons", () => {
    const s = exampleState();
    s.activities[0].start = "2026-11-02T16:00:00+02:00";
    s.activities[0].end = "2026-11-02T18:00:00+02:00";
    s.activities[0].completedMinutes = 90;
    const result = stateSchema.parse(s);
    expect(result.activities[0].start).toBe("2026-11-02T14:00:00.000Z");
  });
  it("rejects unknown timezones and inconsistent grade boundaries", () => {
    const s = emptyState();
    s.settings.timezone = "Unknown/Somewhere";
    expect(stateSchema.safeParse(s).success).toBe(false);
    s.settings.timezone = "UTC";
    s.settings.gradeScale[0].min = 0;
    expect(stateSchema.safeParse(s).success).toBe(false);
  });
  it("does not accept completed time exceeding activity duration", () => {
    const s = exampleState();
    s.activities[0].completedMinutes = 10000;
    expect(stateSchema.safeParse(s).success).toBe(false);
  });
});
describe("timezone-safe date arithmetic", () => {
  it("uses configured timezone rather than device date", () => {
    expect(dayKey("2026-11-01T23:30:00Z", "Europe/Tirane")).toBe("2026-11-02");
    expect(dayKey("2026-11-01T23:30:00Z", "America/New_York")).toBe(
      "2026-11-01",
    );
  });
  it("keeps class wall time through daylight-saving changes", () => {
    expect(
      clockTime(at("2026-03-27", "09:00", "Europe/Tirane"), "Europe/Tirane"),
    ).toBe("09:00");
    expect(at("2026-03-30", "09:00", "Europe/Tirane")).toBe(
      "2026-03-30T07:00:00.000Z",
    );
  });
  it("adds calendar days across months and leap years", () => {
    expect(addDays("2028-02-28", 1)).toBe("2028-02-29");
    expect(addDays("2026-12-31", 1)).toBe("2027-01-01");
  });
});
