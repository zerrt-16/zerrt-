import { Controller, Get } from "@nestjs/common";

import { ImageModelRegistryService } from "./image-model-registry.service";

@Controller("image-models")
export class ImageModelsController {
  constructor(private readonly imageModelRegistryService: ImageModelRegistryService) {}

  @Get()
  findAll() {
    return this.imageModelRegistryService.listEnabled();
  }
}
