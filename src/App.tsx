import { lazy, Suspense, useEffect, useState } from "react";
import {
  BarChart3,
  BookOpen,
  CalendarDays,
  ChevronLeft,
  ChevronRight,
  CircleHelp,
  Dumbbell,
  GraduationCap,
  LayoutDashboard,
  Leaf,
  LockKeyhole,
  Menu,
  MoreHorizontal,
  Settings2,
  Sparkles,
  Sun,
  Target,
  WifiOff,
  X,
} from "lucide-react";
import { useStore } from "./store";
import { useClock, usePWA, useReminders, useTheme } from "./hooks";
import { addDays, clockTime, dayKey, prettyDay, weekday } from "./time";
import { Button, IconButton } from "./ui";
import { EntityEditor, type Editor } from "./editors";
import Planner from "./Planner";
import Dashboard, { SunMark } from "./pages/Dashboard";
import Subjects from "./pages/Subjects";
import Grades from "./pages/Grades";
import Exams from "./pages/Exams";
import Workouts from "./pages/Workouts";
import Statistics from "./pages/Statistics";
import Settings from "./pages/Settings";
import { emptyState } from "./model";

const Calendar = lazy(() => import("./pages/Calendar"));

export type Page =
  | "Dashboard"
  | "Calendar"
  | "Subjects"
  | "Grades"
  | "Exams"
  | "Workouts"
  | "Statistics"
  | "Settings";
const pages = [
  { label: "Dashboard", icon: LayoutDashboard },
  { label: "Calendar", icon: CalendarDays },
  { label: "Subjects", icon: BookOpen },
  { label: "Grades", icon: GraduationCap },
  { label: "Exams", icon: Target },
  { label: "Workouts", icon: Dumbbell },
  { label: "Statistics", icon: BarChart3 },
  { label: "Settings", icon: Settings2 },
] as const;
const pageFromHash = () =>
  pages.find((p) => p.label.toLowerCase() === location.hash.slice(1))?.label ??
  "Dashboard";

