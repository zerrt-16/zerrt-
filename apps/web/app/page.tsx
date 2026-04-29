import Link from "next/link";
import { ArrowRight, FolderKanban, Layers3, MessageSquarePlus, Sparkles } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
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
    <main className="min-h-screen overflow-hidden bg-[radial-gradient(circle_at_top_left,rgba(55,119,197,0.10),transparent_32%),linear-gradient(180deg,#fbfaf7,#f3f1ec)]">
      <div className="mx-auto flex min-h-screen max-w-7xl flex-col px-5 py-5 md:px-8 lg:px-10">
        <header className="flex h-16 items-center justify-between gap-4 rounded-3xl border border-white/70 bg-white/80 px-4 shadow-sm backdrop-blur md:px-5">
          <BrandLogo />
          <div className="hidden items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm sm:inline-flex">
            <Sparkles className="h-4 w-4 text-primary" />
            AI 图像创作工作台
          </div>
        </header>

        <section className="grid flex-1 items-center gap-8 py-10 lg:grid-cols-[minmax(0,1.15fr)_420px] lg:py-14">
          <div className="space-y-8">
            <div className="inline-flex items-center rounded-full border border-primary/10 bg-white/80 px-4 py-2 text-sm text-primary shadow-sm">
              <Layers3 className="mr-2 h-4 w-4" />
              为电商视觉团队打造的生成式创作系统
            </div>

            <div className="max-w-4xl space-y-5">
              <h1 className="text-balance text-4xl font-semibold leading-[1.08] tracking-[-0.04em] text-foreground md:text-6xl">
                管理项目、参考图与生成版本
              </h1>
              <p className="max-w-2xl text-base leading-8 text-muted-foreground md:text-lg">
                为电商视觉团队管理参考图、创作指令与每一次生成版本。让灵感、模型和产出在同一个工作台里有序流转。
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3">
              {[
                ["项目管理", "集中管理创作主题与需求"],
                ["参考图上传", "保留材质、构图与风格线索"],
                ["版本追踪", "沉淀每一次生成结果"],
              ].map(([title, description]) => (
                <div
                  key={title}
                  className="rounded-2xl border border-white/70 bg-white/70 p-4 shadow-sm backdrop-blur"
                >
                  <div className="font-medium text-foreground">{title}</div>
                  <div className="mt-2 text-sm leading-6 text-muted-foreground">{description}</div>
                </div>
              ))}
            </div>
          </div>

          <Card className="border-white/80 bg-white/90 shadow-[0_24px_80px_rgba(28,39,61,0.10)] backdrop-blur">
            <CardHeader className="space-y-2">
              <CardTitle className="flex items-center gap-2 text-xl">
                <MessageSquarePlus className="h-5 w-5 text-primary" />
                新建项目
              </CardTitle>
              <CardDescription>创建后将直接进入项目工作台。</CardDescription>
            </CardHeader>
            <CardContent>
              <CreateProjectForm />
            </CardContent>
          </Card>
        </section>

        <section className="pb-12">
          <div className="mb-5 flex flex-col justify-between gap-4 sm:flex-row sm:items-end">
            <div>
              <h2 className="text-2xl font-semibold tracking-[-0.02em]">项目列表</h2>
              <p className="mt-2 text-sm text-muted-foreground">
                已创建的项目会保留参考图、备注、生成任务与版本记录。
              </p>
            </div>
            <div className="w-fit rounded-full border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm">
              共 {projects.length} 个项目
            </div>
          </div>

          {projects.length > 0 ? (
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {projects.map((project) => (
                <Link key={project.id} href={`/projects/${project.id}`} className="group block">
                  <Card className="h-full border-white/80 bg-white/90 shadow-sm transition duration-200 group-hover:-translate-y-1 group-hover:shadow-[0_18px_48px_rgba(28,39,61,0.10)]">
                    <CardHeader>
                      <CardTitle className="flex items-start justify-between gap-3 text-xl">
                        <span className="line-clamp-2">{project.title}</span>
                        <span className="mt-0.5 flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary transition group-hover:bg-primary group-hover:text-primary-foreground">
                          <ArrowRight className="h-4 w-4" />
                        </span>
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
            <Card className="border-dashed border-border bg-white/80">
              <CardContent className="flex min-h-[260px] flex-col items-center justify-center gap-4 text-center">
                <div className="flex h-14 w-14 items-center justify-center rounded-2xl bg-primary/10 text-primary">
                  <FolderKanban className="h-7 w-7" />
                </div>
                <div className="space-y-2">
                  <h3 className="text-xl font-semibold">暂无项目</h3>
                  <p className="max-w-md text-sm leading-7 text-muted-foreground">
                    先创建一个项目，开始管理创作指令、参考图和生成版本。
                  </p>
                </div>
              </CardContent>
            </Card>
          )}
        </section>
      </div>
    </main>
  );
}
