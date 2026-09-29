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
import { Access, CurrentAccess, WorkspaceResource } from '../common/decorators';
import {
  AssignTaskDto,
  CalendarTasksDto,
  CreateTaskDto,
  ListTasksDto,
  UpdateTaskDto,
} from './dto/task.dto';
import { TasksService } from './tasks.service';
@ApiTags('Tasks')
@ApiBearerAuth()
@Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Post('projects/:projectId/tasks')
  @WorkspaceResource('project', 'projectId')
  create(
    @Param('projectId') id: string,
    @CurrentAccess() access: Access,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.create(id, access, dto);
  }
  @Get('projects/:projectId/tasks')
  @WorkspaceResource('project', 'projectId')
  list(@Param('projectId') id: string, @Query() q: ListTasksDto) {
    return this.tasks.list(id, q);
  }
  @Get('projects/:projectId/calendar')
  @WorkspaceResource('project', 'projectId')
  calendar(@Param('projectId') id: string, @Query() q: CalendarTasksDto) {
    return this.tasks.calendar(id, q);
  }
  @Get('tasks/:id') @WorkspaceResource('task') get(@Param('id') id: string) {
    return this.tasks.get(id);
  }
  @Post('tasks/:id/subtasks')
  @WorkspaceResource('task')
  createSubtask(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Body() dto: CreateTaskDto,
  ) {
    return this.tasks.createSubtask(id, access, dto);
  }
  @Get('tasks/:id/subtasks')
  @WorkspaceResource('task')
  subtasks(@Param('id') id: string) {
    return this.tasks.subtasks(id);
  }
  @Patch('tasks/:id/archive')
  @WorkspaceResource('task')
  archive(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Body() version: VersionDto,
  ) {
    return this.tasks.lifecycle(id, access, version.expectedUpdatedAt, 'archive');
  }
  @Patch('tasks/:id/trash')
  @WorkspaceResource('task')
  trash(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Body() version: VersionDto,
  ) {
    return this.tasks.lifecycle(id, access, version.expectedUpdatedAt, 'trash');
  }
  @Patch('tasks/:id/restore')
  @WorkspaceResource('task')
  restore(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Body() version: VersionDto,
  ) {
    return this.tasks.lifecycle(id, access, version.expectedUpdatedAt, 'restore');
  }
  @Patch('tasks/:id') @WorkspaceResource('task') update(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Body() dto: UpdateTaskDto,
  ) {
    return this.tasks.update(id, access, dto);
  }
  @Patch('tasks/:id/assign') @WorkspaceResource('task') assign(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Body() dto: AssignTaskDto,
  ) {
    return this.tasks.assign(id, access, dto);
  }
  @Delete('tasks/:id') @WorkspaceResource('task') @HttpCode(204) remove(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Query() version: VersionDto,
  ) {
    return this.tasks.remove(id, access, version.expectedUpdatedAt);
  }
}
