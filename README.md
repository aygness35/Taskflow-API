# TaskFlow API

A NestJS REST API for workspace-scoped project and task management. Every project, task, and comment belongs to a workspace; membership is checked on every resource request. The application includes JWT authentication, rotating refresh tokens, role-based permissions, SQLite persistence, and Swagger documentation.

## Requirements

- Node.js 22 LTS (see `.nvmrc`), npm, and Git.
- No database server is required. SQLite stores development data in `prisma/dev.db`.
- NestJS 11 and Prisma 6.19 are pinned through `package-lock.json`. Prisma 6 preserves the schema configuration requested for this case; upgrading to Prisma 7 requires an explicit configuration and adapter migration.

## Quick start

Clone your repository and enter its root directory, then run:

```sh
npm install
npm run setup
npx prisma migrate dev --name init
npm run seed
npm run start:dev
```

`npm run setup` copies `.env.example` to `.env`, generates two independent random JWT secrets, and creates the empty SQLite file if needed. It preserves existing files. This also handles environments in which Prisma cannot initialize a missing SQLite file. Review `CORS_ORIGINS` and `PORT` in `.env` before starting. `.env` and database files are ignored by Git. On Windows PowerShell, use `npm.cmd` / `npx.cmd` if execution policy blocks the `.ps1` wrappers.

- API: `http://localhost:3000`
- Swagger UI: `http://localhost:3000/api/docs`
- OpenAPI JSON: `http://localhost:3000/api/docs-json`

The optional, idempotent development seed creates `alice@example.com` (OWNER) and `bob@example.com` (MEMBER), both with password `TaskFlowDemo1!`, plus a sample workspace, project, task, and comment. Seed refuses to run with `NODE_ENV=production`; do not use demo credentials in deployed environments.

For a compiled start:

```sh
npm run build
npm start
```

## Configuration

| Variable             | Purpose                                                       |
| -------------------- | ------------------------------------------------------------- |
| `DATABASE_URL`       | SQLite file URL; relative paths resolve from `prisma/`        |
| `JWT_SECRET`         | Access-token signing secret, at least 32 characters           |
| `JWT_REFRESH_SECRET` | Separate refresh-token signing secret, at least 32 characters |
| `CORS_ORIGINS`       | Comma-separated exact HTTP(S) origins, no trailing slash      |
| `PORT`               | HTTP port, default 3000                                       |
| `NODE_ENV`           | `development`, `test`, or `production`                        |

Environment validation rejects example secrets, equal signing secrets, and malformed configuration. Access tokens expire in 15 minutes; refresh tokens expire in 7 days. Refresh JWTs carry unique IDs, and only SHA-256 digests of these high-entropy signed tokens are persisted. Rotation consumes the old token with a conditional update and creates its replacement in the same transaction. Reusing an old token returns 401. Logout revokes the supplied refresh token; already-issued access tokens remain valid until expiration. Passwords use bcrypt with cost 12 and are limited to 72 UTF-8 bytes.

## Data relationships

- A user owns workspaces and joins workspaces through `WorkspaceMember`, unique per workspace/user pair.
- A workspace contains projects; each project contains tasks; each task contains comments.
- Tasks record their creator and optional assignee. Assignees must be current workspace members.
- Comments belong to an author. Refresh tokens belong to a user.
- Removing a member clears their task assignments in that workspace. Created tasks and comments remain.
- Deleting a workspace cascades to memberships, projects, tasks, and comments.
- All IDs are UUIDs. Roles, statuses, and priorities are strings in SQLite, validated with TypeScript enums and DTO validators.

## Permissions

| Operation                                      | Allowed actors                       |
| ---------------------------------------------- | ------------------------------------ |
| Read workspace and nested resources            | Current workspace members            |
| Update workspace; create/update/delete project | OWNER, ADMIN                         |
| Delete workspace                               | OWNER                                |
| Add ordinary members                           | OWNER, ADMIN                         |
| Appoint/manage administrators                  | OWNER                                |
| Remove ordinary members                        | OWNER, ADMIN, or the member themself |
| Leave workspace                                | Any member except OWNER              |
| Create/update/assign tasks                     | All workspace members                |
| Delete task                                    | Creator, OWNER, ADMIN                |
| Add/read comments                              | All workspace members                |
| Edit comment                                   | Author only                          |
| Delete comment                                 | Author, OWNER, ADMIN                 |

The original owner's membership cannot be removed or demoted; ownership transfer is outside this API's scope. ADMIN cannot promote members to ADMIN or manage another administrator. Nonmembers receive 403 for all workspace-scoped resources, including nested routes. Unknown resource UUIDs also return 403 to avoid disclosing existence. Malformed UUIDs return 400. A member ID from another workspace cannot be used to modify local membership.

## API surface

All 31 operations are documented in Swagger. Routes have no `/api` prefix; only documentation is under `/api/docs`.

