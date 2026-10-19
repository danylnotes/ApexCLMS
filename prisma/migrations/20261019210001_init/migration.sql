-- CreateEnum
CREATE TYPE "UserStatus" AS ENUM ('INVITED', 'ACTIVE', 'DEACTIVATED');

-- CreateEnum
CREATE TYPE "EmploymentStatus" AS ENUM ('PERMANENT', 'CONTRACT', 'ON_LEAVE', 'SECONDED');

-- CreateEnum
CREATE TYPE "ManagerRelationshipType" AS ENUM ('LINE', 'DOTTED');

-- CreateEnum
CREATE TYPE "AuthTokenType" AS ENUM ('PASSWORD_RESET', 'EMAIL_VERIFICATION', 'INVITATION');

-- CreateEnum
CREATE TYPE "FilePurpose" AS ENUM ('COURSE_MATERIAL', 'CPD_EVIDENCE', 'COMPETENCY_EVIDENCE', 'ASSIGNMENT_SUBMISSION', 'CREDENTIAL', 'BRANDING');

-- CreateEnum
CREATE TYPE "CourseStatus" AS ENUM ('DRAFT', 'IN_REVIEW', 'PUBLISHED', 'ARCHIVED');

-- CreateEnum
CREATE TYPE "Difficulty" AS ENUM ('FOUNDATION', 'INTERMEDIATE', 'ADVANCED', 'EXPERT');

-- CreateEnum
CREATE TYPE "DeliveryMode" AS ENUM ('SELF_PACED', 'INSTRUCTOR_LED', 'BLENDED', 'VIRTUAL_CLASSROOM');

-- CreateEnum
CREATE TYPE "EnrolmentRule" AS ENUM ('OPEN', 'APPROVAL_REQUIRED', 'ASSIGNED_ONLY');

-- CreateEnum
CREATE TYPE "CpdUnit" AS ENUM ('HOURS', 'POINTS');

-- CreateEnum
CREATE TYPE "LessonType" AS ENUM ('TEXT', 'VIDEO', 'PDF', 'DOCUMENT', 'EXTERNAL', 'ASSESSMENT', 'ASSIGNMENT');

-- CreateEnum
CREATE TYPE "QuestionType" AS ENUM ('MULTIPLE_CHOICE', 'TRUE_FALSE', 'SHORT_ANSWER');

-- CreateEnum
CREATE TYPE "EnrollmentStatus" AS ENUM ('PENDING_APPROVAL', 'ACTIVE', 'COMPLETED', 'WITHDRAWN', 'REJECTED');

-- CreateEnum
CREATE TYPE "EnrollmentSource" AS ENUM ('SELF', 'ASSIGNMENT', 'LEARNING_PATH', 'ADMIN');

-- CreateEnum
CREATE TYPE "AttemptStatus" AS ENUM ('IN_PROGRESS', 'PENDING_REVIEW', 'GRADED');

-- CreateEnum
CREATE TYPE "SubmissionStatus" AS ENUM ('SUBMITTED', 'APPROVED', 'REVISION_REQUESTED');

-- CreateEnum
CREATE TYPE "CertificateStatus" AS ENUM ('VALID', 'REVOKED');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('ENROLLED', 'LESSON_COMPLETED', 'ASSESSMENT_SUBMITTED', 'ASSESSMENT_PASSED', 'ASSESSMENT_FAILED', 'COURSE_COMPLETED', 'CERTIFICATE_ISSUED', 'WEBINAR_REGISTERED', 'WEBINAR_ATTENDED', 'CPD_SUBMITTED', 'CPD_APPROVED', 'CPD_REJECTED', 'COMPETENCY_ASSESSED', 'PLAN_REVIEWED', 'PATH_STARTED');

