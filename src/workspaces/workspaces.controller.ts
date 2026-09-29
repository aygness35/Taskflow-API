import { VersionDto } from '../common/version.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import {
  Access,
  CurrentAccess,
  CurrentUser,
  Public,
  Roles,
  WorkspaceResource,
} from '../common/decorators';
import { Role } from '../common/enums';
import {
  AddMemberDto,
  CreateWorkspaceDto,
  MemberRoleDto,
  UpdateWorkspaceDto,
} from './dto/workspace.dto';
import { WorkspacesService } from './workspaces.service';
@ApiTags('Workspaces')
@ApiBearerAuth()
@Controller('workspaces')
export class WorkspacesController {
  constructor(private readonly workspaces: WorkspacesService) {}
  @Post() create(
    @CurrentUser() userId: string,
    @Body() dto: CreateWorkspaceDto,
  ) {
    return this.workspaces.create(userId, dto);
  }
  @Get() list(@CurrentUser() userId: string) {
    return this.workspaces.list(userId);
  }
  @Get(':id') @WorkspaceResource('workspace') get(@Param('id') id: string) {
    return this.workspaces.get(id);
  }
  @Patch(':id')
  @WorkspaceResource('workspace')
  @Roles(Role.OWNER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateWorkspaceDto) {
    return this.workspaces.update(id, dto);
  }
  @Delete(':id')
  @WorkspaceResource('workspace')
  @Roles(Role.OWNER)
  @HttpCode(204)
  remove(@Param('id') id: string, @Query() version: VersionDto) {
    return this.workspaces.remove(id, version.expectedUpdatedAt);
  }
  @Get(':id/members') @WorkspaceResource('workspace') members(
    @Param('id') id: string,
  ) {
    return this.workspaces.members(id);
  }
  @Post(':id/members')
  @WorkspaceResource('workspace')
  @Roles(Role.OWNER, Role.ADMIN)
  addMember(@CurrentAccess() access: Access, @Body() dto: AddMemberDto) {
    return this.workspaces.addMember(access, dto);
  }
  @Post(':id/invitations')
  @WorkspaceResource('workspace')
  @Roles(Role.OWNER, Role.ADMIN)
  invite(@CurrentAccess() access: Access, @Body() dto: AddMemberDto) {
    return this.workspaces.invite(access, dto);
  }
  @Get('invitations/:token')
  @Public()
  invitePreview(@Param('token') token: string) {
    return this.workspaces.invitePreview(token);
  }
  @Post('invitations/:token/accept')
  acceptInvite(
    @Param('token') token: string,
    @CurrentUser() userId: string,
  ) {
    return this.workspaces.acceptInvite(token, userId);
  }
  @Patch(':id/members/:memberId')
  @WorkspaceResource('workspace')
  @Roles(Role.OWNER, Role.ADMIN)
  changeRole(
    @CurrentAccess() access: Access,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
    @Body() dto: MemberRoleDto,
  ) {
    return this.workspaces.changeRole(access, memberId, dto);
  }
  @Delete(':id/members/:memberId')
  @WorkspaceResource('workspace')
  @HttpCode(204)
  removeMember(
    @CurrentAccess() access: Access,
    @Param('memberId', new ParseUUIDPipe({ version: '4' })) memberId: string,
  ) {
    return this.workspaces.removeMember(access, memberId);
  }
}
