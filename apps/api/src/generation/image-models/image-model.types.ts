export type ImageModelProvider = "apimart" | "mock";

export type ImageModelLevel = "low" | "medium" | "high";

export type ImageModelDefinition = {
  id: string;
  name: string;
  displayName: string;
  provider: ImageModelProvider;
  providerModel: string;
  enabled: boolean;
  supportsTextToImage: boolean;
  supportsImageToImage: boolean;
  supportsMultiImage: boolean;
  allowedSizes: string[];
  defaultSize: string;
  costLevel: ImageModelLevel;
  speedLevel: ImageModelLevel;
  description: string;
};

export type SelectedImageModel = Pick<
  ImageModelDefinition,
  "id" | "provider" | "providerModel" | "defaultSize"
>;
