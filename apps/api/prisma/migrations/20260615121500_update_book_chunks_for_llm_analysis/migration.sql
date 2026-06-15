DROP INDEX IF EXISTS "BookChunk_bookId_index_key";

ALTER TABLE "BookChunk" RENAME COLUMN "index" TO "orderIndex";
ALTER TABLE "BookChunk" RENAME COLUMN "content" TO "text";
ALTER TABLE "BookChunk" RENAME COLUMN "tokenCount" TO "tokenEstimate";

ALTER TABLE "BookChunk" ADD COLUMN "chapterIndex" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookChunk" ADD COLUMN "startOffset" INTEGER NOT NULL DEFAULT 0;
ALTER TABLE "BookChunk" ADD COLUMN "endOffset" INTEGER NOT NULL DEFAULT 0;

UPDATE "BookChunk"
SET
  "endOffset" = LENGTH("text"),
  "tokenEstimate" = COALESCE("tokenEstimate", GREATEST(1, CEIL(LENGTH("text")::numeric / 4)::integer));

ALTER TABLE "BookChunk" ALTER COLUMN "tokenEstimate" SET NOT NULL;
ALTER TABLE "BookChunk" DROP COLUMN "chapter";

ALTER TABLE "BookChunk" ALTER COLUMN "chapterIndex" DROP DEFAULT;
ALTER TABLE "BookChunk" ALTER COLUMN "startOffset" DROP DEFAULT;
ALTER TABLE "BookChunk" ALTER COLUMN "endOffset" DROP DEFAULT;

CREATE UNIQUE INDEX "BookChunk_bookId_orderIndex_key" ON "BookChunk"("bookId", "orderIndex");
CREATE INDEX "BookChunk_bookId_chapterIndex_idx" ON "BookChunk"("bookId", "chapterIndex");
