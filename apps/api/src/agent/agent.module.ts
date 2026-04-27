import { Module } from "@nestjs/common";

import { ApimartAgentService } from "./apimart-agent.service";
import { AgentService } from "./agent.service";
import { GptAgentService } from "./gpt-agent.service";
import { PromptBuilderService } from "./prompt-builder.service";

@Module({
  providers: [AgentService, ApimartAgentService, GptAgentService, PromptBuilderService],
  exports: [AgentService],
})
export class AgentModule {}
