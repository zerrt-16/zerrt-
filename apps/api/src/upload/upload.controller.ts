import { Body, Controller, Post, UploadedFile, UseInterceptors } from "@nestjs/common";
import { FileInterceptor } from "@nestjs/platform-express";
import { memoryStorage } from "multer";

import { UploadFileDto } from "./dto/upload-file.dto";
import { UploadService } from "./upload.service";

type UploadedImageFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Controller("upload")
export class UploadController {
  constructor(private readonly uploadService: UploadService) {}

  @Post()
  @UseInterceptors(
    FileInterceptor("file", {
      storage: memoryStorage(),
    }),
  )
  upload(
    @Body() uploadFileDto: UploadFileDto,
    @UploadedFile() file?: UploadedImageFile,
  ) {
    return this.uploadService.uploadImage(uploadFileDto, file);
  }
}
