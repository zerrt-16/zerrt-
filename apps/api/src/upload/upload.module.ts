import { Module } from "@nestjs/common";

import { AssetsModule } from "../assets/assets.module";
import { UploadController } from "./upload.controller";
import { UploadService } from "./upload.service";
import { LocalUploadStorageService } from "./storage/local-upload-storage.service";

@Module({
  imports: [AssetsModule],
  controllers: [UploadController],
  providers: [UploadService, LocalUploadStorageService],
  exports: [LocalUploadStorageService],
})
export class UploadModule {}
