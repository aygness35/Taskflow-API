import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { createHash, randomBytes } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { versionMatch, versionStamp, withVersion } from '../common/version';
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
    const { expectedUpdatedAt, ...data } = dto;
    return withVersion(expectedUpdatedAt, () =>
      this.prisma.workspace.update({
        where: { id, ...versionMatch(expectedUpdatedAt) },
        data: { ...data, ...versionStamp(expectedUpdatedAt) },
      }),
    );
  }
  async remove(id: string, expectedUpdatedAt: string) {
    await withVersion(expectedUpdatedAt, () =>
      this.prisma.workspace.delete({
        where: { id, ...versionMatch(expectedUpdatedAt) },
      }),
    );
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
  async invite(access: Access, dto: AddMemberDto) {
    if (access.role === Role.ADMIN && dto.role !== Role.MEMBER)
      throw new ForbiddenException('Only owners can appoint administrators');
    const token = randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + 7 * 86400000);
    const invite = await this.prisma.$transaction(async (tx) => {
      await tx.workspaceInvite.deleteMany({
        where: {
          workspaceId: access.workspaceId,
          email: dto.email,
          acceptedAt: null,
        },
      });
      return tx.workspaceInvite.create({
        data: {
          workspaceId: access.workspaceId,
          email: dto.email,
          role: dto.role,
          tokenHash: this.inviteHash(token),
          invitedById: access.userId,
          expiresAt,
        },
        select: { id: true, email: true, role: true, expiresAt: true },
      });
    });
    return { ...invite, token };
  }
  async invitePreview(token: string) {
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        tokenHash: this.inviteHash(token),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
      select: {
        email: true,
        role: true,
        expiresAt: true,
        workspace: { select: { id: true, name: true } },
        invitedBy: { select: { name: true } },
      },
    });
    if (!invite) throw new NotFoundException('Invitation not found or expired');
    return invite;
  }
  async acceptInvite(token: string, userId: string) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { email: true },
    });
    const invite = await this.prisma.workspaceInvite.findFirst({
      where: {
        tokenHash: this.inviteHash(token),
        acceptedAt: null,
        expiresAt: { gt: new Date() },
      },
    });
    if (!invite) throw new NotFoundException('Invitation not found or expired');
    if (invite.email !== user.email)
      throw new BadRequestException('Invitation email does not match this account');
    await this.prisma.$transaction([
      this.prisma.workspaceMember.upsert({
        where: {
          workspaceId_userId: { workspaceId: invite.workspaceId, userId },
        },
        create: {
          workspaceId: invite.workspaceId,
          userId,
          role: invite.role,
        },
        update: {},
      }),
      this.prisma.workspaceInvite.update({
        where: { id: invite.id },
        data: { acceptedAt: new Date() },
      }),
    ]);
    return this.get(invite.workspaceId);
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
  private inviteHash(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
}
