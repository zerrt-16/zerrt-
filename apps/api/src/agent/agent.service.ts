import { Injectable, Logger } from "@nestjs/common";
import { ConfigService } from "@nestjs/config";

import { ApimartAgentService } from "./apimart-agent.service";
import {
  AgentAnalysisContext,
  AgentAnalysisResult,
  buildFallbackAgentOutput,
  normalizeAgentStructuredOutput,
} from "./agent.types";
import { GptAgentService } from "./gpt-agent.service";
import { PromptBuilderService } from "./prompt-builder.service";

type AgentProviderName = "apimart" | "openai";

@Injectable()
export class AgentService {
  private readonly logger = new Logger(AgentService.name);

  constructor(
    private readonly configService: ConfigService,
    private readonly apimartAgentService: ApimartAgentService,
    private readonly gptAgentService: GptAgentService,
    private readonly promptBuilderService: PromptBuilderService,
  ) {}

  async analyze(context: AgentAnalysisContext): Promise<AgentAnalysisResult> {
    const fallbackOutput = buildFallbackAgentOutput(context);
    let modelName = "fallback-agent";
    let structuredOutput = fallbackOutput;
    const providerName = this.getProviderName();
    const provider =
      providerName === "apimart" ? this.apimartAgentService : this.gptAgentService;

    try {
      const response = await provider.analyze(context);
      const normalizedOutput = normalizeAgentStructuredOutput(response, context.sourceAssetId);

      if (normalizedOutput) {
        structuredOutput = normalizedOutput;
        modelName = `${providerName}/${provider.getModelName()}`;
      } else {
        this.logger.warn(
          `${providerName} agent returned invalid structured output. Falling back.`,
        );
      }
    } catch (error) {
      const message =
        error instanceof Error ? error.message : "Unknown GPT agent failure";
      this.logger.warn(`${providerName} agent failed, using fallback. Reason: ${message}`);
    }

    const promptResult = this.promptBuilderService.build(context, structuredOutput);

    return {
      modelName,
      structuredOutput: {
        ...structuredOutput,
        prompt: promptResult.promptText,
        negativePrompt: promptResult.negativePromptText,
        editSummary: promptResult.changeSummary,
      },
      promptText: promptResult.promptText,
      negativePromptText: promptResult.negativePromptText,
      changeSummary: promptResult.changeSummary,
    };
  }

  private getProviderName(): AgentProviderName {
    const providerName = this.configService
      .get<string>("AI_TEXT_PROVIDER")
      ?.trim()
      .toLowerCase();

    return providerName === "openai" ? "openai" : "apimart";
  }
}
