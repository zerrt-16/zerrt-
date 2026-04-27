import { GenerationTaskType } from "@prisma/client";

export type AgentContextMessage = {
  role: string;
  content: string;
  createdAt: Date;
  attachmentAssetId: string | null;
};

export type AgentContextVersion = {
  id: string;
  versionIndex: number;
  changeSummary: string | null;
  createdAt: Date;
};

export type AgentAnalysisContext = {
  project: {
    id: string;
    title: string;
    description: string | null;
  };
  messageText: string;
  sourceAssetId: string | null;
  baseVersionId: string | null;
  recentMessages: AgentContextMessage[];
  recentVersions: AgentContextVersion[];
};

export type AgentStructuredOutput = {
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

export type AgentAnalysisResult = {
  modelName: string;
  structuredOutput: AgentStructuredOutput;
  promptText: string;
  negativePromptText: string;
  changeSummary: string;
};

const FALLBACK_NEGATIVE_PROMPT =
  "low quality, blurry, distorted anatomy, broken composition, unreadable details";

function getPreferredTaskType(sourceAssetId: string | null) {
  return sourceAssetId ? GenerationTaskType.image_to_image : GenerationTaskType.text_to_image;
}

function toCleanString(value: unknown) {
  return typeof value === "string" ? value.trim() : "";
}

function toStringArray(value: unknown) {
  if (!Array.isArray(value)) {
    return [];
  }

  return value.filter((item): item is string => typeof item === "string").map((item) => item.trim());
}

export const agentStructuredOutputJsonSchema = {
  type: "object",
  additionalProperties: false,
  required: [
    "taskType",
    "userGoal",
    "subject",
    "style",
    "lockedElements",
    "changedElements",
    "prompt",
    "negativePrompt",
    "editSummary",
  ],
  properties: {
    taskType: {
      type: "string",
      enum: [GenerationTaskType.text_to_image, GenerationTaskType.image_to_image],
    },
    userGoal: { type: "string" },
    subject: { type: "string" },
    style: { type: "string" },
    lockedElements: {
      type: "array",
      items: { type: "string" },
    },
    changedElements: {
      type: "array",
      items: { type: "string" },
    },
    prompt: { type: "string" },
    negativePrompt: { type: "string" },
    editSummary: { type: "string" },
  },
} as const;

export function buildFallbackAgentOutput(context: AgentAnalysisContext): AgentStructuredOutput {
  const cleanMessage =
    context.messageText.trim() || "Create a polished image result for this project request.";
  const taskType = getPreferredTaskType(context.sourceAssetId);
  const projectSubject = context.project.title.trim() || "creative concept";

  return {
    taskType,
    userGoal: cleanMessage,
    subject: cleanMessage.split(/[.!?]/)[0] || projectSubject,
    style: taskType === GenerationTaskType.image_to_image ? "guided image edit" : "polished concept art",
    lockedElements:
      taskType === GenerationTaskType.image_to_image
        ? ["main subject", "overall composition"]
        : [],
    changedElements:
      taskType === GenerationTaskType.image_to_image
        ? ["styling", "lighting", "surface detail"]
        : ["subject rendering", "lighting", "background treatment"],
    prompt: cleanMessage,
    negativePrompt: FALLBACK_NEGATIVE_PROMPT,
    editSummary:
      taskType === GenerationTaskType.image_to_image
        ? "Applied the requested edit to the uploaded reference image."
        : "Generated a new image from the user's prompt.",
  };
}

export function normalizeAgentStructuredOutput(
  value: unknown,
  sourceAssetId: string | null,
): AgentStructuredOutput | null {
  if (!value || typeof value !== "object") {
    return null;
  }

  const payload = value as Record<string, unknown>;
  const preferredTaskType = getPreferredTaskType(sourceAssetId);
  const userGoal = toCleanString(payload.userGoal);
  const subject = toCleanString(payload.subject);
  const style = toCleanString(payload.style);
  const prompt = toCleanString(payload.prompt);
  const negativePrompt = toCleanString(payload.negativePrompt);
  const editSummary = toCleanString(payload.editSummary);
  const lockedElements = toStringArray(payload.lockedElements);
  const changedElements = toStringArray(payload.changedElements);

  if (!userGoal || !subject || !style || !prompt || !editSummary) {
    return null;
  }

  return {
    taskType: preferredTaskType,
    userGoal,
    subject,
    style,
    lockedElements,
    changedElements,
    prompt,
    negativePrompt: negativePrompt || FALLBACK_NEGATIVE_PROMPT,
    editSummary,
  };
}

export function getAgentFallbackNegativePrompt() {
  return FALLBACK_NEGATIVE_PROMPT;
}
