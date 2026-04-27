import { Injectable } from "@nestjs/common";
import { GenerationTaskType } from "@prisma/client";

type MockAgentInput = {
  messageText: string;
  sourceAssetId?: string | null;
};

export type MockAgentOutput = {
  taskType: GenerationTaskType;
  userGoal: string;
  subject: string;
  style: string;
  lockedElements: string[];
  changedElements: string[];
  prompt: string;
  negativePrompt: string;
  editSummary: string;
};

@Injectable()
export class MockAgentService {
  analyze(input: MockAgentInput): MockAgentOutput {
    const cleanMessage = input.messageText.trim() || "Create a polished mock image result.";
    const taskType = input.sourceAssetId ? "image_to_image" : "text_to_image";

    return {
      taskType,
      userGoal: cleanMessage,
      subject: cleanMessage.split(/[.!?]/)[0] || "Creative concept",
      style: input.sourceAssetId ? "mock guided edit" : "mock cinematic concept art",
      lockedElements: input.sourceAssetId ? ["overall composition", "main subject silhouette"] : [],
      changedElements: input.sourceAssetId
        ? ["styling polish", "lighting mood", "surface detail"]
        : ["subject rendering", "background treatment", "lighting mood"],
      prompt:
        taskType === "image_to_image"
          ? `Edit the source image to achieve this goal: ${cleanMessage}. Preserve the key subject and composition, improve style, lighting, and finish.`
          : `Generate an image for this concept: ${cleanMessage}. Rich composition, clear focal subject, polished details, visually appealing lighting.`,
      negativePrompt: "low quality, blurry, distorted anatomy, broken composition, unreadable details",
      editSummary:
        taskType === "image_to_image"
          ? "Mock edit generated from the uploaded reference image."
          : "Mock text-to-image result generated from the prompt only.",
    };
  }
}
