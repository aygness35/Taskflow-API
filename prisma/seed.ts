import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import * as bcrypt from 'bcrypt';
const prisma = new PrismaClient();
async function main() {
  if (process.env.NODE_ENV === 'production')
    throw new Error('Demo seed is disabled in production');
  const password = await bcrypt.hash('TaskFlowDemo1!', 12);
  const alice = await prisma.user.upsert({
    where: { email: 'alice@example.com' },
    update: {},
    create: { email: 'alice@example.com', name: 'Alice', password },
  });
  const bob = await prisma.user.upsert({
    where: { email: 'bob@example.com' },
    update: {},
    create: { email: 'bob@example.com', name: 'Bob', password },
  });
  const existing = await prisma.workspace.findFirst({
    where: { ownerId: alice.id, name: 'TaskFlow Demo' },
  });
  if (existing) {
    console.log('Demo workspace already exists; no data changed.');
    return;
  }
  await prisma.workspace.create({
    data: {
      name: 'TaskFlow Demo',
      ownerId: alice.id,
      members: {
        create: [
          { userId: alice.id, role: 'OWNER' },
          { userId: bob.id, role: 'MEMBER' },
        ],
      },
      projects: {
        create: {
          name: 'API Launch',
          description: 'Explore workspace-scoped project management.',
          tasks: {
            create: {
              title: 'Explore the Swagger API',
              priority: 'HIGH',
              createdById: alice.id,
              assigneeId: bob.id,
              comments: {
                create: { authorId: alice.id, content: 'Start at /api/docs.' },
              },
            },
          },
        },
      },
    },
  });
  console.log(
    'Demo created: alice@example.com (OWNER), bob@example.com (MEMBER). Password: TaskFlowDemo1!',
  );
}
main()
  .catch((error: unknown) => {
    console.error(error);
    process.exitCode = 1;
  })
  .finally(() => prisma.$disconnect());
