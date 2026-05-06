"use client";

import { LoaderCircle, Sparkles } from "lucide-react";

import { Button } from "@/components/ui/button";

export type UpscaleTargetResolution = "2K" | "4K";

type ImageUpscalePanelProps = {
  isLoading?: boolean;
  onUpscale: (targetResolution: UpscaleTargetResolution) => void;
};

export function ImageUpscalePanel({ isLoading, onUpscale }: ImageUpscalePanelProps) {
  return (
    <div className="rounded-2xl border border-border bg-white/80 p-4">
      <div className="flex items-center gap-2 font-semibold text-foreground">
        <Sparkles className="h-4 w-4 text-primary" />
        AI 高清重绘
      </div>
      <p className="mt-2 text-xs leading-5 text-muted-foreground">
        高清重绘会基于原图进行 AI 重绘，尽量保持构图和细节一致；最终像素尺寸以模型实际返回为准。
      </p>
      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => onUpscale("2K")}
        >
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          2K 高清重绘
        </Button>
        <Button
          type="button"
          variant="outline"
          disabled={isLoading}
          onClick={() => onUpscale("4K")}
        >
          {isLoading ? <LoaderCircle className="h-4 w-4 animate-spin" /> : null}
          4K 细节重绘
        </Button>
      </div>
      {isLoading ? (
        <div className="mt-3 rounded-xl bg-primary/5 px-3 py-2 text-xs text-primary">
          正在放大，请稍候...
        </div>
      ) : null}
    </div>
  );
}
