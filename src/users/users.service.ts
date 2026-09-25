import { Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { UserEntity, publicUserSelect } from './user.entity';
import { UpdateUserDto } from './dto/update-user.dto';
@Injectable()
export class UsersService {
  constructor(private readonly prisma: PrismaService) {}
  async me(id: string) {
    return new UserEntity(
      await this.prisma.user.findUniqueOrThrow({
        where: { id },
        select: publicUserSelect,
      }),
    );
  }
  async update(id: string, dto: UpdateUserDto) {
    return new UserEntity(
      await this.prisma.user.update({
        where: { id },
        data: dto,
        select: publicUserSelect,
      }),
    );
  }
}
