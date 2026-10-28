import { useState } from "react";
import {
  ArrowLeft,
  BookOpen,
  Check,
  ChevronRight,
  GraduationCap,
  Pencil,
  Plus,
  Search,
  Target,
  Trash2,
} from "lucide-react";
import { useStore } from "../store";
import { Button, Empty, IconButton, PageHeading, Progress, Stat } from "../ui";
import { calculateGrade } from "../grades";
import { prettyDay } from "../time";
import type { Editor } from "../editors";

export default function Subjects({ open }: { open: (value: Editor) => void }) {
  const { state, update, toast } = useStore(),
    [selected, setSelected] = useState<string | null>(null),
    [query, setQuery] = useState("");
  const subject = state.subjects.find((s) => s.id === selected);
  const removeSubject = () => {
    if (
      !subject ||
      !confirm(
        `Delete “${subject.name}”, its topics, assessments, classes, exams, and linked activities? Export a backup first if you want to keep them.`,
      )
    )
      return;
    update((s) => ({
      ...s,
      subjects: s.subjects.filter((x) => x.id !== subject.id),
      activities: s.activities.filter((x) => x.subjectId !== subject.id),
      classes: s.classes.filter((x) => x.subjectId !== subject.id),
      exams: s.exams.filter((x) => x.subjectId !== subject.id),
    }));
    setSelected(null);
    toast("Subject and linked records removed");
  };
  if (subject) {
    const grade = calculateGrade(subject.assessments, subject.target),
      complete = subject.topics.filter((t) => t.completed).length;
    return (
      <>
        <button
          className="text-btn back-link"
          onClick={() => setSelected(null)}
        >
          <ArrowLeft size={16} />
          All subjects
        </button>
        <PageHeading
          eyebrow={`${subject.code || "YOUR SUBJECT"} · ${subject.credits} CREDITS`}
          title={subject.name}
          text="A clear path, one topic at a time."
        >
          <Button
            icon={Pencil}
            onClick={() => open({ type: "subject", id: subject.id })}
          >
            Edit subject
          </Button>
          <Button icon={Trash2} variant="danger ghost" onClick={removeSubject}>
            Delete
          </Button>
        </PageHeading>
        <div className="stats-grid three">
          <Stat
            label="Your target"
            value={`${subject.target}/100`}
            note="A direction to work toward"
            icon={Target}
          />
          <Stat
            label="Current assessment pace"
            value={
              grade.completedAverage !== null
                ? `${grade.completedAverage.toFixed(1)}%`
                : "—"
            }
            note="Average of graded components only"
            icon={GraduationCap}
          />
          <Stat
            label="Topic progress"
            value={`${complete}/${subject.topics.length}`}
            note={`${subject.topics.filter((t) => !t.completed).reduce((n, t) => n + t.hours, 0)} estimated hours remaining`}
            icon={BookOpen}
          />
        </div>
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Small steps, real understanding</h2>
              <p>Track your topics and how confident you feel</p>
            </div>
            <Button
              icon={Plus}
              onClick={() => open({ type: "topic", subjectId: subject.id })}
            >
              Add topic
            </Button>
          </div>
          {subject.topics.length ? (
            <div className="topic-list">
              {subject.topics.map((t) => (
                <div className="topic-row" key={t.id}>
                  <button
                    className={`topic-check ${t.completed ? "checked" : ""}`}
                    aria-label={`${t.completed ? "Reopen" : "Complete"} ${t.name}`}
                    onClick={() =>
                      update((s) => ({
                        ...s,
                        subjects: s.subjects.map((x) =>
                          x.id === subject.id
                            ? {
                                ...x,
                                topics: x.topics.map((v) =>
                                  v.id === t.id
                                    ? { ...v, completed: !v.completed }
                                    : v,
                                ),
                              }
                            : x,
                        ),
                      }))
                    }
                  >
                    {t.completed && <Check size={15} />}
                  </button>
                  <div className="topic-info">
                    <h3 className={t.completed ? "strike" : ""}>{t.name}</h3>
                    <p>
                      {t.hours}h estimated
                      {t.deadline ? ` · due ${prettyDay(t.deadline)}` : ""}
                    </p>
                  </div>
                  <div className="confidence">
                    <span>{t.confidence}% confident</span>
                    <Progress value={t.confidence} color={subject.color} />
                  </div>
                  <IconButton
                    icon={Pencil}
                    label={`Edit ${t.name}`}
                    onClick={() =>
                      open({ type: "topic", subjectId: subject.id, id: t.id })
                    }
                  />
                  <IconButton
                    icon={Trash2}
                    label={`Delete ${t.name}`}
                    onClick={() => {
                      update((s) => ({
                        ...s,
                        subjects: s.subjects.map((x) =>
                          x.id === subject.id
                            ? {
                                ...x,
                                topics: x.topics.filter((v) => v.id !== t.id),
                              }
                            : x,
                        ),
                      }));
                      toast("Topic removed");
                    }}
                  />
                </div>
              ))}
            </div>
          ) : (
            <Empty
              icon={BookOpen}
              title="Break it down"
              text="A few focused topics make a big subject feel smaller."
              action="Add your first topic"
              onAction={() => open({ type: "topic", subjectId: subject.id })}
            />
          )}
        </section>
        <section className="card spaced">
          <div className="card-heading">
            <div>
              <h2>Your assessment structure</h2>
              <p>
                {grade.totalWeight}% total weight
                {!grade.valid ? " · weights must total 100%" : " · balanced"}
              </p>
            </div>
            <Button
              icon={Plus}
              onClick={() =>
                open({ type: "assessment", subjectId: subject.id })
              }
            >
              Add component
            </Button>
          </div>
          {subject.assessments.length ? (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Component</th>
                    <th>Weight</th>
                    <th>Score</th>
                    <th>Status</th>
                    <th />
                  </tr>
                </thead>
                <tbody>
                  {subject.assessments.map((a) => (
                    <tr key={a.id}>
                      <td>
                        <button
                          className="table-link"
                          onClick={() =>
                            open({
                              type: "assessment",
                              subjectId: subject.id,
                              id: a.id,
                            })
                          }
                        >
                          {a.name}
                        </button>
                        {a.date && <small>{prettyDay(a.date)}</small>}
                      </td>
                      <td>{a.weight}%</td>
                      <td>
                        {a.completed
                          ? `${a.score} / ${a.maxScore}`
                          : `— / ${a.maxScore}`}
                      </td>
                      <td>
                        <span className={`tag ${a.completed ? "success" : ""}`}>
                          {a.completed ? "Graded" : "Pending"}
                        </span>
                      </td>
                      <td>
                        <IconButton
                          icon={Pencil}
                          label={`Edit ${a.name}`}
                          onClick={() =>
                            open({
                              type: "assessment",
                              subjectId: subject.id,
                              id: a.id,
                            })
                          }
                        />
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          ) : (
            <Empty
              icon={GraduationCap}
              title="Every course is different"
              text="Create custom components and weights to match your syllabus."
              action="Add a component"
              onAction={() =>
                open({ type: "assessment", subjectId: subject.id })
              }
            />
          )}
        </section>
      </>
    );
  }
  const filtered = state.subjects.filter((s) =>
    `${s.name} ${s.code}`.toLowerCase().includes(query.toLowerCase()),
  );
  return (
    <>
      <PageHeading
        eyebrow="YOUR ACADEMIC CORNER"
        title="A place for every subject."
        text="Keep your goals in sight and your next steps within reach."
      >
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => open({ type: "subject" })}
        >
          Add subject
        </Button>
      </PageHeading>
      {state.subjects.length > 0 && (
        <div className="list-toolbar">
          <div className="search-box">
            <Search size={17} />
            <input
              aria-label="Search subjects"
              placeholder="Find a subject…"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
            />
          </div>
          <span className="muted">
            {state.subjects.length} subjects ·{" "}
            {state.subjects.reduce((n, s) => n + s.credits, 0)} credits
          </span>
        </div>
      )}
      {filtered.length ? (
        <div className="subject-grid">
          {filtered.map((s) => {
            const progress = s.topics.length
              ? (s.topics.filter((t) => t.completed).length / s.topics.length) *
                100
              : 0;
            return (
              <button
                className="card subject-card"
                key={s.id}
                onClick={() => setSelected(s.id)}
              >
                <div className="subject-card-top">
                  <span
                    className="subject-icon"
                    style={{ background: `${s.color}17`, color: s.color }}
                  >
                    <BookOpen size={23} strokeWidth={1.5} />
                  </span>
                  <span className="tag">{s.credits} credits</span>
                  <ChevronRight size={18} />
                </div>
                <span className="eyebrow">{s.code || "SUBJECT"}</span>
                <h2>{s.name}</h2>
                <p>
                  Target {s.target}/100 <span>Difficulty {s.difficulty}/5</span>
                </p>
                <Progress value={progress} color={s.color} />
                <div className="subject-card-bottom">
                  <span>
                    {s.topics.filter((t) => t.completed).length} of{" "}
                    {s.topics.length} topics complete
                  </span>
                  <strong>{Math.round(progress)}%</strong>
                </div>
              </button>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty
            icon={BookOpen}
            title={query ? "No subjects found" : "Your semester starts here"}
            text={
              query
                ? "Try a different subject name or course code."
                : "Add your subjects, choose your targets, and make a plan that fits your life."
            }
            action={query ? undefined : "Add a subject"}
            onAction={() => open({ type: "subject" })}
          />
        </section>
      )}
    </>
  );
}
