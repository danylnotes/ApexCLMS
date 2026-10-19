/* Fictional demonstration course content. These are illustrative seed records, not accredited courses. */

export type SeedLessonType = "TEXT" | "PDF" | "DOCUMENT" | "EXTERNAL" | "ASSESSMENT" | "ASSIGNMENT";

export interface SeedLesson {
  title: string;
  type: SeedLessonType;
  minutes: number;
  body?: string;
  url?: string;
  required?: boolean;
  resource?: string; // key of a generated PDF resource
}

export interface SeedQuestion {
  type: "MULTIPLE_CHOICE" | "TRUE_FALSE" | "SHORT_ANSWER";
  prompt: string;
  options?: string[];
  correct?: number | boolean;
  points?: number;
  guidance?: string;
}

export interface SeedCourse {
  code: string;
  title: string;
  category: string;
  synopsis: string;
  overview: string;
  businessRelevance: string;
  audience: string;
  prerequisitesText?: string;
  objectives: string[];
  outcomes: string[];
  keywords: string[];
  difficulty: "FOUNDATION" | "INTERMEDIATE" | "ADVANCED" | "EXPERT";
  delivery: "SELF_PACED" | "INSTRUCTOR_LED" | "BLENDED" | "VIRTUAL_CLASSROOM";
  hours: number;
  cpd?: { value: number; note: string };
  mandatory?: boolean;
  enrolmentRule?: "OPEN" | "APPROVAL_REQUIRED" | "ASSIGNED_ONLY";
  requireAllLessons?: boolean;
  requireAssessmentPass?: boolean;
  requireAssignmentApproval?: boolean;
  acknowledgement?: string;
  certValidityMonths?: number;
  recertificationNote?: string;
  departments: string[];
  competencies: [string, number][];
  prerequisites?: string[];
  instructors: string[];
  provider?: string;
  status?: "PUBLISHED" | "DRAFT" | "IN_REVIEW";
  modules: { title: string; description: string; lessons: SeedLesson[] }[];
  assessment?: { title: string; passing: number; attempts: number; questions: SeedQuestion[] };
}

const p = (...paras: string[]) => paras.join("\n\n");

