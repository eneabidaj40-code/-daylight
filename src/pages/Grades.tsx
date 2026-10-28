import { useState, type FormEvent } from "react";
import {
  Calculator,
  FlaskConical,
  GraduationCap,
  Pencil,
  Plus,
  Target,
  Trash2,
} from "lucide-react";
import { useStore } from "../store";
import { calculateGrade, gradeBand, semesterGPA } from "../grades";
import { uid, type Subject } from "../model";
import {
  Button,
  Empty,
  Field,
  FormError,
  IconButton,
  PageHeading,
  Stat,
} from "../ui";
import type { Editor } from "../editors";

const fixed = (v: number | null, suffix = "") =>
  v === null ? "—" : `${v.toFixed(2)}${suffix}`;
export default function Grades({ open }: { open: (editor: Editor) => void }) {
  const { state } = useStore(),
    [selected, setSelected] = useState(state.subjects[0]?.id ?? ""),
    [tab, setTab] = useState("grades");
  const subject =
    state.subjects.find((s) => s.id === selected) ?? state.subjects[0];
  return (
    <>
      <PageHeading
        eyebrow="KNOW WHERE YOU STAND"
        title="Clarity, down to the decimal."
        text="Understand your grades, explore possibilities, and aim with confidence."
      >
        <Button
          icon={Plus}
          onClick={() =>
            subject
              ? open({ type: "assessment", subjectId: subject.id })
              : open({ type: "subject" })
          }
        >
          {subject ? "Add component" : "Add subject"}
        </Button>
      </PageHeading>
      <div className="page-tabs">
        <button
          className={tab === "grades" ? "active" : ""}
          onClick={() => setTab("grades")}
        >
          <Calculator size={16} />
          Grades & what-if
        </button>
        <button
          className={tab === "gpa" ? "active" : ""}
          onClick={() => setTab("gpa")}
        >
          <GraduationCap size={16} />
          GPA calculator
        </button>
      </div>
      {tab === "gpa" ? (
        <GPACalculator />
      ) : subject ? (
        <>
          <div className="subject-picker">
            <label htmlFor="grade-subject">YOUR SUBJECT</label>
            <select
              id="grade-subject"
              value={subject.id}
              onChange={(e) => setSelected(e.target.value)}
            >
              {state.subjects.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.name}
                </option>
              ))}
            </select>
          </div>
          <SubjectGrades key={subject.id} subject={subject} open={open} />
        </>
      ) : (
        <section className="card">
          <Empty
            icon={GraduationCap}
            title="Give your goals some numbers"
            text="Start with a subject, then add its custom grading components."
            action="Add a subject"
            onAction={() => open({ type: "subject" })}
          />
        </section>
      )}
    </>
  );
}
function SubjectGrades({
  subject,
  open,
}: {
  subject: Subject;
  open: (editor: Editor) => void;
}) {
  const { state, update, toast } = useStore(),
    [scenario, setScenario] = useState<Record<string, number>>({});
  const grade = calculateGrade(subject.assessments, subject.target),
    simulated = calculateGrade(subject.assessments, subject.target, scenario),
    pending = subject.assessments.filter((a) => !a.completed);
  const projected =
    simulated.earned + (simulated.remaining * subject.target) / 100;
  const status = !grade.valid
    ? "Complete your assessment weights to calculate a reliable target."
    : grade.secured
      ? "Your target is already secured, even with zero on the rest."
      : !grade.achievable
        ? `Your ${subject.target} target is mathematically out of reach. The maximum is ${grade.maximum.toFixed(2)}.`
        : grade.remaining === 0
          ? "Every assessment is graded. This is your final result."
          : `You need an average of ${grade.required!.toFixed(2)}% on the remaining ${grade.remaining}% weight to reach ${subject.target}.`;
  return (
    <>
      <div
        className={`notice ${!grade.valid || !grade.achievable ? "warning" : "success"}`}
      >
        <Target size={19} />
        <div>
          <strong>
            Target: {subject.target}/100 ·{" "}
            {gradeBand(subject.target, state.settings.gradeScale).letter}
          </strong>
          <p>{status}</p>
          {!grade.valid && (
            <p>
              Component weights total {grade.totalWeight.toFixed(2)}%. Add or
              edit them until they total 100%.
            </p>
          )}
        </div>
      </div>
      <div className="stats-grid">
        <Stat
          label="Weighted points earned"
          value={fixed(grade.earned)}
          note={`Of 100 final points · ${grade.completedWeight}% graded`}
          icon={Calculator}
        />
        <Stat
          label="Completed assessment average"
          value={fixed(grade.completedAverage, "%")}
          note="Normalized over graded weight only"
          icon={GraduationCap}
        />
        <Stat
          label="Required remaining average"
          value={
            grade.valid
              ? grade.secured
                ? "Secured"
                : fixed(grade.required, "%")
              : "—"
          }
          note={`${grade.remaining}% assessment weight remains`}
          icon={Target}
        />
        <Stat
          label="Maximum final grade"
          value={grade.valid ? fixed(grade.maximum) : "—"}
          note="If every remaining score is full marks"
          icon={FlaskConical}
        />
      </div>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Every component counts</h2>
            <p>Your actual scores · {subject.credits} course credits</p>
          </div>
          <Button
            icon={Plus}
            onClick={() => open({ type: "assessment", subjectId: subject.id })}
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
                  <th>Points earned</th>
                  <th>Status</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {subject.assessments.map((a) => (
                  <tr key={a.id}>
                    <td>
                      <strong>{a.name}</strong>
                    </td>
                    <td>{a.weight}%</td>
                    <td>
                      {a.completed ? a.score : "—"} / {a.maxScore}
                    </td>
                    <td>
                      {a.completed
                        ? ((a.score / a.maxScore) * a.weight).toFixed(2)
                        : "—"}
                    </td>
                    <td>
                      <span className={`tag ${a.completed ? "success" : ""}`}>
                        {a.completed ? "Graded" : "Pending"}
                      </span>
                    </td>
                    <td>
                      <div className="row-actions">
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
                        <IconButton
                          icon={Trash2}
                          label={`Delete ${a.name}`}
                          onClick={() => {
                            if (
                              !confirm(
                                `Delete “${a.name}” and unlink its exam dates?`,
                              )
                            )
                              return;
                            update((s) => ({
                              ...s,
                              subjects: s.subjects.map((x) =>
                                x.id === subject.id
                                  ? {
                                      ...x,
                                      assessments: x.assessments.filter(
                                        (v) => v.id !== a.id,
                                      ),
                                    }
                                  : x,
                              ),
                              exams: s.exams.map((e) =>
                                e.componentId === a.id
                                  ? { ...e, componentId: undefined }
                                  : e,
                              ),
                            }));
                            setScenario((prev) => {
                              const next = { ...prev };
                              delete next[a.id];
                              return next;
                            });
                            toast("Component removed");
                          }}
                        />
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot>
                <tr>
                  <td>Total</td>
                  <td className={!grade.valid ? "negative" : "positive"}>
                    {grade.totalWeight}%
                  </td>
                  <td />
                  <td>{grade.earned.toFixed(2)} points</td>
                  <td />
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>
        ) : (
          <Empty
            icon={Calculator}
            title="Build your grading structure"
            text="Use any component names, maximum scores, and weights from your syllabus."
          />
        )}
      </section>
      <section className="card spaced simulator">
        <div className="card-heading">
          <div>
            <span className="eyebrow">A SAFE SPACE FOR POSSIBILITIES</span>
            <h2>What if…?</h2>
            <p>Experiment here. Your actual grades stay as they are.</p>
          </div>
          <Button onClick={() => setScenario({})}>Reset scenarios</Button>
        </div>
        {pending.length ? (
          <div className="simulator-grid">
            <div className="simulator-inputs">
              {pending.map((a) => {
                const enabled = scenario[a.id] !== undefined;
                return (
                  <div className="scenario-row" key={a.id}>
                    <label className="check-field">
                      <input
                        type="checkbox"
                        checked={enabled}
                        onChange={(e) =>
                          setScenario((prev) => {
                            const next = { ...prev };
                            if (e.target.checked) next[a.id] = a.maxScore * 0.9;
                            else delete next[a.id];
                            return next;
                          })
                        }
                      />
                      <strong>{a.name}</strong>
                      <span className="muted">{a.weight}%</span>
                    </label>
                    <div className="slider-row">
                      <input
                        aria-label={`Simulated ${a.name} score`}
                        type="range"
                        min="0"
                        max={a.maxScore}
                        step="0.1"
                        value={scenario[a.id] ?? a.maxScore * 0.9}
                        disabled={!enabled}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            [a.id]: Number(e.target.value),
                          })
                        }
                      />
                      <input
                        aria-label={`Simulated ${a.name} numeric score`}
                        type="number"
                        min="0"
                        max={a.maxScore}
                        step="0.1"
                        value={Number(
                          (scenario[a.id] ?? a.maxScore * 0.9).toFixed(1),
                        )}
                        disabled={!enabled}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            [a.id]: Math.min(
                              a.maxScore,
                              Math.max(0, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                      <span>/ {a.maxScore}</span>
                    </div>
                  </div>
                );
              })}
            </div>
            <div className="scenario-result">
              <FlaskConical size={23} />
              <span className="eyebrow">PROJECTED FINAL</span>
              <strong>
                {grade.valid ? projected.toFixed(2) : "—"}
                <small>/ 100</small>
              </strong>
              <p>
                {simulated.remaining > 0
                  ? `Unspecified ${simulated.remaining}% weight assumes your ${subject.target}% target pace.`
                  : "All remaining scores are specified."}
              </p>
              <hr />
              <span>Required on unspecified assessments</span>
              <b>
                {grade.valid
                  ? simulated.secured
                    ? "Target secured"
                    : simulated.required === null
                      ? simulated.achievable
                        ? "Target achieved"
                        : "Target missed"
                      : `${simulated.required.toFixed(2)}% average`
                  : "Fix weights first"}
              </b>
              {grade.valid &&
                simulated.required !== null &&
                simulated.required > 100 && (
                  <small className="negative">
                    This scenario makes your target impossible.
                  </small>
                )}
            </div>
          </div>
        ) : (
          <div className="small-empty">
            <p>Add an ungraded component to explore different outcomes.</p>
          </div>
        )}
      </section>
    </>
  );
}
function GPACalculator() {
  const { state, update, toast } = useStore(),
    [scenario, setScenario] = useState<Record<string, number>>({}),
    [error, setError] = useState("");
  const scale = state.settings.gradeScale,
    current = semesterGPA(state.subjects, scale),
    projected = semesterGPA(state.subjects, scale, true, scenario);
  const priorCredits = state.previousSemesters.reduce(
      (n, s) => n + s.credits,
      0,
    ),
    priorPoints = state.previousSemesters.reduce(
      (n, s) => n + s.gpa * s.credits,
      0,
    );
  const cumulative =
    priorCredits + current.credits
      ? (priorPoints + current.points) / (priorCredits + current.credits)
      : null;
  const projectedCumulative =
    priorCredits + projected.credits
      ? (priorPoints + projected.points) / (priorCredits + projected.credits)
      : null;
  const savePrior = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      name = String(f.get("name")).trim(),
      credits = Number(f.get("credits")),
      gpa = Number(f.get("gpa"));
    if (
      !name ||
      credits <= 0 ||
      !Number.isFinite(gpa) ||
      gpa < 0 ||
      gpa > Math.max(...scale.map((g) => g.points))
    ) {
      setError(
        "Enter a name, positive earned credits, and a GPA within your configured scale.",
      );
      return;
    }
    update((s) => ({
      ...s,
      previousSemesters: [
        ...s.previousSemesters,
        { id: uid(), name, credits, gpa },
      ],
    }));
    e.currentTarget.reset();
    setError("");
    toast("Previous semester added");
  };
  return (
    <>
      <div className="stats-grid">
        <Stat
          label="Current semester pace GPA"
          value={fixed(current.gpa)}
          note={`${current.credits} credits with valid graded components`}
          icon={GraduationCap}
        />
        <Stat
          label="Cumulative pace GPA"
          value={fixed(cumulative)}
          note={`${priorCredits + current.credits} credits · includes prior semesters`}
          icon={Calculator}
        />
        <Stat
          label="Projected semester GPA"
          value={fixed(projected.gpa)}
          note="Based on targets or your scenarios"
          icon={Target}
        />
        <Stat
          label="Projected cumulative GPA"
          value={fixed(projectedCumulative)}
          note={`${priorCredits + projected.credits} credits · credit weighted`}
          icon={FlaskConical}
        />
      </div>
      <p className="notice">
        Current pace uses the average of completed components for subjects whose
        weights total 100%. It is provisional until all components are graded.
        Projections use target grades or the scenario scores below. Adjust
        letter boundaries and points in Settings.
      </p>
      <section className="card">
        <div className="card-heading">
          <div>
            <h2>Your semester, weighted fairly</h2>
            <p>Each course contributes in proportion to its credits</p>
          </div>
          <Button onClick={() => setScenario({})}>Reset scenarios</Button>
        </div>
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Subject</th>
                <th>Credits</th>
                <th>Current pace</th>
                <th>Scenario final / 100</th>
                <th>Letter</th>
                <th>Grade points</th>
              </tr>
            </thead>
            <tbody>
              {state.subjects.map((s) => {
                const g = calculateGrade(s.assessments, s.target),
                  score = scenario[s.id] ?? s.target,
                  band = gradeBand(score, scale);
                return (
                  <tr key={s.id}>
                    <td>
                      <strong>{s.name}</strong>
                    </td>
                    <td>{s.credits}</td>
                    <td>{g.valid ? fixed(g.completedAverage) : "—"}</td>
                    <td>
                      <input
                        className="inline-number"
                        aria-label={`${s.name} GPA scenario final`}
                        type="number"
                        min="0"
                        max="100"
                        step="0.1"
                        value={score}
                        onChange={(e) =>
                          setScenario({
                            ...scenario,
                            [s.id]: Math.min(
                              100,
                              Math.max(0, Number(e.target.value)),
                            ),
                          })
                        }
                      />
                    </td>
                    <td>{band.letter}</td>
                    <td>{band.points.toFixed(2)}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
        {!state.subjects.length && (
          <div className="small-empty">
            <p>Add subjects to calculate your semester GPA.</p>
          </div>
        )}
      </section>
      <section className="card spaced">
        <div className="card-heading">
          <div>
            <h2>The chapters before this one</h2>
            <p>
              Enter a previous semester, or combine all prior earned credits in
              one row
            </p>
          </div>
        </div>
        {state.previousSemesters.length > 0 && (
          <div className="table-wrap">
            <table>
              <thead>
                <tr>
                  <th>Semester</th>
                  <th>Earned credits</th>
                  <th>GPA</th>
                  <th />
                </tr>
              </thead>
              <tbody>
                {state.previousSemesters.map((s) => (
                  <tr key={s.id}>
                    <td>{s.name}</td>
                    <td>{s.credits}</td>
                    <td>{s.gpa.toFixed(2)}</td>
                    <td>
                      <IconButton
                        icon={Trash2}
                        label={`Remove ${s.name}`}
                        onClick={() =>
                          update((x) => ({
                            ...x,
                            previousSemesters: x.previousSemesters.filter(
                              (v) => v.id !== s.id,
                            ),
                          }))
                        }
                      />
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <form onSubmit={savePrior} className="prior-form">
          <Field label="Semester name">
            <input
              name="name"
              required
              maxLength={200}
              placeholder="e.g. Spring 2026"
            />
          </Field>
          <Field label="Earned credits">
            <input
              name="credits"
              required
              type="number"
              min="0.1"
              max="100000"
              step="0.1"
              placeholder="30"
            />
          </Field>
          <Field label="Semester GPA">
            <input
              name="gpa"
              required
              type="number"
              min="0"
              max={Math.max(...scale.map((g) => g.points))}
              step="0.01"
              placeholder="3.50"
            />
          </Field>
          <Button type="submit" icon={Plus} variant="primary">
            Add semester
          </Button>
          <FormError error={error} />
        </form>
      </section>
    </>
  );
}
