import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CreateProjectDto } from "./dto/create-project.dto";
import { ProjectIdParamDto } from "./dto/project-id-param.dto";
import { ProjectsService } from "./projects.service";

@Controller("projects")
export class ProjectsController {
  constructor(private readonly projectsService: ProjectsService) {}

  @Post()
  create(@Body() createProjectDto: CreateProjectDto) {
    return this.projectsService.create(createProjectDto);
  }

  @Get()
  findAll() {
    return this.projectsService.findAll();
  }

  @Get(":id")
  findOne(@Param() params: ProjectIdParamDto) {
    return this.projectsService.findOne(params.id);
  }
}
