-- CreateEnum
CREATE TYPE "AssetType" AS ENUM ('upload', 'output', 'thumbnail');

-- AlterTable
ALTER TABLE "Message" ADD COLUMN     "attachmentAssetId" TEXT;

-- CreateTable
CREATE TABLE "Asset" (
    "id" TEXT NOT NULL,
    "projectId" TEXT,
    "type" "AssetType" NOT NULL,
    "fileUrl" TEXT NOT NULL,
    "mimeType" TEXT NOT NULL,
    "width" INTEGER NOT NULL,
    "height" INTEGER NOT NULL,
    "sizeBytes" INTEGER NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,

    CONSTRAINT "Asset_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE INDEX "Asset_projectId_createdAt_idx" ON "Asset"("projectId", "createdAt");

-- CreateIndex
CREATE INDEX "Message_attachmentAssetId_idx" ON "Message"("attachmentAssetId");

-- AddForeignKey
ALTER TABLE "Message" ADD CONSTRAINT "Message_attachmentAssetId_fkey" FOREIGN KEY ("attachmentAssetId") REFERENCES "Asset"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Asset" ADD CONSTRAINT "Asset_projectId_fkey" FOREIGN KEY ("projectId") REFERENCES "AgentProject"("id") ON DELETE SET NULL ON UPDATE CASCADE;
