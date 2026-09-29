import { Module } from '@nestjs/common';
import { TaskExtrasController } from './task-extras.controller';
import { TaskExtrasService } from './task-extras.service';

@Module({ controllers: [TaskExtrasController], providers: [TaskExtrasService] })
export class TaskExtrasModule {}
