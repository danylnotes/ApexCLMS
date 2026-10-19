import { runScheduledJobs } from "../src/server/services/jobs";
import { prisma } from "../src/server/db";

runScheduledJobs()
  .then((r) => console.log("Scheduled jobs complete", r))
  .catch((e) => {
    console.error(e);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
