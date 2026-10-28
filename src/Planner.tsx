import { useState } from "react";
import {
  Check,
  ChevronDown,
  Pencil,
  RefreshCw,
  Sparkles,
  Trash2,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { generatePlan, validatePlan, type Suggestion } from "./schedule";
import { uid } from "./model";
import {
  at,
  clockTime,
  dayKey,
  duration,
  hours,
  localInput,
  prettyDay,
} from "./time";
import {
  Button,
  Empty,
  Field,
  FormError,
  IconButton,
  Modal,
  Progress,
} from "./ui";

export default function Planner({
  now,
  close,
}: {
  now: Date;
  close: () => void;
}) {
  const { state, update, toast } = useStore(),
    tz = state.settings.timezone,
    today = dayKey(now, tz);
  const [first, setFirst] = useState(today),
    [count, setCount] = useState(7),
    [plan, setPlan] = useState<Suggestion>(() =>
      generatePlan(state, today, 7, now),
    ),
    [editing, setEditing] = useState(false),
    [error, setError] = useState("");
  const regenerate = () => {
    setError("");
    setEditing(false);
    setPlan(generatePlan(state, first, count, new Date()));
  };
  const accept = () => {
    const problem = validatePlan(plan, state, new Date());
    if (problem) {
      setError(problem);
      return;
    }
    if (!plan.activities.length) {
      setError(
        "There are no sessions to accept. Add topics or adjust your commitments.",
      );
      return;
    }
    update((s) => ({
      ...s,
      activities: [
        ...s.activities,
        ...plan.activities.map((a) => ({ ...a, id: uid() })),
      ],
    }));
    toast("Your study plan is on the calendar. One step at a time.");
    close();
  };
  const studied = plan.activities.filter((a) => a.category === "study"),
    total = studied.reduce((n, a) => n + duration(a), 0);
  const changeTime = (id: string, key: "start" | "end", value: string) => {
    if (value.length < 16) return;
    const iso = at(value.slice(0, 10), value.slice(11), tz);
    setPlan({
      ...plan,
      activities: plan.activities.map((a) =>
        a.id === id ? { ...a, [key]: iso } : a,
      ),
    });
  };
  return (
    <Modal
      title="A little help finding your focus"
      subtitle="Thoughtful suggestions, built around your real life. Nothing changes until you accept."
      close={close}
      wide
    >
      <div className="form-body planner">
        <div className="planner-controls">
          <Field label="Start date">
            <input
              aria-label="Plan start date"
              type="date"
              min={today}
              required
              value={first}
              onChange={(e) => {
                if (e.target.value && e.target.value >= today)
                  setFirst(e.target.value);
              }}
            />
          </Field>
          <Field label="Plan ahead">
            <select
              aria-label="Plan length"
              value={count}
              onChange={(e) => setCount(Number(e.target.value))}
            >
              <option value="1">Today / 1 day</option>
              <option value="3">3 days</option>
              <option value="7">7 days</option>
            </select>
          </Field>
          <Button icon={RefreshCw} onClick={regenerate}>
            Regenerate
          </Button>
        </div>
        <div className="plan-summary">
          <div>
            <Sparkles size={22} />
            <span>
              <strong>{hours(total)}</strong> of focused study
            </span>
          </div>
          <span>
            {studied.length} sessions · {plan.days.length} days
          </span>
          <span>Sleep & commitments protected</span>
        </div>
        <div className="plan-day-strip">
          {plan.days.map((d) => (
            <div key={d.date}>
              <span>{prettyDay(d.date, { weekday: "short" })}</span>
              <strong>
                {hours(
                  plan.activities
                    .filter(
                      (a) =>
                        a.category === "study" &&
                        dayKey(a.start, tz) === d.date,
                    )
                    .reduce((n, a) => n + duration(a), 0),
                )}
              </strong>
              <small>{hours(d.existing)} confirmed</small>
            </div>
          ))}
        </div>
        <details className="priority-details" open>
          <summary>
            Why this allocation?
            <ChevronDown size={16} />
          </summary>
          <div className="priority-list">
            {plan.priorities.map((p) => {
              const m = studied
                .filter((a) => a.subjectId === p.subject.id)
                .reduce((n, a) => n + duration(a), 0);
              return (
                <div key={p.subject.id}>
                  <div>
                    <strong>
                      <span
                        className="dot"
                        style={{ background: p.subject.color }}
                      />
                      {p.subject.name}
                    </strong>
                    <b>{hours(m)}</b>
                  </div>
                  <Progress
                    value={total ? (m / total) * 100 : 0}
                    color={p.subject.color}
                  />
                  <p>
                    {p.reason}. Priority score: {p.score.toFixed(2)}.
                  </p>
                </div>
              );
            })}
          </div>
        </details>
        {plan.explanations.map((text, i) => (
          <p
            key={i}
            className={`plan-explanation ${text.includes("fit.") ? "warning" : ""}`}
          >
            {text}
          </p>
        ))}
        <div className="section-label">
          <h3>Your proposed sessions</h3>
          <Button icon={Pencil} onClick={() => setEditing(!editing)}>
            {editing ? "Finish modifying" : "Modify suggestions"}
          </Button>
        </div>
        {plan.activities.length ? (
          <div className="plan-sessions">
            {plan.activities.map((a) => (
              <div
                className={`plan-session ${a.category === "break" ? "is-break" : ""}`}
                key={a.id}
              >
                <span className="dot" style={{ background: a.color }} />
                <div>
                  <strong>{a.title}</strong>
                  <p>
                    {prettyDay(dayKey(a.start, tz), {
                      weekday: "short",
                      month: "short",
                      day: "numeric",
                    })}{" "}
                    · {clockTime(a.start, tz)} – {clockTime(a.end, tz)} ·{" "}
                    {hours(duration(a))}
                  </p>
                  {editing && (
                    <div className="form-grid">
                      <Field label="Start">
                        <input
                          type="datetime-local"
                          aria-label={`${a.title} start`}
                          value={localInput(a.start, tz)}
                          onChange={(e) =>
                            changeTime(a.id, "start", e.target.value)
                          }
                        />
                      </Field>
                      <Field label="End">
                        <input
                          type="datetime-local"
                          aria-label={`${a.title} end`}
                          value={localInput(a.end, tz)}
                          onChange={(e) =>
                            changeTime(a.id, "end", e.target.value)
                          }
                        />
                      </Field>
                    </div>
                  )}
                </div>
                {editing && (
                  <IconButton
                    icon={Trash2}
                    label={`Remove suggested ${a.title}`}
                    onClick={() =>
                      setPlan({
                        ...plan,
                        activities: plan.activities.filter(
                          (x) => x.id !== a.id,
                        ),
                      })
                    }
                  />
                )}
              </div>
            ))}
          </div>
        ) : (
          <Empty
            icon={Sparkles}
            title="A little more context would help"
            text="Add unfinished topics or upcoming assessments, check your available time, and regenerate. Already confirmed study also counts toward your workload."
          />
        )}
        <FormError error={error} />
        <div className="form-footer sticky-footer">
          <Button
            icon={X}
            onClick={() => {
              update((s) => ({
                ...s,
                rejectedDays: [
                  ...new Set([
                    ...s.rejectedDays,
                    ...plan.days.map((d) => d.date),
                  ]),
                ],
              }));
              toast("Suggestions dismissed. Your calendar stays as it is.");
              close();
            }}
          >
            Reject suggestions
          </Button>
          <Button
            variant="primary"
            icon={Check}
            onClick={accept}
            disabled={!plan.activities.length}
          >
            Accept plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
