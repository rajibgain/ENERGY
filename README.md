# SyncSpace

**Live assignment demo:** [Open SyncSpace](https://rajibgain.github.io/ENERGY/)  
**Developer & Onboarding Guide:** [DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md) — *Complete 5-minute setup, architecture walkthrough, and end-to-end testing instructions for friends and collaborators.*

The public site is hosted with GitHub Pages. Choose **Explore the assignment demo** to open the sample workspace without an account. Its illustrative map shows sample sites; you can explore the What-If Simulator, Kolkata Rooftop Solar Estimator, hourly schedule profiles, and portfolio CSV exports without a backend. Organization sign-in and saved team or site data require the separate FastAPI service.

Every push to `main` triggers automated Pytest testing and builds/publishes the frontend to GitHub Pages.

---

## What is SyncSpace?

SyncSpace is a multi-organization energy workspace for universities, corporate campuses, and facility operators. It turns entered equipment and schedule data into defensible, verified planning estimates:
- **Smart Energy Modeling:** Replaces flat-rate full load assumptions with realistic **Load Factors** (e.g. 0.60 for ACs) and **Standby Power** ratings.
- **Interval Meter CSV Upload (No IoT):** Upload historical meter CSVs to generate dual-series **Modeled vs. Measured** variance charts.
- **Actionable Task & Audit Register:** Track energy-saving actions, record before-and-after meter readings, and compute verified annual savings in kWh and ₹.
- **Bill Trends & Anomaly Flags:** Graph monthly utility bills with automatic >20% rolling-average anomaly flags.
- **Next-Month Predictive Forecasting:** Embedded local linear regression forecasting next month's consumption and cost with $R^2$ validation.
- **Statutory ECBC 2017 & BEE Benchmarking:** Compare room Energy Performance Index ($\text{EPI} = \text{kWh}/\text{m}^2$) against official Indian building efficiency codes.
- **Production Hygiene:** Versioned Alembic migrations (SQLite & PostgreSQL), transactional SMTP email workflows (invites, password resets, alerts), and Redis-backed rate limiting.

See:
- **[DEVELOPER_GUIDE.md](DEVELOPER_GUIDE.md)** for quick setup, architecture, and end-to-end testing walkthroughs.
- **[PROJECT_GUIDE.md](PROJECT_GUIDE.md)** for the complete technical handbook: API schemas, validation limits, security, and operations.
- **[PROJECT_REPORT.md](PROJECT_REPORT.md)** for the academic report, mathematical methodology, and ECBC/BEE regulatory baselines.

---

## Run Locally in 5 Minutes

### Terminal 1: Backend API
```powershell
cd backend
py -m venv .venv
.\.venv\Scripts\python.exe -m pip install -r requirements.txt
.\.venv\Scripts\python.exe -m alembic upgrade head
.\.venv\Scripts\python.exe seed_appliances.py
.\.venv\Scripts\python.exe -m uvicorn main:app --reload --host 127.0.0.1 --port 8000
```
- API Health Check: `http://127.0.0.1:8000/`
- Interactive Swagger Docs: `http://127.0.0.1:8000/docs`

### Terminal 2: Frontend Web App
```powershell
cd frontend
npm install
npm run dev
```
- Open in browser: `http://127.0.0.1:5173/`

### Run Automated Tests (25 tests, 0 warnings)
```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

New organization workspaces start empty: no demo rooms, placeholder location, or generated energy figures. Add a location by marking it on the map or pasting a full Google Maps link with a pin, then add zones and equipment. Equipment includes rated watts, load factor (typical active draw ÷ rated watts), and standby watts; the defaults of 1.0 and 0 W preserve the previous rated-load assumption until you enter site data. Import a schedule CSV to calculate estimates from those inputs. The What-if and solar tools use editable assumptions; solar payback requires an installer quote. An empty workspace shows blank metrics until facility data exists.

The local API uses SQLite at `backend/syncspace.db`. It creates new tables and adds the organization, site, provider, Google identity, equipment-load, and tariff columns needed by the workspace. Map pins are optional; a full Google Maps link or the on-screen map picker can set one. Shortened Google Maps sharing links do not expose coordinates to the browser. Building plans are optional PNG, JPG, WEBP, or PDF uploads up to 10 MB and are stored with the organization database. Unscoped legacy room rows are not assigned to new organizations.

Account passwords require at least 12 characters, lowercase and uppercase letters, a number, and a symbol. Google sign-in and Google-based workspace creation require a Google Identity Services web client ID: set the same ID as backend `GOOGLE_CLIENT_ID` and frontend `VITE_GOOGLE_CLIENT_ID`. For local development, copy `frontend/.env.example` to `frontend/.env.local` and add a web client ID; copy `backend/.env.example` to `backend/.env` and set the matching server value. Register the local frontend origins in the Google OAuth client. The backend verifies each Google ID token before creating a session.

The **Ask AI** energy advisor is available to signed-in workspaces. Create an API key at [OpenAI API keys](https://platform.openai.com/api-keys), put `OPENAI_API_KEY` in `backend/.env`, and restart the API to enable answers; `OPENAI_MODEL` defaults to `gpt-6-luna` and can be changed there. Keep the key on the server, never in frontend variables or GitHub Pages. The advisor sends the question, recent chat history, and a limited organization summary (location names/regions, equipment and schedule estimates, and due-bill totals) to the [OpenAI Responses API](https://platform.openai.com/docs/api-reference/responses/create). Chats are held in the browser session and are not saved by this app. API usage is billed by OpenAI; see [API pricing](https://platform.openai.com/pricing).

## Roles

- **Owner:** controls organization settings and every role, including admins.
- **Admin:** controls organization settings and manages managers and staff.
- **Manager:** manages locations, building plans, room assignments, facility schedules, and the electricity ledger.
- **Staff:** reads facility and energy performance data.

Role checks and organization scoping run in the API. The browser stores the login only in an HTTP-only session cookie; passwords are stored as scrypt hashes.

## Deployment settings

GitHub Pages hosts only the static frontend. A full account workspace also needs the FastAPI service and a persistent production database hosted separately. Set `APP_ENV=production`, a stable `AUTH_SECRET_KEY` with at least 32 characters, a production `DATABASE_URL`, `GOOGLE_CLIENT_ID`, `OPENAI_API_KEY`, and `FRONTEND_ORIGINS` to the exact browser origin(s) on the API host. Add the API's public HTTPS root URL and the matching Google web client ID as GitHub Actions repository variables `VITE_API_BASE_URL` and `VITE_GOOGLE_CLIENT_ID`; the Pages workflow passes them into the frontend build. Do not put `OPENAI_API_KEY` in GitHub Pages variables. Without the API variable, the public assignment demo still works while account sign-in reports that the service is not configured. Use HTTPS in production. The API session cookie is marked Secure when `APP_ENV=production`.

Create the Google web client in [Google Identity Services setup](https://developers.google.com/identity/gsi/web/guides/get-google-api-clientid), add the production frontend origin to its authorized JavaScript origins, and keep the client ID the same on the frontend and API. The ID is public configuration; do not put a Google client secret in the frontend.

The bill section records statements and reconciliations in the organization database. It can open a provider-hosted payment page configured by an owner or admin; live bill fetching and payment confirmation still require a commercial integration with an onboarded BBPS provider.
