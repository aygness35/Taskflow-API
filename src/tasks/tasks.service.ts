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
  CalendarTasksDto,
  CreateTaskDto,
  ListTasksDto,
  UpdateTaskDto,
} from './dto/task.dto';
@Injectable()
export class TasksService {
  constructor(private readonly prisma: PrismaService) {}
  async create(
    projectId: string,
    access: Access,
    dto: CreateTaskDto,
    parentId?: string,
  ) {
    if (dto.dueDate && new Date(dto.dueDate).getTime() < Date.now())
      throw new BadRequestException(
        'dueDate cannot be in the past when creating a task',
      );
    return this.prisma.$transaction(async (tx) => {
      await this.validateAssignee(tx, access.workspaceId, dto.assigneeId);
      const task = await tx.task.create({
        data: {
          ...dto,
          dueDate: dto.dueDate ? new Date(dto.dueDate) : null,
          recurrenceEnd: dto.recurrenceEnd ? new Date(dto.recurrenceEnd) : null,
          projectId,
          parentId,
          createdById: access.userId,
        },
        include: {
          labels: { include: { label: true } },
          subtasks: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
      });
      await tx.activityLog.create({
        data: {
          workspaceId: access.workspaceId,
          taskId: task.id,
          actorId: access.userId,
          action: 'TASK_CREATED',
          details: task.title,
        },
      });
      if (task.assigneeId && task.assigneeId !== access.userId)
        await tx.notification.create({
          data: {
            userId: task.assigneeId,
            taskId: task.id,
            type: 'TASK_ASSIGNED',
            title: 'Yeni görev atandı',
            message: task.title,
          },
        });
      return task;
    });
  }
  async list(projectId: string, q: ListTasksDto) {
    const where: Prisma.TaskWhereInput = {
      projectId,
      parentId: null,
      deletedAt: null,
      archivedAt: null,
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
        include: {
          labels: { include: { label: true } },
          subtasks: {
            where: { deletedAt: null },
            orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
          },
        },
        ...pagination(q),
        orderBy: [{ [q.sortBy]: q.sortOrder }, { id: 'asc' }],
      }),
      this.prisma.task.count({ where }),
    ]);
    return paginated(data, total, q);
  }
  async calendar(projectId: string, q: CalendarTasksDto) {
    const from = new Date(q.from);
    const to = new Date(q.to);
    if (from >= to)
      throw new BadRequestException('calendar range must end after it starts');
    if (to.getTime() - from.getTime() > 62 * 24 * 60 * 60 * 1000)
      throw new BadRequestException('calendar range cannot exceed 62 days');
    return this.prisma.task.findMany({
      where: {
        projectId,
        deletedAt: null,
        archivedAt: null,
        dueDate: { gte: from, lt: to },
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
      },
      include: {
        assignee: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
      },
      orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
    });
  }
  get(id: string) {
    return this.prisma.task.findUniqueOrThrow({
      where: { id },
      include: {
        labels: { include: { label: true } },
        subtasks: {
          where: { deletedAt: null },
          orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
        },
      },
    });
  }
  async update(id: string, access: Access, dto: UpdateTaskDto) {
    const { expectedUpdatedAt, ...data } = dto;
    return this.prisma.$transaction(async (tx) => {
      const before = await tx.task.findUniqueOrThrow({ where: { id } });
      await this.validateAssignee(tx, access.workspaceId, dto.assigneeId);
      const task = await withVersion(expectedUpdatedAt, () =>
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
            recurrenceEnd:
              dto.recurrenceEnd === undefined
                ? undefined
                : dto.recurrenceEnd === null
                  ? null
                  : new Date(dto.recurrenceEnd),
          },
          include: {
            labels: { include: { label: true } },
            subtasks: {
              where: { deletedAt: null },
              orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
            },
          },
        }),
      );
      const changed = Object.keys(data).filter(
        (key) =>
          key !== 'expectedUpdatedAt' &&
          JSON.stringify(before[key as keyof typeof before]) !==
            JSON.stringify(task[key as keyof typeof task]),
      );
      await tx.activityLog.create({
        data: {
          workspaceId: access.workspaceId,
          taskId: id,
          actorId: access.userId,
          action: 'TASK_UPDATED',
          details: changed.join(', '),
        },
      });
      if (
        dto.assigneeId !== undefined &&
        dto.assigneeId !== before.assigneeId &&
        dto.assigneeId &&
        dto.assigneeId !== access.userId
      )
        await tx.notification.create({
          data: {
            userId: dto.assigneeId,
            taskId: id,
            type: 'TASK_ASSIGNED',
            title: 'Görev sana atandı',
            message: task.title,
          },
        });
      if (
        before.status !== 'DONE' &&
        task.status === 'DONE' &&
        task.recurrence
      ) {
        const nextDue = this.nextOccurrence(
          task.dueDate || new Date(),
          task.recurrence,
        );
        if (!task.recurrenceEnd || nextDue <= task.recurrenceEnd) {
          const next = await tx.task.create({
            data: {
              projectId: task.projectId,
              parentId: task.parentId,
              title: task.title,
              description: task.description,
              status: 'TODO',
              priority: task.priority,
              dueDate: nextDue,
              assigneeId: task.assigneeId,
              createdById: task.createdById,
              recurrence: task.recurrence,
              recurrenceEnd: task.recurrenceEnd,
              labels: {
                create: task.labels.map((item) => ({ labelId: item.labelId })),
              },
            },
          });
          await tx.activityLog.create({
            data: {
              workspaceId: access.workspaceId,
              taskId: next.id,
              actorId: access.userId,
              action: 'RECURRENCE_CREATED',
              details: task.title,
            },
          });
        }
      }
      return task;
    });
  }
  assign(id: string, access: Access, dto: AssignTaskDto) {
    return this.update(id, access, dto);
  }
  async createSubtask(id: string, access: Access, dto: CreateTaskDto) {
    const parent = await this.prisma.task.findUniqueOrThrow({
      where: { id },
      select: { projectId: true },
    });
    return this.create(parent.projectId, access, dto, id);
  }
  subtasks(id: string) {
    return this.prisma.task.findMany({
      where: { parentId: id, deletedAt: null },
      include: { labels: { include: { label: true } } },
      orderBy: [{ createdAt: 'asc' }, { id: 'asc' }],
    });
  }
  async lifecycle(
    id: string,
    access: Access,
    expectedUpdatedAt: string,
    action: 'archive' | 'trash' | 'restore',
  ) {
    const task = await this.get(id);
    if (
      action === 'trash' &&
      access.role === Role.MEMBER &&
      task.createdById !== access.userId
    )
      throw new ForbiddenException(
        'Only the creator or workspace administrators can move this task to trash',
      );
    const updated = await withVersion(expectedUpdatedAt, () =>
      this.prisma.task.update({
        where: { id, ...versionMatch(expectedUpdatedAt) },
        data:
          action === 'archive'
            ? { archivedAt: new Date(), ...versionStamp(expectedUpdatedAt) }
            : action === 'trash'
              ? { deletedAt: new Date(), ...versionStamp(expectedUpdatedAt) }
              : {
                  archivedAt: null,
                  deletedAt: null,
                  ...versionStamp(expectedUpdatedAt),
                },
      }),
    );
    await this.prisma.activityLog.create({
      data: {
        workspaceId: access.workspaceId,
        taskId: id,
        actorId: access.userId,
        action:
          action === 'archive'
            ? 'TASK_ARCHIVED'
            : action === 'trash'
              ? 'TASK_TRASHED'
              : 'TASK_RESTORED',
      },
    });
    return updated;
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
  private nextOccurrence(value: Date, recurrence: string) {
    const next = new Date(value);
    if (recurrence === 'DAILY') next.setDate(next.getDate() + 1);
    if (recurrence === 'WEEKLY') next.setDate(next.getDate() + 7);
    if (recurrence === 'MONTHLY') next.setMonth(next.getMonth() + 1);
    return next;
  }
}
