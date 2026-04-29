import { Injectable, NotFoundException } from "@nestjs/common";

import { assetSelect } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class VersionsService {
  constructor(private readonly prisma: PrismaService) {}

  async findAllByProject(projectId: string) {
    const project = await this.prisma.agentProject.findUnique({
      where: { id: projectId },
      select: { id: true },
    });

    if (!project) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    return this.prisma.imageVersion.findMany({
      where: {
        projectId,
      },
      orderBy: {
        versionIndex: "desc",
      },
      select: {
        id: true,
        generationTaskId: true,
        parentVersionId: true,
        outputAssetId: true,
        versionIndex: true,
        changeSummary: true,
        createdAt: true,
        generationTask: {
          select: {
            taskType: true,
            status: true,
            modelName: true,
            promptText: true,
            negativePromptText: true,
            structuredPayloadJson: true,
            errorMessage: true,
            createdAt: true,
            completedAt: true,
          },
        },
        outputAsset: {
          select: assetSelect,
        },
      },
    });
  }
}
