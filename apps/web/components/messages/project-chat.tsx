"use client";

import { ChangeEvent, useEffect, useMemo, useRef, useState } from "react";
import {
  AlertCircle,
  Clock3,
  Download,
  FileText,
  History,
  ImageIcon,
  LoaderCircle,
  Maximize2,
  MessageSquare,
  Send,
  Sparkles,
  UploadCloud,
  X,
} from "lucide-react";

import { ImagePreviewDialog } from "@/components/image-preview-dialog";
import type { UpscaleTargetResolution } from "@/components/image-upscale-panel";
import { ModelSelector } from "@/components/model-selector";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { requestApi, resolveAssetUrl } from "@/lib/api";
import type {
  Asset,
  GenerationTask,
  ImageModel,
  Message,
  Project,
  UploadedAsset,
  Version,
} from "@/lib/types";

type ProjectChatProps = {
  initialMessages: Message[];
  initialVersions: Version[];
  imageModels: ImageModel[];
  project: Project;
  projectId: string;
};

type PreviewAsset = {
  id: string;
  fileUrl: string;
  mimeType: string;
  width: number;
  height: number;
  sizeBytes: number;
};

type GenerationRequestDraft = {
  projectId: string;
  messageText: string;
  sourceAssetId: string | null;
  baseVersionId: string | null;
  modelId: string;
  size: string;
};

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_FILE_TYPES = new Set(["image/png", "image/jpg", "image/jpeg", "image/webp"]);
const IMAGE_GENERATION_TIMEOUT_SECONDS = 300;

function formatDateTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatShortTime(value: string) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function formatTaskLabel(status: GenerationTask["status"]) {
  switch (status) {
    case "pending":
      return "等待中";
    case "running":
      return "生成中";
    case "success":
      return "成功";
    case "failed":
      return "失败";
    default:
      return status;
  }
}

function formatTaskTone(status?: GenerationTask["status"]) {
  switch (status) {
    case "pending":
    case "running":
      return "border-amber-200 bg-amber-50 text-amber-700";
    case "success":
      return "border-emerald-200 bg-emerald-50 text-emerald-700";
    case "failed":
      return "border-red-200 bg-red-50 text-red-700";
    default:
      return "border-border bg-white text-muted-foreground";
  }
}

function getRoleLabel(role: Message["role"]) {
  switch (role) {
    case "user":
      return "用户";
    case "assistant":
      return "助手";
    case "system":
      return "系统";
    default:
      return role;
  }
}

function toPreviewAsset(asset: UploadedAsset | Asset): PreviewAsset {
  return {
    id: "assetId" in asset ? asset.assetId : asset.id,
    fileUrl: asset.fileUrl,
    mimeType: asset.mimeType,
    width: asset.width,
    height: asset.height,
    sizeBytes: asset.sizeBytes,
  };
}

function findLatestMessageAttachment(messages: Message[]) {
  for (let index = messages.length - 1; index >= 0; index -= 1) {
    const attachment = messages[index]?.attachmentAsset;
    if (attachment) {
      return toPreviewAsset(attachment);
    }
  }

  return null;
}

function getModelDisplayName(model: ImageModel | null) {
  if (!model) {
    return "未选择模型";
  }

  if (model.id === "gpt-image-2" || model.id === "apimart-gpt-image-2") {
    return "GPT Image 2";
  }

  return model.name || model.displayName;
}

function getShortError(error: unknown, fallback: string) {
  return error instanceof Error ? error.message : fallback;
}

function isTimeoutFailure(task: GenerationTask | null) {
  if (task?.status !== "failed") {
    return false;
  }

  const errorMessage = task.errorMessage?.toLowerCase() ?? "";

  return (
    errorMessage.includes("timed out") ||
    errorMessage.includes("timeout") ||
    errorMessage.includes("超时")
  );
}

function getGenerationFailureMessage(task: GenerationTask | null) {
  if (isTimeoutFailure(task)) {
    return `生成超时：当前模型超过 ${IMAGE_GENERATION_TIMEOUT_SECONDS} 秒仍未返回结果。`;
  }

  return "生成失败，请稍后重试。";
}

function getSafeTaskErrorMessage(task: GenerationTask | null, fallback: string) {
  const message = task?.errorMessage?.trim();

  if (!message || /<html|<!doctype/i.test(message)) {
    return fallback;
  }

  return message.length > 120 ? fallback : message;
}

function getVersionStatus(version: Version) {
  return version.generationTask?.status ?? "success";
}

function getVersionStatusLabel(version: Version) {
  return formatTaskLabel(getVersionStatus(version));
}

