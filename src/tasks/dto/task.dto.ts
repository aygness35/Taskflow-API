import {
  ApiProperty,
  ApiPropertyOptional,
  PartialType,
  IntersectionType,
} from '@nestjs/swagger';
import { VersionDto } from '../../common/version.dto';
import { IsDateTime } from '../../common/date-time.validator';
import { Transform } from 'class-transformer';
import {
  IsEnum,
  IsIn,
  IsString,
  IsUUID,
  Length,
  MaxLength,
  ValidateIf,
} from 'class-validator';
import { PaginationDto } from '../../common/pagination.dto';
import { Priority, Recurrence, TaskStatus } from '../../common/enums';
export class CreateTaskDto {
  @ApiProperty({
    minLength: 3,
    maxLength: 150,
    example: 'Implement workspace access checks',
  })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(3, 150)
  title!: string;
  @ApiPropertyOptional({ maxLength: 2000, nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsString()
  @MaxLength(2000)
  description?: string | null;
  @ApiPropertyOptional({ enum: TaskStatus, default: TaskStatus.TODO })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;
  @ApiPropertyOptional({ enum: Priority, default: Priority.MEDIUM })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(Priority)
  priority?: Priority;
  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsDateTime()
  dueDate?: string | null;
  @ApiPropertyOptional({ type: String, format: 'uuid', nullable: true })
  @ValidateIf((_o, v) => v !== undefined && v !== null)
  @IsUUID('4')
  assigneeId?: string | null;

  @ApiPropertyOptional({ enum: Recurrence, nullable: true })
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsEnum(Recurrence)
  recurrence?: Recurrence | null;

  @ApiPropertyOptional({ type: String, format: 'date-time', nullable: true })
  @ValidateIf((_o, value) => value !== undefined && value !== null)
  @IsDateTime()
  recurrenceEnd?: string | null;
}
export class UpdateTaskDto extends IntersectionType(
  PartialType(CreateTaskDto, {
    skipNullProperties: false,
  }),
  VersionDto,
) {}
export class AssignTaskDto extends VersionDto {
  @ApiProperty({
    type: String,
    format: 'uuid',
    nullable: true,
    description: 'Workspace member user ID, or null to unassign',
  })
  @ValidateIf((_o, v) => v !== null)
  @IsUUID('4')
  assigneeId!: string | null;
}
export class ListTasksDto extends PaginationDto {
  @ApiPropertyOptional({ enum: TaskStatus })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;
  @ApiPropertyOptional({ enum: Priority })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(Priority)
  priority?: Priority;
  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID('4')
  assigneeId?: string;
  @ApiPropertyOptional({ maxLength: 150 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(150)
  search?: string;
  @ApiPropertyOptional({
    enum: ['createdAt', 'updatedAt', 'dueDate', 'title'],
    default: 'createdAt',
  })
  @IsIn(['createdAt', 'updatedAt', 'dueDate', 'title'])
  sortBy: 'createdAt' | 'updatedAt' | 'dueDate' | 'title' = 'createdAt';
  @ApiPropertyOptional({ enum: ['asc', 'desc'], default: 'desc' })
  @IsIn(['asc', 'desc'])
  sortOrder: 'asc' | 'desc' = 'desc';
}

export class CalendarTasksDto {
  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateTime()
  from!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  @IsDateTime()
  to!: string;

  @ApiPropertyOptional({ enum: TaskStatus })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(TaskStatus)
  status?: TaskStatus;

  @ApiPropertyOptional({ enum: Priority })
  @ValidateIf((_o, v) => v !== undefined)
  @IsEnum(Priority)
  priority?: Priority;

  @ApiPropertyOptional({ format: 'uuid' })
  @ValidateIf((_o, v) => v !== undefined)
  @IsUUID('4')
  assigneeId?: string;

  @ApiPropertyOptional({ maxLength: 150 })
  @ValidateIf((_o, v) => v !== undefined)
  @IsString()
  @MaxLength(150)
  search?: string;
}
