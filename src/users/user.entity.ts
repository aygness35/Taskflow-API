import { Exclude } from 'class-transformer';
import { ApiProperty } from '@nestjs/swagger';
export const publicUserSelect = {
  id: true,
  email: true,
  name: true,
  createdAt: true,
  updatedAt: true,
} as const;
export class UserEntity {
  @ApiProperty({ format: 'uuid' }) id!: string;
  @ApiProperty({ example: 'alice@example.com' }) email!: string;
  @ApiProperty({ example: 'Alice' }) name!: string;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
  @Exclude() password?: string;
  @Exclude() tokenHash?: string;
  constructor(data: Partial<UserEntity>) {
    Object.assign(this, data);
  }
}