export const COURSES: SeedCourse[] = [
  {
    code: "PSM-101",
    title: "Process Safety Management Fundamentals",
    category: "process-safety-management",
    synopsis:
      "Introduction to process safety principles, major accident hazards, barrier management, risk assessment, and the relationship between operational discipline and process safety performance.",
    overview: p(
      "Process safety is concerned with preventing the unplanned release of hazardous materials and energy — the events that cause fires, explosions and toxic exposures. This course establishes the shared vocabulary and mental models that every person working on or around hydrocarbon facilities needs.",
      "Learners work through how major accident hazards are identified, how layers of protection are designed and maintained, and why the integrity of those barriers depends as much on daily operating discipline as on engineering design.",
    ),
    businessRelevance:
      "Major accidents are low-frequency, high-consequence events. Weak signals — bypassed alarms, deferred inspections, informal workarounds — are the precursors. A common understanding of barrier management lets operations, maintenance and engineering recognise and escalate degradation before it becomes loss of containment.",
    audience: "All operations, maintenance, engineering and HSE personnel working at or supporting process facilities. Required for new starters in operational roles.",
    prerequisitesText: "None. Familiarity with your site's general HSE induction is assumed.",
    objectives: [
      "Distinguish process safety from personal (occupational) safety and explain why the indicators differ.",
      "Describe the elements of a process safety management system and how they interact.",
      "Explain barrier thinking using the bow-tie model, including prevention and mitigation barriers.",
      "Identify common forms of barrier degradation and the operational behaviours that cause them.",
      "Apply a structured approach to recognising and escalating process safety concerns.",
    ],
    outcomes: [
      "Ability to read a bow-tie diagram for a unit hazard and name its critical barriers.",
      "Ability to recognise Tier 1–4 process safety indicators in day-to-day operations.",
      "Confidence to challenge and escalate barrier impairments through the correct channels.",
    ],
    keywords: ["process safety", "barrier management", "bow-tie", "major accident hazard", "PSM", "loss of containment", "HAZOP", "LOPA"],
    difficulty: "FOUNDATION",
    delivery: "SELF_PACED",
    hours: 6,
    cpd: { value: 6, note: "CPD value configured internally. External accreditation is not assumed and depends on your professional body." },
    mandatory: true,
    requireAllLessons: true,
    requireAssessmentPass: true,
    certValidityMonths: 36,
    recertificationNote: "Recertify every three years by completing the current version of this course and its assessment.",
    departments: ["OPS", "ENG", "MNT", "HSE", "UTL", "UPO"],
    competencies: [["PS-01", 2], ["PS-02", 2], ["PS-03", 1]],
    instructors: ["graham.whitfield@apex-demo.test"],
    modules: [
      {
        title: "Module 1 — Why process safety is different",
        description: "Frames the difference between personal and process safety and introduces major accident hazards.",
        lessons: [
          {
            title: "Personal safety and process safety",
            type: "TEXT",
            minutes: 25,
            body: p(
              "## Two different problems",
              "Personal safety addresses slips, trips, falls, dropped objects and manual handling. These events are frequent, their causes are usually local, and lost-time injury rates respond quickly to supervision and behaviour programmes.",
              "Process safety addresses the loss of containment of hazardous materials or energy. Such events are rare at any single site, but their consequences can be catastrophic and they typically arise from the gradual erosion of multiple safeguards over months or years.",
              "## Why the indicators differ",
              "A facility can report an excellent personal injury rate while its process safety barriers are deteriorating. Low injury rates are not evidence that pressure relief devices are tested, that safety instrumented functions are available, or that management of change is being followed.",
              "- **Lagging indicators** record what has already happened — loss of primary containment events, fires, releases.",
              "- **Leading indicators** measure the health of barriers — overdue safety-critical inspections, bypassed trips, demand rate on relief systems.",
              "## Key point",
              "Process safety performance must be managed with its own indicators, its own reviews and its own leadership attention.",
            ),
          },
          {
            title: "Major accident hazards in hydrocarbon facilities",
            type: "TEXT",
            minutes: 30,
            body: p(
              "## What makes a hazard \"major\"",
              "A major accident hazard (MAH) is one with the potential to cause multiple fatalities, serious environmental damage or extensive asset loss. In refineries and production facilities, typical MAHs include loss of containment of flammable hydrocarbons, toxic releases such as hydrogen sulphide, and overpressure of vessels.",
              "## Typical scenarios",
              "- Release from a corroded line in a hydrocarbon service leading to a vapour cloud and ignition.",
              "- Overfilling of a storage tank due to failed level instrumentation and an unattended transfer.",
              "- Overpressure of a column after loss of cooling with an impaired relief path.",
              "- H₂S release from a sour water system during maintenance breaking of containment.",
              "## Operational implication",
              "Every MAH has a defined set of safety-critical elements. Knowing which equipment on your unit is safety-critical is the first step to protecting it.",
            ),
          },
          {
            title: "Knowledge check: process safety basics",
            type: "TEXT",
            minutes: 10,
            required: false,
            body: p(
              "Reflect on your own unit before continuing:",
              "1. Name one leading indicator you could observe during a normal shift.",
              "2. Which hazardous inventory on your unit has the largest consequence potential?",
              "3. Who is accountable for the safety-critical element register at your site?",
              "This reflection is optional and is not recorded.",
            ),
          },
        ],
      },
      {
        title: "Module 2 — Barrier thinking",
        description: "Introduces the bow-tie model and the management of prevention and mitigation barriers.",
        lessons: [
          {
            title: "The bow-tie model",
            type: "TEXT",
            minutes: 35,
            body: p(
              "## Structure",
              "A bow-tie places the **top event** — the moment control is lost, such as loss of containment — at the centre. Threats appear on the left, consequences on the right.",
              "- **Prevention barriers** sit between threats and the top event: corrosion monitoring, high-level trips, operating limits.",
              "- **Mitigation barriers** sit between the top event and its consequences: gas detection, emergency shutdown, fire protection, emergency response.",
              "## Escalation factors",
              "Each barrier can be weakened by escalation factors — for example, a trip placed in bypass for maintenance, or an inspection deferred without risk assessment. Escalation factor controls keep barriers effective.",
              "## Using bow-ties on shift",
              "A bow-tie is not a design document filed away. It is a practical tool to ask: which barriers are in place today, which are impaired, and what compensating measures are active?",
            ),
            resource: "bowtie-reference",
          },
          {
            title: "Barrier degradation and operational discipline",
            type: "TEXT",
            minutes: 35,
            body: p(
              "## How barriers fail",
              "Barriers rarely fail suddenly. They erode: a gas detector is left in fault, an operator becomes accustomed to a nuisance alarm, a temporary repair becomes permanent.",
              "## Operational discipline",
              "Operational discipline means performing every task the right way, every time — following procedures, respecting operating envelopes and completing handovers rigorously. It is the human contribution to barrier integrity.",
              "## Normalisation of deviance",
              "When small deviations produce no immediate harm, they become accepted practice. Recognising this drift in yourself and in your team is a core process safety skill.",
              "- Record and report barrier impairments, even when temporary.",
              "- Ensure compensating measures are agreed, implemented and time-limited.",
              "- Escalate impairments that persist beyond their authorised period.",
            ),
          },
          {
            title: "CCPS process safety resources",
            type: "EXTERNAL",
            minutes: 15,
            required: false,
            url: "https://www.aiche.org/ccps",
            body: "The Center for Chemical Process Safety publishes widely used guidance on risk-based process safety. Review the publicly available resources for further reading. This external link is optional.",
          },
        ],
      },
      {
        title: "Module 3 — Risk assessment and management of change",
        description: "Covers hazard identification techniques and the control of change.",
        lessons: [
          {
            title: "Hazard identification: HAZID, HAZOP and LOPA",
            type: "TEXT",
            minutes: 40,
            body: p(
              "## HAZID",
              "A structured brainstorm at concept or project stage to identify hazards at a high level.",
              "## HAZOP",
              "A systematic, node-by-node review applying guidewords (more, less, no, reverse) to process parameters to identify deviations, causes, consequences and safeguards.",
              "## LOPA",
              "Layer of protection analysis takes HAZOP scenarios and evaluates whether independent protection layers reduce risk to a tolerable level. It is semi-quantitative: initiating event frequencies are multiplied by the probability of failure on demand of each layer.",
              "## Your role",
              "Operators and technicians bring essential knowledge of how the plant really runs. Participation in HAZOP and LOPA reviews is a professional responsibility, not an administrative task.",
            ),
          },
          {
            title: "Management of change",
            type: "TEXT",
            minutes: 30,
            body: p(
              "## What counts as change",
              "Any modification to equipment, chemicals, procedures, operating limits, software or organisation that is not a replacement-in-kind.",
              "## Why it matters",
              "Many major accidents trace back to changes that were not reviewed — a temporary bypass, a material substitution, a staffing reduction.",
              "## The MOC sequence",
              "- Describe the change and its technical basis.",
              "- Assess hazards and update affected documentation.",
              "- Obtain authorisation at the appropriate level.",
              "- Train affected personnel and complete a pre-start-up safety review.",
              "- Close out temporary changes by their expiry date.",
            ),
          },
        ],
      },
      {
        title: "Module 4 — Final assessment",
        description: "Assessment of the course learning objectives. Pass mark 75%.",
        lessons: [{ title: "Process safety fundamentals assessment", type: "ASSESSMENT", minutes: 20 }],
      },
    ],
    assessment: {
      title: "Process safety fundamentals assessment",
      passing: 75,
      attempts: 3,
      questions: [
        { type: "MULTIPLE_CHOICE", prompt: "Which of the following is a leading process safety indicator?", options: ["Lost-time injury frequency", "Number of overdue safety-critical inspections", "Number of first-aid cases", "Fire incidents in the past year"], correct: 1 },
        { type: "MULTIPLE_CHOICE", prompt: "In a bow-tie diagram, emergency shutdown and gas detection are examples of:", options: ["Threats", "Prevention barriers", "Mitigation barriers", "Escalation factors"], correct: 2 },
        { type: "TRUE_FALSE", prompt: "A low lost-time injury rate demonstrates that process safety barriers are healthy.", correct: false },
        { type: "MULTIPLE_CHOICE", prompt: "What does LOPA primarily evaluate?", options: ["Whether independent protection layers reduce scenario risk to a tolerable level", "The cost of a project", "Operator competency levels", "Personal protective equipment selection"], correct: 0 },
        { type: "TRUE_FALSE", prompt: "Replacing a valve with an identical valve of the same specification is a replacement-in-kind and does not normally require MOC.", correct: true },
        { type: "MULTIPLE_CHOICE", prompt: "A high-level trip has been placed in bypass for instrument maintenance. What is the correct approach?", options: ["Continue normal operation; the bypass is temporary", "Agree and implement compensating measures for a defined period and record the impairment", "Inform the next shift verbally", "Remove the bypass immediately regardless of maintenance status"], correct: 1 },
        { type: "MULTIPLE_CHOICE", prompt: "Normalisation of deviance is best described as:", options: ["A statistical technique for process control", "Gradual acceptance of deviations because they produced no immediate harm", "A formal change approval process", "A method of alarm rationalisation"], correct: 1 },
        { type: "TRUE_FALSE", prompt: "Mitigation barriers act after the top event has occurred.", correct: true },
      ],
    },
  },
  {
    code: "OPX-210",
    title: "Operational Excellence for Refinery Operations",
    category: "operations-excellence",
    synopsis:
      "Practical application of performance measurement, loss analysis, standardization, root cause analysis, and continuous improvement in refinery operations.",
    overview: p(
      "Operational excellence is the disciplined pursuit of safe, reliable and efficient operation. This course translates the principles into the tools a refinery uses every day: KPI trees, loss accounting, standard work, structured problem solving and the daily management system.",
      "The course uses worked examples from crude distillation, hydrotreating and utilities to show how loss analysis directs improvement effort to where it matters most.",
    ),
    businessRelevance:
      "Refinery margin is highly sensitive to availability, yield and energy efficiency. A structured view of losses converts operational data into prioritised improvement actions and sustains gains through standard work.",
    audience: "Shift supervisors, senior operators, process engineers and production planners. Recommended for those moving into supervisory roles.",
    prerequisitesText: "Process Safety Management Fundamentals (PSM-101) or equivalent.",
    objectives: [
      "Construct a KPI tree linking unit-level measures to site performance.",
      "Quantify availability, rate and quality losses using a loss accounting framework.",
      "Develop and audit standard work for a critical operating task.",
      "Apply a structured root cause analysis to an operational incident.",
      "Run an effective tiered daily performance meeting.",
    ],
    outcomes: ["A completed loss tree for a selected unit.", "A standard work document ready for field trial.", "An RCA report with verified corrective actions."],
    keywords: ["operational excellence", "loss analysis", "standard work", "KPI", "daily management", "root cause analysis", "continuous improvement"],
    difficulty: "INTERMEDIATE",
    delivery: "BLENDED",
    hours: 8,
    cpd: { value: 8, note: "Internally recognised CPD. Check eligibility with your professional body." },
    requireAllLessons: true,
    requireAssessmentPass: true,
    requireAssignmentApproval: true,
    departments: ["OPS", "ENG", "UTL"],
    competencies: [["OE-01", 3], ["OE-02", 3], ["PO-03", 2]],
    prerequisites: ["PSM-101"],
    instructors: ["omar.haddad@apex-demo.test"],
    modules: [
      {
        title: "Module 1 — Measuring performance",
        description: "KPI design and the hierarchy of measures.",
        lessons: [
          { title: "From site targets to unit KPIs", type: "TEXT", minutes: 40, body: p("## The KPI tree", "Site objectives — safety, reliability, margin, energy — decompose into unit measures that operators can influence within a shift. A good KPI tree makes this line of sight explicit.", "- **Lagging outcome**: e.g. refinery gross margin per barrel.", "- **Driver**: e.g. crude unit throughput, distillate yield, fuel gas consumption.", "- **Controllable input**: e.g. furnace excess oxygen, column overflash, steam-to-oil ratio.", "## Common pitfalls", "Too many KPIs dilute attention. Measures that cannot be influenced by the team that owns them create frustration rather than action.") },
          { title: "Loss accounting", type: "TEXT", minutes: 45, body: p("## Availability, rate and quality", "Losses are expressed against a defined maximum demonstrated rate. Each hour of operation is attributed to planned downtime, unplanned downtime, rate loss or quality loss.", "## Pareto of losses", "Ranking losses by margin impact focuses improvement on the largest contributors. Frequently, a handful of repeat equipment issues account for most unplanned losses.", "## Data quality", "Loss accounting is only as good as event coding. Shift teams must record cause codes consistently for the analysis to be trusted.") },
        ],
      },
      {
        title: "Module 2 — Standardisation and problem solving",
        description: "Standard work, root cause analysis and verification.",
        lessons: [
          { title: "Standard work for critical tasks", type: "TEXT", minutes: 40, body: p("## Purpose", "Standard work captures the current best-known method for a task so it is performed consistently across shifts. It is the baseline from which improvement starts.", "## Content", "- Sequence of steps with key points and reasons.", "- Critical checks and hold points.", "- Expected time and resources.", "## Auditing", "Supervisors confirm standard work through layered process audits, observing the task in the field rather than reviewing paperwork.") },
          { title: "Structured root cause analysis", type: "TEXT", minutes: 45, body: p("## Beyond the first answer", "The first explanation offered for an event is usually a symptom. Structured methods — 5-Whys, fault trees, causal factor charts — move the investigation to systemic causes.", "## Evidence", "Each causal link should be supported by evidence: trends from the historian, inspection findings, interview notes.", "## Corrective actions", "Effective actions remove or control the root cause, have an owner and a due date, and are verified for effectiveness after implementation.") },
          { title: "Practical assignment: loss analysis for your unit", type: "ASSIGNMENT", minutes: 90, body: p("Select a unit or system you work on. Using the last three months of production data:", "1. Build a simple loss tree (availability, rate, quality).", "2. Identify the top three losses by margin impact.", "3. Propose one standard-work or RCA action for the largest loss.", "Submit a summary (and optionally a PDF or spreadsheet). Your instructor will review the submission.") },
        ],
      },
      {
        title: "Module 3 — Sustaining performance",
        description: "Daily management system and final assessment.",
        lessons: [
          { title: "Tiered daily performance meetings", type: "TEXT", minutes: 30, body: p("## Tiers", "Tier 1 at the unit (shift start), Tier 2 at area level, Tier 3 at site leadership. Each tier reviews safety, performance against plan, and escalations from the tier below.", "## Effective meetings", "- Fixed time and duration (typically 10–15 minutes).", "- Visual board with current data.", "- Actions with owners and dates; escalation when beyond the tier's authority.") },
          { title: "Operational excellence assessment", type: "ASSESSMENT", minutes: 20 },
        ],
      },
    ],
    assessment: {
      title: "Operational excellence assessment",
      passing: 70,
      attempts: 3,
      questions: [
        { type: "MULTIPLE_CHOICE", prompt: "In loss accounting, a unit running at 85% of its maximum demonstrated rate because of a fouled exchanger is recorded as:", options: ["Planned downtime", "Rate loss", "Quality loss", "Not a loss"], correct: 1 },
        { type: "TRUE_FALSE", prompt: "A KPI that the owning team cannot influence is still an effective driver of improvement.", correct: false },
        { type: "MULTIPLE_CHOICE", prompt: "Which is the best evidence for a causal link in an RCA?", options: ["The opinion of the most senior person", "Historian trend data showing the sequence of events", "A previous similar incident report", "A vendor brochure"], correct: 1 },
        { type: "MULTIPLE_CHOICE", prompt: "A layered process audit primarily involves:", options: ["Reviewing completed checklists in the office", "Observing the task being performed in the field", "Surveying employee satisfaction", "Benchmarking against other sites"], correct: 1 },
        { type: "SHORT_ANSWER", prompt: "Describe one corrective action you would verify for effectiveness after an RCA, and how you would verify it.", points: 2, guidance: "Award 2 points for a specific action with a measurable verification method; 1 point for a general action without verification." },
      ],
    },
  },
  {
    code: "LSS-300",
    title: "Six Sigma Green Belt for Process Industries",
    category: "six-sigma-and-lean",
    synopsis:
      "Introduction to DMAIC, process capability, statistical process control, measurement systems, root cause analysis, and improvement project management.",
    overview: p(
      "This Green Belt programme equips engineers and supervisors to lead data-driven improvement projects in continuous process environments. It follows the DMAIC roadmap, with examples drawn from product quality, energy intensity and equipment reliability.",
      "The programme emphasises the realities of process data — autocorrelation, instrument drift and grade changes — that textbook manufacturing examples often omit.",
    ),
    businessRelevance:
      "Variation in product quality and energy use carries direct cost through giveaway, reprocessing and fuel. Green Belt projects target these with measurable financial benefit.",
    audience: "Process engineers, laboratory specialists, shift supervisors and technical professionals leading improvement projects.",
    prerequisitesText: "Basic statistics and spreadsheet skills. Operational Excellence for Refinery Operations (OPX-210) recommended.",
    objectives: [
      "Define a project charter with a measurable problem statement and financial baseline.",
      "Validate a measurement system using gauge R&R principles.",
      "Calculate and interpret process capability (Cp, Cpk) for a quality parameter.",
      "Select and interpret appropriate control charts for process data.",
      "Use hypothesis testing and regression to verify root causes.",
      "Design a control plan to sustain improvements.",
    ],
    outcomes: ["A chartered Green Belt project.", "Capability analysis for a selected product specification.", "A control plan with response actions."],
    keywords: ["six sigma", "DMAIC", "SPC", "control charts", "Cpk", "process capability", "MSA", "gauge R&R", "lean"],
    difficulty: "ADVANCED",
    delivery: "BLENDED",
    hours: 20,
    cpd: { value: 20, note: "Internal CPD value. Green Belt certification by an external body is not implied." },
    enrolmentRule: "APPROVAL_REQUIRED",
    requireAllLessons: true,
    requireAssessmentPass: true,
    departments: ["ENG", "LAB", "OPS", "UTL"],
    competencies: [["OE-03", 3], ["DA-01", 3], ["DA-02", 2]],
    instructors: ["james.okafor@apex-demo.test"],
    modules: [
      { title: "Define and Measure", description: "Project charter and measurement system analysis.", lessons: [
        { title: "Project charters and problem statements", type: "TEXT", minutes: 60, body: p("## The charter", "A charter states the problem, its business impact, scope, goal, team and timeline. A strong problem statement is specific, measurable and free of assumed causes.", "**Weak:** \"Diesel quality is poor because the hydrotreater is old.\"", "**Strong:** \"Diesel sulphur giveaway averaged 2.1 ppm below the 10 ppm limit from January to June, costing an estimated value in excess severity and hydrogen.\"") },
        { title: "Measurement system analysis", type: "TEXT", minutes: 90, body: p("## Why measure the measurement", "If the analyser or laboratory method contributes significant variation, improvement efforts chase noise.", "## Gauge R&R", "Repeatability (same operator, same sample) and reproducibility (different operators or analysers) are separated from part-to-part variation. As a rule of thumb, measurement variation above 30% of the tolerance is unacceptable.", "## On-line analysers", "Compare against laboratory results over time; drift and calibration events must be visible in the data.") },
        { title: "Process capability", type: "TEXT", minutes: 90, body: p("## Cp and Cpk", "Cp compares the specification width to six standard deviations of the process. Cpk accounts for centring: it is the distance from the mean to the nearest specification limit divided by three standard deviations.", "## Assumptions", "Capability indices assume a stable, approximately normal process. Assess stability with a control chart first.", "## Interpretation", "A Cpk of 1.33 is a common minimum target; lower values indicate a meaningful probability of off-specification product.") },
      ] },
      { title: "Analyse and Improve", description: "Statistical tools to verify causes and test solutions.", lessons: [
        { title: "Control charts for process data", type: "TEXT", minutes: 120, body: p("## Choosing a chart", "- **I-MR** for individual measurements such as daily laboratory results.", "- **X̄-R** for rational subgroups.", "- **p and u charts** for attribute data.", "## Process data realities", "Continuous process data are often autocorrelated. Sampling intervals and subgroup design must account for this or control limits will be too narrow.", "## Detection rules", "Western Electric and Nelson rules flag non-random patterns in addition to points beyond control limits.") },
        { title: "Hypothesis testing and regression", type: "TEXT", minutes: 120, body: p("## Verifying root causes", "Hypothesis tests quantify whether an observed difference is likely to be real. Regression models the relationship between an output and candidate inputs.", "## Caution", "Correlation in historical process data does not prove causation; controlled trials or engineering reasoning should confirm.") },
        { title: "Green Belt project worksheet", type: "PDF", minutes: 30, required: false, resource: "dmaic-worksheet", body: "Download the DMAIC project worksheet to structure your own project. Optional." },
      ] },
      { title: "Control and assessment", description: "Sustaining gains and final assessment.", lessons: [
        { title: "Control plans", type: "TEXT", minutes: 60, body: p("## Content of a control plan", "Each critical input and output has a target, specification, measurement method, frequency, owner and a defined response when out of control.", "## Handover", "The project closes only when the process owner accepts the control plan and the benefit is validated by finance.") },
        { title: "Green Belt knowledge assessment", type: "ASSESSMENT", minutes: 40 },
      ] },
    ],
    assessment: {
      title: "Green Belt knowledge assessment",
      passing: 70,
      attempts: 2,
      questions: [
        { type: "MULTIPLE_CHOICE", prompt: "A process has mean 9.0, standard deviation 0.25 and upper specification limit 10.0 (no lower limit). What is Cpk?", options: ["0.75", "1.00", "1.33", "4.00"], correct: 2 },
        { type: "MULTIPLE_CHOICE", prompt: "Which chart is most appropriate for one laboratory result per day?", options: ["X̄-R chart", "I-MR chart", "p chart", "c chart"], correct: 1 },
        { type: "TRUE_FALSE", prompt: "Capability indices are meaningful even when the process is not in statistical control.", correct: false },
        { type: "MULTIPLE_CHOICE", prompt: "Gauge R&R reproducibility refers to variation between:", options: ["Repeated measurements by the same operator", "Different operators or instruments", "Different production batches", "Specification limits"], correct: 1 },
        { type: "MULTIPLE_CHOICE", prompt: "Which phase of DMAIC establishes the control plan?", options: ["Define", "Measure", "Improve", "Control"], correct: 3 },
        { type: "TRUE_FALSE", prompt: "Autocorrelation in process data can cause control limits to be too narrow.", correct: true },
      ],
    },
  },
  {
    code: "QRA-320",
    title: "Quantitative Risk Analysis for Engineering Decisions",
    category: "quantitative-risk-analysis",
    synopsis:
      "Introduction to uncertainty modeling, probability distributions, Monte Carlo simulation, sensitivity analysis, risk measures, and decision-making under uncertainty.",
    overview: p(
      "Engineering decisions — project sanction, turnaround scope, inspection intervals — are made with uncertain inputs. This course shows how to represent that uncertainty explicitly, propagate it with simulation, and communicate the results to decision makers.",
      "Worked examples include a cost estimate for a heat-exchanger replacement, schedule risk for a turnaround and the expected value of an inspection programme.",
    ),
    businessRelevance:
      "Single-point estimates hide risk. Probabilistic analysis supports better contingency setting, clearer risk appetite discussions and fewer surprises at project close-out.",
    audience: "Engineers, planners, project controls and risk specialists. Also suitable for managers who review probabilistic estimates.",
    prerequisitesText: "Comfort with spreadsheets and basic probability.",
    objectives: [
      "Select appropriate probability distributions for engineering inputs.",
      "Build and run a Monte Carlo simulation for cost or schedule.",
      "Interpret P10/P50/P90 outcomes and set contingency accordingly.",
      "Use tornado diagrams to identify dominant uncertainties.",
      "Compare decision options using expected value and risk measures.",
    ],
    outcomes: ["A working Monte Carlo cost model.", "A sensitivity analysis communicating the main drivers.", "A decision recommendation that addresses risk appetite."],
    keywords: ["risk analysis", "monte carlo", "uncertainty", "sensitivity analysis", "P90", "decision analysis", "expected value", "probability"],
    difficulty: "ADVANCED",
    delivery: "SELF_PACED",
    hours: 12,
    cpd: { value: 12, note: "Internal CPD value." },
    requireAllLessons: true,
    requireAssessmentPass: true,
    departments: ["ENG", "MNT", "COM"],
    competencies: [["RM-01", 3], ["RM-02", 3], ["DA-03", 2]],
    instructors: ["james.okafor@apex-demo.test"],
    modules: [
      { title: "Representing uncertainty", description: "Distributions and expert elicitation.", lessons: [
        { title: "Why single-point estimates mislead", type: "TEXT", minutes: 45, body: p("## The flaw of averages", "Plans based on average inputs are, on average, wrong. When outcomes depend non-linearly on inputs, or when several uncertain activities sit on a critical path, the average input does not produce the average outcome.", "## Example", "Three parallel turnaround activities each have a 50% chance of finishing in 10 days. The probability that all three finish within 10 days is only 12.5%.") },
        { title: "Choosing probability distributions", type: "TEXT", minutes: 60, body: p("## Common choices", "- **Triangular / PERT**: expert estimates with minimum, most likely, maximum.", "- **Lognormal**: positive, right-skewed quantities such as costs and durations.", "- **Normal**: symmetric measurement errors.", "- **Discrete events**: risk events with a probability of occurrence and an impact distribution.", "## Elicitation bias", "Experts are typically overconfident. Ask for P10 and P90 rather than absolute minimum and maximum, and challenge anchoring.") },
      ] },
      { title: "Simulation and sensitivity", description: "Monte Carlo and tornado analysis.", lessons: [
        { title: "Monte Carlo simulation", type: "TEXT", minutes: 90, body: p("## Method", "Sample each uncertain input from its distribution, compute the outcome, and repeat thousands of times. The collection of outcomes approximates the distribution of the result.", "## Correlation", "Ignoring correlation between inputs — for example, labour rates across work packages — understates the spread of outcomes.", "## Convergence", "Run enough iterations for the percentiles of interest to stabilise; 5,000–10,000 iterations is common for cost models.") },
        { title: "Sensitivity analysis and tornado diagrams", type: "TEXT", minutes: 60, body: p("## Tornado diagrams", "Each input is swung between its P10 and P90 while others are held at base values. Bars are sorted by the size of their effect on the outcome.", "## Using the result", "Focus risk mitigation and information gathering on the top few drivers. Inputs at the bottom of the tornado rarely justify further study.") },
      ] },
      { title: "Decisions under uncertainty", description: "Expected value, risk measures and communication.", lessons: [
        { title: "Expected value and risk appetite", type: "TEXT", minutes: 60, body: p("## Expected value", "The probability-weighted average outcome. It is the right basis for repeated decisions across a portfolio.", "## Risk measures", "For single large decisions, also consider downside measures: P90 cost, probability of exceeding budget, conditional value at risk.", "## Communicating", "Present the distribution, the drivers and the decision implication — not just a number.") },
        { title: "Quantitative risk assessment", type: "ASSESSMENT", minutes: 30 },
      ] },
    ],
    assessment: {
      title: "Quantitative risk assessment",
      passing: 70,
      attempts: 3,
      questions: [
        { type: "MULTIPLE_CHOICE", prompt: "Which distribution is generally most suitable for a right-skewed cost estimate that cannot be negative?", options: ["Normal", "Uniform", "Lognormal", "Bernoulli"], correct: 2 },
        { type: "TRUE_FALSE", prompt: "Ignoring positive correlation between cost inputs tends to understate the spread of the total cost distribution.", correct: true },
        { type: "MULTIPLE_CHOICE", prompt: "A P90 cost of 12.4 million means:", options: ["There is a 90% chance the cost will exceed 12.4 million", "There is a 90% chance the cost will not exceed 12.4 million", "The most likely cost is 12.4 million", "The average cost is 12.4 million"], correct: 1 },
        { type: "MULTIPLE_CHOICE", prompt: "In a tornado diagram, bars are ordered by:", options: ["Alphabetical input name", "Size of effect on the outcome", "Probability of the input", "Order of entry"], correct: 1 },
        { type: "TRUE_FALSE", prompt: "If three independent activities each have a 50% chance of finishing on time, the chance all three finish on time is 50%.", correct: false },
      ],
    },
  },
  {
    code: "UTL-240",
    title: "Refinery Energy and Utilities Optimization",
    category: "utilities-and-energy-management",
    synopsis:
      "Practical examination of steam systems, energy efficiency, utility demand, performance indicators, operational constraints, and optimization opportunities in refinery environments.",
    overview: p(
      "Utilities typically account for a large share of a refinery's controllable operating cost and emissions. This course examines the steam and power system as an integrated network and shows how operators and engineers identify, quantify and capture optimisation opportunities within operating constraints.",
    ),
    businessRelevance: "Energy efficiency improvements reduce operating cost and greenhouse gas emissions simultaneously, and many require operational discipline rather than capital.",
    audience: "Utilities operators, process engineers, energy coordinators and shift supervisors.",
    prerequisitesText: "Working knowledge of refinery process units.",
    objectives: [
      "Map the site steam balance across pressure levels.",
      "Calculate the cost of steam at each header and of steam trap losses.",
      "Identify letdown, venting and boiler loading optimisation opportunities.",
      "Define energy performance indicators for units and the site.",
      "Evaluate optimisation moves against reliability and safety constraints.",
    ],
    outcomes: ["A steam balance for a selected header.", "A prioritised list of energy-saving opportunities with estimated value."],
    keywords: ["energy", "steam", "utilities", "boilers", "steam traps", "energy intensity", "optimization", "emissions"],
    difficulty: "INTERMEDIATE",
    delivery: "SELF_PACED",
    hours: 10,
    cpd: { value: 10, note: "Internal CPD value." },
    requireAllLessons: true,
    requireAssessmentPass: true,
    departments: ["UTL", "ENG", "OPS"],
    competencies: [["PO-04", 3], ["OE-01", 2]],
    instructors: ["priya.natarajan@apex-demo.test"],
    modules: [
      { title: "The steam and power system", description: "Steam generation, distribution and balance.", lessons: [
        { title: "Steam headers and the site balance", type: "TEXT", minutes: 60, body: p("## Pressure levels", "High-, medium- and low-pressure headers are linked by turbines (which generate power or drive machines) and by letdown stations (which waste the pressure energy).", "## The balance", "A steam balance accounts for every source and sink. Persistent letdown or venting indicates an imbalance that can often be corrected by changing turbine and motor-driver selection.") },
        { title: "The cost of steam", type: "TEXT", minutes: 60, body: p("## Marginal cost", "The cost of steam at each header depends on the marginal boiler fuel, boiler efficiency and the value of power generated along the way.", "## Steam traps", "A failed-open trap on a medium-pressure line can waste a significant quantity of steam continuously. Survey programmes typically find a meaningful percentage of traps failed in a typical year.") },
      ] },
      { title: "Optimisation in practice", description: "Indicators, constraints and opportunities.", lessons: [
        { title: "Energy performance indicators", type: "TEXT", minutes: 45, body: p("## Unit-level indicators", "Fired-heater efficiency, excess oxygen, specific steam consumption, cooling-water temperature approach.", "## Site-level indicators", "Energy intensity relative to a reference model allows fair comparison across throughput and crude slate changes.") },
        { title: "Constraints and safe optimisation", type: "TEXT", minutes: 60, body: p("## Constraints", "Minimum boiler turndown, N-1 steam supply security, turbine trip scenarios and emissions permits all limit optimisation.", "## Change control", "Optimisation moves that alter operating envelopes require management of change and agreement with operations.") },
        { title: "Energy and utilities assessment", type: "ASSESSMENT", minutes: 20 },
      ] },
    ],
    assessment: {
      title: "Energy and utilities assessment",
      passing: 70,
      attempts: 3,
      questions: [
        { type: "MULTIPLE_CHOICE", prompt: "Persistent flow through an HP-to-MP letdown station usually indicates:", options: ["Optimal operation", "An opportunity to generate power or rebalance drivers", "A boiler trip", "Excess cooling water"], correct: 1 },
        { type: "TRUE_FALSE", prompt: "The cost of steam is the same at every pressure level.", correct: false },
        { type: "MULTIPLE_CHOICE", prompt: "Which is a unit-level energy indicator for a fired heater?", options: ["Excess oxygen in flue gas", "Number of operators", "Crude price", "Tank inventory"], correct: 0 },
        { type: "TRUE_FALSE", prompt: "Changing a boiler's minimum turndown as an optimisation move may require management of change.", correct: true },
      ],
    },
  },
];

