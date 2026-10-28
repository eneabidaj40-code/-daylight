import {
  ArrowRight,
  BookOpen,
  CalendarDays,
  Check,
  ChevronRight,
  Clock3,
  Dumbbell,
  GraduationCap,
  Leaf,
  Plus,
  Sparkles,
  Target,
} from "lucide-react";
import { useStore } from "../store";
import { occurrences } from "../schedule";
import {
  addDays,
  at,
  clockTime,
  countdown,
  dayKey,
  duration,
  hours,
  humanDuration,
  prettyDay,
  weekStart,
} from "../time";
import { calculateGrade, semesterGPA } from "../grades";
import { Button, CardHeading, Empty, Progress, Stat } from "../ui";
import type { Editor } from "../editors";
import type { Page } from "../App";

export function SunMark({ className = "" }: { className?: string }) {
  return (
    <svg
      className={className}
      width="40"
      height="40"
      viewBox="0 0 64 64"
      fill="none"
      aria-hidden="true"
    >
      <g stroke="currentColor" strokeWidth="2.5" strokeLinecap="round">
        <path d="M10 43h44M18 36a14 14 0 0 1 28 0M32 6v8M11 16l6 6M53 16l-6 6M4 34h8M52 34h8" />
      </g>
    </svg>
  );
}
export default function Dashboard({
  now,
  open,
  navigate,
  plan,
}: {
  now: Date;
  open: (editor: Editor) => void;
  navigate: (page: Page) => void;
  plan: () => void;
}) {
  const { state } = useStore(),
    tz = state.settings.timezone,
    today = dayKey(now, tz);
  const events = occurrences(state, today, today),
    study = events.filter((a) => a.category === "study");
  const planned = study.reduce((n, a) => n + duration(a), 0),
    completed = study.reduce(
      (n, a) => n + (a.completed ? duration(a) : a.completedMinutes),
      0,
    );
  const upcoming = state.exams
    .filter(
      (e) => !e.completed && Date.parse(at(e.date, e.time, tz)) > now.getTime(),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  const start = weekStart(today),
    week = occurrences(state, start, addDays(start, 6)).filter(
      (a) => a.category === "study",
    );
  const weekPlanned = week.reduce((n, a) => n + duration(a), 0),
    weekDone = week.reduce(
      (n, a) => n + (a.completed ? duration(a) : a.completedMinutes),
      0,
    );
  const gpa = semesterGPA(state.subjects, state.settings.gradeScale, true);
  const topics = state.subjects.flatMap((s) => s.topics),
    topicDone = topics.filter((t) => t.completed).length;
  const greeting =
    Number(clockTime(now, tz).slice(0, 2)) < 12
      ? "Good morning"
      : Number(clockTime(now, tz).slice(0, 2)) < 18
        ? "Good afternoon"
        : "Good evening";
  const active = events.find(
    (a) => Date.parse(a.end) > now.getTime() && !a.completed,
  );
  return (
    <>
      <div className="page-heading dashboard-heading">
        <div>
          <div className="eyebrow">
            <span className="tiny-sun">✳</span> A LITTLE INTENTION GOES A LONG
            WAY
          </div>
          <h1>
            {greeting}
            {state.settings.name ? `, ${state.settings.name}` : ""}
            <span className="heading-dot">.</span>
          </h1>
          <p>Make room for learning. Leave room for life.</p>
        </div>
        <Button
          icon={Plus}
          onClick={() => open({ type: "activity", date: today })}
        >
          Add activity
        </Button>
      </div>
      {!state.subjects.length && (
        <div className="welcome-card">
          <div className="welcome-copy">
            <span className="tag soft">YOUR NEXT CHAPTER</span>
            <h2>
              A little structure.
              <br />A lot of possibility.
            </h2>
            <p>
              Bring your studies, routines, and goals into one calm space. Let’s
              start with what matters to you.
            </p>
            <Button
              variant="primary"
              icon={ArrowRight}
              onClick={() => open({ type: "subject" })}
            >
              Add your first subject
            </Button>
          </div>
          <div className="welcome-art" aria-hidden="true">
            <div className="orbit orbit-one" />
            <div className="orbit orbit-two" />
            <SunMark />
            <span className="art-note note-one">
              <BookOpen size={17} /> Room to learn
            </span>
            <span className="art-note note-two">
              <Leaf size={17} /> Room to grow
            </span>
            <span className="art-dot dot-one" />
            <span className="art-dot dot-two" />
          </div>
        </div>
      )}
      <div className="stats-grid">
        <Stat
          label="Today's study"
          icon={BookOpen}
          value={
            <>
              {hours(completed)}
              <small> / {hours(planned)}</small>
            </>
          }
          note={
            planned
              ? `${humanDuration(Math.max(0, planned - completed))} left on your plan`
              : "A fresh page. Make it yours."
          }
        />
        <Stat
          label="This week"
          icon={Clock3}
          value={hours(weekDone)}
          note={
            <>
              <span className="positive">
                {weekPlanned ? Math.round((weekDone / weekPlanned) * 100) : 0}%
              </span>{" "}
              of planned study completed
            </>
          }
        />
        <Stat
          label="Next assessment"
          icon={CalendarDays}
          value={
            upcoming[0]
              ? countdown(at(upcoming[0].date, upcoming[0].time, tz), now)
              : "All clear"
          }
          note={upcoming[0]?.name ?? "No upcoming assessments"}
        />
        <Stat
          label="Projected GPA"
          icon={GraduationCap}
          value={gpa.gpa === null ? "—" : gpa.gpa.toFixed(2)}
          note={
            gpa.credits
              ? `Based on targets · ${gpa.credits} credits`
              : "Add subjects to set your direction"
          }
        />
      </div>
      <div className="dashboard-columns">
        <div className="dashboard-main">
          <section className="card day-card">
            <CardHeading
              title="Your day, at a glance"
              subtitle={prettyDay(today, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
              action="Open calendar"
              onAction={() => navigate("Calendar")}
            />
            {events.length ? (
              <div className="timeline">
                {events.map((a) => (
                  <button
                    className={`timeline-item ${a.completed ? "done" : ""} ${active?.id === a.id ? "next" : ""}`}
                    key={a.id}
                    onClick={() => open({ type: "detail", activity: a })}
                  >
                    <div className="timeline-time">
                      <strong>{clockTime(a.start, tz)}</strong>
                      <span>{clockTime(a.end, tz)}</span>
                    </div>
                    <div className="timeline-rail">
                      <span style={{ background: a.color }}>
                        {a.completed && <Check size={11} />}
                      </span>
                    </div>
                    <div className="timeline-content">
                      <div>
                        <h3>{a.title}</h3>
                        <p>
                          {a.description.split("\n")[0] ||
                            `${a.fixed ? "Fixed commitment" : "Flexible activity"} · ${humanDuration(duration(a))}`}
                        </p>
                      </div>
                      <span
                        className="activity-badge"
                        style={{ color: a.color, background: `${a.color}14` }}
                      >
                        {a.completed
                          ? "Completed"
                          : active?.id === a.id
                            ? Date.parse(a.start) <= now.getTime()
                              ? "Now"
                              : "Up next"
                            : humanDuration(duration(a))}
                      </span>
                      <ChevronRight size={16} />
                    </div>
                  </button>
                ))}
              </div>
            ) : (
              <Empty
                icon={CalendarDays}
                title="A day full of possibilities"
                text="Add a class, make a little time to study, or plan something just for you."
                action="Plan an activity"
                onAction={() => open({ type: "activity", date: today })}
              />
            )}
          </section>
          <section className="card">
            <CardHeading
              title="A little progress, every day"
              subtitle="Your completed study this week"
              action="Statistics"
              onAction={() => navigate("Statistics")}
            />
            <div className="week-chart">
              {Array.from({ length: 7 }, (_, i) => {
                const date = addDays(start, i),
                  items = week.filter((a) => dayKey(a.start, tz) === date),
                  p = items.reduce((n, a) => n + duration(a), 0),
                  c = items.reduce(
                    (n, a) =>
                      n + (a.completed ? duration(a) : a.completedMinutes),
                    0,
                  ),
                  maximum = Math.max(
                    60,
                    ...Array.from({ length: 7 }, (_, d) =>
                      week
                        .filter(
                          (a) => dayKey(a.start, tz) === addDays(start, d),
                        )
                        .reduce((n, a) => n + duration(a), 0),
                    ),
                  );
                return (
                  <div
                    className={`week-bar ${date === today ? "today" : ""}`}
                    key={date}
                  >
                    <span className="bar-value">{hours(c)}</span>
                    <div className="bar-track">
                      <div
                        className="bar-planned"
                        style={{
                          height: `${Math.max(3, (p / maximum) * 100)}%`,
                        }}
                      >
                        <span style={{ height: `${p ? (c / p) * 100 : 0}%` }} />
                      </div>
                    </div>
                    <span>
                      {prettyDay(date, { weekday: "short" }).slice(0, 3)}
                    </span>
                  </div>
                );
              })}
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
          </section>
        </div>
        <aside className="dashboard-aside">
          <section className="focus-card">
            <div className="focus-icon">
              <Sparkles size={21} strokeWidth={1.4} />
            </div>
            <span className="eyebrow">A PLAN THAT GETS YOU</span>
            <h2>
              Find your
              <br />
              focus for the week.
            </h2>
            <p>
              Your classes, deadlines, energy, and goals. Thoughtfully brought
              together.
            </p>
            <Button onClick={plan} icon={ArrowRight}>
              Suggest a study plan
            </Button>
            <small>Always a suggestion. Always your choice.</small>
          </section>
          <section className="card">
            <CardHeading
              title="On the horizon"
              action="All exams"
              onAction={() => navigate("Exams")}
            />
            {upcoming.length ? (
              <div className="horizon-list">
                {upcoming.slice(0, 3).map((e) => {
                  const sub = state.subjects.find((s) => s.id === e.subjectId);
                  return (
                    <button
                      key={e.id}
                      className="horizon-item"
                      onClick={() => open({ type: "exam", id: e.id })}
                    >
                      <div className="date-tile">
                        <span>{prettyDay(e.date, { month: "short" })}</span>
                        <strong>{e.date.slice(8)}</strong>
                      </div>
                      <div>
                        <h3>{e.name}</h3>
                        <p>{sub?.code || sub?.name}</p>
                        <span className="countdown">
                          {countdown(at(e.date, e.time, tz), now)} to prepare
                        </span>
                      </div>
                    </button>
                  );
                })}
              </div>
            ) : (
              <div className="small-empty">
                <CalendarDays size={23} />
                <p>
                  Nothing looming.
                  <br />
                  Add your dates when you’re ready.
                </p>
                <button
                  className="text-btn"
                  onClick={() =>
                    state.subjects.length
                      ? open({ type: "exam" })
                      : open({ type: "subject" })
                  }
                >
                  Add an assessment
                  <Plus size={14} />
                </button>
              </div>
            )}
          </section>
          <section className="card progress-card">
            <div>
              <span className="eyebrow">ONE STEP AT A TIME</span>
              <h3>
                {topics.length
                  ? `${topicDone} of ${topics.length} topics explored`
                  : "Big goals. Small steps."}
              </h3>
              <p>
                {topics.length
                  ? "Keep showing up. It adds up."
                  : "Break each subject into manageable topics."}
              </p>
            </div>
            <div
              className="progress-ring"
              style={
                {
                  "--progress": `${topics.length ? (topicDone / topics.length) * 100 : 0}%`,
                } as React.CSSProperties
              }
            >
              <Target size={21} />
            </div>
          </section>
        </aside>
      </div>
      {state.subjects.length > 0 && (
        <section className="subjects-overview">
          <CardHeading
            title="What you’re working toward"
            subtitle="A little clarity for each subject"
            action="Your subjects"
            onAction={() => navigate("Subjects")}
          />
          <div className="subject-mini-grid">
            {state.subjects.slice(0, 4).map((s) => {
              const g = calculateGrade(s.assessments, s.target),
                progress = s.topics.length
                  ? (s.topics.filter((t) => t.completed).length /
                      s.topics.length) *
                    100
                  : 0;
              return (
                <button
                  className="card subject-mini"
                  key={s.id}
                  onClick={() => navigate("Subjects")}
                >
                  <div
                    className="subject-icon"
                    style={{ color: s.color, background: `${s.color}15` }}
                  >
                    <BookOpen size={20} />
                  </div>
                  <h3>{s.name}</h3>
                  <p>
                    {s.code || `${s.credits} credits`}
                    <span>{s.target} target</span>
                  </p>
                  <Progress value={progress} color={s.color} />
                  <small>
                    {Math.round(progress)}% topics complete
                    {g.completedAverage !== null
                      ? ` · ${g.completedAverage.toFixed(0)} current pace`
                      : ""}
                  </small>
                </button>
              );
            })}
          </div>
        </section>
      )}
      {!state.subjects.length && (
        <div className="setup-strip">
          <div>
            <BookOpen size={20} />
            <span>
              <strong>01</strong> Add your subjects
            </span>
          </div>
          <div>
            <CalendarDays size={20} />
            <span>
              <strong>02</strong> Set your timetable
            </span>
          </div>
          <div>
            <Dumbbell size={20} />
            <span>
              <strong>03</strong> Make time for you
            </span>
          </div>
          <div>
            <Sparkles size={20} />
            <span>
              <strong>04</strong> Find your focus
            </span>
          </div>
        </div>
      )}
    </>
  );
}
