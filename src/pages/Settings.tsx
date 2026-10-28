import { useRef, useState, type FormEvent } from "react";
import {
  Bell,
  Check,
  Download,
  HardDrive,
  Leaf,
  Monitor,
  Plus,
  ShieldCheck,
  Smartphone,
  Trash2,
  Upload,
} from "lucide-react";
import {
  emptyState,
  settingsSchema,
  stateSchema,
  type AppState,
  type Settings as SettingsType,
} from "../model";
import { downloadJSON, useStore } from "../store";
import { exampleState } from "../example";
import {
  Button,
  Field,
  FormError,
  IconButton,
  Modal,
  PageHeading,
} from "../ui";
import { dayKey } from "../time";
import type { PWA } from "../hooks";

export default function Settings({ pwa }: { pwa: PWA }) {
  const { state, update, replace, toast, saveStatus } = useStore(),
    inputRef = useRef<HTMLInputElement>(null),
    [error, setError] = useState("");
  const [scale, setScale] = useState(state.settings.gradeScale),
    [formEpoch, setFormEpoch] = useState(0),
    [replacement, setReplacement] = useState<{
      state: AppState;
      kind: "import" | "example" | "reset";
    } | null>(null);
  const [permission, setPermission] = useState(
      "Notification" in window ? Notification.permission : "unsupported",
    ),
    [persisted, setPersisted] = useState<string>("");
  const backup = () => {
    downloadJSON(
      state,
      `daylight-backup-${dayKey(new Date(), state.settings.timezone)}.json`,
    );
    toast("Backup exported. Keep it somewhere safe.");
  };
  const importFile = async (file?: File) => {
    if (!file) return;
    setError("");
    if (file.size > 20 * 1024 * 1024) {
      setError("Please use a backup smaller than 20 MB.");
      return;
    }
    try {
      const parsed = stateSchema.safeParse(JSON.parse(await file.text()));
      if (!parsed.success) {
        setError(
          `This is not a valid Daylight v1 or v2 backup. ${parsed.error.issues
            .slice(0, 2)
            .map((i) => i.message)
            .join(". ")}`,
        );
        return;
      }
      setReplacement({ state: parsed.data, kind: "import" });
    } catch {
      setError("That file could not be read as JSON. No data has changed.");
    } finally {
      if (inputRef.current) inputRef.current.value = "";
    }
  };
  const save = (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const f = new FormData(e.currentTarget),
      str = (key: string) => String(f.get(key) ?? ""),
      num = (key: string) => Number(f.get(key));
    const value: SettingsType = {
      ...state.settings,
      name: str("name").trim(),
      timezone: str("timezone").trim(),
      theme: str("theme") as SettingsType["theme"],
      wakeTime: str("wakeTime"),
      bedTime: str("bedTime"),
      minSleep: num("minSleep"),
      commuteTo: num("commuteTo"),
      commuteHome: num("commuteHome"),
      restMinutes: num("restMinutes"),
      mealTime: str("mealTime"),
      mealMinutes: num("mealMinutes"),
      dailyHours: num("dailyHours"),
      maxDailyHours: num("maxDailyHours"),
      focusMinutes: num("focusMinutes"),
      breakMinutes: num("breakMinutes"),
      reminderMinutes: num("reminderMinutes"),
      weights: {
        urgency: num("urgency"),
        difficulty: num("difficulty"),
        gradeGap: num("gradeGap"),
        assessment: num("assessment"),
        workload: num("workload"),
      },
      gradeScale: scale,
    };
    const parsed = settingsSchema.safeParse(value);
    if (!parsed.success) {
      setError(
        parsed.error.issues
          .slice(0, 3)
          .map((i) => `${i.path.join(".")}: ${i.message}`)
          .join(". "),
      );
      return;
    }
    if (value.wakeTime >= value.bedTime) {
      setError(
        "For day-based planning, set a bedtime later than your wake-up time (use 23:59 for midnight).",
      );
      return;
    }
    if (
      state.previousSemesters.some(
        (s) => s.gpa > Math.max(...value.gradeScale.map((g) => g.points)),
      )
    ) {
      setError(
        "A previous semester GPA exceeds the new scale. Update that semester in Grades first.",
      );
      return;
    }
    update((s) => ({ ...s, settings: parsed.data }));
    setError("");
    toast("Preferences saved. Your next plan will use them.");
  };
  const notify = async () => {
    if (!("Notification" in window)) return;
    try {
      const status = await Notification.requestPermission();
      setPermission(status);
      update((s) => ({
        ...s,
        settings: { ...s.settings, reminders: status === "granted" },
      }));
      toast(
        status === "granted"
          ? "Reminders enabled while Daylight is running"
          : "Notification permission was not granted",
      );
    } catch {
      toast(
        "This browser cannot request notifications here. Try the installed app.",
      );
    }
  };
  return (
    <>
      <PageHeading
        eyebrow="MAKE YOURSELF AT HOME"
        title="Your life. Your preferences."
        text="A planner should work around you, not the other way around."
      />
      <div className="settings-layout">
        <div className="settings-main">
          <form onSubmit={save} id="preferences-form" key={formEpoch}>
            <section className="card settings-card">
              <div className="settings-section-heading">
                <Monitor size={20} />
                <div>
                  <h2>A space that feels like you</h2>
                  <p>The little details that make a difference</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Your name (optional)">
                  <input
                    name="name"
                    maxLength={100}
                    defaultValue={state.settings.name}
                    placeholder="What should we call you?"
                  />
                </Field>
                <Field label="Appearance">
                  <select name="theme" defaultValue={state.settings.theme}>
                    <option value="light">Light & airy</option>
                    <option value="dark">Quiet & dark</option>
                    <option value="system">Follow my device</option>
                  </select>
                </Field>
                <Field
                  label="Time zone"
                  help="IANA zone; exact exams and recurring routines follow its clock."
                >
                  <input
                    list="timezones"
                    name="timezone"
                    required
                    defaultValue={state.settings.timezone}
                  />
                  <datalist id="timezones">
                    {[
                      "Europe/Tirane",
                      "Europe/Berlin",
                      "Europe/London",
                      "America/New_York",
                      "America/Los_Angeles",
                      "Asia/Tokyo",
                      "UTC",
                    ].map((v) => (
                      <option key={v} value={v} />
                    ))}
                  </datalist>
                </Field>
              </div>
              <p className="form-hint">
                Changing the time zone preserves one-time activities as exact
                instants. Recurring routines and assessment dates keep their
                entered local clock times.
              </p>
            </section>
            <section className="card settings-card">
              <div className="settings-section-heading">
                <Leaf size={20} />
                <div>
                  <h2>A realistic rhythm</h2>
                  <p>Protect your sleep, travel, and time to recharge</p>
                </div>
              </div>
              <div className="form-grid">
                <Field label="Preferred wake-up time">
                  <input
                    name="wakeTime"
                    type="time"
                    required
                    defaultValue={state.settings.wakeTime}
                  />
                </Field>
                <Field label="Preferred bedtime">
                  <input
                    name="bedTime"
                    type="time"
                    required
                    defaultValue={state.settings.bedTime}
                  />
                </Field>
                <NumberField
                  name="minSleep"
                  label="Minimum sleep (hours)"
                  value={state.settings.minSleep}
                  min={4}
                  max={12}
                  step={0.5}
                />
                <NumberField
                  name="commuteTo"
                  label="Travel to university (min)"
                  value={state.settings.commuteTo}
                  max={240}
                />
                <NumberField
                  name="commuteHome"
                  label="Travel home (min)"
                  value={state.settings.commuteHome}
                  max={240}
                />
                <NumberField
                  name="restMinutes"
                  label="Rest after university (min)"
                  value={state.settings.restMinutes}
                  max={240}
                />
                <Field label="Daily meal time">
                  <input
                    name="mealTime"
                    type="time"
                    required
                    defaultValue={state.settings.mealTime}
                  />
                </Field>
                <NumberField
                  name="mealMinutes"
                  label="Meal break (min)"
                  value={state.settings.mealMinutes}
                  max={180}
                />
              </div>
              <p className="form-hint">
                Defaults are editable preferences, not university commitments.
                If bedtime and wake-up leave too little sleep, suggestions
                finish earlier. Overlapping personal routines are treated as one
                occupied interval.
              </p>
            </section>
            <section className="card settings-card">
              <div className="settings-section-heading">
                <ShieldCheck size={20} />
                <div>
                  <h2>How your study plan thinks</h2>
                  <p>Transparent, adjustable rules. No external AI services.</p>
                </div>
              </div>
              <div className="form-grid">
                <NumberField
                  name="dailyHours"
                  label="Normal study target (hours/day)"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={state.settings.dailyHours}
                />
                <NumberField
                  name="maxDailyHours"
                  label="Daily study ceiling (hours)"
                  min={0.5}
                  max={12}
                  step={0.5}
                  value={state.settings.maxDailyHours}
                />
                <NumberField
                  name="focusMinutes"
                  label="Focus session (min)"
                  min={15}
                  max={180}
                  value={state.settings.focusMinutes}
                />
                <NumberField
                  name="breakMinutes"
                  label="Break between sessions (min)"
                  min={5}
                  max={60}
                  value={state.settings.breakMinutes}
                />
              </div>
              <p className="form-hint">
                Recommendations rise with approaching exams and unfinished work,
                within available time and your ceiling. Confirmed activities
                stay protected. Catch-up never exceeds remaining topic workload.
              </p>
              <h3 className="form-subheading">
                Priority influence · 0 = ignore, 5 = strongest
              </h3>
              <div className="form-grid">
                {Object.entries(state.settings.weights).map(([key, value]) => (
                  <NumberField
                    key={key}
                    name={key}
                    label={
                      {
                        urgency: "Exam & topic urgency",
                        difficulty: "Subject & exam difficulty",
                        gradeGap: "Gap from target grade",
                        assessment: "Assessment weight",
                        workload: "Unfinished topic workload",
                      }[key] ?? key
                    }
                    value={value}
                    min={0}
                    max={5}
                    step={0.25}
                  />
                ))}
              </div>
              <details className="algorithm-details">
                <summary>See the priority formula</summary>
                <p>
                  Score = personal priority ÷ 3 × (0.3 + urgency influence ×
                  [exam urgency + topic urgency] + difficulty influence ×
                  average difficulty ÷ 5 + grade-gap influence × positive grade
                  gap ÷ 100 + assessment influence × nearest assessment weight ÷
                  100 + workload influence × min(2, topic minutes ÷ 600)).
                </p>
                <p>
                  Exam urgency = 3 ÷ (1 + hours until exact exam time ÷ 168) ×
                  (1 − preparation ÷ 100 × 0.8). Unfinished topics due within 7
                  days add 0.7 urgency. Allocation balances this score against
                  already allocated study time. Passed assessments are excluded.
                </p>
              </details>
            </section>
            <section className="card settings-card">
              <div className="settings-section-heading">
                <Check size={20} />
                <div>
                  <h2>Your university’s grading language</h2>
                  <p>Set exact minimum boundaries and grade points</p>
                </div>
              </div>
              <div className="scale-header">
                <span>Letter</span>
                <span>Minimum / 100</span>
                <span>Grade points</span>
                <span />
              </div>
              {scale.map((g, i) => (
                <div className="scale-row" key={i}>
                  <input
                    aria-label={`Grade ${i + 1} letter`}
                    required
                    maxLength={30}
                    value={g.letter}
                    onChange={(e) =>
                      setScale(
                        scale.map((x, j) =>
                          j === i ? { ...x, letter: e.target.value } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Grade ${i + 1} minimum`}
                    type="number"
                    min="0"
                    max="100"
                    step="0.01"
                    required
                    value={g.min}
                    onChange={(e) =>
                      setScale(
                        scale.map((x, j) =>
                          j === i ? { ...x, min: Number(e.target.value) } : x,
                        ),
                      )
                    }
                  />
                  <input
                    aria-label={`Grade ${i + 1} points`}
                    type="number"
                    min="0"
                    max="10"
                    step="0.01"
                    required
                    value={g.points}
                    onChange={(e) =>
                      setScale(
                        scale.map((x, j) =>
                          j === i
                            ? { ...x, points: Number(e.target.value) }
                            : x,
                        ),
                      )
                    }
                  />
                  <IconButton
                    type="button"
                    icon={Trash2}
                    label={`Remove grade ${g.letter}`}
                    onClick={() => setScale(scale.filter((_, j) => j !== i))}
                  />
                </div>
              ))}
              <Button
                type="button"
                icon={Plus}
                onClick={() =>
                  setScale([...scale, { letter: "", min: 0, points: 0 }])
                }
              >
                Add grade band
              </Button>
              <p className="form-hint">
                Boundaries must be unique and include 0. A score receives the
                highest boundary it meets. GPA uses course credits.
              </p>
            </section>
            <section className="card settings-card">
              <div className="settings-section-heading">
                <Bell size={20} />
                <div>
                  <h2>A gentle nudge</h2>
                  <p>Optional browser reminders while the app is running</p>
                </div>
              </div>
              <NumberField
                name="reminderMinutes"
                label="Remind me before an activity (minutes)"
                value={state.settings.reminderMinutes}
                min={0}
                max={120}
              />
              <div className="notification-actions">
                <Button
                  type="button"
                  icon={Bell}
                  onClick={notify}
                  disabled={permission === "unsupported"}
                >
                  {permission === "granted"
                    ? "Enable reminders"
                    : "Allow notifications"}
                </Button>
                {state.settings.reminders && (
                  <Button
                    type="button"
                    onClick={() => {
                      update((s) => ({
                        ...s,
                        settings: { ...s.settings, reminders: false },
                      }));
                      toast("Reminders turned off");
                    }}
                  >
                    Turn off reminders
                  </Button>
                )}
                <span className="tag">
                  {state.settings.reminders ? "On" : "Off"} · {permission}
                </span>
              </div>
              <p className="form-hint">
                Local reminders require permission and the app to be running.
                Browsers may suspend background tabs; closed-app delivery is not
                guaranteed. On iPhone, notification permission may require
                installation. No push server or external service is used.
              </p>
            </section>
            <FormError error={error} />
            <div className="settings-save">
              <Button variant="primary" icon={Check} type="submit">
                Save preferences
              </Button>
              <span>
                {saveStatus === "saved"
                  ? "All changes saved on this device"
                  : saveStatus === "saving"
                    ? "Saving…"
                    : "Save failed — export a backup"}
              </span>
            </div>
          </form>
        </div>
        <aside className="settings-aside">
          <section className="card privacy-card">
            <span className="privacy-icon">
              <ShieldCheck size={25} strokeWidth={1.5} />
            </span>
            <h2>
              Just yours.
              <br />
              Just on this device.
            </h2>
            <p>
              Personal data lives in your browser’s IndexedDB. No account, no
              paid services, no tracking.
            </p>
            <div className="notice">
              <HardDrive size={17} />
              <p>
                Devices do not sync automatically. Move a JSON backup between
                them when you need to.
              </p>
            </div>
            <p className="form-hint">
              Clearing browser data, changing browser profiles, or using private
              browsing can remove local data. Export backups regularly.
            </p>
            <Button
              onClick={async () => {
                const success = await navigator.storage
                  ?.persist?.()
                  .catch(() => false);
                setPersisted(
                  success
                    ? "Persistent storage granted."
                    : "Your browser did not grant persistent storage. Regular backups still help.",
                );
              }}
              icon={ShieldCheck}
            >
              Request durable storage
            </Button>
            {persisted && (
              <p className="form-hint" role="status">
                {persisted}
              </p>
            )}
          </section>
          <section className="card settings-data">
            <h2>A copy, just in case</h2>
            <p>Take everything with you, in one readable file.</p>
            <Button icon={Download} onClick={backup}>
              Export all data
            </Button>
            <Button icon={Upload} onClick={() => inputRef.current?.click()}>
              Import a backup
            </Button>
            <input
              hidden
              type="file"
              accept=".json,application/json"
              ref={inputRef}
              aria-label="Import backup file"
              onChange={(e) => void importFile(e.target.files?.[0])}
            />
            <FormError error={error} />
          </section>
          <section className="card install-card">
            <Smartphone size={25} strokeWidth={1.4} />
            <h2>A home on your home screen</h2>
            <p>
              On iPhone or iPad, open your HTTPS address in Safari, tap Share,
              then “Add to Home Screen”.
            </p>
            {pwa.canInstall && (
              <Button icon={Download} onClick={() => void pwa.install()}>
                Install Daylight
              </Button>
            )}
            <p className="form-hint">
              Offline use is available after the production app and assets have
              cached. Installation needs HTTPS (localhost works for desktop
              testing).
            </p>
            <span className="tag">
              {pwa.offlineReady
                ? "Ready for offline use"
                : pwa.online
                  ? "Online"
                  : "Offline"}
            </span>
            {pwa.swError && <p className="form-error">{pwa.swError}</p>}
          </section>
          <section className="card settings-data">
            <h2>Take a look around</h2>
            <p>
              Load an explicitly labeled example workspace to explore the
              features.
            </p>
            <Button
              onClick={() =>
                setReplacement({ state: exampleState(), kind: "example" })
              }
            >
              Load example workspace
            </Button>
            <button
              className="text-btn negative"
              onClick={() =>
                setReplacement({ state: emptyState(), kind: "reset" })
              }
            >
              Reset local workspace
              <Trash2 size={14} />
            </button>
          </section>
        </aside>
      </div>
      {replacement && (
        <Modal
          title={
            replacement.kind === "import"
              ? "Review your backup"
              : replacement.kind === "example"
                ? "Explore an example workspace"
                : "Start with a clean page"
          }
          subtitle="This replaces all data currently stored on this device."
          close={() => setReplacement(null)}
        >
          <div className="form-body">
            <p className="notice warning">
              Export your current workspace first if you want to keep it. Other
              devices are unaffected.
            </p>
            <div className="import-summary">
              <div>
                <strong>{replacement.state.subjects.length}</strong>
                <span>subjects</span>
              </div>
              <div>
                <strong>{replacement.state.activities.length}</strong>
                <span>activities</span>
              </div>
              <div>
                <strong>{replacement.state.exams.length}</strong>
                <span>assessments</span>
              </div>
              <div>
                <strong>{replacement.state.workouts.length}</strong>
                <span>routines</span>
              </div>
            </div>
            <Button icon={Download} onClick={backup}>
              Export current data first
            </Button>
            <div className="form-footer">
              <Button onClick={() => setReplacement(null)}>Cancel</Button>
              <Button
                variant={replacement.kind === "reset" ? "danger" : "primary"}
                onClick={() => {
                  replace(replacement.state);
                  setScale(replacement.state.settings.gradeScale);
                  setFormEpoch((value) => value + 1);
                  setReplacement(null);
                  toast("Workspace replaced and saved locally");
                }}
              >
                {replacement.kind === "reset"
                  ? "Delete all local data"
                  : "Replace workspace"}
              </Button>
            </div>
          </div>
        </Modal>
      )}
    </>
  );
}
function NumberField({
  name,
  label,
  value,
  min = 0,
  max,
  step = 1,
}: {
  name: string;
  label: string;
  value: number;
  min?: number;
  max: number;
  step?: number;
}) {
  return (
    <Field label={label}>
      <input
        name={name}
        type="number"
        required
        min={min}
        max={max}
        step={step}
        defaultValue={value}
      />
    </Field>
  );
}
