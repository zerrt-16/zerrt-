import { Module } from "@nestjs/common";

import { AssetsModule } from "../assets/assets.module";
import { MessagesController } from "./messages.controller";
import { MessagesService } from "./messages.service";

@Module({
  imports: [AssetsModule],
  controllers: [MessagesController],
  providers: [MessagesService],
})
export class MessagesModule {}
