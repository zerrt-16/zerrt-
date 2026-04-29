import { Module } from "@nestjs/common";

import { AgentModule } from "../agent/agent.module";
import { AssetsModule } from "../assets/assets.module";
import { UploadModule } from "../upload/upload.module";
import { GenerationController } from "./generation.controller";
import { GenerationService } from "./generation.service";
import { ImageModelRegistryService } from "./image-models/image-model-registry.service";
import { ImageModelsController } from "./image-models/image-models.controller";
import { ApimartImageProviderService } from "./providers/apimart-image-provider.service";
import { ConfiguredImageProviderService } from "./providers/configured-image-provider.service";
import { MockImageProviderService } from "./providers/mock-image-provider.service";
import { ImageProvider } from "./providers/image-provider";

@Module({
  imports: [AgentModule, AssetsModule, UploadModule],
  controllers: [GenerationController, ImageModelsController],
  providers: [
    GenerationService,
    ImageModelRegistryService,
    ApimartImageProviderService,
    ConfiguredImageProviderService,
    MockImageProviderService,
    {
      provide: ImageProvider,
      useExisting: ConfiguredImageProviderService,
    },
  ],
  exports: [ImageModelRegistryService, ImageProvider],
})
export class GenerationModule {}
