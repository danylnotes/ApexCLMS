/* Fictional organisation, competency framework and people for demonstration only. */

export const BUSINESS_UNITS = [
  { code: "DWN", name: "Downstream — Refining" },
  { code: "UPS", name: "Upstream — Production" },
  { code: "CORP", name: "Corporate Services" },
];

export const DEPARTMENTS = [
  { code: "OPS", name: "Refinery Operations", bu: "DWN" },
  { code: "ENG", name: "Process Engineering", bu: "DWN" },
  { code: "MNT", name: "Maintenance & Reliability", bu: "DWN" },
  { code: "HSE", name: "Process Safety & HSE", bu: "DWN" },
  { code: "LAB", name: "Laboratory & Quality", bu: "DWN" },
  { code: "UTL", name: "Utilities & Energy", bu: "DWN" },
  { code: "UPO", name: "Upstream Operations", bu: "UPS" },
  { code: "SCM", name: "Supply Chain", bu: "CORP" },
  { code: "COM", name: "Commercial & Trading", bu: "CORP" },
  { code: "HR", name: "Human Resources", bu: "CORP" },
  { code: "LND", name: "Learning & Development", bu: "CORP" },
];

export const CATEGORIES = [
  ["process-operations", "Process Operations"],
  ["process-safety-management", "Process Safety Management"],
  ["health-safety-and-environment", "Health, Safety and Environment"],
  ["operations-excellence", "Operations Excellence"],
  ["six-sigma-and-lean", "Six Sigma and Lean"],
  ["reliability-and-maintenance", "Reliability and Maintenance"],
  ["asset-management", "Asset Management"],
  ["refinery-process-engineering", "Refinery Process Engineering"],
  ["upstream-operations", "Upstream Operations"],
  ["utilities-and-energy-management", "Utilities and Energy Management"],
  ["instrumentation-and-control", "Instrumentation and Control"],
  ["project-management", "Project Management"],
  ["risk-management", "Risk Management"],
  ["quantitative-risk-analysis", "Quantitative Risk Analysis"],
  ["decision-analysis-and-optimization", "Decision Analysis and Optimization"],
  ["data-analytics", "Data Analytics"],
  ["leadership-and-people-management", "Leadership and People Management"],
  ["commercial-and-energy-economics", "Commercial and Energy Economics"],
  ["professional-ethics", "Professional Ethics"],
  ["regulatory-compliance", "Regulatory Compliance"],
  ["digital-transformation-and-ai", "Digital Transformation and AI"],
] as const;

export const LEVELS = [
  [1, "Awareness", "Understands the concepts and terminology; works under direct supervision."],
  [2, "Foundation", "Applies knowledge to routine tasks with guidance; recognises when to seek help."],
  [3, "Practitioner", "Performs independently in normal and some abnormal situations; can guide others."],
  [4, "Advanced", "Handles complex and abnormal situations; improves practice; coaches practitioners."],
  [5, "Expert", "Recognised authority; sets standards and develops the organisation's capability."],
] as const;

