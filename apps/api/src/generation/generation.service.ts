import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
} from "@nestjs/common";
import {
  AssetType,
  GenerationTaskStatus,
  GenerationTaskType,
} from "@prisma/client";

import { AgentService } from "../agent/agent.service";
import { AssetsService, assetSelect } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { LocalUploadStorageService } from "../upload/storage/local-upload-storage.service";
import { CreateGenerationTaskDto } from "./dto/create-generation-task.dto";
import { ImageModelDefinition } from "./image-models/image-model.types";
import { ImageModelRegistryService } from "./image-models/image-model-registry.service";
import { ImageProvider } from "./providers/image-provider";

const generationTaskSelect = {
  id: true,
  projectId: true,
  conversationId: true,
  sourceAssetId: true,
  baseVersionId: true,
  taskType: true,
  status: true,
  modelName: true,
  promptText: true,
  negativePromptText: true,
  structuredPayloadJson: true,
  errorMessage: true,
  createdAt: true,
  completedAt: true,
  sourceAsset: {
    select: assetSelect,
  },
  generatedVersion: {
    select: {
      id: true,
      parentVersionId: true,
      generationTaskId: true,
      outputAssetId: true,
      versionIndex: true,
      changeSummary: true,
      createdAt: true,
      outputAsset: {
        select: assetSelect,
      },
    },
  },
} as const;

const delay = (ms: number) => new Promise((resolve) => setTimeout(resolve, ms));

type ImageGenerationSelection = {
  imageModel: ImageModelDefinition;
  size: string;
  quality?: string;
};

@Injectable()
export class GenerationService {
  private readonly logger = new Logger(GenerationService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly agentService: AgentService,
    private readonly assetsService: AssetsService,
    private readonly imageModelRegistryService: ImageModelRegistryService,
    private readonly localUploadStorageService: LocalUploadStorageService,
    private readonly imageProvider: ImageProvider,
  ) {}

  async createTask(createGenerationTaskDto: CreateGenerationTaskDto) {
    const messageText = (
      createGenerationTaskDto.messageText ??
      createGenerationTaskDto.prompt ??
      ""
    ).trim();
    let sourceAssetId =
      createGenerationTaskDto.sourceAssetId ?? createGenerationTaskDto.referenceImageIds?.[0];
    const requestedImageModelId =
      createGenerationTaskDto.imageModelId ??
      createGenerationTaskDto.modelId ??
      createGenerationTaskDto.model;
    const requestedSize = createGenerationTaskDto.size ?? createGenerationTaskDto.aspectRatio;

    if (!messageText && !sourceAssetId && !createGenerationTaskDto.baseVersionId) {
      throw new BadRequestException(
        "messageText is required unless a sourceAssetId or baseVersionId is provided.",
      );
    }

    const project = await this.prisma.agentProject.findUnique({
      where: { id: createGenerationTaskDto.projectId },
      select: {
        id: true,
        conversation: {
          select: { id: true },
        },
      },
    });

    if (!project?.conversation) {
      throw new NotFoundException(`Project ${createGenerationTaskDto.projectId} not found.`);
    }

    let sourceAsset = null;

    if (sourceAssetId) {
      sourceAsset = await this.assetsService.findProjectAssetOrThrow(
        sourceAssetId,
        createGenerationTaskDto.projectId,
      );
    }

    if (createGenerationTaskDto.baseVersionId) {
      const baseVersion = await this.prisma.imageVersion.findFirst({
        where: {
          id: createGenerationTaskDto.baseVersionId,
          projectId: createGenerationTaskDto.projectId,
        },
        select: {
          id: true,
          outputAsset: {
            select: assetSelect,
          },
        },
      });

      if (!baseVersion) {
        throw new NotFoundException(
          `Base version ${createGenerationTaskDto.baseVersionId} not found for project ${createGenerationTaskDto.projectId}.`,
        );
      }

      if (!sourceAssetId) {
        sourceAsset = baseVersion.outputAsset;
        sourceAssetId = baseVersion.outputAsset.id;
      }
    }

    const requestedTaskType = sourceAssetId
      ? GenerationTaskType.image_to_image
      : GenerationTaskType.text_to_image;

    const imageModelSelection = this.imageModelRegistryService.resolveForRequest({
      imageModelId: requestedImageModelId,
      taskType: requestedTaskType,
      size: requestedSize,
    });

    console.log("[image-generation-request]", {
      provider: imageModelSelection.model.provider,
      modelId: imageModelSelection.model.id,
      providerModel: imageModelSelection.model.providerModel,
      projectId: createGenerationTaskDto.projectId,
      hasPrompt: Boolean(messageText),
      referenceImageCount: sourceAssetId ? 1 : 0,
      aspectRatio: imageModelSelection.size,
    });

    await this.prisma.message.create({
      data: {
        conversationId: project.conversation.id,
        role: "user",
        content: messageText,
        attachmentAssetId: sourceAsset?.id ?? null,
      },
    });

    const task = await this.prisma.generationTask.create({
      data: {
        projectId: createGenerationTaskDto.projectId,
        conversationId: project.conversation.id,
        sourceAssetId: sourceAssetId ?? null,
        baseVersionId: createGenerationTaskDto.baseVersionId ?? null,
        taskType: requestedTaskType,
        status: GenerationTaskStatus.pending,
        modelName: `pending/${imageModelSelection.model.provider}/${imageModelSelection.model.providerModel}`,
        promptText: messageText,
        negativePromptText: null,
        structuredPayloadJson: {},
      },
      select: generationTaskSelect,
    });

    void this.processTask(task.id, {
      imageModel: imageModelSelection.model,
      size: imageModelSelection.size,
      quality: createGenerationTaskDto.quality,
    });

    return task;
  }

