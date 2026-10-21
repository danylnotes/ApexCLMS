# Apex CLMS

*Competency & Learning Management System — developing competence, strengthening performance, advancing careers.*

**Live read-only demo:** https://danylnotes.github.io/ApexCLMS/ — in English, Arabic or French; sign in with a fictional staff ID to open static snapshots of the app for nine personas (employees, a newly promoted operator, a line manager, an L&D administrator and an executive). Saving and approvals need the full app; see [docs/HOSTING.md](docs/HOSTING.md).

An enterprise learning, competency and career-development platform for an oil and gas organisation. It connects learning activity to demonstrable workplace competence, mandatory-training compliance, CPD and career progression — with role-based access enforced on the server and every record persisted in PostgreSQL.

> The product name, organisation name, monogram and sign-in copy are configurable in **Administration → Configuration**. Nothing company-specific is hard-coded.

## Staff ID sign-in and job-title access

- Staff sign in with their **staff ID** and password. The staff ID resolves the person's record, and through it their **job title** (shown in the header and sidebar on every page).
- Courses carry a **job-title audience**; courses without one are open to everyone (e.g. site-wide mandatory training). Learning paths aimed at a job title follow the same rule. Staff see, search, open and enrol only on content for the job titles they hold an **access grant** for — anything else answers "not found", in the UI and the API.
- **Promotion does not open the next level automatically.** When HR changes someone's job title, the record notes it and the administrator decides when to grant the new level (*Administration → Users → person → Content access by job title*). The employee is notified when access is granted.
- Learning records are never hidden: courses already enrolled on or assigned stay accessible. Assigning restricted content to someone without access is refused until an administrator grants it.

## Languages

The interface is available in **English, Arabic (right-to-left) and French**. Choose a language with the buttons on the sign-in page or the language menu in the app header (on phones: Menu). The choice is remembered; without one, the browser's language is used. Records such as course titles, names and notes appear as entered. See [docs/I18N.md](docs/I18N.md).

## What it does

| Area | Highlights |
| --- | --- |
| Employee workspace | Dashboard answering *what have I learned, how far have I come, which competencies, where are my gaps, what next*; Career Development Health (5 transparent, rule-based dimensions — no composite score); development priorities derived from real requirements |
| Learning | Catalogue with search, 10 filters, sorting and pagination; course details; course player (reading, PDF/documents, video, external, assessments, practical assignments, acknowledgements); server-side progress, completion rules and certificates (PDF); learning paths with prerequisites; recertification cycles |
| Webinars | Registration (idempotent, capacity + waitlist), meeting link only for registrants, calendar (.ics) export, verified attendance (never inferred from registration), recordings, feedback, CPD processing |
| CPD | Policy-based targets (none imposed universally), hours or points, per-activity caps, Draft → Submitted → Under review → Approved/Rejected with auditable history, evidence uploads, CSV and PDF statements, company-recorded vs professional-body recognition |
| Competency | Configurable frameworks, proficiency levels, role requirements, evidence-based assessments (append-only history), knowledge vs demonstrated competence, review requests, gap matrix |
| Development plans | IDP objectives (optional 70-20-10 model), Draft → Employee Review → Manager Review → Agreed → In Progress → Completed, comments, revision snapshots, printable plan |
| Management | Team dashboard with defined metrics and filters, management questions answered from data, team learning, employee development review, assignment, enrolment approvals, competency gap analysis, scoped exports |
| Administration | Courses (modules, lessons, materials, assessments, completion/CPD/enrolment rules, review/publish/archive), learning paths, webinars, assessments, competency frameworks, CPD policies and periods, users (invite, CSV import, deactivate), organisation data, role permissions, certificate templates and revocation, analytics, audit log, configuration |
| Executive insights | Aggregated analytics only; departments with fewer than three employees are suppressed |

## Quick start (development)

Prerequisites: Node.js 20+ and PostgreSQL 14+.

```bash
git clone https://github.com/danylnotes/ApexCLMS.git && cd ApexCLMS
cp .env.example .env              # set DATABASE_URL; set DEMO_MODE="true" for local demos
npm install
npx prisma migrate deploy         # create the schema
npm run db:seed                   # FICTIONAL demonstration data (refuses to run in production)
npm run dev                       # http://localhost:3000
```

### Demonstration accounts (fictional)

All use the password `Demo#Apex2026!`. Every demo user is flagged `isDemo` and uses the reserved `.test` domain.

| Persona | Staff ID |
| --- | --- |
| New employee (3 weeks), Field Operator | D-20101 |
| Several completed courses / instructor | D-20102 |
| Overdue mandatory training | D-20103 |
| Progressing through a learning path | D-20104 |
| Pending CPD claims | D-20105 |
| Promoted to Senior Operator — next level awaiting admin | D-20109 |
| Line manager (and instructor) | D-10003 |
| Instructor | D-10004 |
| L&D administrator | D-10001 |
| Executive / HR leadership | D-10002 |

## Scripts

| Command | Purpose |
| --- | --- |
| `npm run dev` / `build` / `start` | Develop, build and run the production server |
| `npm run typecheck` / `lint` | Static checks |
| `npm run db:deploy` / `db:migrate` | Apply migrations (production) / create migrations (development) |
| `npm run db:seed` | Load fictional demonstration data (truncates the database) |
| `npm run jobs:run` | Run scheduled processes (reminders, overdue notices, expiries) once |
| `npm test` | Unit + integration tests (uses the `apex_lms_test` database) |
| `npm run test:e2e` | Playwright journeys (uses the `apex_lms_e2e` database) |

## Documentation

- [Architecture](docs/ARCHITECTURE.md) — structure, data model, design system, key rules
- [API](docs/API.md) — REST contracts and error format
- [Deployment](docs/DEPLOYMENT.md) — environment variables, migrations, build, health checks, scheduling, logging, backup, integration points
- [Security](docs/SECURITY.md) — controls and threat considerations
- [Hosting](docs/HOSTING.md) — GitHub Pages demo and running the full app on Render or Docker
- [Testing](docs/TESTING.md) — test strategy and how to run each suite

## Implementation status — what is and is not operational

Operational and tested: authentication (sessions, lockout, reset, invitation/verification), RBAC with reporting scope, every page listed above, private file storage, certificate and CPD statement PDFs, CSV exports, in-app notifications with de-duplication, scheduled jobs, audit logging.

Documented integration points — **not active** in this release (the UI states this explicitly):

- **Microsoft Entra ID SSO** — `/sso` reports configuration status; the OIDC flow is not implemented. See *Deployment → SSO*.
- **Email delivery via SMTP/Graph** — the `outbox` provider records every message in `email_outbox`; other providers queue without sending. See *Deployment → Email*.
- **Teams/Zoom attendance import** — the data model has `meetingProvider`, `externalMeetingId` and the `PLATFORM_RECORD` verification method; attendance reports are currently entered by an authorised user.
- **Object storage (S3/Azure Blob)** — files use a private local volume behind an authorising route; the storage module is the single place to swap the driver.
- **Video** — video lessons play from an approved streaming URL; position is tracked as far as the HTML5 player allows. No video hosting is bundled.
