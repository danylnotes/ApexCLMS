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

const SKIP = [/^\/lang/, /^\/login/, /^\/forgot-password/, /^\/reset-password/, /^\/verify/, /^\/session-expired/, /^\/sso/, /^\/access-denied/];
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

/** The demo is captured in every interface language: p/<lang>/<persona>/<page>.html. */
const LANGS = ["en", "ar", "fr"];
const T = {
  en: { bar: "Read-only demo", staff: "Staff ID", switch: "Sign in as someone else", toast: "This is a read-only preview of Apex CLMS, so changes are not saved. Saving, enrolment, assessments and approvals work in the full platform.", nidTitle: "Not included in the preview", nidBody: "This page needs the live platform — for example a filtered search, a form result or a record the selected person cannot see. The preview contains every page each person can reach by navigation.", back: "Go back" },
  ar: { bar: "عرض تجريبي للقراءة فقط", staff: "الرقم الوظيفي", switch: "تسجيل الدخول بحساب آخر", toast: "هذه معاينة للقراءة فقط من Apex CLMS، لذا لا تُحفظ التغييرات. يعمل الحفظ والتسجيل والتقييمات والموافقات في المنصة الكاملة.", nidTitle: "غير متضمنة في المعاينة", nidBody: "تتطلب هذه الصفحة المنصة الفعلية — مثل بحث مُصفّى أو نتيجة نموذج أو سجل لا يمكن للشخص المختار رؤيته. تتضمن المعاينة كل صفحة يمكن لكل شخص الوصول إليها عبر التنقل.", back: "رجوع" },
  fr: { bar: "Démo en lecture seule", staff: "Matricule", switch: "Se connecter avec un autre compte", toast: "Ceci est un aperçu en lecture seule d'Apex CLMS : les modifications ne sont pas enregistrées. L'enregistrement, les inscriptions, les évaluations et les approbations fonctionnent dans la plateforme complète.", nidTitle: "Non incluse dans l'aperçu", nidBody: "Cette page nécessite la plateforme en ligne — par exemple une recherche filtrée, le résultat d'un formulaire ou un dossier que la personne choisie ne peut pas voir. L'aperçu contient toutes les pages accessibles par la navigation.", back: "Retour" },
};

