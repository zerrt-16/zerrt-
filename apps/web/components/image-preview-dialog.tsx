"use client";

import { Download, ImageIcon, Sparkles, X } from "lucide-react";

import { ImageUpscalePanel, type UpscaleTargetResolution } from "@/components/image-upscale-panel";
import { Button } from "@/components/ui/button";
import { resolveAssetUrl } from "@/lib/api";
import type { Version } from "@/lib/types";

type ImagePreviewDialogProps = {
  isUpscaling?: boolean;
  projectId: string;
  upscaleError?: string | null;
  version: Version;
  onClose: () => void;
  onUpscale: (targetResolution: UpscaleTargetResolution) => void;
};

function formatPreviewDate(value: string) {
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

function getDownloadFileName(projectId: string, version: Version) {
  const mimeType = version.outputAsset.mimeType.toLowerCase();
  const extension = mimeType.includes("jpeg")
    ? "jpg"
    : mimeType.includes("webp")
      ? "webp"
      : "png";

  return `zerrt-ai-${projectId}-${version.id}.${extension}`;
}

function getStatusLabel(status?: string) {
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
      return "成功";
  }
}

function getPayloadText(version: Version, key: string) {
  const payload = version.generationTask?.structuredPayloadJson;
  const value = payload?.[key];

  return typeof value === "string" ? value : null;
}

function getUpscaleTargetLabel(targetResolution: string) {
  return targetResolution === "4K" ? "4K 细节重绘" : "2K 高清重绘";
}

function didReachTargetPixels(version: Version, targetResolution: string | null) {
  if (targetResolution !== "2K" && targetResolution !== "4K") {
    return null;
  }

  const longestEdge = Math.max(version.outputAsset.width, version.outputAsset.height);
  const requiredLongestEdge = targetResolution === "4K" ? 3840 : 2048;

  return longestEdge >= requiredLongestEdge;
}

export function ImagePreviewDialog({
  isUpscaling,
  projectId,
  upscaleError,
  version,
  onClose,
  onUpscale,
}: ImagePreviewDialogProps) {
  const imageUrl = resolveAssetUrl(version.outputAsset.fileUrl);
  const prompt = version.generationTask?.promptText ?? version.changeSummary ?? "暂无 Prompt。";
  const targetResolution = getPayloadText(version, "targetResolution");
  const providerSize = getPayloadText(version, "providerSize");
  const isUpscaleVersion = getPayloadText(version, "generationType") === "upscale";
  const targetReached = didReachTargetPixels(version, targetResolution);

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/50 p-4 backdrop-blur-sm">
      <div className="grid max-h-[92vh] w-full max-w-6xl overflow-hidden rounded-3xl border border-white/70 bg-white shadow-2xl lg:grid-cols-[minmax(0,1fr)_360px]">
        <div className="relative flex min-h-[420px] items-center justify-center bg-[#f6f5f2] p-5">
          <button
            type="button"
            onClick={onClose}
            className="absolute right-4 top-4 inline-flex h-10 w-10 items-center justify-center rounded-full border border-border bg-white/90 text-muted-foreground shadow-sm transition hover:bg-white hover:text-foreground lg:hidden"
            aria-label="关闭预览"
          >
            <X className="h-4 w-4" />
          </button>
          <img
            src={imageUrl}
            alt={`版本 ${version.versionIndex} 预览`}
            className="max-h-[82vh] w-full rounded-2xl object-contain"
          />
        </div>

        <aside className="flex max-h-[92vh] flex-col overflow-y-auto p-5">
          <div className="mb-5 flex items-start justify-between gap-3">
            <div>
              <div className="text-sm text-muted-foreground">Image Preview</div>
              <h2 className="mt-1 text-xl font-semibold tracking-[-0.02em]">生成图片预览</h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="hidden h-10 w-10 items-center justify-center rounded-full border border-border bg-white text-muted-foreground transition hover:bg-secondary hover:text-foreground lg:inline-flex"
              aria-label="关闭预览"
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          <div className="space-y-3 rounded-2xl border border-border bg-background/70 p-4 text-sm">
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">版本</span>
              <span className="font-medium">版本 {version.versionIndex}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">模型</span>
              <span className="text-right font-medium">
                {version.generationTask?.modelName ?? "未知模型"}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">生成时间</span>
              <span className="text-right">{formatPreviewDate(version.createdAt)}</span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">尺寸</span>
              <span>
                {version.outputAsset.width} × {version.outputAsset.height}
              </span>
            </div>
            <div className="flex items-center justify-between gap-4">
              <span className="text-muted-foreground">状态</span>
              <span className="rounded-full border border-emerald-200 bg-emerald-50 px-2 py-1 text-xs text-emerald-700">
                {getStatusLabel(version.generationTask?.status)}
              </span>
            </div>
            {isUpscaleVersion && targetResolution ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">重绘目标</span>
                <span className="rounded-full border border-primary/20 bg-primary/5 px-2 py-1 text-xs text-primary">
                  {getUpscaleTargetLabel(targetResolution)}
                </span>
              </div>
            ) : null}
            {isUpscaleVersion && providerSize ? (
              <div className="flex items-center justify-between gap-4">
                <span className="text-muted-foreground">请求尺寸</span>
                <span className="text-right">{providerSize}</span>
              </div>
            ) : null}
          </div>

          {isUpscaleVersion && targetResolution && targetReached === false ? (
            <div className="mt-3 rounded-2xl border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-800">
              当前图片实际为 {version.outputAsset.width} × {version.outputAsset.height}，未达到物理{" "}
              {targetResolution} 像素；这是按「{getUpscaleTargetLabel(targetResolution)}」目标生成的细节重绘版。
            </div>
          ) : null}

          {isUpscaleVersion && targetResolution && targetReached === true ? (
            <div className="mt-3 rounded-2xl border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-800">
              当前图片实际为 {version.outputAsset.width} × {version.outputAsset.height}，已达到{" "}
              {targetResolution} 目标像素区间。
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-border bg-white p-4">
            <div className="mb-2 flex items-center gap-2 font-medium">
              <ImageIcon className="h-4 w-4 text-primary" />
              使用 Prompt
            </div>
            <p className="max-h-40 overflow-y-auto whitespace-pre-wrap text-sm leading-6 text-muted-foreground">
              {prompt}
            </p>
          </div>

          <a
            href={imageUrl}
            download={getDownloadFileName(projectId, version)}
            className="mt-4 inline-flex h-11 items-center justify-center gap-2 rounded-xl bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition hover:bg-primary/90"
          >
            <Download className="h-4 w-4" />
            下载原图
          </a>

          <div className="mt-4">
            <ImageUpscalePanel isLoading={isUpscaling} onUpscale={onUpscale} />
          </div>

          {upscaleError ? (
            <div className="mt-4 rounded-2xl border border-red-200 bg-red-50 p-3 text-sm text-red-700">
              {upscaleError}
            </div>
          ) : null}

          <div className="mt-4 rounded-2xl border border-primary/15 bg-primary/5 p-3 text-xs leading-5 text-primary">
            <div className="mb-1 flex items-center gap-1.5 font-medium">
              <Sparkles className="h-3.5 w-3.5" />
              基于 Nano Banana Pro 重新生成高清细节版本
            </div>
            高清重绘会基于原图进行 AI 重绘，尽量保持构图和细节一致。最终像素尺寸取决于模型实际返回结果，可能与目标 2K / 4K 存在差异。
          </div>

          <Button type="button" variant="secondary" className="mt-4" onClick={onClose}>
            关闭
          </Button>
        </aside>
      </div>
    </div>
  );
}
