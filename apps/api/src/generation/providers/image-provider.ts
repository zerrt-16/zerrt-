import { SelectedImageModel } from "../image-models/image-model.types";

export type ImageProviderResult = {
  filePath?: string;
  imageBuffer?: Buffer;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  originalName: string;
};

export type TextToImageInput = {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  imageModel?: SelectedImageModel;
  size?: string;
  quality?: string;
};

export type ImageToImageInput = {
  projectId: string;
  prompt: string;
  negativePrompt?: string;
  imageModel?: SelectedImageModel;
  size?: string;
  quality?: string;
  sourceFilePath: string;
  sourceMimeType: string;
  sourceWidth: number;
  sourceHeight: number;
  sourceSizeBytes: number;
};

export abstract class ImageProvider {
  abstract getProviderName(imageModel?: SelectedImageModel): string;
  abstract generateFromText(input: TextToImageInput): Promise<ImageProviderResult>;
  abstract editFromImage(input: ImageToImageInput): Promise<ImageProviderResult>;
}
