import { Injectable } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import {
  AgentAnalysisContext,
  AgentStructuredOutput,
  agentStructuredOutputJsonSchema,
} from "./agent.types";

type OpenAiResponse = {
  output?: Array<{
    type?: string;
    role?: string;
    content?: Array<{
      type?: string;
      text?: string;
      refusal?: string;
    }>;
  }>;
};

@Injectable()
export class GptAgentService {
  constructor(private readonly configService: ConfigService) {}

  getModelName() {
    return this.configService.get<string>("OPENAI_MODEL")?.trim() || "gpt-4o-mini";
  }

  async analyze(context: AgentAnalysisContext): Promise<unknown> {
    const apiKey = this.configService.get<string>("OPENAI_API_KEY")?.trim();

    if (!apiKey) {
      throw new Error("OPENAI_API_KEY is not configured.");
    }

    const controller = new AbortController();
    const timeout = setTimeout(() => controller.abort(), 20000);

    try {
      const response = await fetch("https://api.openai.com/v1/responses", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          model: this.getModelName(),
          input: [
            {
              role: "developer",
              content: [
                {
                  type: "input_text",
                  text: [
                    "You are an AI image planning agent for a creative workspace.",
                    "Return a JSON object that matches the provided schema exactly.",
                    "Infer the user's visual goal, preserve important locked elements, and write a production-ready image prompt.",
                    "If a source asset exists, the request should be planned as an image_to_image edit.",
                    "If no source asset exists, the request should be planned as a text_to_image generation.",
                    "Keep editSummary concise and useful for a version history timeline.",
                  ].join(" "),
                },
              ],
            },
            {
              role: "user",
              content: [
                {
                  type: "input_text",
                  text: JSON.stringify(
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
                },
              ],
            },
          ],
          text: {
            format: {
              type: "json_schema",
              name: "image_generation_plan",
              strict: true,
              schema: agentStructuredOutputJsonSchema,
            },
          },
        }),
        signal: controller.signal,
      });

      if (!response.ok) {
        const errorText = await response.text();
        throw new Error(
          `OpenAI request failed with status ${response.status}: ${errorText || "Unknown error"}`,
        );
      }

      const payload = (await response.json()) as OpenAiResponse;
      const outputText = this.extractOutputText(payload);

      if (!outputText) {
        throw new Error("OpenAI response did not contain structured output text.");
      }

      return JSON.parse(outputText) as AgentStructuredOutput;
    } finally {
      clearTimeout(timeout);
    }
  }

  private extractOutputText(payload: OpenAiResponse) {
    for (const item of payload.output ?? []) {
      if (item.type !== "message" || item.role !== "assistant") {
        continue;
      }

      for (const contentItem of item.content ?? []) {
        if (contentItem.type === "refusal") {
          throw new Error(contentItem.refusal || "OpenAI refused to answer this request.");
        }

        if (contentItem.type === "output_text" && contentItem.text) {
          return contentItem.text;
        }
      }
    }

    return null;
  }
}
