import { useState } from "react";
import { useStore } from "./store";
import {
  commuteRuleSchema,
  examPeriodSchema,
  uid,
  type CommuteRule,
  type ExamPeriod,
} from "./model";
import { campusTrip } from "./academic";
import { clockTime, dayKey, prettyDay } from "./time";
import { Button, Field, FormError } from "./ui";

const weekdays = [
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
  "Sunday",
];
export default function AcademicCalendar() {
  const { state, commit, toast } = useStore(),
    tz = state.settings.timezone;
  const today = dayKey(new Date(), tz);
  const blankPeriod = (): ExamPeriod => ({
    id: uid(),
    name: "",
    startDate: today,
    endDate: today,
    suspendClasses: true,
  });
  const blankRule = (): CommuteRule => ({
    id: uid(),
    weekday: 1,
    mode: "after-class",
    waitingMinutes: 0,
    durationMinutes: state.settings.commuteHome,
  });
  const [period, setPeriod] = useState(blankPeriod);
  const [rule, setRule] = useState(blankRule);
  const [previewDate, setPreviewDate] = useState(today);
  const [error, setError] = useState("");
  const [busy, setBusy] = useState(false);
  const trip = campusTrip(state, previewDate);
  const save = async (
    mutation: Parameters<typeof commit>[0],
    message: string,
    done?: () => void,
  ) => {
    if (busy) return;
    setBusy(true);
    setError("");
    try {
      await commit(mutation);
      toast(message);
      done?.();
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    } finally {
      setBusy(false);
    }
  };
  return (
    <div className="academic-settings">
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Academic calendar / exam periods</h2>
            <p>
              Dates include both endpoints in {tz}. Your weekly timetable is
              retained and resumes automatically.
            </p>
          </div>
        </div>
        <label className="check-row">
          <input
            type="checkbox"
            checked={state.settings.suspendClassesDuringExamPeriods}
            disabled={busy}
            onChange={(e) => {
              const checked = e.target.checked;
              void save(
                (s) => ({
                  ...s,
                  settings: {
                    ...s.settings,
                    suspendClassesDuringExamPeriods: checked,
                  },
                }),
                "Academic calendar preference saved",
              );
            }}
          />{" "}
          Suspend recurring university classes during exam periods
        </label>
        <p>
          Only recurring classes are suspended. Exams, personal activities and
          independent commitments remain fixed in your calendar. Overlapping
          periods suspend each class once.
        </p>
        {state.examPeriods.map((p) => (
          <div className="section-label" key={p.id}>
            <div>
              <strong>{p.name}</strong>
              <p>
                {prettyDay(p.startDate)} – {prettyDay(p.endDate)} ·{" "}
                {p.suspendClasses ? "Classes suspended" : "Classes continue"}
              </p>
            </div>
            <div className="actions">
              <Button
                type="button"
                disabled={busy}
                onClick={() => setPeriod({ ...p })}
              >
                Edit {p.name}
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void save(
                    (s) => ({
                      ...s,
                      examPeriods: s.examPeriods.filter((x) => x.id !== p.id),
                    }),
                    "Exam period removed",
                  )
                }
              >
                Remove {p.name}
              </Button>
            </div>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = examPeriodSchema.safeParse(period);
            if (!parsed.success) {
              setError(parsed.error.issues.map((i) => i.message).join(" "));
              return;
            }
            void save(
              (s) => ({
                ...s,
                examPeriods: [
                  ...s.examPeriods.filter((x) => x.id !== period.id),
                  parsed.data,
                ],
              }),
              "Exam period saved",
              () => setPeriod(blankPeriod()),
            );
          }}
        >
          <h3>
            {state.examPeriods.some((p) => p.id === period.id)
              ? "Edit exam period"
              : "Add exam period"}
          </h3>
          <div className="form-grid">
            <Field label="Exam period name">
              <input
                required
                maxLength={200}
                value={period.name}
                onChange={(e) => setPeriod({ ...period, name: e.target.value })}
              />
            </Field>
            <Field label="Period start date">
              <input
                type="date"
                required
                value={period.startDate}
                onChange={(e) =>
                  setPeriod({ ...period, startDate: e.target.value })
                }
              />
            </Field>
            <Field label="Period end date">
              <input
                type="date"
                required
                min={period.startDate}
                value={period.endDate}
                onChange={(e) =>
                  setPeriod({ ...period, endDate: e.target.value })
                }
              />
            </Field>
          </div>
          <label className="check-row">
            <input
              type="checkbox"
              checked={period.suspendClasses}
              onChange={(e) =>
                setPeriod({ ...period, suspendClasses: e.target.checked })
              }
            />{" "}
            Suspend recurring classes in this period
          </label>
          <div className="form-footer">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setPeriod(blankPeriod())}
            >
              New period
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Save exam period
            </Button>
          </div>
        </form>
      </section>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>University commuting rules</h2>
            <p>
              Travel to university: {state.settings.commuteTo} minutes. Default
              return: {state.settings.commuteHome} minutes. Edit these
              independent defaults in Settings.
            </p>
          </div>
        </div>
        <p>
          Weekday return rules and one-time date overrides do not alter your
          class timetable. A date override replaces that weekday's rule. A trip
          requires an active class or an exam/activity explicitly marked as
          requiring university travel.
        </p>
        {state.commuteRules.map((r) => (
          <div className="section-label" key={r.id}>
            <div>
              <strong>
                {r.date
                  ? `Override ${prettyDay(r.date)}`
                  : weekdays[r.weekday! - 1]}
              </strong>
              <p>
                {r.mode === "departure"
                  ? `Bus at ${r.departureTime}`
                  : `Wait ${r.waitingMinutes} minutes after class`}{" "}
                · travel {r.durationMinutes} minutes
                {r.arrivalTime ? ` · arrive ${r.arrivalTime}` : ""}
              </p>
            </div>
            <div className="actions">
              <Button
                type="button"
                disabled={busy}
                onClick={() => setRule({ ...r })}
              >
                Edit return rule
              </Button>
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  void save(
                    (s) => ({
                      ...s,
                      commuteRules: s.commuteRules.filter((x) => x.id !== r.id),
                    }),
                    "Return rule removed",
                  )
                }
              >
                Remove return rule
              </Button>
            </div>
          </div>
        ))}
        <form
          onSubmit={(e) => {
            e.preventDefault();
            const parsed = commuteRuleSchema.safeParse(rule);
            if (!parsed.success) {
              setError(parsed.error.issues.map((i) => i.message).join(" "));
              return;
            }
            void save(
              (s) => {
                if (
                  s.commuteRules.some(
                    (r) =>
                      r.id !== rule.id &&
                      (rule.date
                        ? r.date === rule.date
                        : r.weekday === rule.weekday),
                  )
                )
                  throw new Error(
                    "A rule for this weekday or date already exists. Edit that rule instead.",
                  );
                return {
                  ...s,
                  commuteRules: [
                    ...s.commuteRules.filter((x) => x.id !== rule.id),
                    parsed.data,
                  ],
                };
              },
              "Return commute saved",
              () => setRule(blankRule()),
            );
          }}
        >
          <h3>
            {state.commuteRules.some((r) => r.id === rule.id)
              ? "Edit return rule"
              : "Add return rule"}
          </h3>
          <div className="form-grid">
            <Field label="Rule applies to">
              <select
                value={rule.date ? "date" : "weekday"}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    weekday: e.target.value === "weekday" ? 1 : undefined,
                    date: e.target.value === "date" ? today : undefined,
                  })
                }
              >
                <option value="weekday">Every selected weekday</option>
                <option value="date">One-time date override</option>
              </select>
            </Field>
            {rule.date !== undefined ? (
              <Field label="Override date">
                <input
                  type="date"
                  required
                  value={rule.date}
                  onChange={(e) => setRule({ ...rule, date: e.target.value })}
                />
              </Field>
            ) : (
              <Field label="Return weekday">
                <select
                  value={rule.weekday}
                  onChange={(e) =>
                    setRule({ ...rule, weekday: Number(e.target.value) })
                  }
                >
                  {weekdays.map((d, i) => (
                    <option key={d} value={i + 1}>
                      {d}
                    </option>
                  ))}
                </select>
              </Field>
            )}
            <Field label="Departure rule">
              <select
                value={rule.mode}
                onChange={(e) =>
                  setRule({
                    ...rule,
                    mode: e.target.value as CommuteRule["mode"],
                    departureTime: rule.departureTime ?? "15:00",
                  })
                }
              >
                <option value="after-class">
                  After final class plus waiting time
                </option>
                <option value="departure">Fixed bus departure time</option>
              </select>
            </Field>
            {rule.mode === "departure" ? (
              <Field label="Bus departure time">
                <input
                  type="time"
                  required
                  value={rule.departureTime ?? "15:00"}
                  onChange={(e) =>
                    setRule({ ...rule, departureTime: e.target.value })
                  }
                />
              </Field>
            ) : (
              <Field label="Waiting after final class (minutes)">
                <input
                  type="number"
                  min={0}
                  max={360}
                  required
                  value={rule.waitingMinutes}
                  onChange={(e) =>
                    setRule({ ...rule, waitingMinutes: Number(e.target.value) })
                  }
                />
              </Field>
            )}
            <Field label="Return travel duration (minutes)">
              <input
                type="number"
                min={0}
                max={480}
                required
                value={rule.durationMinutes}
                onChange={(e) =>
                  setRule({ ...rule, durationMinutes: Number(e.target.value) })
                }
              />
            </Field>
            <Field
              label="Expected arrival home (optional)"
              help="Same-day local time overrides the duration. Leave blank to calculate arrival."
            >
              <input
                type="time"
                value={rule.arrivalTime ?? ""}
                onChange={(e) =>
                  setRule({ ...rule, arrivalTime: e.target.value || undefined })
                }
              />
            </Field>
          </div>
          <div className="form-footer">
            <Button
              type="button"
              disabled={busy}
              onClick={() => setRule(blankRule())}
            >
              New return rule
            </Button>
            <Button type="submit" variant="primary" disabled={busy}>
              Save return rule
            </Button>
          </div>
        </form>
        <div className="notice">
          <Field label="Preview commute date">
            <input
              type="date"
              value={previewDate}
              onChange={(e) => {
                if (e.target.value) setPreviewDate(e.target.value);
              }}
            />
          </Field>
          {trip ? (
            <>
              <p>
                Final campus commitment ends {clockTime(trip.last, tz)} · depart{" "}
                {clockTime(trip.departure, tz)} · arrive home{" "}
                {clockTime(trip.arrival, tz)} · recovery ends{" "}
                {clockTime(trip.restEnd, tz)}. Study is available afterward
                subject to other commitments, meals and sleep.
              </p>
              {trip.warnings.map((w) => (
                <p key={w}>{w}</p>
              ))}
            </>
          ) : (
            <p>
              No university trip on this date. Suspended classes do not create
              travel, waiting or recovery blocks.
            </p>
          )}
        </div>
      </section>
      <FormError error={error} />
    </div>
  );
}
