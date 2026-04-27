import { BadRequestException, Injectable, NotFoundException } from "@nestjs/common";
import { AssetType } from "@prisma/client";
import { imageSize } from "image-size";

import { AssetsService } from "../assets/assets.service";
import { PrismaService } from "../prisma/prisma.service";
import { UploadFileDto } from "./dto/upload-file.dto";
import { LocalUploadStorageService } from "./storage/local-upload-storage.service";

type UploadFile = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

const MAX_UPLOAD_SIZE_BYTES = 10 * 1024 * 1024;
const SUPPORTED_MIME_TYPES = new Set([
  "image/png",
  "image/jpg",
  "image/jpeg",
  "image/webp",
]);

@Injectable()
export class UploadService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly assetsService: AssetsService,
    private readonly localUploadStorageService: LocalUploadStorageService,
  ) {}

  async uploadImage(uploadFileDto: UploadFileDto, file?: UploadFile | null) {
    if (!file) {
      throw new BadRequestException("Please upload a single image file.");
    }

    if (!SUPPORTED_MIME_TYPES.has(file.mimetype)) {
      throw new BadRequestException("Unsupported file type. Please upload png, jpg, jpeg, or webp.");
    }

    if (file.size > MAX_UPLOAD_SIZE_BYTES) {
      throw new BadRequestException("File is too large. The maximum allowed size is 10MB.");
    }

    const project = await this.prisma.agentProject.findUnique({
      where: {
        id: uploadFileDto.projectId,
      },
      select: {
        id: true,
      },
    });

    if (!project) {
      throw new NotFoundException(`Project ${uploadFileDto.projectId} not found.`);
    }

    const dimensions = imageSize(file.buffer);

    if (!dimensions.width || !dimensions.height) {
      throw new BadRequestException("Could not read image dimensions from the uploaded file.");
    }

    const savedFile = await this.localUploadStorageService.saveProjectUpload({
      buffer: file.buffer,
      projectId: uploadFileDto.projectId,
      originalName: file.originalname,
    });

    const asset = await this.assetsService.create({
      projectId: uploadFileDto.projectId,
      type: AssetType.upload,
      fileUrl: savedFile.relativeFileUrl,
      mimeType: file.mimetype,
      width: dimensions.width,
      height: dimensions.height,
      sizeBytes: file.size,
    });

    return {
      assetId: asset.id,
      fileUrl: asset.fileUrl,
      mimeType: asset.mimeType,
      width: asset.width,
      height: asset.height,
      sizeBytes: asset.sizeBytes,
    };
  }
}
