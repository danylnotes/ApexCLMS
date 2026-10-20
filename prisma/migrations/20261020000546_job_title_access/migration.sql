-- CreateTable
CREATE TABLE "content_access_grants" (
    "id" TEXT NOT NULL,
    "userId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,
    "grantedById" TEXT,
    "reason" TEXT,
    "grantedAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "content_access_grants_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "course_audiences" (
    "courseId" TEXT NOT NULL,
    "jobRoleId" TEXT NOT NULL,

    CONSTRAINT "course_audiences_pkey" PRIMARY KEY ("courseId","jobRoleId")
);

-- CreateIndex
CREATE UNIQUE INDEX "content_access_grants_userId_jobRoleId_key" ON "content_access_grants"("userId", "jobRoleId");

-- CreateIndex
CREATE INDEX "course_audiences_jobRoleId_idx" ON "course_audiences"("jobRoleId");

-- AddForeignKey
ALTER TABLE "content_access_grants" ADD CONSTRAINT "content_access_grants_userId_fkey" FOREIGN KEY ("userId") REFERENCES "users"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_access_grants" ADD CONSTRAINT "content_access_grants_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "content_access_grants" ADD CONSTRAINT "content_access_grants_grantedById_fkey" FOREIGN KEY ("grantedById") REFERENCES "users"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_audiences" ADD CONSTRAINT "course_audiences_courseId_fkey" FOREIGN KEY ("courseId") REFERENCES "courses"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "course_audiences" ADD CONSTRAINT "course_audiences_jobRoleId_fkey" FOREIGN KEY ("jobRoleId") REFERENCES "job_roles"("id") ON DELETE CASCADE ON UPDATE CASCADE;
