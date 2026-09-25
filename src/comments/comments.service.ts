import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Access } from '../common/decorators';
import { Role } from '../common/enums';
import { paginated, pagination, PaginationDto } from '../common/pagination.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}
  create(taskId: string, userId: string, dto: CreateCommentDto) {
    return this.prisma.comment.create({
      data: { ...dto, taskId, authorId: userId },
    });
  }
  async list(taskId: string, q: PaginationDto) {
    const where = { taskId };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.comment.findMany({
        where,
        ...pagination(q),
        orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
      }),
      this.prisma.comment.count({ where }),
    ]);
    return paginated(data, total, q);
  }
  async update(id: string, userId: string, dto: UpdateCommentDto) {
    const comment = await this.prisma.comment.findUniqueOrThrow({
      where: { id },
    });
    if (comment.authorId !== userId)
      throw new ForbiddenException('Only the author can edit this comment');
    return this.prisma.comment.update({ where: { id }, data: dto });
  }
  async remove(id: string, access: Access) {
    const comment = await this.prisma.comment.findUniqueOrThrow({
      where: { id },
    });
    if (comment.authorId !== access.userId && access.role === Role.MEMBER)
      throw new ForbiddenException(
        'Only the author or workspace administrators can delete this comment',
      );
    await this.prisma.comment.delete({ where: { id } });
  }
}
