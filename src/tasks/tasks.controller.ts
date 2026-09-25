import { Body, Controller, Delete, Get, HttpCode, Param, Patch, Post, Query } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { Access, CurrentAccess, WorkspaceResource } from '../common/decorators';
import { AssignTaskDto, CreateTaskDto, ListTasksDto, UpdateTaskDto } from './dto/task.dto';
import { TasksService } from './tasks.service';
@ApiTags('Tasks') @ApiBearerAuth() @Controller()
export class TasksController {
  constructor(private readonly tasks: TasksService) {}
  @Post('projects/:projectId/tasks') @WorkspaceResource('project', 'projectId') create(@Param('projectId') id: string, @CurrentAccess() access: Access, @Body() dto: CreateTaskDto) { return this.tasks.create(id, access, dto); }
  @Get('projects/:projectId/tasks') @WorkspaceResource('project', 'projectId') list(@Param('projectId') id: string, @Query() q: ListTasksDto) { return this.tasks.list(id, q); }
  @Get('tasks/:id') @WorkspaceResource('task') get(@Param('id') id: string) { return this.tasks.get(id); }
  @Patch('tasks/:id') @WorkspaceResource('task') update(@Param('id') id: string, @CurrentAccess() access: Access, @Body() dto: UpdateTaskDto) { return this.tasks.update(id, access, dto); }
  @Patch('tasks/:id/assign') @WorkspaceResource('task') assign(@Param('id') id: string, @CurrentAccess() access: Access, @Body() dto: AssignTaskDto) { return this.tasks.assign(id, access, dto); }
  @Delete('tasks/:id') @WorkspaceResource('task') @HttpCode(204) remove(@Param('id') id: string, @CurrentAccess() access: Access) { return this.tasks.remove(id, access); }
}
