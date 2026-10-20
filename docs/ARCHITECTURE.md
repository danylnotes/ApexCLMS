# Architecture

## Overview

A single Next.js 15 (App Router, React 19, TypeScript) application with server-rendered pages, server actions for UI mutations and a versioned REST API (`/api/v1`). PostgreSQL via Prisma ORM. No client-side state is authoritative: progress, completion, scores and approvals are computed and stored on the server.

```
ApexCLMS/
  prisma/              schema.prisma, migrations/, seed.ts (+ seed/ data)
  src/
    app/
      (auth)/          login, forgot/reset password, verify, access-denied, session-expired, sso
      (app)/           authenticated application (layout = shell + session check)
        learner-actions.ts, staff-actions.ts   server actions (thin wrappers over services)
        dashboard, my-learning, catalogue, courses/[slug], learn/[slug], learning-paths, webinars,
        cpd, competencies, career, development-plan, certificates, history, notifications, profile, help,
        teaching, manager/*, insights, admin/*
      api/v1/          REST route handlers
    server/            server-only code
      auth/            crypto (bcrypt, tokens), session (DB sessions, cookie, actor)
      services/        business logic — every function takes an Actor and authorises itself
      policy.ts        authorisation rules (permissions + reporting scope)
      permissions.ts   permission catalogue and default role grants
      db.ts, errors.ts, audit.ts, notify.ts, email.ts, storage.ts, settings.ts, rate-limit.ts, api.ts
    lib/domain/        pure, unit-tested rules: progress, completion, scoring, cpd, competency, compliance, health, plan
    components/        design-system components (ui.tsx, forms.tsx, charts), shared views
  tests/unit, tests/integration, e2e/
```

**Layering.** Pages and route handlers → services → domain functions + Prisma. Services never trust the caller: each one checks permissions and scope (see `policy.ts`) before reading or writing. Hiding a button in the UI is never the control.

## Data model

Defined in `prisma/schema.prisma` (tables are snake_case, columns camelCase). Main groups:

- **Identity and organisation**: `users`, `user_profiles`, `roles`, `permissions`, `role_permissions`, `user_roles`, `business_units`, `departments`, `job_roles`, `career_pathways`, `manager_relationships` (time-bounded LINE/DOTTED).
- **Authentication**: `sessions` (hashed tokens, expiry, revocation), `auth_tokens` (reset/verification/invitation, hashed, single use), `rate_limit_buckets`.
- **Content**: `course_categories`, `courses`, `course_departments`, `course_instructors`, `course_prerequisites`, `course_competencies`, `course_modules`, `lessons`, `lesson_resources`, `assessments`, `assessment_questions`, `learning_paths`, `learning_path_items` (with in-path prerequisite), `learning_path_competencies`.
- **Participation**: `enrollments` (unique per user/course/**cycle** — recertification opens a new cycle), `lesson_progress`, `assessment_attempts`, `assessment_responses`, `assignment_submissions`, `course_completions` (one per enrolment, with a snapshot of the rules satisfied), `certificates` (one per completion), `credentials`, `learning_activity_events`, `learning_path_enrollments`.
- **Webinars**: `webinars`, `webinar_registrations`, `webinar_attendance` (with verification method), `webinar_recordings`, `webinar_feedback`.
- **CPD**: `cpd_policies`, `reporting_periods`, `cpd_activities`, `cpd_claims`, `cpd_evidence`, `cpd_approvals` (append-only transition history).
- **Competency**: `competency_frameworks`, `proficiency_levels`, `competency_domains`, `competencies`, `role_competency_requirements`, `competency_assessments` (CURRENT → SUPERSEDED, never overwritten), `competency_evidence`, `competency_assessment_history`, `competency_review_requests`.
- **Career**: `development_plans`, `development_objectives`, `development_actions`, `development_reviews` (each transition with a JSON snapshot), `development_comments`.
- **Operations**: `learning_assignments`, `notifications` (unique `userId + dedupeKey`), `notification_preferences`, `email_outbox`, `reports` (export log), `audit_logs`, `platform_settings`, `job_runs`, `stored_files`.

Integrity: foreign keys with explicit `onDelete` behaviour (history is `Restrict`ed), unique constraints that make key operations idempotent (enrolment cycle, completion per enrolment, certificate per completion, CPD activity per completion/attendance, attendance per registration, notification per dedupe key), and indexes on the hot query paths.

## Key rules (all server-side)

- **Completion** (`lib/domain/completion.ts`): only enabled rules are checked (required lessons, final assessment passed, assignment approved, acknowledgement). A course with no enabled rule can never complete; publishing validates that the configured rules are satisfiable. `tryCompleteCourse` runs in a serializable transaction and is idempotent.
- **CPD**: only the configured CPD value of a course or webinar is claimable — never estimated study time. Auto-approval applies only when the learner's policy allows it for platform-verified learning.
- **Competence vs knowledge**: course completion creates a `KNOWLEDGE` assessment; it counts towards a role requirement only if the framework's `allowCourseCompletionAsCompetence` is on. Expired assessments (past reassessment date) do not count.
- **Attendance**: created only by an authorised recorder with a verification method; `UNVERIFIED` records are kept but excluded from CPD.
- **Career Development Health**: five dimensions with explicit rules and configurable thresholds (`platform_settings.health`). Each dimension shows its evidence, gaps, next step and method. There is intentionally no overall index.
- **Job-title content access** (`server/services/access.ts`): `course_audiences` lists the job titles a course is for (none = open to all); `content_access_grants` lists the job titles a person may see, decided by administrators. Catalogue, course pages, the player, enrolment, learning paths, recommendations, plan actions, assignments and the API all apply it. A job-title change is audited but grants nothing; existing enrolments and assignments keep their content accessible. Content administrators (`course.manage`) see everything.
- **Reporting scope**: managers see their direct and indirect LINE reports; L&D with `reports.org` see everyone; executives (`analytics.aggregate`) see aggregates only, with small groups suppressed.

## Design system

Tokens are CSS variables in `src/app/globals.css` (near-black ink and sidebar, lime accent for active states, off-white canvas, white rounded cards, pastel lavender/peach/mint/sky chips; semantic ok/warn/crit/info/idle) mapped into Tailwind. Typography: Plus Jakarta Sans. Components in `src/components/ui.tsx` (PageHeader, Panel, Status pills, Metric, Table, segmented TabNav, Progress, Field, Notice…) and `src/components/widgets.tsx` (ProgressRing, BarChart, MiniCalendar, StatCard). The sign-in page uses the organisation's plant photography (`public/login/`). Status is always conveyed with text and a shape glyph (● ▲ ■ ○), never colour alone. Metrics carry a "How is this calculated?" disclosure.

## Scaling notes

Analytics are computed from live records in application code, which is appropriate for the demonstration and for populations of a few thousand. For larger estates move the aggregates in `services/analytics.ts` to SQL views or materialised tables refreshed by the scheduler, and catalogue relevance to PostgreSQL full-text search.
