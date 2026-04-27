import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  ImageProvider,
  ImageProviderResult,
  ImageToImageInput,
  TextToImageInput,
} from "./image-provider";
import { ApimartImageProviderService } from "./apimart-image-provider.service";
import { SelectedImageModel } from "../image-models/image-model.types";
import { MockImageProviderService } from "./mock-image-provider.service";

@Injectable()
export class ConfiguredImageProviderService extends ImageProvider {
  constructor(
    private readonly configService: ConfigService,
    private readonly apimartImageProviderService: ApimartImageProviderService,
    private readonly mockImageProviderService: MockImageProviderService,
  ) {
    super();
  }

  getProviderName(imageModel?: SelectedImageModel) {
    return this.getProvider(imageModel).getProviderName(imageModel);
  }

  generateFromText(input: TextToImageInput): Promise<ImageProviderResult> {
    return this.getProvider(input.imageModel).generateFromText(input);
  }

  editFromImage(input: ImageToImageInput): Promise<ImageProviderResult> {
    return this.getProvider(input.imageModel).editFromImage(input);
  }

  private getProvider(imageModel?: SelectedImageModel) {
    if (imageModel?.provider === "apimart") {
      return this.apimartImageProviderService;
    }

    if (imageModel?.provider === "mock") {
      return this.mockImageProviderService;
    }

    const provider = this.configService
      .get<string>("AI_IMAGE_PROVIDER")
      ?.trim()
      .toLowerCase();

    return provider === "apimart"
      ? this.apimartImageProviderService
      : this.mockImageProviderService;
  }
}
