import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft, Wifi } from "lucide-react";

import { BrandLogo } from "@/components/brand-logo";
import { ProjectChat } from "@/components/messages/project-chat";
import { fetchApi } from "@/lib/api";
import type { ImageModel, Message, Project, Version } from "@/lib/types";

export const dynamic = "force-dynamic";

type ProjectWorkspacePageProps = {
  params: Promise<{
    id: string;
  }>;
};

async function fetchWorkspaceData(projectId: string) {
  try {
    const [project, messages, versions, imageModels] = await Promise.all([
      fetchApi<Project>(`/projects/${projectId}`),
      fetchApi<Message[]>(`/projects/${projectId}/messages`),
      fetchApi<Version[]>(`/projects/${projectId}/versions`),
      fetchApi<ImageModel[]>("/image-models"),
    ]);

    return { project, messages, versions, imageModels };
  } catch {
    return null;
  }
}

export default async function ProjectWorkspacePage({ params }: ProjectWorkspacePageProps) {
  const { id } = await params;
  const data = await fetchWorkspaceData(id);

  if (!data) {
    notFound();
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_top_left,rgba(55,119,197,0.08),transparent_34%),linear-gradient(180deg,#fbfaf7,#f3f1ec)]">
      <div className="mx-auto flex min-h-screen max-w-[1680px] flex-col px-4 py-4 md:px-6 lg:px-8">
        <header className="mb-5 flex flex-col gap-4 rounded-3xl border border-white/80 bg-white/85 p-4 shadow-sm backdrop-blur lg:flex-row lg:items-center lg:justify-between">
          <div className="flex min-w-0 items-center gap-4">
            <BrandLogo compact />
            <div className="min-w-0 border-l border-border pl-4">
              <div className="truncate text-lg font-semibold tracking-[-0.02em]">
                {data.project.title}
              </div>
              <div className="mt-1 text-sm text-muted-foreground">项目工作台</div>
            </div>
          </div>

          <div className="flex flex-wrap items-center gap-3">
            <Link
              href="/"
              className="inline-flex h-10 items-center gap-2 rounded-full border border-border bg-white px-4 text-sm text-muted-foreground shadow-sm transition hover:text-foreground"
            >
              <ChevronLeft className="h-4 w-4" />
              返回项目列表
            </Link>
            <div className="inline-flex h-10 items-center gap-2 rounded-full border border-emerald-200 bg-emerald-50 px-4 text-sm text-emerald-700">
              <Wifi className="h-4 w-4" />
              已连接 API
            </div>
          </div>
        </header>

        <ProjectChat
          initialMessages={data.messages}
          initialVersions={data.versions}
          imageModels={data.imageModels}
          project={data.project}
          projectId={data.project.id}
        />
      </div>
    </main>
  );
}
