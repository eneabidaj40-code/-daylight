# Daylight

A private study and life planner built with React, TypeScript, Vite, Tailwind CSS, FullCalendar, and IndexedDB. Scheduling runs locally with deterministic, configurable rules. There are no paid APIs, accounts, analytics, or external fonts.

## Run it

Use Node.js 22.12+ (Node 24 is supported).

```powershell
npm.cmd install
npm.cmd run dev
```

Open the Local address printed by Vite. On macOS/Linux, `npm` works in place of `npm.cmd`.

To test the installable, offline production app:

```powershell
npm.cmd test
npm.cmd run build
npm.cmd run preview
```

Open the printed localhost address while online and wait for the service worker to cache the app. Reload once so it controls the page. The development server does not register an offline service worker. Do not open the built HTML directly using a `file:` URL.

## Set up your workspace

1. Add subjects, credits, grade targets, and unfinished study topics.
2. In Calendar → University timetable, add classes, recurrence, and semester dates.
3. In Settings, adjust travel, rest, meals, sleep, study targets, and grade boundaries. Save preferences.
4. In Grades, create your own assessment components and weights. They must total 100% for target and final-grade calculations to be valid.
5. In Exams, add the exact local date/time of any assessment. Optionally link it to a grading component so its weight stays consistent.
6. Add weekly workout routines and other calendar activities. Daily meals are off until you configure a duration; if a preferred meal overlaps class/travel/recovery, it joins post-university recovery instead.
7. In Calendar → Academic calendar, add named exam periods and weekday/date return commuting rules. Recurring classes are suspended during enabled periods; the saved timetable resumes afterward. Mark an exam or activity as requiring university travel when appropriate.
8. From Dashboard or Calendar, choose **Generate Study Plan**. Review subject, date, time, duration, and reasons. Modify, regenerate, reject, accept a session (with its following break), or accept the plan. Acceptance finishes only after IndexedDB confirms the transaction.

First launch is empty. Settings offers an optional, clearly labeled example workspace. Loading it replaces the current data only after review and confirmation.

## Scheduling rules

The algorithm protects all confirmed activities, including flexible ones. It also blocks class travel, post-class rest, meals, workouts, exams, and sleep. It starts after the current device time, using the selected time zone (default `Europe/Tirane`). Daylight-saving transitions are included when reserving minimum sleep. Day-based planning supports waking and sleeping within the same local calendar day.

Priority combines the nearest future assessment's urgency, weight, and preparation; subject and exam difficulty; the gap from target; unfinished topic hours; topic deadlines; and personal priority. Settings exposes the exact formula and its weights. Scores are balanced against already allocated hours to spread attention between subjects.

Daily recommendations increase as assessments approach and unfinished work accumulates, up to the user's daily ceiling. The algorithm adds focus sessions and breaks only where they fit. It caps new allocations by remaining topic estimates (or a preparation budget for assessments without unfinished topics). Confirmed study counts toward this budget. If the full recommendation cannot fit, the plan explains the shortfall and practical alternatives.

Unfinished study from the previous seven days is recognized using recorded completed minutes and redistributed within the planning window, available time, daily ceiling, and remaining workload. Mark sessions complete or record partial minutes from activity details. Topic completion, topic confidence, and exam preparation are deliberately updated by you; elapsed time does not automatically imply understanding.

Suggestions never replace confirmed events. Acceptance checks time validity, overlaps, sleep boundaries, subject references, and the daily ceiling again. Dragging a flexible calendar event requires explicit confirmation. Moving a recurring flexible workout creates a one-time exception and leaves its weekly routine intact. Fixed events can be changed through their explicit edit forms.

## Grade calculations

Weighted earned points = Σ(score ÷ maximum score × assessment weight), for graded components only.

Completed-assessment average = earned points ÷ graded weight × 100. This is shown separately from earned final points.

Required remaining average = max(0, (target − earned points) ÷ remaining weight × 100).

Maximum achievable grade = earned points + remaining weight. A target is impossible above that maximum, and secured when earned points already meet the target. Empty/invalid weight structures are flagged. All-graded cases avoid division by zero.

