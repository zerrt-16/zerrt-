import Link from "next/link";
import { notFound } from "next/navigation";
import { ChevronLeft } from "lucide-react";

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
    <main className="mx-auto flex min-h-screen max-w-[1600px] flex-col px-5 py-5 md:px-8 lg:px-10">
      <div className="mb-4 flex items-center justify-between border-b border-border pb-4">
        <Link
          href="/"
          className="inline-flex items-center gap-2 rounded-full border border-border bg-white px-4 py-2 text-sm text-muted-foreground shadow-sm"
        >
          <ChevronLeft className="h-4 w-4" />
          返回项目列表
        </Link>
        <div className="text-sm text-muted-foreground">AI 图像创作工作台</div>
      </div>

      <ProjectChat
        initialMessages={data.messages}
        initialVersions={data.versions}
        imageModels={data.imageModels}
        project={data.project}
        projectId={data.project.id}
      />
    </main>
  );
}
