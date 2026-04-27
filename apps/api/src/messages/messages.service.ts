import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";

import { AssetsService, assetSelect } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { CreateMessageDto } from "./dto/create-message.dto";

const messageSelect = {
  id: true,
  conversationId: true,
  role: true,
  content: true,
  attachmentAssetId: true,
  createdAt: true,
  attachmentAsset: {
    select: assetSelect,
  },
} as const;

@Injectable()
export class MessagesService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetsService: AssetsService,
  ) {}

  async create(projectId: string, createMessageDto: CreateMessageDto) {
    if (!createMessageDto.content && !createMessageDto.attachmentAssetId) {
      throw new BadRequestException("A message must include text content or an attachment.");
    }

    const project = await this.prisma.agentProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        conversation: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project?.conversation) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    if (createMessageDto.attachmentAssetId) {
      await this.assetsService.findProjectAssetOrThrow(createMessageDto.attachmentAssetId, projectId);
    }

    const [message] = await this.prisma.$transaction([
      this.prisma.message.create({
        data: {
          conversationId: project.conversation.id,
          role: createMessageDto.role ?? "user",
          content: createMessageDto.content ?? "",
          attachmentAssetId: createMessageDto.attachmentAssetId ?? null,
        },
        select: messageSelect,
      }),
      this.prisma.agentProject.update({
        where: { id: projectId },
        data: {
          updatedAt: new Date(),
        },
        select: {
          id: true,
        },
      }),
    ]);

    return message;
  }

  async findAllByProject(projectId: string) {
    const project = await this.prisma.agentProject.findUnique({
      where: { id: projectId },
      select: {
        id: true,
        conversation: {
          select: {
            id: true,
          },
        },
      },
    });

    if (!project?.conversation) {
      throw new NotFoundException(`Project ${projectId} not found.`);
    }

    return this.prisma.message.findMany({
      where: {
        conversationId: project.conversation.id,
      },
      orderBy: {
        createdAt: "asc",
      },
      select: messageSelect,
    });
  }
}