function getDownloadFileName(projectId: string, version: Version) {
  const mimeType = version.outputAsset.mimeType.toLowerCase();
  const extension = mimeType.includes("jpeg")
    ? "jpg"
    : mimeType.includes("webp")
      ? "webp"
      : "png";

  return `zerrt-ai-${projectId}-${version.id}.${extension}`;
}

function getVersionResolutionBadge(version: Version) {
  const payload = version.generationTask?.structuredPayloadJson;
  const generationType = payload?.generationType;
  const targetResolution = payload?.targetResolution;

  if (generationType === "upscale" && typeof targetResolution === "string") {
    return getUpscaleTargetLabel(targetResolution);
  }

  return null;
}

function getOriginalPrompt(version: Version, fallbackPrompt?: string) {
  return version.generationTask?.promptText ?? fallbackPrompt ?? version.changeSummary ?? "";
}

function getUpscaleTargetLabel(targetResolution: string) {
  return targetResolution === "4K" ? "4K 细节重绘" : "2K 高清重绘";
}

function getVersionActualSize(version: Version) {
  return `${version.outputAsset.width} × ${version.outputAsset.height}`;
}

function didReachTargetPixels(version: Version) {
  const payload = version.generationTask?.structuredPayloadJson;
  const targetResolution = payload?.targetResolution;

  if (targetResolution !== "2K" && targetResolution !== "4K") {
    return null;
  }

  const longestEdge = Math.max(version.outputAsset.width, version.outputAsset.height);
  const requiredLongestEdge = targetResolution === "4K" ? 3840 : 2048;

  return longestEdge >= requiredLongestEdge;
}

