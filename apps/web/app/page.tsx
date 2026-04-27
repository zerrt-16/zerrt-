import Link from "next/link";
import { ArrowRight, FolderKanban, MessageSquarePlus, Sparkles } from "lucide-react";

import { CreateProjectForm } from "@/components/projects/create-project-form";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { fetchApi } from "@/lib/api";
import type { Project } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProjectCardItem = {
  id: string;
  title: string;
  description: string | null;
  updatedAtLabel: string;
};

function formatProjectDate(value: string | null | undefined) {
  if (!value) {
    return "更新时间未知";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "更新时间未知";
  }

  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
  }).format(date);
}

function normalizeProjects(payload: unknown): ProjectCardItem[] {
  if (!Array.isArray(payload)) {
    return [];
  }

  return payload
    .filter((project): project is Partial<Project> & { id: string } => {
      return typeof project === "object" && project !== null && typeof project.id === "string";
    })
    .map((project) => ({
      id: project.id,
      title:
        typeof project.title === "string" && project.title.trim().length > 0
          ? project.title
          : "未命名项目",
      description: typeof project.description === "string" ? project.description : null,
      updatedAtLabel: formatProjectDate(
        typeof project.updatedAt === "string" ? project.updatedAt : undefined,
      ),
    }));
}

async function fetchProjects() {
  try {
    const projects = await fetchApi<unknown>("/projects");
    return normalizeProjects(projects);
  } catch {
    return [];
  }
}

export default async function HomePage() {
  const projects = await fetchProjects();

  return (
    <main className="mx-auto flex min-h-screen max-w-7xl flex-col px-6 py-8 md:px-10 lg:px-12">
      <section className="grid gap-8 border-b border-border pb-8 lg:grid-cols-[1.15fr_0.85fr]">
        <div className="space-y-6">
          <div className="inline-flex items-center rounded-full border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            <Sparkles className="mr-2 h-4 w-4 text-primary" />
            AI 图像创作工作台
          </div>
          <div className="space-y-4">
            <h1 className="max-w-4xl text-4xl font-semibold leading-tight md:text-5xl">
              管理项目、参考图与生成版本
            </h1>
            <p className="max-w-2xl text-base leading-8 text-muted-foreground">
              创建项目后进入工作台，上传参考图、填写创作指令，并保留每一次生成记录。
            </p>
          </div>
        </div>

        <Card className="border-border bg-white">
          <CardHeader>
            <CardTitle className="flex items-center gap-2 text-xl">
              <MessageSquarePlus className="h-5 w-5 text-primary" />
              新建项目
            </CardTitle>
            <CardDescription>创建后会直接进入项目工作台。</CardDescription>
          </CardHeader>
          <CardContent>
            <CreateProjectForm />
          </CardContent>
        </Card>
      </section>

      <section className="mt-10 space-y-4">
        <div className="flex items-center justify-between gap-4">
          <div>
            <h2 className="text-2xl font-semibold">项目列表</h2>
            <p className="text-sm text-muted-foreground">
              所有项目数据来自后端接口，刷新后仍会保留。
            </p>
          </div>
          <div className="rounded-full border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
            共 {projects.length} 个项目
          </div>
        </div>

        {projects.length > 0 ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {projects.map((project) => (
              <Link key={project.id} href={`/projects/${project.id}`} className="block">
                <Card className="h-full border-border bg-white transition-shadow duration-200 hover:shadow-md">
                  <CardHeader>
                    <CardTitle className="flex items-start justify-between gap-3 text-xl">
                      <span>{project.title}</span>
                      <ArrowRight className="mt-1 h-4 w-4 shrink-0 text-primary" />
                    </CardTitle>
                    <CardDescription>更新于 {project.updatedAtLabel}</CardDescription>
                  </CardHeader>
                  <CardContent>
                    <p className="line-clamp-3 text-sm leading-7 text-muted-foreground">
                      {project.description ?? "暂未填写项目说明。"}
                    </p>
                  </CardContent>
                </Card>
              </Link>
            ))}
          </div>
        ) : (
          <Card className="border-border bg-white">
            <CardContent className="flex min-h-[220px] flex-col items-center justify-center gap-3 text-center">
              <FolderKanban className="h-10 w-10 text-primary" />
              <div className="space-y-1">
                <h3 className="text-xl font-semibold">暂无项目</h3>
                <p className="text-sm text-muted-foreground">
                  先创建一个项目，开始管理创作指令、参考图和生成版本。
                </p>
              </div>
            </CardContent>
          </Card>
        )}
      </section>
    </main>
  );
}
