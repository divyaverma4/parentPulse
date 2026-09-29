# Parent Pulse Deployment Guide

## 1) Deploy backend to Railway

1. Create a new Railway project and connect this repository.
2. Add a service from this repo.
3. Set the service root directory to `parent-pulse-backend`.
4. Railway will read `parent-pulse-backend/railway.toml`.
5. Add environment variables in Railway:
   - `OPENAI_API_KEY`
   - `SUPABASE_URL`
   - `SUPABASE_SECRET_KEY`
   - `NODE_ENV=production`
   - `REPORT_UPLOAD_KEY` (optional)
6. Deploy the service.

## 1a) Import grade assignments once

Deploying the backend does not import grade JSON into Supabase. From `parent-pulse-backend`, run `npm run import:grades` once with `SUPABASE_URL` and `SUPABASE_SECRET_KEY` set to the intended database. The importer reads grade-export JSON files from `jsonData/`.

Do not add this command to the Railway start command: the web server should not re-import data on every restart. The importer is not idempotent, so rerunning it can create duplicate rows. Schema initialization no longer truncates existing data.

Health checks:
- `GET /api/health`
- `GET /api/report/latest`

## 2) Point Expo app to deployed backend

Update `parent-pulse/app.json`:
- `expo.extra.apiBaseUrl`
- Example: `https://your-backend-name.up.railway.app`

## 3) Build mobile app with EAS

From `parent-pulse`:

```bash
npm install
npx eas login
npx eas build:configure
npx eas build -p android --profile preview
npx eas build -p ios --profile preview
```

For production release:

```bash
npx eas build -p android --profile production
npx eas submit -p android
npx eas build -p ios --profile production
npx eas submit -p ios
```

## 4) Verify end-to-end in app

1. Open the installed build.
2. Confirm Home data loads.
3. Confirm Chat API calls return responses.

If app cannot reach backend, confirm:
- Railway URL in `app.json`
- Railway env vars are set
- Backend logs show successful startup
