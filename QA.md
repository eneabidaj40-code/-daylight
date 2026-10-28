# Verification notes

Current scheduling verification (28 October 2026): **80 unit/regression tests and 8 browser tests passed**. The production PWA build and Pages-path verification passed at `/-daylight/`. Reproduction commands and current limitations are under “Scheduling regression checks” below and in [SCHEDULING_CHANGES.md](./SCHEDULING_CHANGES.md). The initial-release checks below are historical; the current build retains the repository base path.

Tested on Windows with Node 24, a production Vite build, and a Chromium-based integrated browser. Browser fixture data was kept in an isolated browser context, separate from the visible workspace.

## Initial-release automated regression coverage

Run `npm.cmd test`. All **50 tests** passed, and `npm.cmd run build` completed successfully. The suite covers:

- Correct weighted points vs completed averages, arbitrary maximum scores, graded zeros, invalid totals, all-graded assessments, secured and impossible targets, and isolated what-if calculations.
- Credit-weighted GPA, configurable inclusive grade boundaries, invalid/missing current grades, and final-score scenarios.
- Backup version/schema validation, duplicate IDs, orphaned links, impossible dates, out-of-range scores, canonical offset timestamps, invalid zones, and excess completed time.
- Weekly/biweekly class recurrence and semester boundaries, custom travel and recovery, meal/class conflict handling, past workout history preservation, adjacent events, and midnight overlaps.
- Minimum actual sleep over daylight saving, future-only sessions, fixed and flexible commitment protection, assessment urgency, passed assessments, catch-up, workload caps, insufficient capacity, deterministic allocation, and approval-time validation.

## Browser checks completed

- Created a subject through its form and confirmed it survived a full page reload from IndexedDB.
- Entered the specification's Quiz/Midterm/Final example. Cards showed **34.50 earned points**, **86.25% completed average**, **92.50% required**, and **94.50 maximum**.
- Simulated 95 on the final. The projected result became **91.50**; the actual final score remained 0 and ungraded after leaving the simulator.
- Added a study topic; generated, rejected, regenerated, modified, and accepted a study plan. Rejection preserved the event count; acceptance added 10 study sessions plus breaks in the fixture. Accepted sessions survived a reload.
- Opened daily, weekly, and monthly FullCalendar views. An activity overlapping a meal was rejected with a named conflict.
- Created a recurring university class with semester dates and room; confirmed its timetable row.
- Created a weekly workout, added exercise sets/reps, and marked an occurrence complete. Workout statistics reflected 1/1 sessions and 45 completed minutes.
- Created an exact-time presentation assessment, changed preparation to 45%, and confirmed its countdown and weight.
- Entered 30 previous credits at 3.50. For the six-credit fixture subject, the GPA cards showed 3.50 current pace, 3.50 cumulative pace, 4.00 projected semester, and 3.58 projected cumulative.
- Invoked JSON export and inspected the generated Blob contents. Restored those contents through the file-input import/review/replace flow after loading example data. Invalid-version JSON was rejected. The integrated browser did not expose a normal download event, so operating-system download completion was not asserted.
- At a 390px emulated viewport, verified mobile navigation and no document-level horizontal overflow. The weekly timetable intentionally scrolls inside its own container.
- Reloaded the cached production app with its browser context offline. Confirmed `navigator.onLine` was false, the service worker controlled the page, saved example data remained available, and FullCalendar rendered offline. Closed the isolated context afterward.

## Platform limits

Physical iPhone/iPad Safari installation and notification permission were not tested in this Windows environment. Follow the Safari and HTTPS instructions in [README.md](./README.md). Closed-app notification delivery is deliberately not promised.

The dependency audit's critical/moderate test-runner advisories were resolved by upgrading Vitest. Four low-severity advisory entries remain in the build-only PWA dependency chain (`deepmerge` through Workbox/Rollup). The registry proposes an obsolete PWA-plugin downgrade, which is inappropriate for this application; none of that build code is served in the runtime bundle.

## GitHub Pages configuration checks

Prepared without creating a repository, pushing code, or executing a remote deployment.

- Existing regression suite: **50 passed** after the configuration changes.
- Production build and `npm.cmd run verify:pages`: passed with `VITE_BASE_PATH=/daylight/` and with the default `/` base.
- Workflow YAML parsed/formatted successfully through Prettier. Build and deploy jobs are linked, both restricted to `main`; only the deploy job has Pages/OIDC write permissions. The real GitHub-hosted workflow can only be confirmed after the reviewed source is pushed and Pages is enabled.
- At `http://127.0.0.1:4174/daylight/`, browser requests for the JavaScript, stylesheet, favicon, and Apple touch icon returned 200 with the `/daylight/` prefix. Manifest launch URL, scope, ID, and all icons used that same prefix.
- The registered worker was `/daylight/sw.js` with `/daylight/` scope. No worker controlled the origin root.
- A newly created test subject survived a full page reload from the existing IndexedDB implementation.
- After stopping the preview server, the cached app reloaded and the lazy calendar view rendered under `/daylight/#calendar`. An uncached network probe failed with `ERR_CONNECTION_REFUSED`, confirming the app did not rely on the preview server for that check.
- Production build output was restored to the default root base after verification, so the usual local preview command still works. GitHub Actions supplies the actual Pages path at build time.

Real iPhone Safari Home Screen installation and a live GitHub Pages deployment remain for the user to confirm after configuration review. See [DEPLOYMENT.md](./DEPLOYMENT.md).

# Scheduling regression checks

The full scheduling change report is [SCHEDULING_CHANGES.md](./SCHEDULING_CHANGES.md).

```powershell
npm.cmd ci
npm.cmd test
$env:VITE_BASE_PATH='/-daylight/'
npm.cmd run build
npm.cmd run verify:pages
npm.cmd run test:browser
```

Browser tests start and stop their own preview on port 4201 and refuse to reuse another server. Every case uses a separate browser context and refuses to seed a context with an existing Daylight database. They use synthetic fixtures, never the deployed workspace. Windows defaults to installed Microsoft Edge. On other systems install the free Chromium test browser with `npx playwright install chromium`, or set `PLAYWRIGHT_CHANNEL` to an installed supported browser. Both desktop and 390×844 phone layouts run; this does not emulate Safari.

The browser suite verifies v1 migration/backup, exam-week class/travel suspension and resumption, weekday/date bus rules, Generate → proposals → modify/reject/regenerate → accept → reload → offline reopen, quota failure visibility/retry, duplicate-click prevention, blocked-time explanations, invalid planning input, and no implicit approval on closing a proposal.
