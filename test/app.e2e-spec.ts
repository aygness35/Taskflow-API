import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { RemindersService } from '../src/notifications/reminders.service';

describe('TaskFlow API', () => {
  let app: INestApplication;
  let prisma: PrismaService;
  let alice: string, bob: string, outsider: string;
  let aliceId: string, bobId: string, outsiderId: string;
  let workspace: string,
    project: string,
    task: string,
    comment: string,
    bobMember: string;
  const password = 'StrongPassword1!';
  beforeAll(async () => {
    const module = await Test.createTestingModule({
      imports: [AppModule],
    }).compile();
    app = module.createNestApplication();
    setupApp(app);
    await app.init();
    prisma = app.get(PrismaService);
  });
  afterAll(async () => {
    await app?.close();
  });
  const api = () => request(app.getHttpServer());
  async function version(
    model: 'task' | 'project' | 'workspace' | 'comment',
    id: string,
  ) {
    const row =
      model === 'task'
        ? await prisma.task.findUniqueOrThrow({ where: { id } })
        : model === 'project'
          ? await prisma.project.findUniqueOrThrow({ where: { id } })
          : model === 'workspace'
            ? await prisma.workspace.findUniqueOrThrow({ where: { id } })
            : await prisma.comment.findUniqueOrThrow({ where: { id } });
    return { expectedUpdatedAt: row.updatedAt.toISOString() };
  }
  const bearer = (token: string) => `Bearer ${token}`;

  it('registers users, logs in and protects profile routes', async () => {
    await api().get('/auth/me').expect(401);
    for (const name of ['Alice', 'Bob', 'Outsider']) {
      const response = await api()
        .post('/auth/register')
        .send({ email: `${name.toLowerCase()}@example.com`, name, password })
        .expect(201);
      expect(response.body).toHaveProperty('refreshToken');
    }
    const a = await api()
      .post('/auth/login')
      .send({ email: 'ALICE@example.com', password })
      .expect(200);
    alice = a.body.accessToken;
    bob = (
      await api()
        .post('/auth/login')
        .send({ email: 'bob@example.com', password })
        .expect(200)
    ).body.accessToken;
    outsider = (
      await api()
        .post('/auth/login')
        .send({ email: 'outsider@example.com', password })
        .expect(200)
    ).body.accessToken;
    const profile = await api()
      .get('/auth/me')
      .set('Authorization', bearer(alice))
      .expect(200);
    aliceId = profile.body.id;
    expect(profile.body).not.toHaveProperty('password');
    expect(profile.body).not.toHaveProperty('tokenHash');
    bobId = (
      await api().get('/users/me').set('Authorization', bearer(bob)).expect(200)
    ).body.id;
    outsiderId = (
      await api()
        .get('/users/me')
        .set('Authorization', bearer(outsider))
        .expect(200)
    ).body.id;
    await api()
      .patch('/users/me')
      .set('Authorization', bearer(alice))
      .send({ name: 'Alice Updated' })
      .expect(200);
    await api()
      .post('/auth/register')
      .send({ email: 'alice@example.com', name: 'Alice', password })
      .expect(409);
    await api()
      .post('/auth/login')
      .send({ email: 'alice@example.com', password: 'WrongPassword1!' })
      .expect(401);
  });

  it('rotates refresh tokens once, rejects reuse and revokes on logout', async () => {
    const login = await api()
      .post('/auth/login')
      .send({ email: 'alice@example.com', password })
      .expect(200);
    const old = login.body.refreshToken;
    const refreshed = await api()
      .post('/auth/refresh')
      .send({ refreshToken: old })
      .expect(200);
    expect(refreshed.body.refreshToken).not.toBe(old);
    await api().post('/auth/refresh').send({ refreshToken: old }).expect(401);
    await api()
      .get('/auth/me')
      .set('Authorization', bearer(refreshed.body.refreshToken))
      .expect(401);
    await api()
      .post('/auth/refresh')
      .send({ refreshToken: login.body.accessToken })
      .expect(401);
    await api()
      .post('/auth/logout')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(204);
    await api()
      .post('/auth/refresh')
      .send({ refreshToken: refreshed.body.refreshToken })
      .expect(401);
    const tokens = await prisma.refreshToken.findMany();
    expect(tokens.every((t) => /^[a-f0-9]{64}$/.test(t.tokenHash))).toBe(true);
  });

  it('rejects forged, expired and incorrectly scoped access tokens', async () => {
    const jwt = app.get(JwtService);
    const secret = app.get(ConfigService).getOrThrow<string>('JWT_SECRET');
    const base = {
      secret,
      issuer: 'taskflow',
      audience: 'taskflow-api',
      expiresIn: 60,
    };
    const tokens = await Promise.all([
      jwt.signAsync(
        { sub: aliceId, type: 'access' },
        { ...base, secret: 'attacker-controlled-secret' },
      ),
      jwt.signAsync(
        { sub: aliceId, type: 'access' },
        { ...base, expiresIn: -1 },
      ),
      jwt.signAsync(
        { sub: aliceId, type: 'access' },
        { ...base, issuer: 'other-app' },
      ),
      jwt.signAsync(
        { sub: aliceId, type: 'access' },
        { ...base, audience: 'other-api' },
      ),
      jwt.signAsync(
        { sub: aliceId, type: 'access' },
        { ...base, algorithm: 'HS384' },
      ),
      jwt.signAsync({ sub: aliceId, type: 'refresh' }, base),
    ]);
    for (const token of [...tokens, 'invalid.jwt.value']) {
      await api()
        .get('/users/me')
        .set('Authorization', bearer(token))
        .expect(401);
    }
    await api()
      .get('/users/me')
      .set('Authorization', `${bearer(alice)} extra`)
      .expect(401);
    await api()
      .patch('/users/me')
      .set('Authorization', bearer(alice))
      .send({ name: 'Elevated', role: 'OWNER', password: 'Replacement1!' })
      .expect(400);
    const unchanged = await api()
      .get('/users/me')
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(unchanged.body.name).toBe('Alice Updated');
    expect(unchanged.body).not.toHaveProperty('password');
  });

  it('consumes a refresh token only once under concurrent requests', async () => {
    const login = await api()
      .post('/auth/login')
      .send({ email: 'alice@example.com', password })
      .expect(200);
    const results = await Promise.all(
      [0, 1].map(() =>
        api()
          .post('/auth/refresh')
          .send({ refreshToken: login.body.refreshToken }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 401]);
    const winner = results.find((r) => r.status === 200)!;
    await api()
      .post('/auth/logout')
      .send({ refreshToken: winner.body.refreshToken })
      .expect(204);
  });

  it('creates a workspace and nested resources with an automatic owner membership', async () => {
    workspace = (
      await api()
        .post('/workspaces')
        .set('Authorization', bearer(alice))
        .send({ name: 'Engineering' })
        .expect(201)
    ).body.id;
    const members = await api()
      .get(`/workspaces/${workspace}/members`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(members.body[0]).toMatchObject({ userId: aliceId, role: 'OWNER' });
    expect(members.body[0].user).not.toHaveProperty('password');
    bobMember = (
      await api()
        .post(`/workspaces/${workspace}/members`)
        .set('Authorization', bearer(alice))
        .send({ email: 'bob@example.com', role: 'MEMBER' })
        .expect(201)
    ).body.id;
    project = (
      await api()
        .post(`/workspaces/${workspace}/projects`)
        .set('Authorization', bearer(alice))
        .send({ name: 'Backend' })
        .expect(201)
    ).body.id;
    task = (
      await api()
        .post(`/projects/${project}/tasks`)
        .set('Authorization', bearer(bob))
        .send({
          title: 'Implement access',
          assigneeId: bobId,
          priority: 'HIGH',
        })
        .expect(201)
    ).body.id;
    comment = (
      await api()
        .post(`/tasks/${task}/comments`)
        .set('Authorization', bearer(bob))
        .send({ content: 'Working on it' })
        .expect(201)
    ).body.id;
  });

  it('returns 403 for every foreign workspace, project, task and comment route', async () => {
    const cases: [string, string, object?][] = [
      ['get', `/workspaces/${workspace}`],
      ['patch', `/workspaces/${workspace}`, { name: 'Hijacked' }],
      ['delete', `/workspaces/${workspace}`],
      ['get', `/workspaces/${workspace}/members`],
      [
        'post',
        `/workspaces/${workspace}/members`,
        { email: 'outsider@example.com', role: 'ADMIN' },
      ],
      [
        'patch',
        `/workspaces/${workspace}/members/${bobMember}`,
        { role: 'ADMIN' },
      ],
      ['delete', `/workspaces/${workspace}/members/${bobMember}`],
      ['get', `/workspaces/${workspace}/projects`],
      ['post', `/workspaces/${workspace}/projects`, { name: 'Foreign' }],
      ['get', `/projects/${project}`],
      ['patch', `/projects/${project}`, { name: 'Foreign' }],
      ['delete', `/projects/${project}`],
      ['get', `/projects/${project}/tasks`],
      ['post', `/projects/${project}/tasks`, { title: 'Foreign task' }],
      ['get', `/tasks/${task}`],
      ['patch', `/tasks/${task}`, { status: 'DONE' }],
      ['patch', `/tasks/${task}/assign`, { assigneeId: outsiderId }],
      ['delete', `/tasks/${task}`],
      ['get', `/tasks/${task}/comments`],
      ['post', `/tasks/${task}/comments`, { content: 'Foreign' }],
      ['patch', `/comments/${comment}`, { content: 'Foreign' }],
      ['delete', `/comments/${comment}`],
    ];
    for (const [method, url, body] of cases) {
      const client = api();
      const response = await client[
        method as 'get' | 'post' | 'patch' | 'delete'
      ](url)
        .set('Authorization', bearer(outsider))
        .send(body ?? {})
        .expect(403);
      expect(response.body).toMatchObject({
        statusCode: 403,
        error: 'Forbidden',
        path: url,
      });
      expect(response.body.timestamp).toBeDefined();
    }
    expect(
      (
        await api()
          .get('/workspaces')
          .set('Authorization', bearer(outsider))
          .expect(200)
      ).body,
    ).toEqual([]);
    await api()
      .get(`/tasks/${randomUUID()}`)
      .set('Authorization', bearer(outsider))
      .expect(403);
  });

  it('enforces member permissions and validates inputs and assignments', async () => {
    await api()
      .post(`/workspaces/${workspace}/projects`)
      .set('Authorization', bearer(bob))
      .send({ name: 'Blocked' })
      .expect(403);
    await api()
      .delete(`/workspaces/${workspace}`)
      .query(await version('workspace', workspace))
      .set('Authorization', bearer(bob))
      .expect(403);
    await api()
      .patch(`/tasks/${task}`)
      .set('Authorization', bearer(bob))
      .send({ status: 'DONE', ...(await version('task', task)) })
      .expect(200);
    await api()
      .patch(`/tasks/${task}`)
      .set('Authorization', bearer(bob))
      .send({ status: 'TODO', ...(await version('task', task)) })
      .expect(200);
    for (const body of [
      { status: 'INVALID' },
      { priority: null },
      { title: null },
      { createdById: outsiderId },
      { assigneeId: outsiderId },
    ]) {
      await api()
        .patch(`/tasks/${task}`)
        .set('Authorization', bearer(bob))
        .send({ ...body, ...(await version('task', task)) })
        .expect(400);
    }
    await api()
      .patch(`/tasks/${task}/assign`)
      .set('Authorization', bearer(bob))
      .send({})
      .expect(400);
    await api()
      .post(`/projects/${project}/tasks`)
      .set('Authorization', bearer(bob))
      .send({ title: 'Past deadline', dueDate: '2000-01-01T00:00:00Z' })
      .expect(400);
    await api()
      .get(`/projects/${project}/tasks?limit=101`)
      .set('Authorization', bearer(bob))
      .expect(400);
    await api()
      .get(`/projects/${project}/tasks?page=abc`)
      .set('Authorization', bearer(bob))
      .expect(400);
    await api()
      .get('/tasks/not-a-uuid')
      .set('Authorization', bearer(bob))
      .expect(400);
    await api()
      .patch(`/comments/${comment}`)
      .set('Authorization', bearer(alice))
      .send({
        content: 'Changed by owner',
        ...(await version('comment', comment)),
      })
      .expect(403);
    await api()
      .patch(`/comments/${comment}`)
      .set('Authorization', bearer(bob))
      .send({
        content: 'Updated by author',
        ...(await version('comment', comment)),
      })
      .expect(200);
    const ownerTask = (
      await api()
        .post(`/projects/${project}/tasks`)
        .set('Authorization', bearer(alice))
        .send({ title: 'Owner task' })
        .expect(201)
    ).body.id;
    await api()
      .delete(`/tasks/${ownerTask}`)
      .query(await version('task', ownerTask))
      .set('Authorization', bearer(bob))
      .expect(403);
    const ownerComment = (
      await api()
        .post(`/tasks/${task}/comments`)
        .set('Authorization', bearer(alice))
        .send({ content: 'Owner comment' })
        .expect(201)
    ).body.id;
    await api()
      .delete(`/comments/${ownerComment}`)
      .query(await version('comment', ownerComment))
      .set('Authorization', bearer(bob))
      .expect(403);
  });

  it('filters, searches, paginates and sorts within the current project', async () => {
    const result = await api()
      .get(
        `/projects/${project}/tasks?priority=HIGH&status=TODO&assigneeId=${bobId}&search=access&sortBy=title&sortOrder=asc&limit=1&page=1`,
      )
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(result.body.data.map((t: { id: string }) => t.id)).toEqual([task]);
    expect(result.body.meta).toEqual({
      total: 1,
      page: 1,
      limit: 1,
      totalPages: 1,
    });
    const list = await api()
      .get(`/workspaces/${workspace}/projects?status=ARCHIVED`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(list.body.data).toEqual([]);
    const comments = await api()
      .get(`/tasks/${task}/comments?limit=1`)
      .set('Authorization', bearer(bob))
      .expect(200);
    expect(comments.body.meta.total).toBe(2);
  });

  it('rejects ambiguous and unsupported dates without writing data', async () => {
    const before = await prisma.task.findUniqueOrThrow({ where: { id: task } });
    for (const value of [
      '2099-W01-1',
      '2099-01-01',
      '2099-01-01T12:00:00',
      '2099-02-30T12:00:00Z',
    ]) {
      for (const field of ['dueDate', 'expectedUpdatedAt']) {
        await api()
          .patch(`/tasks/${task}`)
          .set('Authorization', bearer(alice))
          .send({
            expectedUpdatedAt: before.updatedAt.toISOString(),
            [field]: value,
          })
          .expect(400);
      }
    }
    expect(
      await prisma.task.findUniqueOrThrow({ where: { id: task } }),
    ).toEqual(before);
  });

  it('normalizes offset deadlines and refreshes lists, details and totals after mutations', async () => {
    const created = await api()
      .post(`/projects/${project}/tasks`)
      .set('Authorization', bearer(alice))
      .send({ title: 'Freshness probe', dueDate: '2099-01-01T12:00:00+03:00' })
      .expect(201);
    const id = created.body.id;
    expect(created.body.dueDate).toBe('2099-01-01T09:00:00.000Z');
    for (const status of ['IN_PROGRESS', 'IN_REVIEW', 'DONE', 'TODO']) {
      const edited = await api()
        .patch(`/tasks/${id}`)
        .set('Authorization', bearer(bob))
        .send({ status, ...(await version('task', id)) })
        .expect(200);
      const detail = await api()
        .get(`/tasks/${id}`)
        .set('Authorization', bearer(alice))
        .expect(200);
      const list = await api()
        .get(`/projects/${project}/tasks?search=Freshness&status=${status}`)
        .set('Authorization', bearer(alice))
        .expect(200);
      expect(detail.body).toEqual(edited.body);
      expect(list.body.data).toEqual([edited.body]);
      expect(list.body.meta.total).toBe(1);
    }
    await api()
      .patch(`/tasks/${id}/assign`)
      .set('Authorization', bearer(alice))
      .send({ assigneeId: bobId, ...(await version('task', id)) })
      .expect(200);
    const cleared = await api()
      .patch(`/tasks/${id}`)
      .set('Authorization', bearer(alice))
      .send({
        assigneeId: null,
        description: null,
        dueDate: null,
        ...(await version('task', id)),
      })
      .expect(200);
    expect(cleared.body).toMatchObject({
      assigneeId: null,
      description: null,
      dueDate: null,
    });
    await api()
      .delete(`/tasks/${id}`)
      .query(await version('task', id))
      .set('Authorization', bearer(alice))
      .expect(204);
    const empty = await api()
      .get(`/projects/${project}/tasks?search=Freshness`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(empty.body).toMatchObject({
      data: [],
      meta: { total: 0, totalPages: 0 },
    });
    await api()
      .get(`/tasks/${id}`)
      .set('Authorization', bearer(alice))
      .expect(403);
  });

  it('supports labels, checklists, notifications, activity, attachments and dashboard reporting', async () => {
    await api()
      .patch(`/tasks/${task}/assign`)
      .set('Authorization', bearer(alice))
      .send({ assigneeId: bobId, ...(await version('task', task)) })
      .expect(200);
    const label = await api()
      .post(`/workspaces/${workspace}/labels`)
      .set('Authorization', bearer(alice))
      .send({ name: 'Backend', color: '#7d8d65' })
      .expect(201);
    await api()
      .post(`/tasks/${task}/labels`)
      .set('Authorization', bearer(alice))
      .send({ labelId: label.body.id })
      .expect(201);
    const labels = await api()
      .get(`/tasks/${task}/labels`)
      .set('Authorization', bearer(bob))
      .expect(200);
    expect(labels.body.map((item: { name: string }) => item.name)).toContain(
      'Backend',
    );

    const checklist = await api()
      .post(`/tasks/${task}/checklist`)
      .set('Authorization', bearer(bob))
      .send({ title: 'Review the API' })
      .expect(201);
    await api()
      .patch(`/tasks/${task}/checklist/${checklist.body.id}`)
      .set('Authorization', bearer(bob))
      .send({ completed: true })
      .expect(200);

    const attachment = await api()
      .post(`/tasks/${task}/attachments`)
      .set('Authorization', bearer(alice))
      .attach('file', Buffer.from('TaskFlow proof'), {
        filename: 'proof.txt',
        contentType: 'text/plain',
      })
      .expect(201);
    const downloaded = await api()
      .get(`/tasks/${task}/attachments/${attachment.body.id}/download`)
      .set('Authorization', bearer(bob))
      .expect(200);
    expect(downloaded.headers['content-disposition']).toContain('proof.txt');

    const activities = await api()
      .get(`/tasks/${task}/activity`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(
      activities.body.some(
        (item: { action: string }) => item.action === 'ATTACHMENT_ADDED',
      ),
    ).toBe(true);
    expect(
      activities.body.some(
        (item: { action: string }) => item.action === 'CHECKLIST_COMPLETED',
      ),
    ).toBe(true);

    const notifications = await api()
      .get('/notifications')
      .set('Authorization', bearer(bob))
      .expect(200);
    expect(notifications.body.unread).toBeGreaterThan(0);
    await api()
      .patch(`/notifications/${notifications.body.data[0].id}/read`)
      .set('Authorization', bearer(bob))
      .expect(200);
    await api()
      .patch('/notifications/read-all')
      .set('Authorization', bearer(bob))
      .expect(204);

    const dashboard = await api()
      .get(`/workspaces/${workspace}/dashboard`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(dashboard.body.total).toBeGreaterThan(0);
    expect(dashboard.body.byAssignee).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          user: expect.objectContaining({ id: bobId }),
        }),
      ]),
    );
  });

  it('rejects stale edits on every versioned resource and concurrent task assignment', async () => {
    for (const [url, data, token, current] of [
      [
        `/workspaces/${workspace}`,
        { name: 'Updated engineering' },
        alice,
        await prisma.workspace.findUniqueOrThrow({ where: { id: workspace } }),
      ],
      [
        `/projects/${project}`,
        { description: 'Updated project' },
        alice,
        await prisma.project.findUniqueOrThrow({ where: { id: project } }),
      ],
      [
        `/comments/${comment}`,
        { content: 'Updated comment' },
        bob,
        await prisma.comment.findUniqueOrThrow({ where: { id: comment } }),
      ],
    ] as const) {
      const body = {
        ...data,
        expectedUpdatedAt: current.updatedAt.toISOString(),
      };
      const saved = await api()
        .patch(url)
        .set('Authorization', bearer(token))
        .send(body)
        .expect(200);
      expect(Date.parse(saved.body.updatedAt)).toBeGreaterThan(
        current.updatedAt.getTime(),
      );
      await api()
        .patch(url)
        .set('Authorization', bearer(token))
        .send(body)
        .expect(409);
    }
    const current = await prisma.task.findUniqueOrThrow({
      where: { id: task },
    });
    const results = await Promise.all(
      [alice, bob].map((token) =>
        api()
          .patch(`/tasks/${task}/assign`)
          .set('Authorization', bearer(token))
          .send({
            assigneeId: bobId,
            expectedUpdatedAt: current.updatedAt.toISOString(),
          }),
      ),
    );
    expect(results.map((r) => r.status).sort()).toEqual([200, 409]);
    const winner = results.find((r) => r.status === 200)!;
    const detail = await api()
      .get(`/tasks/${task}`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(detail.body).toEqual(winner.body);
  });

  it('does not cache private responses or mask database write failures as success', async () => {
    const privateResponse = await api()
      .get(`/tasks/${task}`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(privateResponse.headers['cache-control']).toBe('no-store');
    const before = await prisma.project.findUniqueOrThrow({
      where: { id: project },
    });
    const failure = jest
      .spyOn(prisma.project, 'update')
      .mockRejectedValueOnce(new Error('isolated database outage'));
    try {
      const response = await api()
        .patch(`/projects/${project}`)
        .set('Authorization', bearer(alice))
        .send({
          name: 'Must not persist',
          ...(await version('project', project)),
        })
        .expect(500);
      expect(response.body.message).toBe('Internal server error');
      expect(response.headers['cache-control']).toBe('no-store');
    } finally {
      failure.mockRestore();
    }
    expect(
      await prisma.project.findUniqueOrThrow({ where: { id: project } }),
    ).toEqual(before);
  });

  it('keeps pagination stable and reflects comment/project deletion immediately', async () => {
    const p = await api()
      .post(`/workspaces/${workspace}/projects`)
      .set('Authorization', bearer(alice))
      .send({ name: 'Disposable project' })
      .expect(201);
    const ids: string[] = [];
    for (let i = 0; i < 3; i++) {
      const t = await api()
        .post(`/projects/${p.body.id}/tasks`)
        .set('Authorization', bearer(alice))
        .send({ title: 'Identical title' })
        .expect(201);
      ids.push(t.body.id);
    }
    const pages: string[] = [];
    for (let page = 1; page <= 3; page++) {
      const result = await api()
        .get(`/projects/${p.body.id}/tasks?sortBy=title&limit=1&page=${page}`)
        .set('Authorization', bearer(alice))
        .expect(200);
      pages.push(result.body.data[0].id);
      expect(result.body.meta.total).toBe(3);
    }
    expect(pages).toEqual([...ids].sort());
    const c = await api()
      .post(`/tasks/${ids[0]}/comments`)
      .set('Authorization', bearer(alice))
      .send({ content: 'Temporary comment' })
      .expect(201);
    await api()
      .delete(`/comments/${c.body.id}`)
      .query(await version('comment', c.body.id))
      .set('Authorization', bearer(alice))
      .expect(204);
    const comments = await api()
      .get(`/tasks/${ids[0]}/comments`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(comments.body).toMatchObject({ data: [], meta: { total: 0 } });
    await api()
      .delete(`/projects/${p.body.id}`)
      .query(await version('project', p.body.id))
      .set('Authorization', bearer(alice))
      .expect(204);
    expect(await prisma.task.count({ where: { projectId: p.body.id } })).toBe(
      0,
    );
    const projects = await api()
      .get(`/workspaces/${workspace}/projects`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(
      projects.body.data.some(
        (entry: { id: string }) => entry.id === p.body.id,
      ),
    ).toBe(false);
    expect(projects.body.meta.total).toBe(1);
  });

  it('requires versions and prevents stale deletion for every versioned resource', async () => {
    const w = (
      await api()
        .post('/workspaces')
        .set('Authorization', bearer(alice))
        .send({ name: 'Version checks' })
        .expect(201)
    ).body;
    const p = (
      await api()
        .post(`/workspaces/${w.id}/projects`)
        .set('Authorization', bearer(alice))
        .send({ name: 'Version checks' })
        .expect(201)
    ).body;
    const t = (
      await api()
        .post(`/projects/${p.id}/tasks`)
        .set('Authorization', bearer(alice))
        .send({ title: 'Version checks' })
        .expect(201)
    ).body;
    const c = (
      await api()
        .post(`/tasks/${t.id}/comments`)
        .set('Authorization', bearer(alice))
        .send({ content: 'Version checks' })
        .expect(201)
    ).body;
    for (const [model, url, row, data] of [
      ['comment', `/comments/${c.id}`, c, { content: 'Changed' }],
      ['task', `/tasks/${t.id}`, t, { title: 'Changed' }],
      ['project', `/projects/${p.id}`, p, { name: 'Changed' }],
      ['workspace', `/workspaces/${w.id}`, w, { name: 'Changed' }],
    ] as const) {
      await api()
        .patch(url)
        .set('Authorization', bearer(alice))
        .send(data)
        .expect(400);
      await api().delete(url).set('Authorization', bearer(alice)).expect(400);
      expect((await version(model, row.id)).expectedUpdatedAt).toBe(
        row.updatedAt,
      );
      const saved = (
        await api()
          .patch(url)
          .set('Authorization', bearer(alice))
          .send({ ...data, expectedUpdatedAt: row.updatedAt })
          .expect(200)
      ).body;
      await api()
        .delete(url)
        .set('Authorization', bearer(alice))
        .query({ expectedUpdatedAt: row.updatedAt })
        .expect(409);
      expect((await version(model, row.id)).expectedUpdatedAt).toBe(
        saved.updatedAt,
      );
      await api()
        .delete(url)
        .set('Authorization', bearer(alice))
        .query({ expectedUpdatedAt: saved.updatedAt })
        .expect(204);
    }
  });

  it('prevents admin escalation and protects the owner', async () => {
    await api()
      .patch(`/workspaces/${workspace}/members/${bobMember}`)
      .set('Authorization', bearer(alice))
      .send({ role: 'ADMIN' })
      .expect(200);
    await api()
      .patch(`/workspaces/${workspace}/members/${bobMember}`)
      .set('Authorization', bearer(bob))
      .send({ role: 'OWNER' })
      .expect(400);
    await api()
      .post(`/workspaces/${workspace}/members`)
      .set('Authorization', bearer(bob))
      .send({ email: 'outsider@example.com', role: 'ADMIN' })
      .expect(403);
    const owner = await prisma.workspaceMember.findFirstOrThrow({
      where: { workspaceId: workspace, role: 'OWNER' },
    });
    await api()
      .delete(`/workspaces/${workspace}/members/${owner.id}`)
      .set('Authorization', bearer(bob))
      .expect(403);
    await api()
      .patch(`/workspaces/${workspace}/members/${owner.id}`)
      .set('Authorization', bearer(alice))
      .send({ role: 'MEMBER' })
      .expect(403);
    await api()
      .delete(`/workspaces/${workspace}`)
      .query(await version('workspace', workspace))
      .set('Authorization', bearer(bob))
      .expect(403);
    await api()
      .patch(`/projects/${project}`)
      .set('Authorization', bearer(bob))
      .send({ status: 'ARCHIVED', ...(await version('project', project)) })
      .expect(200);
  });

  it('removes assignment and access when a member leaves', async () => {
    await api()
      .delete(`/workspaces/${workspace}/members/${bobMember}`)
      .set('Authorization', bearer(bob))
      .expect(204);
    await api()
      .get(`/tasks/${task}`)
      .set('Authorization', bearer(bob))
      .expect(403);
    const result = await api()
      .get(`/tasks/${task}`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(result.body.assigneeId).toBeNull();
  });

  it('supports recurrence, subtasks, lifecycle, export and invitation links', async () => {
    const created = await api()
      .post(`/projects/${project}/tasks`)
      .set('Authorization', bearer(alice))
      .send({
        title: 'Weekly planning',
        dueDate: '2099-01-01T12:00:00Z',
        recurrence: 'WEEKLY',
        recurrenceEnd: '2099-03-01T12:00:00Z',
      })
      .expect(201);
    const parentId = created.body.id;
    await api()
      .post(`/tasks/${parentId}/subtasks`)
      .set('Authorization', bearer(alice))
      .send({ title: 'Prepare agenda' })
      .expect(201);
    const subtasks = await api()
      .get(`/tasks/${parentId}/subtasks`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(subtasks.body).toHaveLength(1);

    const completed = await api()
      .patch(`/tasks/${parentId}`)
      .set('Authorization', bearer(alice))
      .send({ status: 'DONE', ...(await version('task', parentId)) })
      .expect(200);
    const repeated = await api()
      .get(`/projects/${project}/tasks?search=Weekly%20planning`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(repeated.body.meta.total).toBe(2);
    expect(repeated.body.data.some((item: { status: string }) => item.status === 'TODO')).toBe(true);

    const archived = await api()
      .patch(`/tasks/${parentId}/archive`)
      .set('Authorization', bearer(alice))
      .send({ expectedUpdatedAt: completed.body.updatedAt })
      .expect(200);
    const archive = await api()
      .get(`/workspaces/${workspace}/archive`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(archive.body.some((item: { id: string }) => item.id === parentId)).toBe(true);
    const restored = await api()
      .patch(`/tasks/${parentId}/restore`)
      .set('Authorization', bearer(alice))
      .send({ expectedUpdatedAt: archived.body.updatedAt })
      .expect(200);
    const trashed = await api()
      .patch(`/tasks/${parentId}/trash`)
      .set('Authorization', bearer(alice))
      .send({ expectedUpdatedAt: restored.body.updatedAt })
      .expect(200);
    const trash = await api()
      .get(`/workspaces/${workspace}/trash`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(trash.body.some((item: { id: string }) => item.id === parentId)).toBe(true);
    await api()
      .patch(`/tasks/${parentId}/restore`)
      .set('Authorization', bearer(alice))
      .send({ expectedUpdatedAt: trashed.body.updatedAt })
      .expect(200);

    const exported = await api()
      .get(`/workspaces/${workspace}/export`)
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(exported.headers['content-type']).toContain('text/csv');
    expect(exported.text).toContain('Weekly planning');

    const invitation = await api()
      .post(`/workspaces/${workspace}/invitations`)
      .set('Authorization', bearer(alice))
      .send({ email: 'outsider@example.com', role: 'MEMBER' })
      .expect(201);
    await api()
      .get(`/workspaces/invitations/${invitation.body.token}`)
      .expect(200);
    await api()
      .post(`/workspaces/invitations/${invitation.body.token}/accept`)
      .set('Authorization', bearer(outsider))
      .expect(201);
  });

  it('searches the workspace globally and creates automatic due reminders once', async () => {
    const now = new Date();
    const created = await api()
      .post(`/projects/${project}/tasks`)
      .set('Authorization', bearer(alice))
      .send({
        title: 'Global reminder probe',
        description: 'Searchable delivery milestone',
        dueDate: new Date(now.getTime() + 60 * 60 * 1000).toISOString(),
        assigneeId: aliceId,
      })
      .expect(201);
    await api()
      .post(`/tasks/${created.body.id}/comments`)
      .set('Authorization', bearer(alice))
      .send({ content: 'Unique discussion needle' })
      .expect(201);

    const taskSearch = await api()
      .get(`/workspaces/${workspace}/search`)
      .query({ q: 'Global reminder' })
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(taskSearch.body.tasks).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ id: created.body.id }),
      ]),
    );
    const commentSearch = await api()
      .get(`/workspaces/${workspace}/search`)
      .query({ q: 'discussion needle' })
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(commentSearch.body.comments[0].task.id).toBe(created.body.id);

    const reminders = app.get(RemindersService);
    expect(await reminders.scan(now)).toBe(1);
    expect(await reminders.scan(now)).toBe(0);
    const dueSoon = await api()
      .get('/notifications')
      .set('Authorization', bearer(alice))
      .expect(200);
    expect(dueSoon.body.data).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          taskId: created.body.id,
          type: 'TASK_DUE_SOON',
        }),
      ]),
    );

    const overdueDate = new Date(now.getTime() - 60 * 60 * 1000);
    await prisma.task.update({
      where: { id: created.body.id },
      data: { dueDate: overdueDate },
    });
    expect(await reminders.scan(now)).toBe(1);
    expect(await reminders.scan(now)).toBe(0);
  });

  it('serves Swagger with all 62 endpoints and applies security headers and CORS', async () => {
    await api().get('/api/docs/').expect(200);
    const docs = await api().get('/api/docs-json').expect(200);
    const count = Object.values(docs.body.paths).reduce<number>(
      (sum, p) => sum + Object.keys(p as object).length,
      0,
    );
    expect(count).toBe(62);
    const expected: Record<string, string[]> = {
      '/auth/register': ['post'],
      '/auth/login': ['post'],
      '/auth/refresh': ['post'],
      '/auth/logout': ['post'],
      '/auth/me': ['get'],
      '/users/me': ['get', 'patch'],
      '/workspaces': ['get', 'post'],
      '/workspaces/{id}': ['get', 'patch', 'delete'],
      '/workspaces/{id}/members': ['get', 'post'],
      '/workspaces/{id}/members/{memberId}': ['patch', 'delete'],
      '/workspaces/{workspaceId}/projects': ['get', 'post'],
      '/projects/{id}': ['get', 'patch', 'delete'],
      '/projects/{projectId}/tasks': ['get', 'post'],
      '/projects/{projectId}/calendar': ['get'],
      '/tasks/{id}': ['get', 'patch', 'delete'],
      '/tasks/{id}/assign': ['patch'],
      '/tasks/{id}/subtasks': ['get', 'post'],
      '/tasks/{id}/archive': ['patch'],
      '/tasks/{id}/trash': ['patch'],
      '/tasks/{id}/restore': ['patch'],
      '/tasks/{taskId}/comments': ['get', 'post'],
      '/comments/{id}': ['patch', 'delete'],
      '/workspaces/{workspaceId}/labels': ['get', 'post'],
      '/tasks/{taskId}/labels': ['get', 'post'],
      '/tasks/{taskId}/labels/{labelId}': ['delete'],
      '/tasks/{taskId}/checklist': ['get', 'post'],
      '/tasks/{taskId}/checklist/{itemId}': ['patch', 'delete'],
      '/tasks/{taskId}/activity': ['get'],
      '/tasks/{taskId}/attachments': ['get', 'post'],
      '/tasks/{taskId}/attachments/{attachmentId}/download': ['get'],
      '/tasks/{taskId}/attachments/{attachmentId}': ['delete'],
      '/workspaces/{workspaceId}/dashboard': ['get'],
      '/workspaces/{workspaceId}/search': ['get'],
      '/workspaces/{workspaceId}/archive': ['get'],
      '/workspaces/{workspaceId}/trash': ['get'],
      '/workspaces/{workspaceId}/export': ['get'],
      '/workspaces/{id}/invitations': ['post'],
      '/workspaces/invitations/{token}': ['get'],
      '/workspaces/invitations/{token}/accept': ['post'],
      '/notifications': ['get'],
      '/notifications/{id}/read': ['patch'],
      '/notifications/read-all': ['patch'],
    };
    for (const [path, methods] of Object.entries(expected))
      expect(Object.keys(docs.body.paths[path]).sort()).toEqual(methods.sort());
    const allowed = await api()
      .get('/users/me')
      .set('Authorization', bearer(alice))
      .set('Origin', 'http://localhost:3001')
      .expect(200);
    expect(allowed.headers['access-control-allow-origin']).toBe(
      'http://localhost:3001',
    );
    expect(allowed.headers['x-content-type-options']).toBe('nosniff');
    const denied = await api()
      .get('/users/me')
      .set('Authorization', bearer(alice))
      .set('Origin', 'https://untrusted.example')
      .expect(200);
    expect(denied.headers['access-control-allow-origin']).toBeUndefined();
  });

  it('rate limits login requests', async () => {
    let response;
    for (let i = 0; i < 11; i++)
      response = await api().post('/auth/login').send({ email: 'invalid' });
    expect(response?.status).toBe(429);
  });

  it('cascades workspace deletion across projects, tasks, and comments', async () => {
    await api()
      .delete(`/workspaces/${workspace}`)
      .query(await version('workspace', workspace))
      .set('Authorization', bearer(alice))
      .expect(204);
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
  });
});
