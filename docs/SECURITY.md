# Security and data protection

Employee development records are treated as confidential.

| Control | Implementation |
| --- | --- |
| Password storage | bcrypt (cost 12) via `bcryptjs`; 12+ character policy with mixed classes |
| Sessions | Random 256-bit tokens; only SHA-256 hashes stored; HTTP-only, SameSite=Lax, `Secure` in production; absolute and idle expiry (configurable); revocation on sign-out, password change/reset and deactivation; users can sign out other sessions |
| Brute force | PostgreSQL-backed rate limits on sign-in (per email and per IP), reset and verification requests; account lockout after configurable failures; uniform error messages and timing equalisation against account enumeration |
| Authorisation | Permission checks in every service function (`server/policy.ts`); reporting scope for managers; pages use `requirePagePermission`; middleware is only a convenience pre-check |
| IDOR | Records outside scope return 404; files are authorised against every record that references them; certificate and claim access checked per record |
| CSRF | Server actions validate Origin (Next.js); REST mutations reject foreign `Origin`; SameSite cookies |
| Input validation | Zod schemas on all inputs; Prisma parameterised queries (no string-built SQL); one raw query uses tagged-template parameters |
| Output encoding | React escaping; lesson Markdown rendered to elements without `dangerouslySetInnerHTML`; CSV formula-injection guard |
| Uploads | Allow-listed MIME types, extension match, magic-byte check, size limit, random storage keys outside the web root, `nosniff`, sandboxing CSP on downloads |
| Headers | `X-Frame-Options: DENY`, `X-Content-Type-Options`, `Referrer-Policy`, `Permissions-Policy`; `poweredByHeader` disabled |
| Audit | Append-only audit log of sign-ins, lockouts, approvals, grading, assessments, assignments, exports and configuration changes |
| Errors | Consistent error envelope; internals logged server-side only |
| Privacy | Executives see aggregates; small groups suppressed; exports scoped and logged; demo data flagged and separated |
| Secrets | Environment variables only |

Recommendations for production: terminate TLS at a trusted proxy and set `COOKIE_SECURE=true`; add a Content-Security-Policy at the edge; run the database with a dedicated least-privileged role; enable database encryption at rest; review role permissions quarterly; integrate SSO with MFA for all staff.
