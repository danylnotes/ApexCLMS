/**
 * Builds a static, read-only demonstration site for GitHub Pages.
 *
 * GitHub Pages serves static files only, so it cannot run the platform's server, sign-in or
 * PostgreSQL database. This script signs in to a running instance as each fictional demo persona,
 * crawls every page that persona can reach, and saves the rendered HTML with links and assets
 * rewritten to relative paths. Scripts are removed; forms show a "read-only demo" notice.
 *
 * Usage: start the app (seeded with demo data), then
 *   node scripts/build-static-demo.mjs --base http://localhost:3200 --out pages-demo
 */
import { chromium } from "playwright";
import { mkdir, writeFile, rm } from "node:fs/promises";
import path from "node:path";

const arg = (k, d) => {
  const i = process.argv.indexOf(`--${k}`);
  return i > -1 ? process.argv[i + 1] : d;
};
const BASE = arg("base", "http://localhost:3200");
const OUT = path.resolve(arg("out", "pages-demo"));
const PASSWORD = "Demo#Apex2026!";
const MAX_PAGES = Number(arg("max", 260));
const REPO_URL = arg("repo", "https://github.com/danylnotes/ApexCLMS");

const PERSONAS = [
  { key: "lina", email: "lina.saleh@apex-demo.test", name: "Lina Saleh", role: "Field Operator · new employee", look: "A three-week starter: induction learning path, first mandatory training and no history yet." },
  { key: "james", email: "james.okafor@apex-demo.test", name: "James Okafor", role: "Senior Process Engineer · instructor", look: "Several completed courses, certificates, CPD on track and an agreed development plan towards Operations Superintendent." },
  { key: "daniel", email: "daniel.reyes@apex-demo.test", name: "Daniel Reyes", role: "Senior Operator", look: "Overdue mandatory training, an expired certificate in recertification and competency reassessments due." },
  { key: "aisha", email: "aisha.rahman@apex-demo.test", name: "Aisha Rahman", role: "Field Operator · on a learning path", look: "Progressing through Field Operator Development, with a practical assignment and a plan awaiting her manager." },
  { key: "priya", email: "priya.natarajan@apex-demo.test", name: "Priya Natarajan", role: "Reliability Engineer", look: "CPD claims at every stage: draft, submitted, under review, approved and rejected with a reason." },
  { key: "omar", email: "omar.haddad@apex-demo.test", name: "Omar Haddad", role: "Operations Superintendent · line manager", look: "Team dashboard, overdue learning, plan approvals, competency gap matrix and grading as an instructor." },
  { key: "helen", email: "helen.mercer@apex-demo.test", name: "Dr Helen Mercer", role: "L&D Administrator", look: "Course authoring, webinars and attendance, CPD review queue, users, roles, reports, audit log and configuration." },
  { key: "catherine", email: "catherine.lowe@apex-demo.test", name: "Catherine Lowe", role: "HR Director · executive", look: "Organisational insights in aggregate only, with small groups suppressed." },
];

const SKIP = [/^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/verify/, /^\/session-expired/, /^\/sso/, /^\/access-denied/];
const FILE_API = /^\/api\/v1\/(certificates\/[^/]+\/pdf|exports\/[^/?]+|files\/[^/?]+|webinars\/[^/]+\/ics)/;

