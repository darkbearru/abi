-- CreateTable
CREATE TABLE "BookSeries" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "userId" UUID,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookSeries_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookSeriesBook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "seriesId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookSeriesBook_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBookProjectBook" (
    "id" UUID NOT NULL DEFAULT gen_random_uuid(),
    "projectId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "bookAnalysisId" UUID,
    "orderIndex" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "UserBookProjectBook_pkey" PRIMARY KEY ("id")
);

-- AlterTable
ALTER TABLE "UserBookProject" ADD COLUMN "seriesId" UUID;

-- AlterTable
ALTER TABLE "WorldBible" ADD COLUMN "seriesId" UUID;
ALTER TABLE "WorldBible" ALTER COLUMN "bookAnalysisId" DROP NOT NULL;

-- CreateIndex
CREATE INDEX "BookSeries_userId_idx" ON "BookSeries"("userId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSeriesBook_seriesId_bookId_key" ON "BookSeriesBook"("seriesId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "BookSeriesBook_seriesId_orderIndex_key" ON "BookSeriesBook"("seriesId", "orderIndex");

-- CreateIndex
CREATE INDEX "BookSeriesBook_bookId_idx" ON "BookSeriesBook"("bookId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBookProjectBook_projectId_bookId_key" ON "UserBookProjectBook"("projectId", "bookId");

-- CreateIndex
CREATE UNIQUE INDEX "UserBookProjectBook_projectId_orderIndex_key" ON "UserBookProjectBook"("projectId", "orderIndex");

-- CreateIndex
CREATE INDEX "UserBookProjectBook_bookId_idx" ON "UserBookProjectBook"("bookId");

-- CreateIndex
CREATE INDEX "UserBookProjectBook_bookAnalysisId_idx" ON "UserBookProjectBook"("bookAnalysisId");

-- CreateIndex
CREATE INDEX "UserBookProject_seriesId_idx" ON "UserBookProject"("seriesId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldBible_seriesId_key" ON "WorldBible"("seriesId");

-- CreateIndex
CREATE INDEX "WorldBible_seriesId_idx" ON "WorldBible"("seriesId");

-- AddForeignKey
ALTER TABLE "BookSeries" ADD CONSTRAINT "BookSeries_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSeriesBook" ADD CONSTRAINT "BookSeriesBook_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookSeriesBook" ADD CONSTRAINT "BookSeriesBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProject" ADD CONSTRAINT "UserBookProject_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookSeries"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProjectBook" ADD CONSTRAINT "UserBookProjectBook_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "UserBookProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProjectBook" ADD CONSTRAINT "UserBookProjectBook_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProjectBook" ADD CONSTRAINT "UserBookProjectBook_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldBible" ADD CONSTRAINT "WorldBible_seriesId_fkey" FOREIGN KEY ("seriesId") REFERENCES "BookSeries"("id") ON DELETE CASCADE ON UPDATE CASCADE;
