import { Transform } from "class-transformer";
import { IsIn, IsOptional, IsString, MaxLength } from "class-validator";

export class CreateMessageDto {
  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    return value.trim().toLowerCase();
  })
  @IsOptional()
  @IsString()
  @IsIn(["user", "assistant", "system"])
  role?: string;

  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(4000)
  content?: string;

  @Transform(({ value }) => {
    if (typeof value !== "string") {
      return value;
    }

    const trimmed = value.trim();
    return trimmed.length > 0 ? trimmed : undefined;
  })
  @IsOptional()
  @IsString()
  @MaxLength(191)
  attachmentAssetId?: string;
}
