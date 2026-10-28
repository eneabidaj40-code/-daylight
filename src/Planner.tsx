import { useEffect, useRef, useState } from "react";
import { Check, Pencil, RefreshCw, Trash2, X } from "lucide-react";
import { useStore } from "./store";
import { generatePlan, validatePlan, type Suggestion } from "./schedule";
import { acceptProposal, modifyProposal, receiptFor } from "./proposals";
import {
  clockTime,
  dayKey,
  duration,
  hours,
  localInput,
  prettyDay,
} from "./time";
import { Button, Field, FormError, IconButton, Modal } from "./ui";

export default function Planner({
  now,
  close,
  viewCalendar,
}: {
  now: Date;
  close: () => void;
  viewCalendar?: (date: string) => void;
}) {
  const { state, commit, toast } = useStore(),
    tz = state.settings.timezone;
  const [first, setFirst] = useState(dayKey(now, tz));
  const [count, setCount] = useState(7);
  const [plan, setPlan] = useState<Suggestion | null>(null);
  const [status, setStatus] = useState<
    | "loading"
    | "idle"
    | "ready"
    | "empty"
    | "error"
    | "saving"
    | "accepted"
    | "rejected"
  >("loading");
  const [error, setError] = useState("");
  const [editing, setEditing] = useState(false);
  const generation = useRef(0),
    saving = useRef(false);
  const latest = useRef({ state, first, count });
  latest.current = { state, first, count };
  const regenerate = () => {
    const token = ++generation.current;
    setStatus("loading");
    setError("");
    setEditing(false);
    setPlan(null);
    // Yield a frame so the loading state appears before running the planner.
    setTimeout(() => {
      if (generation.current !== token) return;
      try {
        const input = latest.current;
        const result = generatePlan(
          input.state,
          input.first,
          input.count,
          new Date(),
        );
        if (generation.current !== token) return;
        setPlan(result);
        setStatus(
          result.activities.some((a) => a.category === "study")
            ? "ready"
            : "empty",
        );
      } catch (cause) {
        setError(cause instanceof Error ? cause.message : String(cause));
        setStatus("error");
      }
    }, 30);
  };
  useEffect(() => {
    regenerate();
    return () => {
      generation.current++;
    };
  }, []); // first open and StrictMode-safe cancellation
  const invalidate = () => {
    generation.current++;
    setPlan(null);
    setStatus("idle");
    setError("");
  };
  const isAccepted = (id: string) =>
    !!plan && state.acceptedSuggestionIds.includes(receiptFor(plan, id));
  const pending = plan?.activities.filter((a) => !isAccepted(a.id)) ?? [];
  const busy = status === "saving" || status === "loading";
  const accept = async (ids?: string[]) => {
    if (!plan || saving.current) return;
    saving.current = true;
    setStatus("saving");
    setError("");
    try {
      const saved = await commit((current) =>
        acceptProposal(current, plan, ids, new Date()),
      );
      const remaining = plan.activities.some(
        (a) =>
          a.category === "study" &&
          !saved.acceptedSuggestionIds.includes(receiptFor(plan, a.id)),
      );
      setStatus(remaining ? "ready" : "accepted");
      toast("Accepted sessions saved to your calendar.");
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
      setStatus("error");
    } finally {
      saving.current = false;
    }
  };
  const changeTime = (id: string, field: "start" | "end", value: string) => {
    if (!plan) return;
    try {
      const changed = modifyProposal(plan, id, field, value, tz);
      setPlan(changed);
      setError(
        validatePlan(
          {
            ...changed,
            activities: changed.activities.filter((a) => !isAccepted(a.id)),
          },
          state,
          new Date(),
        ) ?? "",
      );
    } catch (cause) {
      setError(cause instanceof Error ? cause.message : String(cause));
    }
  };
  return (
    <Modal
      title="Study plan proposals"
      subtitle={`Review recommendations before accepting. Times in ${tz}.`}
      close={() => {
        if (!saving.current) close();
      }}
      wide
    >
      <div className="form-body planner">
        <div className="planner-controls">
          <Field label="Start date">
            <input
              aria-label="Plan start date"
              type="date"
              min={dayKey(new Date(), tz)}
              value={first}
              disabled={status === "saving"}
              onChange={(e) => {
                invalidate();
                setFirst(e.target.value);
              }}
            />
          </Field>
          <Field label="Plan ahead">
            <select
              aria-label="Plan length"
              value={count}
              disabled={status === "saving"}
              onChange={(e) => {
                invalidate();
                setCount(Number(e.target.value));
              }}
            >
              <option value={1}>1 day</option>
              <option value={3}>3 days</option>
              <option value={7}>7 days</option>
              <option value={14}>14 days</option>
              <option value={31}>31 days</option>
            </select>
          </Field>
          <Button
            type="button"
            icon={RefreshCw}
            disabled={busy}
            onClick={regenerate}
          >
            {plan || status === "rejected"
              ? "Regenerate"
              : "Generate Study Plan"}
          </Button>
        </div>
        <div role="status" aria-live="polite">
          {status === "loading" && (
            <p>
              Generating sessions around your commitments and protected sleep…
            </p>
          )}
          {status === "idle" && (
            <p>Planning inputs changed. Generate a fresh proposal to review.</p>
          )}
          {status === "saving" && <p>Saving accepted sessions to IndexedDB…</p>}
          {status === "accepted" && (
            <p className="notice">
              Accepted sessions are saved to your calendar. They remain
              available after reopening Daylight.
            </p>
          )}
          {status === "rejected" && (
            <p>Suggestions rejected. Your schedule is unchanged.</p>
          )}
          {status === "empty" && <h3>No study sessions could be generated</h3>}
        </div>
        <FormError error={error} />
        {plan && status !== "rejected" && (
          <>
            <p>
              {plan.activities.filter((a) => a.category === "study").length}{" "}
              proposed study sessions ·{" "}
              {hours(
                plan.activities
                  .filter((a) => a.category === "study")
                  .reduce((n, a) => n + duration(a), 0),
              )}{" "}
              total
            </p>
            <details>
              <summary>Priority and daily study recommendations</summary>
              {plan.priorities.map((p) => (
                <p key={p.subject.id}>
                  <strong>
                    {p.subject.name} · priority {p.score.toFixed(1)}
                  </strong>
                  <br />
                  {p.reason}
                </p>
              ))}
              <div className="table-wrap">
                <table>
                  <thead>
                    <tr>
                      <th>Date</th>
                      <th>Recommended</th>
                      <th>Confirmed</th>
                      <th>Proposed</th>
                      <th>Free time</th>
                    </tr>
                  </thead>
                  <tbody>
                    {plan.days.map((d) => (
                      <tr key={d.date}>
                        <td>{prettyDay(d.date)}</td>
                        <td>{hours(d.recommended)}</td>
                        <td>{hours(d.existing)}</td>
                        <td>{hours(d.scheduled)}</td>
                        <td>{hours(d.available)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </details>
            {plan.explanations.map((text, i) => (
              <p key={i} className="plan-explanation">
                {text}
              </p>
            ))}
            {plan.activities.length > 0 && (
              <div className="section-label">
                <h3>Your proposed sessions</h3>
                <Button
                  type="button"
                  icon={Pencil}
                  disabled={busy}
                  onClick={() => setEditing(!editing)}
                >
                  {editing ? "Finish modifying" : "Modify suggestions"}
                </Button>
              </div>
            )}
            <div className="plan-sessions">
              {plan.activities.map((a, index) => (
                <div
                  data-proposal-id={a.id}
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
                      · {clockTime(a.start, tz)}–{clockTime(a.end, tz)} ·{" "}
                      {duration(a)} minutes
                    </p>
                    <p>{a.description}</p>
                    {isAccepted(a.id) && (
                      <span role="status">Accepted and saved</span>
                    )}
                    {editing && !isAccepted(a.id) && (
                      <div className="form-grid">
                        {(["start", "end"] as const).map((field) => (
                          <Field
                            key={field}
                            label={field === "start" ? "Start" : "End"}
                          >
                            <input
                              type="datetime-local"
                              aria-label={`${a.title} ${field}`}
                              value={localInput(a[field], tz)}
                              disabled={busy}
                              onChange={(e) =>
                                changeTime(a.id, field, e.target.value)
                              }
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                  </div>
                  {!isAccepted(a.id) && a.category === "study" && (
                    <Button
                      type="button"
                      disabled={busy}
                      onClick={() => {
                        const next = plan.activities[index + 1];
                        void accept([
                          a.id,
                          ...(next?.category === "break" &&
                          next.start === a.end &&
                          !isAccepted(next.id)
                            ? [next.id]
                            : []),
                        ]);
                      }}
                    >
                      Accept session
                    </Button>
                  )}
                  {editing && !isAccepted(a.id) && (
                    <IconButton
                      type="button"
                      icon={Trash2}
                      label={`Remove suggested ${a.title}`}
                      disabled={busy}
                      onClick={() => {
                        setPlan({
                          ...plan,
                          activities: plan.activities.filter(
                            (x) => x.id !== a.id,
                          ),
                        });
                        setError("");
                      }}
                    />
                  )}
                </div>
              ))}
            </div>
            {pending.some((a) => a.category === "study") && (
              <p>
                Accept session also protects its following break. Other
                suggestions remain proposals.
              </p>
            )}
          </>
        )}
        <div className="form-footer sticky-footer">
          <Button
            type="button"
            icon={X}
            disabled={
              busy || !plan || status === "rejected" || status === "accepted"
            }
            onClick={() => {
              setStatus("rejected");
              setError("");
            }}
          >
            Reject suggestions
          </Button>
          {viewCalendar &&
            plan &&
            state.acceptedSuggestionIds.some((id) =>
              id.startsWith(`${plan.id}:`),
            ) && (
              <Button
                type="button"
                disabled={busy}
                onClick={() =>
                  viewCalendar(
                    dayKey(
                      plan.activities.find(
                        (a) => a.category === "study" && isAccepted(a.id),
                      )!.start,
                      tz,
                    ),
                  )
                }
              >
                View calendar
              </Button>
            )}
          <Button
            type="button"
            variant="primary"
            icon={Check}
            disabled={
              busy ||
              status === "rejected" ||
              !pending.some((a) => a.category === "study")
            }
            onClick={() => void accept()}
          >
            Accept plan
          </Button>
        </div>
      </div>
    </Modal>
  );
}
