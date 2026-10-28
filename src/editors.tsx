import { useState, type FormEvent } from "react";
import {
  Check,
  Clock3,
  LockKeyhole,
  Pencil,
  Plus,
  Trash2,
  X,
} from "lucide-react";
import {
  activitySchema,
  assessmentSchema,
  categories,
  classSchema,
  examSchema,
  labels,
  palette,
  subjectSchema,
  topicSchema,
  uid,
  workoutSchema,
  type Activity,
  type AppState,
  type Occurrence,
} from "./model";
import { useStore } from "./store";
import { Button, Field, FormError, IconButton, Modal } from "./ui";
import {
  addDays,
  at,
  clockTime,
  dayKey,
  daysBetween,
  duration,
  humanDuration,
  localInput,
  overlap,
  prettyDay,
} from "./time";
import { archiveWorkoutHistory, conflictFor, occurrences } from "./schedule";
import type { ZodType } from "zod";

export type Editor = {
  type:
    | "subject"
    | "topic"
    | "assessment"
    | "class"
    | "exam"
    | "workout"
    | "activity"
    | "detail";
  id?: string;
  subjectId?: string;
  date?: string;
  activity?: Occurrence;
};
type Props = {
  editor: Editor;
  close: () => void;
  open: (value: Editor) => void;
};
const readForm = (event: FormEvent<HTMLFormElement>) => {
  event.preventDefault();
  return new FormData(event.currentTarget);
};
const text = (f: FormData, key: string) => String(f.get(key) ?? "").trim();
const num = (f: FormData, key: string) => Number(f.get(key));
const optional = (f: FormData, key: string) => text(f, key) || undefined;
function parse<T>(
  schema: ZodType<T>,
  value: unknown,
  setError: (s: string) => void,
): T | null {
  const parsed = schema.safeParse(value);
  if (!parsed.success) {
    setError(
      parsed.error.issues
        .map(
          (i) =>
            `${i.path.join(".") ? `${i.path.join(".")}: ` : ""}${i.message}`,
        )
        .slice(0, 3)
        .join(". "),
    );
    return null;
  }
  return parsed.data;
}
const Footer = ({
  close,
  label = "Save changes",
}: {
  close: () => void;
  label?: string;
}) => (
  <footer className="form-footer">
    <Button type="button" onClick={close}>
      Cancel
    </Button>
    <Button variant="primary" icon={Check} type="submit">
      {label}
    </Button>
  </footer>
);
function SubjectSelect({
  selected,
  required = true,
}: {
  selected?: string;
  required?: boolean;
}) {
  const { state } = useStore();
  return (
    <select name="subjectId" defaultValue={selected ?? ""} required={required}>
      <option value="">{required ? "Choose a subject" : "No subject"}</option>
      {state.subjects.map((s) => (
        <option key={s.id} value={s.id}>
          {s.name}
        </option>
      ))}
    </select>
  );
}
function Difficulty({
  value = 3,
  name = "difficulty",
}: {
  value?: number;
  name?: string;
}) {
  return (
    <select name={name} defaultValue={value}>
      {[1, 2, 3, 4, 5].map((v) => (
        <option value={v} key={v}>
          {v} —{" "}
          {
            [
              "Very light",
              "Light",
              "Moderate",
              "Challenging",
              "Very challenging",
            ][v - 1]
          }
        </option>
      ))}
    </select>
  );
}
export function EntityEditor(props: Props) {
  const key = `${props.editor.type}-${props.editor.id ?? "new"}`;
  switch (props.editor.type) {
    case "subject":
      return <SubjectEditor key={key} {...props} />;
    case "topic":
      return <TopicEditor key={key} {...props} />;
    case "assessment":
      return <AssessmentEditor key={key} {...props} />;
    case "class":
      return <ClassEditor key={key} {...props} />;
    case "exam":
      return <ExamEditor key={key} {...props} />;
    case "workout":
      return <WorkoutEditor key={key} {...props} />;
    case "activity":
      return <ActivityEditor key={key} {...props} />;
    case "detail":
      return <ActivityDetail key={key} {...props} />;
  }
}
function SubjectEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const subject = state.subjects.find((s) => s.id === editor.id);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e);
    const value = parse(
      subjectSchema,
      {
        id: subject?.id ?? uid(),
        name: text(f, "name"),
        code: text(f, "code"),
        credits: num(f, "credits"),
        currentGrade: num(f, "currentGrade"),
        target: num(f, "target"),
        color: text(f, "color"),
        difficulty: num(f, "difficulty"),
        priority: num(f, "priority"),
        topics: subject?.topics ?? [],
        assessments: subject?.assessments ?? [],
      },
      setError,
    );
    if (!value) return;
    update((s) => ({
      ...s,
      subjects: subject
        ? s.subjects.map((x) => (x.id === value.id ? value : x))
        : [...s.subjects, value],
    }));
    toast(subject ? "Subject updated" : "A new subject, a fresh start.");
    close();
  };
  return (
    <Modal
      title={subject ? "Edit subject" : "Make space for a new subject"}
      subtitle="Set your direction. You can adjust everything as you go."
      close={close}
    >
      <form onSubmit={save} className="form-body">
        <Field label="Subject name">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={subject?.name}
            placeholder="e.g. Object-Oriented Programming"
          />
        </Field>
        <div className="form-grid">
          <Field label="Course code">
            <input
              name="code"
              maxLength={80}
              defaultValue={subject?.code}
              placeholder="CS 201"
            />
          </Field>
          <Field label="Course credits">
            <input
              type="number"
              name="credits"
              min="0.1"
              max="100"
              step="0.1"
              required
              defaultValue={subject?.credits ?? 6}
            />
          </Field>
          <Field
            label="Current grade estimate / 100"
            help="Used for scheduling until assessments are graded."
          >
            <input
              name="currentGrade"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={subject?.currentGrade ?? 0}
              required
            />
          </Field>
          <Field label="Target grade / 100">
            <input
              name="target"
              type="number"
              min="0"
              max="100"
              step="0.1"
              defaultValue={subject?.target ?? 90}
              required
            />
          </Field>
          <Field label="Difficulty">
            <Difficulty value={subject?.difficulty} />
          </Field>
          <Field label="Personal priority">
            <Difficulty name="priority" value={subject?.priority} />
          </Field>
        </div>
        <Field label="Subject color">
          <input
            type="color"
            name="color"
            defaultValue={subject?.color ?? "#4b886d"}
          />
        </Field>
        <FormError error={error} />
        <Footer
          close={close}
          label={subject ? "Save subject" : "Create subject"}
        />
      </form>
    </Modal>
  );
}
function TopicEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const subject = state.subjects.find((s) => s.id === editor.subjectId),
    topic = subject?.topics.find((t) => t.id === editor.id);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e);
    const value = parse(
      topicSchema,
      {
        id: topic?.id ?? uid(),
        name: text(f, "name"),
        hours: num(f, "hours"),
        confidence: num(f, "confidence"),
        completed: f.has("completed"),
        deadline: optional(f, "deadline"),
      },
      setError,
    );
    if (!value) return;
    update((s) => ({
      ...s,
      subjects: s.subjects.map((x) =>
        x.id === subject?.id
          ? {
              ...x,
              topics: topic
                ? x.topics.map((t) => (t.id === value.id ? value : t))
                : [...x.topics, value],
            }
          : x,
      ),
    }));
    toast("Topic saved");
    close();
  };
  return (
    <Modal
      title={topic ? "Edit study topic" : "One topic at a time"}
      subtitle={subject?.name}
      close={close}
    >
      <form className="form-body" onSubmit={save}>
        <Field label="Topic name">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={topic?.name}
            placeholder="e.g. Inheritance & polymorphism"
          />
        </Field>
        <div className="form-grid">
          <Field label="Estimated study hours">
            <input
              type="number"
              name="hours"
              min="0.25"
              max="1000"
              step="0.25"
              required
              defaultValue={topic?.hours ?? 2}
            />
          </Field>
          <Field label="Confidence / 100">
            <input
              type="number"
              name="confidence"
              min="0"
              max="100"
              defaultValue={topic?.confidence ?? 0}
              required
            />
          </Field>
        </div>
        <Field label="Deadline (optional)">
          <input name="deadline" type="date" defaultValue={topic?.deadline} />
        </Field>
        <label className="check-field">
          <input
            name="completed"
            type="checkbox"
            defaultChecked={topic?.completed}
          />
          I have completed this topic
        </label>
        <FormError error={error} />
        <Footer close={close} label="Save topic" />
      </form>
    </Modal>
  );
}
function AssessmentEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const subject = state.subjects.find((s) => s.id === editor.subjectId),
    item = subject?.assessments.find((a) => a.id === editor.id);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e);
    const value = parse(
      assessmentSchema,
      {
        id: item?.id ?? uid(),
        name: text(f, "name"),
        weight: num(f, "weight"),
        maxScore: num(f, "maxScore"),
        score: num(f, "score"),
        date: optional(f, "date"),
        completed: f.has("completed"),
      },
      setError,
    );
    if (!value) return;
    update((s) => ({
      ...s,
      subjects: s.subjects.map((x) =>
        x.id === subject?.id
          ? {
              ...x,
              assessments: item
                ? x.assessments.map((a) => (a.id === value.id ? value : a))
                : [...x.assessments, value],
            }
          : x,
      ),
      exams: s.exams.map((e) =>
        e.componentId === value.id ? { ...e, weight: value.weight } : e,
      ),
    }));
    toast("Assessment saved");
    close();
  };
  return (
    <Modal
      title={
        item ? "Edit assessment component" : "Your grading structure, your way"
      }
      subtitle={subject?.name}
      close={close}
    >
      <form className="form-body" onSubmit={save}>
        <Field label="Custom component name">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={item?.name}
            placeholder="e.g. Lab portfolio, presentation, final…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Weight (%)">
            <input
              name="weight"
              type="number"
              required
              min="0"
              max="100"
              step="0.01"
              defaultValue={item?.weight ?? 20}
            />
          </Field>
          <Field label="Maximum possible score">
            <input
              name="maxScore"
              type="number"
              required
              min="0.01"
              max="100000"
              step="0.01"
              defaultValue={item?.maxScore ?? 100}
            />
          </Field>
          <Field label="Achieved score">
            <input
              name="score"
              type="number"
              required
              min="0"
              step="0.01"
              defaultValue={item?.score ?? 0}
            />
          </Field>
          <Field label="Assessment date (optional)">
            <input name="date" type="date" defaultValue={item?.date} />
          </Field>
        </div>
        <label className="check-field">
          <input
            type="checkbox"
            name="completed"
            defaultChecked={item?.completed}
          />
          This assessment is graded (include the score)
        </label>
        <p className="form-hint">
          Unmarked scores are excluded from earned points. All component weights
          should total 100%.
        </p>
        <FormError error={error} />
        <Footer close={close} label="Save component" />
      </form>
    </Modal>
  );
}
function recurrenceConflict(
  candidate: AppState,
  sourceId: string,
  source: "class" | "workout",
  first: string,
  last: string,
) {
  if (daysBetween(first, last) > 1096)
    return "Please keep each recurring routine within three years.";
  const all = occurrences(candidate, first, last),
    own = all.filter((a) => a.source === source && a.sourceId === sourceId);
  for (const a of own) {
    const conflict = all.find(
      (b) =>
        a.id !== b.id &&
        (source === "workout" || b.source !== "routine") &&
        overlap(a, b),
    );
    if (conflict)
      return `This recurrence overlaps “${conflict.title}” on ${dayKey(a.start, candidate.settings.timezone)}. Adjust the day or time.`;
  }
  return "";
}
function ClassEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const item = state.classes.find((x) => x.id === editor.id),
    today = dayKey(new Date(), state.settings.timezone);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e);
    const value = parse(
      classSchema,
      {
        id: item?.id ?? uid(),
        subjectId: text(f, "subjectId"),
        weekday: num(f, "weekday"),
        startTime: text(f, "startTime"),
        endTime: text(f, "endTime"),
        room: text(f, "room"),
        professor: text(f, "professor"),
        interval: num(f, "interval"),
        startDate: text(f, "startDate"),
        endDate: text(f, "endDate"),
      },
      setError,
    );
    if (!value) return;
    const candidate = {
      ...state,
      classes: item
        ? state.classes.map((x) => (x.id === value.id ? value : x))
        : [...state.classes, value],
    };
    const conflict = recurrenceConflict(
      candidate,
      value.id,
      "class",
      value.startDate,
      value.endDate,
    );
    if (conflict) {
      setError(conflict);
      return;
    }
    update((s) => ({ ...s, classes: candidate.classes }));
    toast("University timetable updated");
    close();
  };
  return (
    <Modal
      title={item ? "Edit university class" : "Add a university class"}
      subtitle="Classes are fixed. Travel and rest are added around your timetable."
      close={close}
    >
      <form className="form-body" onSubmit={save}>
        <Field label="Subject">
          <SubjectSelect selected={item?.subjectId ?? editor.subjectId} />
        </Field>
        <div className="form-grid">
          <Field label="Day of the week">
            <WeekdaySelect value={item?.weekday} />
          </Field>
          <Field label="Repeat">
            <select name="interval" defaultValue={item?.interval ?? 1}>
              <option value="1">Every week</option>
              <option value="2">Every 2 weeks</option>
              <option value="3">Every 3 weeks</option>
              <option value="4">Every 4 weeks</option>
            </select>
          </Field>
          <Field label="Starts">
            <input
              name="startTime"
              type="time"
              required
              defaultValue={item?.startTime ?? "09:00"}
            />
          </Field>
          <Field label="Ends">
            <input
              name="endTime"
              type="time"
              required
              defaultValue={item?.endTime ?? "11:00"}
            />
          </Field>
          <Field label="Semester starts">
            <input
              name="startDate"
              type="date"
              required
              defaultValue={item?.startDate ?? today}
            />
          </Field>
          <Field label="Semester ends">
            <input
              name="endDate"
              type="date"
              required
              defaultValue={item?.endDate ?? addDays(today, 120)}
            />
          </Field>
          <Field label="Classroom (optional)">
            <input
              name="room"
              maxLength={200}
              defaultValue={item?.room}
              placeholder="B-204"
            />
          </Field>
          <Field label="Professor (optional)">
            <input
              name="professor"
              maxLength={200}
              defaultValue={item?.professor}
            />
          </Field>
        </div>
        <FormError error={error} />
        <Footer close={close} label="Save class" />
      </form>
    </Modal>
  );
}
export function WeekdaySelect({ value = 1 }: { value?: number }) {
  return (
    <select name="weekday" defaultValue={value}>
      {[
        "Monday",
        "Tuesday",
        "Wednesday",
        "Thursday",
        "Friday",
        "Saturday",
        "Sunday",
      ].map((d, i) => (
        <option value={i + 1} key={d}>
          {d}
        </option>
      ))}
    </select>
  );
}
function ExamEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const item = state.exams.find((x) => x.id === editor.id),
    [subjectId, setSubjectId] = useState(
      item?.subjectId ?? editor.subjectId ?? state.subjects[0]?.id ?? "",
    );
  const subject = state.subjects.find((s) => s.id === subjectId);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e),
      componentId = optional(f, "componentId"),
      linked = subject?.assessments.find((a) => a.id === componentId);
    const value = parse(
      examSchema,
      {
        id: item?.id ?? uid(),
        subjectId,
        componentId,
        name: text(f, "name"),
        date: text(f, "date"),
        time: text(f, "time"),
        duration: num(f, "duration"),
        weight: linked?.weight ?? num(f, "weight"),
        difficulty: num(f, "difficulty"),
        preparation: num(f, "preparation"),
        completed: f.has("completed"),
        requiresUniversityTrip: f.has("requiresUniversityTrip"),
      },
      setError,
    );
    if (!value || !subject) return;
    const start = at(value.date, value.time, state.settings.timezone),
      end = new Date(Date.parse(start) + value.duration * 60000).toISOString();
    if (
      localInput(start, state.settings.timezone) !==
      `${value.date}T${value.time}`
    ) {
      setError(
        "That exact time does not exist during a daylight-saving transition. Choose another time.",
      );
      return;
    }
    const conflict = conflictFor(
      { id: `exam:${value.id}`, start, end },
      state,
      [],
      true,
    );
    if (conflict) {
      setError(
        `This assessment overlaps “${conflict.title}”. Adjust its time or the conflicting activity.`,
      );
      return;
    }
    update((s) => ({
      ...s,
      exams: item
        ? s.exams.map((x) => (x.id === value.id ? value : x))
        : [...s.exams, value],
    }));
    toast("Assessment date saved");
    close();
  };
  return (
    <Modal
      title={item ? "Edit assessment date" : "Something to work toward"}
      subtitle={`Exact times use ${state.settings.timezone}. You can add any assessment type.`}
      close={close}
    >
      <form className="form-body" onSubmit={save}>
        <Field label="Assessment name">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={item?.name}
            placeholder="e.g. Programming midterm"
          />
        </Field>
        <Field label="Subject">
          <select
            value={subjectId}
            onChange={(e) => setSubjectId(e.target.value)}
            required
          >
            <option value="">Choose a subject</option>
            {state.subjects.map((s) => (
              <option value={s.id} key={s.id}>
                {s.name}
              </option>
            ))}
          </select>
        </Field>
        <Field
          label="Link to grading component (optional)"
          help="Linked components supply the weight automatically."
        >
          <select
            key={subjectId}
            name="componentId"
            defaultValue={
              item?.subjectId === subjectId ? (item.componentId ?? "") : ""
            }
          >
            <option value="">Standalone assessment / deadline</option>
            {subject?.assessments.map((a) => (
              <option value={a.id} key={a.id}>
                {a.name} ({a.weight}%)
              </option>
            ))}
          </select>
        </Field>
        <div className="form-grid">
          <Field label="Exact date">
            <input
              name="date"
              type="date"
              required
              defaultValue={item?.date ?? editor.date}
            />
          </Field>
          <Field label="Exact time">
            <input
              name="time"
              type="time"
              required
              defaultValue={item?.time ?? "09:00"}
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              name="duration"
              type="number"
              min="1"
              max="720"
              required
              defaultValue={item?.duration ?? 60}
            />
          </Field>
          <Field label="Weight if unlinked (%)">
            <input
              name="weight"
              type="number"
              min="0"
              max="100"
              step="0.01"
              required
              defaultValue={item?.weight ?? 0}
            />
          </Field>
          <Field label="Expected difficulty">
            <Difficulty value={item?.difficulty} />
          </Field>
          <Field label="Preparation / 100">
            <input
              name="preparation"
              type="number"
              min="0"
              max="100"
              required
              defaultValue={item?.preparation ?? 0}
            />
          </Field>
        </div>
        <label className="check-field">
          <input
            name="completed"
            type="checkbox"
            defaultChecked={item?.completed}
          />
          Assessment finished (enter its score separately in Grades)
        </label>
        <label className="check-field"><input type="checkbox" name="requiresUniversityTrip" defaultChecked={item?.requiresUniversityTrip ?? false} />This exam requires university travel, including during suspended class periods</label>
        <FormError error={error} />
        <Footer close={close} label="Save assessment date" />
      </form>
    </Modal>
  );
}
function WorkoutEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const item = state.workouts.find((x) => x.id === editor.id),
    today = dayKey(new Date(), state.settings.timezone),
    [exercises, setExercises] = useState(item?.exercises ?? []);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e);
    const value = parse(
      workoutSchema,
      {
        id: item?.id ?? uid(),
        name: text(f, "name"),
        weekday: num(f, "weekday"),
        startTime: text(f, "startTime"),
        duration: num(f, "duration"),
        flexible: f.has("flexible"),
        startDate: text(f, "startDate"),
        endDate: text(f, "endDate"),
        exercises,
      },
      setError,
    );
    if (!value) return;
    const base = item ? archiveWorkoutHistory(state, item.id) : state;
    const candidate = {
      ...base,
      workouts: item
        ? base.workouts.map((x) => (x.id === value.id ? value : x))
        : [...base.workouts, value],
    };
    const conflict = recurrenceConflict(
      candidate,
      value.id,
      "workout",
      value.startDate,
      value.endDate,
    );
    if (conflict) {
      setError(conflict);
      return;
    }
    update(() => candidate);
    toast("Workout routine saved");
    close();
  };
  return (
    <Modal
      title={
        item ? "Edit workout routine" : "A little movement goes a long way"
      }
      subtitle="Your routine repeats weekly between the dates you choose."
      close={close}
      wide
    >
      <form className="form-body" onSubmit={save}>
        <Field label="Workout name">
          <input
            name="name"
            required
            maxLength={200}
            defaultValue={item?.name}
            placeholder="e.g. Upper body"
          />
        </Field>
        <div className="form-grid">
          <Field label="Day of the week">
            <WeekdaySelect value={item?.weekday} />
          </Field>
          <Field label="Start time">
            <input
              name="startTime"
              type="time"
              required
              defaultValue={item?.startTime ?? "18:00"}
            />
          </Field>
          <Field label="Duration (minutes)">
            <input
              name="duration"
              type="number"
              required
              min="5"
              max="480"
              defaultValue={item?.duration ?? 45}
            />
          </Field>
          <Field label="Routine starts">
            <input
              name="startDate"
              type="date"
              required
              defaultValue={item?.startDate ?? today}
            />
          </Field>
          <Field label="Routine ends">
            <input
              name="endDate"
              type="date"
              required
              defaultValue={item?.endDate ?? addDays(today, 120)}
            />
          </Field>
        </div>
        <label className="check-field">
          <input
            name="flexible"
            type="checkbox"
            defaultChecked={item?.flexible ?? true}
          />
          Flexible — I can move individual sessions
        </label>
        <div className="section-label">
          <h3>Exercises</h3>
          <Button
            type="button"
            icon={Plus}
            onClick={() =>
              setExercises([
                ...exercises,
                { id: uid(), name: "", sets: 3, reps: "10" },
              ])
            }
          >
            Add exercise
          </Button>
        </div>
        <div className="exercise-list">
          {exercises.map((x, i) => (
            <div className="exercise-edit" key={x.id}>
              <Field label={`Exercise ${i + 1}`}>
                <input
                  aria-label={`Exercise ${i + 1} name`}
                  required
                  maxLength={200}
                  value={x.name}
                  onChange={(e) =>
                    setExercises(
                      exercises.map((v) =>
                        v.id === x.id ? { ...v, name: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Sets">
                <input
                  aria-label={`Exercise ${i + 1} sets`}
                  type="number"
                  min="1"
                  max="100"
                  required
                  value={x.sets}
                  onChange={(e) =>
                    setExercises(
                      exercises.map((v) =>
                        v.id === x.id
                          ? { ...v, sets: Number(e.target.value) }
                          : v,
                      ),
                    )
                  }
                />
              </Field>
              <Field label="Reps / time">
                <input
                  aria-label={`Exercise ${i + 1} repetitions`}
                  required
                  maxLength={100}
                  value={x.reps}
                  onChange={(e) =>
                    setExercises(
                      exercises.map((v) =>
                        v.id === x.id ? { ...v, reps: e.target.value } : v,
                      ),
                    )
                  }
                />
              </Field>
              <IconButton
                type="button"
                icon={X}
                label={`Remove exercise ${i + 1}`}
                onClick={() =>
                  setExercises(exercises.filter((v) => v.id !== x.id))
                }
              />
            </div>
          ))}
        </div>
        <FormError error={error} />
        <Footer close={close} label="Save workout" />
      </form>
    </Modal>
  );
}
function ActivityEditor({ editor, close }: Props) {
  const { state, update, toast } = useStore(),
    [error, setError] = useState("");
  const existing = state.activities.find((a) => a.id === editor.id),
    item = existing ?? editor.activity;
  const [category, setCategory] = useState<Activity["category"]>(
    item?.category ?? "study",
  );
  const tz = state.settings.timezone,
    day = editor.date ?? dayKey(new Date(), tz);
  const save = (e: FormEvent<HTMLFormElement>) => {
    const f = readForm(e),
      start = text(f, "start"),
      end = text(f, "end");
    const startISO = at(start.slice(0, 10), start.slice(11), tz),
      endISO = at(end.slice(0, 10), end.slice(11), tz);
    if (localInput(startISO, tz) !== start || localInput(endISO, tz) !== end) {
      setError(
        "That time does not exist during a daylight-saving transition. Choose another time.",
      );
      return;
    }
    const value = parse(
      activitySchema,
      {
        id: existing?.id ?? uid(),
        title: text(f, "title"),
        start: startISO,
        end: endISO,
        category,
        description: text(f, "description"),
        color: text(f, "color"),
        fixed: f.has("fixed"),
        completed: item?.completed ?? false,
        completedMinutes: item?.completedMinutes ?? 0,
        subjectId: optional(f, "subjectId"),
        requiresUniversityTrip: f.has("requiresUniversityTrip"),
      },
      setError,
    );
    if (!value) return;
    const conflict = conflictFor(
      value,
      state,
      item && !existing ? [item.id] : [],
    );
    if (conflict) {
      setError(
        `This overlaps “${conflict.title}”. Choose a free time or edit that commitment first.`,
      );
      return;
    }
    update((s) => ({
      ...s,
      activities: existing
        ? s.activities.map((a) => (a.id === value.id ? value : a))
        : [...s.activities, value],
      completions:
        item && !existing
          ? {
              ...s.completions,
              [item.id]: {
                completed: false,
                completedMinutes: 0,
                skipped: true,
                movedTo: value.id,
              },
            }
          : s.completions,
    }));
    toast("Activity saved to your calendar");
    close();
  };
  return (
    <Modal
      title={
        existing
          ? "Edit activity"
          : item
            ? "Move this workout session"
            : "Make room for something"
      }
      subtitle={`Times use ${tz}. ${item && !existing ? "Only this occurrence will move." : "Your confirmed commitments are protected."}`}
      close={close}
    >
      <form className="form-body" onSubmit={save}>
        <Field label="Activity title">
          <input
            name="title"
            required
            maxLength={200}
            defaultValue={item?.title}
            placeholder="What would you like to do?"
          />
        </Field>
        <div className="form-grid">
          <Field label="Category">
            <select
              value={category}
              onChange={(e) =>
                setCategory(e.target.value as Activity["category"])
              }
            >
              {categories.map((c) => (
                <option value={c} key={c}>
                  {labels[c]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Subject (optional)">
            <SubjectSelect required={false} selected={item?.subjectId} />
          </Field>
          <Field label="Start date & time">
            <input
              type="datetime-local"
              name="start"
              required
              defaultValue={item ? localInput(item.start, tz) : `${day}T16:00`}
            />
          </Field>
          <Field label="End date & time">
            <input
              type="datetime-local"
              name="end"
              required
              defaultValue={item ? localInput(item.end, tz) : `${day}T17:00`}
            />
          </Field>
        </div>
        <Field label="Description (optional)">
          <textarea
            name="description"
            maxLength={5000}
            rows={3}
            defaultValue={item?.description}
            placeholder="A small note for your future self…"
          />
        </Field>
        <div className="form-grid">
          <Field label="Activity color">
            <input
              type="color"
              key={category}
              name="color"
              defaultValue={item?.color ?? palette[category]}
            />
          </Field>
          <label className="check-field">
            <input
              type="checkbox"
              name="fixed"
              defaultChecked={item?.fixed ?? false}
            />
            Fixed commitment
          </label>
        </div>
        <p className="form-hint">
          Duration is calculated from start and end times. Flexible activities
          can be moved in the calendar.
        </p>
        <label className="check-field"><input type="checkbox" name="requiresUniversityTrip" defaultChecked={item?.requiresUniversityTrip ?? false} />This activity requires a university trip</label>
        <FormError error={error} />
        <Footer
          close={close}
          label={item && !existing ? "Confirm move" : "Save activity"}
        />
      </form>
    </Modal>
  );
}
function ActivityDetail({ editor, close, open }: Props) {
  const { state, update, toast } = useStore(),
    original = editor.activity!;
  const day = dayKey(original.start, state.settings.timezone);
  const item =
    occurrences(state, day, day).find((a) => a.id === original.id) ?? original;
  const total = duration(item),
    [actual, setActual] = useState(
      item.completed ? total : item.completedMinutes,
    );
  const subject = state.subjects.find((s) => s.id === item.subjectId),
    tz = state.settings.timezone;
  const mark = (completed: boolean) => {
    const completedMinutes = completed ? total : Math.min(actual, total);
    update((s) =>
      item.source === "activity"
        ? {
            ...s,
            activities: s.activities.map((a) =>
              a.id === item.id ? { ...a, completed, completedMinutes } : a,
            ),
          }
        : item.source === "exam"
          ? {
              ...s,
              exams: s.exams.map((e) =>
                e.id === item.sourceId ? { ...e, completed } : e,
              ),
            }
          : {
              ...s,
              completions: {
                ...s.completions,
                [item.id]: { completed, completedMinutes },
              },
            },
    );
    toast(completed ? "One more thing to feel good about." : "Progress saved");
    close();
  };
  const edit = () =>
    open(
      item.source === "activity"
        ? { type: "activity", id: item.id }
        : item.source === "class"
          ? { type: "class", id: item.sourceId }
          : item.source === "exam"
            ? { type: "exam", id: item.sourceId }
            : { type: "workout", id: item.sourceId },
    );
  const remove = () => {
    if (
      !confirm(
        item.source === "workout"
          ? "Skip this workout occurrence? Your weekly routine will stay."
          : "Delete this activity?",
      )
    )
      return;
    update((s) =>
      item.source === "activity"
        ? { ...s, activities: s.activities.filter((a) => a.id !== item.id) }
        : {
            ...s,
            completions: {
              ...s.completions,
              [item.id]: {
                completed: false,
                completedMinutes: 0,
                skipped: true,
              },
            },
          },
    );
    toast("Calendar updated");
    close();
  };
  return (
    <Modal
      title={item.title}
      subtitle={subject?.name ?? labels[item.category]}
      close={close}
    >
      <div className="form-body activity-detail">
        <span className="tag" style={{ color: item.color }}>
          <span className="dot" style={{ background: item.color }} />
          {labels[item.category]}
          {item.fixed && <LockKeyhole size={12} />}
        </span>
        <div className="detail-time">
          <Clock3 size={21} />
          <div>
            <strong>
              {prettyDay(day, {
                weekday: "long",
                month: "long",
                day: "numeric",
              })}
            </strong>
            <p>
              {clockTime(item.start, tz)} – {clockTime(item.end, tz)} ·{" "}
              {humanDuration(total)}
            </p>
          </div>
        </div>
        {item.description && (
          <p className="detail-description">{item.description}</p>
        )}
        {item.source !== "routine" && (
          <>
            <div className="detail-progress">
              <Field label={`Completed minutes (of ${total})`}>
                <input
                  type="number"
                  min="0"
                  max={total}
                  value={actual}
                  onChange={(e) =>
                    setActual(
                      Math.min(total, Math.max(0, Number(e.target.value))),
                    )
                  }
                />
              </Field>
              <Button onClick={() => mark(actual >= total)}>
                Save progress
              </Button>
            </div>
            <Button
              variant="primary full"
              icon={Check}
              onClick={() => {
                if (item.completed) {
                  setActual(0);
                  update((s) =>
                    item.source === "activity"
                      ? {
                          ...s,
                          activities: s.activities.map((a) =>
                            a.id === item.id
                              ? { ...a, completed: false, completedMinutes: 0 }
                              : a,
                          ),
                        }
                      : item.source === "exam"
                        ? {
                            ...s,
                            exams: s.exams.map((e) =>
                              e.id === item.sourceId
                                ? { ...e, completed: false }
                                : e,
                            ),
                          }
                        : {
                            ...s,
                            completions: {
                              ...s.completions,
                              [item.id]: {
                                completed: false,
                                completedMinutes: 0,
                              },
                            },
                          },
                  );
                  toast("Marked as unfinished");
                  close();
                } else mark(true);
              }}
            >
              {item.completed ? "Mark as unfinished" : "Mark as completed"}
            </Button>
          </>
        )}
        {item.source === "routine" ? (
          <p className="notice">
            This block comes from your travel, meal, or rest preferences. Adjust
            it in Settings.
          </p>
        ) : (
          <div className="detail-actions">
            <Button icon={Pencil} onClick={edit}>
              {item.source === "class" || item.source === "workout"
                ? "Edit recurring routine"
                : "Edit details"}
            </Button>
            {item.source === "workout" && !item.fixed && (
              <Button
                onClick={() => open({ type: "activity", activity: item })}
              >
                Move this session
              </Button>
            )}
            {(item.source === "activity" || item.source === "workout") && (
              <Button variant="danger ghost" icon={Trash2} onClick={remove}>
                {item.source === "workout" ? "Skip this session" : "Delete"}
              </Button>
            )}
          </div>
        )}
      </div>
    </Modal>
  );
}
