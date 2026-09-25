import {
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Access } from '../common/decorators';
import { Role } from '../common/enums';
import { publicUserSelect } from '../users/user.entity';
import {
  AddMemberDto,
  CreateWorkspaceDto,
  MemberRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';
@Injectable()
export class WorkspacesService {
  constructor(private readonly prisma: PrismaService) {}
  create(userId: string, dto: CreateWorkspaceDto) {
    return this.prisma.workspace.create({
      data: {
        ...dto,
        ownerId: userId,
        members: { create: { userId, role: Role.OWNER } },
      },
    });
  }
  list(userId: string) {
    return this.prisma.workspace.findMany({
      where: { members: { some: { userId } } },
      orderBy: [{ createdAt: 'desc' }, { id: 'asc' }],
    });
  }
  get(id: string) {
    return this.prisma.workspace.findUniqueOrThrow({ where: { id } });
  }
  update(id: string, dto: UpdateWorkspaceDto) {
    return this.prisma.workspace.update({ where: { id }, data: dto });
  }
  async remove(id: string) {
    await this.prisma.workspace.delete({ where: { id } });
  }
  members(workspaceId: string) {
    return this.prisma.workspaceMember.findMany({
      where: { workspaceId },
      include: { user: { select: publicUserSelect } },
      orderBy: [{ joinedAt: 'asc' }, { id: 'asc' }],
    });
  }
  async addMember(access: Access, dto: AddMemberDto) {
    if (access.role === Role.ADMIN && dto.role !== Role.MEMBER)
      throw new ForbiddenException('Only owners can appoint administrators');
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
      select: { id: true },
    });
    if (!user) throw new NotFoundException('User not found');
    return this.prisma.workspaceMember.create({
      data: {
        workspaceId: access.workspaceId,
        userId: user.id,
        role: dto.role,
      },
      include: { user: { select: publicUserSelect } },
    });
  }
  async changeRole(access: Access, memberId: string, dto: MemberRoleDto) {
    const target = await this.member(access.workspaceId, memberId);
    if (target.role === Role.OWNER)
      throw new ForbiddenException('Workspace ownership cannot be changed');
    if (
      access.role === Role.ADMIN &&
      (target.role !== Role.MEMBER || dto.role !== Role.MEMBER)
    )
      throw new ForbiddenException('Only owners can manage administrators');
    return this.prisma.workspaceMember.update({
      where: { id: target.id },
      data: dto,
    });
  }
  async removeMember(access: Access, memberId: string) {
    const target = await this.member(access.workspaceId, memberId);
    if (target.role === Role.OWNER)
      throw new ForbiddenException('Owner cannot leave or be removed');
    const self = target.userId === access.userId;
    if (
      !self &&
      (access.role === Role.MEMBER ||
        (access.role === Role.ADMIN && target.role !== Role.MEMBER))
    )
      throw new ForbiddenException('Insufficient workspace role');
    await this.prisma.$transaction(async (tx) => {
      await tx.task.updateMany({
        where: {
          assigneeId: target.userId,
          project: { workspaceId: access.workspaceId },
        },
        data: { assigneeId: null },
      });
      await tx.workspaceMember.delete({ where: { id: target.id } });
    });
  }
  private async member(workspaceId: string, id: string) {
    const member = await this.prisma.workspaceMember.findFirst({
      where: { id, workspaceId },
    });
    if (!member)
      throw new NotFoundException('Member not found in this workspace');
    return member;
  }
}
