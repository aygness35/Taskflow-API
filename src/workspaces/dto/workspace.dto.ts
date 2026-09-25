import { ApiProperty, PartialType, IntersectionType } from '@nestjs/swagger';
import { VersionDto } from '../../common/version.dto';
import { Transform } from 'class-transformer';
import { IsEmail, IsIn, IsString, Length, MaxLength } from 'class-validator';
import { Role } from '../../common/enums';
export class CreateWorkspaceDto {
  @ApiProperty({ example: 'Engineering', minLength: 2, maxLength: 100 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 100)
  name!: string;
}
export class UpdateWorkspaceDto extends IntersectionType(
  PartialType(CreateWorkspaceDto, {
    skipNullProperties: false,
  }),
  VersionDto,
) {}
export class MemberRoleDto {
  @ApiProperty({ enum: [Role.ADMIN, Role.MEMBER] })
  @IsIn([Role.ADMIN, Role.MEMBER])
  role!: Role.ADMIN | Role.MEMBER;
}
export class AddMemberDto extends MemberRoleDto {
  @ApiProperty({ example: 'member@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
}
