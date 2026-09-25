import { Transform } from 'class-transformer';
import { IsEmail, IsString, Length, Matches, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';
export class LoginDto {
  @ApiProperty({ example: 'alice@example.com' })
  @Transform(({ value }) =>
    typeof value === 'string' ? value.trim().toLowerCase() : value,
  )
  @IsEmail()
  @MaxLength(254)
  email!: string;
  @ApiProperty({ minLength: 8, maxLength: 72, example: 'StrongPassword1!' })
  @IsString()
  @Length(8, 72)
  password!: string;
}
export class RegisterDto extends LoginDto {
  @ApiProperty({ minLength: 8, maxLength: 72, example: 'StrongPassword1!' })
  @Matches(/^(?=.*[A-Z])(?=.*\d).+$/, {
    message: 'password must contain an uppercase letter and a digit',
  })
  declare password: string;
  @ApiProperty({ example: 'Alice', minLength: 2, maxLength: 50 })
  @Transform(({ value }) => (typeof value === 'string' ? value.trim() : value))
  @IsString()
  @Length(2, 50)
  name!: string;
}
export class RefreshDto {
  @ApiProperty({ description: 'Refresh JWT returned by login or register' })
  @IsString()
  @Length(1, 2048)
  refreshToken!: string;
}
export class TokenPairDto {
  @ApiProperty() accessToken!: string;
  @ApiProperty() refreshToken!: string;
}
