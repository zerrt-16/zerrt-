import { BadRequestException, Injectable, Logger, NotFoundException } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import {
  AssetType,
  GenerationTaskStatus,
  GenerationTaskType,
} from "@prisma/client";
import { readFile } from "node:fs/promises";

import { AssetsService, assetSelect } from "../assets/assets.service";
import { ImageModelRegistryService } from "../generation/image-models/image-model-registry.service";
import { ImageProvider } from "../generation/providers/image-provider";
import { PrismaService } from "../prisma/prisma.service";
import { LocalUploadStorageService } from "../upload/storage/local-upload-storage.service";
import {
  UpscaleTargetResolution,
  UpscaleVersionDto,
} from "./dto/upscale-version.dto";

type VisionAnalysis = {
  subject: string;
  pose: string;
  scene: string;
  composition: string;
  cameraView: string;
  lighting: string;
  colorMood: string;
  materialDetails: string;
  facialExpression: string;
  productStructure: string;
  backgroundElements: string;
  styleKeywords: string[];
  lockedDetails: string[];
  forbiddenChanges: string[];
};

type ApimartChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

const upscaleTaskSelect = {
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

@Injectable()
export class ImageUpscaleService {
  private readonly logger = new Logger(ImageUpscaleService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly configService: ConfigService,
    private readonly assetsService: AssetsService,
    private readonly imageModelRegistryService: ImageModelRegistryService,
    private readonly imageProvider: ImageProvider,
    private readonly localUploadStorageService: LocalUploadStorageService,
  ) {}

  async createUpscaleTask(input: {
    projectId: string;
    versionId: string;
    dto: UpscaleVersionDto;
  }) {
    if (input.dto.projectId && input.dto.projectId !== input.projectId) {
      throw new BadRequestException("Project ID in request body does not match route.");
    }

    if (input.dto.versionId && input.dto.versionId !== input.versionId) {
      throw new BadRequestException("Version ID in request body does not match route.");
    }

    const sourceVersion = await this.prisma.imageVersion.findFirst({
      where: {
        id: input.versionId,
        projectId: input.projectId,
      },
      select: {
        id: true,
        projectId: true,
        versionIndex: true,
        changeSummary: true,
        outputAsset: {
          select: assetSelect,
        },
        generationTask: {
          select: {
            promptText: true,
            modelName: true,
          },
        },
        project: {
          select: {
            conversation: {
              select: { id: true },
            },
          },
        },
      },
    });

    if (!sourceVersion?.project.conversation) {
      throw new NotFoundException(`Version ${input.versionId} not found for project ${input.projectId}.`);
    }

    if (!sourceVersion.outputAsset?.fileUrl) {
      throw new NotFoundException("未找到可放大的原图。");
    }

    const requestedModelId = input.dto.modelId ?? "nano-banana-pro";
    const imageModelSelection = this.imageModelRegistryService.resolveForRequest({
      imageModelId: requestedModelId,
      taskType: GenerationTaskType.image_to_image,
      size: this.getAssetAspectRatio(sourceVersion.outputAsset.width, sourceVersion.outputAsset.height),
    });
    const sourceImageUrl = input.dto.sourceImageUrl ?? sourceVersion.outputAsset.fileUrl;
    const originalPrompt =
      input.dto.originalPrompt ??
      sourceVersion.generationTask?.promptText ??
      sourceVersion.changeSummary ??
      "";
    const initialPayload = {
      generationType: "upscale",
      sourceVersionId: sourceVersion.id,
      sourceVersionIndex: sourceVersion.versionIndex,
      targetResolution: input.dto.targetResolution,
      sourceImageUrl,
      originalPrompt,
      modelId: imageModelSelection.model.id,
      providerModel: imageModelSelection.model.providerModel,
      status: "pending",
    };

    console.log("[image-upscale-request]", {
      projectId: input.projectId,
      versionId: input.versionId,
      sourceImageUrlExists: Boolean(sourceImageUrl),
      targetResolution: input.dto.targetResolution,
      promptLength: originalPrompt.length,
    });

    const task = await this.prisma.generationTask.create({
      data: {
        projectId: input.projectId,
        conversationId: sourceVersion.project.conversation.id,
        sourceAssetId: sourceVersion.outputAsset.id,
        baseVersionId: sourceVersion.id,
        taskType: GenerationTaskType.image_to_image,
        status: GenerationTaskStatus.pending,
        modelName: `pending/upscale/${imageModelSelection.model.provider}/${imageModelSelection.model.providerModel}`,
        promptText: originalPrompt,
        negativePromptText: null,
        structuredPayloadJson: initialPayload,
      },
      select: upscaleTaskSelect,
    });

    void this.processUpscaleTask(task.id, {
      targetResolution: input.dto.targetResolution,
      modelId: imageModelSelection.model.id,
      providerModel: imageModelSelection.model.providerModel,
    });

    return task;
  }

  private async processUpscaleTask(
    taskId: string,
    input: {
      targetResolution: UpscaleTargetResolution;
      modelId: string;
      providerModel: string;
    },
  ) {
    const task = await this.prisma.generationTask.findUnique({
      where: { id: taskId },
      select: {
        id: true,
        projectId: true,
        sourceAssetId: true,
        baseVersionId: true,
        promptText: true,
        sourceAsset: {
          select: assetSelect,
        },
      },
    });

    if (!task?.sourceAsset || !task.baseVersionId) {
      await this.failTask(taskId, "未找到可放大的原图。");
      return;
    }

    await this.prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: GenerationTaskStatus.running,
        errorMessage: null,
      },
    });

    const sourceFilePath = this.localUploadStorageService.resolveUploadsFilePath(
      task.sourceAsset.fileUrl,
    );
    const sourceImageUrl = task.sourceAsset.fileUrl;
    let analysis: VisionAnalysis;

    try {
      analysis = await this.analyzeSourceImage({
        projectId: task.projectId,
        versionId: task.baseVersionId,
        sourceFilePath,
        sourceMimeType: task.sourceAsset.mimeType,
        sourceImageUrl,
        targetResolution: input.targetResolution,
        originalPrompt: task.promptText,
        providerModel: input.providerModel,
      });
    } catch (error) {
      this.logUpscaleError("analysis", error, {
        projectId: task.projectId,
        versionId: task.baseVersionId,
        targetResolution: input.targetResolution,
        modelId: input.modelId,
        providerModel: input.providerModel,
      });
      await this.failTask(taskId, "图片分析失败，请稍后重试。");
      return;
    }

    const finalPrompt = this.buildUpscalePrompt({
      analysis,
      originalPrompt: task.promptText,
      targetResolution: input.targetResolution,
    });
    const imageModelSelection = this.imageModelRegistryService.resolveForRequest({
      imageModelId: input.modelId,
      taskType: GenerationTaskType.image_to_image,
      size: this.getAssetAspectRatio(task.sourceAsset.width, task.sourceAsset.height),
    });
    const providerName = this.imageProvider.getProviderName(imageModelSelection.model);

    console.log("[image-upscale-provider-request]", {
      modelId: imageModelSelection.model.id,
      providerModel: imageModelSelection.model.providerModel,
      targetResolution: input.targetResolution,
      finalPromptLength: finalPrompt.length,
      status: "running",
    });

    try {
      await this.prisma.generationTask.update({
        where: { id: taskId },
        data: {
          modelName: `upscale/apimart/${this.getAnalysisModelName()}/${providerName}`,
          promptText: finalPrompt,
          negativePromptText: this.getUpscaleNegativePrompt(),
          structuredPayloadJson: {
            generationType: "upscale",
            sourceVersionId: task.baseVersionId,
            targetResolution: input.targetResolution,
            sourceImageUrl,
            originalPrompt: task.promptText,
            analysisPrompt: analysis,
            finalPrompt,
            modelId: imageModelSelection.model.id,
            providerModel: imageModelSelection.model.providerModel,
            status: "running",
            mockMode: imageModelSelection.model.provider === "mock",
          },
        },
      });

      const providerResult = await this.imageProvider.editFromImage({
        projectId: task.projectId,
        prompt: finalPrompt,
        negativePrompt: this.getUpscaleNegativePrompt(),
        imageModel: imageModelSelection.model,
        size: imageModelSelection.size,
        sourceFilePath,
        sourceMimeType: task.sourceAsset.mimeType,
        sourceWidth: task.sourceAsset.width,
        sourceHeight: task.sourceAsset.height,
        sourceSizeBytes: task.sourceAsset.sizeBytes,
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
      const changeSummary =
        imageModelSelection.model.provider === "mock"
          ? `${input.targetResolution} 测试模式高清重绘，未调用真实高清重绘模型。`
          : `${input.targetResolution} AI 高清重绘，基于来源版本增强细节与清晰度。`;

      await this.prisma.$transaction([
        this.prisma.generationTask.update({
          where: { id: taskId },
          data: {
            status: GenerationTaskStatus.success,
            promptText: finalPrompt,
            negativePromptText: this.getUpscaleNegativePrompt(),
            structuredPayloadJson: {
              generationType: "upscale",
              sourceVersionId: task.baseVersionId,
              targetResolution: input.targetResolution,
              sourceImageUrl,
              originalPrompt: task.promptText,
              analysisPrompt: analysis,
              finalPrompt,
              modelId: imageModelSelection.model.id,
              providerModel: imageModelSelection.model.providerModel,
              outputAssetId: outputAsset.id,
              status: "success",
              mockMode: imageModelSelection.model.provider === "mock",
            },
            errorMessage: null,
            completedAt: new Date(),
          },
        }),
        this.prisma.imageVersion.create({
          data: {
            projectId: task.projectId,
            generationTaskId: taskId,
            parentVersionId: task.baseVersionId,
            outputAssetId: outputAsset.id,
            versionIndex,
            changeSummary,
          },
        }),
        this.prisma.agentProject.update({
          where: { id: task.projectId },
          data: {
            updatedAt: new Date(),
          },
        }),
      ]);

      console.log("[image-upscale-provider-result]", {
        modelId: imageModelSelection.model.id,
        providerModel: imageModelSelection.model.providerModel,
        targetResolution: input.targetResolution,
        status: "success",
      });
    } catch (error) {
      this.logUpscaleError("provider", error, {
        projectId: task.projectId,
        versionId: task.baseVersionId,
        targetResolution: input.targetResolution,
        modelId: input.modelId,
        providerModel: input.providerModel,
      });
      await this.failTask(taskId, "高清放大失败，请稍后重试。");
    }
  }

  private async analyzeSourceImage(input: {
    projectId: string;
    versionId: string;
    sourceFilePath: string;
    sourceMimeType: string;
    sourceImageUrl: string;
    targetResolution: UpscaleTargetResolution;
    originalPrompt: string;
    providerModel: string;
  }): Promise<VisionAnalysis> {
    const imageProvider = this.configService
      .get<string>("AI_IMAGE_PROVIDER")
      ?.trim()
      .toLowerCase();

    if (imageProvider === "mock") {
      return this.buildMockAnalysis(input.originalPrompt);
    }

    const apiKey = this.configService.get<string>("APIMART_API_KEY")?.trim();

    if (!apiKey) {
      throw new Error("APIMART_API_KEY is not configured for image analysis.");
    }

    const sourceBuffer = await readFile(input.sourceFilePath);
    const sourceDataUrl = `data:${input.sourceMimeType};base64,${sourceBuffer.toString("base64")}`;
    const baseUrl =
      this.configService.get<string>("APIMART_BASE_URL")?.trim() || "https://api.apimart.ai/v1";
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 45_000);

    console.log("[image-upscale-analysis-request]", {
      projectId: input.projectId,
      versionId: input.versionId,
      sourceImageUrlExists: Boolean(input.sourceImageUrl),
      targetResolution: input.targetResolution,
      promptLength: input.originalPrompt.length,
    });

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getAnalysisModelName(),
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "You are a visual analysis agent for AI high-resolution redraw. Return strict JSON only.",
            },
            {
              role: "user",
              content: [
                {
                  type: "text",
                  text: this.buildAnalysisPrompt(input),
                },
                {
                  type: "image_url",
                  image_url: {
                    url: sourceDataUrl,
                  },
                },
              ],
            },
          ],
        }),
        signal: controller.signal,
      });

      const responseText = await response.text();

      if (!response.ok) {
        throw new Error(
          `APIMart image analysis failed with status ${response.status}: ${responseText.slice(0, 500)}`,
        );
      }

      const payload = JSON.parse(responseText) as ApimartChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("APIMart image analysis response did not include message content.");
      }

      return this.normalizeVisionAnalysis(JSON.parse(this.stripMarkdownJsonFence(content)));
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildAnalysisPrompt(input: {
    targetResolution: UpscaleTargetResolution;
    originalPrompt: string;
  }) {
    return [
      "Analyze the provided image for an AI high-resolution redraw workflow.",
      "Return a strict JSON object with these exact fields:",
      JSON.stringify(
        {
          subject: "string",
          pose: "string",
          scene: "string",
          composition: "string",
          cameraView: "string",
          lighting: "string",
          colorMood: "string",
          materialDetails: "string",
          facialExpression: "string",
          productStructure: "string",
          backgroundElements: "string",
          styleKeywords: ["string"],
          lockedDetails: ["string"],
          forbiddenChanges: ["string"],
        },
        null,
        2,
      ),
      `Target redraw resolution: ${input.targetResolution}.`,
      `Original prompt: ${input.originalPrompt || "No original prompt provided."}`,
      "Focus on identity, pose, composition, scene layout, product structure, spatial relationships, lighting, materials, and details that must stay unchanged.",
    ].join("\n\n");
  }

  private buildUpscalePrompt(input: {
    analysis: VisionAnalysis;
    originalPrompt: string;
    targetResolution: UpscaleTargetResolution;
  }) {
    const targetRequirement =
      input.targetResolution === "4K"
        ? "Create an ultra-high-definition 4K-ready redraw with enhanced material fidelity, lighting, edge detail, texture clarity, and realistic micro-details."
        : "Create a high-definition 2K-ready redraw with improved detail, texture clarity, and clean visual definition.";

    return [
      targetRequirement,
      "Use the uploaded source image as the strict visual base.",
      "Keep the original subject identity, composition, pose, scene, background elements, product structure, proportions, clothing, appearance, camera angle, spatial relationships, and lighting direction consistent.",
      "Do not add unrelated elements. Do not over-beautify or stylize in a way that changes the original image.",
      `Original prompt: ${input.originalPrompt || "No original prompt provided."}`,
      `Subject: ${input.analysis.subject}`,
      `Pose/action: ${input.analysis.pose}`,
      `Scene/environment: ${input.analysis.scene}`,
      `Composition/camera: ${input.analysis.composition}; ${input.analysis.cameraView}`,
      `Lighting/color mood: ${input.analysis.lighting}; ${input.analysis.colorMood}`,
      `Material/details: ${input.analysis.materialDetails}`,
      `Facial expression: ${input.analysis.facialExpression}`,
      `Product structure: ${input.analysis.productStructure}`,
      `Background elements: ${input.analysis.backgroundElements}`,
      `Style keywords: ${input.analysis.styleKeywords.join(", ")}`,
      `Strictly preserve: ${input.analysis.lockedDetails.join(", ")}`,
      `Forbidden changes: ${input.analysis.forbiddenChanges.join(", ")}`,
    ].join("\n");
  }

  private normalizeVisionAnalysis(value: unknown): VisionAnalysis {
    const record = value && typeof value === "object" ? (value as Record<string, unknown>) : {};

    return {
      subject: this.toCleanString(record.subject),
      pose: this.toCleanString(record.pose),
      scene: this.toCleanString(record.scene),
      composition: this.toCleanString(record.composition),
      cameraView: this.toCleanString(record.cameraView),
      lighting: this.toCleanString(record.lighting),
      colorMood: this.toCleanString(record.colorMood),
      materialDetails: this.toCleanString(record.materialDetails),
      facialExpression: this.toCleanString(record.facialExpression),
      productStructure: this.toCleanString(record.productStructure),
      backgroundElements: this.toCleanString(record.backgroundElements),
      styleKeywords: this.toStringArray(record.styleKeywords),
      lockedDetails: this.toStringArray(record.lockedDetails),
      forbiddenChanges: this.toStringArray(record.forbiddenChanges),
    };
  }

  private buildMockAnalysis(originalPrompt: string): VisionAnalysis {
    const fallback = originalPrompt || "source image";

    return {
      subject: fallback,
      pose: "preserve the original pose and action",
      scene: "preserve the original scene and environment",
      composition: "preserve the original composition",
      cameraView: "preserve the original camera angle",
      lighting: "preserve the original lighting direction",
      colorMood: "preserve the original color mood",
      materialDetails: "enhance clarity while preserving original materials",
      facialExpression: "preserve the original facial expression",
      productStructure: "preserve original product structure and proportions",
      backgroundElements: "preserve original background elements",
      styleKeywords: ["test mode", "mock upscale"],
      lockedDetails: ["subject identity", "composition", "pose", "spatial relationship"],
      forbiddenChanges: ["new unrelated elements", "identity changes", "composition changes"],
    };
  }

  private async failTask(taskId: string, errorMessage: string) {
    await this.prisma.generationTask.update({
      where: { id: taskId },
      data: {
        status: GenerationTaskStatus.failed,
        errorMessage,
        completedAt: new Date(),
      },
    });
  }

  private getAssetAspectRatio(width: number, height: number) {
    const ratio = width / height;

    if (Math.abs(ratio - 1) < 0.08) {
      return "1:1";
    }

    if (ratio > 1) {
      return Math.abs(ratio - 16 / 9) < Math.abs(ratio - 4 / 3) ? "16:9" : "4:3";
    }

    return Math.abs(ratio - 9 / 16) < Math.abs(ratio - 3 / 4) ? "9:16" : "3:4";
  }

  private getAnalysisModelName() {
    return this.configService.get<string>("APIMART_MODEL")?.trim() || "gpt-5.5";
  }

  private getUpscaleNegativePrompt() {
    return [
      "do not change subject identity",
      "do not change pose",
      "do not change composition",
      "do not add unrelated elements",
      "over-smoothed skin",
      "plastic texture",
      "distorted anatomy",
      "changed product structure",
      "wrong proportions",
      "low quality",
      "blur",
      "artifacts",
      "watermark",
      "text",
    ].join(", ");
  }

  private stripMarkdownJsonFence(content: string) {
    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    return trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  }

  private toCleanString(value: unknown) {
    return typeof value === "string" && value.trim() ? value.trim() : "not specified";
  }

  private toStringArray(value: unknown) {
    if (!Array.isArray(value)) {
      return [];
    }

    return value.filter((item): item is string => typeof item === "string").map((item) => item.trim()).filter(Boolean);
  }

  private logUpscaleError(
    stage: "analysis" | "provider",
    error: unknown,
    context: {
      projectId: string;
      versionId: string;
      targetResolution: UpscaleTargetResolution;
      modelId: string;
      providerModel: string;
    },
  ) {
    const message = error instanceof Error ? error.message : String(error);

    console.error("[image-upscale-error]", {
      stage,
      ...context,
      errorMessage: message.slice(0, 500),
    });
  }
}
