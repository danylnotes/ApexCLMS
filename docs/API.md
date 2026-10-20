# API (v1)

Base path `/api/v1`. JSON in and out. Authentication uses the same HTTP-only session cookie (`apex_session`) as the web application; obtain it with `POST /auth/login`. All state-changing requests must be same-origin (requests with a foreign `Origin` header are rejected with 403).

## Response format

Success: `{ "data": … }` (file, CSV, PDF and calendar endpoints stream the file instead).

Error:

```json
{ "error": { "code": "VALIDATION", "message": "Human-readable message", "details": { "field": ["…"] } } }
```

| Code | HTTP | Meaning |
| --- | --- | --- |
| UNAUTHENTICATED | 401 | No valid session (or session expired) |
| FORBIDDEN | 403 | Authenticated but not permitted, or cross-origin |
| NOT_FOUND | 404 | Missing — **also returned for records outside your scope**, so identifiers cannot be probed |
| VALIDATION | 422 | Invalid input or a business rule was not met |
| CONFLICT | 409 | Duplicate or concurrent change |
| RATE_LIMITED | 429 | Too many attempts |
| INTERNAL | 500 | Logged server-side; no internals are returned |

Collection endpoints accept `page` and `pageSize` (max 50–100) and return `{ items, page, total }`.

## Endpoints

| Method & path | Who | Description |
| --- | --- | --- |
| `GET /health` | public | Liveness/readiness; checks the database. 503 when degraded. |
| `POST /auth/login` `{staffId,password}` | public | Starts a session (rate-limited, lockout after repeated failures). |
| `POST /auth/logout` | any | Revokes the current session. |
| `GET /me` | any | Your metrics, compliance and Career Development Health with methods. |
| `GET /courses?q&category&department&competency&difficulty&duration&cpd&delivery&mandatory&availability&sort&page` | learner | Published catalogue with your enrolment status. |
| `GET /courses/{id or slug}` | learner | Course details and curriculum outline (no lesson bodies). |
| `POST /enrollments` `{courseId}` | learner | Idempotent enrolment; returns `PENDING_APPROVAL` when approval is required. |
| `POST /lessons/{id}/progress` `{seconds, videoPosition?}` | enrolled | Records viewing time (capped per call). |
| `POST /lessons/{id}/complete` | enrolled | Completes a self-completable lesson and re-evaluates course completion. |
| `POST /assessments/{id}/attempts` `{answers:[{questionId, selectedOptionId?, booleanAnswer?, textAnswer?}]}` | enrolled | Submits and scores an attempt; short answers go to instructor review. |
| `GET /webinars?when=past&page` | learner | Webinars with phase and your registration. |
| `POST /webinars/{id}/registration` · `DELETE …` | learner | Register (idempotent; waitlists beyond capacity) / cancel. |
| `GET /webinars/{id}/ics` | learner | iCalendar file. |
| `POST /webinars/{id}/attendance` `{entries:[{registrationId, attended, attendedMinutes, verification, notes}]}` | webinar manager / instructor | Records verified attendance. |
| `GET /cpd/claims?status` · `POST /cpd/claims` | learner | Your claims / create a claim (`submit: true` to submit). |
| `POST /cpd/claims/{id}/decision` `{decision: UNDER_REVIEW\|APPROVED\|REJECTED, approvedValue?, comment?}` | `cpd.approve` | Review a claim (not your own). |
| `POST /competency-assessments` `{userId, competencyId, level, method, evidenceDescription, …}` | `competency.assess` within scope | Records an assessment; supersedes the current one. |
| `POST /development-plans/{id}/transition` `{to, comment?}` | owner / reviewing manager | Workflow transition. |
| `POST /assignments` `{target, userIds?, departmentId?, jobRoleId?, courseId? \| pathId?, kind, isMandatory?, dueDate?, reason?}` | `team.assign` (scope) / `mandatory.assign` | Assign or recommend learning. |
| `GET /notifications?unread=true` · `POST /notifications/read` `{ids?}` | any | Your notifications / mark read. |
| `GET /reports/analytics?scope=team\|org&department&unit&role&location&category&employment&from&to` | manager / `reports.org` / `analytics.aggregate` | Aggregated analytics with metric definitions. |
| `GET /certificates/{id}/pdf` | holder, scope, `certificate.manage` | Certificate PDF. |
| `GET /files/{id}` | authorised per referencing record | Streams a private file. |
| `GET /exports/{history\|completions\|cpd\|competency\|cpd-statement}` | self | Your records (CSV; CPD statement as PDF). |
| `GET /exports/{team-learning\|team-compliance}` | `team.view` | Your reporting line (logged). |
| `GET /exports/{org-learning\|org-compliance}` | `reports.org` | Organisation (logged). |
| `POST /jobs/run` (`Authorization: Bearer $JOBS_SECRET`) | scheduler | Runs scheduled processes. |

## Example

```bash
curl -c jar -H 'Content-Type: application/json' -d '{"staffId":"D-20101","password":"Demo#Apex2026!"}' http://localhost:3000/api/v1/auth/login
curl -b jar 'http://localhost:3000/api/v1/courses?q=safety&cpd=yes'
```
