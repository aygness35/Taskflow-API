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
import {
  Access,
  CurrentAccess,
  CurrentUser,
  WorkspaceResource,
} from '../common/decorators';
import { PaginationDto } from '../common/pagination.dto';
import { CreateCommentDto, UpdateCommentDto } from './dto/comment.dto';
import { CommentsService } from './comments.service';
@ApiTags('Comments')
@ApiBearerAuth()
@Controller()
export class CommentsController {
  constructor(private readonly comments: CommentsService) {}
  @Post('tasks/:taskId/comments') @WorkspaceResource('task', 'taskId') create(
    @Param('taskId') id: string,
    @CurrentAccess() access: Access,
    @Body() dto: CreateCommentDto,
  ) {
    return this.comments.create(id, access, dto);
  }
  @Get('tasks/:taskId/comments') @WorkspaceResource('task', 'taskId') list(
    @Param('taskId') id: string,
    @Query() q: PaginationDto,
  ) {
    return this.comments.list(id, q);
  }
  @Patch('comments/:id') @WorkspaceResource('comment') update(
    @Param('id') id: string,
    @CurrentUser() userId: string,
    @Body() dto: UpdateCommentDto,
  ) {
    return this.comments.update(id, userId, dto);
  }
  @Delete('comments/:id') @WorkspaceResource('comment') @HttpCode(204) remove(
    @Param('id') id: string,
    @CurrentAccess() access: Access,
    @Query() version: VersionDto,
  ) {
    return this.comments.remove(id, access, version.expectedUpdatedAt);
  }
}