export const DOMAINS: { name: string; competencies: { code: string; name: string; description: string; reassess?: number }[] }[] = [
  { name: "Technical Knowledge", competencies: [
    { code: "TK-01", name: "Hydrocarbon process fundamentals", description: "Understands separation, conversion and treating processes and the properties of hydrocarbon streams." },
    { code: "TK-02", name: "Process control and instrumentation", description: "Understands control loops, instrument types and the role of safety instrumented systems." },
  ] },
  { name: "Process Operations", competencies: [
    { code: "PO-01", name: "Field operations and equipment monitoring", description: "Conducts structured field rounds, detects abnormal equipment conditions and responds appropriately.", reassess: 24 },
    { code: "PO-02", name: "Shift handover and operating logs", description: "Maintains accurate logs and conducts structured, complete shift handovers." },
    { code: "PO-03", name: "Abnormal situation management", description: "Recognises and responds to abnormal operating situations to return the plant to a safe state.", reassess: 24 },
    { code: "PO-04", name: "Utilities systems operation", description: "Operates steam, power, cooling water and fuel systems safely and efficiently." },
  ] },
  { name: "Process Safety", competencies: [
    { code: "PS-01", name: "Hazard recognition and major accident awareness", description: "Identifies process hazards and understands major accident scenarios on the unit.", reassess: 36 },
    { code: "PS-02", name: "Barrier management", description: "Understands safety-critical barriers, recognises impairment and applies compensating measures.", reassess: 36 },
    { code: "PS-03", name: "Risk assessment (HAZOP / LOPA)", description: "Participates effectively in, or leads, structured hazard and risk assessments." },
    { code: "PS-04", name: "Permit to work and isolation", description: "Applies the permit-to-work system and energy isolation correctly in the assigned role.", reassess: 24 },
  ] },
  { name: "Equipment Reliability", competencies: [
    { code: "ER-01", name: "Rotating equipment condition monitoring", description: "Applies condition monitoring to detect and diagnose rotating equipment degradation." },
    { code: "ER-02", name: "Failure analysis", description: "Analyses equipment failures to identify physical, human and systemic causes." },
    { code: "ER-03", name: "Maintenance strategy (RCM)", description: "Develops maintenance strategies based on function, consequence and failure pattern." },
    { code: "ER-04", name: "Asset integrity and inspection", description: "Understands damage mechanisms and risk-based inspection planning." },
  ] },
  { name: "Operational Excellence", competencies: [
    { code: "OE-01", name: "Performance measurement and loss analysis", description: "Uses KPIs and loss accounting to identify and prioritise improvement." },
    { code: "OE-02", name: "Standard work and daily management", description: "Develops standard work and runs effective tiered performance meetings." },
    { code: "OE-03", name: "Continuous improvement methods", description: "Applies Lean and Six Sigma methods to deliver measurable improvement." },
  ] },
  { name: "Leadership", competencies: [
    { code: "LD-01", name: "Team leadership", description: "Sets direction, allocates work and leads a team to deliver safely." },
    { code: "LD-02", name: "Coaching and developing others", description: "Coaches team members and supports their development plans." },
  ] },
  { name: "Risk Management", competencies: [
    { code: "RM-01", name: "Uncertainty and probabilistic analysis", description: "Represents uncertainty explicitly and applies probabilistic methods." },
    { code: "RM-02", name: "Project and schedule risk", description: "Identifies and quantifies risks to project cost and schedule." },
    { code: "RM-03", name: "Risk-based decision making", description: "Uses risk information to support proportionate decisions." },
  ] },
  { name: "Digital and Analytical Skills", competencies: [
    { code: "DA-01", name: "Statistical analysis", description: "Applies descriptive and inferential statistics to operational data." },
    { code: "DA-02", name: "Process data analytics", description: "Extracts, cleans and analyses historian and laboratory data." },
    { code: "DA-03", name: "Decision analysis and optimisation", description: "Structures decisions and applies optimisation techniques." },
    { code: "DA-04", name: "Responsible use of digital tools and AI", description: "Uses digital and AI tools with appropriate validation and governance." },
  ] },
  { name: "Regulatory Compliance", competencies: [
    { code: "RC-01", name: "Environmental compliance", description: "Understands and complies with environmental permit conditions and reporting." },
    { code: "RC-02", name: "Professional ethics and integrity", description: "Acts with integrity and within the bounds of professional competence." },
  ] },
  { name: "Health, Safety and Environment", competencies: [
    { code: "HS-01", name: "Toxic gas and respiratory protection", description: "Recognises toxic gas hazards and uses detection and respiratory protection correctly.", reassess: 24 },
  ] },
];