async function crawlPersona(browser, p, lang) {
  const ctx = await browser.newContext({ viewport: { width: 1366, height: 900 } });
  await ctx.addCookies([{ name: "apex_lang", value: lang, url: BASE }]);
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
      // Retry transient connection drops; skip the file rather than abort the whole crawl.
      let r = null;
      for (let attempt = 0; attempt < 3 && !r; attempt++) r = await ctx.request.get(BASE + url, { timeout: 120000 }).catch(() => null);
      if (r && r.ok()) {
        const type = r.headers()["content-type"] ?? "";
        const ext = type.includes("pdf") ? ".pdf" : type.includes("csv") ? ".csv" : type.includes("calendar") ? ".ics" : type.includes("png") ? ".png" : type.includes("jpeg") ? ".jpg" : "";
        const name = `${slugOf(url)}${ext}`;
        await mkdir(path.join(OUT, "p", lang, p.key, "files"), { recursive: true });
        await writeFile(path.join(OUT, "p", lang, p.key, "files", name), Buffer.from(await r.body()));
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
  console.log(`${lang}/${p.key}: ${pages.size} pages, ${files.size} files`);
  return { pages, files };
}

function demoChrome(p, lang) {
  const x = T[lang];
  return `<!--demo-chrome-->
<style>
:root{--demo-h:34px}
body{padding-top:var(--demo-h)}
#demo-bar{position:fixed;top:0;left:0;right:0;direction:inherit;height:var(--demo-h);z-index:60;display:flex;gap:14px;align-items:center;justify-content:center;padding:0 max(12px,env(safe-area-inset-right,0px)) 0 max(60px,env(safe-area-inset-left,0px));background:#181a1f;color:#fff;font:500 12.5px/1 system-ui,sans-serif;white-space:nowrap;overflow:hidden}
#demo-bar b{color:#cfee5c}
#demo-bar a{color:#fff;text-decoration:underline;text-underline-offset:2px}
#demo-bar .long{overflow:hidden;text-overflow:ellipsis}
@media (max-width:640px){#demo-bar .wide{display:none}}
aside.fixed.bg-navy{top:calc(var(--demo-h) + 12px)}
header.sticky{top:var(--demo-h)!important}
#demo-toast{position:fixed;left:50%;bottom:24px;transform:translateX(-50%);z-index:70;width:max-content;max-width:min(92vw,520px);padding:12px 16px;border-radius:16px;background:#181a1f;color:#fff;font:14px/1.45 Inter,system-ui,sans-serif;box-shadow:0 8px 24px rgb(16 24 40/.25)}
#demo-toast[hidden]{display:none}
body.demo-nav-open aside.bg-navy.fixed{display:flex!important;z-index:45;top:calc(var(--demo-h) + 8px);left:8px;right:8px;width:auto;bottom:calc(max(0.75rem,env(safe-area-inset-bottom)) + 76px);box-shadow:0 16px 40px rgb(24 26 31/.35)}
</style>
<div id="demo-bar" role="note"><span class="long">${x.bar} · <b>${p.name}</b> · ${x.staff} <span dir="ltr">${p.staffId}</span></span><a href="../../../index.html?lang=${lang}">${x.switch}</a></div>
<div id="demo-toast" role="status" hidden></div>
<script>
(function(){
  var t=document.getElementById('demo-toast'),timer;
  function toast(m){t.textContent=m;t.hidden=false;clearTimeout(timer);timer=setTimeout(function(){t.hidden=true},5200);}
  document.addEventListener('submit',function(e){
    e.preventDefault();
    var b=e.submitter;
    if(b&&b.hasAttribute('data-signout')){location.href='../../../index.html?lang=${lang}';return;}
    toast(${JSON.stringify(x.toast)});
  },true);
  document.addEventListener('click',function(e){
    var b=e.target.closest&&e.target.closest('button[aria-controls="mobile-nav"]');
    if(b){var o=document.body.classList.toggle('demo-nav-open');b.setAttribute('aria-expanded',o);}
  });
  // Same enhancements as src/components/client-enhancements.tsx: label table cells for stacked phone
  // layouts, and open desktop-only disclosure panels on wide screens.
  document.addEventListener('DOMContentLoaded',function(){
  document.querySelectorAll('table.rtable').forEach(function(t){
    var heads=[].map.call(t.querySelectorAll('thead th'),function(th){return (th.textContent||'').trim();});
    t.querySelectorAll('tbody tr').forEach(function(tr){var col=0;[].forEach.call(tr.children,function(td){if(col>0&&!td.hasAttribute('data-label'))td.setAttribute('data-label',heads[col]||'');col+=Number(td.getAttribute('colspan')||1);});});
  });
  if(window.matchMedia('(min-width: 1024px)').matches)document.querySelectorAll('details[data-desktop-open]').forEach(function(d){d.open=true;});
  });
})();
</script><!--/demo-chrome-->`;
}

function rewrite(html, p, lang, pageSlugs, files) {
  const rel = (target) => target; // all of a persona's pages share one flat directory
  html = html.replace(/\s(href|src|action)="([^"]*)"/g, (m, attr, val) => {
    const v = val.replace(/&amp;/g, "&");
    if (v.startsWith("/_next/")) return ` ${attr}="../../../assets${v}"`;
    if (!v.startsWith("/")) return m;
    // Language switch: the same page in the other language's snapshot.
    if (v.startsWith("/lang?")) {
      const q = new URLSearchParams(v.split("?")[1]);
      const target = normal(q.get("next") ?? "/dashboard");
      const to = q.get("set");
      if (LANGS.includes(to) && target && pageSlugs.has(target)) return ` ${attr}="../../${to}/${p.key}/${pageSlugs.get(target)}.html"`;
      return ` ${attr}="../../${to}/${p.key}/dashboard.html"`;
    }
    const n = normal(v);
    if (n && files.has(n)) return ` ${attr}="${rel("files/" + files.get(n))}"`;
    if (n && pageSlugs.has(n)) return ` ${attr}="${rel(pageSlugs.get(n) + ".html")}"`;
    if (attr === "action") return ` ${attr}="#"`;
    return ` ${attr}="../../../not-in-demo-${lang}.html"`;
  });
  // GET search forms (catalogue filters, top search) would otherwise point at the server.
  html = html.replace(/<form([^>]*)action="\.\.\/\.\.\/\.\.\/not-in-demo-\w+\.html"/g, '<form$1action="#"');
  return html.replace(/<body([^>]*)>/, (m) => `${m}${demoChrome(p, lang)}`).replace(/<title>/, "<title>Demo · ");
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


