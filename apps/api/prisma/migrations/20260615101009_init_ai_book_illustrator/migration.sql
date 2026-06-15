-- CreateEnum
CREATE TYPE "BookFileKind" AS ENUM ('ORIGINAL', 'EXTRACTED_TEXT', 'DERIVED');

-- CreateEnum
CREATE TYPE "AnalysisStatus" AS ENUM ('PENDING', 'PROCESSING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "RelationshipType" AS ENUM ('ALLY', 'ENEMY', 'FAMILY', 'ROMANTIC', 'MENTOR', 'RIVAL', 'SERVES', 'KNOWS', 'OTHER');

-- CreateEnum
CREATE TYPE "SceneStatus" AS ENUM ('DRAFT', 'READY', 'GENERATING', 'COMPLETED', 'FAILED');

-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('SOURCE', 'REFERENCE', 'GENERATED', 'THUMBNAIL');

-- CreateEnum
CREATE TYPE "AssetEntityType" AS ENUM ('BOOK', 'WORLD_BIBLE', 'CHARACTER', 'LOCATION', 'WORLD_OBJECT', 'TIMELINE_EVENT', 'SCENE', 'VISUAL_STYLE', 'GENERATION_JOB');

-- CreateEnum
CREATE TYPE "GenerationJobStatus" AS ENUM ('QUEUED', 'PROCESSING', 'COMPLETED', 'FAILED', 'CANCELLED');

-- CreateEnum
CREATE TYPE "AiProviderLogStatus" AS ENUM ('SUCCESS', 'ERROR');

-- CreateTable
CREATE TABLE "User" (
    "id" UUID NOT NULL,
    "email" TEXT NOT NULL,
    "name" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "User_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Book" (
    "id" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "author" TEXT,
    "language" TEXT,
    "fileHash" TEXT NOT NULL,
    "contentHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Book_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookFile" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "kind" "BookFileKind" NOT NULL DEFAULT 'ORIGINAL',
    "localPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "sizeBytes" BIGINT,
    "fileHash" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookFile_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookAnalysis" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "status" "AnalysisStatus" NOT NULL DEFAULT 'PENDING',
    "contentHash" TEXT NOT NULL,
    "model" TEXT,
    "provider" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "BookAnalysis_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "UserBookProject" (
    "id" UUID NOT NULL,
    "userId" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "bookAnalysisId" UUID,
    "name" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "UserBookProject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "BookChunk" (
    "id" UUID NOT NULL,
    "bookId" UUID NOT NULL,
    "bookAnalysisId" UUID,
    "index" INTEGER NOT NULL,
    "chapter" TEXT,
    "content" TEXT NOT NULL,
    "tokenCount" INTEGER,
    "embeddingId" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "BookChunk_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldBible" (
    "id" UUID NOT NULL,
    "bookAnalysisId" UUID NOT NULL,
    "projectId" UUID,
    "summary" TEXT,
    "rules" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldBible_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Character" (
    "id" UUID NOT NULL,
    "worldBibleId" UUID NOT NULL,
    "canonicalName" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Character_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterAlias" (
    "id" UUID NOT NULL,
    "characterId" UUID NOT NULL,
    "alias" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterAlias_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterVersion" (
    "id" UUID NOT NULL,
    "characterId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "age" TEXT,
    "timelineRange" JSONB,
    "appearance" JSONB NOT NULL,
    "personality" JSONB,
    "speechManner" TEXT,
    "clothing" JSONB,
    "visualPrompt" TEXT,
    "negativePrompt" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "CharacterVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "CharacterRelationship" (
    "id" UUID NOT NULL,
    "sourceCharacterId" UUID NOT NULL,
    "targetCharacterId" UUID NOT NULL,
    "type" "RelationshipType" NOT NULL,
    "description" TEXT,
    "timelineRange" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "CharacterRelationship_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Location" (
    "id" UUID NOT NULL,
    "worldBibleId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "parentId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Location_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LocationVersion" (
    "id" UUID NOT NULL,
    "locationId" UUID NOT NULL,
    "version" INTEGER NOT NULL,
    "description" TEXT NOT NULL,
    "palette" JSONB,
    "lightingRules" JSONB,
    "architectureRules" JSONB,
    "referenceAssetIds" TEXT[],
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "LocationVersion_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "WorldObject" (
    "id" UUID NOT NULL,
    "worldBibleId" UUID NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "visualPrompt" TEXT,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "WorldObject_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "TimelineEvent" (
    "id" UUID NOT NULL,
    "worldBibleId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "orderIndex" INTEGER NOT NULL,
    "timelineRange" JSONB,
    "characterId" UUID,
    "locationId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "TimelineEvent_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Scene" (
    "id" UUID NOT NULL,
    "projectId" UUID NOT NULL,
    "title" TEXT NOT NULL,
    "description" TEXT,
    "status" "SceneStatus" NOT NULL DEFAULT 'DRAFT',
    "orderIndex" INTEGER NOT NULL,
    "prompt" TEXT,
    "characterId" UUID,
    "locationId" UUID,
    "visualStyleId" UUID,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Scene_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "VisualStyle" (
    "id" UUID NOT NULL,
    "slug" TEXT NOT NULL,
    "name" TEXT NOT NULL,
    "description" TEXT,
    "prompt" TEXT NOT NULL,
    "negativePrompt" TEXT,
    "isDefault" BOOLEAN NOT NULL DEFAULT false,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "VisualStyle_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "Asset" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "sceneId" UUID,
    "jobId" UUID,
    "type" "AssetType" NOT NULL DEFAULT 'GENERATED',
    "localPath" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER,
    "height" INTEGER,
    "prompt" TEXT,
    "seed" INTEGER,
    "model" TEXT,
    "provider" TEXT,
    "entityType" "AssetEntityType",
    "entityId" UUID,
    "metadata" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GenerationJob" (
    "id" UUID NOT NULL,
    "projectId" UUID,
    "userId" UUID,
    "sceneId" UUID,
    "bookAnalysisId" UUID,
    "visualStyleId" UUID,
    "status" "GenerationJobStatus" NOT NULL DEFAULT 'QUEUED',
    "progress" INTEGER NOT NULL DEFAULT 0,
    "input" JSONB NOT NULL,
    "output" JSONB,
    "error" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "GenerationJob_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "AiProviderLog" (
    "id" UUID NOT NULL,
    "userId" UUID,
    "bookAnalysisId" UUID,
    "generationJobId" UUID,
    "provider" TEXT NOT NULL,
    "model" TEXT,
    "status" "AiProviderLogStatus" NOT NULL,
    "request" JSONB,
    "response" JSONB,
    "error" JSONB,
    "latencyMs" INTEGER,
    "tokenUsage" JSONB,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "AiProviderLog_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "User_email_key" ON "User"("email");

-- CreateIndex
CREATE INDEX "Book_fileHash_idx" ON "Book"("fileHash");

-- CreateIndex
CREATE INDEX "Book_contentHash_idx" ON "Book"("contentHash");

-- CreateIndex
CREATE INDEX "Book_fileHash_contentHash_idx" ON "Book"("fileHash", "contentHash");

-- CreateIndex
CREATE INDEX "BookFile_bookId_idx" ON "BookFile"("bookId");

-- CreateIndex
CREATE INDEX "BookFile_fileHash_idx" ON "BookFile"("fileHash");

-- CreateIndex
CREATE INDEX "BookAnalysis_bookId_idx" ON "BookAnalysis"("bookId");

-- CreateIndex
CREATE INDEX "BookAnalysis_contentHash_idx" ON "BookAnalysis"("contentHash");

-- CreateIndex
CREATE INDEX "UserBookProject_userId_idx" ON "UserBookProject"("userId");

-- CreateIndex
CREATE INDEX "UserBookProject_bookId_idx" ON "UserBookProject"("bookId");

-- CreateIndex
CREATE INDEX "UserBookProject_bookAnalysisId_idx" ON "UserBookProject"("bookAnalysisId");

-- CreateIndex
CREATE INDEX "BookChunk_bookId_idx" ON "BookChunk"("bookId");

-- CreateIndex
CREATE INDEX "BookChunk_bookAnalysisId_idx" ON "BookChunk"("bookAnalysisId");

-- CreateIndex
CREATE UNIQUE INDEX "BookChunk_bookId_index_key" ON "BookChunk"("bookId", "index");

-- CreateIndex
CREATE UNIQUE INDEX "WorldBible_bookAnalysisId_key" ON "WorldBible"("bookAnalysisId");

-- CreateIndex
CREATE UNIQUE INDEX "WorldBible_projectId_key" ON "WorldBible"("projectId");

-- CreateIndex
CREATE INDEX "WorldBible_bookAnalysisId_idx" ON "WorldBible"("bookAnalysisId");

-- CreateIndex
CREATE INDEX "WorldBible_projectId_idx" ON "WorldBible"("projectId");

-- CreateIndex
CREATE INDEX "Character_worldBibleId_idx" ON "Character"("worldBibleId");

-- CreateIndex
CREATE INDEX "CharacterAlias_characterId_idx" ON "CharacterAlias"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterAlias_characterId_alias_key" ON "CharacterAlias"("characterId", "alias");

-- CreateIndex
CREATE INDEX "CharacterVersion_characterId_idx" ON "CharacterVersion"("characterId");

-- CreateIndex
CREATE UNIQUE INDEX "CharacterVersion_characterId_version_key" ON "CharacterVersion"("characterId", "version");

-- CreateIndex
CREATE INDEX "CharacterRelationship_sourceCharacterId_idx" ON "CharacterRelationship"("sourceCharacterId");

-- CreateIndex
CREATE INDEX "CharacterRelationship_targetCharacterId_idx" ON "CharacterRelationship"("targetCharacterId");

-- CreateIndex
CREATE INDEX "Location_worldBibleId_idx" ON "Location"("worldBibleId");

-- CreateIndex
CREATE INDEX "Location_parentId_idx" ON "Location"("parentId");

-- CreateIndex
CREATE INDEX "LocationVersion_locationId_idx" ON "LocationVersion"("locationId");

-- CreateIndex
CREATE UNIQUE INDEX "LocationVersion_locationId_version_key" ON "LocationVersion"("locationId", "version");

-- CreateIndex
CREATE INDEX "WorldObject_worldBibleId_idx" ON "WorldObject"("worldBibleId");

-- CreateIndex
CREATE INDEX "TimelineEvent_worldBibleId_idx" ON "TimelineEvent"("worldBibleId");

-- CreateIndex
CREATE INDEX "TimelineEvent_characterId_idx" ON "TimelineEvent"("characterId");

-- CreateIndex
CREATE INDEX "TimelineEvent_locationId_idx" ON "TimelineEvent"("locationId");

-- CreateIndex
CREATE INDEX "Scene_projectId_idx" ON "Scene"("projectId");

-- CreateIndex
CREATE INDEX "Scene_characterId_idx" ON "Scene"("characterId");

-- CreateIndex
CREATE INDEX "Scene_locationId_idx" ON "Scene"("locationId");

-- CreateIndex
CREATE INDEX "Scene_visualStyleId_idx" ON "Scene"("visualStyleId");

-- CreateIndex
CREATE UNIQUE INDEX "VisualStyle_slug_key" ON "VisualStyle"("slug");

-- CreateIndex
CREATE INDEX "Asset_projectId_idx" ON "Asset"("projectId");

-- CreateIndex
CREATE INDEX "Asset_sceneId_idx" ON "Asset"("sceneId");

-- CreateIndex
CREATE INDEX "Asset_jobId_idx" ON "Asset"("jobId");

-- CreateIndex
CREATE INDEX "Asset_entityId_idx" ON "Asset"("entityId");

-- CreateIndex
CREATE INDEX "Asset_entityType_entityId_idx" ON "Asset"("entityType", "entityId");

-- CreateIndex
CREATE UNIQUE INDEX "GenerationJob_bookAnalysisId_key" ON "GenerationJob"("bookAnalysisId");

-- CreateIndex
CREATE INDEX "GenerationJob_projectId_idx" ON "GenerationJob"("projectId");

-- CreateIndex
CREATE INDEX "GenerationJob_userId_idx" ON "GenerationJob"("userId");

-- CreateIndex
CREATE INDEX "GenerationJob_sceneId_idx" ON "GenerationJob"("sceneId");

-- CreateIndex
CREATE INDEX "GenerationJob_bookAnalysisId_idx" ON "GenerationJob"("bookAnalysisId");

-- CreateIndex
CREATE INDEX "AiProviderLog_userId_idx" ON "AiProviderLog"("userId");

-- CreateIndex
CREATE INDEX "AiProviderLog_bookAnalysisId_idx" ON "AiProviderLog"("bookAnalysisId");

-- CreateIndex
CREATE INDEX "AiProviderLog_generationJobId_idx" ON "AiProviderLog"("generationJobId");

-- AddForeignKey
ALTER TABLE "BookFile" ADD CONSTRAINT "BookFile_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookAnalysis" ADD CONSTRAINT "BookAnalysis_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProject" ADD CONSTRAINT "UserBookProject_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProject" ADD CONSTRAINT "UserBookProject_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "UserBookProject" ADD CONSTRAINT "UserBookProject_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookChunk" ADD CONSTRAINT "BookChunk_bookId_fkey" FOREIGN KEY ("bookId") REFERENCES "Book"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "BookChunk" ADD CONSTRAINT "BookChunk_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldBible" ADD CONSTRAINT "WorldBible_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldBible" ADD CONSTRAINT "WorldBible_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "UserBookProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Character" ADD CONSTRAINT "Character_worldBibleId_fkey" FOREIGN KEY ("worldBibleId") REFERENCES "WorldBible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterAlias" ADD CONSTRAINT "CharacterAlias_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterVersion" ADD CONSTRAINT "CharacterVersion_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_sourceCharacterId_fkey" FOREIGN KEY ("sourceCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "CharacterRelationship" ADD CONSTRAINT "CharacterRelationship_targetCharacterId_fkey" FOREIGN KEY ("targetCharacterId") REFERENCES "Character"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_worldBibleId_fkey" FOREIGN KEY ("worldBibleId") REFERENCES "WorldBible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Location" ADD CONSTRAINT "Location_parentId_fkey" FOREIGN KEY ("parentId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LocationVersion" ADD CONSTRAINT "LocationVersion_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "WorldObject" ADD CONSTRAINT "WorldObject_worldBibleId_fkey" FOREIGN KEY ("worldBibleId") REFERENCES "WorldBible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_worldBibleId_fkey" FOREIGN KEY ("worldBibleId") REFERENCES "WorldBible"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "TimelineEvent" ADD CONSTRAINT "TimelineEvent_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "UserBookProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_characterId_fkey" FOREIGN KEY ("characterId") REFERENCES "Character"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_locationId_fkey" FOREIGN KEY ("locationId") REFERENCES "Location"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Scene" ADD CONSTRAINT "Scene_visualStyleId_fkey" FOREIGN KEY ("visualStyleId") REFERENCES "VisualStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "UserBookProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_jobId_fkey" FOREIGN KEY ("jobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "UserBookProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_sceneId_fkey" FOREIGN KEY ("sceneId") REFERENCES "Scene"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationJob" ADD CONSTRAINT "GenerationJob_visualStyleId_fkey" FOREIGN KEY ("visualStyleId") REFERENCES "VisualStyle"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderLog" ADD CONSTRAINT "AiProviderLog_userId_fkey" FOREIGN KEY ("userId") REFERENCES "User"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderLog" ADD CONSTRAINT "AiProviderLog_bookAnalysisId_fkey" FOREIGN KEY ("bookAnalysisId") REFERENCES "BookAnalysis"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "AiProviderLog" ADD CONSTRAINT "AiProviderLog_generationJobId_fkey" FOREIGN KEY ("generationJobId") REFERENCES "GenerationJob"("id") ON DELETE SET NULL ON UPDATE CASCADE;