export const JOB_ROLES: { code: string; title: string; dept: string; track: string; grade: number; years?: number; reqs: [string, number, boolean?][] }[] = [
  { code: "FO", title: "Field Operator", dept: "OPS", track: "Operations", grade: 3, reqs: [["PO-01", 2, true], ["PO-02", 2], ["PS-01", 2, true], ["PS-04", 2, true], ["HS-01", 2, true], ["TK-01", 1]] },
  { code: "SO", title: "Senior Operator", dept: "OPS", track: "Operations", grade: 4, years: 4, reqs: [["PO-01", 3, true], ["PO-02", 3], ["PO-03", 2, true], ["PS-01", 3, true], ["PS-02", 2, true], ["PS-04", 3, true], ["HS-01", 2, true], ["TK-01", 2]] },
  { code: "SS", title: "Operations Supervisor", dept: "OPS", track: "Operations", grade: 5, years: 8, reqs: [["PO-03", 3, true], ["PS-02", 3, true], ["PS-04", 3, true], ["PS-03", 2], ["OE-01", 2], ["OE-02", 3], ["LD-01", 3], ["LD-02", 2]] },
  { code: "OSI", title: "Operations Superintendent", dept: "OPS", track: "Operations", grade: 6, years: 12, reqs: [["PO-03", 4, true], ["PS-02", 4, true], ["PS-03", 3], ["OE-01", 3], ["OE-02", 3], ["LD-01", 4], ["LD-02", 3], ["RM-03", 3]] },
  { code: "UO", title: "Utilities Operator", dept: "UTL", track: "Operations", grade: 3, reqs: [["PO-01", 2, true], ["PO-04", 2, true], ["PS-04", 2, true], ["HS-01", 2, true]] },
  { code: "PE", title: "Process Engineer", dept: "ENG", track: "Engineering", grade: 4, reqs: [["TK-01", 3], ["TK-02", 2], ["PS-03", 2], ["OE-01", 2], ["DA-01", 2], ["DA-02", 2], ["RC-02", 2]] },
  { code: "SPE", title: "Senior Process Engineer", dept: "ENG", track: "Engineering", grade: 5, years: 8, reqs: [["TK-01", 4], ["TK-02", 3], ["PS-03", 3, true], ["OE-01", 3], ["OE-03", 3], ["DA-01", 3], ["RM-01", 3], ["LD-02", 2]] },
  { code: "RE", title: "Reliability Engineer", dept: "MNT", track: "Engineering", grade: 4, reqs: [["ER-01", 3], ["ER-02", 3], ["ER-03", 2], ["ER-04", 2], ["DA-01", 2], ["RM-03", 2]] },
  { code: "MT", title: "Mechanical Technician", dept: "MNT", track: "Maintenance", grade: 3, reqs: [["ER-01", 2], ["PS-04", 2, true], ["HS-01", 2, true]] },
  { code: "IT", title: "Instrument Technician", dept: "MNT", track: "Maintenance", grade: 3, reqs: [["TK-02", 3, true], ["PS-04", 2, true], ["HS-01", 2, true]] },
  { code: "HSEA", title: "HSE Advisor", dept: "HSE", track: "HSE", grade: 4, reqs: [["PS-01", 3, true], ["PS-02", 3], ["PS-03", 3], ["RC-01", 3], ["HS-01", 3, true]] },
  { code: "LA", title: "Laboratory Analyst", dept: "LAB", track: "Laboratory", grade: 3, reqs: [["DA-01", 2], ["HS-01", 2, true], ["RC-02", 2]] },
  { code: "PRO", title: "Production Operator", dept: "UPO", track: "Operations", grade: 3, reqs: [["TK-01", 2], ["PO-01", 2, true], ["PS-04", 2, true], ["HS-01", 2, true]] },
  { code: "SCO", title: "Supply Chain Officer", dept: "SCM", track: "Commercial", grade: 3, reqs: [["RC-02", 2], ["OE-03", 1]] },
  { code: "CA", title: "Commercial Analyst", dept: "COM", track: "Commercial", grade: 4, reqs: [["DA-03", 2], ["RC-02", 2], ["DA-01", 2]] },
  { code: "LDS", title: "Learning & Development Specialist", dept: "LND", track: "Corporate", grade: 4, reqs: [["LD-02", 3], ["DA-04", 2]] },
  { code: "HRD", title: "HR Director", dept: "HR", track: "Corporate", grade: 8, reqs: [] },
];

export const PATHWAYS: [string, string, number][] = [
  ["FO", "SO", 4],
  ["SO", "SS", 4],
  ["SS", "OSI", 4],
  ["PE", "SPE", 5],
  ["UO", "SO", 4],
  ["MT", "RE", 6],
];

export interface SeedPerson {
  email: string;
  name: string;
  role: string; // job role code
  target?: string;
  dept: string;
  roles: string[];
  location: string;
  hiredMonthsAgo: number;
  manager?: string;
  programme?: string;
  cpdPolicy?: string;
  persona?: string;
  employeeNo: string;
}

const LOC = { R: "Coastal Refinery Complex", F: "Northern Production Field", H: "Head Office" };

