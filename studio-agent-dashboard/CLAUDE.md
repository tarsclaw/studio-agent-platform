# CLAUDE.md — Studio Agent Platform

## What This Is

An AI-powered HR self-service platform for **Allect Design Group** — a 57-person interior design company operating three brands: **Rigby & Rigby**, **Helen Green Design**, and **Lawson Robb**. Offices in Chelsea (29 Milner Street), Mayfair (80 Brook Street), and Stratford-upon-Avon.

Deployed via Microsoft Teams with a web dashboard (AI Hub) planned. Built on TypeScript/Node.js with Relevance AI as the agent layer and Breathe HR as the data source. Azure AD / Microsoft 365 for identity.

---

## Monorepo Structure

```
studio-agent-platform/
├── studio-agent/              # Teams bot (TypeScript, Teams Toolkit)
├── studio-agent-sync/         # Azure Functions auto-sync engine
├── studio-agent-dashboard/    # React AI Hub (Phase 4 — NOT YET BUILT)
├── telemetry-poster/          # Telemetry pipeline
└── CLAUDE.md                  # This file
```

---

## Architecture — The Golden Rule

**Relevance AI handles all intelligence** (prompting, tool routing, knowledge base search). **The VS Code project handles all plumbing** (Teams relay, authentication, identity injection, scheduling, data proxying). These two never cross.

---

## studio-agent/ (Teams Bot) — COMPLETE

The core Teams bot relay. Already built, tested, and working.

### Key Files
- **app.ts** — Agent-agnostic relay. Line 60: `const agentId = process.env.RELEVANCE_AGENT_ID`. Employee and admin bots are the SAME codebase with different env files. `detectAgentType()` at line 35 reads `AGENT_TYPE` env var for telemetry tagging.
- **index.ts** — Entry point. Normalises env vars, starts server on port 3978.
- **config.ts** — Port and server config.
- **telemetryQueue.ts / Telemetrytypes.ts** — Azure Queue telemetry pipeline. Tags turns as "employee" or "admin".
- Compiles to `lib/`, starts with `npm start`
- Dev: `npm run dev` (ts-node + nodemon)
- Employee bot env: `.localConfigs` | Admin bot env: `.localConfigs.admin`

### Env Vars Required
```
RELEVANCE_PROJECT_ID=ca7f193a-f48c-41ab-8c3e-6833ec9a5001
RELEVANCE_API_KEY=<key>
RELEVANCE_AGENT_ID=<employee or admin agent id>
RELEVANCE_REGION=bcbe5a
AGENT_TYPE=employee|admin
BOT_ID=<Azure Bot registration app ID>
BOT_PASSWORD=<Azure Bot registration password>
```

### Files You Do NOT Touch
These are proven and working. Do not modify:
- `app.ts` — agent-agnostic relay
- `index.ts` — entry point
- `config.ts` — port config
- `telemetryQueue.ts` / `Telemetrytypes.ts` — telemetry pipeline
- Everything in `studio-tests/` — test suite (113-114/115 passing)

### Files That Need Minor Addition (Phase 3)
- `package.json` — add `express` as dependency
- `index.ts` — mount Express routes for chatProxy + attendanceProxy (co-host with bot)

### New Files To Create (Phase 3)
- `src/chatProxy.ts` — Express endpoint for web dashboard chat
- `src/attendanceProxy.ts` — Express endpoint for who's in/out data
- `src/relevanceClient.ts` — Shared module extracting `waitForBestAgentReply` from app.ts (lines ~97-145) for reuse by both app.ts and chatProxy.ts

---

## studio-agent-sync/ (Azure Functions) — PRE-BUILT, BLOCKED

Timer-triggered Azure Function (daily 2am UK) + optional Microsoft Graph webhook for real-time.

