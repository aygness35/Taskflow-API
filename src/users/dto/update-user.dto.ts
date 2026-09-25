import { ApiPropertyOptional } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length, ValidateIf } from 'class-validator';
export class UpdateUserDto {
  @ApiPropertyOptional({ minLength: 2, maxLength: 50 })
  @ValidateIf((_o, v) => v !== undefined)
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  name?: string;
}
