# Testing

| Suite | Location | Runs against | Command |
| --- | --- | --- | --- |
| Unit | `tests/unit` | Pure domain functions | `npx vitest run tests/unit` |
| Integration | `tests/integration` | PostgreSQL `apex_lms_test` (migrated + seeded automatically) | `npm test` |
| End-to-end | `e2e/` | Next.js dev server on port 3100 with `apex_lms_e2e` | `npm run test:e2e` |

Create the databases once:

```sql
CREATE DATABASE apex_lms_test OWNER apex;
CREATE DATABASE apex_lms_e2e OWNER apex;
```

Override with `TEST_DATABASE_URL` / `E2E_DATABASE_URL`; the harness refuses databases whose names do not contain `test`/`e2e`. If Playwright cannot download browsers, set `PLAYWRIGHT_CHROMIUM_PATH` to an installed Chromium.

**Unit (34)** — progress, completion rules and publish validation, scoring and attempt limits, CPD transitions/values/summaries, competency gaps (knowledge vs demonstrated, expiry), compliance rate, Career Development Health rules and thresholds, plan workflow, password policy.

**Integration (33)** — sign-in, uniform failures, lockout, unverified users, session expiry and revocation, password reset; enrolment idempotency, prerequisites, approval routing and scope; content protection; full completion with failed and passed attempts, idempotent completion and certificate, CPD claim and knowledge evidence; attempt limits; instructor grading; assignment approval; recertification cycles; webinar idempotency and waitlist, attendance authorisation, CPD processing idempotency and minimum attendance; CPD review workflow, rejection reasons, self-approval prevention, policy caps; reporting scope, IDOR protection for claims, files and certificates, manager restrictions, mandatory assignment, scoped exports; IDP workflow; course authoring → publish → assign → complete; CSV import validation; scheduled-job de-duplication.

**End-to-end (5)** — employee (log in → dashboard → catalogue → enrol → lessons → assessment → completion → certificate PDF → dashboard and history update), webinar (register → verified attendance by an administrator → CPD processing → CPD dashboard), manager (dashboard → overdue → employee record → feedback → agree plan), administrator (create course → module and lesson → rules → publish → assign → learner sees it), authorisation (access denied, 403 API, cross-origin rejection, 401 without session).
