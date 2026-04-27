import { Controller, Get, Param } from "@nestjs/common";

import { ProjectIdParamDto } from "../projects/dto/project-id-param.dto";
import { VersionsService } from "./versions.service";

@Controller("projects/:id/versions")
export class VersionsController {
  constructor(private readonly versionsService: VersionsService) {}

  @Get()
  findAll(@Param() params: ProjectIdParamDto) {
    return this.versionsService.findAllByProject(params.id);
  }
}
