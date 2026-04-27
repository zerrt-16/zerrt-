-- CreateEnum
CREATE TYPE "GenerationTaskStatus" AS ENUM ('pending', 'running', 'success', 'failed');

-- CreateEnum
CREATE TYPE "GenerationTaskType" AS ENUM ('text_to_image', 'image_to_image');

-- CreateTable
CREATE TABLE "GenerationTask" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "conversationId" TEXT NOT NULL,
    "sourceAssetId" TEXT,
    "baseVersionId" TEXT,
    "taskType" "GenerationTaskType" NOT NULL,
    "status" "GenerationTaskStatus" NOT NULL,
    "modelName" TEXT NOT NULL,
    "promptText" TEXT NOT NULL,
    "negativePromptText" TEXT,
    "structuredPayloadJson" JSONB NOT NULL,
    "errorMessage" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "completedAt" TIMESTAMP(3),

    CONSTRAINT "GenerationTask_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "ImageVersion" (
    "id" TEXT NOT NULL,
    "projectId" TEXT NOT NULL,
    "generationTaskId" TEXT,
    "parentVersionId" TEXT,
    "outputAssetId" TEXT NOT NULL,
    "versionIndex" INTEGER NOT NULL,
    "changeSummary" TEXT,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "ImageVersion_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "GenerationTask_projectId_createdAt_idx" ON "GenerationTask"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationTask_conversationId_createdAt_idx" ON "GenerationTask"("conversationId", "createdAt");

-- CreateIndex
CREATE INDEX "GenerationTask_status_createdAt_idx" ON "GenerationTask"("status", "createdAt");

-- CreateIndex
CREATE UNIQUE INDEX "ImageVersion_generationTaskId_key" ON "ImageVersion"("generationTaskId");

-- CreateIndex
CREATE INDEX "ImageVersion_projectId_versionIndex_idx" ON "ImageVersion"("projectId", "versionIndex");

-- CreateIndex
CREATE INDEX "ImageVersion_projectId_createdAt_idx" ON "ImageVersion"("projectId", "createdAt");

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AgentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_conversationId_fkey" FOREIGN KEY ("conversationId") REFERENCES "Conversation"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_sourceAssetId_fkey" FOREIGN KEY ("sourceAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "GenerationTask" ADD CONSTRAINT "GenerationTask_baseVersionId_fkey" FOREIGN KEY ("baseVersionId") REFERENCES "ImageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AgentProject"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_generationTaskId_fkey" FOREIGN KEY ("generationTaskId") REFERENCES "GenerationTask"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_parentVersionId_fkey" FOREIGN KEY ("parentVersionId") REFERENCES "ImageVersion"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "ImageVersion" ADD CONSTRAINT "ImageVersion_outputAssetId_fkey" FOREIGN KEY ("outputAssetId") REFERENCES "Asset"("id") ON DELETE RESTRICT ON UPDATE CASCADE;
