import { VersionDto } from '../common/version.dto';
import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Query,
} from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Roles, WorkspaceResource } from '../common/decorators';
import { Role } from '../common/enums';
import {
  CreateProjectDto,
  ListProjectsDto,
  UpdateProjectDto,
} from './dto/project.dto';
import { ProjectsService } from './projects.service';
@ApiTags('Projects')
@ApiBearerAuth()
@Controller()
export class ProjectsController {
  constructor(private readonly projects: ProjectsService) {}
  @Post('workspaces/:workspaceId/projects')
  @WorkspaceResource('workspace', 'workspaceId')
  @Roles(Role.OWNER, Role.ADMIN)
  create(@Param('workspaceId') id: string, @Body() dto: CreateProjectDto) {
    return this.projects.create(id, dto);
  }
  @Get('workspaces/:workspaceId/projects')
  @WorkspaceResource('workspace', 'workspaceId')
  list(@Param('workspaceId') id: string, @Query() q: ListProjectsDto) {
    return this.projects.list(id, q);
  }
  @Get('projects/:id') @WorkspaceResource('project') get(
    @Param('id') id: string,
  ) {
    return this.projects.get(id);
  }
  @Patch('projects/:id')
  @WorkspaceResource('project')
  @Roles(Role.OWNER, Role.ADMIN)
  update(@Param('id') id: string, @Body() dto: UpdateProjectDto) {
    return this.projects.update(id, dto);
  }
  @Delete('projects/:id')
  @WorkspaceResource('project')
  @Roles(Role.OWNER, Role.ADMIN)
  @HttpCode(204)
  remove(@Param('id') id: string, @Query() version: VersionDto) {
    return this.projects.remove(id, version.expectedUpdatedAt);
  }
}