| Area       | Routes                                                                                                   |
| ---------- | -------------------------------------------------------------------------------------------------------- |
| Auth       | `POST /auth/register`, `/auth/login`, `/auth/refresh`, `/auth/logout`; `GET /auth/me`                    |
| Users      | `GET`, `PATCH /users/me` (name updates)                                                                  |
| Workspaces | `POST`, `GET /workspaces`; `GET`, `PATCH`, `DELETE /workspaces/:id`                                      |
| Members    | `POST`, `GET /workspaces/:id/members`; `PATCH`, `DELETE /workspaces/:id/members/:memberId`               |
| Projects   | `POST`, `GET /workspaces/:workspaceId/projects`; `GET`, `PATCH`, `DELETE /projects/:id`                  |
| Tasks      | `POST`, `GET /projects/:projectId/tasks`; `GET`, `PATCH`, `DELETE /tasks/:id`; `PATCH /tasks/:id/assign` |
| Comments   | `POST`, `GET /tasks/:taskId/comments`; `PATCH`, `DELETE /comments/:id`                                   |

Project lists accept `status`, `page`, and `limit`. Task lists accept `status`, `priority`, `assigneeId`, `search` (title/description), `page`, `limit`, `sortBy` (`createdAt`, `updatedAt`, `dueDate`, `title`), and `sortOrder` (`asc`, `desc`). Comment lists accept `page` and `limit`. Page defaults to 1, limit to 20, and maximum limit is 100. Lists use a stable ID tie-breaker and return `{ data, meta: { total, page, limit, totalPages } }`.

Valid task statuses: `TODO`, `IN_PROGRESS`, `IN_REVIEW`, `DONE`. Transitions between these statuses are allowed, including reopening DONE tasks. Priorities: `LOW`, `MEDIUM`, `HIGH`, `URGENT`. New task deadlines cannot be in the past. `assigneeId: null` unassigns a task; nullable descriptions and deadlines can also be cleared. Unknown body/query fields and null values for non-nullable fields are rejected.

## Example requests

```http
POST /auth/login
Content-Type: application/json

{"email":"alice@example.com","password":"TaskFlowDemo1!"}
```

```json
{ "accessToken": "<access-jwt>", "refreshToken": "<refresh-jwt>" }
```

```http
POST /workspaces
Authorization: Bearer <access-jwt>
Content-Type: application/json

{"name":"Engineering"}
```

```http
POST /workspaces/<workspace-id>/members
Authorization: Bearer <access-jwt>
Content-Type: application/json

{"email":"bob@example.com","role":"MEMBER"}
```

Failed authorization uses the consistent error shape:

```json
{
  "statusCode": 403,
  "message": "Workspace access denied",
  "error": "Forbidden",
  "timestamp": "2026-09-25T00:00:00.000Z",
  "path": "/workspaces/<workspace-id>"
}
```

Use an access JWT in Swagger's **Authorize** dialog. Responses never expose password hashes or refresh-token hashes. Login and register allow 10 and 5 requests per minute per IP respectively; other API routes allow 120 per minute per IP and route. Helmet sets security headers; CORS permits only configured origins.

## Validation and tests

```sh
npm run build
npm test
npm run test:e2e
npm run format:check
```

Unit tests cover bcrypt handling, credentials, and task deletion permissions. E2E tests use Supertest against the real Nest application, production guards, and real Prisma queries. Each run creates a unique temporary SQLite database, applies committed migrations, and deletes only that test database afterward. Development data is preserved. Tests exercise cross-workspace access on every scoped route, refresh-token rotation/revocation, validation, permissions, pagination, documentation, CORS, rate limits, and cascading deletion.

For the case's manual isolation check, register a third user, sign in as that user, and request Alice's workspace ID: expect 403. Signing in as Alice should allow the same request.

## Layout and operating notes

`src/auth`, `users`, `workspaces`, `projects`, `tasks`, and `comments` each have controllers, services, and DTOs. `src/common` contains decorators, guards, pagination, and the global error filter. `src/prisma` provides the global database client. Global validation uses `whitelist`, `forbidNonWhitelisted`, and `transform`; user serialization additionally uses `ClassSerializerInterceptor` and `@Exclude`.

This is a single-instance SQLite backend. Before deployment, configure TLS, durable storage/backups, private secrets, and appropriate origins. Throttling is in-memory; multiple instances require shared rate-limit storage. Do not enable proxy trust without restricting it to your actual proxy. Use `prisma migrate deploy` to apply committed migrations in deployments, and never run demo seeding there. Logout does not revoke other sessions. Email verification, password reset, ownership transfer, and refresh-token family revocation are not implemented.

The local Git history follows conventional commits. To publish, create an empty GitHub repository, add its URL as `origin`, and push the branch. No remote is assumed by the project.
