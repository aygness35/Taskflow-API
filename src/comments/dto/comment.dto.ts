import { ApiProperty, PartialType } from '@nestjs/swagger';
import { Transform } from 'class-transformer';
import { IsString, Length } from 'class-validator';
export class CreateCommentDto {
  @ApiProperty({ minLength: 1, maxLength: 2000, example: 'Ready for review.' })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(1, 2000)
  content!: string;
}
export class UpdateCommentDto extends PartialType(CreateCommentDto, {
  skipNullProperties: false,
}) {}
