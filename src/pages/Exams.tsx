import { useState } from "react";
import { CalendarDays, Check, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { at, countdown, prettyDay } from "../time";
import { Button, Empty, IconButton, PageHeading, Progress } from "../ui";
import type { Editor } from "../editors";

export default function Exams({
  now,
  open,
}: {
  now: Date;
  open: (editor: Editor) => void;
}) {
  const { state, update, toast } = useStore(),
    [filter, setFilter] = useState("upcoming"),
    tz = state.settings.timezone;
  const exams = [...state.exams]
    .filter(
      (e) =>
        filter === "all" ||
        (filter === "upcoming"
          ? !e.completed && Date.parse(at(e.date, e.time, tz)) > now.getTime()
          : e.completed || Date.parse(at(e.date, e.time, tz)) <= now.getTime()),
    )
    .sort((a, b) => `${a.date}${a.time}`.localeCompare(`${b.date}${b.time}`));
  return (
    <>
      <PageHeading
        eyebrow="LOOK AHEAD, FEEL PREPARED"
        title="Your next milestones."
        text={`Exams, projects, presentations, and everything in between. Times in ${tz}.`}
      >
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => open({ type: "exam" })}
        >
          Add assessment date
        </Button>
      </PageHeading>
      <div className="page-tabs">
        {["upcoming", "past", "all"].map((v) => (
          <button
            key={v}
            className={v === filter ? "active" : ""}
            onClick={() => setFilter(v)}
          >
            {v === "upcoming"
              ? "Coming up"
              : v === "past"
                ? "Past & completed"
                : "All assessments"}
          </button>
        ))}
      </div>
      {exams.length ? (
        <div className="exam-grid">
          {exams.map((e) => {
            const subject = state.subjects.find((s) => s.id === e.subjectId),
              passed = Date.parse(at(e.date, e.time, tz)) <= now.getTime();
            return (
              <section className="card exam-card" key={e.id}>
                <div className="exam-card-top">
                  <div className="date-tile large">
                    <span>{prettyDay(e.date, { month: "short" })}</span>
                    <strong>{e.date.slice(8)}</strong>
                    <small>{prettyDay(e.date, { weekday: "short" })}</small>
                  </div>
                  <div className="exam-count">
                    <span
                      className={`tag ${e.completed ? "success" : passed ? "" : "warm"}`}
                    >
                      {e.completed ? (
                        <>
                          <Check size={12} />
                          Completed
                        </>
                      ) : (
                        countdown(at(e.date, e.time, tz), now)
                      )}
                    </span>
                    <small>
                      {e.time} · {e.duration} min
                    </small>
                  </div>
                </div>
                <span className="eyebrow" style={{ color: subject?.color }}>
                  {subject?.name}
                </span>
                <h2>{e.name}</h2>
                <div className="exam-meta">
                  <span>{e.weight}% of final grade</span>
                  <span>Difficulty {e.difficulty}/5</span>
                </div>
                <div className="preparation">
                  <div>
                    <span>Feeling prepared</span>
                    <strong>{e.preparation}%</strong>
                  </div>
                  <Progress value={e.preparation} color={subject?.color} />
                  <input
                    aria-label={`${e.name} preparation`}
                    type="range"
                    min="0"
                    max="100"
                    value={e.preparation}
                    onChange={(event) =>
                      update((s) => ({
                        ...s,
                        exams: s.exams.map((x) =>
                          x.id === e.id
                            ? { ...x, preparation: Number(event.target.value) }
                            : x,
                        ),
                      }))
                    }
                  />
                </div>
                <div className="exam-actions">
                  <Button
                    icon={Pencil}
                    onClick={() => open({ type: "exam", id: e.id })}
                  >
                    Edit details
                  </Button>
                  <IconButton
                    icon={Trash2}
                    label={`Delete ${e.name}`}
                    onClick={() => {
                      if (
                        confirm(
                          `Delete “${e.name}” from your assessments and calendar?`,
                        )
                      ) {
                        update((s) => ({
                          ...s,
                          exams: s.exams.filter((x) => x.id !== e.id),
                        }));
                        toast("Assessment date removed");
                      }
                    }}
                  />
                </div>
              </section>
            );
          })}
        </div>
      ) : (
        <section className="card">
          <Empty
            icon={CalendarDays}
            title={
              filter === "past" ? "A fresh chapter" : "Give your goals a date"
            }
            text={
              filter === "past"
                ? "Past and completed assessments will appear here."
                : "Add the exact date and time of your assessments so your study plan can look ahead."
            }
            action={filter !== "past" ? "Add an assessment date" : undefined}
            onAction={() => open({ type: "exam" })}
          />
        </section>
      )}
      {!state.subjects.length && (
        <p className="notice">
          Start by adding a subject. Each assessment date needs a linked
          subject.
        </p>
      )}
    </>
  );
}
