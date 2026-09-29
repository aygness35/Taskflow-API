import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Access } from '../common/decorators';
import { Role } from '../common/enums';
import {
  CreateChecklistItemDto,
  CreateLabelDto,
  UpdateChecklistItemDto,
} from './dto/task-extra.dto';

type UploadedAttachment = {
  originalname: string;
  mimetype: string;
  size: number;
  buffer: Buffer;
};

@Injectable()
export class TaskExtrasService {
  constructor(private readonly prisma: PrismaService) {}

  labels(workspaceId: string) {
    return this.prisma.label.findMany({
      where: { workspaceId },
      orderBy: [{ name: 'asc' }, { id: 'asc' }],
    });
  }

  createLabel(workspaceId: string, dto: CreateLabelDto) {
    return this.prisma.label.create({ data: { ...dto, workspaceId } });
  }

  async taskLabels(taskId: string) {
    return (
      await this.prisma.taskLabel.findMany({
        where: { taskId },
        include: { label: true },
        orderBy: { label: { name: 'asc' } },
      })
    ).map((item) => item.label);
  }

  async addLabel(taskId: string, access: Access, labelId: string) {
    const label = await this.prisma.label.findFirst({
      where: { id: labelId, workspaceId: access.workspaceId },
    });
    if (!label)
      throw new BadRequestException('Label must belong to this workspace');
    await this.prisma.$transaction([
      this.prisma.taskLabel.upsert({
        where: { taskId_labelId: { taskId, labelId } },
        create: { taskId, labelId },
        update: {},
      }),
      this.activity(access, taskId, 'LABEL_ADDED', label.name),
    ]);
    return label;
  }

  async removeLabel(taskId: string, access: Access, labelId: string) {
    const result = await this.prisma.taskLabel.deleteMany({
      where: { taskId, labelId },
    });
    if (!result.count) throw new NotFoundException('Task label not found');
    await this.activity(access, taskId, 'LABEL_REMOVED');
  }

  checklist(taskId: string) {
    return this.prisma.checklistItem.findMany({
      where: { taskId },
      orderBy: [{ position: 'asc' }, { createdAt: 'asc' }],
    });
  }

  async addChecklist(
    taskId: string,
    access: Access,
    dto: CreateChecklistItemDto,
  ) {
    const position = await this.prisma.checklistItem.count({
      where: { taskId },
    });
    const item = await this.prisma.checklistItem.create({
      data: { taskId, title: dto.title, position },
    });
    await this.activity(access, taskId, 'CHECKLIST_ADDED', dto.title);
    return item;
  }

  async updateChecklist(
    taskId: string,
    itemId: string,
    access: Access,
    dto: UpdateChecklistItemDto,
  ) {
    const result = await this.prisma.checklistItem.updateMany({
      where: { id: itemId, taskId },
      data: dto,
    });
    if (!result.count) throw new NotFoundException('Checklist item not found');
    await this.activity(
      access,
      taskId,
      dto.completed === undefined
        ? 'CHECKLIST_UPDATED'
        : dto.completed
          ? 'CHECKLIST_COMPLETED'
          : 'CHECKLIST_REOPENED',
      dto.title,
    );
    return this.prisma.checklistItem.findUniqueOrThrow({
      where: { id: itemId },
    });
  }

  async removeChecklist(taskId: string, itemId: string, access: Access) {
    const result = await this.prisma.checklistItem.deleteMany({
      where: { id: itemId, taskId },
    });
    if (!result.count) throw new NotFoundException('Checklist item not found');
    await this.activity(access, taskId, 'CHECKLIST_REMOVED');
  }

