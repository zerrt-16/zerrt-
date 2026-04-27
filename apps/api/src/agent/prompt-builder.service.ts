import { Injectable } from "@nestjs/common";
import { GenerationTaskType } from "@prisma/client";

import {
  AgentAnalysisContext,
  AgentStructuredOutput,
  getAgentFallbackNegativePrompt,
} from "./agent.types";

type PromptBuildResult = {
  promptText: string;
  negativePromptText: string;
  changeSummary: string;
};

@Injectable()
export class PromptBuilderService {
  build(
    context: AgentAnalysisContext,
    structuredOutput: AgentStructuredOutput,
  ): PromptBuildResult {
    const segments: string[] = [];
    const cleanPrompt = structuredOutput.prompt.trim();
    const cleanMessage = context.messageText.trim();

    if (cleanPrompt) {
      segments.push(cleanPrompt);
    } else if (cleanMessage) {
      segments.push(cleanMessage);
    }

    if (structuredOutput.subject.trim()) {
      segments.push(`Subject: ${structuredOutput.subject.trim()}.`);
    }

    if (structuredOutput.style.trim()) {
      segments.push(`Style: ${structuredOutput.style.trim()}.`);
    }

    if (structuredOutput.lockedElements.length > 0) {
      segments.push(
        `Preserve: ${structuredOutput.lockedElements.filter(Boolean).join(", ")}.`,
      );
    }

    if (structuredOutput.changedElements.length > 0) {
      segments.push(
        `Focus changes on: ${structuredOutput.changedElements.filter(Boolean).join(", ")}.`,
      );
    }

    if (
      structuredOutput.taskType === GenerationTaskType.image_to_image &&
      context.sourceAssetId
    ) {
      segments.push("Use the uploaded reference image as the visual base.");
    }

    const promptText = segments.join(" ").trim() || cleanMessage;
    const negativePromptText =
      structuredOutput.negativePrompt.trim() || getAgentFallbackNegativePrompt();
    const changeSummary =
      structuredOutput.editSummary.trim() ||
      (structuredOutput.taskType === GenerationTaskType.image_to_image
        ? "Edited the uploaded reference image."
        : "Generated a new image from text.");

    return {
      promptText,
      negativePromptText,
      changeSummary,
    };
  }
}
