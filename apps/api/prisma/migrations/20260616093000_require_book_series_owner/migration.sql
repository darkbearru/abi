-- Book series are user-scoped. Rows without an owner cannot be safely exposed after auth.
DELETE FROM "BookSeries" WHERE "userId" IS NULL;

ALTER TABLE "BookSeries" DROP CONSTRAINT "BookSeries_userId_fkey";
ALTER TABLE "BookSeries" ALTER COLUMN "userId" SET NOT NULL;
ALTER TABLE "BookSeries" ADD CONSTRAINT "BookSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;