/** Shorter supporting courses that make up the wider catalogue. */
interface ShortSpec {
  code: string;
  title: string;
  category: string;
  synopsis: string;
  hours: number;
  difficulty: SeedCourse["difficulty"];
  delivery: SeedCourse["delivery"];
  departments: string[];
  competencies: [string, number][];
  topics: [string, string][];
  questions: SeedQuestion[];
  cpd?: number;
  mandatory?: boolean;
  acknowledgement?: string;
  certValidityMonths?: number;
  enrolmentRule?: SeedCourse["enrolmentRule"];
  instructors?: string[];
  assignment?: string;
  status?: SeedCourse["status"];
  keywords: string[];
}

const short = (s: ShortSpec): SeedCourse => ({
  code: s.code,
  title: s.title,
  category: s.category,
  synopsis: s.synopsis,
  overview: s.synopsis + " The course combines concise explanation with site-relevant examples and closes with a knowledge assessment.",
  businessRelevance: `Builds capability in ${s.title.toLowerCase()} directly relevant to safe and reliable operations.`,
  audience: "Personnel in the listed departments whose role requires this knowledge.",
  objectives: s.topics.map(([t]) => `Explain the key principles of ${t.toLowerCase()}.`),
  outcomes: ["Ability to apply the course principles in day-to-day work."],
  keywords: s.keywords,
  difficulty: s.difficulty,
  delivery: s.delivery,
  hours: s.hours,
  cpd: s.cpd ? { value: s.cpd, note: "Internal CPD value." } : undefined,
  mandatory: s.mandatory,
  enrolmentRule: s.enrolmentRule,
  requireAllLessons: true,
  requireAssessmentPass: s.questions.length > 0,
  requireAssignmentApproval: !!s.assignment,
  acknowledgement: s.acknowledgement,
  certValidityMonths: s.certValidityMonths,
  recertificationNote: s.certValidityMonths ? `Recertify every ${s.certValidityMonths} months.` : undefined,
  departments: s.departments,
  competencies: s.competencies,
  instructors: s.instructors ?? ["helen.mercer@apex-demo.test"],
  status: s.status,
  modules: [
    {
      title: "Core content",
      description: "Principles and practice.",
      lessons: s.topics.map(([title, body]) => ({ title, type: "TEXT" as const, minutes: Math.max(15, Math.round((s.hours * 60 * 0.8) / s.topics.length)), body })),
    },
    {
      title: "Application and assessment",
      description: "Confirm understanding.",
      lessons: [
        ...(s.assignment ? [{ title: "Practical assignment", type: "ASSIGNMENT" as const, minutes: 60, body: s.assignment }] : []),
        ...(s.questions.length ? [{ title: `${s.title} — knowledge check`, type: "ASSESSMENT" as const, minutes: 15 }] : []),
      ],
    },
  ],
  assessment: s.questions.length ? { title: `${s.title} — knowledge check`, passing: 80, attempts: 3, questions: s.questions } : undefined,
});