For the attachment's example (90/100 at 10%, 85/100 at 30%, and an ungraded 60% final), earned points are **34.5**, the completed average is **86.25%**, and a **92.5%** final score is needed to reach 90. Maximum achievable is **94.5**.

What-if inputs never change real scores. The projected final assumes the target percentage on unspecified assessments, and explicitly labels that assumption. GPA scenarios use entered final percentages, configurable grade-point bands, and unequal course credits. Current semester/cumulative **pace GPA is provisional**: it uses the normalized average of graded components in valid grading structures. Previous-semester GPA is weighted by earned credits. Target-based projections are scenarios, not grade predictions.

## Local data and backups

The current workspace schema and IndexedDB database version are 2. Version 1 workspaces and JSON backups remain supported. The first successful migration adds empty exam-period, commute-rule and acceptance-receipt collections, enables class suspension, and keeps an untouched copy of the original v1 payload at `workspace/migration-backup-v1`. Migration and backup commit together; a failed migration leaves the original payload intact. If an older open tab blocks the upgrade, close other Daylight tabs/installed windows and retry. Do not clear browser storage. See [SCHEDULING_CHANGES.md](./SCHEDULING_CHANGES.md) for implementation and verification details.

All personal records are saved in the current browser's IndexedDB, under the current origin. Nothing is sent to a server. App code can be hosted statically; personal data remains on the device.

**Devices and browsers do not sync automatically.** Export all data from Settings as JSON, transfer that file yourself, then import it on another device. Imports validate the version, shapes, scores, dates, IDs, and linked records and show a summary before replacing the workspace. Import is replacement, not merging. Different ports, domains, browser profiles, and browsers each have a separate workspace.

Export regularly. Clearing browser storage, private browsing, or browser eviction can remove data. Settings can request persistent storage; granting it depends on the browser. A failed save remains visible with retry and export options. Keep the tab open until the save indicator confirms storage.

## iPhone / iPad installation and free hosting

For installation on an actual iPhone, the app needs an **HTTPS address reachable by that phone**. A laptop's localhost address is not reachable as the same app on a phone. No hosting account or remote deployment has been created by this project.

GitHub Pages configuration and a build/deploy workflow are ready for review. Follow [DEPLOYMENT.md](./DEPLOYMENT.md) for exact steps to create a free public repository, push the reviewed code, select **Settings → Pages → Source: GitHub Actions**, obtain the HTTPS URL, and install from Safari's **Add to Home Screen** action. The workflow builds and deploys pushes to `main`, with the repository path supplied automatically by GitHub Pages.

Review the configuration before pushing: a push to `main` starts the workflow once it exists on GitHub. Only built application code is hosted. Export your existing local workspace, then import its JSON backup inside the installed iPhone app; localhost data does not automatically migrate to the Pages origin.

Never upload JSON backups to a public repository. Updating hosted app code does not transfer or expose browser data. Keep the same HTTPS origin and path for future updates. An update banner appears when a new service worker is waiting; save your work before updating.

The app includes a standalone web manifest, standard and maskable PNG icons, an Apple touch icon, a service worker, and locally cached fonts/assets. FullCalendar supports daily, Monday–Sunday weekly, and monthly views. Phones initially open Day view; Week view remains available and scrolls horizontally within the calendar.

## Reminders

Settings can request browser notification permission from a user action. Reminders are generated locally while Daylight is running. Background tabs can be suspended, and reminders **are not guaranteed when the app is closed**. Safari/iOS support depends on the browser version and installed-app context. There is no push server, billing dependency, or background scheduling service.

## Verification

`npm.cmd test` runs focused tests covering weighted grade math, arbitrary score maximums, completed zeros, secured/impossible targets, credit-weighted GPA, safe backup validation, time zones and DST, recurrence, collision checks, workload caps, partial missed sessions, and approval-time plan validation.

`npm.cmd run build` type-checks the entire app and generates the production PWA. Browser checks should use the production preview to include service-worker caching, persistence, backup import/export, and responsive behavior. Automated browser checks are documented in [QA.md](./QA.md).