/** Text of the demo's sign-in page in each language (persona descriptions included). */
const INDEX_I18N = {
  en: {
    title: "Sign in · Apex CLMS demo", org: "Meridian Energy (fictional demo)", headline: "Competence is built deliberately.",
    lede: "Structured learning, verified competence and transparent development records for every role — from the control room to the boardroom.",
    p1: "Learn", p1d: "Courses, paths and live sessions for your job title", p2: "Demonstrate", p2d: "Evidence-based competency records", p3: "Progress", p3d: "Next-level access opened by your administrator",
    kicker: "Welcome to Apex CLMS", signin: "Sign in", intro: "Use your staff ID. It links to your job title, so you see the learning content for the levels your administrator has opened.",
    note: "<b>Interactive preview.</b> Sign in as any of the fictional staff below to explore Apex CLMS as they see it. This preview is read-only, so nothing you enter is saved.",
    staff: "Staff ID", eg: "e.g. D-20101", badge: "Printed on your staff badge.", password: "Password", demo: "Demonstration staff IDs (fictional)",
    allpw: "All use the password <code>Demo#Apex2026!</code>. Choose one to fill the form.",
    foot: "All people, the organisation “Meridian Energy” and every record are fictional demonstration data.",
    empty: "Enter your staff ID and password.", wrong: "The staff ID or password is incorrect. In this preview, use one of the staff IDs listed below.",
    "role-lina": "Field Operator · new employee", "look-lina": "A three-week starter: induction learning path, first mandatory training and no history yet.",
    "role-james": "Senior Process Engineer · instructor", "look-james": "Several completed courses, certificates, CPD on track and an agreed development plan towards Operations Superintendent.",
    "role-daniel": "Senior Operator", "look-daniel": "Overdue mandatory training, an expired certificate in recertification and competency reassessments due.",
    "role-aisha": "Field Operator · on a learning path", "look-aisha": "Progressing through Field Operator Development, with a practical assignment and a plan awaiting her manager.",
    "role-priya": "Reliability Engineer", "look-priya": "CPD claims at every stage: draft, submitted, under review, approved and rejected with a reason.",
    "role-kwame": "Promoted to Senior Operator", "look-kwame": "HR has recorded a promotion, but Senior Operator content stays closed until an administrator grants it.",
    "role-omar": "Operations Superintendent · line manager", "look-omar": "Team dashboard, overdue learning, plan approvals, competency gap matrix and grading as an instructor.",
    "role-helen": "L&D Administrator", "look-helen": "Course authoring, webinars and attendance, CPD review queue, users, roles, reports, audit log and configuration.",
    "role-catherine": "HR Director · executive", "look-catherine": "Organisational insights in aggregate only, with small groups suppressed.",
  },
  ar: {
    title: "تسجيل الدخول · عرض Apex CLMS التجريبي", org: "ميريديان للطاقة (عرض تجريبي افتراضي)", headline: "الكفاءة تُبنى بإتقان وتخطيط.",
    lede: "تعلّم منظّم وكفاءات موثّقة وسجلات تطوير شفافة لكل دور — من غرفة التحكم إلى مجلس الإدارة.",
    p1: "تعلّم", p1d: "دورات ومسارات وجلسات مباشرة لمسماك الوظيفي", p2: "أثبت", p2d: "سجلات كفاءات قائمة على الأدلة", p3: "تقدّم", p3d: "يفتح المسؤول الوصول إلى المستوى التالي",
    kicker: "مرحبًا بك في Apex CLMS", signin: "تسجيل الدخول", intro: "استخدم رقمك الوظيفي. فهو مرتبط بمسماك الوظيفي، لتطّلع على محتوى التعلم للمستويات التي فتحها لك المسؤول.",
    note: "<b>معاينة تفاعلية.</b> سجّل الدخول بأحد الموظفين الافتراضيين أدناه لاستكشاف Apex CLMS كما يراه. هذه المعاينة للقراءة فقط، لذا لا يُحفظ أي شيء تُدخله.",
    staff: "الرقم الوظيفي", eg: "مثال: D-20101", badge: "مطبوع على بطاقة الموظف الخاصة بك.", password: "كلمة المرور", demo: "أرقام موظفين تجريبية (افتراضية)",
    allpw: "كلمة المرور لجميع الحسابات: <code dir=\"ltr\">Demo#Apex2026!</code>. اختر حسابًا لتعبئة النموذج.",
    foot: "جميع الأشخاص ومؤسسة «ميريديان للطاقة» وكل السجلات بيانات تجريبية افتراضية.",
    empty: "أدخل رقمك الوظيفي وكلمة المرور.", wrong: "الرقم الوظيفي أو كلمة المرور غير صحيحة. في هذه المعاينة، استخدم أحد الأرقام الوظيفية المدرجة أدناه.",
    "role-lina": "مشغّلة ميدانية · موظفة جديدة", "look-lina": "موظفة منذ ثلاثة أسابيع: مسار تعلم تعريفي وأول تدريب إلزامي ولا يوجد سجل بعد.",
    "role-james": "مهندس عمليات أول · مدرّب", "look-james": "عدة دورات مكتملة وشهادات وتطوير مهني على المسار الصحيح وخطة تطوير معتمدة نحو منصب مشرف عمليات عام.",
    "role-daniel": "مشغّل أول", "look-daniel": "تدريب إلزامي متأخر وشهادة منتهية قيد إعادة الاعتماد وإعادة تقييم كفاءات مستحقة.",
    "role-aisha": "مشغّلة ميدانية · ضمن مسار تعلم", "look-aisha": "تتقدم في مسار تطوير المشغّل الميداني، مع مهمة عملية وخطة بانتظار مديرها.",
    "role-priya": "مهندسة موثوقية", "look-priya": "طلبات تطوير مهني في كل المراحل: مسودة ومقدَّم وقيد المراجعة ومعتمد ومرفوض مع ذكر السبب.",
    "role-kwame": "تمت ترقيته إلى مشغّل أول", "look-kwame": "سجّلت الموارد البشرية ترقيته، لكن محتوى المشغّل الأول يظل مغلقًا حتى يمنحه المسؤول الوصول.",
    "role-omar": "مشرف عمليات عام · مدير مباشر", "look-omar": "لوحة الفريق والتعلم المتأخر واعتماد الخطط ومصفوفة فجوات الكفاءات والتصحيح بصفته مدرّبًا.",
    "role-helen": "مسؤولة التعلم والتطوير", "look-helen": "إعداد الدورات والندوات والحضور ومراجعة طلبات التطوير المهني والمستخدمين والأدوار والتقارير وسجل التدقيق والإعدادات.",
    "role-catherine": "مديرة الموارد البشرية · تنفيذية", "look-catherine": "رؤى مؤسسية مجمّعة فقط، مع إخفاء المجموعات الصغيرة.",
  },
  fr: {
    title: "Connexion · Démo Apex CLMS", org: "Meridian Energy (démo fictive)", headline: "La compétence se construit avec méthode.",
    lede: "Une formation structurée, des compétences vérifiées et des dossiers de développement transparents pour chaque poste — de la salle de contrôle au conseil d'administration.",
    p1: "Apprendre", p1d: "Formations, parcours et sessions en direct pour votre poste", p2: "Démontrer", p2d: "Dossiers de compétences fondés sur des preuves", p3: "Progresser", p3d: "Accès au niveau suivant ouvert par votre administrateur",
    kicker: "Bienvenue sur Apex CLMS", signin: "Se connecter", intro: "Utilisez votre matricule. Il est lié à votre poste : vous voyez le contenu de formation des niveaux ouverts par votre administrateur.",
    note: "<b>Aperçu interactif.</b> Connectez-vous avec l'un des collaborateurs fictifs ci-dessous pour découvrir Apex CLMS tel qu'il le voit. Cet aperçu est en lecture seule : rien de ce que vous saisissez n'est enregistré.",
    staff: "Matricule", eg: "ex. D-20101", badge: "Indiqué sur votre badge.", password: "Mot de passe", demo: "Matricules de démonstration (fictifs)",
    allpw: "Mot de passe commun : <code>Demo#Apex2026!</code>. Choisissez un profil pour remplir le formulaire.",
    foot: "Toutes les personnes, l'organisation « Meridian Energy » et tous les dossiers sont des données de démonstration fictives.",
    empty: "Saisissez votre matricule et votre mot de passe.", wrong: "Le matricule ou le mot de passe est incorrect. Dans cet aperçu, utilisez l'un des matricules ci-dessous.",
    "role-lina": "Opératrice terrain · nouvelle arrivante", "look-lina": "Arrivée depuis trois semaines : parcours d'intégration, première formation obligatoire et aucun historique.",
    "role-james": "Ingénieur procédés senior · formateur", "look-james": "Plusieurs formations terminées, des certificats, un DPC dans les temps et un plan de développement validé vers le poste de surintendant des opérations.",
    "role-daniel": "Opérateur senior", "look-daniel": "Formation obligatoire en retard, un certificat expiré en recertification et des réévaluations de compétences à prévoir.",
    "role-aisha": "Opératrice terrain · en parcours de formation", "look-aisha": "Progresse dans le parcours Développement opérateur terrain, avec un travail pratique et un plan en attente de sa responsable.",
    "role-priya": "Ingénieure fiabilité", "look-priya": "Des demandes de DPC à chaque étape : brouillon, soumise, en cours d'examen, approuvée et rejetée avec motif.",
    "role-kwame": "Promu opérateur senior", "look-kwame": "Les RH ont enregistré une promotion, mais le contenu opérateur senior reste fermé jusqu'à ce qu'un administrateur l'ouvre.",
    "role-omar": "Surintendant des opérations · responsable hiérarchique", "look-omar": "Tableau de bord d'équipe, formations en retard, validation des plans, matrice des écarts de compétences et correction en tant que formateur.",
    "role-helen": "Administratrice formation", "look-helen": "Création de formations, webinaires et présences, revue du DPC, utilisateurs, rôles, rapports, journal d'audit et configuration.",
    "role-catherine": "Directrice des RH · direction", "look-catherine": "Analyses de l'organisation uniquement agrégées, les petits groupes étant masqués.",
  },
};