-- CreateEnum
CREATE TYPE "WebinarStatus" AS ENUM ('DRAFT', 'SCHEDULED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "MeetingProvider" AS ENUM ('NONE', 'MICROSOFT_TEAMS', 'ZOOM', 'OTHER');

-- CreateEnum
CREATE TYPE "RegistrationStatus" AS ENUM ('REGISTERED', 'WAITLISTED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AttendanceVerification" AS ENUM ('INSTRUCTOR_CONFIRMED', 'PLATFORM_RECORD', 'ADMIN_PROCESS', 'UNVERIFIED');

-- CreateEnum
CREATE TYPE "CpdActivityType" AS ENUM ('INTERNAL_COURSE', 'EXTERNAL_TRAINING', 'TECHNICAL_SEMINAR', 'WEBINAR', 'CONFERENCE', 'TECHNICAL_PRESENTATION', 'PUBLICATION', 'MENTORING', 'OTHER');

-- CreateEnum
CREATE TYPE "CpdRecognition" AS ENUM ('COMPANY_RECORDED', 'PROFESSIONAL_BODY');

-- CreateEnum
CREATE TYPE "CpdClaimStatus" AS ENUM ('DRAFT', 'SUBMITTED', 'UNDER_REVIEW', 'APPROVED', 'REJECTED');

-- CreateEnum
CREATE TYPE "FrameworkStatus" AS ENUM ('DRAFT', 'ACTIVE', 'RETIRED');

-- CreateEnum
CREATE TYPE "AssessmentMethod" AS ENUM ('COURSE_COMPLETION', 'KNOWLEDGE_ASSESSMENT', 'PRACTICAL_DEMONSTRATION', 'SUPERVISOR_EVALUATION', 'WORKPLACE_OBSERVATION', 'VERIFIED_QUALIFICATION', 'FORMAL_ASSESSMENT');

-- CreateEnum
CREATE TYPE "EvidenceBasis" AS ENUM ('KNOWLEDGE', 'DEMONSTRATED');

-- CreateEnum
CREATE TYPE "CompetencyAssessmentStatus" AS ENUM ('CURRENT', 'SUPERSEDED', 'WITHDRAWN');

-- CreateEnum
CREATE TYPE "ReviewRequestStatus" AS ENUM ('PENDING', 'ASSESSED', 'DECLINED');

-- CreateEnum
CREATE TYPE "PlanStatus" AS ENUM ('DRAFT', 'EMPLOYEE_REVIEW', 'MANAGER_REVIEW', 'AGREED', 'IN_PROGRESS', 'COMPLETED');

-- CreateEnum
CREATE TYPE "ObjectiveStatus" AS ENUM ('NOT_STARTED', 'IN_PROGRESS', 'COMPLETED', 'DEFERRED');

-- CreateEnum
CREATE TYPE "LearningModel" AS ENUM ('EXPERIENTIAL', 'SOCIAL', 'FORMAL');

-- CreateEnum
CREATE TYPE "DevelopmentActionType" AS ENUM ('COURSE', 'WEBINAR', 'ON_THE_JOB', 'MENTORING', 'PROJECT', 'OTHER');

-- CreateEnum
CREATE TYPE "AssignmentKind" AS ENUM ('REQUIRED', 'RECOMMENDED');

-- CreateEnum
CREATE TYPE "AssignmentStatus" AS ENUM ('ASSIGNED', 'COMPLETED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "NotificationType" AS ENUM ('ASSIGNMENT_NEW', 'DEADLINE_APPROACHING', 'MANDATORY_OVERDUE', 'WEBINAR_REGISTERED', 'WEBINAR_UPCOMING', 'COURSE_COMPLETED', 'ASSESSMENT_RESULT', 'CERTIFICATE_ISSUED', 'CPD_DECISION', 'COMPETENCY_REVIEW', 'PLAN_REVIEW', 'ENROLMENT_DECISION', 'SYSTEM');

-- CreateEnum
CREATE TYPE "DeliveryStatus" AS ENUM ('NOT_REQUESTED', 'QUEUED', 'SENT', 'FAILED');

-- CreateTable
CREATE TABLE "users" (
    "id" TEXT NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "passwordHash" TEXT,
    "status" "UserStatus" NOT NULL DEFAULT 'INVITED',
    "emailVerifiedAt" TIMESTAMP(3),
    "lastLoginAt" TIMESTAMP(3),
    "failedLoginCount" INTEGER NOT NULL DEFAULT 0,
    "lockedUntil" TIMESTAMP(3),
    "isDemo" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "users_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "user_profiles" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "employeeNumber" TEXT,
    "jobRoleId" TEXT,
    "targetJobRoleId" TEXT,
    "departmentId" TEXT,
    "businessUnitId" TEXT,
    "location" TEXT,
    "hireDate" TIMESTAMP(3),
    "employmentStatus" "EmploymentStatus" NOT NULL DEFAULT 'PERMANENT',
    "learningProgramme" TEXT,
    "cpdPolicyId" TEXT,
    "phone" TEXT,
    "bio" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "user_profiles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "roles" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "isSystem" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "permissions" (
    "id" TEXT NOT NULL,
    "key" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "group" TEXT NOT NULL,

    CONSTRAINT "permissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_permissions" (
    "roleId" TEXT NOT NULL,
    "permissionId" TEXT NOT NULL,

    CONSTRAINT "role_permissions_pkey" PRIMARY KEY ("roleId","permissionId")
);

-- CreateTable
CREATE TABLE "user_roles" (
    "userId" TEXT NOT NULL,
    "roleId" TEXT NOT NULL,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "user_roles_pkey" PRIMARY KEY ("userId","roleId")
);

-- CreateTable
CREATE TABLE "business_units" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "business_units_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "departments" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "businessUnitId" TEXT,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "departments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "job_roles" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "careerTrack" TEXT,
    "grade" INTEGER,
    "departmentId" TEXT,
    "minYearsExperience" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "job_roles_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "career_pathways" (
    "id" TEXT NOT NULL,
    "fromRoleId" TEXT NOT NULL,
    "toRoleId" TEXT NOT NULL,
    "typicalYears" INTEGER,
    "notes" TEXT,

    CONSTRAINT "career_pathways_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "manager_relationships" (
    "id" TEXT NOT NULL,
    "managerId" TEXT NOT NULL,
    "employeeId" TEXT NOT NULL,
    "type" "ManagerRelationshipType" NOT NULL DEFAULT 'LINE',
    "startDate" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "endDate" TIMESTAMP(3),

    CONSTRAINT "manager_relationships_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "sessions" (
    "id" TEXT NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "lastSeenAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "revokedAt" TIMESTAMP(3),
    "ip" TEXT,
    "userAgent" TEXT,

    CONSTRAINT "sessions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "auth_tokens" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "AuthTokenType" NOT NULL,
    "tokenHash" TEXT NOT NULL,
    "expiresAt" TIMESTAMP(3) NOT NULL,
    "usedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "auth_tokens_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "rate_limit_buckets" (
    "key" TEXT NOT NULL,
    "windowStart" TIMESTAMP(3) NOT NULL,
    "count" INTEGER NOT NULL,

    CONSTRAINT "rate_limit_buckets_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "stored_files" (
    "id" TEXT NOT NULL,
    "storageKey" TEXT NOT NULL,
    "originalName" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "sha256" TEXT NOT NULL,
    "purpose" "FilePurpose" NOT NULL,
    "uploadedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "stored_files_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_categories" (
    "id" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_categories_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "courses" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "categoryId" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "businessRelevance" TEXT,
    "intendedAudience" TEXT,
    "prerequisitesText" TEXT,
    "objectives" TEXT[],
    "outcomes" TEXT[],
    "keywords" TEXT[],
    "difficulty" "Difficulty" NOT NULL DEFAULT 'FOUNDATION',
    "deliveryMode" "DeliveryMode" NOT NULL DEFAULT 'SELF_PACED',
    "provider" TEXT NOT NULL DEFAULT 'Internal — Learning & Development',
    "estimatedHours" DECIMAL(6,2) NOT NULL,
    "cpdEligible" BOOLEAN NOT NULL DEFAULT false,
    "cpdValue" DECIMAL(6,2),
    "cpdUnit" "CpdUnit" NOT NULL DEFAULT 'HOURS',
    "cpdAccreditationNote" TEXT,
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "enrolmentRule" "EnrolmentRule" NOT NULL DEFAULT 'OPEN',
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "requireAllLessons" BOOLEAN NOT NULL DEFAULT true,
    "requireAssessmentPass" BOOLEAN NOT NULL DEFAULT false,
    "requireAssignmentApproval" BOOLEAN NOT NULL DEFAULT false,
    "requireAcknowledgement" BOOLEAN NOT NULL DEFAULT false,
    "acknowledgementText" TEXT,
    "certificateEnabled" BOOLEAN NOT NULL DEFAULT true,
    "certificateValidityMonths" INTEGER,
    "recertificationNote" TEXT,
    "publishedAt" TIMESTAMP(3),
    "archivedAt" TIMESTAMP(3),
    "createdById" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "courses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_departments" (
    "courseId" TEXT NOT NULL,
    "departmentId" TEXT NOT NULL,

    CONSTRAINT "course_departments_pkey" PRIMARY KEY ("courseId","departmentId")
);

-- CreateTable
CREATE TABLE "course_instructors" (
    "courseId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "isLead" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "course_instructors_pkey" PRIMARY KEY ("courseId","userId")
);

-- CreateTable
CREATE TABLE "course_prerequisites" (
    "courseId" TEXT NOT NULL,
    "prerequisiteId" TEXT NOT NULL,

    CONSTRAINT "course_prerequisites_pkey" PRIMARY KEY ("courseId","prerequisiteId")
);

-- CreateTable
CREATE TABLE "course_competencies" (
    "courseId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "targetLevel" INTEGER NOT NULL,

    CONSTRAINT "course_competencies_pkey" PRIMARY KEY ("courseId","competencyId")
);

-- CreateTable
CREATE TABLE "course_modules" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "course_modules_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lessons" (
    "id" TEXT NOT NULL,
    "moduleId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "LessonType" NOT NULL DEFAULT 'TEXT',
    "sortOrder" INTEGER NOT NULL,
    "body" TEXT,
    "videoUrl" TEXT,
    "externalUrl" TEXT,
    "durationMinutes" INTEGER,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "assessmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "lessons_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_resources" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "fileId" TEXT NOT NULL,
    "label" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "lesson_resources_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessments" (
    "id" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "passingScore" INTEGER NOT NULL DEFAULT 70,
    "maxAttempts" INTEGER NOT NULL DEFAULT 3,
    "timeLimitMinutes" INTEGER,
    "isFinal" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_questions" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "type" "QuestionType" NOT NULL,
    "prompt" TEXT NOT NULL,
    "points" INTEGER NOT NULL DEFAULT 1,
    "options" JSONB,
    "correctOptionId" TEXT,
    "correctBoolean" BOOLEAN,
    "guidance" TEXT,

    CONSTRAINT "assessment_questions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "enrollments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "cycle" INTEGER NOT NULL DEFAULT 1,
    "status" "EnrollmentStatus" NOT NULL DEFAULT 'ACTIVE',
    "source" "EnrollmentSource" NOT NULL DEFAULT 'SELF',
    "enrolledAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "startedAt" TIMESTAMP(3),
    "lastAccessedAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "dueDate" TIMESTAMP(3),
    "acknowledgedAt" TIMESTAMP(3),
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "lesson_progress" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),
    "lastViewedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "timeSpentSeconds" INTEGER NOT NULL DEFAULT 0,
    "videoPositionSeconds" INTEGER,

    CONSTRAINT "lesson_progress_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_attempts" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attemptNumber" INTEGER NOT NULL,
    "status" "AttemptStatus" NOT NULL DEFAULT 'IN_PROGRESS',
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "submittedAt" TIMESTAMP(3),
    "gradedAt" TIMESTAMP(3),
    "gradedById" TEXT,
    "score" INTEGER,
    "maxScore" INTEGER,
    "percent" INTEGER,
    "passed" BOOLEAN,
    "feedback" TEXT,

    CONSTRAINT "assessment_attempts_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assessment_responses" (
    "id" TEXT NOT NULL,
    "attemptId" TEXT NOT NULL,
    "questionId" TEXT NOT NULL,
    "selectedOptionId" TEXT,
    "booleanAnswer" BOOLEAN,
    "textAnswer" TEXT,
    "isCorrect" BOOLEAN,
    "pointsAwarded" INTEGER,
    "feedback" TEXT,

    CONSTRAINT "assessment_responses_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "assignment_submissions" (
    "id" TEXT NOT NULL,
    "lessonId" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "fileId" TEXT,
    "status" "SubmissionStatus" NOT NULL DEFAULT 'SUBMITTED',
    "submittedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "feedback" TEXT,

    CONSTRAINT "assignment_submissions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_completions" (
    "id" TEXT NOT NULL,
    "enrollmentId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "completedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finalPercent" INTEGER,
    "ruleSnapshot" JSONB NOT NULL,

    CONSTRAINT "course_completions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificate_templates" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "heading" TEXT NOT NULL DEFAULT 'Certificate of Completion',
    "bodyText" TEXT NOT NULL,
    "signatoryName" TEXT NOT NULL,
    "signatoryTitle" TEXT NOT NULL,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "certificate_templates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "certificates" (
    "id" TEXT NOT NULL,
    "serial" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "completionId" TEXT NOT NULL,
    "templateId" TEXT,
    "issuedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "expiresAt" TIMESTAMP(3),
    "status" "CertificateStatus" NOT NULL DEFAULT 'VALID',
    "revokedAt" TIMESTAMP(3),
    "revokedReason" TEXT,

    CONSTRAINT "certificates_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "credentials" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "issuer" TEXT NOT NULL,
    "credentialNo" TEXT,
    "issuedOn" TIMESTAMP(3) NOT NULL,
    "expiresOn" TIMESTAMP(3),
    "verifiedAt" TIMESTAMP(3),
    "verifiedById" TEXT,
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "credentials_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_activity_events" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "ActivityType" NOT NULL,
    "occurredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "summary" TEXT NOT NULL,
    "refType" TEXT,
    "refId" TEXT,
    "metadata" JSONB,

    CONSTRAINT "learning_activity_events_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_paths" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "summary" TEXT NOT NULL,
    "targetAudience" TEXT NOT NULL,
    "entryRequirements" TEXT,
    "completionCriteria" TEXT NOT NULL,
    "expectedHours" DECIMAL(6,2) NOT NULL,
    "estimatedDurationWeeks" INTEGER,
    "cpdEligible" BOOLEAN NOT NULL DEFAULT false,
    "targetJobRoleId" TEXT,
    "status" "CourseStatus" NOT NULL DEFAULT 'DRAFT',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_paths_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_items" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "courseId" TEXT NOT NULL,
    "sortOrder" INTEGER NOT NULL,
    "isRequired" BOOLEAN NOT NULL DEFAULT true,
    "prerequisiteItemId" TEXT,
    "note" TEXT,

    CONSTRAINT "learning_path_items_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_path_competencies" (
    "pathId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,

    CONSTRAINT "learning_path_competencies_pkey" PRIMARY KEY ("pathId","competencyId")
);

-- CreateTable
CREATE TABLE "learning_path_enrollments" (
    "id" TEXT NOT NULL,
    "pathId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "learning_path_enrollments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinars" (
    "id" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "slug" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "synopsis" TEXT NOT NULL,
    "overview" TEXT NOT NULL,
    "objectives" TEXT[],
    "speakerName" TEXT NOT NULL,
    "speakerTitle" TEXT,
    "speakerBio" TEXT,
    "categoryId" TEXT,
    "startsAt" TIMESTAMP(3) NOT NULL,
    "durationMinutes" INTEGER NOT NULL,
    "timeZone" TEXT NOT NULL DEFAULT 'Asia/Baghdad',
    "capacity" INTEGER,
    "status" "WebinarStatus" NOT NULL DEFAULT 'SCHEDULED',
    "cancellationReason" TEXT,
    "registrationRequirements" TEXT,
    "minAttendanceMinutes" INTEGER,
    "cpdEligible" BOOLEAN NOT NULL DEFAULT false,
    "cpdValue" DECIMAL(6,2),
    "cpdUnit" "CpdUnit" NOT NULL DEFAULT 'HOURS',
    "meetingProvider" "MeetingProvider" NOT NULL DEFAULT 'NONE',
    "meetingUrl" TEXT,
    "externalMeetingId" TEXT,
    "agenda" JSONB,
    "resources" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "webinars_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_registrations" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "status" "RegistrationStatus" NOT NULL DEFAULT 'REGISTERED',
    "registeredAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "cancelledAt" TIMESTAMP(3),

    CONSTRAINT "webinar_registrations_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_attendance" (
    "id" TEXT NOT NULL,
    "registrationId" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "attended" BOOLEAN NOT NULL,
    "attendedMinutes" INTEGER,
    "verification" "AttendanceVerification" NOT NULL,
    "recordedById" TEXT NOT NULL,
    "recordedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "notes" TEXT,
    "cpdProcessedAt" TIMESTAMP(3),

    CONSTRAINT "webinar_attendance_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_recordings" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "url" TEXT NOT NULL,
    "durationMinutes" INTEGER,
    "availableFrom" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "availableUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webinar_recordings_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "webinar_feedback" (
    "id" TEXT NOT NULL,
    "webinarId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "rating" INTEGER NOT NULL,
    "relevance" INTEGER,
    "comments" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "webinar_feedback_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reporting_periods" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "startDate" TIMESTAMP(3) NOT NULL,
    "endDate" TIMESTAMP(3) NOT NULL,
    "isCurrent" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reporting_periods_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_policies" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "professionalBody" TEXT,
    "unit" "CpdUnit" NOT NULL DEFAULT 'HOURS',
    "targetPerPeriod" DECIMAL(6,2),
    "pointsPerHour" DECIMAL(6,2),
    "maxPerActivity" DECIMAL(6,2),
    "eligibleTypes" "CpdActivityType"[],
    "autoApproveVerifiedInternal" BOOLEAN NOT NULL DEFAULT false,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpd_policies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_activities" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "CpdActivityType" NOT NULL,
    "provider" TEXT,
    "activityDate" TIMESTAMP(3) NOT NULL,
    "durationHours" DECIMAL(6,2) NOT NULL,
    "description" TEXT,
    "learningOutcomes" TEXT,
    "competencyId" TEXT,
    "courseCompletionId" TEXT,
    "webinarAttendanceId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpd_activities_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_claims" (
    "id" TEXT NOT NULL,
    "activityId" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "periodId" TEXT,
    "unit" "CpdUnit" NOT NULL DEFAULT 'HOURS',
    "claimedValue" DECIMAL(6,2) NOT NULL,
    "approvedValue" DECIMAL(6,2),
    "recognition" "CpdRecognition" NOT NULL DEFAULT 'COMPANY_RECORDED',
    "status" "CpdClaimStatus" NOT NULL DEFAULT 'DRAFT',
    "submittedAt" TIMESTAMP(3),
    "decidedAt" TIMESTAMP(3),
    "rejectionReason" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "cpd_claims_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_evidence" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "fileId" TEXT,
    "reference" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpd_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "cpd_approvals" (
    "id" TEXT NOT NULL,
    "claimId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "CpdClaimStatus" NOT NULL,
    "toStatus" "CpdClaimStatus" NOT NULL,
    "value" DECIMAL(6,2),
    "comment" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "cpd_approvals_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_frameworks" (
    "id" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "version" TEXT NOT NULL,
    "description" TEXT,
    "status" "FrameworkStatus" NOT NULL DEFAULT 'DRAFT',
    "allowCourseCompletionAsCompetence" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competency_frameworks_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "proficiency_levels" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,

    CONSTRAINT "proficiency_levels_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_domains" (
    "id" TEXT NOT NULL,
    "frameworkId" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,

    CONSTRAINT "competency_domains_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competencies" (
    "id" TEXT NOT NULL,
    "domainId" TEXT NOT NULL,
    "code" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT NOT NULL,
    "evidenceRequirements" TEXT,
    "assessmentCriteria" TEXT,
    "reassessmentMonths" INTEGER,
    "isActive" BOOLEAN NOT NULL DEFAULT true,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "competencies_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "role_competency_requirements" (
    "id" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "requiredLevel" INTEGER NOT NULL,
    "isCritical" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "role_competency_requirements_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_assessments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "level" INTEGER NOT NULL,
    "method" "AssessmentMethod" NOT NULL,
    "basis" "EvidenceBasis" NOT NULL,
    "status" "CompetencyAssessmentStatus" NOT NULL DEFAULT 'CURRENT',
    "assessedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "assessorId" TEXT,
    "reassessmentDue" TIMESTAMP(3),
    "notes" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_assessments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_evidence" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "kind" "AssessmentMethod" NOT NULL,
    "description" TEXT NOT NULL,
    "reference" TEXT,
    "fileId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_evidence_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_assessment_history" (
    "id" TEXT NOT NULL,
    "assessmentId" TEXT NOT NULL,
    "action" TEXT NOT NULL,
    "fromStatus" "CompetencyAssessmentStatus",
    "toStatus" "CompetencyAssessmentStatus" NOT NULL,
    "actorId" TEXT,
    "note" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_assessment_history_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "competency_review_requests" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "competencyId" TEXT NOT NULL,
    "requestedLevel" INTEGER NOT NULL,
    "statement" TEXT NOT NULL,
    "fileId" TEXT,
    "status" "ReviewRequestStatus" NOT NULL DEFAULT 'PENDING',
    "reviewerId" TEXT,
    "reviewedAt" TIMESTAMP(3),
    "reviewNote" TEXT,
    "assessmentId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "competency_review_requests_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_plans" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "reviewerId" TEXT,
    "periodId" TEXT,
    "targetJobRoleId" TEXT,
    "title" TEXT NOT NULL,
    "careerAspiration" TEXT,
    "status" "PlanStatus" NOT NULL DEFAULT 'DRAFT',
    "version" INTEGER NOT NULL DEFAULT 1,
    "agreedAt" TIMESTAMP(3),
    "lastReviewedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_plans_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_objectives" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "goal" TEXT NOT NULL,
    "currentCapability" TEXT,
    "targetCapability" TEXT,
    "competencyId" TEXT,
    "competencyGap" TEXT,
    "workplaceApplication" TEXT,
    "supportingEvidence" TEXT,
    "responsible" TEXT,
    "learningModel" "LearningModel",
    "targetDate" TIMESTAMP(3),
    "reviewDate" TIMESTAMP(3),
    "status" "ObjectiveStatus" NOT NULL DEFAULT 'NOT_STARTED',
    "managerFeedback" TEXT,
    "sortOrder" INTEGER NOT NULL DEFAULT 0,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "development_objectives_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_actions" (
    "id" TEXT NOT NULL,
    "objectiveId" TEXT NOT NULL,
    "title" TEXT NOT NULL,
    "type" "DevelopmentActionType" NOT NULL,
    "courseId" TEXT,
    "webinarId" TEXT,
    "dueDate" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_actions_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_reviews" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "actorId" TEXT NOT NULL,
    "fromStatus" "PlanStatus" NOT NULL,
    "toStatus" "PlanStatus" NOT NULL,
    "decision" TEXT NOT NULL,
    "comments" TEXT,
    "snapshot" JSONB NOT NULL,
    "version" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_reviews_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "development_comments" (
    "id" TEXT NOT NULL,
    "planId" TEXT NOT NULL,
    "objectiveId" TEXT,
    "authorId" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "development_comments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "learning_assignments" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "courseId" TEXT,
    "pathId" TEXT,
    "assignedById" TEXT NOT NULL,
    "kind" "AssignmentKind" NOT NULL DEFAULT 'REQUIRED',
    "isMandatory" BOOLEAN NOT NULL DEFAULT false,
    "reason" TEXT,
    "dueDate" TIMESTAMP(3),
    "status" "AssignmentStatus" NOT NULL DEFAULT 'ASSIGNED',
    "completedAt" TIMESTAMP(3),
    "batchId" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "learning_assignments_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notifications" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "title" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "link" TEXT,
    "dedupeKey" TEXT NOT NULL,
    "readAt" TIMESTAMP(3),
    "emailStatus" "DeliveryStatus" NOT NULL DEFAULT 'NOT_REQUESTED',
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "notifications_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "notification_preferences" (
    "userId" TEXT NOT NULL,
    "type" "NotificationType" NOT NULL,
    "inApp" BOOLEAN NOT NULL DEFAULT true,
    "email" BOOLEAN NOT NULL DEFAULT false,

    CONSTRAINT "notification_preferences_pkey" PRIMARY KEY ("userId","type")
);

-- CreateTable
CREATE TABLE "email_outbox" (
    "id" TEXT NOT NULL,
    "toAddress" TEXT NOT NULL,
    "subject" TEXT NOT NULL,
    "body" TEXT NOT NULL,
    "provider" TEXT NOT NULL,
    "status" "DeliveryStatus" NOT NULL DEFAULT 'QUEUED',
    "error" TEXT,
    "sentAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "email_outbox_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "reports" (
    "id" TEXT NOT NULL,
    "type" TEXT NOT NULL,
    "format" TEXT NOT NULL,
    "parameters" JSONB NOT NULL,
    "rowCount" INTEGER NOT NULL,
    "generatedById" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "reports_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "audit_logs" (
    "id" TEXT NOT NULL,
    "actorId" TEXT,
    "action" TEXT NOT NULL,
    "entityType" TEXT NOT NULL,
    "entityId" TEXT,
    "metadata" JSONB,
    "ip" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "audit_logs_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "platform_settings" (
    "key" TEXT NOT NULL,
    "value" JSONB NOT NULL,
    "updatedById" TEXT,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "platform_settings_pkey" PRIMARY KEY ("key")
);

-- CreateTable
CREATE TABLE "job_runs" (
    "id" TEXT NOT NULL,
    "job" TEXT NOT NULL,
    "startedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "finishedAt" TIMESTAMP(3),
    "status" TEXT NOT NULL,
    "detail" JSONB,

    CONSTRAINT "job_runs_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "users_email_key" ON "users"("email");

-- CreateIndex
CREATE INDEX "users_status_idx" ON "users"("status");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_userId_key" ON "user_profiles"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "user_profiles_employeeNumber_key" ON "user_profiles"("employeeNumber");

-- CreateIndex
CREATE INDEX "user_profiles_departmentId_idx" ON "user_profiles"("departmentId");

-- CreateIndex
CREATE INDEX "user_profiles_jobRoleId_idx" ON "user_profiles"("jobRoleId");

-- CreateIndex
CREATE INDEX "user_profiles_businessUnitId_idx" ON "user_profiles"("businessUnitId");

-- CreateIndex
CREATE UNIQUE INDEX "roles_key_key" ON "roles"("key");

-- CreateIndex
CREATE UNIQUE INDEX "permissions_key_key" ON "permissions"("key");

-- CreateIndex
CREATE INDEX "user_roles_roleId_idx" ON "user_roles"("roleId");

-- CreateIndex
CREATE UNIQUE INDEX "business_units_code_key" ON "business_units"("code");

-- CreateIndex
CREATE UNIQUE INDEX "departments_code_key" ON "departments"("code");

-- CreateIndex
CREATE UNIQUE INDEX "job_roles_code_key" ON "job_roles"("code");

-- CreateIndex
CREATE UNIQUE INDEX "career_pathways_fromRoleId_toRoleId_key" ON "career_pathways"("fromRoleId", "toRoleId");

-- CreateIndex
CREATE INDEX "manager_relationships_employeeId_idx" ON "manager_relationships"("employeeId");

-- CreateIndex
CREATE UNIQUE INDEX "manager_relationships_managerId_employeeId_type_key" ON "manager_relationships"("managerId", "employeeId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "sessions_tokenHash_key" ON "sessions"("tokenHash");

-- CreateIndex
CREATE INDEX "sessions_userId_idx" ON "sessions"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "auth_tokens_tokenHash_key" ON "auth_tokens"("tokenHash");

-- CreateIndex
CREATE INDEX "auth_tokens_userId_type_idx" ON "auth_tokens"("userId", "type");

-- CreateIndex
CREATE UNIQUE INDEX "stored_files_storageKey_key" ON "stored_files"("storageKey");

-- CreateIndex
CREATE INDEX "stored_files_uploadedById_idx" ON "stored_files"("uploadedById");

-- CreateIndex
CREATE UNIQUE INDEX "course_categories_slug_key" ON "course_categories"("slug");

-- CreateIndex
CREATE UNIQUE INDEX "courses_code_key" ON "courses"("code");

-- CreateIndex
CREATE UNIQUE INDEX "courses_slug_key" ON "courses"("slug");

-- CreateIndex
CREATE INDEX "courses_status_categoryId_idx" ON "courses"("status", "categoryId");

-- CreateIndex
CREATE INDEX "courses_publishedAt_idx" ON "courses"("publishedAt");

-- CreateIndex
CREATE INDEX "course_instructors_userId_idx" ON "course_instructors"("userId");

-- CreateIndex
CREATE INDEX "course_competencies_competencyId_idx" ON "course_competencies"("competencyId");

-- CreateIndex
CREATE INDEX "course_modules_courseId_sortOrder_idx" ON "course_modules"("courseId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "lessons_assessmentId_key" ON "lessons"("assessmentId");

-- CreateIndex
CREATE INDEX "lessons_moduleId_sortOrder_idx" ON "lessons"("moduleId", "sortOrder");

-- CreateIndex
CREATE INDEX "lesson_resources_lessonId_idx" ON "lesson_resources"("lessonId");

-- CreateIndex
CREATE INDEX "assessments_courseId_idx" ON "assessments"("courseId");

-- CreateIndex
CREATE INDEX "assessment_questions_assessmentId_sortOrder_idx" ON "assessment_questions"("assessmentId", "sortOrder");

-- CreateIndex
CREATE INDEX "enrollments_userId_courseId_idx" ON "enrollments"("userId", "courseId");

-- CreateIndex
CREATE INDEX "enrollments_courseId_status_idx" ON "enrollments"("courseId", "status");

-- CreateIndex
CREATE INDEX "enrollments_userId_lastAccessedAt_idx" ON "enrollments"("userId", "lastAccessedAt");

-- CreateIndex
CREATE UNIQUE INDEX "enrollments_userId_courseId_cycle_key" ON "enrollments"("userId", "courseId", "cycle");

-- CreateIndex
CREATE INDEX "lesson_progress_lessonId_idx" ON "lesson_progress"("lessonId");

-- CreateIndex
CREATE UNIQUE INDEX "lesson_progress_enrollmentId_lessonId_key" ON "lesson_progress"("enrollmentId", "lessonId");

-- CreateIndex
CREATE INDEX "assessment_attempts_assessmentId_status_idx" ON "assessment_attempts"("assessmentId", "status");

-- CreateIndex
CREATE INDEX "assessment_attempts_userId_idx" ON "assessment_attempts"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_attempts_enrollmentId_assessmentId_attemptNumber_key" ON "assessment_attempts"("enrollmentId", "assessmentId", "attemptNumber");

-- CreateIndex
CREATE UNIQUE INDEX "assessment_responses_attemptId_questionId_key" ON "assessment_responses"("attemptId", "questionId");

-- CreateIndex
CREATE INDEX "assignment_submissions_lessonId_status_idx" ON "assignment_submissions"("lessonId", "status");

-- CreateIndex
CREATE INDEX "assignment_submissions_enrollmentId_idx" ON "assignment_submissions"("enrollmentId");

-- CreateIndex
CREATE UNIQUE INDEX "course_completions_enrollmentId_key" ON "course_completions"("enrollmentId");

-- CreateIndex
CREATE INDEX "course_completions_userId_completedAt_idx" ON "course_completions"("userId", "completedAt");

-- CreateIndex
CREATE INDEX "course_completions_courseId_idx" ON "course_completions"("courseId");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_serial_key" ON "certificates"("serial");

-- CreateIndex
CREATE UNIQUE INDEX "certificates_completionId_key" ON "certificates"("completionId");

-- CreateIndex
CREATE INDEX "certificates_userId_idx" ON "certificates"("userId");

-- CreateIndex
CREATE INDEX "certificates_expiresAt_idx" ON "certificates"("expiresAt");

-- CreateIndex
CREATE INDEX "credentials_userId_idx" ON "credentials"("userId");

-- CreateIndex
CREATE INDEX "learning_activity_events_userId_occurredAt_idx" ON "learning_activity_events"("userId", "occurredAt");

-- CreateIndex
CREATE INDEX "learning_activity_events_type_occurredAt_idx" ON "learning_activity_events"("type", "occurredAt");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_code_key" ON "learning_paths"("code");

-- CreateIndex
CREATE UNIQUE INDEX "learning_paths_slug_key" ON "learning_paths"("slug");

-- CreateIndex
CREATE INDEX "learning_path_items_pathId_sortOrder_idx" ON "learning_path_items"("pathId", "sortOrder");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_items_pathId_courseId_key" ON "learning_path_items"("pathId", "courseId");

-- CreateIndex
CREATE UNIQUE INDEX "learning_path_enrollments_pathId_userId_key" ON "learning_path_enrollments"("pathId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "webinars_code_key" ON "webinars"("code");

-- CreateIndex
CREATE UNIQUE INDEX "webinars_slug_key" ON "webinars"("slug");

-- CreateIndex
CREATE INDEX "webinars_startsAt_idx" ON "webinars"("startsAt");

-- CreateIndex
CREATE INDEX "webinars_status_idx" ON "webinars"("status");

-- CreateIndex
CREATE INDEX "webinar_registrations_userId_idx" ON "webinar_registrations"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "webinar_registrations_webinarId_userId_key" ON "webinar_registrations"("webinarId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "webinar_attendance_registrationId_key" ON "webinar_attendance"("registrationId");

-- CreateIndex
CREATE INDEX "webinar_attendance_webinarId_idx" ON "webinar_attendance"("webinarId");

-- CreateIndex
CREATE INDEX "webinar_attendance_userId_idx" ON "webinar_attendance"("userId");

-- CreateIndex
CREATE INDEX "webinar_recordings_webinarId_idx" ON "webinar_recordings"("webinarId");

-- CreateIndex
CREATE UNIQUE INDEX "webinar_feedback_webinarId_userId_key" ON "webinar_feedback"("webinarId", "userId");

-- CreateIndex
CREATE UNIQUE INDEX "reporting_periods_name_key" ON "reporting_periods"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cpd_policies_name_key" ON "cpd_policies"("name");

-- CreateIndex
CREATE UNIQUE INDEX "cpd_activities_courseCompletionId_key" ON "cpd_activities"("courseCompletionId");

-- CreateIndex
CREATE UNIQUE INDEX "cpd_activities_webinarAttendanceId_key" ON "cpd_activities"("webinarAttendanceId");

-- CreateIndex
CREATE INDEX "cpd_activities_userId_activityDate_idx" ON "cpd_activities"("userId", "activityDate");

-- CreateIndex
CREATE INDEX "cpd_claims_userId_status_idx" ON "cpd_claims"("userId", "status");

-- CreateIndex
CREATE INDEX "cpd_claims_status_idx" ON "cpd_claims"("status");

-- CreateIndex
CREATE INDEX "cpd_evidence_claimId_idx" ON "cpd_evidence"("claimId");

-- CreateIndex
CREATE INDEX "cpd_approvals_claimId_createdAt_idx" ON "cpd_approvals"("claimId", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "competency_frameworks_name_key" ON "competency_frameworks"("name");

-- CreateIndex
CREATE UNIQUE INDEX "proficiency_levels_frameworkId_level_key" ON "proficiency_levels"("frameworkId", "level");

-- CreateIndex
CREATE UNIQUE INDEX "competency_domains_frameworkId_name_key" ON "competency_domains"("frameworkId", "name");

-- CreateIndex
CREATE UNIQUE INDEX "competencies_code_key" ON "competencies"("code");

-- CreateIndex
CREATE INDEX "competencies_domainId_idx" ON "competencies"("domainId");

-- CreateIndex
CREATE UNIQUE INDEX "role_competency_requirements_jobRoleId_competencyId_key" ON "role_competency_requirements"("jobRoleId", "competencyId");

-- CreateIndex
CREATE INDEX "competency_assessments_userId_competencyId_status_idx" ON "competency_assessments"("userId", "competencyId", "status");

-- CreateIndex
CREATE INDEX "competency_assessments_reassessmentDue_idx" ON "competency_assessments"("reassessmentDue");

-- CreateIndex
CREATE INDEX "competency_evidence_assessmentId_idx" ON "competency_evidence"("assessmentId");

-- CreateIndex
CREATE INDEX "competency_assessment_history_assessmentId_idx" ON "competency_assessment_history"("assessmentId");

-- CreateIndex
CREATE UNIQUE INDEX "competency_review_requests_assessmentId_key" ON "competency_review_requests"("assessmentId");

-- CreateIndex
CREATE INDEX "competency_review_requests_userId_status_idx" ON "competency_review_requests"("userId", "status");

-- CreateIndex
CREATE INDEX "development_plans_userId_status_idx" ON "development_plans"("userId", "status");

-- CreateIndex
CREATE INDEX "development_objectives_planId_idx" ON "development_objectives"("planId");

-- CreateIndex
CREATE INDEX "development_actions_objectiveId_idx" ON "development_actions"("objectiveId");

-- CreateIndex
CREATE INDEX "development_reviews_planId_createdAt_idx" ON "development_reviews"("planId", "createdAt");

-- CreateIndex
CREATE INDEX "development_comments_planId_idx" ON "development_comments"("planId");

-- CreateIndex
CREATE INDEX "learning_assignments_userId_status_idx" ON "learning_assignments"("userId", "status");

-- CreateIndex
CREATE INDEX "learning_assignments_status_dueDate_idx" ON "learning_assignments"("status", "dueDate");

-- CreateIndex
CREATE INDEX "learning_assignments_courseId_idx" ON "learning_assignments"("courseId");

-- CreateIndex
CREATE INDEX "notifications_userId_readAt_idx" ON "notifications"("userId", "readAt");

-- CreateIndex
CREATE UNIQUE INDEX "notifications_userId_dedupeKey_key" ON "notifications"("userId", "dedupeKey");

-- CreateIndex
CREATE INDEX "email_outbox_status_idx" ON "email_outbox"("status");

-- CreateIndex
CREATE INDEX "reports_generatedById_idx" ON "reports"("generatedById");

-- CreateIndex
CREATE INDEX "audit_logs_entityType_entityId_idx" ON "audit_logs"("entityType", "entityId");

-- CreateIndex
CREATE INDEX "audit_logs_actorId_createdAt_idx" ON "audit_logs"("actorId", "createdAt");

-- CreateIndex
CREATE INDEX "audit_logs_createdAt_idx" ON "audit_logs"("createdAt");

-- CreateIndex
CREATE INDEX "job_runs_job_startedAt_idx" ON "job_runs"("job", "startedAt");

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_targetJobRoleId_fkey" FOREIGN KEY ("targetJobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_profiles" ADD CONSTRAINT "user_profiles_cpdPolicyId_fkey" FOREIGN KEY ("cpdPolicyId") REFERENCES "cpd_policies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_permissions" ADD CONSTRAINT "role_permissions_permissionId_fkey" FOREIGN KEY ("permissionId") REFERENCES "permissions"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "user_roles" ADD CONSTRAINT "user_roles_roleId_fkey" FOREIGN KEY ("roleId") REFERENCES "roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "departments" ADD CONSTRAINT "departments_businessUnitId_fkey" FOREIGN KEY ("businessUnitId") REFERENCES "business_units"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "job_roles" ADD CONSTRAINT "job_roles_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_pathways" ADD CONSTRAINT "career_pathways_fromRoleId_fkey" FOREIGN KEY ("fromRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "career_pathways" ADD CONSTRAINT "career_pathways_toRoleId_fkey" FOREIGN KEY ("toRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_managerId_fkey" FOREIGN KEY ("managerId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "manager_relationships" ADD CONSTRAINT "manager_relationships_employeeId_fkey" FOREIGN KEY ("employeeId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "sessions" ADD CONSTRAINT "sessions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "auth_tokens" ADD CONSTRAINT "auth_tokens_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "stored_files" ADD CONSTRAINT "stored_files_uploadedById_fkey" FOREIGN KEY ("uploadedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "course_categories"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "courses" ADD CONSTRAINT "courses_createdById_fkey" FOREIGN KEY ("createdById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_departments" ADD CONSTRAINT "course_departments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_departments" ADD CONSTRAINT "course_departments_departmentId_fkey" FOREIGN KEY ("departmentId") REFERENCES "departments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_instructors" ADD CONSTRAINT "course_instructors_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_prerequisites" ADD CONSTRAINT "course_prerequisites_prerequisiteId_fkey" FOREIGN KEY ("prerequisiteId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_competencies" ADD CONSTRAINT "course_competencies_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_competencies" ADD CONSTRAINT "course_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_modules" ADD CONSTRAINT "course_modules_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_moduleId_fkey" FOREIGN KEY ("moduleId") REFERENCES "course_modules"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lessons" ADD CONSTRAINT "lessons_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_resources" ADD CONSTRAINT "lesson_resources_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessments" ADD CONSTRAINT "assessments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_questions" ADD CONSTRAINT "assessment_questions_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "enrollments" ADD CONSTRAINT "enrollments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "lesson_progress" ADD CONSTRAINT "lesson_progress_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "assessments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_attempts" ADD CONSTRAINT "assessment_attempts_gradedById_fkey" FOREIGN KEY ("gradedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_attemptId_fkey" FOREIGN KEY ("attemptId") REFERENCES "assessment_attempts"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assessment_responses" ADD CONSTRAINT "assessment_responses_questionId_fkey" FOREIGN KEY ("questionId") REFERENCES "assessment_questions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_lessonId_fkey" FOREIGN KEY ("lessonId") REFERENCES "lessons"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "assignment_submissions" ADD CONSTRAINT "assignment_submissions_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_enrollmentId_fkey" FOREIGN KEY ("enrollmentId") REFERENCES "enrollments"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_completions" ADD CONSTRAINT "course_completions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_completionId_fkey" FOREIGN KEY ("completionId") REFERENCES "course_completions"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "certificates" ADD CONSTRAINT "certificates_templateId_fkey" FOREIGN KEY ("templateId") REFERENCES "certificate_templates"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_verifiedById_fkey" FOREIGN KEY ("verifiedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "credentials" ADD CONSTRAINT "credentials_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_activity_events" ADD CONSTRAINT "learning_activity_events_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_paths" ADD CONSTRAINT "learning_paths_targetJobRoleId_fkey" FOREIGN KEY ("targetJobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_items" ADD CONSTRAINT "learning_path_items_prerequisiteItemId_fkey" FOREIGN KEY ("prerequisiteItemId") REFERENCES "learning_path_items"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_competencies" ADD CONSTRAINT "learning_path_competencies_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_competencies" ADD CONSTRAINT "learning_path_competencies_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_enrollments" ADD CONSTRAINT "learning_path_enrollments_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_path_enrollments" ADD CONSTRAINT "learning_path_enrollments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinars" ADD CONSTRAINT "webinars_categoryId_fkey" FOREIGN KEY ("categoryId") REFERENCES "course_categories"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_registrations" ADD CONSTRAINT "webinar_registrations_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_attendance" ADD CONSTRAINT "webinar_attendance_registrationId_fkey" FOREIGN KEY ("registrationId") REFERENCES "webinar_registrations"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_attendance" ADD CONSTRAINT "webinar_attendance_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_attendance" ADD CONSTRAINT "webinar_attendance_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_attendance" ADD CONSTRAINT "webinar_attendance_recordedById_fkey" FOREIGN KEY ("recordedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_recordings" ADD CONSTRAINT "webinar_recordings_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_feedback" ADD CONSTRAINT "webinar_feedback_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinars"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "webinar_feedback" ADD CONSTRAINT "webinar_feedback_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_webinarAttendanceId_fkey" FOREIGN KEY ("webinarAttendanceId") REFERENCES "webinar_attendance"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_activities" ADD CONSTRAINT "cpd_activities_courseCompletionId_fkey" FOREIGN KEY ("courseCompletionId") REFERENCES "course_completions"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_claims" ADD CONSTRAINT "cpd_claims_activityId_fkey" FOREIGN KEY ("activityId") REFERENCES "cpd_activities"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_claims" ADD CONSTRAINT "cpd_claims_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_claims" ADD CONSTRAINT "cpd_claims_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_evidence" ADD CONSTRAINT "cpd_evidence_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "cpd_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_evidence" ADD CONSTRAINT "cpd_evidence_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_approvals" ADD CONSTRAINT "cpd_approvals_claimId_fkey" FOREIGN KEY ("claimId") REFERENCES "cpd_claims"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "cpd_approvals" ADD CONSTRAINT "cpd_approvals_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "proficiency_levels" ADD CONSTRAINT "proficiency_levels_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "competency_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_domains" ADD CONSTRAINT "competency_domains_frameworkId_fkey" FOREIGN KEY ("frameworkId") REFERENCES "competency_frameworks"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competencies" ADD CONSTRAINT "competencies_domainId_fkey" FOREIGN KEY ("domainId") REFERENCES "competency_domains"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_competency_requirements" ADD CONSTRAINT "role_competency_requirements_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "role_competency_requirements" ADD CONSTRAINT "role_competency_requirements_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessments" ADD CONSTRAINT "competency_assessments_assessorId_fkey" FOREIGN KEY ("assessorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidence" ADD CONSTRAINT "competency_evidence_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "competency_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_evidence" ADD CONSTRAINT "competency_evidence_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_assessment_history" ADD CONSTRAINT "competency_assessment_history_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "competency_assessments"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_review_requests" ADD CONSTRAINT "competency_review_requests_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_review_requests" ADD CONSTRAINT "competency_review_requests_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_review_requests" ADD CONSTRAINT "competency_review_requests_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_review_requests" ADD CONSTRAINT "competency_review_requests_fileId_fkey" FOREIGN KEY ("fileId") REFERENCES "stored_files"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "competency_review_requests" ADD CONSTRAINT "competency_review_requests_assessmentId_fkey" FOREIGN KEY ("assessmentId") REFERENCES "competency_assessments"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_reviewerId_fkey" FOREIGN KEY ("reviewerId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_periodId_fkey" FOREIGN KEY ("periodId") REFERENCES "reporting_periods"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_plans" ADD CONSTRAINT "development_plans_targetJobRoleId_fkey" FOREIGN KEY ("targetJobRoleId") REFERENCES "job_roles"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_objectives" ADD CONSTRAINT "development_objectives_planId_fkey" FOREIGN KEY ("planId") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_objectives" ADD CONSTRAINT "development_objectives_competencyId_fkey" FOREIGN KEY ("competencyId") REFERENCES "competencies"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_actions" ADD CONSTRAINT "development_actions_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "development_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_actions" ADD CONSTRAINT "development_actions_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_actions" ADD CONSTRAINT "development_actions_webinarId_fkey" FOREIGN KEY ("webinarId") REFERENCES "webinars"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_reviews" ADD CONSTRAINT "development_reviews_planId_fkey" FOREIGN KEY ("planId") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_reviews" ADD CONSTRAINT "development_reviews_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_comments" ADD CONSTRAINT "development_comments_planId_fkey" FOREIGN KEY ("planId") REFERENCES "development_plans"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_comments" ADD CONSTRAINT "development_comments_objectiveId_fkey" FOREIGN KEY ("objectiveId") REFERENCES "development_objectives"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "development_comments" ADD CONSTRAINT "development_comments_authorId_fkey" FOREIGN KEY ("authorId") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_pathId_fkey" FOREIGN KEY ("pathId") REFERENCES "learning_paths"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "learning_assignments" ADD CONSTRAINT "learning_assignments_assignedById_fkey" FOREIGN KEY ("assignedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notifications" ADD CONSTRAINT "notifications_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "notification_preferences" ADD CONSTRAINT "notification_preferences_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "reports" ADD CONSTRAINT "reports_generatedById_fkey" FOREIGN KEY ("generatedById") REFERENCES "users"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "audit_logs" ADD CONSTRAINT "audit_logs_actorId_fkey" FOREIGN KEY ("actorId") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;
