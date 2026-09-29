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
  Res,
  StreamableFile,
  UploadedFile,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ApiBearerAuth, ApiBody, ApiConsumes, ApiTags } from '@nestjs/swagger';
import type { Response } from 'express';
import {
  Access,
  CurrentAccess,
  Roles,
  WorkspaceResource,
} from '../common/decorators';
import { Role } from '../common/enums';
import {
  AssignLabelDto,
  CreateChecklistItemDto,
  CreateLabelDto,
  SearchWorkspaceDto,
  UpdateChecklistItemDto,
} from './dto/task-extra.dto';
import { TaskExtrasService } from './task-extras.service';

@ApiTags('Task collaboration')
@ApiBearerAuth()
@Controller()
export class TaskExtrasController {
  constructor(private readonly extras: TaskExtrasService) {}

  @Get('workspaces/:workspaceId/labels')
  @WorkspaceResource('workspace', 'workspaceId')
  labels(@Param('workspaceId') workspaceId: string) {
    return this.extras.labels(workspaceId);
  }

  @Post('workspaces/:workspaceId/labels')
  @WorkspaceResource('workspace', 'workspaceId')
  @Roles(Role.OWNER, Role.ADMIN)
  createLabel(
    @Param('workspaceId') workspaceId: string,
    @Body() dto: CreateLabelDto,
  ) {
    return this.extras.createLabel(workspaceId, dto);
  }

  @Get('tasks/:taskId/labels')
  @WorkspaceResource('task', 'taskId')
  taskLabels(@Param('taskId') taskId: string) {
    return this.extras.taskLabels(taskId);
  }

  @Post('tasks/:taskId/labels')
  @WorkspaceResource('task', 'taskId')
  addLabel(
    @Param('taskId') taskId: string,
    @CurrentAccess() access: Access,
    @Body() dto: AssignLabelDto,
  ) {
    return this.extras.addLabel(taskId, access, dto.labelId);
  }

  @Delete('tasks/:taskId/labels/:labelId')
  @WorkspaceResource('task', 'taskId')
  @HttpCode(204)
  removeLabel(
    @Param('taskId') taskId: string,
    @Param('labelId') labelId: string,
    @CurrentAccess() access: Access,
  ) {
    return this.extras.removeLabel(taskId, access, labelId);
  }

  @Get('tasks/:taskId/checklist')
  @WorkspaceResource('task', 'taskId')
  checklist(@Param('taskId') taskId: string) {
    return this.extras.checklist(taskId);
  }

  @Post('tasks/:taskId/checklist')
  @WorkspaceResource('task', 'taskId')
  addChecklist(
    @Param('taskId') taskId: string,
    @CurrentAccess() access: Access,
    @Body() dto: CreateChecklistItemDto,
  ) {
    return this.extras.addChecklist(taskId, access, dto);
  }

  @Patch('tasks/:taskId/checklist/:itemId')
  @WorkspaceResource('task', 'taskId')
  updateChecklist(
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @CurrentAccess() access: Access,
    @Body() dto: UpdateChecklistItemDto,
  ) {
    return this.extras.updateChecklist(taskId, itemId, access, dto);
  }

  @Delete('tasks/:taskId/checklist/:itemId')
  @WorkspaceResource('task', 'taskId')
  @HttpCode(204)
  removeChecklist(
    @Param('taskId') taskId: string,
    @Param('itemId') itemId: string,
    @CurrentAccess() access: Access,
  ) {
    return this.extras.removeChecklist(taskId, itemId, access);
  }

  @Get('tasks/:taskId/activity')
  @WorkspaceResource('task', 'taskId')
  activity(@Param('taskId') taskId: string) {
    return this.extras.activities(taskId);
  }

  @Get('tasks/:taskId/attachments')
  @WorkspaceResource('task', 'taskId')
  attachments(@Param('taskId') taskId: string) {
    return this.extras.attachments(taskId);
  }

  @Post('tasks/:taskId/attachments')
  @WorkspaceResource('task', 'taskId')
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @UseInterceptors(
    FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }),
  )
  addAttachment(
    @Param('taskId') taskId: string,
    @CurrentAccess() access: Access,
    @UploadedFile()
    file?: {
      originalname: string;
      mimetype: string;
      size: number;
      buffer: Buffer;
    },
  ) {
    return this.extras.addAttachment(taskId, access, file);
  }

  @Get('tasks/:taskId/attachments/:attachmentId/download')
  @WorkspaceResource('task', 'taskId')
  async download(
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const item = await this.extras.attachment(taskId, attachmentId);
    response.set({
      'Content-Type': item.mimeType,
      'Content-Length': item.size.toString(),
      'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(item.name)}`,
    });
    return new StreamableFile(item.data);
  }

  @Delete('tasks/:taskId/attachments/:attachmentId')
  @WorkspaceResource('task', 'taskId')
  @HttpCode(204)
  removeAttachment(
    @Param('taskId') taskId: string,
    @Param('attachmentId') attachmentId: string,
    @CurrentAccess() access: Access,
  ) {
    return this.extras.removeAttachment(taskId, attachmentId, access);
  }

  @Get('workspaces/:workspaceId/dashboard')
  @WorkspaceResource('workspace', 'workspaceId')
  dashboard(@Param('workspaceId') workspaceId: string) {
    return this.extras.dashboard(workspaceId);
  }

  @Get('workspaces/:workspaceId/search')
  @WorkspaceResource('workspace', 'workspaceId')
  search(
    @Param('workspaceId') workspaceId: string,
    @Query() query: SearchWorkspaceDto,
  ) {
    return this.extras.search(workspaceId, query.q);
  }

  @Get('workspaces/:workspaceId/archive')
  @WorkspaceResource('workspace', 'workspaceId')
  archive(@Param('workspaceId') workspaceId: string) {
    return this.extras.lifecycleTasks(workspaceId, 'archive');
  }

  @Get('workspaces/:workspaceId/trash')
  @WorkspaceResource('workspace', 'workspaceId')
  trash(@Param('workspaceId') workspaceId: string) {
    return this.extras.lifecycleTasks(workspaceId, 'trash');
  }

  @Get('workspaces/:workspaceId/export')
  @WorkspaceResource('workspace', 'workspaceId')
  async exportCsv(
    @Param('workspaceId') workspaceId: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const csv = await this.extras.exportCsv(workspaceId);
    response.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': 'attachment; filename="taskflow-export.csv"',
    });
    return new StreamableFile(Buffer.from(csv, 'utf8'));
  }
}
