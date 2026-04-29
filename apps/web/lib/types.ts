export type Project = {
  id: string;
  title: string;
  description: string | null;
  createdAt: string;
  updatedAt: string;
};

export type Asset = {
  id: string;
  projectId: string | null;
  type: "upload" | "output" | "thumbnail";
  fileUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
  createdAt: string;
};

export type UploadedAsset = {
  assetId: string;
  fileUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

export type Message = {
  id: string;
  conversationId: string;
  role: "user" | "assistant" | "system";
  content: string;
  attachmentAssetId: string | null;
  attachmentAsset: Asset | null;
  createdAt: string;
};

export type GenerationTask = {
  id: string;
  projectId: string;
  conversationId: string;
  sourceAssetId: string | null;
  baseVersionId: string | null;
  taskType: "text_to_image" | "image_to_image";
  status: "pending" | "running" | "success" | "failed";
  modelName: string;
  promptText: string;
  negativePromptText: string | null;
  structuredPayloadJson: Record<string, unknown>;
  errorMessage: string | null;
  createdAt: string;
  completedAt: string | null;
  sourceAsset: Asset | null;
  generatedVersion: Version | null;
};

export type Version = {
  id: string;
  generationTaskId: string | null;
  parentVersionId: string | null;
  outputAssetId: string;
  versionIndex: number;
  changeSummary: string | null;
  createdAt: string;
  outputAsset: Asset;
};

export type ImageModel = {
  id: string;
  name: string;
  displayName: string;
  provider: "apimart" | "mock";
  providerModel: string;
  enabled: boolean;
  available: boolean;
  supportsTextToImage: boolean;
  supportsImageToImage: boolean;
  supportsMultiImage: boolean;
  allowedSizes: string[];
  defaultSize: string;
  costLevel: "low" | "medium" | "high";
  speedLevel: "low" | "medium" | "high";
  description: string;
};
