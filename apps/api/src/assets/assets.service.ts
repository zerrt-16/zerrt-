import { Injectable, NotFoundException } from "@nestjs/common";
import { AssetType } from "@prisma/client";

import { PrismaService } from "../prisma/prisma.service";

export const assetSelect = {
  id: true,
  projectId: true,
  type: true,
  fileUrl: true,
  mimeType: true,
  width: true,
  height: true,
  sizeBytes: true,
  createdAt: true,
} as const;

type CreateAssetInput = {
  projectId?: string;
  type: AssetType;
  fileUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

@Injectable()
export class AssetsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(input: CreateAssetInput) {
    return this.prisma.asset.create({
      data: {
        projectId: input.projectId ?? null,
        type: input.type,
        fileUrl: input.fileUrl,
        mimeType: input.mimeType,
        width: input.width,
        height: input.height,
        sizeBytes: input.sizeBytes,
      },
      select: assetSelect,
    });
  }

  async findProjectAssetOrThrow(assetId: string, projectId: string) {
    const asset = await this.prisma.asset.findFirst({
      where: {
        id: assetId,
        projectId,
      },
      select: assetSelect,
    });

    if (!asset) {
      throw new NotFoundException(`Asset ${assetId} not found for project ${projectId}.`);
    }

    return asset;
  }
}