/** The demo's front door mirrors the app's sign-in page: Staff ID + password, over the plant photography. */
function indexPage() {
  const ids = Object.fromEntries(PERSONAS.map((p) => [p.staffId, p.key]));
  const rows = PERSONAS.map((p) => `
        <li><button type="button" data-id="${p.staffId}"><span class="id">${p.staffId}</span><span><b>${p.name}</b> · <span data-i18n="role-${p.key}">${p.role}</span><small data-i18n="look-${p.key}">${p.look}</small></span></button></li>`).join("");
  return `<!doctype html>
<html lang="en-GB">
<head>
<meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1">
<title>Sign in · Apex CLMS demo</title>
<meta name="description" content="Read-only demonstration of Apex CLMS, a competency and learning management system, with fictional data.">
<link rel="preconnect" href="https://fonts.googleapis.com"><link rel="preconnect" href="https://fonts.gstatic.com" crossorigin>
<link rel="stylesheet" href="https://fonts.googleapis.com/css2?family=Plus+Jakarta+Sans:wght@400;500;600;700;800&family=IBM+Plex+Sans+Arabic:wght@400;500;600;700&display=swap">
<style>
:root{--ink:#181a1f;--muted:#62676f;--faint:#8c919a;--lime:#cfee5c;--canvas:#f3f3ee;--surface:#fff;--line:#d8d8cf;--crit:#c43030}
*{box-sizing:border-box}
html,body{margin:0}
body{background:var(--ink);color:var(--ink);font:16px/1.6 "Plus Jakarta Sans",system-ui,sans-serif;min-height:100vh;-webkit-tap-highlight-color:transparent}
@media(min-width:1024px){body{background:var(--canvas);padding:12px}}
.shell{display:grid;min-height:100vh}
@media(min-width:1024px){.shell{gap:12px;min-height:calc(100vh - 24px)}}
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
.panel{position:relative;margin-top:-36px;border-radius:32px 32px 0 0;background:var(--surface);display:flex;justify-content:center;padding:28px 20px max(40px,env(safe-area-inset-bottom))}
@media(min-width:1024px){.panel{margin-top:0;border-radius:32px;align-items:center;padding:40px 20px}}
.form{width:100%;max-width:440px}
.mhero{position:relative;height:52vh;min-height:340px;overflow:hidden;color:#fff}
.mhero .top{padding:max(20px,env(safe-area-inset-top)) 20px 0}
.mhero .headline{position:absolute;left:20px;right:20px;bottom:56px;margin:0;font-weight:800;font-size:32px;line-height:1.05;letter-spacing:-.03em}
@media(min-width:1024px){.mhero{display:none}}
.grab{width:48px;height:6px;border-radius:99px;background:var(--line);margin:0 auto 24px}
@media(min-width:1024px){.grab{display:none}}
.langs{display:flex;gap:4px;justify-content:flex-end;margin:0 0 20px}
.langs a{border-radius:99px;padding:6px 12px;font-size:13px;font-weight:600;color:var(--muted);text-decoration:none;background:var(--canvas)}
.langs a[aria-current]{background:var(--lime);color:var(--ink)}
[dir=rtl] *{letter-spacing:0!important}
[dir=rtl] body{font-family:"IBM Plex Sans Arabic","Plus Jakarta Sans",system-ui,sans-serif}
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
  <section class="mhero" aria-label="Apex CLMS — industrial plant">
    <div class="bg" aria-hidden="true" style="position:absolute;inset:0">
      <div class="photo" style="background-image:url(login/plant-flare.jpg);background-position:center 60%"></div>
      <div class="photo" style="background-image:url(login/plant-daylight.jpg);background-position:center 55%"></div>
      <div class="photo" style="background-image:url(login/plant-blue.jpg);background-position:center 40%"></div>
      <div class="shade"></div>
    </div>
    <div class="top" style="position:relative"><div class="brand"><span class="mono">A</span><span>Apex CLMS<small data-i18n="org">Meridian Energy (fictional demo)</small></span></div></div>
    <p class="headline" data-i18n="headline">Competence is built deliberately.</p>
  </section>
  <aside class="hero" aria-label="Apex CLMS — industrial plant">
    <div class="bg" aria-hidden="true">
      <div class="photo" style="background-image:url(login/plant-flare.jpg);background-position:center 60%"></div>
      <div class="photo" style="background-image:url(login/plant-daylight.jpg);background-position:center 55%"></div>
      <div class="photo" style="background-image:url(login/plant-blue.jpg);background-position:center 40%"></div>
      <div class="shade"></div>
    </div>
    <div class="top"><div class="brand"><span class="mono">A</span><span>Apex CLMS<small data-i18n="org">Meridian Energy (fictional demo)</small></span></div></div>
    <div class="bottom">
      <h1 data-i18n="headline">Competence is built deliberately.</h1>
      <p class="lede" data-i18n="lede">Structured learning, verified competence and transparent development records for every role — from the control room to the boardroom.</p>
      <div class="pillars"><div><b data-i18n="p1">Learn</b><span data-i18n="p1d">Courses, paths and live sessions for your job title</span></div><div><b data-i18n="p2">Demonstrate</b><span data-i18n="p2d">Evidence-based competency records</span></div><div><b data-i18n="p3">Progress</b><span data-i18n="p3d">Next-level access opened by your administrator</span></div></div>
    </div>
  </aside>
  <main class="panel">
    <div class="form">
      <div class="grab" aria-hidden="true"></div>
      <nav class="langs" aria-label="Language"><a href="?lang=en" data-lang="en" lang="en">English</a><a href="?lang=ar" data-lang="ar" lang="ar">العربية</a><a href="?lang=fr" data-lang="fr" lang="fr">Français</a></nav>
      <p class="kicker" data-i18n="kicker">Welcome to Apex CLMS</p>
      <h2 data-i18n="signin">Sign in</h2>
      <p class="intro" data-i18n="intro">Use your staff ID. It links to your job title, so you see the learning content for the levels your administrator has opened.</p>
      <p class="note" data-i18n="note"><b>Interactive preview.</b> Sign in as any of the fictional staff below to explore Apex CLMS as they see it. This preview is read-only, so nothing you enter is saved.</p>
      <form id="f" novalidate>
        <label for="sid" data-i18n="staff">Staff ID</label>
        <input id="sid" autocomplete="off" spellcheck="false" placeholder="e.g. D-20101" data-i18n-ph="eg" required aria-describedby="sid-hint">
        <p id="sid-hint" class="hint" data-i18n="badge">Printed on your staff badge.</p>
        <label for="pw" data-i18n="password">Password</label>
        <input id="pw" type="password" autocomplete="off" required>
        <p id="err" class="err" role="alert" hidden></p>
        <button class="submit" type="submit" data-i18n="signin">Sign in</button>
      </form>
      <details>
        <summary data-i18n="demo">Demonstration staff IDs (fictional)</summary>
        <p class="hint" data-i18n="allpw">All use the password <code>${PASSWORD}</code>. Choose one to fill the form.</p>
        <ul>${rows}
        </ul>
      </details>
      <p class="foot"><span data-i18n="foot">All people, the organisation “Meridian Energy” and every record are fictional demonstration data.</span> <span dir="ltr">${new Date().toISOString().slice(0, 10)}</span></p>
    </div>
  </main>
</div>
<script>
(function(){
  var ids=${JSON.stringify(ids)}, pw=${JSON.stringify(PASSWORD)};
  var I=${JSON.stringify(INDEX_I18N)};
  var q=new URLSearchParams(location.search).get('lang'),saved=null;
  try{saved=localStorage.getItem('apex_lang');}catch(e){}
  var nav=(navigator.language||'en').slice(0,2);
  var lang=I[q]?q:I[saved]?saved:I[nav]?nav:'en';
  function apply(l){
    lang=l;document.documentElement.lang=l;document.documentElement.dir=l==='ar'?'rtl':'ltr';
    try{localStorage.setItem('apex_lang',l);}catch(e){}
    document.querySelectorAll('[data-i18n]').forEach(function(n){var k=n.getAttribute('data-i18n');if(I[l][k]!=null)n.innerHTML=I[l][k];});
    document.querySelectorAll('[data-i18n-ph]').forEach(function(n){n.placeholder=I[l][n.getAttribute('data-i18n-ph')];});
    document.querySelectorAll('.langs a').forEach(function(a){if(a.getAttribute('data-lang')===l)a.setAttribute('aria-current','true');else a.removeAttribute('aria-current');});
    document.title=I[l].title;
  }
  document.querySelectorAll('.langs a').forEach(function(a){a.addEventListener('click',function(e){e.preventDefault();apply(a.getAttribute('data-lang'));history.replaceState(null,'','?lang='+lang);});});
  apply(lang);
  var f=document.getElementById('f'),sid=document.getElementById('sid'),p=document.getElementById('pw'),err=document.getElementById('err');
  document.querySelectorAll('details button[data-id]').forEach(function(b){b.addEventListener('click',function(){sid.value=b.getAttribute('data-id');p.value=pw;p.focus();});});
  f.addEventListener('submit',function(e){
    e.preventDefault();
    var id=sid.value.trim().toUpperCase().replace(/\\s+/g,'');
    if(!id||!p.value){err.textContent=I[lang].empty;err.hidden=false;return;}
    if(!ids[id]||p.value!==pw){err.textContent=I[lang].wrong;err.hidden=false;return;}
    location.href='p/'+lang+'/'+ids[id]+'/dashboard.html';
  });
})();
</script>
</body>
</html>`;
}