### What It Does — The Sync Cycle
1. Pull `GET /v1/employees` from Breathe HR. Extract id, email, name, status.
2. Pull `GET /users` from Microsoft Graph. Extract id (aad_object_id), mail/UPN, displayName, accountEnabled.
3. Match records by email (case-insensitive). Derive tenant_id from email domain: `@rigbyandrigby.com` → "rigby and rigby", `@helengreendesign.com` → "helen green", `@lawsonrobb.com` → "lawson robb", everything else → "allect".
4. Determine role: initially check if aad_object_id is in a hardcoded admin list. Later: Azure AD group membership.
5. Build mapping record: `{ tenant_id, aad_object_id, breathe_employee_id, employee_name, status, role }`.
6. Upsert to Relevance AI knowledge table via `POST /knowledge/sets/{dataset_id}/documents/upsert`.
7. Detect new mappings → trigger onboarding flow.
8. Log results to App Insights.

### Key Files
- `src/functions/syncTimer.ts` — daily identity sync
- `src/functions/syncWebhook.ts` — Graph webhook receiver (real-time)
- `src/functions/onboardingTrigger.ts` — sends welcome message to new hires
- `src/functions/syncStatus.ts` — status API for dashboard
- `src/services/breatheService.ts` — Breathe API client
- `src/services/graphService.ts` — Microsoft Graph client
- `src/services/relevanceService.ts` — knowledge table upsert
- `src/services/matchEngine.ts` — email matching + diff
- `src/services/proactiveMessaging.ts` — Bot Framework proactive messages

### BLOCKER
Waiting on **John Jobling** (Allect IT admin) to provide:
- Azure AD App Registration with `User.Read.All` (application) + `User.Read` (delegated) permissions
- Admin consent granted
- Client secret generated
- Confirmation: do all brands share a single M365 tenant or separate ones? (Most likely single tenant for 57 people)

### Dependencies
| Dependency | Source | Status |
|-----------|--------|--------|
| BREATHE_API_KEY (production) | Breathe HR Settings | Pending — still on sandbox |
| Azure AD App Registration | John Jobling | Pending |
| RELEVANCE_API_KEY | Relevance AI Settings | Have it |
| Knowledge table dataset ID | Relevance AI | Have it: `resolver_knowledge_table_with_status_csv` |
| App Insights connection string | Azure Portal | Have it |

---

## studio-agent-dashboard/ (React AI Hub) — NOT YET BUILT

This is the primary build target. A React web application that serves as the unified AI command centre for Allect.

### Tech Stack
- React + TypeScript + Vite
- MSAL.js for Azure AD authentication
- Relevance AI SDK for chat
- Recharts or similar for data viz
- Tailwind CSS or existing design system
- Host on Azure Static Web Apps
- GitHub Actions deploy workflow already exists at `.github/workflows/deploy-swa.yml`

### MSAL.js Configuration
Uses the SAME Azure AD App Registration as the sync engine. Needs a SPA redirect URI added.

```typescript
// dashboard/src/msalConfig.ts
export const msalConfig = {
  auth: {
    clientId: '<App Registration Client ID>',
    authority: 'https://login.microsoftonline.com/<Allect Tenant ID>',
    redirectUri: window.location.origin,
  },
  cache: { cacheLocation: 'sessionStorage' },
};
export const loginRequest = { scopes: ['User.Read'] };
```

MSAL.js handles silent token acquisition, refresh, and login redirect. Users already signed into M365 won't see a login prompt.

### Dashboard Pages / Components

**Homepage widgets:**
- Summary bar: "53 of 57 employees available today"
- Who's In / Who's Out widget (AttendanceWidget.tsx)
- Holiday Allowance widget (LeaveWidget.tsx)
- Birthday & Work Anniversary feed
- Company Noticeboard / Announcements

