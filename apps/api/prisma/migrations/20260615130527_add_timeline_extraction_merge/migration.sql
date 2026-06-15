-- AlterEnum
-- This migration adds more than one value to an enum.
-- With PostgreSQL versions 11 and earlier, this is not possible
-- in a single migration. This can be worked around by creating
-- multiple migrations, each migration adding only one value to
-- the enum.


ALTER TYPE "ExtractedFactType" ADD VALUE 'TIMELINE_EVENT';
ALTER TYPE "ExtractedFactType" ADD VALUE 'TIMELINE_MARKER';
ALTER TYPE "ExtractedFactType" ADD VALUE 'TIMELINE_CHARACTER_PERIOD';
ALTER TYPE "ExtractedFactType" ADD VALUE 'TIMELINE_CANDIDATE';

-- AlterTable
ALTER TABLE "TimelineEvent" ADD COLUMN     "absoluteDate" TIMESTAMP(3),
ADD COLUMN     "chapterIndex" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "confidence" DOUBLE PRECISION NOT NULL DEFAULT 0,
ADD COLUMN     "involvedCharacterIds" TEXT[],
ADD COLUMN     "involvedLocationIds" TEXT[],
ADD COLUMN     "relativeMarkers" JSONB,
ADD COLUMN     "relativeOrder" INTEGER NOT NULL DEFAULT 0,
ADD COLUMN     "sourceChunkIds" TEXT[];

-- CreateTable
CREATE TABLE "TimelineEventCharacterVersion" (
    "id" UUID NOT NULL,
    "timelineEventId" UUID NOT NULL,
    "characterVersionId" UUID NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "TimelineEventCharacterVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "TimelineEventCharacterVersion_timelineEventId_idx" ON "TimelineEventCharacterVersion"("timelineEventId");

-- CreateIndex
CREATE INDEX "TimelineEventCharacterVersion_characterVersionId_idx" ON "TimelineEventCharacterVersion"("characterVersionId");

-- CreateIndex
CREATE UNIQUE INDEX "TimelineEventCharacterVersion_timelineEventId_characterVers_key" ON "TimelineEventCharacterVersion"("timelineEventId", "characterVersionId");

-- CreateIndex
CREATE INDEX "TimelineEvent_chapterIndex_idx" ON "TimelineEvent"("chapterIndex");

-- CreateIndex
CREATE INDEX "TimelineEvent_relativeOrder_idx" ON "TimelineEvent"("relativeOrder");

-- AddForeignKey
ALTER TABLE "TimelineEventCharacterVersion" ADD CONSTRAINT "TimelineEventCharacterVersion_timelineEventId_fkey" FOREIGN KEY ("timelineEventId") REFERENCES "TimelineEvent"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEventCharacterVersion" ADD CONSTRAINT "TimelineEventCharacterVersion_characterVersionId_fkey" FOREIGN KEY ("characterVersionId") REFERENCES "CharacterVersion"("id") ON DELETE CASCADE ON UPDATE CASCADE;
