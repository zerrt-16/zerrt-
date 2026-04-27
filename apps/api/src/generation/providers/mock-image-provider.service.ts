import { Injectable } from "@nestjs/common";
import { stat } from "node:fs/promises";
import { basename, resolve } from "node:path";

import {
  ImageProvider,
  ImageProviderResult,
  ImageToImageInput,
  TextToImageInput,
} from "./image-provider";
import { SelectedImageModel } from "../image-models/image-model.types";

@Injectable()
export class MockImageProviderService extends ImageProvider {
  private readonly placeholderPath = resolve(
    process.cwd(),
    "src",
    "generation",
    "mock-assets",
    "mock-placeholder.svg",
  );

  getProviderName(imageModel?: SelectedImageModel) {
    return imageModel?.providerModel ?? "mock-image-provider";
  }

  async generateFromText(_input: TextToImageInput): Promise<ImageProviderResult> {
    const fileStats = await stat(this.placeholderPath);

    return {
      filePath: this.placeholderPath,
      mimeType: "image/svg+xml",
      width: 1024,
      height: 1024,
      sizeBytes: Number(fileStats.size),
      originalName: basename(this.placeholderPath),
    };
  }

  async editFromImage(input: ImageToImageInput): Promise<ImageProviderResult> {
    return {
      filePath: input.sourceFilePath,
      mimeType: input.sourceMimeType,
      width: input.sourceWidth,
      height: input.sourceHeight,
      sizeBytes: input.sourceSizeBytes,
      originalName: basename(input.sourceFilePath),
    };
  }
}
