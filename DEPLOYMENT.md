# Deploy Daylight to GitHub Pages for free

The configuration is prepared locally for review. No repository has been created, no code has been pushed, and no deployment has been started by this preparation.

Use a **public repository on GitHub Free**, standard `ubuntu-latest` runners, and the included `github.io` HTTPS address. No paid plan, custom domain, billing information, or paid API is needed. The workflow uses the built-in `GITHUB_TOKEN`; you do not need to create a deployment token or secret. Code and the hosted app are public. Personal planner records remain in each browser's IndexedDB and are not uploaded with the site.

Official references: [GitHub Pages availability and workflows](https://docs.github.com/en/pages/getting-started-with-github-pages/using-custom-workflows-with-github-pages), [free standard GitHub Actions runners](https://docs.github.com/en/billing/concepts/product-billing/github-actions), and [Vite's GitHub Pages guide](https://vite.dev/guide/static-deploy.html#github-pages).

## 1. Review before publishing

Review these files before doing the push in step 3:

- [.github/workflows/deploy-pages.yml](./.github/workflows/deploy-pages.yml): on a push to `main`, installs locked dependencies, runs the existing regression tests, builds the PWA, verifies the built paths, uploads only `dist`, then deploys it. It also supports a manual run on `main`. Other branches cannot deploy through this workflow.
- [vite.config.ts](./vite.config.ts): uses one base path for Vite, the PWA manifest's launch URL/identity/scope, icons, service-worker scope, and offline navigation fallback.
- [index.html](./index.html): uses Vite's base placeholder for the favicon and Apple touch icon. The standalone Safari metadata remains present.
- [src/hooks.ts](./src/hooks.ts): reminder notification icons use the same Vite base path. Reminder and PWA behavior are otherwise preserved.
- [scripts/verify-pages-build.mjs](./scripts/verify-pages-build.mjs): checks the actual generated assets, manifest, service-worker registration/scope/fallback, offline precache, and PNG dimensions before an artifact can deploy.
- [.gitignore](./.gitignore): excludes build output, installed dependencies, test output, and Daylight's generated backup/recovery filenames.

IndexedDB's database name, schema, version, and save/import/export implementation have not changed. Scheduling, academic calculations, workouts, statistics, navigation, and other existing features are preserved.

The workflow obtains `base_path` from `actions/configure-pages`; a project repository such as `daylight` builds at `/daylight/`. A user-site repository named `YOUR_USERNAME.github.io` builds at `/`. **You do not need to enter your username or repository name in the source configuration.**

## 2. Create an empty public repository

Only proceed after you have reviewed and accepted the configuration.

1. Sign in to your free GitHub account and open [Create a new repository](https://github.com/new).
2. Choose a name such as `daylight`. The example commands below use that name.
3. Select **Public** to use GitHub Pages with GitHub Free.
4. Leave **Add a README**, **Add .gitignore**, and **Choose a license** unset. This folder already contains the source and documentation; an empty remote avoids unrelated initial commits.
5. Select **Create repository**. Keep its HTTPS repository URL available.

## 3. Push the reviewed source to main

Open PowerShell in the project folder. Replace `YOUR_USERNAME` and, if different, `daylight` in the remote URL. These commands are instructions for you; they have not been run as part of configuration preparation.

```powershell
Set-Location -LiteralPath 'C:\Users\pc\Desktop\study app'
git init -b main
git add .
git status --short
git commit -m "Set up Daylight and GitHub Pages deployment"
git remote add origin https://github.com/YOUR_USERNAME/daylight.git
git push -u origin main
```

Before committing, inspect the status list and keep any personal files or JSON backups out of the public repository. Planner data already in IndexedDB is not part of the source folder. Do not upload `node_modules` or `dist`; the workflow builds from the committed source and lockfile.

If Git requires your commit identity, set it for this repository and retry the commit:

```powershell
git config user.name "YOUR NAME"
git config user.email "YOUR GITHUB EMAIL OR NOREPLY ADDRESS"
```

If Git prompts you to authenticate during push, follow Git Credential Manager's GitHub browser sign-in. A GitHub account password is not a Git HTTPS credential. No deployment credential needs to be added to this app.

The push starts the workflow. The site cannot be published successfully until Pages has been enabled in the next step.

## 4. Enable GitHub Pages and run the workflow

1. In your repository on GitHub, open **Settings → Pages**.
2. Under **Build and deployment**, set **Source → GitHub Actions**. This is the Actions option, not **Deploy from a branch**. Do not add a second generated starter workflow; the repository already includes one.
3. Keep **Custom domain** empty. The provided `github.io` HTTPS address is sufficient and free.
4. Open **Actions → Deploy Daylight to GitHub Pages**.
5. If the first push run is still running, let it finish. If it failed because Pages was not enabled when the setup step ran, select **Re-run all jobs** after enabling Pages. Alternatively, use **Run workflow**, select `main`, and run it.
6. Confirm both **build** and **deploy** finish successfully. The deploy job links to the `github-pages` environment and its HTTPS URL.
7. Return to **Settings → Pages** and open **Visit site**. Enable **Enforce HTTPS** if GitHub displays that control and it is not already enabled. If the URL initially returns 404, wait for GitHub's Pages publication to finish and reload.

For a repository named `daylight`, the normal URL is:

```text
https://YOUR_USERNAME.github.io/daylight/
```

For the special repository `YOUR_USERNAME.github.io`, the URL is:

```text
https://YOUR_USERNAME.github.io/
```

The URL in Settings → Pages or the completed deploy job is authoritative. Open it with its trailing slash. App navigation uses hash URLs such as `/daylight/#calendar`, so page refreshes do not require custom GitHub Pages rewrite rules.

Future commits pushed to `main` automatically repeat tests, build verification, and deployment. You do not need a `gh-pages` branch, a paid host, or a manually uploaded build. For example:

```powershell
git add .
git commit -m "Update Daylight"
git push
```

## 5. Install on iPhone using Safari

1. Open the actual **HTTPS Pages URL** in Safari on your iPhone, rather than the GitHub repository or a laptop's localhost URL.
2. While online, let the app finish loading so its service worker can cache the application assets.
3. Tap **Share**. Depending on your Safari layout, tap the page menu first, then Share.
4. Select **Add to Home Screen**. If missing, use **Edit Actions** in the Share sheet to add that action.
5. Keep **Open as Web App** enabled if your iOS version shows it. Confirm the name and Daylight icon, then tap **Add**.
6. Launch Daylight from its Home Screen icon while online once. In Settings, check the offline-ready status. Reload/reopen online once if the first launch has not finished caching.
7. Turn on Airplane Mode and reopen the installed app to confirm it loads. Then restore your normal connection.

The PWA includes a standalone manifest, a 180px Apple touch icon, 192px/512px standard icons, a maskable icon, Safari metadata, and a service worker scoped to the repository path. Physical iPhone installation still needs to be confirmed on your device; a local Windows build cannot exercise the real Safari Home Screen flow.

[Apple's current Safari iPhone installation instructions](https://support.apple.com/guide/iphone/open-as-web-app-iphea86e5236/ios).

## 6. Bring your local data to the installed app

1. In the existing local app, use **Settings → Export all data** and keep that JSON backup somewhere private.
2. Transfer the backup file to your iPhone using Files, AirDrop, or another method you choose.
3. Open the **installed Home Screen app**, choose **Settings → Import a backup**, review the summary, and confirm replacement.
4. Keep exporting regular backups. Hosting updates replace app code, not IndexedDB data.

Localhost and GitHub Pages are different browser origins, so your old workspace will not automatically appear at the new address. Devices and browsers do not synchronize automatically. Safari tabs and installed web apps may also use separate storage; import inside the installed app you intend to use. Paths alone do not isolate IndexedDB on the same origin. No data-migration or database-reset code has been added.

The existing reminder limitation remains: notifications require permission and the app to be running; closed-app delivery is not guaranteed.

## Optional: verify a repository build locally before pushing

These commands only build and serve files on your laptop; they do not publish anything:

```powershell
Set-Location -LiteralPath 'C:\Users\pc\Desktop\study app'
$env:VITE_BASE_PATH = '/daylight/'
npm.cmd test
npm.cmd run build
npm.cmd run verify:pages
npm.cmd run preview -- --port 4174
```

Open `http://127.0.0.1:4174/daylight/`. Use your actual repository name in the environment variable if desired. Keep that environment variable set for the preview so Vite serves the same base path that was built.

After stopping the preview with Ctrl+C, restore the default local root configuration:

```powershell
Remove-Item Env:VITE_BASE_PATH
npm.cmd run build
npm.cmd run preview
```

The workflow sets its own base automatically using GitHub Pages metadata. Local environment variables do not need to be committed.
