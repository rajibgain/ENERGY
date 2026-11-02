# SyncSpace Developer & Onboarding Guide

Welcome to **SyncSpace**! This guide is designed for collaborators, teammates, and friends who want to run the project locally, understand how it works, build new features, and verify that everything is working properly from end to end.

---

## Table of Contents
1. [What is SyncSpace?](#1-what-is-syncspace)
2. [Tech Stack & Architecture](#2-tech-stack--architecture)
3. [Core Features & How They Work](#3-core-features--how-they-work)
4. [5-Minute Quickstart (Run It Locally)](#4-5-minute-quickstart-run-it-locally)
5. [End-to-End Verification (How to Test Everything)](#5-end-to-end-verification-how-to-test-everything)
   - [Level 1: Automated Backend Test Suite](#level-1-automated-backend-test-suite)
   - [Level 2: Frontend Production Build](#level-2-frontend-production-build)
   - [Level 3: Assignment Demo Walkthrough (No Backend Needed)](#level-3-assignment-demo-walkthrough-no-backend-needed)
   - [Level 4: Full-Stack Live Workspace End-to-End Walkthrough](#level-4-full-stack-live-workspace-end-to-end-walkthrough)
6. [Sample Files for Quick Testing](#6-sample-files-for-quick-testing)
7. [Environment Variables Reference](#7-environment-variables-reference)
8. [Common Developer Workflows](#8-common-developer-workflows)
9. [Troubleshooting & FAQs](#9-troubleshooting--faqs)

---

## 1. What is SyncSpace?

**SyncSpace** is an advanced schedule-and-equipment energy management and planning platform. In large campuses, commercial buildings, and institutional facilities, energy bills, class/office timetables, and maintenance logs are usually kept in completely separate spreadsheets. This leads to massive unnoticed energy waste — like running 2-ton air conditioners in empty lecture halls during unscheduled hours.

SyncSpace connects these dots:
1. **Models Energy Intelligently:** Uses equipment nameplate power, realistic **Load Factors** (e.g. 0.60 for ACs), and **Standby Power** to model energy usage against weekly timetable schedules.
2. **Validates Against Reality (No IoT Required):** Uploads historical interval meter CSVs to generate dual-series **Modeled vs. Measured** variance charts.
3. **Drives Action:** Includes an **Actionable Task & Audit Register** that tracks interventions (e.g. "Install HVAC motion sensors") and computes verified before-and-after savings in kWh and ₹.
4. **Detects Anomalies & Forecasts:** Identifies monthly electricity bills that surge >20% above the rolling average and uses local linear regression to forecast next month's consumption and costs.
5. **Benchmarks Against Indian Standards:** Real-time compliance checking against statutory **ECBC 2017** and indicative **BEE** energy performance baselines.

> **CRITICAL ARCHITECTURAL BOUNDARY:** SyncSpace deliberately has **NO live IoT hardware dependencies** (no microcontrollers, ESP32, or raw socket listeners). All real-world interval data is handled via clean, standard CSV uploads so that any organization can use it immediately without expensive IoT hardware.

---

## 2. Tech Stack & Architecture

### Backend
- **Framework:** FastAPI (Python 3.10+ / tested on Python 3.14)
- **Database ORM:** SQLAlchemy with Pydantic v2 schemas
- **Database Migrations:** Alembic (configured with batch mode for SQLite & PostgreSQL compatibility)
- **Default Database:** SQLite (`backend/syncspace.db`) for easy zero-setup local dev; PostgreSQL supported out of the box
- **Caching & Rate Limiting:** Redis-backed sliding-window limiter (mandatory in production, transparent in-memory fallback for local development)
- **Email Service:** Transactional SMTP mailer (`smtplib`) for team invites, password resets, and automated alerts
- **Testing:** Pytest with AnyIO (25 automated unit and integration tests, 0 warnings)

### Frontend
- **Framework:** React 18 with Vite 8 (JavaScript + JSX)
- **Styling:** Tailwind CSS + custom CSS design system (`experience.css`)
- **Visualizations:** Recharts (accessible SVG charts) + Lucide React icons
- **Maps:** Leaflet & OpenStreetMap
- **Bundle Architecture:** Vite with Rollup `manualChunks` code splitting (charts, React core, icons, and dynamic `React.lazy` modal loading)

---

## 3. Core Features & How They Work

| Feature | Where It Lives | What It Does |
|---|---|---|
| **What-If Simulator** | `WhatIfSimulator.jsx` | Client-side interactive sliders testing schedule cuts, LED swaps, and AC setpoint adjustments, calculating ₹/day saved, emissions abated, and payback period. |
| **Rooftop Solar Tool** | `SolarEstimator.jsx` | Calibrated to Kolkata/Eastern India insolation (4.5–5.0 kWh/kWp/day) estimating optimal system kWp, daily generation, and bill offset from roof area. |
| **Appliance Library** | `seed_appliances.py` | 16 pre-populated Indian commercial appliance presets (e.g. 1.5T 3-Star AC, BLDC fans, LED panels, PCs) with default watts, load factors, and standby watts. |
| **Schedule Integrity** | `services.py` & `sync.py` | Unique DB constraint `uq_schedule_slot` plus minute-by-minute interval collision detection (`find_overlapping_schedule`) that rejects schedule overlaps with HTTP 409 Conflict. |
| **Modeled vs. Measured** | `ModeledVsMeasuredChart.jsx` | Recharts dual-series visualization comparing theoretical schedule demand against uploaded interval meter CSV traces. |
| **Task & Audit Register** | `TaskManager.jsx` | Full task lifecycle (`OPEN` $\to$ `IN_PROGRESS` $\to$ `COMPLETED`) with before-and-after meter readings and verified annual savings calculation in kWh and ₹. |
| **Bill Anomaly Flags** | `BillAnalyticsView.jsx` | Monthly utility consumption chart that flags billing cycles where kWh exceeds 20% of the 3-month rolling average. |
| **Next-Month Forecast** | `analytics.py` & `BillAnalyticsView.jsx` | Local linear regression model forecasting next month's consumption and cost with statistical $R^2$ goodness-of-fit. |
| **ECBC/BEE Benchmarking** | `ZoneBenchmarkingModal.jsx` | Computes Energy Performance Index ($\text{EPI} = \text{Annual kWh} / \text{m}^2$) and benchmarks against statutory ECBC 2017 & indicative BEE standards. |
| **SMTP Workflows** | `email_service.py` | Sends team invitations, HMAC-SHA256 password resets, and automated alerts for bills due soon (<7 days) and high energy gaps (>50 kWh/day). |

---

## 4. 5-Minute Quickstart (Run It Locally)

Follow these steps to get both the backend API and frontend React app running on your machine.

### Prerequisites
Make sure you have:
1. **Python 3.10+** (Python 3.11, 3.12, 3.13, or 3.14) installed: `python --version`
2. **Node.js 18+** installed: `node --version`
3. **Git** installed: `git --version`

---

### Step 1: Clone the Repository
```powershell
git clone https://github.com/rajibgain/ENERGY.git
cd ENERGY
```

---

### Step 2: Set Up and Start the Backend API (Terminal 1)

1. Open PowerShell and navigate to `backend`:
   ```powershell
   cd backend
   ```

2. Create a virtual environment and activate it:
   ```powershell
   python -m venv .venv
   .\.venv\Scripts\Activate.ps1
   ```
   *(If PowerShell gives a script execution policy error, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

3. Install backend dependencies:
   ```powershell
   pip install -r requirements.txt
   ```

4. Apply database migrations:
   ```powershell
   alembic upgrade head
   ```

5. Seed the pre-populated Indian appliance library:
   ```powershell
   python seed_appliances.py
   ```
   *(You should see: "Appliance template library is up to date with 16 templates.")*

6. Start the FastAPI development server:
   ```powershell
   uvicorn main:app --reload --host 127.0.0.1 --port 8000
   ```

7. Verify the backend is online:
   - Health check: Open [http://127.0.0.1:8000/](http://127.0.0.1:8000/) in your browser (should return `{"status": "ok", "app": "SyncSpace"}`).
   - Interactive Swagger API docs: Open [http://127.0.0.1:8000/docs](http://127.0.0.1:8000/docs).

---

### Step 3: Set Up and Start the Frontend UI (Terminal 2)

1. Open a **second** terminal and navigate to `frontend`:
   ```powershell
   cd frontend
   ```

2. Install frontend dependencies:
   ```powershell
   npm install
   ```

3. Start the Vite dev server:
   ```powershell
   npm run dev
   ```

4. Open your browser to [http://127.0.0.1:5173/](http://127.0.0.1:5173/).

---

## 5. End-to-End Verification (How to Test Everything)

Run these checks to verify that every component of the platform is working as intended.

### Level 1: Automated Backend Test Suite

Run the full automated test suite to verify math, security, migrations, rate limiting, and analytics:

```powershell
cd backend
.\.venv\Scripts\python.exe -m pytest -v
```

**Expected output:**
```text
============================= test session starts =============================
platform win32 -- Python 3.14.7, pytest-9.2.0, AnyIO-4.15.1
collected 25 items

tests/test_api_endpoints.py::test_get_appliance_templates PASSED         [  4%]
tests/test_api_endpoints.py::test_create_room_and_deduplicate_schedules PASSED [  8%]
tests/test_api_endpoints.py::test_meter_data_csv_upload_and_summary PASSED [ 12%]
tests/test_data_isolation.py::test_organization_data_isolation PASSED    [ 16%]
tests/test_energy_calculations.py::test_required_exact_energy_calculation PASSED [ 20%]
tests/test_energy_calculations.py::test_energy_with_load_factor_and_standby PASSED [ 24%]
tests/test_energy_calculations.py::test_schedule_overlapping_merge PASSED [ 28%]
tests/test_energy_calculations.py::test_time_of_use_blended_tariff PASSED [ 32%]
tests/test_migrations_compatibility.py::test_alembic_configuration_and_head_revision PASSED [ 36%]
tests/test_migrations_compatibility.py::test_database_schema_and_constraints_integrity PASSED [ 40%]
tests/test_password_reset_and_alerts.py::test_password_reset_flow PASSED [ 44%]
tests/test_password_reset_and_alerts.py::test_automated_alerts_dispatch PASSED [ 48%]
tests/test_rbac_permissions.py::test_rbac_staff_role_restrictions PASSED [ 52%]
tests/test_rbac_permissions.py::test_rbac_manager_role_capabilities_and_limits PASSED [ 56%]
tests/test_rbac_permissions.py::test_rbac_admin_vs_owner_invitation_restrictions PASSED [ 60%]
tests/test_redis_ratelimit_and_forecast_edge_cases.py::test_production_redis_mandatory_enforcement PASSED [ 64%]
tests/test_redis_ratelimit_and_forecast_edge_cases.py::test_in_memory_ratelimit_sliding_window PASSED [ 68%]
tests/test_redis_ratelimit_and_forecast_edge_cases.py::test_forecasting_edge_cases PASSED [ 72%]
tests/test_schedule_overlap_and_csv.py::test_schedule_overlap_rejection PASSED [ 76%]
tests/test_schedule_overlap_and_csv.py::test_batch_schedule_csv_overlap_and_malformed_input PASSED [ 80%]
tests/test_schedule_overlap_and_csv.py::test_malformed_csv_error_handling PASSED [ 84%]
tests/test_tasks_and_analytics.py::test_audit_task_crud_and_verified_savings PASSED [ 88%]
tests/test_tasks_and_analytics.py::test_bill_trends_anomaly_detection PASSED [ 92%]
tests/test_tasks_and_analytics.py::test_bill_forecasting PASSED          [ 96%]
tests/test_tasks_and_analytics.py::test_ecbc_bee_benchmarking PASSED     [100%]

============================= 25 passed in 4.24s ==============================
```
*(Notice: **25 passed, 0 failed, 0 warnings**)*

---

### Level 2: Frontend Production Build

Verify that the frontend builds without errors, warning flags, or bundle bloat:

```powershell
cd frontend
npm run build
```

**Expected output:**
```text
✓ 2504 modules transformed.
dist/index.html                                  1.84 kB
dist/assets/ZoneBenchmarkingModal-ZK4NGihC.js    7.60 kB
dist/assets/vendor-icons-C0nmcC9a.js            11.78 kB
dist/assets/index-BnyAdeu1.js                  181.69 kB
dist/assets/vendor-react-DIc9371a.js           182.15 kB
dist/assets/vendor-charts-C2Rve2lh.js          381.41 kB

✓ built in ~1.00s (0 chunk warnings)
```

---

### Level 3: Assignment Demo Walkthrough (No Backend Needed)

You can explore the frontend without running the backend API:
1. Open [http://127.0.0.1:5173/](http://127.0.0.1:5173/).
2. Click **"Explore the assignment demo"**.
3. **Test What-If Simulator:**
   - Adjust the **Schedule Reduction** slider (e.g. cut 2 hours/day).
   - Toggle **LED Retrofit** on.
   - Adjust **Cooling Setpoint** from 22°C to 25°C.
   - Notice the instant calculations for ₹/day saved, emissions abated, and payback period.
4. **Test Rooftop Solar Calculator:**
   - Enter `500` sq meters of available roof area.
   - Notice the estimated system size (kWp), estimated daily generation (~2,250 kWh/day in Kolkata), and bill offset.
5. **Inspect the Schedule Profile:**
   - Scroll down to view the **Expected Hourly Demand** chart derived from class schedules.
6. **Download Report:**
   - Click **"Export CSV Report"** to download the comprehensive portfolio CSV summary.

---

### Level 4: Full-Stack Live Workspace End-to-End Walkthrough

To verify the full production workflow with live persistence:

1. **Sign Up a New Workspace:**
   - On [http://127.0.0.1:5173/](http://127.0.0.1:5173/), enter your name, email, password (12+ characters, uppercase, lowercase, number, symbol), and organization name (e.g., "Engineering College").
   - Click **Create Workspace**. You are now logged in as the **Owner**.

2. **Add a Location (Site):**
   - In the sidebar or top bar, go to **Sites / Locations**.
   - Click **Add Site**. Name it "Main Academic Campus".
   - Set coordinates using the map picker or enter `22.5726` lat, `88.3639` lng (Kolkata). Click **Save**.

3. **Create a Facility Zone:**
   - In the **Facility Zones** tab, click **Add Zone**.
   - Zone Name: `Lecture Hall 101`
   - Block: `MCA Building`
   - Zone Type: `classroom`
   - Floor Area: `120` m²
   - Select the site you just created and save.

4. **Add Equipment with Load Factor & Standby Power:**
   - Open `Lecture Hall 101`.
   - Click **Add Equipment**.
   - Option A: Pick a preset from the Indian Appliance Library (e.g. `1.5-Ton Split AC (3-Star)` - 1500W, Load Factor 0.60, Standby 15W).
   - Option B: Add custom equipment (e.g. `Fluorescent Tube Lights` - 320W, Load Factor 1.0, Standby 0W).

5. **Upload Timetable Schedules & Test Overlap Protection:**
   - In the zone's Timetable tab, click **Import CSV**.
   - Select [`backend/timetable.csv`](file:///d:/energy%20management/backend/timetable.csv) (included in the repo).
   - Click Upload. Notice the schedules are imported and your Modeled Energy Gap updates immediately!
   - *Test Overlap Detection:* Try importing the same file again — the system safely detects and reports exact duplicates and overlaps, preventing corrupt double-counting!

6. **Upload Interval Meter Data & View Modeled vs. Measured:**
   - Go to the **Meter Data** tab or click **Upload Meter CSV**.
   - Select [`backend/sample_meter_data.csv`](file:///d:/energy%20management/backend/sample_meter_data.csv) (included in the repo).
   - Click **Import Meter Data**.
   - View the dual-series **Modeled vs. Measured** Recharts graph comparing your theoretical schedule gap against the 24-hour meter trace!

7. **Create an Audit Task & Log Verified Savings:**
   - Open the **Audit Tasks** tab.
   - Click **New Task**:
     - Title: `Install occupancy timer on Split ACs`
     - Owner: Your name
     - Baseline Reading: `45.0` kWh/day
     - Post-Intervention Reading: `32.0` kWh/day
     - Status: `COMPLETED`
   - Save the task. Notice the verified savings badge displays: **13.0 kWh/day saved (₹37,960 / year)**!

8. **Check ECBC 2017 & BEE Benchmarking:**
   - On the zone details card, click **View ECBC / BEE Benchmark**.
   - Inspect the calculated Energy Performance Index ($\text{EPI} = \text{Annual kWh} / 120\text{ m}^2$) benchmarked against the standard 95 kWh/m²/yr for educational classrooms!

9. **Record Utility Bills & Test Anomaly Detection:**
   - Open the **Electricity Ledger**.
   - Add three baseline bills (e.g. ₹10,000 / 1200 kWh each).
   - Add a fourth bill with ₹16,000 / 1900 kWh.
   - View the **Bill Analytics** view: the anomalous surge will be highlighted with a red warning badge (**>20% above rolling average**), and the next-month linear regression forecast will project future consumption!

---

## 6. Sample Files for Quick Testing

The repository includes ready-to-use CSV sample files in `backend/`:

1. **`backend/timetable.csv`** (Schedule Import):
   ```csv
   day_of_week,start_time,end_time
   Tuesday,10:00:00,12:00:00
   Wednesday,13:00:00,15:00:00
   Thursday,09:00:00,11:30:00
   Friday,14:00:00,16:00:00
   ```

2. **`backend/sample_meter_data.csv`** (Interval Meter Readings):
   ```csv
   timestamp,kwh,room_name,interval_minutes
   2026-03-01 00:00:00,0.45,Lecture Hall 101,60
   2026-03-01 09:00:00,4.35,Lecture Hall 101,60
   2026-03-01 10:00:00,4.50,Lecture Hall 101,60
   ...
   ```

---

## 7. Environment Variables Reference

Copy `backend/.env.example` to `backend/.env` to configure server settings:

| Variable | Default / Example | Purpose |
|---|---|---|
| `DATABASE_URL` | `sqlite:///./syncspace.db` | Database connection string. Use `postgresql://user:pass@localhost:5432/syncspace` for PostgreSQL. |
| `APP_ENV` | `development` | Set to `production` to enforce mandatory Redis and HTTPS secure cookies. |
| `AUTH_SECRET_KEY` | *(auto-generated in dev)* | 32+ character HMAC secret for signing session cookies and password reset tokens. |
| `FRONTEND_ORIGINS` | `http://localhost:5173,http://127.0.0.1:5173` | Allowed CORS origins. |
| `REDIS_URL` | `redis://localhost:6379/0` | Redis connection URL for rate limiting. *(Mandatory when `APP_ENV=production`)*. |
| `SMTP_HOST` | `smtp.gmail.com` / `smtp.sendgrid.net` | Host for transactional emails (invites, password resets, alerts). If omitted, logs dry-runs safely. |
| `SMTP_PORT` | `587` | SMTP port (STARTTLS). |
| `SMTP_USER` | `user@example.com` | SMTP username. |
| `SMTP_PASSWORD` | `secret` | SMTP password. |
| `OPENAI_API_KEY` | `sk-...` | Optional API key to enable the AI Energy Advisor. |
| `OPENAI_MODEL` | `gpt-6-luna` | OpenAI model ID. |

---

## 8. Common Developer Workflows

### Creating a New Database Migration
When you modify or add models in `backend/models.py`:
```powershell
cd backend
alembic revision --autogenerate -m "describe_your_changes"
alembic upgrade head
```

### Adding New Automated Tests
Add test functions starting with `test_` in `backend/tests/`:
```powershell
cd backend
pytest tests/test_your_feature.py -v
```

### Seeding the Appliance Library
```powershell
cd backend
python seed_appliances.py
```

---

## 9. Troubleshooting & FAQs

- **Q: PowerShell says `cannot be loaded because running scripts is disabled on this system`.**  
  **A:** Run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` in your PowerShell window and re-activate the virtual environment.

- **Q: Backend says `Port 8000 already in use`.**  
  **A:** Another process is using port 8000. Start uvicorn on another port with `--port 8001`, and set `VITE_API_BASE_URL=http://127.0.0.1:8001` in `frontend/.env.local`.

- **Q: Do I need Redis running to test locally?**  
  **A:** **No.** In development mode (`APP_ENV=development`), the rate limiter automatically falls back to an in-memory sliding window store. Redis is only required when `APP_ENV=production`.

- **Q: How do I reset the local test database?**  
  **A:** Delete `backend/syncspace.db`, then run `alembic upgrade head` and `python seed_appliances.py`.

---

Happy Coding! If you have any questions or find any edge cases, feel free to open an issue or submit a pull request!
