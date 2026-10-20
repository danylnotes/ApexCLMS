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
import { copyFile, mkdir, writeFile, rm } from "node:fs/promises";
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
  { key: "lina", staffId: "D-20101", email: "lina.saleh@apex-demo.test", name: "Lina Saleh", role: "Field Operator · new employee", look: "A three-week starter: induction learning path, first mandatory training and no history yet." },
  { key: "james", staffId: "D-20102", email: "james.okafor@apex-demo.test", name: "James Okafor", role: "Senior Process Engineer · instructor", look: "Several completed courses, certificates, CPD on track and an agreed development plan towards Operations Superintendent." },
  { key: "daniel", staffId: "D-20103", email: "daniel.reyes@apex-demo.test", name: "Daniel Reyes", role: "Senior Operator", look: "Overdue mandatory training, an expired certificate in recertification and competency reassessments due." },
  { key: "aisha", staffId: "D-20104", email: "aisha.rahman@apex-demo.test", name: "Aisha Rahman", role: "Field Operator · on a learning path", look: "Progressing through Field Operator Development, with a practical assignment and a plan awaiting her manager." },
  { key: "priya", staffId: "D-20105", email: "priya.natarajan@apex-demo.test", name: "Priya Natarajan", role: "Reliability Engineer", look: "CPD claims at every stage: draft, submitted, under review, approved and rejected with a reason." },
  { key: "kwame", staffId: "D-20109", email: "kwame.mensah@apex-demo.test", name: "Kwame Mensah", role: "Promoted to Senior Operator", look: "HR has recorded a promotion, but Senior Operator content stays closed until an administrator grants it." },
  { key: "omar", staffId: "D-10003", email: "omar.haddad@apex-demo.test", name: "Omar Haddad", role: "Operations Superintendent · line manager", look: "Team dashboard, overdue learning, plan approvals, competency gap matrix and grading as an instructor." },
  { key: "helen", staffId: "D-10001", email: "helen.mercer@apex-demo.test", name: "Dr Helen Mercer", role: "L&D Administrator", look: "Course authoring, webinars and attendance, CPD review queue, users, roles, reports, audit log and configuration." },
  { key: "catherine", staffId: "D-10002", email: "catherine.lowe@apex-demo.test", name: "Catherine Lowe", role: "HR Director · executive", look: "Organisational insights in aggregate only, with small groups suppressed." },
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
  await page.fill("#staffId", p.staffId);
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
#demo-bar{position:fixed;top:0;left:0;right:0;height:var(--demo-h);z-index:60;display:flex;gap:14px;align-items:center;justify-content:center;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(60px,env(safe-area-inset-left,0px));background:#181a1f;color:#fff;font:500 12.5px/1 "Plus Jakarta Sans",system-ui,sans-serif;white-space:nowrap;overflow:hidden}
#demo-bar b{color:#cfee5c}
#demo-bar a{color:#fff;text-decoration:underline;text-underline-offset:2px}
#demo-bar .long{overflow:hidden;text-overflow:ellipsis}
@media (max-width:640px){#demo-bar .wide{display:none}}
aside.fixed.bg-navy{top:calc(var(--demo-h) + 12px)}
button[aria-controls="mobile-nav"]{top:calc(var(--demo-h) + 8px)!important}
header.sticky{top:var(--demo-h)!important}
#demo-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:70;width:max-content;max-width:min(92vw,520px);padding:12px 16px;border-radius:16px;background:#181a1f;color:#fff;font:14px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgb(16 24 40/.25)}
#demo-toast[hidden]{display:none}
body.demo-nav-open aside.bg-navy.fixed{display:flex!important;z-index:35;padding-top:48px;width:276px;bottom:8px;left:8px;box-shadow:0 16px 40px rgb(24 26 31/.35)}
</style>
<div id="demo-bar" role="note"><span class="long">Read-only demo · <b>${p.name}</b> · Staff ID ${p.staffId}<span class="wide"> (${p.role})</span></span><a href="../../index.html">Sign in as someone else</a><a class="wide" href="${REPO_URL}" target="_blank" rel="noopener">Source</a></div>
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

/** The demo's front door mirrors the app's sign-in page: Staff ID + password, over the plant photography. */
function indexPage() {
  const ids = Object.fromEntries(PERSONAS.map((p) => [p.staffId, p.key]));
  const rows = PERSONAS.map((p) => `
        <li><button type="button" data-id="${p.staffId}"><span class="id">${p.staffId}</span><span><b>${p.name}</b> · ${p.role}<small>${p.look}</small></span></button></li>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Apex CLMS demo</title>
<meta name="description" content="Read-only demonstration of Apex CLMS, a competency and learning management system, with fictional data.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&display=swap">
<style>
:root{--ink:#181a1f;--muted:#62676f;--faint:#8c919a;--lime:#cfee5c;--canvas:#f3f3ee;--surface:#fff;--line:#d8d8cf;--crit:#c43030}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--canvas);color:var(--ink);font:15px/1.6 "Plus Jakarta Sans",system-ui,sans-serif;padding:12px;min-height:100vh}
.shell{display:grid;gap:12px;min-height:calc(100vh - 24px)}
@media(min-width:1024px){.shell{grid-template-columns:7fr 5fr}}
.hero{position:relative;overflow:hidden;border-radius:32px;background:var(--ink);color:#fff;display:none;flex-direction:column;justify-content:space-between}
.hero>.bg{position:absolute;inset:0}
@media(min-width:1024px){.hero{display:flex;position:sticky;top:12px;height:calc(100vh - 24px);align-self:start}}
.photo{position:absolute;inset:0;background-size:cover;opacity:0;animation:fade 24s infinite}
.photo:nth-child(2){animation-delay:8s}.photo:nth-child(3){animation-delay:16s}
@keyframes fade{0%{opacity:0;transform:scale(1.04)}6%{opacity:1}33%{opacity:1}40%{opacity:0;transform:scale(1.1)}100%{opacity:0}}
@media(prefers-reduced-motion:reduce){.photo{animation:none}.photo:first-child{opacity:1}}
.shade{position:absolute;inset:0;background:linear-gradient(180deg,rgb(24 26 31/.55) 0%,rgb(24 26 31/.05) 35%,rgb(24 26 31/.25) 60%,rgb(24 26 31/.92) 100%)}
.top,.bottom{position:relative;padding:36px 40px}
.brand{display:flex;align-items:center;gap:12px;font-weight:700;font-size:18px}
.mono{display:inline-flex;width:44px;height:44px;align-items:center;justify-content:center;border-radius:16px;background:var(--lime);color:var(--ink);font-weight:800;font-size:20px}
.brand small{display:block;font-weight:400;font-size:12px;color:rgb(255 255 255/.7)}
h1{margin:0;font-weight:800;font-size:44px;line-height:1.05;letter-spacing:-.03em;max-width:16ch}
.lede{max-width:56ch;color:rgb(255 255 255/.8);font-size:17px;margin:16px 0 0}
.pillars{display:grid;grid-template-columns:repeat(3,1fr);gap:12px;margin-top:32px}
.pillars div{border-radius:16px;background:rgb(255 255 255/.1);backdrop-filter:blur(10px);padding:16px;font-size:13px;color:rgb(255 255 255/.8)}
.pillars b{display:block;color:var(--lime);font-size:14px}
.panel{border-radius:32px;background:var(--surface);display:flex;align-items:center;justify-content:center;padding:40px 20px}
.form{width:100%;max-width:440px}
.mobile-photo{height:140px;border-radius:24px;background:url(login/plant-flare.jpg) center 60%/cover;margin-bottom:28px}
@media(min-width:1024px){.mobile-photo{display:none}}
.kicker{margin:0;color:#5c700e;font-weight:600;font-size:13px}
h2{margin:4px 0 0;font-size:32px;font-weight:800;letter-spacing:-.03em;line-height:1.15}
.intro{color:var(--muted);margin:8px 0 0}
.note{margin:18px 0 0;padding:12px 16px;border-radius:16px;background:#f2f8d6;border-left:4px solid #5c700e;font-size:13.5px;color:var(--muted)}
label{display:block;font-weight:600;font-size:13px;margin:18px 0 6px}
input{width:100%;height:48px;border-radius:999px;border:1px solid var(--line);padding:0 18px;font:inherit;font-size:15px;color:var(--ink);background:#fff}
input#sid{text-transform:uppercase}input#sid::placeholder{text-transform:none}
input:focus{outline:none;border-color:var(--ink);box-shadow:0 0 0 4px rgb(207 238 92/.55)}
.hint{margin:6px 0 0;color:var(--faint);font-size:12px}
.err{margin:14px 0 0;padding:12px 16px;border-radius:16px;background:#fdeae9;color:var(--crit);font-size:13px}
.err[hidden]{display:none}
.submit{margin-top:18px;width:100%;height:48px;border:0;border-radius:999px;background:var(--ink);color:#fff;font:600 15px "Plus Jakarta Sans",sans-serif;cursor:pointer}
.submit:hover{background:#343842}
.submit:focus-visible,button:focus-visible{outline:2px solid #345ac8;outline-offset:2px}
details{margin-top:24px;border-radius:16px;background:var(--canvas);padding:12px 16px;font-size:13px}
summary{cursor:pointer;font-weight:600}
details ul{list-style:none;margin:8px 0 0;padding:0;display:grid;gap:2px}
details button{display:flex;gap:12px;align-items:flex-start;width:100%;text-align:left;background:none;border:0;border-radius:12px;padding:8px;font:inherit;color:var(--ink);cursor:pointer}
details button:hover{background:#fff}
.id{flex:none;border-radius:999px;background:var(--lime);padding:2px 8px;font:600 12px ui-monospace,monospace}
details small{display:block;color:var(--muted);font-size:12px;line-height:1.45;margin-top:2px}
.foot{margin-top:24px;color:var(--faint);font-size:12px}
.foot a{color:var(--ink)}
</style>
</head>
<body>
<div class="shell">
  <aside class="hero" aria-label="Apex CLMS — industrial plant">
    <div class="bg" aria-hidden="true">
      <div class="photo" style="background-image:url(login/plant-flare.jpg);background-position:center 60%"></div>
      <div class="photo" style="background-image:url(login/plant-daylight.jpg);background-position:center 55%"></div>
      <div class="photo" style="background-image:url(login/plant-blue.jpg);background-position:center 40%"></div>
      <div class="shade"></div>
    </div>
    <div class="top"><div class="brand"><span class="mono">A</span><span>Apex CLMS<small>Meridian Energy (fictional demo)</small></span></div></div>
    <div class="bottom">
      <h1>Competence is built deliberately.</h1>
      <p class="lede">Structured learning, verified competence and transparent development records for every role — from the control room to the boardroom.</p>
      <div class="pillars"><div><b>Learn</b>Courses, paths and live sessions for your job title</div><div><b>Demonstrate</b>Evidence-based competency records</div><div><b>Progress</b>Next-level access opened by your administrator</div></div>
    </div>
  </aside>
  <main class="panel">
    <div class="form">
      <div class="mobile-photo" aria-hidden="true"></div>
      <p class="kicker">Welcome to Apex CLMS</p>
      <h2>Sign in</h2>
      <p class="intro">Use your staff ID. It links to your job title, so you see the learning content for the levels your administrator has opened.</p>
      <p class="note"><b>Static, read-only demo.</b> GitHub Pages serves snapshots captured from the running app for fictional staff; this form only opens the matching snapshot and is not real authentication. Saving, enrolling and approvals need the full app — see <a href="${REPO_URL}" target="_blank" rel="noopener">the source</a>.</p>
      <form id="f" novalidate>
        <label for="sid">Staff ID</label>
        <input id="sid" autocomplete="off" spellcheck="false" placeholder="e.g. D-20101" required aria-describedby="sid-hint">
        <p id="sid-hint" class="hint">Printed on your staff badge.</p>
        <label for="pw">Password</label>
        <input id="pw" type="password" autocomplete="off" required>
        <p id="err" class="err" role="alert" hidden></p>
        <button class="submit" type="submit">Sign in</button>
      </form>
      <details open>
        <summary>Demonstration staff IDs (fictional)</summary>
        <p class="hint">All use the password <code>${PASSWORD}</code>. Choose one to fill the form.</p>
        <ul>${rows}
        </ul>
      </details>
      <p class="foot">All people, the organisation “Meridian Energy” and every record are fictional demonstration data. Snapshot generated ${new Date().toISOString().slice(0, 10)}.</p>
    </div>
  </main>
</div>
<script>
(function(){
  var ids=${JSON.stringify(ids)}, pw=${JSON.stringify(PASSWORD)};
  var f=document.getElementById('f'),sid=document.getElementById('sid'),p=document.getElementById('pw'),err=document.getElementById('err');
  document.querySelectorAll('details button[data-id]').forEach(function(b){b.addEventListener('click',function(){sid.value=b.getAttribute('data-id');p.value=pw;p.focus();});});
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var id=sid.value.trim().toUpperCase().replace(/\\s+/g,'');
    if(!id||!p.value){err.textContent='Enter your staff ID and password.';err.hidden=false;return;}
    if(!ids[id]||p.value!==pw){err.textContent='The staff ID or password is incorrect. In this demo, use one of the staff IDs listed below.';err.hidden=false;return;}
    location.href='p/'+ids[id]+'/dashboard.html';
  });
})();
</script>
</body>
</html>`;
}

const notInDemo = `<!doctype html><html lang="en-GB"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>Not in the demo</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f3ee;color:#181a1f;font:16px/1.6 system-ui,sans-serif;padding:24px}main{max-width:52ch;background:#fff;border-radius:28px;padding:32px}h1{font:800 28px system-ui,sans-serif;letter-spacing:-.02em;margin:0 0 8px}a{color:#181a1f}</style></head>
<body><main><h1>Not included in the static demo</h1><p>This page needs the live application — for example a filtered search, a form result or a record the selected persona cannot see. The static demo contains every page each persona can reach by navigation.</p><p><a href="javascript:history.back()">Go back</a> · <a href="index.html">Sign in as someone else</a></p></main></body></html>`;

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
await mkdir(path.join(OUT, "login"), { recursive: true });
for (const f of ["plant-flare.jpg", "plant-daylight.jpg", "plant-blue.jpg"]) await copyFile(path.resolve("public/login", f), path.join(OUT, "login", f));
await writeFile(path.join(OUT, "not-in-demo.html"), notInDemo.replace('href="index.html"', 'href="index.html"'));
await writeFile(path.join(OUT, "404.html"), notInDemo);
await writeFile(path.join(OUT, ".nojekyll"), "");
console.log(`Static demo written to ${OUT}`);