export function ProjectChat({
  initialMessages,
  initialVersions,
  imageModels,
  project,
  projectId,
}: ProjectChatProps) {
  const defaultImageModel =
    imageModels.find((model) => model.id === "gpt-image-2") ??
    imageModels.find((model) => model.id === "apimart-gpt-image-2") ??
    imageModels[0] ??
    null;
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [messages, setMessages] = useState(initialMessages ?? []);
  const [versions, setVersions] = useState(initialVersions ?? []);
  const [content, setContent] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [isUploading, setIsUploading] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [pendingAsset, setPendingAsset] = useState<UploadedAsset | null>(null);
  const [currentTask, setCurrentTask] = useState<GenerationTask | null>(null);
  const [lastGenerationRequest, setLastGenerationRequest] =
    useState<GenerationRequestDraft | null>(null);
  const [selectedImageModelId, setSelectedImageModelId] = useState(defaultImageModel?.id ?? "");
  const [selectedSize, setSelectedSize] = useState(defaultImageModel?.defaultSize ?? "1:1");
  const [previewVersion, setPreviewVersion] = useState<Version | null>(null);
  const [upscalingVersionId, setUpscalingVersionId] = useState<string | null>(null);
  const [upscaleError, setUpscaleError] = useState<string | null>(null);

  const hasMessages = messages.length > 0;
  const hasVersions = versions.length > 0;
  const latestVersion = versions[0] ?? null;
  const currentVersionForIteration = currentTask?.generatedVersion ?? latestVersion;
  const iterationSourceAsset = currentVersionForIteration?.outputAsset ?? null;
  const isImageToImage = Boolean(pendingAsset || iterationSourceAsset);
  const compatibleImageModels = useMemo(
    () =>
      imageModels.filter((model) =>
        isImageToImage ? model.supportsImageToImage : model.supportsTextToImage,
      ),
    [imageModels, isImageToImage],
  );
  const selectedImageModel =
    imageModels.find((model) => model.id === selectedImageModelId) ?? defaultImageModel;
  const latestReferenceAsset = useMemo(
    () =>
      pendingAsset
        ? toPreviewAsset(pendingAsset)
        : iterationSourceAsset
          ? toPreviewAsset(iterationSourceAsset)
          : findLatestMessageAttachment(messages),
    [messages, pendingAsset, iterationSourceAsset],
  );
  const latestOutputAsset =
    currentTask?.generatedVersion?.outputAsset ?? latestVersion?.outputAsset ?? null;
  const currentPreviewVersion = currentTask?.generatedVersion ?? latestVersion;
  const generationStatus = currentTask ? formatTaskLabel(currentTask.status) : "待生成";
  const statusTone = formatTaskTone(currentTask?.status);
  const currentTaskTimedOut = isTimeoutFailure(currentTask);

  useEffect(() => {
    if (!selectedImageModel) {
      return;
    }

    if (!selectedImageModel.allowedSizes.includes(selectedSize)) {
      setSelectedSize(selectedImageModel.defaultSize);
    }
  }, [selectedImageModel, selectedSize]);

  useEffect(() => {
    if (!compatibleImageModels.length) {
      return;
    }

    const selectedModelIsCompatible = compatibleImageModels.some(
      (model) => model.id === selectedImageModelId,
    );

    if (!selectedModelIsCompatible) {
      const preferredModel =
        compatibleImageModels.find((model) => model.id === "gpt-image-2") ??
        compatibleImageModels.find((model) => model.id === "apimart-gpt-image-2") ??
        compatibleImageModels[0];
      setSelectedImageModelId(preferredModel.id);
      setSelectedSize(preferredModel.defaultSize);
    }
  }, [compatibleImageModels, selectedImageModelId]);

  async function refreshWorkspaceData() {
    const [nextMessages, nextVersions] = await Promise.all([
      requestApi<Message[]>(`/projects/${projectId}/messages`),
      requestApi<Version[]>(`/projects/${projectId}/versions`),
    ]);

    setMessages(nextMessages);
    setVersions(nextVersions);
  }

  useEffect(() => {
    if (!currentTask || currentTask.status === "success" || currentTask.status === "failed") {
      return;
    }

    let cancelled = false;
    const timeout = window.setTimeout(async () => {
      try {
        const nextTask = await requestApi<GenerationTask>(`/tasks/${currentTask.id}`);

        if (cancelled) {
          return;
        }

        setCurrentTask(nextTask);

        if (nextTask.status === "success" || nextTask.status === "failed") {
          setIsGenerating(false);
          await refreshWorkspaceData();
        }
      } catch (taskError) {
        if (cancelled) {
          return;
        }

        setError(getShortError(taskError, "刷新生成状态失败，请稍后重试。"));
        setIsGenerating(false);
      }
    }, 1200);

    return () => {
      cancelled = true;
      window.clearTimeout(timeout);
    };
  }, [currentTask, projectId]);

  async function handleFileChange(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];

    if (!file) {
      return;
    }

    if (!SUPPORTED_FILE_TYPES.has(file.type)) {
      setError("上传失败，请检查图片格式。");
      event.target.value = "";
      return;
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      setError("图片过大，当前最多支持 10MB。");
      event.target.value = "";
      return;
    }

    try {
      setError(null);
      setIsUploading(true);

      const formData = new FormData();
      formData.append("projectId", projectId);
      formData.append("file", file);

      const uploadedAsset = await requestApi<UploadedAsset>("/upload", {
        method: "POST",
        body: formData,
      });
      setPendingAsset(uploadedAsset);
    } catch (uploadError) {
      setError(getShortError(uploadError, "上传失败，请稍后重试。"));
    } finally {
      setIsUploading(false);
      event.target.value = "";
    }
  }

  function clearPendingAsset() {
    setPendingAsset(null);
    if (inputRef.current) {
      inputRef.current.value = "";
    }
  }

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    if (!content.trim() && !pendingAsset?.assetId) {
      setError("请输入备注内容或上传参考图。");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const message = await requestApi<Message>(`/projects/${projectId}/messages`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          role: "user",
          content,
          attachmentAssetId: pendingAsset?.assetId,
        }),
      });
      setMessages((current) => [...current, message]);
      setContent("");
      clearPendingAsset();
    } catch (submitError) {
      setError(getShortError(submitError, "保存备注失败，请稍后重试。"));
    } finally {
      setIsSubmitting(false);
    }
  }

  async function handleGenerate() {
    if (!content.trim()) {
      setError("请输入创作指令。");
      return;
    }

    if (!selectedImageModel) {
      setError("暂无可用的生图模型，请检查后端模型注册接口。");
      return;
    }

    const sourceAssetIdForGeneration = pendingAsset?.assetId ?? iterationSourceAsset?.id ?? null;
    const baseVersionIdForGeneration = pendingAsset ? null : currentVersionForIteration?.id ?? null;

    if (!sourceAssetIdForGeneration && !selectedImageModel.supportsTextToImage) {
      setError(`模型「${getModelDisplayName(selectedImageModel)}」不支持文生图。`);
      return;
    }

    if (sourceAssetIdForGeneration && !selectedImageModel.supportsImageToImage) {
      setError(`模型「${getModelDisplayName(selectedImageModel)}」不支持图生图。`);
      return;
    }

    if (!selectedImageModel.allowedSizes.includes(selectedSize)) {
      setError(`模型「${getModelDisplayName(selectedImageModel)}」不支持当前图片比例。`);
      return;
    }

    const optimisticMessage: Message = {
      id: `optimistic-${Date.now()}`,
      conversationId: messages[0]?.conversationId ?? "pending",
      role: "user",
      content,
      attachmentAssetId: pendingAsset?.assetId ?? null,
      attachmentAsset: pendingAsset
        ? {
            id: pendingAsset.assetId,
            projectId,
            type: "upload",
            fileUrl: pendingAsset.fileUrl,
            mimeType: pendingAsset.mimeType,
            width: pendingAsset.width,
            height: pendingAsset.height,
            sizeBytes: pendingAsset.sizeBytes,
            createdAt: new Date().toISOString(),
          }
        : null,
      createdAt: new Date().toISOString(),
    };

    try {
      setError(null);
      setIsGenerating(true);

      const generationRequest: GenerationRequestDraft = {
        projectId,
        messageText: content,
        sourceAssetId: sourceAssetIdForGeneration,
        baseVersionId: baseVersionIdForGeneration,
        modelId: selectedImageModel.id,
        size: selectedSize,
      };
      setLastGenerationRequest(generationRequest);

      console.log("[generate-request]", {
        modelId: selectedImageModel.id,
        promptLength: content.trim().length,
        aspectRatio: selectedSize,
        sourceAssetId: sourceAssetIdForGeneration,
        baseVersionId: baseVersionIdForGeneration,
      });

      const task = await requestApi<GenerationTask>("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          ...generationRequest,
        }),
      });
      setCurrentTask(task);
      setMessages((current) => [...current, optimisticMessage]);
      setContent("");
      clearPendingAsset();
    } catch (generationError) {
      setError(getShortError(generationError, "生成失败，请稍后重试。"));
      setIsGenerating(false);
    }
  }

  async function handleRetryGeneration() {
    const retryRequest =
      lastGenerationRequest ??
      (currentTask
        ? {
            projectId,
            messageText: currentTask.promptText,
            sourceAssetId: currentTask.sourceAssetId,
            baseVersionId: currentTask.baseVersionId,
            modelId: selectedImageModel?.id ?? "gpt-image-2",
            size: selectedSize,
          }
        : null);

    if (!retryRequest) {
      setError("未找到可重新生成的任务参数，请重新输入创作指令。");
      return;
    }

    const nextRequest: GenerationRequestDraft = {
      ...retryRequest,
      modelId: selectedImageModel?.id ?? retryRequest.modelId,
      size: selectedSize || retryRequest.size,
    };

    try {
      setError(null);
      setIsGenerating(true);
      setLastGenerationRequest(nextRequest);

      console.log("[generate-retry-request]", {
        modelId: nextRequest.modelId,
        promptLength: nextRequest.messageText.trim().length,
        aspectRatio: nextRequest.size,
        sourceAssetId: nextRequest.sourceAssetId,
        baseVersionId: nextRequest.baseVersionId,
      });

      const task = await requestApi<GenerationTask>("/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify(nextRequest),
      });

      setCurrentTask(task);
    } catch (retryError) {
      setError(getShortError(retryError, "重新生成失败，请稍后重试。"));
      setIsGenerating(false);
    }
  }

  function handleSwitchModelAfterTimeout() {
    const alternativeModel =
      compatibleImageModels.find(
        (model) => model.id !== selectedImageModelId && model.id === "gpt-image-2",
      ) ??
      compatibleImageModels.find((model) => model.id !== selectedImageModelId) ??
      null;

    if (!alternativeModel) {
      setError("暂无其他可切换模型，请稍后重试或取消本次生成。");
      return;
    }

    setSelectedImageModelId(alternativeModel.id);
    setSelectedSize(alternativeModel.defaultSize);
    setError(`已切换到 ${getModelDisplayName(alternativeModel)}，可以点击「重新生成」。`);
  }

  function handleCancelTimedOutTask() {
    setCurrentTask(null);
    setIsGenerating(false);
    setError(null);
  }

  async function handleUpscaleVersion(
    version: Version,
    targetResolution: UpscaleTargetResolution,
  ) {
    if (!version.outputAsset?.fileUrl) {
      setUpscaleError("未找到可放大的原图。");
      return;
    }

    try {
      setError(null);
      setUpscaleError(null);
      setIsGenerating(true);
      setUpscalingVersionId(version.id);

      const payload = {
        projectId,
        versionId: version.id,
        targetResolution,
        sourceImageUrl: version.outputAsset.fileUrl,
        originalPrompt: getOriginalPrompt(version, currentTask?.promptText),
        modelId: "nano-banana-pro",
      };

      console.log("[upscale-request]", {
        projectId,
        versionId: version.id,
        targetResolution,
        modelId: payload.modelId,
        sourceImageUrlExists: Boolean(payload.sourceImageUrl),
        promptLength: payload.originalPrompt.length,
      });

      const task = await requestApi<GenerationTask>(
        `/projects/${projectId}/versions/${version.id}/upscale`,
        {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
          },
          body: JSON.stringify(payload),
        },
      );

      setCurrentTask(task);
    } catch (upscaleRequestError) {
      const message = getShortError(upscaleRequestError, "高清放大失败，请稍后重试。");
      setUpscaleError(message);
      setError(message);
      setIsGenerating(false);
    } finally {
      setUpscalingVersionId(null);
    }
  }

  return (
    <>
    <section className="grid min-h-[calc(100vh-112px)] gap-5 lg:grid-cols-[320px_minmax(0,1fr)_400px]">
      <aside className="space-y-5">
        <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 text-xs font-medium uppercase tracking-[0.22em] text-muted-foreground">
            Project
          </div>
          <h1 className="text-2xl font-semibold leading-tight tracking-[-0.03em]">
            {project.title}
          </h1>
          <p className="mt-3 text-sm leading-7 text-muted-foreground">
            {project.description ?? "暂未填写项目说明。"}
          </p>
          <div className="mt-5 grid gap-3 border-t border-border pt-4 text-sm">
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">创建时间</span>
              <span className="text-right">{formatDateTime(project.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-3">
              <span className="text-muted-foreground">更新时间</span>
              <span className="text-right">{formatDateTime(project.updatedAt)}</span>
            </div>
          </div>
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between">
            <div className="flex items-center gap-2 font-semibold">
              <History className="h-4 w-4 text-primary" />
              版本记录
            </div>
            <span className="text-xs text-muted-foreground">{versions.length} 个版本</span>
          </div>

          {hasVersions ? (
            <div className="max-h-[calc(100vh-390px)] space-y-3 overflow-auto pr-1">
              {versions.map((version, index) => (
                <div
                  key={version.id}
                  className="rounded-2xl border border-border bg-background/70 p-3"
                >
                  <img
                    src={resolveAssetUrl(version.outputAsset.fileUrl)}
                    alt={`版本 ${version.versionIndex}`}
                    className="aspect-[4/3] w-full cursor-zoom-in rounded-xl object-cover"
                    onClick={() => setPreviewVersion(version)}
                  />
                  <div className="mt-3 flex items-center justify-between gap-2">
                    <div>
                      <div className="font-medium">版本 {version.versionIndex}</div>
                      {getVersionResolutionBadge(version) ? (
                        <div className="mt-1 text-xs text-primary">
                          {getVersionResolutionBadge(version)}
                        </div>
                      ) : null}
                      {didReachTargetPixels(version) === false ? (
                        <div className="mt-1 text-xs text-muted-foreground">
                          实际 {getVersionActualSize(version)}
                        </div>
                      ) : null}
                    </div>
                    <span
                      className={`rounded-full border px-2 py-1 text-xs ${formatTaskTone(
                        getVersionStatus(version),
                      )}`}
                    >
                      {getVersionStatusLabel(version)}
                    </span>
                  </div>
                  <div className="mt-2 flex items-center justify-between gap-2 text-xs text-muted-foreground">
                    <span>{formatShortTime(version.createdAt)}</span>
                    {index === 0 ? <span>当前版本</span> : null}
                  </div>
                  <p className="mt-2 line-clamp-2 text-xs leading-5 text-muted-foreground">
                    {version.changeSummary ?? "暂无版本说明。"}
                  </p>
                  <div className="mt-3 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      onClick={() => setPreviewVersion(version)}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <Maximize2 className="h-3.5 w-3.5" />
                      预览
                    </button>
                    <a
                      href={resolveAssetUrl(version.outputAsset.fileUrl)}
                      download={getDownloadFileName(projectId, version)}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-border bg-white text-xs text-muted-foreground transition hover:bg-secondary hover:text-foreground"
                    >
                      <Download className="h-3.5 w-3.5" />
                      下载
                    </a>
                  </div>
                  <div className="mt-2 grid grid-cols-2 gap-2">
                    <button
                      type="button"
                      disabled={upscalingVersionId === version.id || isGenerating}
                      onClick={() => handleUpscaleVersion(version, "2K")}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      2K 高清重绘
                    </button>
                    <button
                      type="button"
                      disabled={upscalingVersionId === version.id || isGenerating}
                      onClick={() => handleUpscaleVersion(version, "4K")}
                      className="inline-flex h-8 items-center justify-center gap-1 rounded-lg border border-primary/20 bg-primary/5 text-xs text-primary transition hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      4K 细节重绘
                    </button>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/70 p-5 text-sm leading-7 text-muted-foreground">
              暂无版本，点击「开始生成」创建第一版。
            </div>
          )}
        </div>
      </aside>

      <div className="space-y-5">
        <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Preview</div>
              <h2 className="text-xl font-semibold tracking-[-0.02em]">当前生成结果</h2>
            </div>
            <div className={`rounded-full border px-3 py-1 text-sm ${statusTone}`}>
              {generationStatus}
            </div>
          </div>

          <div className="relative flex min-h-[540px] items-center justify-center overflow-hidden rounded-3xl border border-border bg-[#f6f5f2] shadow-inner">
            {latestOutputAsset ? (
              <img
                src={resolveAssetUrl(latestOutputAsset.fileUrl)}
                alt="当前生成结果"
                className="max-h-[700px] w-full cursor-zoom-in object-contain"
                onClick={() => currentPreviewVersion && setPreviewVersion(currentPreviewVersion)}
              />
            ) : (
              <div className="flex max-w-sm flex-col items-center gap-3 text-center text-muted-foreground">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <ImageIcon className="h-7 w-7" />
                </div>
                <div className="text-base font-medium text-foreground">暂无生成结果</div>
                <p className="text-sm leading-6">
                  上传参考图并输入创作指令，生成结果会显示在这里。
                </p>
              </div>
            )}

            {isGenerating ? (
              <div className="absolute inset-0 flex items-center justify-center bg-white/70 backdrop-blur-sm">
                <div className="flex items-center gap-3 rounded-full border border-border bg-white px-4 py-3 text-sm shadow-sm">
                  <LoaderCircle className="h-4 w-4 animate-spin text-primary" />
                  生成中...
                </div>
              </div>
            ) : null}

            {currentTaskTimedOut ? (
              <div className="absolute bottom-20 left-4 right-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700 shadow-sm">
                <div>{getGenerationFailureMessage(currentTask)}</div>
                <div className="mt-3 flex flex-wrap gap-2">
                  <button
                    type="button"
                    onClick={handleRetryGeneration}
                    className="rounded-lg bg-red-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-red-700"
                  >
                    重新生成
                  </button>
                  <button
                    type="button"
                    onClick={handleSwitchModelAfterTimeout}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    切换模型
                  </button>
                  <button
                    type="button"
                    onClick={handleCancelTimedOutTask}
                    className="rounded-lg border border-red-200 bg-white px-3 py-1.5 text-xs font-medium text-red-700 hover:bg-red-100"
                  >
                    取消生成
                  </button>
                </div>
              </div>
            ) : null}

            {currentTask?.status === "failed" && !currentTaskTimedOut ? (
              <div className="absolute bottom-4 left-4 right-4 rounded-xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
                {getSafeTaskErrorMessage(currentTask, "生成失败，请稍后重试。")}
              </div>
            ) : null}
          </div>

          {currentPreviewVersion ? (
            <div className="mt-4 flex flex-wrap gap-2">
              <Button
                type="button"
                variant="outline"
                onClick={() => setPreviewVersion(currentPreviewVersion)}
              >
                <Maximize2 className="h-4 w-4" />
                预览大图
              </Button>
              <a
                href={resolveAssetUrl(currentPreviewVersion.outputAsset.fileUrl)}
                download={getDownloadFileName(projectId, currentPreviewVersion)}
                className="inline-flex h-10 items-center justify-center gap-2 rounded-xl border border-input bg-white px-4 py-2 text-sm font-medium transition-colors hover:bg-secondary hover:text-secondary-foreground"
              >
                <Download className="h-4 w-4" />
                下载原图
              </a>
              <Button
                type="button"
                variant="outline"
                disabled={isGenerating}
                onClick={() => handleUpscaleVersion(currentPreviewVersion, "2K")}
              >
                2K 高清重绘
              </Button>
              <Button
                type="button"
                variant="outline"
                disabled={isGenerating}
                onClick={() => handleUpscaleVersion(currentPreviewVersion, "4K")}
              >
                4K 细节重绘
              </Button>
            </div>
          ) : null}
        </div>

        <div className="grid gap-5 xl:grid-cols-2">
          <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <ImageIcon className="h-4 w-4 text-primary" />
              当前参考图
            </div>
            {latestReferenceAsset ? (
              <div>
                <img
                  src={resolveAssetUrl(latestReferenceAsset.fileUrl)}
                  alt="当前参考图"
                  className="aspect-[4/3] w-full rounded-2xl object-cover"
                />
                <div className="mt-2 text-xs text-muted-foreground">
                  素材 ID：{latestReferenceAsset.id}
                </div>
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/70 p-5 text-sm text-muted-foreground">
                暂无参考图。
              </div>
            )}
          </div>

          <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
            <div className="mb-3 flex items-center gap-2 font-semibold">
              <MessageSquare className="h-4 w-4 text-primary" />
              对话记录
            </div>
            {hasMessages ? (
              <div className="max-h-[280px] space-y-3 overflow-auto pr-1">
                {messages.map((message) => (
                  <div key={message.id} className="rounded-2xl border border-border bg-background/70 p-3">
                    <div className="mb-2 flex items-center justify-between text-xs text-muted-foreground">
                      <span>{getRoleLabel(message.role)}</span>
                      <span>{formatShortTime(message.createdAt)}</span>
                    </div>
                    {message.attachmentAsset ? (
                      <img
                        src={resolveAssetUrl(message.attachmentAsset.fileUrl)}
                        alt="备注附件"
                        className="mb-3 max-h-36 w-full rounded-xl object-cover"
                      />
                    ) : null}
                    <div className="whitespace-pre-wrap text-sm leading-6">
                      {message.content || "仅保存了参考图。"}
                    </div>
                  </div>
                ))}
              </div>
            ) : (
              <div className="rounded-2xl border border-dashed border-border bg-background/70 p-5 text-sm text-muted-foreground">
                暂无对话记录。
              </div>
            )}
          </div>
        </div>
      </div>

      <aside className="space-y-5">
        <form
          onSubmit={handleSubmit}
          className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm"
        >
          <div className="mb-5">
            <div className="text-sm text-muted-foreground">Control</div>
            <h2 className="text-xl font-semibold tracking-[-0.02em]">创作控制区</h2>
          </div>

          <input
            ref={inputRef}
            type="file"
            accept=".png,.jpg,.jpeg,.webp,image/png,image/jpeg,image/webp"
            className="hidden"
            onChange={handleFileChange}
          />

          <button
            type="button"
            onClick={() => inputRef.current?.click()}
            disabled={isUploading}
            className="flex w-full flex-col items-center justify-center rounded-3xl border border-dashed border-primary/25 bg-primary/5 px-4 py-6 text-center transition hover:border-primary/40 hover:bg-primary/10 disabled:cursor-not-allowed disabled:opacity-60"
          >
            <UploadCloud className="h-7 w-7 text-primary" />
            <span className="mt-3 font-medium">
              {isUploading ? "上传中..." : "上传参考图"}
            </span>
            <span className="mt-1 text-xs leading-5 text-muted-foreground">
              支持 png、jpg、jpeg、webp，单张不超过 10MB。
            </span>
          </button>

          {pendingAsset ? (
            <div className="mt-4 rounded-2xl border border-border bg-background/70 p-3">
              <div className="mb-2 flex items-center justify-between gap-3">
                <div className="text-sm font-medium">待使用参考图</div>
                <button
                  type="button"
                  onClick={clearPendingAsset}
                  className="inline-flex h-8 items-center gap-1 rounded-full border border-border bg-white px-3 text-xs text-muted-foreground hover:bg-secondary"
                >
                  <X className="h-3.5 w-3.5" />
                  移除
                </button>
              </div>
              <img
                src={resolveAssetUrl(pendingAsset.fileUrl)}
                alt="待使用参考图"
                className="max-h-52 w-full rounded-xl object-cover"
              />
              <div className="mt-2 text-xs text-muted-foreground">
                素材 ID：{pendingAsset.assetId}
              </div>
            </div>
          ) : null}

          <div className="mt-5">
            <ModelSelector
              models={imageModels}
              selectedModelId={selectedImageModel?.id ?? ""}
              selectedSize={selectedSize}
              isImageToImage={isImageToImage}
              onSelectModel={(model) => {
                setSelectedImageModelId(model.id);
                setSelectedSize(model.defaultSize);
              }}
              onSelectSize={setSelectedSize}
            />
          </div>

          <div className="mt-5 space-y-2">
            <label htmlFor="creation-instruction" className="text-sm font-medium">
              创作指令
            </label>
            <Textarea
              id="creation-instruction"
              value={content}
              onChange={(event) => setContent(event.target.value)}
              placeholder="描述画面目标、风格方向、产品细节或参考要求。"
              maxLength={4000}
              className="min-h-[180px]"
            />
          </div>

          {error ? (
            <div className="mt-4 flex gap-2 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm leading-6 text-red-700">
              <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" />
              {error}
            </div>
          ) : null}

          <div className="mt-5 grid gap-3">
            <Button
              type="button"
              size="lg"
              disabled={isGenerating || isUploading}
              onClick={handleGenerate}
              className="w-full"
            >
              {isGenerating ? (
                <>
                  <LoaderCircle className="h-4 w-4 animate-spin" />
                  生成中...
                </>
              ) : (
                <>
                  <Sparkles className="h-4 w-4" />
                  开始生成
                </>
              )}
            </Button>
            <Button
              type="submit"
              variant="secondary"
              disabled={isSubmitting || isUploading || isGenerating}
              className="w-full"
            >
              <Send className="h-4 w-4" />
              {isSubmitting ? "保存中..." : "仅保存备注"}
            </Button>
          </div>
        </form>

        <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-4 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 font-semibold">
              <Clock3 className="h-4 w-4 text-primary" />
              生成状态
            </div>
            <span className={`rounded-full border px-3 py-1 text-xs ${statusTone}`}>
              {generationStatus}
            </span>
          </div>

          {currentTask ? (
            <div className="space-y-3 text-sm text-muted-foreground">
              <div className="rounded-2xl bg-background/70 p-3">
                <div>任务 ID：{currentTask.id}</div>
                <div>任务类型：{currentTask.taskType}</div>
                <div>模型：{currentTask.modelName}</div>
              </div>
              {currentTaskTimedOut ? (
                <div className="rounded-2xl border border-amber-200 bg-amber-50 p-3 text-amber-800">
                  <div className="font-medium">{getGenerationFailureMessage(currentTask)}</div>
                  <p className="mt-1 text-xs leading-5">
                    你可以重新排队生成、切换到其他模型，或取消本次超时状态。
                  </p>
                  <div className="mt-3 grid gap-2 sm:grid-cols-3">
                    <Button
                      type="button"
                      size="sm"
                      onClick={handleRetryGeneration}
                      disabled={isGenerating}
                    >
                      重新生成
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="outline"
                      onClick={handleSwitchModelAfterTimeout}
                      disabled={isGenerating}
                    >
                      切换模型
                    </Button>
                    <Button
                      type="button"
                      size="sm"
                      variant="secondary"
                      onClick={handleCancelTimedOutTask}
                      disabled={isGenerating}
                    >
                      取消生成
                    </Button>
                  </div>
                </div>
              ) : null}
              {currentTask.status === "failed" && !currentTaskTimedOut ? (
                <div className="rounded-2xl border border-red-200 bg-red-50 p-3 text-red-700">
                  失败原因：{getSafeTaskErrorMessage(currentTask, "生成失败，请稍后重试。")}
                </div>
              ) : null}
              <details className="rounded-2xl border border-border bg-background/70 p-3">
                <summary className="cursor-pointer font-medium text-foreground">查看 Prompt</summary>
                <div className="mt-3 space-y-3 text-xs leading-6">
                  <div>
                    <div className="mb-1 font-medium text-foreground">正向 Prompt</div>
                    <p>{currentTask.promptText || "暂无 Prompt。"}</p>
                  </div>
                  <div>
                    <div className="mb-1 font-medium text-foreground">负向 Prompt</div>
                    <p>{currentTask.negativePromptText || "暂无负向 Prompt。"}</p>
                  </div>
                </div>
              </details>
            </div>
          ) : (
            <div className="rounded-2xl border border-dashed border-border bg-background/70 p-4 text-sm text-muted-foreground">
              还没有生成任务。
            </div>
          )}
        </div>

        <div className="rounded-3xl border border-white/80 bg-white/90 p-5 shadow-sm">
          <div className="mb-3 flex items-center gap-2 font-semibold">
            <FileText className="h-4 w-4 text-primary" />
            备注说明
          </div>
          <p className="text-sm leading-7 text-muted-foreground">
            「开始生成」会创建生成任务和版本记录；「仅保存备注」只写入对话记录，不会触发生成。
          </p>
        </div>
      </aside>
    </section>
    {previewVersion ? (
      <ImagePreviewDialog
        projectId={projectId}
        version={previewVersion}
        isUpscaling={upscalingVersionId === previewVersion.id || isGenerating}
        upscaleError={upscaleError}
        onClose={() => setPreviewVersion(null)}
        onUpscale={(targetResolution) => handleUpscaleVersion(previewVersion, targetResolution)}
      />
    ) : null}
    </>
  );
}
