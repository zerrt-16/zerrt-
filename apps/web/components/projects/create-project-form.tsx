"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { requestApi } from "@/lib/api";
import type { Project } from "@/lib/types";

export function CreateProjectForm() {
  const router = useRouter();
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);

  async function handleSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const projectTitle = title.trim();
    const projectDescription = description.trim();

    if (!projectTitle) {
      setError("请输入项目名称。");
      return;
    }

    try {
      setIsSubmitting(true);
      setError(null);

      const project = await requestApi<Project>("/projects", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          title: projectTitle,
          description: projectDescription,
        }),
      });
      router.push(`/projects/${project.id}`);
      router.refresh();
    } catch (submitError) {
      const message =
        submitError instanceof Error ? submitError.message : "创建项目失败，请稍后重试。";
      setError(message);
    } finally {
      setIsSubmitting(false);
    }
  }

  return (
    <form onSubmit={handleSubmit} className="space-y-5">
      <div className="space-y-2">
        <label htmlFor="project-title" className="text-sm font-medium">
          项目名称
        </label>
        <Input
          id="project-title"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="例如：春季新品视觉"
          maxLength={120}
          className="h-11"
        />
      </div>

      <div className="space-y-2">
        <label htmlFor="project-description" className="text-sm font-medium">
          项目说明
        </label>
        <Textarea
          id="project-description"
          value={description}
          onChange={(event) => setDescription(event.target.value)}
          placeholder="记录项目目标、风格方向或参考要求。"
          maxLength={2000}
          className="min-h-[120px]"
        />
      </div>

      {error ? (
        <div className="rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          {error}
        </div>
      ) : null}

      <Button type="submit" size="lg" className="w-full" disabled={isSubmitting}>
        {isSubmitting ? "创建中..." : "创建项目"}
      </Button>
    </form>
  );
}
