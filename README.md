# APEX Learning & Development

*Developing Competence. Strengthening Performance. Advancing Careers.*

**Live read-only demo:** https://danylnotes.github.io/ApexCLMS/ — static snapshots of the app for eight fictional personas (employees, a line manager, an L&D administrator and an executive). Saving and approvals need the full app; see [docs/HOSTING.md](docs/HOSTING.md).

An enterprise learning, competency and career-development platform for an oil and gas organisation. It connects learning activity to demonstrable workplace competence, mandatory-training compliance, CPD and career progression — with role-based access enforced on the server and every record persisted in PostgreSQL.

> The product name, organisation name, monogram and sign-in copy are configurable in **Administration → Configuration**. Nothing company-specific is hard-coded.

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

| Persona | Email |
| --- | --- |
| New employee (3 weeks) | lina.saleh@apex-demo.test |
| Several completed courses / instructor | james.okafor@apex-demo.test |
| Overdue mandatory training | daniel.reyes@apex-demo.test |
| Progressing through a learning path | aisha.rahman@apex-demo.test |
| Pending CPD claims | priya.natarajan@apex-demo.test |
| Line manager (and instructor) | omar.haddad@apex-demo.test |
| Instructor | graham.whitfield@apex-demo.test |
| L&D administrator | helen.mercer@apex-demo.test |
| Executive / HR leadership | catherine.lowe@apex-demo.test |

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
