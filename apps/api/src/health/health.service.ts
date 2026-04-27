import { Injectable } from "@nestjs/common";

import { PrismaService } from "../prisma/prisma.service";

@Injectable()
export class HealthService {
  constructor(private readonly prisma: PrismaService) {}

  async getStatus() {
    const databaseConnected = await this.prisma.checkConnection();

    return {
      status: databaseConnected ? "ok" : "degraded",
      service: "ai-agent-api",
      database: databaseConnected ? "connected" : "disconnected",
      timestamp: new Date().toISOString(),
    };
  }
}
