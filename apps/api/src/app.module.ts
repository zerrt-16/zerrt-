import { Module } from "@nestjs/common";
import { ConfigModule } from "@nestjs/config";

import { AgentModule } from "./agent/agent.module";
import { AssetsModule } from "./assets/assets.module";
import { GenerationModule } from "./generation/generation.module";
import { HealthModule } from "./health/health.module";
import { MessagesModule } from "./messages/messages.module";
import { PrismaModule } from "./prisma/prisma.module";
import { ProjectsModule } from "./projects/projects.module";
import { UploadModule } from "./upload/upload.module";
import { VersionsModule } from "./versions/versions.module";

@Module({
  imports: [
    ConfigModule.forRoot({
      isGlobal: true,
      envFilePath: [".env.local", ".env"],
    }),
    AgentModule,
    PrismaModule,
    AssetsModule,
    GenerationModule,
    HealthModule,
    ProjectsModule,
    MessagesModule,
    UploadModule,
    VersionsModule,
  ],
})
export class AppModule {}
