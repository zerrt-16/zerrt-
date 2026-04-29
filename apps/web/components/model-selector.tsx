"use client";

import { Check, Cpu, ImageIcon } from "lucide-react";

import { cn } from "@/lib/utils";
import type { ImageModel } from "@/lib/types";

type ModelSelectorProps = {
  models: ImageModel[];
  selectedModelId: string;
  selectedSize: string;
  isImageToImage: boolean;
  onSelectModel: (model: ImageModel) => void;
  onSelectSize: (size: string) => void;
};

function getModelDisplayName(model: ImageModel) {
  if (model.id === "gpt-image-2" || model.id === "apimart-gpt-image-2") {
    return "GPT Image 2";
  }

  return model.name || model.displayName;
}

function getModelDescription(model: ImageModel) {
  if (model.id === "nano-banana-pro") {
    return "适合电商视觉、真实质感、人像与产品细节强化。";
  }

  if (model.id === "gpt-image-2" || model.id === "apimart-gpt-image-2") {
    return "稳定通用的图像生成模型，适合产品图、材质优化与真实感创作。";
  }

  return model.description;
}

function getProviderLabel(model: ImageModel) {
  if (model.provider === "apimart") {
    return "APIMart";
  }

  if (model.provider === "mock") {
    return "Mock";
  }

  return model.provider;
}

function getLevelLabel(level: ImageModel["costLevel"] | ImageModel["speedLevel"]) {
  switch (level) {
    case "low":
      return "低";
    case "medium":
      return "中";
    case "high":
      return "高";
    default:
      return level;
  }
}

function getCapabilityText(model: ImageModel) {
  const labels: string[] = [];

  if (model.supportsTextToImage) {
    labels.push("文生图");
  }

  if (model.supportsImageToImage) {
    labels.push("图生图");
  }

  if (model.supportsMultiImage) {
    labels.push("多图参考");
  }

  return labels.join(" / ") || "能力待配置";
}

export function ModelSelector({
  models,
  selectedModelId,
  selectedSize,
  isImageToImage,
  onSelectModel,
  onSelectSize,
}: ModelSelectorProps) {
  const compatibleModels = models.filter((model) =>
    isImageToImage ? model.supportsImageToImage : model.supportsTextToImage,
  );
  const selectedModel = models.find((model) => model.id === selectedModelId) ?? compatibleModels[0];
  const sizes = selectedModel?.allowedSizes?.length ? selectedModel.allowedSizes : ["1:1"];

  if (!compatibleModels.length) {
    return (
      <div className="rounded-2xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
        暂无可用的生图模型，请检查后端模型注册接口。
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between gap-3">
        <div>
          <div className="text-sm font-medium text-foreground">生图模型</div>
          <div className="mt-1 text-xs text-muted-foreground">
            选择适合当前创作目标的图像模型
          </div>
        </div>
        <div className="rounded-full border border-border bg-white px-3 py-1 text-xs text-muted-foreground">
          {isImageToImage ? "图生图" : "文生图"}
        </div>
      </div>

      <div className="grid gap-3">
        {compatibleModels.map((model) => {
          const selected = model.id === selectedModelId;

          return (
            <button
              key={model.id}
              type="button"
              onClick={() => onSelectModel(model)}
              className={cn(
                "group rounded-2xl border bg-white p-4 text-left shadow-sm transition duration-200 hover:-translate-y-0.5 hover:shadow-md",
                selected
                  ? "border-primary bg-primary/5 ring-2 ring-primary/10"
                  : "border-border hover:border-primary/40",
              )}
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-start gap-3">
                  <div
                    className={cn(
                      "mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-xl border",
                      selected
                        ? "border-primary/20 bg-primary text-primary-foreground"
                        : "border-border bg-secondary text-primary",
                    )}
                  >
                    {model.id === "nano-banana-pro" ? (
                      <ImageIcon className="h-4 w-4" />
                    ) : (
                      <Cpu className="h-4 w-4" />
                    )}
                  </div>
                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-foreground">
                        {getModelDisplayName(model)}
                      </span>
                      <span className="rounded-full bg-secondary px-2 py-0.5 text-[11px] text-muted-foreground">
                        {getProviderLabel(model)}
                      </span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-muted-foreground">
                      {getModelDescription(model)}
                    </p>
                  </div>
                </div>
                {selected ? (
                  <span className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground">
                    <Check className="h-3.5 w-3.5" />
                  </span>
                ) : null}
              </div>

              <div className="mt-3 flex flex-wrap gap-2 text-[11px] text-muted-foreground">
                <span className="rounded-full border border-border bg-white px-2 py-1">
                  {getCapabilityText(model)}
                </span>
                <span className="rounded-full border border-border bg-white px-2 py-1">
                  成本 {getLevelLabel(model.costLevel)}
                </span>
                <span className="rounded-full border border-border bg-white px-2 py-1">
                  速度 {getLevelLabel(model.speedLevel)}
                </span>
              </div>
            </button>
          );
        })}
      </div>

      <div className="grid gap-2">
        <label htmlFor="image-size" className="text-sm font-medium text-foreground">
          图片比例
        </label>
        <select
          id="image-size"
          value={selectedSize}
          onChange={(event) => onSelectSize(event.target.value)}
          className="h-11 rounded-xl border border-input bg-white px-3 text-sm outline-none transition focus:border-primary focus:ring-2 focus:ring-primary/15"
        >
          {sizes.map((size) => (
            <option key={size} value={size}>
              {size}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}
