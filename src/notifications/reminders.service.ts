import {
  Injectable,
  Logger,
  OnModuleDestroy,
  OnModuleInit,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../prisma/prisma.service';

const DAY = 24 * 60 * 60 * 1000;

@Injectable()
export class RemindersService implements OnModuleInit, OnModuleDestroy {
  private readonly logger = new Logger(RemindersService.name);
  private timer?: NodeJS.Timeout;

  constructor(
    private readonly prisma: PrismaService,
    private readonly config: ConfigService,
  ) {}

  onModuleInit() {
    if (this.config.get('NODE_ENV') === 'test') return;
    void this.scan().catch((error) =>
      this.logger.error('Reminder scan failed', error),
    );
    this.timer = setInterval(() => {
      void this.scan().catch((error) =>
        this.logger.error('Reminder scan failed', error),
      );
    }, 60_000);
    this.timer.unref();
  }

  onModuleDestroy() {
    if (this.timer) clearInterval(this.timer);
  }

  async scan(now = new Date()) {
    const horizon = new Date(now.getTime() + DAY);
    const tasks = await this.prisma.task.findMany({
      where: {
        dueDate: { lte: horizon },
        status: { not: 'DONE' },
        archivedAt: null,
        deletedAt: null,
      },
      select: {
        id: true,
        title: true,
        dueDate: true,
        assigneeId: true,
        createdById: true,
      },
    });
    let created = 0;
    for (const task of tasks) {
      if (!task.dueDate) continue;
      const overdue = task.dueDate.getTime() < now.getTime();
      const userId = task.assigneeId || task.createdById;
      const type = overdue ? 'TASK_OVERDUE' : 'TASK_DUE_SOON';
      const dedupeKey = `${type}:${task.id}:${task.dueDate.toISOString()}`;
      const existing = await this.prisma.notification.findUnique({
        where: { dedupeKey },
        select: { id: true },
      });
      if (existing) continue;
      await this.prisma.notification.create({
        data: {
          dedupeKey,
          userId,
          taskId: task.id,
          type,
          title: overdue ? 'Görevin gecikti' : 'Görevin yaklaşıyor',
          message: overdue
            ? `${task.title} görevinin son tarihi geçti.`
            : `${task.title} görevinin son tarihine 24 saatten az kaldı.`,
        },
      });
      created++;
    }
    return created;
  }
}