**Full pages:**
- Ask Studio Agent — full-screen embedded chat (ChatPanel.tsx)
- Analytics — usage metrics, tool call heatmaps, time savings, response times, error rates (AnalyticsDashboard.tsx)
- Team Overview — directory-style view from Breathe HR (TeamOverview.tsx)
- Knowledge Base — searchable Allect Handbook + Operations Manual (KnowledgeBase.tsx)
- Settings — admin panel for identity mapping, sync logs, agent config (Settings.tsx)

### Planned File Structure
```
studio-agent-dashboard/
├── src/
│   ├── App.tsx
│   ├── msalConfig.ts                    # MSAL.js Azure AD config
│   ├── hooks/
│   │   └── useAuth.ts                   # Acquires token, extracts oid/tid
│   ├── components/
│   │   ├── ChatPanel.tsx                # Authenticated chat UI
│   │   ├── AttendanceWidget.tsx         # Who's in/out display
│   │   ├── LeaveWidget.tsx              # Holiday allowance card
│   │   ├── AnalyticsDashboard.tsx       # Usage analytics
│   │   ├── TeamOverview.tsx             # Staff directory
│   │   ├── KnowledgeBase.tsx            # Searchable handbook
│   │   ├── Noticeboard.tsx              # Company announcements
│   │   └── Settings.tsx                 # Admin panel
│   └── index.tsx
├── public/
├── package.json
├── vite.config.ts
└── tsconfig.json
```

---

## Backend Proxy Endpoints (Phase 3 — in studio-agent/)

These Express routes sit in `studio-agent/src/` alongside `app.ts` and get mounted in `index.ts`.

### chatProxy.ts (~70 lines)

```
POST /api/chat
Headers: Authorization: Bearer {msal_access_token}
Body: { "text": "How many holiday days do I have left?" }
```

Flow:
1. Extract and validate MSAL token from Authorization header → get `oid` and `tid`
2. Build the same JSON payload app.ts builds: `{ text, tenant_id, aad_object_id, conversation_id, thread_id, event_id }`
3. Send to Relevance AI via SDK (`agent.sendMessage(payloadStr)`)
4. Wait for reply (same `waitForBestAgentReply` pattern from app.ts lines ~97-145 — extract to shared module `src/relevanceClient.ts`)
5. Return reply as JSON

The agent's resolver fires identically to Teams. It doesn't know or care whether the message came from Teams or the web.

Default: points at employee agent. Admins who need admin functions use the admin bot in Teams. Can evolve later to support both via `/api/chat/employee` and `/api/chat/admin`.

### attendanceProxy.ts (~60 lines)

```
GET /api/attendance?date=2026-03-07
Headers: Authorization: Bearer {msal_access_token}
```

Flow:
1. Validate MSAL token
2. Call `GET /v1/employees` — full roster with names, departments, locations
3. Call `GET /v1/absences` — all absences, filtered to today's date
4. Cross-reference: employees with active absence today = absent, everyone else = present
5. Return structured JSON grouped by brand and location

Response shape:
```json
{
  "date": "2026-03-07",
  "totalEmployees": 57,
  "totalAbsent": 4,
  "totalPresent": 53,
  "absences": [
    {
      "employeeName": "Jane Smith",
      "type": "Holiday",
      "brand": "Rigby & Rigby",
      "location": "29 Milner Street, Chelsea",
      "department": "Interior Design",
      "startDate": "2026-03-05",
      "endDate": "2026-03-10"
    }
  ],
  "byBrand": { "Rigby & Rigby": { "absent": 2, "present": 18 } },
  "byLocation": { "Chelsea": { "absent": 3, "present": 30 } }
}
```

Role-based visibility: managers see full names, employees see counts only. Proxy checks user's role from MSAL token group claims or resolver knowledge table.

Breathe API key stays server-side — frontend never sees it.

---

## Dashboard Feature Roadmap

### BUILD NOW (alongside or immediately after admin code)