export const SHORT_COURSES: SeedCourse[] = [
  short({
    code: "HSE-110", title: "H₂S Awareness and Respiratory Protection", category: "health-safety-and-environment",
    synopsis: "Properties and hazards of hydrogen sulphide, detection, alarm response, respiratory protection selection and rescue principles for sour service areas.",
    hours: 2, difficulty: "FOUNDATION", delivery: "SELF_PACED", departments: ["OPS", "MNT", "HSE", "LAB", "UPO", "UTL"], competencies: [["HS-01", 2]], mandatory: true, certValidityMonths: 24, cpd: 2,
    keywords: ["H2S", "hydrogen sulphide", "gas detection", "breathing apparatus", "sour"],
    topics: [
      ["Properties and health effects of H₂S", p("Hydrogen sulphide is a colourless, flammable and highly toxic gas, heavier than air. At low concentrations it smells of rotten eggs, but olfactory fatigue occurs rapidly at higher concentrations — **smell is not a warning**.", "Exposure effects escalate from eye and respiratory irritation to rapid unconsciousness and death at high concentrations.")],
      ["Detection and alarm response", p("Personal monitors must be bump-tested before use. On alarm: stop work, move upwind or crosswind to the designated muster point, raise the alarm and account for personnel.", "Never enter an area to assist a casualty without appropriate respiratory protection.")],
      ["Respiratory protection and rescue", p("Escape sets provide short-duration protection for evacuation only. Self-contained or airline breathing apparatus is required for work in H₂S atmospheres.", "Rescue is undertaken only by trained teams with breathing apparatus.")],
    ],
    questions: [
      { type: "TRUE_FALSE", prompt: "The smell of H₂S is a reliable indicator of dangerous concentration.", correct: false },
      { type: "MULTIPLE_CHOICE", prompt: "On a personal H₂S alarm, the first action is to:", options: ["Investigate the source", "Stop work and move upwind or crosswind to the muster point", "Put on a dust mask", "Continue work and report later"], correct: 1 },
      { type: "MULTIPLE_CHOICE", prompt: "An escape set is suitable for:", options: ["Routine work in H₂S atmospheres", "Emergency evacuation only", "Confined space rescue", "Tank cleaning"], correct: 1 },
    ],
  }),
  short({
    code: "PSM-120", title: "Permit to Work and Energy Isolation", category: "process-safety-management",
    synopsis: "Principles of the permit-to-work system, isolation methods, verification of zero energy state, and the responsibilities of issuers, acceptors and area authorities.",
    hours: 3, difficulty: "FOUNDATION", delivery: "SELF_PACED", departments: ["OPS", "MNT", "HSE", "UTL", "UPO"], competencies: [["PS-04", 2]], mandatory: true, certValidityMonths: 24, cpd: 3,
    acknowledgement: "I confirm that I have read and understood the site Permit to Work procedure and will comply with it.",
    keywords: ["permit to work", "isolation", "LOTO", "energy isolation", "zero energy"],
    topics: [
      ["Purpose and roles in the permit system", p("The permit to work is a formal system to control non-routine and hazardous work. It defines the work scope, hazards, controls and the people responsible.", "- **Area authority**: accountable for the plant area.", "- **Issuer**: prepares and issues the permit.", "- **Acceptor**: leads the work party and accepts the conditions.")],
      ["Isolation methods and verification", p("Positive isolation (spades, blinds, disconnection) is preferred over valve isolation for hazardous fluids. Every isolation must be verified — for example by bleeding down and confirming zero pressure — before work starts.")],
      ["Handover, suspension and close-out", p("Permits must be handed over at shift change and suspended when work stops. On close-out, the area authority confirms the plant is fit to return to service.")],
    ],
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Which isolation method gives the highest level of security for hazardous fluids?", options: ["Single closed valve", "Double block and bleed", "Positive isolation with spade or blind", "Locked-closed control valve"], correct: 2 },
      { type: "TRUE_FALSE", prompt: "Verification of zero energy is required before work begins.", correct: true },
    ],
  }),
  short({
    code: "OPS-150", title: "Field Operator Practical Rounds", category: "process-operations",
    synopsis: "Structured field rounds, equipment condition monitoring, log keeping and shift handover for new field operators, with a supervised practical assessment.",
    hours: 6, difficulty: "FOUNDATION", delivery: "BLENDED", departments: ["OPS", "UTL"], competencies: [["PO-01", 2], ["PO-02", 2]], cpd: 4, instructors: ["omar.haddad@apex-demo.test"],
    enrolmentRule: "OPEN",
    keywords: ["field rounds", "operator", "handover", "equipment monitoring", "logs"],
    assignment: p("Complete three supervised field rounds on your assigned unit with your shift supervisor. For each round, record:", "- Equipment checked and readings taken.", "- Abnormal observations and actions.", "- Handover notes given to the next shift.", "Submit a summary of the three rounds, including the supervisor's name and dates."),
    topics: [
      ["Purpose of structured rounds", p("Field rounds detect developing equipment problems — leaks, vibration, abnormal temperatures — before they cause trips or releases.", "Rounds follow a defined route and checklist, but operators must also use their senses: look, listen, smell, feel (where safe).")],
      ["Rotating equipment checks", p("Check pump seals for leakage, bearing temperatures, vibration, lube oil level and condition, and coupling guards.", "Report deviations through the maintenance notification process and in the shift log.")],
      ["Logs and shift handover", p("A good handover covers: plant status, abnormal conditions, permits in progress, barrier impairments and planned activities. Use the structured handover template and confirm understanding.")],
    ],
    questions: [
      { type: "TRUE_FALSE", prompt: "Barrier impairments should be included in shift handover.", correct: true },
      { type: "MULTIPLE_CHOICE", prompt: "A pump bearing is noticeably hotter than on previous rounds. What should you do?", options: ["Ignore it if the pump is running", "Record it, compare with history, and raise a maintenance notification", "Shut down the unit", "Wait for the next round"], correct: 1 },
    ],
  }),
  short({
    code: "REL-200", title: "Rotating Equipment Reliability Fundamentals", category: "reliability-and-maintenance",
    synopsis: "Failure modes of pumps and compressors, condition monitoring techniques, lubrication management and defect elimination.",
    hours: 6, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["MNT", "OPS", "ENG"], competencies: [["ER-01", 3], ["ER-02", 2]], cpd: 6, instructors: ["priya.natarajan@apex-demo.test"],
    keywords: ["reliability", "rotating equipment", "pumps", "vibration", "condition monitoring", "lubrication"],
    topics: [
      ["Failure modes of centrifugal pumps", p("Common failure modes include mechanical seal failure, bearing failure, cavitation and impeller wear. Operating far from the best efficiency point accelerates most of them.")],
      ["Condition monitoring", p("Vibration analysis, oil analysis, thermography and ultrasonic monitoring detect degradation early. The P-F interval — from detectable potential failure to functional failure — determines inspection frequency.")],
      ["Defect elimination", p("Bad actors — equipment with repeat failures — are prioritised for root cause analysis. Sustained reliability comes from eliminating defects, not from repairing faster.")],
    ],
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "The P-F interval is used to set:", options: ["Spare parts levels", "Condition monitoring frequency", "Operator staffing", "Energy targets"], correct: 1 },
      { type: "TRUE_FALSE", prompt: "Operating a centrifugal pump far from its best efficiency point can accelerate seal and bearing failures.", correct: true },
    ],
  }),
  short({
    code: "REL-310", title: "Reliability-Centred Maintenance in Practice", category: "reliability-and-maintenance",
    synopsis: "Applying RCM logic to select maintenance tasks based on function, failure consequence and failure pattern.",
    hours: 8, difficulty: "ADVANCED", delivery: "VIRTUAL_CLASSROOM", departments: ["MNT", "ENG"], competencies: [["ER-03", 3], ["ER-02", 3]], cpd: 8, instructors: ["priya.natarajan@apex-demo.test"],
    enrolmentRule: "APPROVAL_REQUIRED",
    keywords: ["RCM", "maintenance strategy", "FMEA", "failure patterns", "reliability"],
    topics: [
      ["Functions and functional failures", p("RCM begins by defining what the asset must do in its operating context, including performance standards, before asking how it can fail to do so.")],
      ["Failure consequences and task selection", p("Consequences — hidden, safety, environmental, operational, non-operational — determine whether a task is worth doing. Hidden failures of protective devices require failure-finding tasks.")],
      ["Implementing and sustaining RCM", p("RCM outputs must be loaded into the maintenance management system and reviewed as failure data accumulate.")],
    ],
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "A failure-finding task is appropriate for:", options: ["Hidden failures of protective devices", "Wear-out of tyres", "Cosmetic damage", "Operator errors"], correct: 0 },
      { type: "TRUE_FALSE", prompt: "RCM starts by defining the asset's functions in its operating context.", correct: true },
    ],
  }),
  short({
    code: "INS-220", title: "Safety Instrumented Functions and SIL Basics", category: "instrumentation-and-control",
    synopsis: "Introduction to safety instrumented systems, safety integrity levels, proof testing and bypass management.",
    hours: 5, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["MNT", "ENG", "OPS"], competencies: [["TK-02", 3], ["PS-03", 2]], cpd: 5, instructors: ["graham.whitfield@apex-demo.test"],
    keywords: ["SIS", "SIL", "safety instrumented function", "proof testing", "bypass", "IEC 61511"],
    topics: [
      ["What a safety instrumented function does", p("A SIF detects a hazardous condition (sensor), decides (logic solver) and acts (final element) to bring the process to a safe state, independently of the basic process control system.")],
      ["Safety integrity levels", p("SIL 1–4 define ranges of probability of failure on demand. The required SIL is determined from risk assessment such as LOPA.")],
      ["Proof testing and bypass management", p("Proof tests reveal dangerous undetected failures. Bypasses must be authorised, time-limited and accompanied by compensating measures.")],
    ],
    questions: [
      { type: "TRUE_FALSE", prompt: "A safety instrumented function should be independent of the basic process control system.", correct: true },
      { type: "MULTIPLE_CHOICE", prompt: "The required SIL for a function is usually determined by:", options: ["Vendor recommendation", "Risk assessment such as LOPA", "Budget", "Operator preference"], correct: 1 },
    ],
  }),
  short({
    code: "AIM-260", title: "Asset Integrity and Risk-Based Inspection", category: "asset-management",
    synopsis: "Damage mechanisms in refinery equipment, inspection planning using risk-based methods, and integrity operating windows.",
    hours: 6, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["MNT", "ENG"], competencies: [["ER-04", 3], ["RM-03", 2]], cpd: 6,
    keywords: ["asset integrity", "RBI", "inspection", "corrosion", "integrity operating windows"],
    topics: [
      ["Damage mechanisms", p("Common mechanisms include general and localised corrosion, high-temperature hydrogen attack, sulphidation, and corrosion under insulation. Each has characteristic locations and conditions.")],
      ["Risk-based inspection", p("RBI ranks equipment by probability and consequence of failure to target inspection effort. Inspection plans are updated as findings come in.")],
      ["Integrity operating windows", p("IOWs define limits on process variables that, if exceeded, accelerate damage. Operators must understand which IOW excursions require immediate action.")],
    ],
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "RBI prioritises inspection based on:", options: ["Equipment age only", "Probability and consequence of failure", "Alphabetical tag order", "Cost of inspection only"], correct: 1 },
    ],
  }),
  short({
    code: "LSS-110", title: "Lean Fundamentals for Process Plants", category: "six-sigma-and-lean",
    synopsis: "Waste identification, 5S, visual management and value stream thinking applied to maintenance, laboratories and operations support.",
    hours: 4, difficulty: "FOUNDATION", delivery: "SELF_PACED", departments: ["OPS", "MNT", "LAB", "SCM"], competencies: [["OE-03", 2]], cpd: 4,
    keywords: ["lean", "5S", "waste", "visual management", "value stream"],
    topics: [
      ["The eight wastes", p("Defects, overproduction, waiting, non-utilised talent, transportation, inventory, motion and extra processing. In process plants, waiting (for permits, parts, laboratory results) is often the largest.")],
      ["5S and visual management", p("Sort, set in order, shine, standardise, sustain. Visual controls make abnormal conditions obvious at a glance.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "Waiting for permits or parts is a form of waste.", correct: true }],
  }),
  short({
    code: "LDR-300", title: "Leadership for Technical Professionals", category: "leadership-and-people-management",
    synopsis: "Transitioning from technical expert to team leader: setting direction, coaching, difficult conversations and leading safety culture.",
    hours: 10, difficulty: "INTERMEDIATE", delivery: "INSTRUCTOR_LED", departments: ["OPS", "ENG", "MNT", "HSE", "HR"], competencies: [["LD-01", 3], ["LD-02", 3]], cpd: 10, enrolmentRule: "APPROVAL_REQUIRED",
    keywords: ["leadership", "coaching", "supervision", "feedback", "safety culture"],
    topics: [
      ["From expert to leader", p("New leaders often keep doing the technical work themselves. Effective leadership shifts focus to setting direction, removing obstacles and developing others.")],
      ["Coaching and feedback", p("Use specific, behaviour-based feedback. Coaching questions help team members find solutions and build capability.")],
      ["Leading safety culture", p("Leaders shape culture through what they pay attention to, how they respond to bad news and whether they stop work when needed.")],
    ],
    questions: [
      { type: "MULTIPLE_CHOICE", prompt: "Effective feedback is best described as:", options: ["General and infrequent", "Specific and behaviour-based", "Delivered only at annual review", "Focused on personality"], correct: 1 },
    ],
  }),
  short({
    code: "COM-230", title: "Energy Economics and Refinery Margins", category: "commercial-and-energy-economics",
    synopsis: "Crack spreads, crude selection economics, product pricing and the drivers of refinery gross margin.",
    hours: 5, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["COM", "ENG", "SCM"], competencies: [["DA-03", 2]], cpd: 5,
    keywords: ["refinery margin", "crack spread", "crude selection", "economics", "pricing"],
    topics: [
      ["Refinery gross margin", p("Gross margin is product revenue less crude and other feedstock cost. Crack spreads provide a simplified market indicator.")],
      ["Crude selection", p("Crude value depends on yields, quality and the refinery's configuration. Linear programming models evaluate crude options against constraints.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "A crack spread is a simplified indicator of refining margin.", correct: true }],
  }),
  short({
    code: "ETH-100", title: "Professional Ethics in Engineering Practice", category: "professional-ethics",
    synopsis: "Ethical responsibilities of engineers and technical professionals, conflicts of interest, speaking up and integrity in technical reporting.",
    hours: 2, difficulty: "FOUNDATION", delivery: "SELF_PACED", departments: ["ENG", "MNT", "OPS", "HSE", "COM", "SCM", "LAB"], competencies: [["RC-02", 2]], cpd: 2,
    keywords: ["ethics", "integrity", "conflict of interest", "speaking up"],
    topics: [
      ["Duties of a professional", p("Professionals hold paramount the safety, health and welfare of the public, act within their competence and report truthfully.")],
      ["Speaking up", p("When technical judgement is overruled in ways that compromise safety, professionals have a duty to escalate through available channels.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "Professionals should only undertake work within their competence.", correct: true }],
  }),
  short({
    code: "DAT-210", title: "Analysing Process Historian Data", category: "data-analytics",
    synopsis: "Extracting, cleaning and analysing time-series data from plant historians to support troubleshooting and performance monitoring.",
    hours: 6, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["ENG", "OPS", "UTL", "LAB"], competencies: [["DA-01", 2], ["DA-02", 3]], cpd: 6,
    keywords: ["data analytics", "historian", "time series", "python", "troubleshooting"],
    topics: [
      ["Historian data fundamentals", p("Historians store compressed time-series data. Understand compression, interpolation and timestamps before drawing conclusions.")],
      ["Cleaning and aligning data", p("Remove bad quality values, align sampling rates and account for transport delays between measurement points.")],
      ["Visual troubleshooting", p("Overlaying related tags, scatter plots and moving statistics reveal relationships faster than tables of numbers.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "Historian compression can affect conclusions drawn from high-frequency analysis.", correct: true }],
  }),
  short({
    code: "PMG-200", title: "Project Management Essentials for Plant Projects", category: "project-management",
    synopsis: "Scope, schedule, cost and risk management for brownfield plant modifications and turnaround projects.",
    hours: 8, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["ENG", "MNT"], competencies: [["RM-02", 2]], cpd: 8,
    keywords: ["project management", "scope", "schedule", "turnaround", "brownfield"],
    topics: [
      ["Scope definition and front-end loading", p("Well-defined scope before sanction is the strongest predictor of project success. Front-end loading reviews confirm readiness to proceed.")],
      ["Schedule and cost control", p("Earned value compares planned and actual progress and cost, providing early warning of overruns.")],
    ],
    questions: [{ type: "MULTIPLE_CHOICE", prompt: "Earned value management compares:", options: ["Planned, earned and actual cost", "Crude and product prices", "Staff headcount", "Safety statistics"], correct: 0 }],
  }),
  short({
    code: "UPS-150", title: "Upstream Production Operations Overview", category: "upstream-operations",
    synopsis: "Overview of wellhead, separation, gas handling and produced water systems in onshore production facilities.",
    hours: 4, difficulty: "FOUNDATION", delivery: "SELF_PACED", departments: ["UPO"], competencies: [["TK-01", 2]], cpd: 4,
    keywords: ["upstream", "production", "separation", "wellhead", "produced water"],
    topics: [
      ["From wellhead to export", p("Fluids flow from the wellhead through flowlines to separation, where oil, gas and water are separated for treatment and export.")],
      ["Produced water and gas handling", p("Produced water treatment protects the environment and injection systems; associated gas is compressed, used as fuel or exported.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "Separation divides produced fluids into oil, gas and water.", correct: true }],
  }),
  short({
    code: "DEC-330", title: "Practical Decision Analysis for Engineers", category: "decision-analysis-and-optimization",
    synopsis: "Structuring complex decisions with influence diagrams, decision trees and multi-criteria analysis; introduction to linear programming for optimisation.",
    hours: 8, difficulty: "ADVANCED", delivery: "SELF_PACED", departments: ["ENG", "COM"], competencies: [["DA-03", 3], ["RM-01", 2]], cpd: 8,
    keywords: ["decision analysis", "decision tree", "optimization", "linear programming", "multi-criteria"],
    topics: [
      ["Framing the decision", p("Separate decisions, uncertainties and values. Influence diagrams make the structure explicit before any numbers are added.")],
      ["Decision trees and value of information", p("Decision trees combine choices and chance events. The value of information shows how much it is worth paying to reduce an uncertainty.")],
      ["Optimisation with linear programming", p("LP finds the best allocation subject to linear constraints — the basis of refinery planning models.")],
    ],
    questions: [{ type: "MULTIPLE_CHOICE", prompt: "The value of information is:", options: ["The cost of a study", "The increase in expected value from resolving an uncertainty before deciding", "Always zero", "The price of software"], correct: 1 }],
  }),
  short({
    code: "DIG-150", title: "Responsible Use of AI in Industrial Operations", category: "digital-transformation-and-ai",
    synopsis: "Capabilities and limits of machine learning and generative AI in operations, data governance, validation and human oversight.",
    hours: 3, difficulty: "FOUNDATION", delivery: "SELF_PACED", departments: ["ENG", "OPS", "MNT", "COM", "HR", "LND"], competencies: [["DA-04", 2]], cpd: 3,
    keywords: ["AI", "machine learning", "generative AI", "data governance", "digital"],
    topics: [
      ["What AI can and cannot do", p("Machine learning finds patterns in historical data; it does not understand physics or plant changes it has not seen. Generative AI produces fluent text that can be wrong.")],
      ["Validation and human oversight", p("AI outputs that influence operational or safety decisions must be validated and remain subject to accountable human judgement.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "AI recommendations affecting safety decisions should remain subject to human judgement.", correct: true }],
  }),
  short({
    code: "REG-210", title: "Environmental Compliance: Flaring and Emissions Reporting", category: "regulatory-compliance",
    synopsis: "Permit conditions, flare minimisation, emissions monitoring and regulatory reporting obligations.",
    hours: 3, difficulty: "INTERMEDIATE", delivery: "SELF_PACED", departments: ["HSE", "OPS", "UTL"], competencies: [["RC-01", 3]], cpd: 3,
    keywords: ["environment", "flaring", "emissions", "permit", "regulatory reporting"],
    topics: [
      ["Permit conditions", p("Environmental permits set limits and monitoring obligations. Operators must know which conditions apply to their unit.")],
      ["Flare minimisation and reporting", p("Flaring events are recorded with cause and volume. Repeat events trigger investigation and corrective action.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "Flaring events should be recorded with cause and volume.", correct: true }],
  }),
  short({
    code: "OPS-320", title: "Operations Supervision and Shift Leadership", category: "process-operations",
    synopsis: "Responsibilities of the shift supervisor: work prioritisation, permit oversight, abnormal situation management and team leadership.",
    hours: 8, difficulty: "ADVANCED", delivery: "BLENDED", departments: ["OPS", "UTL"], competencies: [["PO-03", 3], ["LD-01", 2]], cpd: 8, status: "IN_REVIEW",
    keywords: ["supervision", "shift leadership", "abnormal situations"],
    topics: [
      ["Role of the shift supervisor", p("The supervisor balances production, maintenance and safety priorities across the shift and is the escalation point for abnormal conditions.")],
      ["Abnormal situation management", p("Early recognition, clear roles and disciplined communication prevent abnormal situations from escalating.")],
    ],
    questions: [{ type: "TRUE_FALSE", prompt: "The shift supervisor is the first escalation point for abnormal conditions.", correct: true }],
  }),
];

export const ALL_COURSES = [...COURSES, ...SHORT_COURSES];
