import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { ProjectIdParamDto } from "../projects/dto/project-id-param.dto";
import { UpscaleVersionDto } from "./dto/upscale-version.dto";
import { ImageUpscaleService } from "./image-upscale.service";
import { VersionsService } from "./versions.service";

@Controller("projects/:id/versions")
export class VersionsController {
  constructor(
    private readonly versionsService: VersionsService,
    private readonly imageUpscaleService: ImageUpscaleService,
  ) {}

  @Get()
  findAll(@Param() params: ProjectIdParamDto) {
    return this.versionsService.findAllByProject(params.id);
  }

  @Post(":versionId/upscale")
  upscale(
    @Param("id") projectId: string,
    @Param("versionId") versionId: string,
    @Body() dto: UpscaleVersionDto,
  ) {
    return this.imageUpscaleService.createUpscaleTask({
      projectId,
      versionId,
      dto,
    });
  }
}
