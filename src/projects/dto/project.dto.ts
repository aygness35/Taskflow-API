import {
  ApiPropertyOptional,
  PartialType,
  IntersectionType,
} from '@nestjs/swagger';
import { VersionDto } from '../../common/version.dto';
import { IsEnum, IsString, MaxLength, ValidateIf } from 'class-validator';
import { CreateWorkspaceDto } from '../../workspaces/dto/workspace.dto';
import { PaginationDto } from '../../common/pagination.dto';
import { ProjectStatus } from '../../common/enums';
export class CreateProjectDto extends CreateWorkspaceDto {
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;
  @ApiPropertyOptional({ enum: ProjectStatus, default: ProjectStatus.ACTIVE })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
export class UpdateProjectDto extends IntersectionType(
  PartialType(CreateProjectDto, {
    skipNullProperties: false,
  }),
  VersionDto,
) {}
export class ListProjectsDto extends PaginationDto {
  @ApiPropertyOptional({ enum: ProjectStatus })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(ProjectStatus)
  status?: ProjectStatus;
}
