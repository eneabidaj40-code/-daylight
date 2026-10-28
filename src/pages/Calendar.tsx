import { useRef, useState } from "react";
import FullCalendar from "@fullcalendar/react";
import dayGridPlugin from "@fullcalendar/daygrid";
import timeGridPlugin from "@fullcalendar/timegrid";
import interactionPlugin from "@fullcalendar/interaction";
import {
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  LockKeyhole,
  Plus,
  Trash2,
} from "lucide-react";
import { useStore } from "../store";
import {
  categories,
  labels,
  palette,
  uid,
  type Activity,
  type Occurrence,
} from "../model";
import { calendarWallTime, conflictFor, occurrences } from "../schedule";
import { addDays, at, clockTime, dayKey, localInput, prettyDay } from "../time";
import {
  Button,
  Empty,
  FormError,
  IconButton,
  Modal,
  PageHeading,
} from "../ui";
import type { Editor } from "../editors";

export default function Calendar({
  now,
  open,
  selectedDate,
}: {
  now: Date;
  open: (editor: Editor) => void;
  selectedDate: string;
}) {
  const { state, update, toast } = useStore(),
    tz = state.settings.timezone,
    ref = useRef<FullCalendar>(null);
  const [range, setRange] = useState({
      first: addDays(selectedDate, -7),
      last: addDays(selectedDate, 35),
    }),
    [title, setTitle] = useState(""),
    [view, setView] = useState(() =>
      matchMedia("(max-width: 767px)").matches ? "timeGridDay" : "timeGridWeek",
    ),
    [tab, setTab] = useState("calendar"),
    [hidden, setHidden] = useState<string[]>([]);
  const [move, setMove] = useState<{
      original: Occurrence;
      activity: Activity;
    } | null>(null),
    [error, setError] = useState("");
  const events = occurrences(state, range.first, range.last).filter(
    (a) => !hidden.includes(a.category),
  );
  const changeView = (v: string) => {
    setView(v);
    ref.current?.getApi().changeView(v);
  };
  const confirmMove = () => {
    if (!move) return;
    const conflict = conflictFor(move.activity, state, [move.original.id]);
    if (conflict) {
      setError(`This overlaps “${conflict.title}”. Choose a free time.`);
      return;
    }
    update((s) =>
      move.original.source === "activity"
        ? {
            ...s,
            activities: s.activities.map((a) =>
              a.id === move.original.id ? move.activity : a,
            ),
          }
        : {
            ...s,
            activities: [...s.activities, move.activity],
            completions: {
              ...s.completions,
              [move.original.id]: {
                completed: false,
                completedMinutes: 0,
                skipped: true,
                movedTo: move.activity.id,
              },
            },
          },
    );
    setMove(null);
    toast("Move confirmed");
  };
  return (
    <>
      <PageHeading
        eyebrow="YOUR TIME, WITH INTENTION"
        title="Room for what matters."
        text={`A clear view of your week. All times in ${tz}.`}
      >
        <Button icon={Plus} onClick={() => open({ type: "class" })}>
          Add class
        </Button>
        <Button
          icon={Plus}
          variant="primary"
          onClick={() => open({ type: "activity", date: selectedDate })}
        >
          Add activity
        </Button>
      </PageHeading>
      <div className="page-tabs">
        <button
          className={tab === "calendar" ? "active" : ""}
          onClick={() => setTab("calendar")}
        >
          <CalendarDays size={16} />
          Calendar
        </button>
        <button
          className={tab === "timetable" ? "active" : ""}
          onClick={() => setTab("timetable")}
        >
          <BookOpen size={16} />
          University timetable
          <span className="count">{state.classes.length}</span>
        </button>
      </div>
      {tab === "calendar" ? (
        <section className="card calendar-card">
          <div className="calendar-toolbar">
            <div className="calendar-title">
              <IconButton
                icon={ChevronLeft}
                label="Previous period"
                onClick={() => ref.current?.getApi().prev()}
              />
              <IconButton
                icon={ChevronRight}
                label="Next period"
                onClick={() => ref.current?.getApi().next()}
              />
              <h2>{title}</h2>
              <Button onClick={() => ref.current?.getApi().today()}>
                Today
              </Button>
            </div>
            <div className="segmented">
              {[
                ["timeGridDay", "Day"],
                ["timeGridWeek", "Week"],
                ["dayGridMonth", "Month"],
              ].map(([v, label]) => (
                <button
                  key={v}
                  className={view === v ? "active" : ""}
                  onClick={() => changeView(v)}
                >
                  {label}
                </button>
              ))}
            </div>
          </div>
          <div className="category-filters">
            {categories.map((c) => (
              <button
                className={hidden.includes(c) ? "off" : ""}
                onClick={() =>
                  setHidden(
                    hidden.includes(c)
                      ? hidden.filter((x) => x !== c)
                      : [...hidden, c],
                  )
                }
                key={c}
                aria-pressed={!hidden.includes(c)}
              >
                <span className="dot" style={{ background: palette[c] }} />
                {labels[c]}
              </button>
            ))}
          </div>
          <div className={`calendar-scroll ${view}`}>
            <FullCalendar
              ref={ref}
              plugins={[dayGridPlugin, timeGridPlugin, interactionPlugin]}
              initialView={view}
              initialDate={selectedDate}
              headerToolbar={false}
              firstDay={1}
              timeZone="UTC"
              now={`${calendarWallTime(now.toISOString(), tz)}:00Z`}
              nowIndicator
              allDaySlot={false}
              height="auto"
              slotMinTime={`${String(Math.min(6, Number(state.settings.wakeTime.slice(0, 2)), ...events.map((a) => (dayKey(a.start, tz) !== dayKey(a.end, tz) ? 0 : Number(clockTime(a.start, tz).slice(0, 2)))))).padStart(2, "0")}:00:00`}
              slotMaxTime="24:00:00"
              scrollTime="08:00:00"
              expandRows
              slotDuration="00:30:00"
              slotLabelInterval="01:00:00"
              slotLabelFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              eventTimeFormat={{
                hour: "2-digit",
                minute: "2-digit",
                hour12: false,
              }}
              dayHeaderFormat={{ weekday: "short", day: "numeric" }}
              navLinks
              navLinkDayClick={(date) => {
                ref.current?.getApi().changeView("timeGridDay", date);
                setView("timeGridDay");
              }}
              datesSet={(info) => {
                setRange({
                  first: info.startStr.slice(0, 10),
                  last: addDays(info.endStr.slice(0, 10), -1),
                });
                setTitle(info.view.title);
              }}
              events={events.map((a) => ({
                id: a.id,
                title: `${a.completed ? "✓ " : ""}${a.title}`,
                start: calendarWallTime(a.start, tz),
                end: calendarWallTime(a.end, tz),
                backgroundColor: `${a.color}25`,
                borderColor: a.color,
                textColor: a.color,
                editable:
                  !a.fixed &&
                  (a.source === "activity" || a.source === "workout"),
                extendedProps: { activity: a },
              }))}
              eventClick={(info) =>
                open({
                  type: "detail",
                  activity: info.event.extendedProps.activity as Occurrence,
                })
              }
              dateClick={(info) => {
                if (info.allDay) {
                  ref.current?.getApi().changeView("timeGridDay", info.dateStr);
                  setView("timeGridDay");
                } else
                  open({ type: "activity", date: info.dateStr.slice(0, 10) });
              }}
              eventDrop={(info) => {
                const original = info.event.extendedProps
                  .activity as Occurrence;
                const start = info.event.startStr.slice(0, 16),
                  end = info.event.endStr.slice(0, 16);
                info.revert();
                if (!start || !end) return;
                setError("");
                setMove({
                  original,
                  activity: {
                    ...original,
                    id: original.source === "activity" ? original.id : uid(),
                    start: at(start.slice(0, 10), start.slice(11), tz),
                    end: at(end.slice(0, 10), end.slice(11), tz),
                  },
                });
              }}
              eventResizableFromStart={false}
              eventDurationEditable={false}
            />
          </div>
          <p className="calendar-footnote">
            <LockKeyhole size={13} />
            Fixed commitments stay put. Drag a flexible activity to propose a
            move, then confirm it.
          </p>
        </section>
      ) : (
        <section className="card">
          <div className="card-heading">
            <div>
              <h2>Your university timetable</h2>
              <p>Recurring classes with protected travel and recovery time</p>
            </div>
          </div>
          {!state.classes.length ? (
            <Empty
              icon={BookOpen}
              title="Start with your fixed commitments"
              text="Add each class and its semester dates. We’ll make space around them."
              action="Add a class"
              onAction={() => open({ type: "class" })}
            />
          ) : (
            <div className="table-wrap">
              <table>
                <thead>
                  <tr>
                    <th>Subject</th>
                    <th>Day & time</th>
                    <th>Where</th>
                    <th>Semester</th>
                    <th>Repeat</th>
                    <th>
                      <span className="sr-only">Actions</span>
                    </th>
                  </tr>
                </thead>
                <tbody>
                  {[...state.classes]
                    .sort(
                      (a, b) =>
                        a.weekday - b.weekday ||
                        a.startTime.localeCompare(b.startTime),
                    )
                    .map((c) => (
                      <tr key={c.id}>
                        <td>
                          <button
                            className="table-link"
                            onClick={() => open({ type: "class", id: c.id })}
                          >
                            {
                              state.subjects.find((s) => s.id === c.subjectId)
                                ?.name
                            }
                          </button>
                          <small>{c.professor || "Professor not set"}</small>
                        </td>
                        <td>
                          {
                            ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"][
                              c.weekday - 1
                            ]
                          }
                          <small>
                            {c.startTime} – {c.endTime}
                          </small>
                        </td>
                        <td>{c.room || "—"}</td>
                        <td>
                          {prettyDay(c.startDate)}
                          <small>to {prettyDay(c.endDate)}</small>
                        </td>
                        <td>
                          {c.interval === 1
                            ? "Weekly"
                            : `Every ${c.interval} weeks`}
                        </td>
                        <td>
                          <IconButton
                            icon={Trash2}
                            label="Delete class"
                            onClick={() => {
                              if (
                                confirm(
                                  "Delete this recurring class and its future occurrences?",
                                )
                              ) {
                                update((s) => ({
                                  ...s,
                                  classes: s.classes.filter(
                                    (x) => x.id !== c.id,
                                  ),
                                }));
                                toast("Class removed");
                              }
                            }}
                          />
                        </td>
                      </tr>
                    ))}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
      {move && (
        <Modal
          title="Confirm this move"
          subtitle="Your calendar changes only when you approve."
          close={() => setMove(null)}
        >
          <div className="form-body">
            <h3>{move.original.title}</h3>
            <div className="notice">
              From {localInput(move.original.start, tz).replace("T", " ")}
              <br />
              To {localInput(move.activity.start, tz).replace("T", " ")}
            </div>
            <FormError error={error} />
            <div className="form-footer">
              <Button onClick={() => setMove(null)}>Keep original</Button>
              <Button variant="primary" onClick={confirmMove}>
                Confirm move
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
