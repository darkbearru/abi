CREATE TYPE "EntityConflictType" AS ENUM (
  'CHARACTER_POSSIBLE_DUPLICATE',
  'CHARACTER_ATTRIBUTE_CONFLICT'
);

CREATE TYPE "EntityConflictStatus" AS ENUM (
  'OPEN',
  'RESOLVED',
  'IGNORED'
);

ALTER TABLE "CharacterVersion"
  ADD COLUMN "confidenceScore" DOUBLE PRECISION NOT NULL DEFAULT 0,
  ADD COLUMN "sourceFactIds" TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[];

ALTER TABLE "CharacterVersion" ALTER COLUMN "sourceFactIds" DROP DEFAULT;

CREATE TABLE "EntityConflict" (
  "id" UUID NOT NULL,
  "worldBibleId" UUID NOT NULL,
  "characterId" UUID,
  "type" "EntityConflictType" NOT NULL,
  "status" "EntityConflictStatus" NOT NULL DEFAULT 'OPEN',
  "summary" TEXT NOT NULL,
  "options" JSONB NOT NULL,
  "sourceFactIds" TEXT[] NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,

  CONSTRAINT "EntityConflict_pkey" PRIMARY KEY ("id")
);

CREATE INDEX "EntityConflict_worldBibleId_idx" ON "EntityConflict"("worldBibleId");
CREATE INDEX "EntityConflict_characterId_idx" ON "EntityConflict"("characterId");
CREATE INDEX "EntityConflict_type_idx" ON "EntityConflict"("type");
CREATE INDEX "EntityConflict_status_idx" ON "EntityConflict"("status");

ALTER TABLE "EntityConflict" ADD CONSTRAINT "EntityConflict_worldBibleId_fkey" FOREIGN KEY ("worldBibleId") REFERENCES "WorldBible"("id") ON DELETE CASCADE ON UPDATE CASCADE;
ALTER TABLE "EntityConflict" ADD CONSTRAINT "EntityConflict_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;