const slugOf = (u) => {
  const url = new URL(u, BASE);
  let s = url.pathname === "/" ? "index" : url.pathname.slice(1).replace(/\//g, "~");
  if (url.search) s += "__" + url.search.slice(1).replace(/[=&]/g, "-");
  return s.replace(/[^A-Za-z0-9~_.-]/g, "_").slice(0, 180);
};
const normal = (href) => {
  try {
    const u = new URL(href, BASE);
    if (u.origin !== new URL(BASE).origin) return null;
    u.hash = "";
    return u.pathname + u.search;
  } catch {
    return null;
  }
};

const assets = new Set();

async function crawlPersona(browser, p) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  const page = await ctx.newPage();
  await page.goto(`${BASE}/login`);
  await page.fill("#email", p.email);
  await page.fill("#password", PASSWORD);
  await Promise.all([page.waitForURL(/dashboard/, { timeout: 120000 }), page.click("button[type=submit]")]);

  const queue = ["/dashboard"];
  const seen = new Set(queue);
  const pages = new Map(); // url -> html
  const files = new Map(); // url -> filename
  while (queue.length && pages.size < MAX_PAGES) {
    const url = queue.shift();
    if (FILE_API.test(url)) {
      const r = await ctx.request.get(BASE + url);
      if (r.ok()) {
        const type = r.headers()["content-type"] ?? "";
        const ext = type.includes("pdf") ? ".pdf" : type.includes("csv") ? ".csv" : type.includes("calendar") ? ".ics" : type.includes("png") ? ".png" : type.includes("jpeg") ? ".jpg" : "";
        const name = `${slugOf(url)}${ext}`;
        await mkdir(path.join(OUT, "p", p.key, "files"), { recursive: true });
        await writeFile(path.join(OUT, "p", p.key, "files", name), Buffer.from(await r.body()));
        files.set(url, name);
      }
      continue;
    }
    const res = await page.goto(BASE + url, { timeout: 120000 }).catch(() => null);
    if (!res || res.status() >= 400) continue;
    const landed = normal(page.url());
    if (landed !== url) continue; // redirected (e.g. access denied): not part of this persona's site
    // Charts measure their container after hydration; give client components a moment to render.
    if (/manager|insights|admin\/reports/.test(url)) await page.waitForTimeout(700);
    const { html, links } = await page.evaluate(() => {
      document.querySelectorAll("script, link[rel=modulepreload], link[rel=preload][as=script], next-route-announcer, nextjs-portal").forEach((n) => n.remove());
      const links = [...document.querySelectorAll("a[href]")].map((a) => a.getAttribute("href"));
      document.querySelectorAll("link[rel=stylesheet], link[rel=preload][as=font], link[rel=preload][as=style]").forEach((l) => links.push("__asset__" + l.getAttribute("href")));
      return { html: "<!doctype html>\n" + document.documentElement.outerHTML, links };
    });
    pages.set(url, html);
    for (const raw of links) {
      if (!raw) continue;
      if (raw.startsWith("__asset__")) {
        assets.add(raw.slice(9));
        continue;
      }
      const n = normal(raw);
      if (!n || seen.has(n) || SKIP.some((r) => r.test(n))) continue;
      if (n.startsWith("/api/") && !FILE_API.test(n)) continue;
      if (/[?&]page=([4-9]|\d\d)/.test(n)) continue;
      // Keep the catalogue to single-facet views (each category, each sort, each page) rather than every combination.
      if (n.startsWith("/catalogue?") && new URLSearchParams(n.split("?")[1]).size > 1) continue;
      seen.add(n);
      queue.push(n);
    }
  }
  await ctx.close();
  console.log(`${p.key}: ${pages.size} pages, ${files.size} files`);
  return { pages, files };
}

function demoChrome(p) {
  return `<!--demo-chrome-->
<style>
:root{--demo-h:34px}
body{padding-top:var(--demo-h)}
#demo-bar{position:fixed;top:0;left:0;right:0;height:var(--demo-h);z-index:60;display:flex;gap:14px;align-items:center;justify-content:center;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(56px,env(safe-area-inset-left,0px));background:#a66234;color:#fff;font:500 12.5px/1 Inter,system-ui,sans-serif;white-space:nowrap;overflow:hidden}
#demo-bar a{color:#fff;text-decoration:underline;text-underline-offset:2px}
#demo-bar .long{overflow:hidden;text-overflow:ellipsis}
@media (max-width:640px){#demo-bar .wide{display:none}}
aside.fixed.bg-navy{top:var(--demo-h)}
button[aria-controls="mobile-nav"]{top:calc(var(--demo-h) + 8px)!important}
header.sticky{top:var(--demo-h)!important}
#demo-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:70;width:max-content;max-width:min(92vw,520px);padding:12px 16px;border-radius:6px;background:#162644;color:#fff;font:14px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgb(16 24 40/.25)}
#demo-toast[hidden]{display:none}
body.demo-nav-open aside.bg-navy.fixed{display:flex!important;z-index:35;padding-top:44px;box-shadow:0 8px 24px rgb(16 24 40/.3)}
</style>
<div id="demo-bar" role="note"><span class="long">Read-only demo · <b>${p.name}</b><span class="wide"> (${p.role})</span></span><a href="../../index.html">Switch persona</a><a class="wide" href="${REPO_URL}" target="_blank" rel="noopener">Source</a></div>
<div id="demo-toast" role="status" hidden></div>
<script>
(function(){
  var t=document.getElementById('demo-toast'),timer;
  function toast(m){t.textContent=m;t.hidden=false;clearTimeout(timer);timer=setTimeout(function(){t.hidden=true},5200);}
  document.addEventListener('submit',function(e){
    e.preventDefault();
    var b=e.submitter;
    if(b&&/Sign out/.test(b.textContent||'')){location.href='../../index.html';return;}
    toast('This is a static, read-only demonstration on GitHub Pages, so nothing is saved. Run the full app (Next.js and PostgreSQL) to use forms, enrolment, assessments and approvals.');
  },true);
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button[aria-controls="mobile-nav"]');
    if(b){var o=document.body.classList.toggle('demo-nav-open');b.setAttribute('aria-expanded',o);}
  });
})();
</script><!--/demo-chrome-->`;
}

