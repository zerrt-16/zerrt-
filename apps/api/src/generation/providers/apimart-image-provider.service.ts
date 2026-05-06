import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";
import { imageSize } from "image-size";
import { get as httpGet } from "node:http";
import { get as httpsGet } from "node:https";
import { readFile } from "node:fs/promises";

import {
  ImageProvider,
  ImageProviderResult,
  ImageToImageInput,
  TextToImageInput,
} from "./image-provider";
import { SelectedImageModel } from "../image-models/image-model.types";

type ImagePayload = Record<string, unknown>;

type ProviderImage = {
  buffer: Buffer;
  mimeType: string;
  originalName: string;
};

const DEFAULT_APIMART_IMAGE_BASE_URL = "https://api.apimart.ai/v1";
const DEFAULT_IMAGE_SIZE = "1:1";
const DEFAULT_IMAGE_TIMEOUT_MS = 300_000;
const INITIAL_POLL_DELAY_MS = 15_000;
const POLL_INTERVAL_MS = 3_000;
const MAX_DOWNLOAD_REDIRECTS = 5;
const DOWNLOAD_TIMEOUT_MS = 30_000;

@Injectable()
export class ApimartImageProviderService extends ImageProvider {
  private readonly logger = new Logger(ApimartImageProviderService.name);

  constructor(private readonly configService: ConfigService) {
    super();
  }

  getProviderName(imageModel?: SelectedImageModel) {
    return `apimart-image/${this.getModelName(imageModel?.providerModel)}`;
  }

  async generateFromText(input: TextToImageInput): Promise<ImageProviderResult> {
    return this.generate({
      projectId: input.projectId,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      modelId: input.imageModel?.id,
      providerModel: input.imageModel?.providerModel,
      size: input.size ?? input.imageModel?.defaultSize,
      quality: input.quality,
    });
  }

  async editFromImage(input: ImageToImageInput): Promise<ImageProviderResult> {
    const sourceBuffer = await readFile(input.sourceFilePath);
    const sourceDataUrl = `data:${input.sourceMimeType};base64,${sourceBuffer.toString("base64")}`;

    return this.generate({
      projectId: input.projectId,
      prompt: input.prompt,
      negativePrompt: input.negativePrompt,
      referenceImageDataUrl: sourceDataUrl,
      modelId: input.imageModel?.id,
      providerModel: input.imageModel?.providerModel,
      size: input.size ?? input.imageModel?.defaultSize,
      quality: input.quality,
    });
  }

  private async generate(input: {
    projectId: string;
    prompt: string;
    negativePrompt?: string;
    referenceImageDataUrl?: string;
    modelId?: string;
    providerModel?: string;
    size?: string;
    quality?: string;
  }): Promise<ImageProviderResult> {
    const apiKey = this.configService.get<string>("APIMART_API_KEY")?.trim();

    if (!apiKey) {
      throw new Error("APIMART_API_KEY is not configured for image generation.");
    }

    const endpoint = `${this.getBaseUrl()}/images/generations`;
    const startedAt = Date.now();
    const providerModel = this.getModelName(input.providerModel);
    const requestedImageSize = this.getImageSize(input.size);
    const payload: ImagePayload = {
      model: providerModel,
      prompt: input.prompt,
      n: 1,
      size: requestedImageSize,
    };

    if (input.negativePrompt?.trim()) {
      payload.negative_prompt = input.negativePrompt.trim();
    }

    if (input.quality?.trim()) {
      payload.quality = input.quality.trim();
    }

    if (input.referenceImageDataUrl) {
      payload.image_urls = [input.referenceImageDataUrl];
    }

    const requestContext = {
      provider: "apimart",
      modelId: input.modelId ?? input.providerModel ?? providerModel,
      providerModel,
      projectId: input.projectId,
      hasPrompt: Boolean(input.prompt.trim()),
      referenceImageCount: input.referenceImageDataUrl ? 1 : 0,
      requestedSize: requestedImageSize,
    };

    console.log("[image-generation-request]", requestContext);

    const responsePayload = await this.postImageGeneration(
      endpoint,
      apiKey,
      payload,
      requestContext,
    );
    const providerImage = await this.resolveProviderImage(
      responsePayload,
      apiKey,
      startedAt,
      this.getImageTimeoutMs(),
    );
    const dimensions = imageSize(providerImage.buffer);

    if (!dimensions.width || !dimensions.height) {
      throw new Error("APIMart image result was downloaded, but image dimensions could not be read.");
    }

    return {
      imageBuffer: providerImage.buffer,
      mimeType: providerImage.mimeType,
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: providerImage.buffer.byteLength,
      originalName: providerImage.originalName,
    };
  }

