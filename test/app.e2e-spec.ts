import { INestApplication } from '@nestjs/common';
import { Test } from '@nestjs/testing';
import request from 'supertest';
import { randomUUID } from 'node:crypto';
import { AppModule } from '../src/app.module';
import { setupApp } from '../src/setup';
import { PrismaService } from '../src/prisma/prisma.service';

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
      .set('Authorization', bearer(bob))
      .expect(403);
    await api()
      .patch(`/tasks/${task}`)
      .set('Authorization', bearer(bob))
      .send({ status: 'DONE' })
      .expect(200);
    await api()
      .patch(`/tasks/${task}`)
      .set('Authorization', bearer(bob))
      .send({ status: 'TODO' })
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
        .send(body)
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
      .send({ content: 'Changed by owner' })
      .expect(403);
    await api()
      .patch(`/comments/${comment}`)
      .set('Authorization', bearer(bob))
      .send({ content: 'Updated by author' })
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
      .set('Authorization', bearer(bob))
      .expect(403);
    await api()
      .patch(`/projects/${project}`)
      .set('Authorization', bearer(bob))
      .send({ status: 'ARCHIVED' })
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

  it('serves Swagger with all 31 endpoints and applies security headers and CORS', async () => {
    await api().get('/api/docs/').expect(200);
    const docs = await api().get('/api/docs-json').expect(200);
    const count = Object.values(docs.body.paths).reduce<number>(
      (sum, p) => sum + Object.keys(p as object).length,
      0,
    );
    expect(count).toBe(31);
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
      '/tasks/{id}': ['get', 'patch', 'delete'],
      '/tasks/{id}/assign': ['patch'],
      '/tasks/{taskId}/comments': ['get', 'post'],
      '/comments/{id}': ['patch', 'delete'],
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
      .set('Authorization', bearer(alice))
      .expect(204);
    expect(await prisma.project.count()).toBe(0);
    expect(await prisma.task.count()).toBe(0);
    expect(await prisma.comment.count()).toBe(0);
  });
});