function rewrite(html, p, pageSlugs, files) {
  const rel = (target) => target; // all persona pages share one flat directory
  html = html.replace(/\s(href|src|action)="([^"]*)"/g, (m, attr, val) => {
    const v = val.replace(/&amp;/g, "&");
    if (v.startsWith("/_next/")) return ` ${attr}="../../assets${v}"`;
    if (!v.startsWith("/")) return m;
    const n = normal(v);
    if (n && files.has(n)) return ` ${attr}="${rel("files/" + files.get(n))}"`;
    if (n && pageSlugs.has(n)) return ` ${attr}="${rel(pageSlugs.get(n) + ".html")}"`;
    if (attr === "action") return ` ${attr}="#"`;
    return ` ${attr}="../../not-in-demo.html"`;
  });
  // GET search forms (catalogue filters, top search) would otherwise point at the server.
  html = html.replace(/<form([^>]*)action="\.\.\/\.\.\/not-in-demo\.html"/g, '<form$1action="#"');
  return html.replace(/<body([^>]*)>/, (m) => `${m}${demoChrome(p)}`).replace(/<title>/, "<title>Demo · ");
}

async function fetchAssets() {
  const queue = [...assets];
  const done = new Set();
  while (queue.length) {
    const a = queue.shift();
    if (done.has(a)) continue;
    done.add(a);
    const r = await fetch(BASE + a);
    if (!r.ok) continue;
    const dest = path.join(OUT, "assets", a);
    await mkdir(path.dirname(dest), { recursive: true });
    if (a.endsWith(".css")) {
      let css = await r.text();
      css = css.replace(/url\((["']?)(\/_next\/[^)"']+)\1\)/g, (m, q, u) => {
        queue.push(u);
        return `url(${q}${path.posix.relative(path.posix.dirname(a), u)}${q})`;
      });
      await writeFile(dest, css);
    } else {
      await writeFile(dest, Buffer.from(await r.arrayBuffer()));
    }
  }
  console.log(`assets: ${done.size}`);
}

function indexPage() {
  const cards = PERSONAS.map((p) => `
      <li class="card">
        <p class="role">${p.role}</p>
        <h2>${p.name}</h2>
        <p class="look">${p.look}</p>
        <a class="open" href="p/${p.key}/dashboard.html">Open as ${p.name.replace(/^Dr /, "").split(" ")[0]} <span aria-hidden="true">→</span></a>
      </li>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>APEX Learning &amp; Development · Demo</title>
<meta name="description" content="Read-only demonstration of the APEX Learning & Development platform with fictional data.">
<link rel="preconnect" href="https://fonts.googleapis.com">
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Inter:wght@400;500;600&family=Source+Serif+4:opsz,wght@8..60,600&family=Source+Sans+3:wght@400&display=swap">
<style>
:root{--navy:#162644;--copper:#a66234;--canvas:#f9f8f5;--surface:#fff;--ink:#1c1f24;--muted:#58606c;--line:#e3e1dc}
*{box-sizing:border-box}
body{margin:0;background:var(--canvas);color:var(--ink);font:16px/1.6 "Source Sans 3",system-ui,sans-serif}
.hero{background:var(--navy);color:#fff;padding:56px max(16px,env(safe-area-inset-right,0px)) 48px max(16px,env(safe-area-inset-left,0px));background-image:linear-gradient(rgb(255 255 255/.06) 1px,transparent 1px),linear-gradient(90deg,rgb(255 255 255/.06) 1px,transparent 1px);background-size:32px 32px}
.wrap{max-width:1120px;margin:0 auto}
.brand{display:flex;align-items:center;gap:12px;font:600 14px Inter,sans-serif}
.mono{display:inline-flex;width:36px;height:36px;align-items:center;justify-content:center;border:1px solid rgb(255 255 255/.35);border-radius:3px;font:600 18px "Source Serif 4",serif}
.eyebrow{margin:40px 0 8px;font:600 11px Inter,sans-serif;letter-spacing:.09em;text-transform:uppercase;color:#e2b48c}
h1{margin:0;font:600 clamp(30px,5vw,44px)/1.12 "Source Serif 4",Georgia,serif;text-wrap:balance;max-width:20ch}
.lede{max-width:64ch;color:rgb(255 255 255/.78);font-size:17px;margin:14px 0 0}
main{padding:40px max(16px,env(safe-area-inset-right,0px)) 64px max(16px,env(safe-area-inset-left,0px))}
.note{max-width:76ch;margin:0 0 32px;padding:12px 16px;border:1px solid var(--line);border-left:3px solid var(--copper);background:var(--surface);font-size:15px}
h2.section{font:600 22px "Source Serif 4",serif;color:var(--navy);margin:0 0 16px}
ul.grid{list-style:none;margin:0;padding:0;display:grid;grid-template-columns:repeat(auto-fill,minmax(250px,1fr));gap:16px}
.card{display:flex;flex-direction:column;gap:6px;padding:20px;background:var(--surface);border:1px solid var(--line);border-radius:6px}
.card h2{margin:0;font:600 19px "Source Serif 4",serif;color:var(--navy)}
.role{margin:0;font:600 11px Inter,sans-serif;letter-spacing:.06em;text-transform:uppercase;color:var(--muted)}
.look{margin:0;color:var(--muted);font-size:15px;flex:1}
.open{align-self:flex-start;margin-top:8px;padding:8px 14px;border-radius:4px;background:var(--navy);color:#fff;text-decoration:none;font:500 14px Inter,sans-serif}
.open:hover,.open:focus-visible{background:#23385e;outline:2px solid var(--copper);outline-offset:2px}
footer{max-width:1120px;margin:40px auto 0;color:var(--muted);font-size:14px;border-top:1px solid var(--line);padding-top:16px}
a{color:var(--navy)}
</style>
</head>
<body>
<header class="hero"><div class="wrap">
  <div class="brand"><span class="mono">A</span>APEX Learning &amp; Development</div>
  <p class="eyebrow">Learning · Competence · Careers</p>
  <h1>Developing Competence. Strengthening Performance. Advancing Careers.</h1>
  <p class="lede">An enterprise learning, competency and career-development platform for an oil and gas organisation. Choose a fictional employee, manager or administrator to explore the platform as they see it.</p>
</div></header>
<main><div class="wrap">
  <p class="note"><b>This is a static, read-only demonstration.</b> GitHub Pages can only serve static files, so each page here is a snapshot captured from the running application for that person. You can browse dashboards, courses, CPD, competencies, plans, reports and administration screens. Saving, enrolling, submitting and approving require the full application (Next.js and PostgreSQL) — see <a href="${REPO_URL}" target="_blank" rel="noopener">the source and setup guide</a>.</p>
  <h2 class="section">Choose a persona</h2>
  <ul class="grid">${cards}
  </ul>
  <footer>All people, the organisation “Meridian Energy” and every record are fictional demonstration data. Snapshot generated ${new Date().toISOString().slice(0, 10)}.</footer>
</div></main>
</body>
</html>`;
}

const notInDemo = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not in the demo</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f9f8f5;color:#1c1f24;font:16px/1.6 system-ui,sans-serif;padding:24px}main{max-width:52ch}h1{font:600 28px Georgia,serif;color:#162644;margin:0 0 8px}a{color:#162644}</style></head>
<body><main><h1>Not included in the static demo</h1><p>This page needs the live application — for example a filtered search, a form result or a record the selected persona cannot see. The static demo contains every page each persona can reach by navigation.</p><p><a href="javascript:history.back()">Go back</a> · <a href="index.html">Choose a persona</a></p></main></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
// Personas are crawled concurrently in separate browser contexts.
await Promise.all(
  PERSONAS.map(async (p) => {
    const { pages, files } = await crawlPersona(browser, p);
    const slugs = new Map([...pages.keys()].map((u) => [u, slugOf(u)]));
    await mkdir(path.join(OUT, "p", p.key), { recursive: true });
    for (const [u, html] of pages) await writeFile(path.join(OUT, "p", p.key, `${slugs.get(u)}.html`), rewrite(html, p, slugs, files));
  }),
);
await browser.close();
await fetchAssets();
await writeFile(path.join(OUT, "index.html"), indexPage());
await writeFile(path.join(OUT, "not-in-demo.html"), notInDemo.replace('href="index.html"', 'href="index.html"'));
await writeFile(path.join(OUT, "404.html"), notInDemo);
await writeFile(path.join(OUT, ".nojekyll"), "");
console.log(`Static demo written to ${OUT}`);
