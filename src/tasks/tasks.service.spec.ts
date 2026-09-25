import { ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import { TasksService } from './tasks.service';
describe('TasksService deletion permissions', () => {
  const task = { findUniqueOrThrow: jest.fn(), delete: jest.fn() };
  const service = new TasksService({ task } as unknown as PrismaService);
  beforeEach(() => {
    jest.clearAllMocks();
    task.findUniqueOrThrow.mockResolvedValue({
      id: 'task',
      createdById: 'creator',
    });
  });
  it('denies another ordinary member', async () => {
    await expect(
      service.remove('task', {
        workspaceId: 'workspace',
        userId: 'other',
        role: Role.MEMBER,
      }),
    ).rejects.toThrow(ForbiddenException);
    expect(task.delete).not.toHaveBeenCalled();
  });
  it.each([
    { userId: 'creator', role: Role.MEMBER },
    { userId: 'admin', role: Role.ADMIN },
    { userId: 'owner', role: Role.OWNER },
  ])('allows $role / $userId', async (actor) => {
    await service.remove('task', { workspaceId: 'workspace', ...actor });
    expect(task.delete).toHaveBeenCalledWith({ where: { id: 'task' } });
  });
});
