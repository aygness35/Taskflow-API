const fs = require('node:fs');
const path = require('node:path');
const { spawnSync } = require('node:child_process');
const { randomUUID } = require('node:crypto');
const directory = path.resolve('tmp', `e2e-${randomUUID()}`);
fs.mkdirSync(directory, { recursive: true });
const database = path.join(directory, 'test.db');
fs.writeFileSync(database, '', { flag: 'wx' });
const env = {
  ...process.env,
  NODE_ENV: 'test',
  DATABASE_URL: `file:${database.replaceAll('\\', '/')}`,
  JWT_SECRET: 'e2e-access-secret-only-for-isolated-test-runs',
  JWT_REFRESH_SECRET: 'e2e-refresh-secret-only-for-isolated-test-runs',
  CORS_ORIGINS: 'http://localhost:3001',
};
let result;
try {
  result = spawnSync(
    process.execPath,
    ['node_modules/prisma/build/index.js', 'migrate', 'deploy'],
    { env, stdio: 'inherit' },
  );
  if (result.status === 0)
    result = spawnSync(
      process.execPath,
      [
        'node_modules/jest/bin/jest.js',
        '--config',
        'test/jest-e2e.json',
        '--runInBand',
      ],
      { env, stdio: 'inherit' },
    );
} finally {
  // Remove only this invocation's explicitly created temporary directory.
  fs.rmSync(directory, { recursive: true, force: true });
}
if (result.error) console.error(result.error.message);
process.exit(result.status ?? 1);
