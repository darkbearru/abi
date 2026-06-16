ALTER TABLE "UserBookProject" ADD COLUMN "visualStyleId" UUID;

CREATE INDEX "UserBookProject_visualStyleId_idx" ON "UserBookProject"("visualStyleId");

ALTER TABLE "UserBookProject"
  ADD CONSTRAINT "UserBookProject_visualStyleId_fkey"
  FOREIGN KEY ("visualStyleId") REFERENCES "VisualStyle"("id")
  ON DELETE SET NULL ON UPDATE CASCADE;
