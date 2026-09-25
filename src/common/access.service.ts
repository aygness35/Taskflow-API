import { ForbiddenException, Injectable } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Access, ResourceKind } from './decorators';
import { Role } from './enums';
@Injectable()
export class AccessService {
  constructor(private readonly prisma: PrismaService) {}
  async resolve(
    kind: ResourceKind,
    id: string,
    userId: string,
  ): Promise<Access> {
    let workspaceId: string | undefined;
    if (kind === 'workspace') workspaceId = id;
    if (kind === 'project')
      workspaceId = (
        await this.prisma.project.findUnique({
          where: { id },
          select: { workspaceId: true },
        })
      )?.workspaceId;
    if (kind === 'task')
      workspaceId = (
        await this.prisma.task.findUnique({
          where: { id },
          select: { project: { select: { workspaceId: true } } },
        })
      )?.project.workspaceId;
    if (kind === 'comment')
      workspaceId = (
        await this.prisma.comment.findUnique({
          where: { id },
          select: {
            task: { select: { project: { select: { workspaceId: true } } } },
          },
        })
      )?.task.project.workspaceId;
    if (!workspaceId) throw new ForbiddenException('Workspace access denied');
    const member = await this.prisma.workspaceMember.findUnique({
      where: { workspaceId_userId: { workspaceId, userId } },
    });
    if (!member) throw new ForbiddenException('Workspace access denied');
    return { workspaceId, userId, role: member.role as Role };
  }
}