| Feature | Effort | Key Dependency |
|---------|--------|---------------|
| Who's In / Who's Out Widget | 2-3 days | Breathe production API, MSAL auth, attendanceProxy.ts |
| Holiday Allowance Dashboard Widget | 1-2 days | MSAL auth, chatProxy or leaveProxy endpoint |
| Office Essentials Quick Access Panel | 0.5 days | MSAL auth (for gating sensitive items) |
| Company Noticeboard / Announcements | 1-2 days | MSAL auth (for admin-only editing) |
| Birthday & Work Anniversary Feed | 1 day | Breathe production API |

### NEXT WAVE (requires infrastructure first)

| Feature | Effort | Key Dependency |
|---------|--------|---------------|
| Intelligent Leave Planner | 3-4 days | Breathe production API |
| Proactive HR Alerts & Reminders | 3-5 days | Bot deployed org-wide in Teams |
| Smart Onboarding Flow | 2-3 days | Auto-sync engine operational |

### LATER (bigger integrations)

| Feature | Effort | Key Dependency |
|---------|--------|---------------|
| ESTI Procurement Helper | 5-10 days | ESTI API availability (check with John Jobling) |
| Co-Lab Performance Tracker | 1-3 days | GROW dashboard access |
| Clockify Time Insights | 3-5 days | Clockify API key |
| Staff Directory | 2-3 days | Breathe production API |

### FUTURE

| Feature | Effort | Key Dependency |
|---------|--------|---------------|
| Meeting Room Booking | 3-5 days | Microsoft Graph Calendar API |
| AI Content Draft Assistant | 3-5 days | Brand guidelines uploaded to Relevance AI |
| IT Request Portal | 2-3 days | None (structured form → email to John Jobling) |
| Salesforce Pipeline Snapshot | 5-7 days | Salesforce API access |

### Build Waves (Recommended Order)

**Wave 1 — Foundation (Weeks 1-3):**
MSAL auth layer, auto-sync engine, Ask Studio Agent chat widget, Who's In/Out widget, Office Essentials Quick Access

**Wave 2 — Daily Value (Weeks 4-6):**
Holiday Allowance Widget, Birthday/Anniversary Feed, Company Noticeboard, Co-Lab Performance Tracker

**Wave 3 — Intelligence (Weeks 7-10):**
Proactive HR Alerts, Smart Onboarding Flow, Intelligent Leave Planner, Clockify Time Insights, Staff Directory

**Wave 4 — Power Tools (Weeks 11-16):**
Meeting Room Booking, IT Request Portal, AI Content Draft Assistant

**Wave 5 — Premium (Ongoing):**
ESTI Procurement Helper, Photography/Asset Library Search, AI Client Briefing Prep, Supplier Performance Tracker

---

## Relevance AI — Key Details

### IDs
- Project ID: `ca7f193a-f48c-41ab-8c3e-6833ec9a5001`
- Region stack: `bcbe5a`
- Employee agent ID: `b2be3164-2f80-4de8-a8bf-9aa97f04dd8d`
- Admin agent ID: `540367c8-180d-4ed1-8eb0-eac213535433`
- Knowledge table dataset ID: `resolver_knowledge_table_with_status_csv` (includes file extension suffix)

### Employee Agent Tools (9 + resolver)
1. List Working Patterns
2. List My Sicknesses
3. List My Bonuses
4. Create My Leave Request
5. List Departments
6. List My Absences
7. Get My Employee Details
8. List Leave Requests (own)
9. Identity Resolver