  activities(taskId: string) {
    return this.prisma.activityLog.findMany({
      where: { taskId },
      include: { actor: { select: { id: true, name: true, email: true } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
      take: 100,
    });
  }

  attachments(taskId: string) {
    return this.prisma.attachment.findMany({
      where: { taskId },
      select: {
        id: true,
        taskId: true,
        uploaderId: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
        uploader: { select: { id: true, name: true, email: true } },
      },
      orderBy: [{ createdAt: 'desc' }, { id: 'desc' }],
    });
  }

  async addAttachment(
    taskId: string,
    access: Access,
    file?: UploadedAttachment,
  ) {
    if (!file) throw new BadRequestException('File is required');
    const allowed = new Set([
      'image/png',
      'image/jpeg',
      'application/pdf',
      'text/plain',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    ]);
    if (!allowed.has(file.mimetype))
      throw new BadRequestException('Unsupported attachment type');
    const name = file.originalname.trim().slice(0, 180);
    if (!name) throw new BadRequestException('File name is required');
    const attachment = await this.prisma.attachment.create({
      data: {
        taskId,
        uploaderId: access.userId,
        name,
        mimeType: file.mimetype,
        size: file.size,
        data: Uint8Array.from(file.buffer),
      },
      select: {
        id: true,
        taskId: true,
        uploaderId: true,
        name: true,
        mimeType: true,
        size: true,
        createdAt: true,
      },
    });
    await this.activity(access, taskId, 'ATTACHMENT_ADDED', name);
    return attachment;
  }

  async attachment(taskId: string, attachmentId: string) {
    const item = await this.prisma.attachment.findFirst({
      where: { id: attachmentId, taskId },
    });
    if (!item) throw new NotFoundException('Attachment not found');
    return item;
  }

  async removeAttachment(taskId: string, attachmentId: string, access: Access) {
    const item = await this.attachment(taskId, attachmentId);
    if (access.role === Role.MEMBER && item.uploaderId !== access.userId)
      throw new ForbiddenException(
        'Only the uploader or workspace administrators can delete this attachment',
      );
    await this.prisma.attachment.delete({ where: { id: attachmentId } });
    await this.activity(access, taskId, 'ATTACHMENT_REMOVED', item.name);
  }

  async dashboard(workspaceId: string) {
    const [tasks, members] = await this.prisma.$transaction([
      this.prisma.task.findMany({
        where: {
          project: { workspaceId },
          deletedAt: null,
          archivedAt: null,
          parentId: null,
        },
        select: {
          status: true,
          priority: true,
          dueDate: true,
          assigneeId: true,
        },
      }),
      this.prisma.workspaceMember.findMany({
        where: { workspaceId },
        include: { user: { select: { id: true, name: true, email: true } } },
      }),
    ]);
    const now = Date.now();
    return {
      total: tasks.length,
      overdue: tasks.filter(
        (task) =>
          task.dueDate &&
          task.dueDate.getTime() < now &&
          task.status !== 'DONE',
      ).length,
      unassigned: tasks.filter((task) => !task.assigneeId).length,
      byStatus: this.countBy(tasks, 'status'),
      byPriority: this.countBy(tasks, 'priority'),
      byAssignee: members.map((member) => ({
        user: member.user,
        total: tasks.filter((task) => task.assigneeId === member.userId).length,
        completed: tasks.filter(
          (task) => task.assigneeId === member.userId && task.status === 'DONE',
        ).length,
      })),
    };
  }

  async search(workspaceId: string, query: string) {
    const match = { contains: query };
    const [projects, tasks, comments, memberships] =
      await this.prisma.$transaction([
        this.prisma.project.findMany({
          where: {
            workspaceId,
            OR: [{ name: match }, { description: match }],
          },
          select: { id: true, name: true, description: true, status: true },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          take: 8,
        }),
        this.prisma.task.findMany({
          where: {
            project: { workspaceId },
            deletedAt: null,
            archivedAt: null,
            OR: [{ title: match }, { description: match }],
          },
          select: {
            id: true,
            projectId: true,
            title: true,
            description: true,
            status: true,
            dueDate: true,
            project: { select: { name: true } },
            assignee: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ updatedAt: 'desc' }, { id: 'asc' }],
          take: 12,
        }),
        this.prisma.comment.findMany({
          where: {
            content: match,
            task: {
              project: { workspaceId },
              deletedAt: null,
              archivedAt: null,
            },
          },
          select: {
            id: true,
            content: true,
            createdAt: true,
            author: { select: { id: true, name: true } },
            task: {
              select: {
                id: true,
                title: true,
                projectId: true,
              },
            },
          },
          orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
          take: 8,
        }),
        this.prisma.workspaceMember.findMany({
          where: {
            workspaceId,
            OR: [
              { user: { name: match } },
              { user: { email: match } },
            ],
          },
          select: {
            id: true,
            role: true,
            user: { select: { id: true, name: true, email: true } },
          },
          orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
          take: 8,
        }),
      ]);
    return {
      query,
      total:
        projects.length + tasks.length + comments.length + memberships.length,
      projects,
      tasks,
      comments,
      members: memberships,
    };
  }

  lifecycleTasks(workspaceId: string, kind: 'archive' | 'trash') {
    return this.prisma.task.findMany({
      where: {
        project: { workspaceId },
        ...(kind === 'archive'
          ? { archivedAt: { not: null }, deletedAt: null }
          : { deletedAt: { not: null } }),
      },
      include: {
        project: { select: { id: true, name: true } },
        assignee: { select: { id: true, name: true, email: true } },
        labels: { include: { label: true } },
      },
      orderBy:
        kind === 'archive'
          ? [{ archivedAt: 'desc' }, { id: 'asc' }]
          : [{ deletedAt: 'desc' }, { id: 'asc' }],
    });
  }

  async exportCsv(workspaceId: string) {
    const tasks = await this.prisma.task.findMany({
      where: { project: { workspaceId }, deletedAt: null },
      include: {
        project: { select: { name: true } },
        assignee: { select: { name: true, email: true } },
        labels: { include: { label: true } },
        _count: { select: { checklist: true, subtasks: true } },
      },
      orderBy: [{ project: { name: 'asc' } }, { createdAt: 'asc' }],
    });
    const rows = [
      [
        'Proje',
        'Görev',
        'Durum',
        'Öncelik',
        'Sorumlu',
        'E-posta',
        'Son tarih',
        'Etiketler',
        'Kontrol maddesi',
        'Alt görev',
        'Arşivli',
      ],
      ...tasks.map((task) => [
        task.project.name,
        task.title,
        task.status,
        task.priority,
        task.assignee?.name || '',
        task.assignee?.email || '',
        task.dueDate?.toISOString() || '',
        task.labels.map((item) => item.label.name).join('; '),
        task._count.checklist.toString(),
        task._count.subtasks.toString(),
        task.archivedAt ? 'Evet' : 'Hayır',
      ]),
    ];
    return `\uFEFF${rows
      .map((row) => row.map((value) => this.csv(value)).join(','))
      .join('\r\n')}`;
  }

  private countBy<T extends Record<K, string>, K extends keyof T>(
    items: T[],
    key: K,
  ) {
    return items.reduce<Record<string, number>>((result, item) => {
      result[item[key]] = (result[item[key]] || 0) + 1;
      return result;
    }, {});
  }

  private csv(value: string) {
    return `"${value.replaceAll('"', '""')}"`;
  }

  private activity(
    access: Access,
    taskId: string,
    action: string,
    details?: string,
  ) {
    return this.prisma.activityLog.create({
      data: {
        workspaceId: access.workspaceId,
        taskId,
        actorId: access.userId,
        action,
        details,
      },
    });
  }
}
