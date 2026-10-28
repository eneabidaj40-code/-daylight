import { useMemo, useState } from "react";
import { BarChart3, BookOpen, Check, Dumbbell, Target } from "lucide-react";
import { useStore } from "../store";
import { calculateGrade, semesterGPA } from "../grades";
import { occurrences } from "../schedule";
import { addDays, dayKey, duration, hours, prettyDay } from "../time";
import { CardHeading, Empty, PageHeading, Progress, Stat } from "../ui";

export default function Statistics({ now }: { now: Date }) {
  const { state } = useStore(),
    today = dayKey(now, state.settings.timezone),
    [period, setPeriod] = useState(7),
    [end, setEnd] = useState(today),
    [metric, setMetric] = useState<"study" | "workout">("study");
  const first = addDays(end, 1 - period),
    events = useMemo(() => occurrences(state, first, end), [state, first, end]);
  const studies = events.filter((a) => a.category === "study"),
    workouts = events.filter((a) => a.category === "workout"),
    planned = studies.reduce((n, a) => n + duration(a), 0),
    completed = studies.reduce(
      (n, a) => n + (a.completed ? duration(a) : a.completedMinutes),
      0,
    );
  const chart = Array.from({ length: period }, (_, i) => {
    const date = addDays(first, i),
      rows = events.filter(
        (a) =>
          a.category === metric &&
          dayKey(a.start, state.settings.timezone) === date,
      );
    return {
      date,
      planned: rows.reduce((n, a) => n + duration(a), 0),
      completed: rows.reduce(
        (n, a) => n + (a.completed ? duration(a) : a.completedMinutes),
        0,
      ),
    };
  });
  const maximum = Math.max(60, ...chart.map((d) => d.planned));
  const bySubject = state.subjects
    .map((s) => {
      const rows = studies.filter((a) => a.subjectId === s.id);
      return {
        subject: s,
        planned: rows.reduce((n, a) => n + duration(a), 0),
        done: rows.reduce(
          (n, a) => n + (a.completed ? duration(a) : a.completedMinutes),
          0,
        ),
      };
    })
    .sort((a, b) => b.done - a.done);
  const gpa = semesterGPA(state.subjects, state.settings.gradeScale, true);
  return (
    <>
      <PageHeading
        eyebrow="SEE HOW FAR YOU’VE COME"
        title="Small efforts. A bigger picture."
        text="Your time, energy, and progress — thoughtfully put in perspective."
      />
      <div className="list-toolbar">
        <div className="segmented">
          <button
            className={period === 7 ? "active" : ""}
            onClick={() => setPeriod(7)}
          >
            Weekly
          </button>
          <button
            className={period === 30 ? "active" : ""}
            onClick={() => setPeriod(30)}
          >
            Monthly · 30 days
          </button>
        </div>
        <label className="inline-field">
          Period ending
          <input
            aria-label="Statistics period ending"
            type="date"
            required
            value={end}
            onChange={(e) => {
              if (e.target.value) setEnd(e.target.value);
            }}
          />
        </label>
      </div>
      <div className="stats-grid">
        <Stat
          label="Study time completed"
          value={hours(completed)}
          note={`${hours(planned)} planned this period`}
          icon={BookOpen}
        />
        <Stat
          label="Follow-through"
          value={`${planned ? Math.round((completed / planned) * 100) : 0}%`}
          note={`${hours(Math.max(0, planned - completed))} planned time unfinished`}
          icon={Check}
        />
        <Stat
          label="Workouts completed"
          value={`${workouts.filter((a) => a.completed).length}/${workouts.length}`}
          note="Sessions in this period"
          icon={Dumbbell}
        />
        <Stat
          label="Projected semester GPA"
          value={gpa.gpa?.toFixed(2) ?? "—"}
          note="Targets weighted by course credits"
          icon={Target}
        />
      </div>
      <section className="card">
        <CardHeading
          title="A rhythm of your own"
          subtitle={`${prettyDay(first)} – ${prettyDay(end)} · ${metric === "study" ? "study" : "workout"} time`}
        />
        <div className="chart-controls">
          <div className="segmented">
            <button
              className={metric === "study" ? "active" : ""}
              onClick={() => setMetric("study")}
            >
              Study
            </button>
            <button
              className={metric === "workout" ? "active" : ""}
              onClick={() => setMetric("workout")}
            >
              Workouts
            </button>
          </div>
          <div className="chart-legend">
            <span>
              <i className="legend-dot completed" />
              Completed
            </span>
            <span>
              <i className="legend-dot planned" />
              Planned
            </span>
          </div>
        </div>
        <div
          className={`analytics-chart ${period === 30 ? "monthly" : ""}`}
          role="img"
          aria-label={`Planned and completed ${metric} time from ${first} to ${end}. Details available in the data table below.`}
        >
          <div className="chart-y">
            <span>{hours(maximum)}</span>
            <span>{hours(maximum / 2)}</span>
            <span>0h</span>
          </div>
          <div className="chart-columns">
            {chart.map((d) => (
              <div
                className="analytics-column"
                key={d.date}
                title={`${d.date}: ${hours(d.completed)} completed / ${hours(d.planned)} planned`}
              >
                <div className="column-bars">
                  <div
                    className="column-planned"
                    style={{
                      height: `${Math.max(1, (d.planned / maximum) * 100)}%`,
                    }}
                  />
                  <div
                    className="column-completed"
                    style={{ height: `${(d.completed / maximum) * 100}%` }}
                  />
                </div>
                <span>
                  {period === 7
                    ? prettyDay(d.date, { weekday: "short" })
                    : d.date.slice(8)}
                </span>
              </div>
            ))}
          </div>
        </div>
        <details className="chart-data">
          <summary>View chart data</summary>
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Date</th>
                  <th>Planned</th>
                  <th>Completed</th>
                </tr>
              </thead>
              <tbody>
                {chart.map((d) => (
                  <tr key={d.date}>
                    <td>{d.date}</td>
                    <td>{hours(d.planned)}</td>
                    <td>{hours(d.completed)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </details>
      </section>
      <div className="analytics-grid">
        <section className="card">
          <CardHeading
            title="Where your focus goes"
            subtitle="Study time by subject in this period"
          />
          {bySubject.length ? (
            <div className="subject-allocation">
              {bySubject.map(({ subject: s, planned: p, done }) => (
                <div key={s.id}>
                  <div>
                    <span>
                      <i className="dot" style={{ background: s.color }} />
                      {s.name}
                    </span>
                    <strong>
                      {hours(done)}
                      <small> / {hours(p)}</small>
                    </strong>
                  </div>
                  <Progress
                    value={planned ? (done / planned) * 100 : 0}
                    color={s.color}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={BarChart3}
              title="Your story is just beginning"
              text="Study sessions linked to subjects will appear here."
            />
          )}
        </section>
        <section className="card">
          <CardHeading
            title="A little closer to your goals"
            subtitle="Current assessment pace and target"
          />
          {state.subjects.length ? (
            <div className="grade-progress-list">
              {state.subjects.map((s) => {
                const grade = calculateGrade(s.assessments, s.target);
                return (
                  <div key={s.id}>
                    <div>
                      <strong>{s.name}</strong>
                      <span>
                        {grade.completedAverage?.toFixed(1) ?? "—"} / {s.target}
                      </span>
                    </div>
                    <div className="grade-progress-track">
                      <Progress
                        value={grade.completedAverage ?? 0}
                        color={s.color}
                      />
                      <i
                        style={{ left: `${s.target}%` }}
                        title={`Target ${s.target}`}
                      />
                    </div>
                  </div>
                );
              })}
            </div>
          ) : (
            <Empty
              icon={Target}
              title="Something to aim for"
              text="Add subjects and assessment scores to track your grade progress."
            />
          )}
        </section>
      </div>
      <p className="analytics-note">
        Progress is more than hours. These trends describe your activity; they
        don’t predict or guarantee a grade. Topic confidence and assessment
        preparation are self-reported.
      </p>
    </>
  );
}