  async getTask(taskId: string) {
    const task = await this.prisma.generationTask.findUnique({
      where: { id: taskId },
      select: generationTaskSelect,
    });

    if (!task) {
      throw new NotFoundException(`Task ${taskId} not found.`);
    }

    return task;
  }

  private async processTask(taskId: string, imageGenerationSelection?: ImageGenerationSelection) {
    try {
      await delay(300);

      const task = await this.prisma.generationTask.findUnique({
        where: { id: taskId },
        select: {
          id: true,
          projectId: true,
          conversationId: true,
          sourceAssetId: true,
          baseVersionId: true,
          promptText: true,
          sourceAsset: {
            select: assetSelect,
          },
        },
      });

      if (!task) {
        return;
      }

      await this.prisma.generationTask.update({
        where: { id: taskId },
        data: {
          status: GenerationTaskStatus.running,
          errorMessage: null,
        },
      });

      const project = await this.prisma.agentProject.findUnique({
        where: { id: task.projectId },
        select: {
          id: true,
          title: true,
          description: true,
        },
      });

      if (!project) {
        throw new NotFoundException(`Project ${task.projectId} not found.`);
      }

      const [recentMessages, recentVersions] = await Promise.all([
        this.prisma.message.findMany({
          where: {
            conversationId: task.conversationId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 8,
          select: {
            role: true,
            content: true,
            createdAt: true,
            attachmentAssetId: true,
          },
        }),
        this.prisma.imageVersion.findMany({
          where: {
            projectId: task.projectId,
          },
          orderBy: {
            createdAt: "desc",
          },
          take: 5,
          select: {
            id: true,
            versionIndex: true,
            changeSummary: true,
            createdAt: true,
          },
        }),
      ]);

      const agentResult = await this.agentService.analyze({
        project,
        messageText: task.promptText,
        sourceAssetId: task.sourceAssetId,
        baseVersionId: task.baseVersionId,
        recentMessages: recentMessages.reverse(),
        recentVersions,
      });

      const structuredPayload = agentResult.structuredOutput;
      const selectedImageModel = imageGenerationSelection
        ? this.imageModelRegistryService.resolveForRequest({
            imageModelId: imageGenerationSelection.imageModel.id,
            taskType: structuredPayload.taskType,
            size: imageGenerationSelection.size,
          })
        : this.imageModelRegistryService.resolveForRequest({
            taskType: structuredPayload.taskType,
          });

      const imageProviderName = this.imageProvider.getProviderName(selectedImageModel.model);
      const taskModelName = `${agentResult.modelName}/${imageProviderName}`;

      await this.prisma.generationTask.update({
        where: { id: task.id },
        data: {
          taskType: structuredPayload.taskType,
          modelName: taskModelName,
          promptText: agentResult.promptText,
          negativePromptText: agentResult.negativePromptText,
          structuredPayloadJson: structuredPayload,
        },
      });

      const providerResult = task.sourceAsset
        ? await this.imageProvider.editFromImage({
            projectId: task.projectId,
            prompt: agentResult.promptText,
            negativePrompt: agentResult.negativePromptText,
            imageModel: selectedImageModel.model,
            size: selectedImageModel.size,
            quality: imageGenerationSelection?.quality,
            sourceFilePath: this.localUploadStorageService.resolveUploadsFilePath(
              task.sourceAsset.fileUrl,
            ),
            sourceMimeType: task.sourceAsset.mimeType,
            sourceWidth: task.sourceAsset.width,
            sourceHeight: task.sourceAsset.height,
            sourceSizeBytes: task.sourceAsset.sizeBytes,
          })
        : await this.imageProvider.generateFromText({
            projectId: task.projectId,
            prompt: agentResult.promptText,
            negativePrompt: agentResult.negativePromptText,
            imageModel: selectedImageModel.model,
            size: selectedImageModel.size,
            quality: imageGenerationSelection?.quality,
          });

      const savedOutput = await this.localUploadStorageService.saveGeneratedOutput({
        projectId: task.projectId,
        originalName: providerResult.originalName,
        buffer: providerResult.imageBuffer,
        sourceFilePath: providerResult.filePath,
      });

      const outputAsset = await this.assetsService.create({
        projectId: task.projectId,
        type: AssetType.output,
        fileUrl: savedOutput.relativeFileUrl,
        mimeType: providerResult.mimeType,
        width: providerResult.width,
        height: providerResult.height,
        sizeBytes: providerResult.sizeBytes,
      });

      const latestVersion = await this.prisma.imageVersion.findFirst({
        where: { projectId: task.projectId },
        orderBy: { versionIndex: "desc" },
        select: { versionIndex: true },
      });

      const versionIndex = (latestVersion?.versionIndex ?? 0) + 1;

      await this.prisma.$transaction([
        this.prisma.generationTask.update({
          where: { id: task.id },
          data: {
            taskType: structuredPayload.taskType,
            status: GenerationTaskStatus.success,
            modelName: taskModelName,
            promptText: agentResult.promptText,
            negativePromptText: agentResult.negativePromptText,
            structuredPayloadJson: structuredPayload,
            errorMessage: null,
            completedAt: new Date(),
          },
        }),
        this.prisma.imageVersion.create({
          data: {
            projectId: task.projectId,
            generationTaskId: task.id,
            parentVersionId: task.baseVersionId ?? null,
            outputAssetId: outputAsset.id,
            versionIndex,
            changeSummary: agentResult.changeSummary,
          },
        }),
        this.prisma.agentProject.update({
          where: { id: task.projectId },
          data: {
            updatedAt: new Date(),
          },
        }),
      ]);
    } catch (error) {
      const errorMessage =
        error instanceof Error ? error.message : "Generation failed unexpectedly.";

      this.logger.error(`Generation task ${taskId} failed. ${errorMessage}`);

      await this.prisma.generationTask.update({
        where: { id: taskId },
        data: {
          status: GenerationTaskStatus.failed,
          errorMessage,
          completedAt: new Date(),
        },
      });
    }
  }
}