  private async postImageGeneration(
    endpoint: string,
    apiKey: string,
    payload: ImagePayload,
    context: {
      provider: string;
      modelId: string;
      providerModel: string;
      projectId: string;
    },
  ) {
    let response: Response;

    try {
      response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify(payload),
      });
    } catch (error) {
      console.error("[image-generation-error]", {
        ...context,
        errorMessage: this.formatError(error),
      });
      throw error;
    }

    const responseText = await response.text();

    if (!response.ok) {
      const responseBody = responseText.slice(0, 500);

      console.error("[image-generation-error]", {
        ...context,
        status: response.status,
        responseBody,
        errorMessage: responseBody || "Unknown APIMart image provider error.",
      });
      this.logger.error(
        `APIMart image provider failed. modelId=${context.modelId} providerModel=${context.providerModel} status=${response.status} message=${responseBody}`,
      );
      throw new Error(
        `APIMart image request failed with status ${response.status}: ${
          responseText || "Unknown error"
        }`,
      );
    }

    const responsePayload = this.parseJson(responseText, "APIMart image generation response");

    this.logger.log(
      `APIMart image create response summary: ${this.summarizePayload(responsePayload)}`,
    );

    return responsePayload;
  }

  private async resolveProviderImage(
    payload: unknown,
    apiKey: string,
    startedAt: number,
    timeoutMs: number,
  ): Promise<ProviderImage> {
    const directImage = this.extractImageFromPayload(payload);

    if (directImage) {
      return this.materializeProviderImage(directImage);
    }

    const taskId = this.extractTaskId(payload);

    if (!taskId) {
      throw new Error("APIMart image response did not include an image URL, base64 image, or task id.");
    }

    this.logger.log(`APIMart image task id parsed: ${taskId}`);

    return this.pollTask(taskId, apiKey, startedAt, timeoutMs);
  }

  private async pollTask(taskId: string, apiKey: string, startedAt: number, timeoutMs: number) {
    const taskEndpoint = `${this.getBaseUrl()}/tasks/${encodeURIComponent(taskId)}`;
    let nextDelayMs = INITIAL_POLL_DELAY_MS;

    while (Date.now() - startedAt < timeoutMs) {
      await this.delay(nextDelayMs);
      nextDelayMs = POLL_INTERVAL_MS;

      const response = await fetch(taskEndpoint, {
        method: "GET",
        headers: {
          Authorization: `Bearer ${apiKey}`,
        },
      });
      const responseText = await response.text();

      if (!response.ok) {
        this.logger.error(
          `APIMart image task polling failed. status=${response.status} message=${responseText}`,
        );
        throw new Error(
          `APIMart image task polling failed with status ${response.status}: ${
            responseText || "Unknown error"
          }`,
        );
      }

      const payload = this.parseJson(responseText, "APIMart image task response");
      const status = this.extractStatus(payload);

      this.logger.log(
        `APIMart image task polling. taskId=${taskId} status=${status ?? "unknown"}`,
      );

      if (status === "completed") {
        const imageUrl = this.extractCompletedImageUrl(payload);

        if (!imageUrl) {
          throw new Error(
            `APIMart image task completed but data.result.images[0].url[0] was not found. response=${this.summarizePayload(
              payload,
            )}`,
          );
        }

        this.logger.log(
          `APIMart image task completed. taskId=${taskId} finalImageUrl=${imageUrl}`,
        );

        return this.downloadImage(imageUrl);
      }

      if (status && ["failed", "error", "canceled", "cancelled"].includes(status)) {
        const message = this.extractMessage(payload) || "APIMart image task failed.";
        this.logger.error(
          `APIMart image task failed. taskId=${taskId} status=${status} message=${message} response=${this.stringifyProviderError(
            payload,
          )}`,
        );
        throw new Error(`APIMart image task failed with status ${status}: ${message}`);
      }

      const image = this.extractImageFromPayload(payload);

      if (image && !status) {
        return this.materializeProviderImage(image);
      }
    }

    throw new Error(`APIMart image task timed out after ${timeoutMs / 1000} seconds.`);
  }

  private async materializeProviderImage(image: {
    url?: string;
    base64?: string;
  }): Promise<ProviderImage> {
    if (image.base64) {
      const parsed = this.parseBase64Image(image.base64);

      return {
        buffer: parsed.buffer,
        mimeType: parsed.mimeType,
        originalName: `apimart-output.${this.extensionFromMimeType(parsed.mimeType)}`,
      };
    }

    if (!image.url) {
      throw new Error("APIMart image result did not include a downloadable URL.");
    }

    return this.downloadImage(image.url);
  }

  private async downloadImage(url: string): Promise<ProviderImage> {
    this.logger.log(`APIMart image download started. imageUrl=${url}`);

    try {
      return await this.downloadImageWithFetch(url);
    } catch (error) {
      const cause = this.formatError(error);

      this.logger.warn(
        `APIMart image fetch download failed. imageUrl=${url} cause=${cause}. Falling back to node http client.`,
      );
    }

    return this.downloadImageWithNodeHttp(url);
  }

  private async downloadImageWithFetch(url: string): Promise<ProviderImage> {
    const response = await fetch(url);
    this.logger.log(`APIMart image fetch download status=${response.status} imageUrl=${url}`);

    if (!response.ok) {
      const responseText = await response.text();

      throw new Error(
        `fetch returned status ${response.status}: ${responseText || "Unknown error"}`,
      );
    }

    const arrayBuffer = await response.arrayBuffer();
    const contentType = response.headers.get("content-type")?.split(";")[0] || "image/png";
    const extension = this.extensionFromMimeType(contentType);
    const buffer = Buffer.from(arrayBuffer);

    this.logger.log(
      `APIMart image fetch download completed. imageUrl=${url} sizeBytes=${buffer.byteLength} mimeType=${contentType}`,
    );

    return {
      buffer,
      mimeType: contentType,
      originalName: `apimart-output.${extension}`,
    };
  }

  private downloadImageWithNodeHttp(
    url: string,
    redirectCount = 0,
  ): Promise<ProviderImage> {
    return new Promise((resolve, reject) => {
      let parsedUrl: URL;

      try {
        parsedUrl = new URL(url);
      } catch (error) {
        reject(new Error(`Invalid image URL: ${this.formatError(error)}`));

        return;
      }

      const client = parsedUrl.protocol === "http:" ? httpGet : httpsGet;
      const request = client(parsedUrl, (response) => {
        const statusCode = response.statusCode ?? 0;

        this.logger.log(
          `APIMart image node download status=${statusCode} imageUrl=${url}`,
        );

        const location = response.headers.location;

        if (
          [301, 302, 303, 307, 308].includes(statusCode) &&
          location &&
          redirectCount < MAX_DOWNLOAD_REDIRECTS
        ) {
          response.resume();
          const nextUrl = new URL(location, parsedUrl).toString();

          this.downloadImageWithNodeHttp(nextUrl, redirectCount + 1)
            .then(resolve)
            .catch(reject);

          return;
        }

        if (statusCode < 200 || statusCode >= 300) {
          this.collectResponseText(response)
            .then((body) => {
              const cause = `node http returned status ${statusCode}: ${
                body || "Unknown error"
              }`;

              this.logger.error(
                `APIMart image node download failed. imageUrl=${url} cause=${cause}`,
              );
              reject(new Error(cause));
            })
            .catch((error: unknown) => reject(error));

          return;
        }

        const chunks: Buffer[] = [];

        response.on("data", (chunk: Buffer | string) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });

        response.on("end", () => {
          const buffer = Buffer.concat(chunks);
          const contentTypeHeader = response.headers["content-type"];
          const contentType = Array.isArray(contentTypeHeader)
            ? contentTypeHeader[0]
            : contentTypeHeader;
          const mimeType = contentType?.split(";")[0] || "image/png";
          const extension = this.extensionFromMimeType(mimeType);

          this.logger.log(
            `APIMart image node download completed. imageUrl=${url} sizeBytes=${buffer.byteLength} mimeType=${mimeType}`,
          );

          resolve({
            buffer,
            mimeType,
            originalName: `apimart-output.${extension}`,
          });
        });
      });

      request.setTimeout(DOWNLOAD_TIMEOUT_MS, () => {
        request.destroy(
          new Error(`node http download timed out after ${DOWNLOAD_TIMEOUT_MS / 1000} seconds`),
        );
      });

      request.on("error", (error) => {
        const cause = this.formatError(error);

        this.logger.error(
          `APIMart image node download failed. imageUrl=${url} cause=${cause}`,
        );
        reject(new Error(cause));
      });

      request.end();
    });
  }

  private collectResponseText(response: NodeJS.ReadableStream) {
    return new Promise<string>((resolve, reject) => {
      const chunks: Buffer[] = [];

      response.on("data", (chunk: Buffer | string) => {
        chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
      });
      response.on("end", () => resolve(Buffer.concat(chunks).toString("utf8")));
      response.on("error", reject);
    });
  }

  private extractImageFromPayload(payload: unknown): { url?: string; base64?: string } | null {
    const apimartResultImage = this.extractApimartResultImage(payload);

    if (apimartResultImage) {
      return apimartResultImage;
    }

    const candidates = this.flattenPayloadCandidates(payload);

    for (const candidate of candidates) {
      if (typeof candidate === "string") {
        if (/^https?:\/\//i.test(candidate)) {
          return { url: candidate };
        }

        if (/^data:image\//i.test(candidate)) {
          return { base64: candidate };
        }
      }

      const record = this.toRecord(candidate);

      if (!record) {
        continue;
      }

      const base64 = this.getString(record, [
        "b64_json",
        "base64",
        "image_base64",
        "imageBase64",
        "b64",
      ]);
      const url = this.getString(record, [
        "url",
        "image_url",
        "imageUrl",
        "image",
        "output_url",
        "outputUrl",
      ]);

      if (base64) {
        return { base64 };
      }

      if (url && /^https?:\/\//i.test(url)) {
        return { url };
      }

      if (url && /^data:image\//i.test(url)) {
        return { base64: url };
      }
    }

    return null;
  }

  private flattenPayloadCandidates(payload: unknown): unknown[] {
    const record = this.toRecord(payload);

    if (!record) {
      return [];
    }

    const candidates: unknown[] = [record];

    for (const key of [
      "data",
      "output",
      "outputs",
      "result",
      "results",
      "image",
      "images",
      "image_urls",
      "imageUrls",
      "urls",
      "items",
    ]) {
      const value = record[key];

      if (Array.isArray(value)) {
        candidates.push(...value);
      } else if (value && typeof value === "object") {
        candidates.push(value);
      }
    }

    return candidates;
  }

  private extractTaskId(payload: unknown) {
    const record = this.toRecord(payload);

    if (!record) {
      return null;
    }

    const arrayDataTaskId = this.getFirstArrayRecord(record.data, ["task_id", "taskId", "id"]);

    if (arrayDataTaskId) {
      return arrayDataTaskId;
    }

    const data = this.toRecord(record.data);
    const dataTaskId = data ? this.getString(data, ["task_id", "taskId", "id"]) : null;

    if (dataTaskId) {
      return dataTaskId;
    }

    const directTaskId = this.getString(record, ["task_id", "taskId", "id"]);

    if (directTaskId) {
      return directTaskId;
    }

    return null;
  }

  private extractStatus(payload: unknown) {
    const record = this.toRecord(payload);

    if (!record) {
      return null;
    }

    const data = this.toRecord(record.data);
    const dataStatus = data ? this.getString(data, ["status", "state"]) : null;

    return (dataStatus ?? this.getString(record, ["status", "state"]))?.toLowerCase() ?? null;
  }

  private extractMessage(payload: unknown) {
    const record = this.toRecord(payload);

    if (!record) {
      return null;
    }

    const directError = this.toRecord(record.error);
    const directMessage =
      directError && this.getString(directError, ["message", "error", "detail"]);

    if (directMessage) {
      return directMessage;
    }

    const data = this.toRecord(record.data);
    const dataError = this.toRecord(data?.error);
    const dataMessage =
      dataError && this.getString(dataError, ["message", "error", "detail"]);

    if (dataMessage) {
      return dataMessage;
    }

    const dataErrorText = data && this.getString(data, ["error", "message", "errorMessage"]);

    if (dataErrorText) {
      return dataErrorText;
    }

    return this.getString(record, ["message", "error", "errorMessage", "detail"]);
  }

  private extractCompletedImageUrl(payload: unknown) {
    const record = this.toRecord(payload);
    const data = this.toRecord(record?.data);
    const result = this.toRecord(data?.result);
    const images = Array.isArray(result?.images) ? result.images : null;
    const firstImage = images?.[0];
    const firstImageRecord = this.toRecord(firstImage);
    const urlValue = firstImageRecord?.url;

    if (!Array.isArray(urlValue)) {
      return null;
    }

    const firstUrl = urlValue[0];

    return typeof firstUrl === "string" && /^https?:\/\//i.test(firstUrl) ? firstUrl : null;
  }

  private extractApimartResultImage(payload: unknown): { url?: string; base64?: string } | null {
    const imageUrl = this.extractCompletedImageUrl(payload);

    return imageUrl ? { url: imageUrl } : null;
  }

  private parseBase64Image(value: string) {
    const dataUrlMatch = value.match(/^data:(image\/[a-zA-Z0-9.+-]+);base64,(.+)$/);

    if (dataUrlMatch?.[1] && dataUrlMatch?.[2]) {
      return {
        mimeType: dataUrlMatch[1],
        buffer: Buffer.from(dataUrlMatch[2], "base64"),
      };
    }

    return {
      mimeType: "image/png",
      buffer: Buffer.from(value, "base64"),
    };
  }

  private parseJson(value: string, label: string) {
    try {
      return JSON.parse(value) as unknown;
    } catch {
      throw new Error(`${label} was not valid JSON.`);
    }
  }

  private getModelName(providerModel?: string) {
    return (
      providerModel?.trim() ||
      this.configService.get<string>("APIMART_IMAGE_MODEL")?.trim() ||
      "gpt-image-2"
    );
  }

  private getBaseUrl() {
    const baseUrl =
      this.configService.get<string>("APIMART_IMAGE_BASE_URL")?.trim() ||
      DEFAULT_APIMART_IMAGE_BASE_URL;

    return baseUrl.replace(/\/+$/, "");
  }

  private getImageSize(size?: string) {
    return size?.trim() || this.configService.get<string>("APIMART_IMAGE_SIZE")?.trim() || DEFAULT_IMAGE_SIZE;
  }

  private getImageTimeoutMs() {
    const timeoutSeconds = Number(
      this.configService.get<string>("APIMART_IMAGE_TIMEOUT_SECONDS")?.trim(),
    );

    return Number.isFinite(timeoutSeconds) && timeoutSeconds > 0
      ? timeoutSeconds * 1000
      : DEFAULT_IMAGE_TIMEOUT_MS;
  }

  private extensionFromMimeType(mimeType: string) {
    switch (mimeType) {
      case "image/jpeg":
      case "image/jpg":
        return "jpg";
      case "image/webp":
        return "webp";
      case "image/svg+xml":
        return "svg";
      case "image/png":
      default:
        return "png";
    }
  }

  private getString(record: Record<string, unknown>, keys: string[]) {
    for (const key of keys) {
      const value = record[key];

      if (typeof value === "string" && value.trim()) {
        return value.trim();
      }
    }

    return null;
  }

  private getFirstArrayRecord(value: unknown, keys: string[]) {
    if (!Array.isArray(value)) {
      return null;
    }

    for (const item of value) {
      const record = this.toRecord(item);
      const matched = record ? this.getString(record, keys) : null;

      if (matched) {
        return matched;
      }
    }

    return null;
  }

  private summarizePayload(value: unknown) {
    return JSON.stringify(this.redactForLog(value));
  }

  private stringifyProviderError(value: unknown) {
    return JSON.stringify(this.redactImagesOnly(value));
  }

  private redactForLog(value: unknown): unknown {
    if (typeof value === "string") {
      if (/^data:image\//i.test(value)) {
        return `[data-image:${value.length} chars]`;
      }

      if (value.length > 220) {
        return `${value.slice(0, 220)}...`;
      }

      return value;
    }

    if (Array.isArray(value)) {
      return value.slice(0, 3).map((item) => this.redactForLog(item));
    }

    const record = this.toRecord(value);

    if (!record) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, entryValue]) => [key, this.redactForLog(entryValue)]),
    );
  }

  private redactImagesOnly(value: unknown): unknown {
    if (typeof value === "string") {
      return /^data:image\//i.test(value) ? `[data-image:${value.length} chars]` : value;
    }

    if (Array.isArray(value)) {
      return value.map((item) => this.redactImagesOnly(item));
    }

    const record = this.toRecord(value);

    if (!record) {
      return value;
    }

    return Object.fromEntries(
      Object.entries(record).map(([key, entryValue]) => [key, this.redactImagesOnly(entryValue)]),
    );
  }

  private maskUrlForLog(url: string) {
    try {
      const parsedUrl = new URL(url);

      return `${parsedUrl.origin}${parsedUrl.pathname}`;
    } catch {
      return url.slice(0, 160);
    }
  }

  private formatError(error: unknown) {
    return error instanceof Error ? error.message : String(error);
  }

  private toRecord(value: unknown): Record<string, unknown> | null {
    return value && typeof value === "object" && !Array.isArray(value)
      ? (value as Record<string, unknown>)
      : null;
  }

  private delay(ms: number) {
    return new Promise((resolve) => setTimeout(resolve, ms));
  }
}
