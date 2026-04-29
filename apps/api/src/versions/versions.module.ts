import { Module } from "@nestjs/common";

import { AssetsModule } from "../assets/assets.module";
import { GenerationModule } from "../generation/generation.module";
import { UploadModule } from "../upload/upload.module";
import { ImageUpscaleService } from "./image-upscale.service";
import { VersionsController } from "./versions.controller";
import { VersionsService } from "./versions.service";

@Module({
  imports: [AssetsModule, GenerationModule, UploadModule],
  controllers: [VersionsController],
  providers: [VersionsService, ImageUpscaleService],
})
export class VersionsModule {}
