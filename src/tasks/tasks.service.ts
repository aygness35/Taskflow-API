import {
  BadRequestException,
  ForbiddenException,
  Injectable,
} from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { PrismaService } from '../prisma/prisma.service';
import { versionMatch, versionStamp, withVersion } from '../common/version';
import { Access } from '../common/decorators';
import { Role } from '../common/enums';
import { paginated, pagination } from '../common/pagination.dto';
import {
  AssignTaskDto,
  CreateTaskDto,
  ListTasksDto,
  UpdateTaskDto,
} from './dto/task.dto';
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}
  async create(projectId: string, access: Access, dto: CreateTaskDto) {
    if (dto.dueDate && new Date(dto.dueDate).getTime() < Date.now())
      throw new BadRequestException(
        'dueDate cannot be in the past when creating a task',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.validateAssignee(tx, access.workspaceId, dto.assigneeId);
      return tx.task.create({
        data: {
          ...dto,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          projectId,
          createdById: access.userId,
        },
      });
    });
  }
  async list(projectId: string, q: ListTasksDto) {
    const where: Prisma.TaskWhereInput = {
      projectId,
      status: q.status,
      priority: q.priority,
      assigneeId: q.assigneeId,
      ...(q.search
        ? {
            OR: [
              { title: { contains: q.search } },
              { description: { contains: q.search } },
            ],
          }
        : {}),
    };
    const [data, total] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where,
        ...pagination(q),
        orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
      }),
      this.prisma.task.count({ where }),
    ]);
    return paginated(data, total, q);
  }
  get(id: string) {
    return this.prisma.task.findUniqueOrThrow({ where: { id } });
  }
  async update(id: string, access: Access, dto: UpdateTaskDto) {
    const { expectedUpdatedAt, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      await this.validateAssignee(tx, access.workspaceId, dto.assigneeId);
      return withVersion(expectedUpdatedAt, () =>
        tx.task.update({
          where: { id, ...versionMatch(expectedUpdatedAt) },
          data: {
            ...data,
            ...versionStamp(expectedUpdatedAt),
            dueDate:
              dto.dueDate === undefined
                ? undefined
                : dto.dueDate === null
                  ? null
                  : new Date(dto.dueDate),
          },
        }),
      );
    });
  }
  assign(id: string, access: Access, dto: AssignTaskDto) {
    return this.update(id, access, dto);
  }
  async remove(id: string, access: Access, expectedUpdatedAt: string) {
    const task = await this.get(id);
    if (access.role === Role.MEMBER && task.createdById !== access.userId)
      throw new ForbiddenException(
        'Only the creator or workspace administrators can delete this task',
      );
    await withVersion(expectedUpdatedAt, () =>
      this.prisma.task.delete({
        where: { id, ...versionMatch(expectedUpdatedAt) },
      }),
    );
  }
  private async validateAssignee(
    tx: Prisma.TransactionClient,
    workspaceId: string,
    userId?: string | null,
  ) {
    if (!userId) return;
    if (
      !(await tx.workspaceMember.findUnique({
        where: { workspaceId_userId: { workspaceId, userId } },
      }))
    )
      throw new BadRequestException(
        'Assignee must be a member of this workspace',
      );
  }
}
