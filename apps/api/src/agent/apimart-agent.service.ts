import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { AgentAnalysisContext, AgentStructuredOutput } from "./agent.types";

type ApimartChatCompletionResponse = {
  choices?: Array<{
    message?: {
      content?: string | null;
    };
  }>;
};

@Injectable()
export class ApimartAgentService {
  constructor(private readonly configService: ConfigService) {}

  getModelName() {
    return this.configService.get<string>("APIMART_MODEL")?.trim() || "gpt-5-mini";
  }

  async analyze(context: AgentAnalysisContext): Promise<unknown> {
    const apiKey = this.configService.get<string>("APIMART_API_KEY")?.trim();

    if (!apiKey) {
      throw new Error("APIMART_API_KEY is not configured.");
    }

    const baseUrl =
      this.configService.get<string>("APIMART_BASE_URL")?.trim() || "https://api.apimart.ai/v1";
    const endpoint = `${baseUrl.replace(/\/+$/, "")}/chat/completions`;
    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 30000);

    try {
      const response = await fetch(endpoint, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getModelName(),
          stream: false,
          messages: [
            {
              role: "system",
              content:
                "你是一个图像创作需求分析 Agent，必须输出严格 JSON。不要输出 markdown、解释、注释或多余文本。",
            },
            {
              role: "user",
              content: this.buildUserPrompt(context),
            },
          ],
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `APIMart request failed with status ${response.status}: ${errorText || "Unknown error"}`,
        );
      }

      const payload = (await response.json()) as ApimartChatCompletionResponse;
      const content = payload.choices?.[0]?.message?.content?.trim();

      if (!content) {
        throw new Error("APIMart response did not contain choices[0].message.content.");
      }

      return JSON.parse(this.stripMarkdownJsonFence(content)) as AgentStructuredOutput;
    } finally {
      clearTimeout(timeout);
    }
  }

  private buildUserPrompt(context: AgentAnalysisContext) {
    const preferredTaskType = context.sourceAssetId ? "image_to_image" : "text_to_image";

    return [
      "请根据下面的项目上下文和用户输入，输出一个严格 JSON 对象。",
      "JSON 必须且只能包含这些字段：",
      JSON.stringify(
        {
          taskType: "text_to_image | image_to_image",
          userGoal: "string",
          subject: "string",
          style: "string",
          lockedElements: ["string"],
          changedElements: ["string"],
          prompt: "string",
          negativePrompt: "string",
          editSummary: "string",
        },
        null,
        2,
      ),
      `taskType 规则：当前优先值必须是 ${preferredTaskType}。如果 sourceAssetId 存在，必须输出 image_to_image；否则输出 text_to_image。`,
      "prompt 需要改写成适合图像生成模型使用的完整英文或中英混合提示词，包含主体、风格、构图、光线、材质和画面质量要求。",
      "negativePrompt 输出负面提示词；editSummary 用简短中文描述本次变化，适合作为版本记录。",
      "项目上下文如下：",
      JSON.stringify(
        {
          project: context.project,
          messageText: context.messageText,
          sourceAssetId: context.sourceAssetId,
          baseVersionId: context.baseVersionId,
          recentMessages: context.recentMessages.map((message) => ({
            role: message.role,
            content: message.content,
            createdAt: message.createdAt.toISOString(),
            hasAttachment: Boolean(message.attachmentAssetId),
          })),
          recentImageVersions: context.recentVersions.map((version) => ({
            id: version.id,
            versionIndex: version.versionIndex,
            changeSummary: version.changeSummary,
            createdAt: version.createdAt.toISOString(),
          })),
        },
        null,
        2,
      ),
    ].join("\n\n");
  }

  private stripMarkdownJsonFence(content: string) {
    const trimmed = content.trim();
    const fencedMatch = trimmed.match(/^```(?:json)?\s*([\s\S]*?)\s*```$/i);

    if (fencedMatch?.[1]) {
      return fencedMatch[1].trim();
    }

    return trimmed.replace(/^```json\s*/i, "").replace(/^```\s*/i, "").replace(/\s*```$/i, "").trim();
  }
}
