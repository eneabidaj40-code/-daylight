import { Check, Dumbbell, Leaf, Pencil, Plus, Trash2 } from "lucide-react";
import { useStore } from "../store";
import { archiveWorkoutHistory, occurrences } from "../schedule";
import { addDays, dayKey, duration, hours, weekStart } from "../time";
import { Button, Empty, IconButton, PageHeading, Stat } from "../ui";
import type { Editor } from "../editors";

export default function Workouts({
  now,
  open,
}: {
  now: Date;
  open: (editor: Editor) => void;
}) {
  const { state, update, toast } = useStore(),
    today = dayKey(now, state.settings.timezone),
    first = weekStart(today);
  const week = occurrences(state, first, addDays(first, 6)).filter(
      (a) => a.category === "workout",
    ),
    completed = week.filter((a) => a.completed);
  return (
    <>
      <PageHeading
        eyebrow="TAKE CARE OF YOURSELF, TOO"
        title="A stronger kind of balance."
        text="A routine that makes space for movement, recovery, and you."
      >
        <Button
          variant="primary"
          icon={Plus}
          onClick={() => open({ type: "workout" })}
        >
          Add workout routine
        </Button>
      </PageHeading>
      <div className="stats-grid three">
        <Stat
          label="This week's sessions"
          value={week.length}
          note="Protected in your study schedule"
          icon={Dumbbell}
        />
        <Stat
          label="Sessions completed"
          value={`${completed.length}/${week.length}`}
          note="Every bit of movement counts"
          icon={Check}
        />
        <Stat
          label="Time in motion"
          value={hours(
            week.reduce(
              (n, a) => n + (a.completed ? duration(a) : a.completedMinutes),
              0,
            ),
          )}
          note="Completed workout time this week"
          icon={Leaf}
        />
      </div>
      {state.workouts.length ? (
        <div className="workout-grid">
          {[...state.workouts]
            .sort((a, b) => a.weekday - b.weekday)
            .map((w) => {
              const occurrence = week.find((a) => a.sourceId === w.id);
              return (
                <section className="card workout-card" key={w.id}>
                  <div className="workout-top">
                    <span className="workout-icon">
                      <Dumbbell size={24} strokeWidth={1.5} />
                    </span>
                    <span className="tag warm">
                      {
                        [
                          "Monday",
                          "Tuesday",
                          "Wednesday",
                          "Thursday",
                          "Friday",
                          "Saturday",
                          "Sunday",
                        ][w.weekday - 1]
                      }
                    </span>
                  </div>
                  <h2>{w.name}</h2>
                  <p>
                    {w.startTime} · {w.duration} minutes ·{" "}
                    {w.flexible ? "Flexible" : "Fixed"}
                  </p>
                  <div className="exercise-table">
                    {w.exercises.length ? (
                      w.exercises.map((e, i) => (
                        <div key={e.id}>
                          <span className="exercise-index">
                            {String(i + 1).padStart(2, "0")}
                          </span>
                          <strong>{e.name}</strong>
                          <span>
                            {e.sets} × {e.reps}
                          </span>
                        </div>
                      ))
                    ) : (
                      <p className="muted">
                        No exercises yet. Add your own routine.
                      </p>
                    )}
                  </div>
                  <div className="workout-actions">
                    <Button
                      icon={Pencil}
                      onClick={() => open({ type: "workout", id: w.id })}
                    >
                      Edit routine
                    </Button>
                    {occurrence && (
                      <Button
                        icon={occurrence.completed ? Check : undefined}
                        variant={occurrence.completed ? "success" : ""}
                        onClick={() =>
                          open({ type: "detail", activity: occurrence })
                        }
                      >
                        {occurrence.completed
                          ? "Completed"
                          : "This week’s session"}
                      </Button>
                    )}
                    <IconButton
                      icon={Trash2}
                      label={`Delete ${w.name}`}
                      onClick={() => {
                        if (
                          confirm(
                            `Delete the recurring “${w.name}” routine? Past sessions and individually moved sessions remain in the calendar.`,
                          )
                        ) {
                          update((s) => {
                            const archived = archiveWorkoutHistory(s, w.id);
                            return {
                              ...archived,
                              workouts: archived.workouts.filter(
                                (x) => x.id !== w.id,
                              ),
                            };
                          });
                          toast("Workout routine removed");
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
            icon={Dumbbell}
            title="Make movement part of your week"
            text="Build your own routine with exercises, sets, and reps. Your study plan will work around it."
            action="Create a workout routine"
            onAction={() => open({ type: "workout" })}
          />
        </section>
      )}
      <div className="notice">
        <Leaf size={19} />
        <p>
          Workouts stay on your calendar during busy exam weeks. Move a flexible
          session from its details or by dragging it in the calendar. Every move
          asks for your confirmation.
        </p>
      </div>
    </>
  );
}
