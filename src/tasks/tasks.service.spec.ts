import { BadRequestException, ForbiddenException } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { Role } from '../common/enums';
import { TasksService } from './tasks.service';
describe('TasksService deletion permissions', () => {
  const expected = '2026-01-01T00:00:00.000Z';
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
      service.remove(
        'task',
        {
          workspaceId: 'workspace',
          userId: 'other',
          role: Role.MEMBER,
        },
        expected,
      ),
    ).rejects.toThrow(ForbiddenException);
    expect(task.delete).not.toHaveBeenCalled();
  });
  it.each([
    { userId: 'creator', role: Role.MEMBER },
    { userId: 'admin', role: Role.ADMIN },
    { userId: 'owner', role: Role.OWNER },
  ])('allows $role / $userId', async (actor) => {
    await service.remove(
      'task',
      { workspaceId: 'workspace', ...actor },
      expected,
    );
    expect(task.delete).toHaveBeenCalledWith({
      where: { id: 'task', updatedAt: new Date(expected) },
    });
  });
});

describe('TasksService calendar', () => {
  const task = { findMany: jest.fn() };
  const service = new TasksService({ task } as unknown as PrismaService);

  beforeEach(() => jest.clearAllMocks());

  it('queries dated tasks in the requested project and range', async () => {
    task.findMany.mockResolvedValue([]);
    await service.calendar('project', {
      from: '2028-01-01T00:00:00.000Z',
      to: '2028-02-12T00:00:00.000Z',
      assigneeId: 'user',
    });
    expect(task.findMany).toHaveBeenCalledWith(
      expect.objectContaining({
        where: expect.objectContaining({
          projectId: 'project',
          assigneeId: 'user',
          dueDate: {
            gte: new Date('2028-01-01T00:00:00.000Z'),
            lt: new Date('2028-02-12T00:00:00.000Z'),
          },
        }),
        orderBy: [{ dueDate: 'asc' }, { id: 'asc' }],
      }),
    );
  });

  it('rejects inverted and oversized ranges', async () => {
    await expect(
      service.calendar('project', {
        from: '2028-02-01T00:00:00.000Z',
        to: '2028-01-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    await expect(
      service.calendar('project', {
        from: '2028-01-01T00:00:00.000Z',
        to: '2028-04-01T00:00:00.000Z',
      }),
    ).rejects.toThrow(BadRequestException);
    expect(task.findMany).not.toHaveBeenCalled();
  });
});