### Admin Agent Tools (26 total: 9 employee + 17 admin-specific + resolver)
Admin-specific tools:
1. List Employees — `GET /v1/employees`
2. Get Employee Details — `GET /v1/employees/{employee_id}`
3. Create Employee — `POST /v1/employees`
4. Create Change Request — `POST /v1/employees/{employee_id}/change_requests`
5. List Change Requests — `GET /v1/change_requests`
6. Approve Change Request — `POST /v1/employees/{id}/change_requests/{cid}/approve`
7. List Leave Requests (all) — `GET /v1/leave_requests`
8. Get Leave Request — `GET /v1/leave_requests/{leave_request_id}`
9. Create Leave Request (for any employee) — `POST /v1/employees/{employee_id}/leave_requests`
10. Approve Leave Request — `POST /v1/leave_requests/{id}/approve`
11. Reject Leave Request — `POST /v1/leave_requests/{id}/reject`
12. List Absences — `GET /v1/absences`
13. Cancel Absence — `POST /v1/absences/{absence_id}/cancel`
14. List All Bonuses — `GET /v1/bonuses`
15. List Employee Bonuses — `GET /v1/employees/{employee_id}/bonuses`
16. Get Company Account Details — `GET /v1/account`

Admin tools do NOT need `breathe_employee_id` from resolver (admins specify IDs explicitly). But the admin agent still uses the resolver to verify the requesting user IS an admin.

### Knowledge Table Structure
Fields: `tenant_id`, `aad_object_id`, `breathe_employee_id`, `employee_name`, `status`, `role` (values: "employee" or "admin")

---

## Breathe HR API

- Base URL: `https://api.breathehr.com`
- Currently on SANDBOX key
- Production key swap pending
- All endpoints validated in Layer 1 tests (31 endpoints, all passing)

---

## Azure AD / Microsoft 365

- Maddox AAD Object ID: `81143a8a-a44e-4ca9-941e-341befa6eff2`, Breathe ID: `9811`
- Test employee (Iain Johnson): Breathe ID `1746791`, AAD `06c18e13`
- Real M365 AAD Object IDs for all 57 employees have NOT yet been loaded (CSV uses placeholder tenant strings)
- One Azure AD App Registration powers everything: sync engine, chat proxy, dashboard MSAL auth, attendance proxy

---

## Test Suite

Located in `studio-agent/studio-tests/`. 115-test suite across 4 layers.

### Layers
- **Layer 1**: Direct Breathe HR API validation (31 endpoints)
- **Layer 2**: Individual Relevance AI tool calls via REST API
- **Layer 3**: Full agent conversation tests via SDK
- **Layer 4/4B**: Identity flow diagnostics

### Running
```bash
node studio-tests/run.js              # Full suite
node studio-tests/run.js --only layer1  # Single layer
node studio-tests/run.js --only layer2
node studio-tests/run.js --only layer3
node studio-tests/run.js --report       # Report only
node studio-tests/seed.js              # Create test data
node studio-tests/seed.js --check      # Verify seed state
node studio-tests/seed.js --reset      # Reset test data
```

### Required Env Vars
```
BREATHE_API_KEY=<sandbox or production key>
RELEVANCE_API_KEY=<key>
TEST_AAD_OBJECT_ID=<AAD object ID for test user>
TEST_EXPECTED_EMPLOYEE_ID=<Breathe employee ID for test user>
```

### Current Status
113-114/115 passing. Only transient Relevance AI 502/timeout failures. Zero logic, security, or policy failures. Final clean run pending Relevance AI credits being replenished.

---

## Critical Gotchas (Hard-Won Knowledge)

### Relevance AI Platform Behaviour
- **Template variable substitution silently fails** when `{{breathe_employee_id}}` is nested inside a default value field. Variables MUST be inserted directly into the path field via the dropdown in the Notebook tab.
- **Tool output**: Must use Manual output pointing at the Breathe API call's `response_body`. "Last step" returns only the Python telemetry object `{"success":true}`.
- **`/agents/trigger` endpoint** requires `role: "user"` — `role: "human"` returns 422 validation error.
- **No REST polling endpoints exist** in this API version. The ONLY working approach is `@relevanceai/sdk` with `Agent.sendMessage()` and `task.addEventListener("message", ...)`.
- **Trigger response structure**: `{job_info: {job_id, studio_id}, conversation_id, agent_id, state}` — `job_id` is nested under `job_info`.
- **Input variable names** are auto-assigned as `text`, `text_1` regardless of display labels. Rename via the gear icon — required for `{{template}}` substitution to work.
- **Knowledge Search step output path**: `steps['vector_search']['output']['documents']` (dict of UUID-keyed records), NOT `['output']['results']`.
- **Resolver tool output** must be set to "Last step" in Outputs configuration or it returns `{}`.
- **Tool names** use inconsistent suffixes (`(admin)`, `_(admin)_`) — use a flexible `findToolId()` lookup function.
- **Tools missing baked-in Breathe Account credentials** require `oauth_account_id` workaround.

