import { Controller, Get, HttpCode, Param, Patch } from '@nestjs/common';
import { ApiBearerAuth, ApiTags } from '@nestjs/swagger';
import { CurrentUser } from '../common/decorators';
import { NotificationsService } from './notifications.service';

@ApiTags('Notifications')
@ApiBearerAuth()
@Controller('notifications')
export class NotificationsController {
  constructor(private readonly notifications: NotificationsService) {}

  @Get()
  list(@CurrentUser() userId: string) {
    return this.notifications.list(userId);
  }

  @Patch(':id/read')
  read(@CurrentUser() userId: string, @Param('id') id: string) {
    return this.notifications.read(userId, id);
  }

  @Patch('read-all')
  @HttpCode(204)
  readAll(@CurrentUser() userId: string) {
    return this.notifications.readAll(userId);
  }
}
