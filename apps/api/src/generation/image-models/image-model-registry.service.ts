import { BadRequestException, Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { GenerationTaskType } from "@prisma/client";

import { ImageModelDefinition } from "./image-model.types";

const MODEL_ID_ALIASES: Record<string, string> = {
  "apimart-gpt-image-2": "gpt-image-2",
};

@Injectable()
export class ImageModelRegistryService {
  constructor(private readonly configService: ConfigService) {}

  listEnabled() {
    return this.getImageModels().filter((model) => model.enabled && model.available);
  }

  resolveForRequest(input: {
    imageModelId?: string;
    taskType: GenerationTaskType;
    size?: string;
  }) {
    const model = input.imageModelId
      ? this.findEnabledOrThrow(input.imageModelId)
      : this.getDefaultModel();

    this.assertSupportsTaskType(model, input.taskType);

    const size = input.size?.trim() || model.defaultSize;

    if (!model.allowedSizes.includes(size)) {
      throw new BadRequestException(
        `模型「${model.displayName}」不支持图片比例「${size}」，请选择：${model.allowedSizes.join("、")}。`,
      );
    }

    return { model, size };
  }

  findEnabledOrThrow(imageModelId: string) {
    const normalizedImageModelId = this.normalizeModelId(imageModelId);
    const model = this.listEnabled().find((item) => item.id === normalizedImageModelId);

    if (!model) {
      throw new BadRequestException(`未找到可用的生图模型：${imageModelId}。`);
    }

    return model;
  }

  private getImageModels(): ImageModelDefinition[] {
    const nanoBananaProviderModel =
      this.configService.get<string>("APIMART_NANO_BANANA_PRO_MODEL")?.trim() ||
      "gemini-3-pro-image-preview";

    return [
      {
        id: "gpt-image-2",
        name: "GPT Image 2",
        displayName: "GPT Image 2",
        provider: "apimart",
        providerModel: "gpt-image-2",
        enabled: true,
        available: true,
        supportsTextToImage: true,
        supportsImageToImage: true,
        supportsMultiImage: false,
        allowedSizes: ["1:1", "4:3", "3:4", "16:9", "9:16"],
        defaultSize: "1:1",
        costLevel: "medium",
        speedLevel: "medium",
        description: "稳定通用的图像生成模型，适合产品图、材质优化与真实感创作。",
      },
      {
        id: "nano-banana-pro",
        name: "Nano Banana Pro",
        displayName: "Nano Banana Pro",
        provider: "apimart",
        providerModel: nanoBananaProviderModel,
        enabled: true,
        available: true,
        supportsTextToImage: true,
        supportsImageToImage: true,
        supportsMultiImage: false,
        allowedSizes: ["1:1", "4:3", "3:4", "16:9", "9:16"],
        defaultSize: "1:1",
        costLevel: "medium",
        speedLevel: "medium",
        description: "适合电商视觉、真实质感、人像与产品细节强化。",
      },
      {
        id: "mock-image-provider",
        name: "Mock Image Provider",
        displayName: "Mock Image Provider",
        provider: "mock",
        providerModel: "mock",
        enabled: true,
        available: true,
        supportsTextToImage: true,
        supportsImageToImage: true,
        supportsMultiImage: false,
        allowedSizes: ["1:1"],
        defaultSize: "1:1",
        costLevel: "low",
        speedLevel: "high",
        description: "开发测试用模型，不调用真实图像接口，便于快速验证流程。",
      },
    ];
  }

  private getDefaultModel() {
    const provider = this.configService
      .get<string>("AI_IMAGE_PROVIDER")
      ?.trim()
      .toLowerCase();
    const apimartModel =
      this.configService.get<string>("APIMART_IMAGE_MODEL")?.trim() || "gpt-image-2";

    if (provider === "mock") {
      return this.findEnabledOrThrow("mock-image-provider");
    }

    if (provider === "apimart") {
      const normalizedApimartModelId = this.normalizeModelId(apimartModel);

      return (
        this.listEnabled().find(
          (model) =>
            model.provider === "apimart" &&
            (model.id === normalizedApimartModelId || model.providerModel === apimartModel),
        ) ?? this.findEnabledOrThrow("gpt-image-2")
      );
    }

    return this.findEnabledOrThrow("mock-image-provider");
  }

  private normalizeModelId(imageModelId: string) {
    const normalized = imageModelId.trim();

    return MODEL_ID_ALIASES[normalized] ?? normalized;
  }

  private assertSupportsTaskType(model: ImageModelDefinition, taskType: GenerationTaskType) {
    if (taskType === GenerationTaskType.text_to_image && !model.supportsTextToImage) {
      throw new BadRequestException(`模型「${model.displayName}」不支持文生图。`);
    }

    if (taskType === GenerationTaskType.image_to_image && !model.supportsImageToImage) {
      throw new BadRequestException(`模型「${model.displayName}」不支持图生图。`);
    }
  }
}
