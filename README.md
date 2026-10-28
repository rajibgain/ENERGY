# SyncSpace

**Live assignment demo:** [Open SyncSpace](https://rajibgain.github.io/ENERGY/)

The public site is hosted with GitHub Pages. Choose **Explore the assignment demo** to open the sample workspace without an account. Its illustrative map shows two sample sites; you can add a location and upload an optional building schematic to explore the interface. Demo edits stay in the browser session. Organization sign-in and saved team or site data require the separate API service.

Every push to `main` builds the frontend and publishes it to GitHub Pages. The Vite base path is set in the deployment workflow for this repository.

SyncSpace is a multi-organization energy workspace for companies, campuses, property portfolios and other facility operators. Each organization has its own facilities, bill ledger, team and access roles.

This version is prepared as a college ESD assignment on **Energy Management**. It demonstrates an equipment-and-schedule-based energy model, a ranked action center, emissions and cost estimates, an Indian electricity-provider directory, an organization-scoped site map, and block/room views. Open the sign-in page and choose **Explore the assignment demo** to see a complete sample campus without creating an account or starting the API. Demo values and map coordinates are illustrative and remain separate from live organization data.

See [PROJECT_REPORT.md](PROJECT_REPORT.md) for the assignment abstract, objectives, methodology, model assumptions, architecture, limitations and a short presentation walkthrough. The dashboard also explains its calculations under **Project method**.

## Run locally

In one terminal, start the API:

```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```

In another terminal, start the web app:

```powershell
cd frontend
npm install
npm run dev
```

Open `http://127.0.0.1:5173`. The first person to create an organization becomes its owner. Owners and admins can open **Team** to invite people; the invitation link is shown once, expires after seven days and is accepted using the invited email address.

The local API uses SQLite at `backend/syncspace.db`. It creates new tables and adds the organization, site, and provider settings columns needed by the updated workspace. Existing rooms are assigned to a primary site for their organization. Site map pins need latitude and longitude; building plans are optional PNG, JPG, WEBP, or PDF uploads up to 10 MB and are stored with the organization database.

## Roles

- **Owner:** controls organization settings and every role, including admins.
- **Admin:** controls organization settings and manages managers and staff.
- **Manager:** manages locations, building plans, room assignments, facility schedules, and the electricity ledger.
- **Staff:** reads facility and energy performance data.

Role checks and organization scoping run in the API. The browser stores the login only in an HTTP-only session cookie; passwords are stored as scrypt hashes.

## Deployment settings

Set `APP_ENV=production`, a stable `AUTH_SECRET_KEY` with at least 32 characters, a production `DATABASE_URL`, `VITE_API_BASE_URL` to the API URL, and `FRONTEND_ORIGINS` to the exact browser origin(s). Use HTTPS in production. The API session cookie is marked Secure when `APP_ENV=production`.

The bill section records statements and reconciliations in the organization database. It can open a provider-hosted payment page configured by an owner or admin; live bill fetching and payment confirmation still require a commercial integration with an onboarded BBPS provider.