export default function App() {
  const { state, saveStatus, replace } = useStore(),
    now = useClock(),
    pwa = usePWA();
  useTheme();
  useReminders(now);
  const today = dayKey(now, state.settings.timezone),
    [page, setPage] = useState<Page>(pageFromHash),
    [drawer, setDrawer] = useState(false),
    [editor, setEditor] = useState<Editor | null>(null),
    [planning, setPlanning] = useState(false),
    [calendarDate, setCalendarDate] = useState(today);
  const navigate = (value: Page) => {
    setPage(value);
    location.hash = value.toLowerCase();
    setDrawer(false);
    window.scrollTo({ top: 0 });
  };
  const open = (value: Editor) => {
    if (
      ["class", "exam", "topic", "assessment"].includes(value.type) &&
      !state.subjects.length
    ) {
      setEditor({ type: "subject" });
      return;
    }
    setEditor(value);
  };
  useEffect(() => {
    const handler = () => {
      setPage(pageFromHash());
      setDrawer(false);
    };
    window.addEventListener("hashchange", handler);
    return () => window.removeEventListener("hashchange", handler);
  }, []);
  useEffect(() => {
    document.title = `${page} · Daylight`;
  }, [page]);
  const view =
    page === "Dashboard" ? (
      <Dashboard
        now={now}
        open={open}
        navigate={navigate}
        plan={() => setPlanning(true)}
      />
    ) : page === "Calendar" ? (
      <Calendar
        key={calendarDate}
        now={now}
        open={open}
        selectedDate={calendarDate}
      />
    ) : page === "Subjects" ? (
      <Subjects open={open} />
    ) : page === "Grades" ? (
      <Grades open={open} />
    ) : page === "Exams" ? (
      <Exams now={now} open={open} />
    ) : page === "Workouts" ? (
      <Workouts now={now} open={open} />
    ) : page === "Statistics" ? (
      <Statistics now={now} />
    ) : (
      <Settings pwa={pwa} />
    );
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById("main-content")?.focus();
        }}
      >
        Skip to content
      </a>
      {drawer && (
        <div className="drawer-shade" onClick={() => setDrawer(false)} />
      )}
      <aside
        className={`sidebar ${drawer ? "is-open" : ""}`}
        aria-label="Main navigation"
      >
        <div className="brand">
          <a
            href="#dashboard"
            className="brand-link"
            onClick={() => navigate("Dashboard")}
          >
            <SunMark />
            <span>
              daylight<span className="brand-dot">.</span>
            </span>
          </a>
          <IconButton
            icon={X}
            label="Close navigation"
            onClick={(e) => {
              e.preventDefault();
              e.stopPropagation();
              setDrawer(false);
            }}
          />
        </div>
        <span className="sidebar-label">YOUR SPACE</span>
        <nav>
          {pages.slice(0, 7).map(({ label, icon: Icon }) => (
            <a
              href={`#${label.toLowerCase()}`}
              key={label}
              className={`nav-item ${page === label ? "active" : ""}`}
              onClick={(e) => {
                e.preventDefault();
                navigate(label);
              }}
              aria-current={page === label ? "page" : undefined}
            >
              <Icon size={19} strokeWidth={1.6} />
              {label}
              {page === label && <span className="nav-active-dot" />}
            </a>
          ))}
        </nav>
        <div className="sidebar-divider" />
        <MiniMonth
          today={today}
          onSelect={(date) => {
            setCalendarDate(date);
            navigate("Calendar");
          }}
        />
        <div className="sidebar-bottom">
          <div className="local-note">
            <span>
              <Leaf size={18} strokeWidth={1.5} />
            </span>
            <div>
              <strong>
                A little more offline.
                <br />A little more present.
              </strong>
              <p>Your data stays with you.</p>
            </div>
          </div>
          <a
            href="#settings"
            className={`nav-item ${page === "Settings" ? "active" : ""}`}
            onClick={(e) => {
              e.preventDefault();
              navigate("Settings");
            }}
          >
            <Settings2 size={19} strokeWidth={1.6} />
            Settings
            <CircleHelp size={16} className="help-icon" />
          </a>
          <div className="sidebar-version">
            <span>MADE FOR YOUR EVERYDAY</span>
            <span>v1.0</span>
          </div>
        </div>
      </aside>
      <div className="workspace">
        <header className="topbar">
          <div className="breadcrumb">
            <IconButton
              icon={Menu}
              label="Open navigation"
              onClick={() => setDrawer(true)}
            />
            <span>My workspace</span>
            <ChevronRight size={13} />
            <strong>{page}</strong>
          </div>
          <div className="topbar-right">
            <span className="save-indicator">
              <span
                className={`dot ${saveStatus === "saved" ? "saved" : ""}`}
              />
              {saveStatus === "saved"
                ? "Saved on this device"
                : saveStatus === "saving"
                  ? "Saving…"
                  : "Not saved"}
            </span>
            {!pwa.online && (
              <span className="tag">
                <WifiOff size={13} />
                Offline
              </span>
            )}
            <span className="clock-pill">
              <Sun size={15} strokeWidth={1.5} />
              {prettyDay(today, { month: "short", day: "numeric" })}
              <i />
              {clockTime(now, state.settings.timezone)}
            </span>
            <button
              className="avatar"
              title="Your preferences"
              aria-label="Your preferences"
              onClick={() => navigate("Settings")}
            >
              {state.settings.name ? (
                state.settings.name.slice(0, 1).toUpperCase()
              ) : (
                <Leaf size={17} />
              )}
            </button>
          </div>
        </header>
        {state.example && (
          <div className="example-banner">
            <span>
              EXAMPLE WORKSPACE · This is sample data for exploring Daylight.
            </span>
            <button
              onClick={() => {
                if (
                  confirm(
                    "Clear the example workspace and start with an empty planner?",
                  )
                ) {
                  replace(emptyState());
                  navigate("Dashboard");
                }
              }}
            >
              Start with my own data
              <ChevronRight size={14} />
            </button>
          </div>
        )}
        {pwa.needRefresh && (
          <div className="update-banner">
            <span>A new version of Daylight is ready.</span>
            <Button
              onClick={() => {
                if (saveStatus === "saved") void pwa.refresh();
              }}
            >
              Update{saveStatus !== "saved" ? " after saving" : ""}
            </Button>
            <IconButton
              icon={X}
              label="Dismiss update"
              onClick={pwa.dismissUpdate}
            />
          </div>
        )}
        <main id="main-content" tabIndex={-1} className="main-content">
          <Suspense
            fallback={
              <div className="empty">
                <p>Opening your calendar…</p>
              </div>
            }
          >
            {view}
          </Suspense>
          <footer className="workspace-footer">
            <span>
              <SunMark /> A little structure. A lot of possibility.
            </span>
            <span>
              <LockKeyhole size={11} />
              Private by nature. Yours by design.
            </span>
          </footer>
        </main>
      </div>
      <nav className="mobile-nav" aria-label="Quick navigation">
        {pages.slice(0, 3).map(({ label, icon: Icon }) => (
          <button
            key={label}
            className={page === label ? "active" : ""}
            onClick={() => navigate(label)}
          >
            <Icon size={20} strokeWidth={1.6} />
            <span>{label}</span>
          </button>
        ))}
        <button onClick={() => setPlanning(true)}>
          <Sparkles size={20} strokeWidth={1.6} />
          <span>Plan</span>
        </button>
        <button
          className={drawer ? "active" : ""}
          onClick={() => setDrawer(true)}
        >
          <MoreHorizontal size={20} />
          <span>More</span>
        </button>
      </nav>
      {editor && (
        <EntityEditor
          editor={editor}
          close={() => setEditor(null)}
          open={open}
        />
      )}
      {planning && <Planner now={now} close={() => setPlanning(false)} />}
    </div>
  );
}
function MiniMonth({
  today,
  onSelect,
}: {
  today: string;
  onSelect: (day: string) => void;
}) {
  const [month, setMonth] = useState(today.slice(0, 7));
  const first = `${month}-01`,
    start = addDays(first, 1 - weekday(first));
  const nextMonth = new Date(`${first}T12:00:00Z`);
  nextMonth.setUTCMonth(nextMonth.getUTCMonth() + 1);
  const last = addDays(nextMonth.toISOString().slice(0, 10), -1),
    dayCount = weekday(first) - 1 + Number(last.slice(8)) > 35 ? 42 : 35;
  const shift = (n: number) => {
    const date = new Date(`${first}T12:00:00Z`);
    date.setUTCMonth(date.getUTCMonth() + n);
    setMonth(date.toISOString().slice(0, 7));
  };
  return (
    <div className="mini-month">
      <div className="mini-month-title">
        <strong>{prettyDay(first, { month: "long", year: "numeric" })}</strong>
        <div>
          <IconButton
            icon={ChevronLeft}
            label="Previous month"
            onClick={() => shift(-1)}
          />
          <IconButton
            icon={ChevronRight}
            label="Next month"
            onClick={() => shift(1)}
          />
        </div>
      </div>
      <div className="mini-month-grid">
        {["M", "T", "W", "T", "F", "S", "S"].map((d, i) => (
          <span className="weekday" key={`d${i}`}>
            {d}
          </span>
        ))}
        {Array.from({ length: dayCount }, (_, i) => {
          const date = addDays(start, i);
          return (
            <button
              className={`${date.slice(0, 7) !== month ? "other-month" : ""} ${date === today ? "today" : ""}`}
              aria-label={`Open calendar on ${date}`}
              key={date}
              onClick={() => onSelect(date)}
            >
              {Number(date.slice(8))}
            </button>
          );
        })}
      </div>
    </div>
  );
}
