import { ApiProperty } from '@nestjs/swagger';
import { IsDateTime } from './date-time.validator';

export class VersionDto {
  @ApiProperty({
    description:
      'The updatedAt value last read by the editor. A stale value returns 409.',
    format: 'date-time',
  })
  @IsDateTime()
  expectedUpdatedAt!: string;
}
