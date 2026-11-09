# EcoWasteAI

Merged app (2026-11-09): Nuqta Khadra waste-points system + EcoWaste, running on the restored Ecowaste Supabase project. Admin dashboard ported from the EcoRewards design onto live data; AI slots (camera waste classification + ask-your-data) are built and activate when a Gemini API key is added as an edge-function secret.
React + Vite + Supabase app, ready for:
- Cloud deployment on Cloudflare Pages
- App-like install on mobile/desktop as a PWA
- Android APK build with Capacitor
- Auto APK upload to GitHub Releases (free)

## Go Live Now (Cloudflare)

1. Create a Cloudflare Pages project once in dashboard.
2. Set these local environment variables (template: `.env.cloudflare.example`):

```powershell
setx CLOUDFLARE_API_TOKEN "<your-cloudflare-api-token>"
setx CLOUDFLARE_ACCOUNT_ID "<your-account-id>"
setx CF_PAGES_PROJECT "<your-pages-project-name>"
setx CF_PAGES_BRANCH "main"
```

3. Open a new terminal, then deploy:

```bash
npm install
npm run deploy:cloud
```

After deploy, your app gets a public URL:
- `https://<project>.pages.dev`
- Anyone can open it and use it.
- Users can install it as an app (PWA) from browser install prompt/menu.

If you need a downloadable web package now:

```bash
npm run release:web
```

This creates `release/nuqta-khadra-web.zip` that you can upload to any static host.

## Required Runtime Env (.env)

Create `.env` from `.env.example`:

```env
VITE_SUPABASE_URL=https://YOUR-PROJECT.supabase.co
VITE_SUPABASE_ANON_KEY=YOUR_SUPABASE_ANON_KEY
```

Run locally:

```bash
npm run dev
```

## Supabase Setup

Run SQL in this order in Supabase SQL editor:
1. `supabase/schema.sql`
2. `supabase/bootstrap_admin.sql`
3. `supabase/bootstrap_store.sql`
4. Optional: `supabase/import_seed_profiles.sql`

If your project is older, also run:
- `supabase/admin_tools.sql`

## Cloudflare Pages (Dashboard Method)

Build settings:
- Framework preset: `Vite`
- Build command: `npm run build`
- Build output directory: `dist`

Project environment variables:
- `VITE_SUPABASE_URL`
- `VITE_SUPABASE_ANON_KEY`

React Router fallback is already configured in `public/_redirects`.

## Android APK Build (Capacitor)

Build and sync web assets:

```bash
npm run build
npm run cap:sync
```

Open Android Studio:

```bash
npm run cap:open:android
```

Then in Android Studio:
1. `Build` > `Build Bundle(s) / APK(s)` > `Build APK(s)` (debug), or
2. `Build` > `Generate Signed Bundle / APK` (release).

## GitHub Releases APK (Free + Updatable)

This repo includes workflow:
- `.github/workflows/release-apk.yml`

What it does:
1. Builds web assets
2. Syncs Capacitor Android
3. Builds a **signed release APK**
4. Uploads APK to your GitHub Release automatically
5. Embeds app version + repo so the app can check for latest release update

One-time setup in GitHub:
1. Go to `Settings` > `Secrets and variables` > `Actions`.
2. Add repository secrets:
   - `VITE_SUPABASE_URL`
   - `VITE_SUPABASE_ANON_KEY`
   - `ANDROID_KEYSTORE_BASE64` (base64 of your `.jks` or `.keystore`)
   - `ANDROID_KEYSTORE_PASSWORD`
   - `ANDROID_KEY_ALIAS`
   - `ANDROID_KEY_PASSWORD`

PowerShell helper to generate `ANDROID_KEYSTORE_BASE64`:

```powershell
[Convert]::ToBase64String([IO.File]::ReadAllBytes("D:\path\to\release.keystore"))
```

Important for in-place updates (install over old version):
- Use the **same package id** (`com.nuqta.khadra`) for every release.
- Use the **same signing key** for every release.
- Increase app version every release (tag `v1.0.0`, `v1.0.1`, ...).

How to publish APK:
1. Go to `Releases` > `Draft a new release`.
2. Create a tag like `v1.0.0`.
3. Click `Publish release`.
4. Wait for Actions workflow `Build Signed APK And Attach To Release`.
5. Download APK from the same release assets.

## In-App Update Prompt

The app checks GitHub latest release on startup and shows an update prompt when a newer APK exists.

Required env variables at build time:
- `VITE_GITHUB_REPO` (example: `ahmed15500/nuqta-khadra`)
- `VITE_APP_VERSION` (example: `1.0.0`)

The release workflow already sets both automatically.

## Update Cycle

After web code changes:

```bash
npm run build
npm run cap:copy
```

If plugin list changes:

```bash
npm run cap:sync
```
