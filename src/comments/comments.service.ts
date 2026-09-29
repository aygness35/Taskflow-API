import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { versionMatch, versionStamp, withVersion } from '../common/version';
import { Access } from '../common/decorators';
import { Role } from '../common/enums';
import { paginated, pagination, PaginationDto } from '../common/pagination.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
@Injectable()
export class CommentsService {
  constructor(private readonly prisma: PrismaService) {}
  async create(taskId: string, access: Access, dto: CreateCommentDto) {
    return this.prisma.$transaction(async (tx) => {
      const task = await tx.task.findUniqueOrThrow({
        where: { id: taskId },
        select: { title: true, assigneeId: true, createdById: true },
      });
      const comment = await tx.comment.create({
        data: { ...dto, taskId, authorId: access.userId },
      });
      await tx.activityLog.create({
        data: {
          workspaceId: access.workspaceId,
          taskId,
          actorId: access.userId,
          action: 'COMMENT_ADDED',
          details: dto.content.slice(0, 120),
        },
      });
      const recipients = [
        ...new Set([task.assigneeId, task.createdById]),
      ].filter((id): id is string => !!id && id !== access.userId);
      if (recipients.length)
        await tx.notification.createMany({
          data: recipients.map((userId) => ({
            userId,
            taskId,
            type: 'COMMENT_ADDED',
            title: 'Göreve yeni yorum',
            message: task.title,
          })),
        });
      return comment;
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
    const { expectedUpdatedAt, ...data } = dto;
    return withVersion(expectedUpdatedAt, () =>
      this.prisma.comment.update({
        where: { id, ...versionMatch(expectedUpdatedAt) },
        data: { ...data, ...versionStamp(expectedUpdatedAt) },
      }),
    );
  }
  async remove(id: string, access: Access, expectedUpdatedAt: string) {
    const comment = await this.prisma.comment.findUniqueOrThrow({
      where: { id },
    });
    if (comment.authorId !== access.userId && access.role === Role.MEMBER)
      throw new ForbiddenException(
        'Only the author or workspace administrators can delete this comment',
      );
    await withVersion(expectedUpdatedAt, () =>
      this.prisma.comment.delete({
        where: { id, ...versionMatch(expectedUpdatedAt) },
      }),
    );
  }
}
