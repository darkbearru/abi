CREATE TYPE "ExtractedFactType" AS ENUM (
  'CHARACTER_MENTION',
  'CHARACTER_ALIAS',
  'CHARACTER_APPEARANCE',
  'CHARACTER_AGE',
  'CHARACTER_PERSONALITY',
  'CHARACTER_SPEECH_MANNER',
  'CHARACTER_RELATIONSHIP',
  'CHARACTER_PLOT_CHANGE',
  'CHARACTER_CANDIDATE'
);

CREATE TABLE "ExtractedFact" (
  "id" UUID NOT NULL,
  "bookId" UUID NOT NULL,
  "bookAnalysisId" UUID NOT NULL,
  "type" "ExtractedFactType" NOT NULL,
  "entityName" TEXT NOT NULL,
  "value" JSONB NOT NULL,
  "sourceChunkId" UUID NOT NULL,
  "confidence" DOUBLE PRECISION NOT NULL,
  "quote" TEXT,
  "chapterIndex" INTEGER NOT NULL,
  "timelineHint" TEXT,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

  CONSTRAINT "ExtractedFact_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "ExtractedFact_bookId_idx" ON "ExtractedFact"("bookId");
CREATE INDEX "ExtractedFact_bookAnalysisId_idx" ON "ExtractedFact"("bookAnalysisId");
CREATE INDEX "ExtractedFact_sourceChunkId_idx" ON "ExtractedFact"("sourceChunkId");
CREATE INDEX "ExtractedFact_type_idx" ON "ExtractedFact"("type");
CREATE INDEX "ExtractedFact_entityName_idx" ON "ExtractedFact"("entityName");

ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "ExtractedFact" ADD CONSTRAINT "ExtractedFact_sourceChunkId_fkey" FOREIGN KEY ("sourceChunkId") REFERENCES "BookChunk"("id") ON DELETE CASCADE ON UPDATE CASCADE;
