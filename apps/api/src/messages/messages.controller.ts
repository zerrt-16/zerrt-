import { Body, Controller, Get, Param, Post } from "@nestjs/common";

import { ProjectIdParamDto } from "../projects/dto/project-id-param.dto";
import { CreateMessageDto } from "./dto/create-message.dto";
import { MessagesService } from "./messages.service";

@Controller("projects/:id/messages")
export class MessagesController {
  constructor(private readonly messagesService: MessagesService) {}

  @Post()
  create(
    @Param() params: ProjectIdParamDto,
    @Body() createMessageDto: CreateMessageDto,
  ) {
    return this.messagesService.create(params.id, createMessageDto);
  }

  @Get()
  findAll(@Param() params: ProjectIdParamDto) {
    return this.messagesService.findAllByProject(params.id);
  }
}
