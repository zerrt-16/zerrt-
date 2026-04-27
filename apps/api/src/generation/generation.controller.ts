import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { CreateGenerationTaskDto } from "./dto/create-generation-task.dto";
import { TaskIdParamDto } from "./dto/task-id-param.dto";
import { GenerationService } from "./generation.service";

@Controller()
export class GenerationController {
  constructor(private readonly generationService: GenerationService) {}

  @Post("generate")
  create(@Body() createGenerationTaskDto: CreateGenerationTaskDto) {
    return this.generationService.createTask(createGenerationTaskDto);
  }

  @Get("tasks/:id")
  findOne(@Param() params: TaskIdParamDto) {
    return this.generationService.getTask(params.id);
  }
}
