# SyncSpace

**Live assignment demo:** [Open SyncSpace](https://rajibgain.github.io/ENERGY/)

The public site is hosted with GitHub Pages. Choose **Explore the assignment demo** to open the sample workspace without an account. Its illustrative map shows two sample sites; you can add a location and upload an optional building schematic to explore the interface. Demo edits stay in the browser session. Organization sign-in and saved team or site data require the separate API service.

Every push to `main` builds the frontend and publishes it to GitHub Pages. The Vite base path is set in the deployment workflow for this repository.

SyncSpace is a multi-organization energy workspace for companies, campuses, property portfolios and other facility operators. Each organization has its own facilities, bill ledger, team and access roles.

This version is prepared as a college ESD assignment on **Energy Management**. It demonstrates an equipment-and-schedule-based energy model, a ranked action center, emissions and cost estimates, an Indian electricity-provider directory, an organization-scoped site map, and block/room views. Open the sign-in page and choose **Explore the assignment demo** to see a complete sample campus without creating an account or starting the API. Demo values and map coordinates are illustrative and remain separate from live organization data.

See [PROJECT_GUIDE.md](PROJECT_GUIDE.md) for the complete project handbook: architecture, features, roles, data model, API, energy calculations, configuration, local setup, deployment and limitations. See [PROJECT_REPORT.md](PROJECT_REPORT.md) for the assignment abstract, objectives, methodology, model assumptions, and presentation walkthrough. The dashboard also explains its calculations under **Project method**.

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

New organization workspaces start empty: no demo rooms, placeholder location, or generated energy figures. Add a location by marking it on the map or pasting a full Google Maps link with a pin, then add zones and rated equipment. Import a schedule CSV to calculate estimates from those inputs. An empty workspace shows blank metrics until facility data exists.

The local API uses SQLite at `backend/syncspace.db`. It creates new tables and adds the organization, site, provider, and Google identity columns needed by the workspace. Map pins are optional; a full Google Maps link or the on-screen map picker can set one. Shortened Google Maps sharing links do not expose coordinates to the browser. Building plans are optional PNG, JPG, WEBP, or PDF uploads up to 10 MB and are stored with the organization database. Unscoped legacy room rows are not assigned to new organizations.

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