const notInDemo = (lang) => `<!doctype html><html lang="${lang}" dir="${lang === "ar" ? "rtl" : "ltr"}"><head><meta charset="utf-8"><meta name="viewport" content="width=device-width, initial-scale=1"><title>${T[lang].nidTitle}</title>
<style>body{margin:0;min-height:100vh;display:grid;place-items:center;background:#f3f3ee;color:#181a1f;font:16px/1.7 system-ui,sans-serif;padding:24px}main{max-width:52ch;background:#fff;border-radius:28px;padding:32px}h1{font:800 28px system-ui,sans-serif;margin:0 0 8px}a{color:#181a1f}</style></head>
<body><main><h1>${T[lang].nidTitle}</h1><p>${T[lang].nidBody}</p><p><a href="javascript:history.back()">${T[lang].back}</a> · <a href="index.html?lang=${lang}">${T[lang].switch}</a></p></main></body></html>`;

const browser = await chromium.launch({ executablePath: process.env.PLAYWRIGHT_CHROMIUM_PATH || undefined });
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });
// Personas are crawled concurrently in separate browser contexts.
for (const lang of LANGS) {
  await Promise.all(
    PERSONAS.map(async (p) => {
      const { pages, files } = await crawlPersona(browser, p, lang);
      const slugs = new Map([...pages.keys()].map((u) => [u, slugOf(u)]));
      await mkdir(path.join(OUT, "p", lang, p.key), { recursive: true });
      for (const [u, html] of pages) await writeFile(path.join(OUT, "p", lang, p.key, `${slugs.get(u)}.html`), rewrite(html, p, lang, slugs, files));
    }),
  );
}
await browser.close();
await fetchAssets();
await writeFile(path.join(OUT, "index.html"), indexPage());
await mkdir(path.join(OUT, "login"), { recursive: true });
for (const f of ["plant-flare.jpg", "plant-daylight.jpg", "plant-blue.jpg"]) await copyFile(path.resolve("public/login", f), path.join(OUT, "login", f));
for (const lang of LANGS) await writeFile(path.join(OUT, `not-in-demo-${lang}.html`), notInDemo(lang));
await writeFile(path.join(OUT, "404.html"), notInDemo("en"));
await writeFile(path.join(OUT, ".nojekyll"), "");
console.log(`Static demo written to ${OUT}`);
