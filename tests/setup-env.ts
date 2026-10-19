// Integration tests run against an isolated database, never the development or production database.
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL ?? "postgresql://apex:apex_dev@localhost:5432/apex_lms_test?schema=public";
process.env.STORAGE_LOCAL_DIR = process.env.TEST_STORAGE_DIR ?? "./storage-test";
process.env.EMAIL_PROVIDER = "outbox";
(process.env as Record<string, string>).NODE_ENV = "test";
