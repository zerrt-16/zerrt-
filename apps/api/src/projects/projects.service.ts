import { Injectable, NotFoundException } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";
import { CreateProjectDto } from "./dto/create-project.dto";

const projectSelect = {
  id: true,
  title: true,
  description: true,
  createdAt: true,
  updatedAt: true,
} as const;

@Injectable()
export class ProjectsService {
  constructor(private readonly prisma: PrismaService) {}

  async create(createProjectDto: CreateProjectDto) {
    return this.prisma.agentProject.create({
      data: {
        title: createProjectDto.title,
        description: createProjectDto.description ?? null,
        conversation: {
          create: {},
        },
      },
      select: projectSelect,
    });
  }

  async findAll() {
    return this.prisma.agentProject.findMany({
      orderBy: {
        updatedAt: "desc",
      },
      select: projectSelect,
    });
  }

  async findOne(id: string) {
    const project = await this.prisma.agentProject.findUnique({
      where: { id },
      select: projectSelect,
    });

    if (!project) {
      throw new NotFoundException(`Project ${id} not found.`);
    }

    return project;
  }
}
