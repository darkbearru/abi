UPDATE "GenerationJob" AS job
SET "userId" = project."userId"
FROM "UserBookProject" AS project
WHERE job."userId" IS NULL
  AND job."projectId" = project."id";

UPDATE "GenerationJob" AS job
SET "userId" = project."userId"
FROM "UserBookProject" AS project
WHERE job."userId" IS NULL
  AND job."bookAnalysisId" = project."bookAnalysisId";

DELETE FROM "GenerationJob"
WHERE "userId" IS NULL;

ALTER TABLE "GenerationJob" DROP CONSTRAINT IF EXISTS "GenerationJob_userId_fkey";

ALTER TABLE "GenerationJob"
ALTER COLUMN "userId" SET NOT NULL;

ALTER TABLE "GenerationJob"
ADD CONSTRAINT "GenerationJob_userId_fkey"
FOREIGN KEY ("userId") REFERENCES "User"("id")
ON DELETE CASCADE ON UPDATE CASCADE;
