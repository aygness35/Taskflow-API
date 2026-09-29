import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import {
  IsBoolean,
  IsHexColor,
  IsInt,
  IsString,
  IsUUID,
  Length,
  Max,
  Min,
  ValidateIf,
} from 'class-validator';

export class CreateLabelDto {
  @ApiProperty({ example: 'Backend' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 30)
  name!: string;

  @ApiProperty({ example: '#7d8d65' })
  @IsHexColor()
  color!: string;
}

export class AssignLabelDto {
  @ApiProperty({ format: 'uuid' })
  @IsUUID('4')
  labelId!: string;
}

export class CreateChecklistItemDto {
  @ApiProperty({ example: 'API testlerini tamamla' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 180)
  title!: string;
}

export class UpdateChecklistItemDto extends PartialType(
  CreateChecklistItemDto,
) {
  @ApiPropertyOptional()
  @ValidateIf((_o, value) => value !== undefined)
  @IsBoolean()
  completed?: boolean;

  @ApiPropertyOptional({ minimum: 0, maximum: 10000 })
  @ValidateIf((_o, value) => value !== undefined)
  @IsInt()
  @Min(0)
  @Max(10000)
  position?: number;
}

export class SearchWorkspaceDto {
  @ApiProperty({ example: 'tasarım' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  q!: string;
}