### SDK Behaviour
- SDK throws `TypeError: fetch failed` with ECONNRESET in `err.cause` (not top-level message) on transient 502s. `isTransientError()` helper must inspect BOTH `err.message` AND `err.cause`.
- SDK's internal polling loop throws outside the Promise chain — need `process.on("uncaughtException")` and `process.on("unhandledRejection")` handlers.
- 2-second inter-test sleep and 3-attempt retry with backoff required to avoid 502 storms.

### Teams Bot
- MSAL Chat Widget is fundamentally anonymous — cannot pass MSAL tokens. Authenticated chat requires the `chatProxy.ts` SDK approach.
- `app.ts` is agent-agnostic: change `RELEVANCE_AGENT_ID` env var → different bot. Zero code changes.

---

## What Needs Doing — Priority Order

### Immediate (can do now)
1. **Build Phase 4 dashboard** (`studio-agent-dashboard/`) — React + Vite + MSAL.js + Tailwind. Start with ChatPanel and AttendanceWidget. This is the primary build target.
2. **Build chatProxy.ts and attendanceProxy.ts** in `studio-agent/src/` — the backend endpoints the dashboard talks to.
3. **Extract `waitForBestAgentReply`** from app.ts into shared module `src/relevanceClient.ts` for use by both app.ts and chatProxy.ts.

### When John Jobling Provides Azure AD Credentials
4. Configure Azure AD App Registration credentials in studio-agent-sync.
5. Test sync cycle end-to-end.
6. Add SPA redirect URI to App Registration for dashboard MSAL auth.
7. Deploy sync engine to Azure Functions.

### Production Cutover
8. Switch Breathe API from sandbox to production key.
9. Update 57-employee CSV with real M365 AAD Object IDs.
10. Run full 115-test suite with production keys.
11. Deploy dashboard to Azure Static Web Apps.

---

## Phase Status Summary

| Phase | What | Status |
|-------|------|--------|
| 1 | Admin bot (Relevance AI agent + 26 tools, 115-test suite) | COMPLETE. 113-114/115 passing. |
| 2 | Auto-sync engine (Azure Functions) | BLOCKED on John Jobling (Azure AD App Registration) |
| 3 | Chat proxy + attendance proxy (Express routes) | Pre-built design, needs coding |
| 4 | React AI Hub dashboard | NOT BUILT — primary build target |
| 5 | Onboarding proactive messages | BLOCKED on org-wide bot deployment |

---

## Key People
- **John Jobling** — Allect IT admin. Controls Teams Admin Centre, Azure AD App Registration. Critical-path blocker.
- **Tracey Brookman** — Operations and People Director
- **Laura Spears** — Head of Operations
- **Iain Johnson** — Test employee identity (Breathe ID `1746791`, AAD `06c18e13`)

---

## Company Context

Allect Design Group operates three luxury interior design brands:
- **Rigby & Rigby** — Architecture, construction, interior design, development management, private client services
- **Helen Green Design** — Interior design
- **Lawson Robb** — Interior design

Offices: Chelsea (29 Milner Street), Mayfair (80 Brook Street, W1K 5EG), Stratford-upon-Avon

Parent company: Rigby Group PLC. SCC UK (Specialist Computer Centres, ~1,900 UK employees) is a sibling company and the primary commercial target for licensing this platform.
