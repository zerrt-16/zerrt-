import { Injectable } from "@nestjs/common";
import { copyFile, mkdir, writeFile } from "node:fs/promises";
import { extname, join, resolve } from "node:path";
import { randomUUID } from "node:crypto";

type SaveFileInput = {
  buffer: Buffer;
  projectId: string;
  originalName: string;
};

type SaveGeneratedFileInput = {
  projectId: string;
  originalName: string;
  buffer?: Buffer;
  sourceFilePath?: string;
};

@Injectable()
export class LocalUploadStorageService {
  private readonly uploadsRoot = resolve(process.cwd(), "uploads");

  async saveProjectUpload(input: SaveFileInput) {
    const targetDirectory = join(this.uploadsRoot, "projects", input.projectId, "uploads");
    const originalExtension = extname(input.originalName).toLowerCase();
    const safeExtension = originalExtension || ".bin";
    const fileName = `${randomUUID()}${safeExtension}`;

    await mkdir(targetDirectory, { recursive: true });

    const absoluteFilePath = join(targetDirectory, fileName);
    await writeFile(absoluteFilePath, input.buffer);

    return {
      absoluteFilePath,
      relativeFileUrl: `/uploads/projects/${input.projectId}/uploads/${fileName}`,
    };
  }

  async saveGeneratedOutput(input: SaveGeneratedFileInput) {
    const targetDirectory = join(this.uploadsRoot, "projects", input.projectId, "outputs");
    const originalExtension = extname(input.originalName).toLowerCase();
    const safeExtension = originalExtension || ".bin";
    const fileName = `${randomUUID()}${safeExtension}`;

    await mkdir(targetDirectory, { recursive: true });

    const absoluteFilePath = join(targetDirectory, fileName);

    if (input.buffer) {
      await writeFile(absoluteFilePath, input.buffer);
    } else if (input.sourceFilePath) {
      await copyFile(input.sourceFilePath, absoluteFilePath);
    }

    return {
      absoluteFilePath,
      relativeFileUrl: `/uploads/projects/${input.projectId}/outputs/${fileName}`,
    };
  }

  resolveUploadsFilePath(fileUrl: string) {
    const normalized = fileUrl.replace(/^\/uploads\//, "");
    return join(this.uploadsRoot, normalized);
  }
}