export const PEOPLE: SeedPerson[] = [
  { email: "helen.mercer@apex-demo.test", name: "Dr Helen Mercer", role: "LDS", dept: "LND", roles: ["EMPLOYEE", "LD_ADMIN"], location: LOC.H, hiredMonthsAgo: 96, employeeNo: "D-10001", persona: "L&D administrator" },
  { email: "catherine.lowe@apex-demo.test", name: "Catherine Lowe", role: "HRD", dept: "HR", roles: ["EMPLOYEE", "EXECUTIVE"], location: LOC.H, hiredMonthsAgo: 140, employeeNo: "D-10002", persona: "Executive / HR leadership" },
  { email: "omar.haddad@apex-demo.test", name: "Omar Haddad", role: "OSI", dept: "OPS", roles: ["EMPLOYEE", "MANAGER", "INSTRUCTOR"], location: LOC.R, hiredMonthsAgo: 190, employeeNo: "D-10003", cpdPolicy: "ENG", persona: "Line manager" },
  { email: "graham.whitfield@apex-demo.test", name: "Graham Whitfield", role: "HSEA", dept: "HSE", roles: ["EMPLOYEE", "INSTRUCTOR"], location: LOC.R, hiredMonthsAgo: 170, employeeNo: "D-10004", cpdPolicy: "ENG", persona: "Instructor" },
  { email: "lina.saleh@apex-demo.test", name: "Lina Saleh", role: "FO", target: "SO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 0, manager: "omar.haddad@apex-demo.test", programme: "New Operator Induction Programme", cpdPolicy: "TECH", employeeNo: "D-20101", persona: "New employee" },
  { email: "james.okafor@apex-demo.test", name: "James Okafor", role: "SPE", target: "OSI", dept: "ENG", roles: ["EMPLOYEE", "INSTRUCTOR"], location: LOC.R, hiredMonthsAgo: 110, manager: "omar.haddad@apex-demo.test", programme: "Technical Leadership Programme", cpdPolicy: "ENG", employeeNo: "D-20102", persona: "Several completed courses" },
  { email: "daniel.reyes@apex-demo.test", name: "Daniel Reyes", role: "SO", target: "SS", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 72, manager: "omar.haddad@apex-demo.test", programme: "Operations Supervisor Development", cpdPolicy: "TECH", employeeNo: "D-20103", persona: "Overdue mandatory training" },
  { email: "aisha.rahman@apex-demo.test", name: "Aisha Rahman", role: "FO", target: "SO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 14, manager: "omar.haddad@apex-demo.test", programme: "Field Operator Development", cpdPolicy: "TECH", employeeNo: "D-20104", persona: "Progressing through a learning path" },
  { email: "priya.natarajan@apex-demo.test", name: "Priya Natarajan", role: "RE", target: "SPE", dept: "MNT", roles: ["EMPLOYEE", "INSTRUCTOR"], location: LOC.R, hiredMonthsAgo: 60, manager: "omar.haddad@apex-demo.test", programme: "Reliability Engineering", cpdPolicy: "ENG", employeeNo: "D-20105", persona: "Pending CPD claims" },
  { email: "tomasz.nowak@apex-demo.test", name: "Tomasz Nowak", role: "SS", dept: "OPS", roles: ["EMPLOYEE", "MANAGER"], location: LOC.R, hiredMonthsAgo: 130, manager: "omar.haddad@apex-demo.test", cpdPolicy: "TECH", employeeNo: "D-20106" },
  // Tomasz's shift team
  { email: "yusuf.kareem@apex-demo.test", name: "Yusuf Kareem", role: "SO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 80, manager: "tomasz.nowak@apex-demo.test", cpdPolicy: "TECH", employeeNo: "D-20107" },
  { email: "sofia.marin@apex-demo.test", name: "Sofia Marin", role: "FO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 30, manager: "tomasz.nowak@apex-demo.test", cpdPolicy: "TECH", employeeNo: "D-20108" },
  { email: "kwame.mensah@apex-demo.test", name: "Kwame Mensah", role: "FO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 26, manager: "tomasz.nowak@apex-demo.test", cpdPolicy: "TECH", employeeNo: "D-20109" },
  { email: "ravi.iyer@apex-demo.test", name: "Ravi Iyer", role: "UO", dept: "UTL", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 44, manager: "tomasz.nowak@apex-demo.test", cpdPolicy: "TECH", employeeNo: "D-20110" },
  // Other departments (not in Omar's scope)
  { email: "elena.petrova@apex-demo.test", name: "Elena Petrova", role: "PE", target: "SPE", dept: "ENG", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 36, cpdPolicy: "ENG", employeeNo: "D-20201" },
  { email: "marcus.bell@apex-demo.test", name: "Marcus Bell", role: "MT", target: "RE", dept: "MNT", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 50, cpdPolicy: "TECH", employeeNo: "D-20202" },
  { email: "noura.aziz@apex-demo.test", name: "Noura Aziz", role: "IT", dept: "MNT", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 66, cpdPolicy: "TECH", employeeNo: "D-20203" },
  { email: "samuel.osei@apex-demo.test", name: "Samuel Osei", role: "HSEA", dept: "HSE", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 40, cpdPolicy: "ENG", employeeNo: "D-20204" },
  { email: "mei.chen@apex-demo.test", name: "Mei Chen", role: "LA", dept: "LAB", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 28, cpdPolicy: "TECH", employeeNo: "D-20205" },
  { email: "hassan.jaber@apex-demo.test", name: "Hassan Jaber", role: "PRO", dept: "UPO", roles: ["EMPLOYEE"], location: LOC.F, hiredMonthsAgo: 58, cpdPolicy: "TECH", employeeNo: "D-20206" },
  { email: "fatima.alvi@apex-demo.test", name: "Fatima Alvi", role: "PRO", dept: "UPO", roles: ["EMPLOYEE"], location: LOC.F, hiredMonthsAgo: 20, cpdPolicy: "TECH", employeeNo: "D-20207" },
  { email: "ben.carter@apex-demo.test", name: "Ben Carter", role: "SCO", dept: "SCM", roles: ["EMPLOYEE"], location: LOC.H, hiredMonthsAgo: 34, cpdPolicy: "LEAD", employeeNo: "D-20208" },
  { email: "laura.schmidt@apex-demo.test", name: "Laura Schmidt", role: "CA", dept: "COM", roles: ["EMPLOYEE"], location: LOC.H, hiredMonthsAgo: 48, cpdPolicy: "LEAD", employeeNo: "D-20209" },
  { email: "ahmed.farouk@apex-demo.test", name: "Ahmed Farouk", role: "SO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 90, cpdPolicy: "TECH", employeeNo: "D-20210" },
  { email: "grace.adeyemi@apex-demo.test", name: "Grace Adeyemi", role: "PE", dept: "ENG", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 18, cpdPolicy: "ENG", employeeNo: "D-20211" },
  { email: "ivan.horvat@apex-demo.test", name: "Ivan Horvat", role: "UO", dept: "UTL", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 100, cpdPolicy: "TECH", employeeNo: "D-20212" },
  { email: "zainab.musa@apex-demo.test", name: "Zainab Musa", role: "FO", dept: "OPS", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 9, cpdPolicy: "TECH", employeeNo: "D-20213" },
  { email: "peter.lindqvist@apex-demo.test", name: "Peter Lindqvist", role: "RE", dept: "MNT", roles: ["EMPLOYEE"], location: LOC.R, hiredMonthsAgo: 75, cpdPolicy: "ENG", employeeNo: "D-20214" },
];

export const LEARNING_PATHS: { code: string; title: string; target?: string; audience: string; summary: string; weeks: number; cpd: boolean; published: boolean; items: [string, boolean, string?][]; competencies: string[]; entry?: string }[] = [
  { code: "LP-FOD", title: "Field Operator Development", target: "FO", audience: "Newly appointed field operators in refinery and utilities units.", summary: "Builds the safety foundation and field skills required to work independently as a field operator.", weeks: 16, cpd: true, published: true, items: [["HSE-110", true], ["PSM-120", true], ["PSM-101", true, "HSE-110"], ["OPS-150", true, "PSM-101"], ["LSS-110", false]], competencies: ["PO-01", "PO-02", "PS-01", "PS-04", "HS-01"], entry: "Completion of site induction." },
  { code: "LP-SOD", title: "Senior Operator Development", target: "SO", audience: "Experienced field operators preparing for senior operator roles.", summary: "Deepens process safety understanding and develops abnormal situation management and improvement skills.", weeks: 26, cpd: true, published: true, items: [["PSM-101", true], ["INS-220", true, "PSM-101"], ["OPX-210", true, "PSM-101"], ["REL-200", false]], competencies: ["PO-03", "PS-02", "TK-02"], entry: "Field Operator competence signed off; minimum three years' operating experience recommended." },
  { code: "LP-OSD", title: "Operations Supervisor Development", target: "SS", audience: "Senior operators identified for supervisory roles.", summary: "Prepares senior operators to lead shift teams safely and effectively.", weeks: 32, cpd: true, published: true, items: [["OPX-210", true], ["LDR-300", true], ["PSM-120", true], ["REG-210", false]], competencies: ["OE-02", "LD-01", "LD-02"], entry: "Senior Operator role with manager nomination." },
  { code: "LP-OSU", title: "Operations Superintendent Development", target: "OSI", audience: "Supervisors and senior engineers preparing for superintendent roles.", summary: "Develops area leadership, risk-based decision making and performance management.", weeks: 40, cpd: true, published: true, items: [["LDR-300", true], ["QRA-320", true], ["OPX-210", true], ["DEC-330", false]], competencies: ["LD-01", "RM-03", "OE-01"] },
  { code: "LP-PSL", title: "Process Safety Leadership", audience: "Supervisors, superintendents and engineering leads.", summary: "Equips leaders to sustain barrier integrity and lead process safety culture.", weeks: 12, cpd: true, published: true, items: [["PSM-101", true], ["INS-220", true], ["AIM-260", true]], competencies: ["PS-02", "PS-03"] },
  { code: "LP-RUO", title: "Refinery Utilities Operations", target: "UO", audience: "Utilities operators and energy coordinators.", summary: "Safe and efficient operation of steam, power and cooling water systems.", weeks: 14, cpd: true, published: true, items: [["HSE-110", true], ["PSM-120", true], ["UTL-240", true]], competencies: ["PO-04"] },
  { code: "LP-OEP", title: "Operational Excellence Practitioner", audience: "Engineers and supervisors leading improvement.", summary: "Builds practical capability in loss analysis, standard work and Lean methods.", weeks: 12, cpd: true, published: true, items: [["LSS-110", true], ["OPX-210", true]], competencies: ["OE-01", "OE-02", "OE-03"] },
  { code: "LP-SGB", title: "Six Sigma Green Belt", audience: "Technical professionals leading data-driven projects.", summary: "Green Belt knowledge and a chartered improvement project.", weeks: 20, cpd: true, published: true, items: [["LSS-110", true], ["DAT-210", true], ["LSS-300", true, "DAT-210"]], competencies: ["OE-03", "DA-01"] },
  { code: "LP-SBB", title: "Six Sigma Black Belt", audience: "Certified Green Belts selected for Black Belt development.", summary: "Advanced statistical methods and programme leadership. Additional modules are in development.", weeks: 40, cpd: true, published: false, items: [["LSS-300", true], ["QRA-320", true]], competencies: ["OE-03", "DA-01"] },
  { code: "LP-REL", title: "Reliability Engineering", target: "RE", audience: "Maintenance technicians and engineers moving into reliability roles.", summary: "Condition monitoring, failure analysis, RCM and asset integrity.", weeks: 24, cpd: true, published: true, items: [["REL-200", true], ["REL-310", true, "REL-200"], ["AIM-260", true]], competencies: ["ER-01", "ER-02", "ER-03", "ER-04"] },
  { code: "LP-QRM", title: "Quantitative Risk Management", audience: "Engineers, planners and risk specialists.", summary: "Probabilistic methods for cost, schedule and technical risk.", weeks: 12, cpd: true, published: true, items: [["QRA-320", true], ["PMG-200", false]], competencies: ["RM-01", "RM-02"] },
  { code: "LP-DAO", title: "Decision Analysis and Optimization", audience: "Engineers and analysts supporting investment and planning decisions.", summary: "Decision framing, decision trees, value of information and optimisation.", weeks: 14, cpd: true, published: true, items: [["QRA-320", true], ["DEC-330", true, "QRA-320"], ["COM-230", false]], competencies: ["DA-03", "RM-01"] },
  { code: "LP-LTP", title: "Leadership for Technical Professionals", audience: "Engineers and specialists in or moving into leadership roles.", summary: "Leading teams, coaching and ethical leadership in technical environments.", weeks: 16, cpd: true, published: true, items: [["LDR-300", true], ["ETH-100", true], ["DIG-150", false]], competencies: ["LD-01", "LD-02", "RC-02"] },
];
