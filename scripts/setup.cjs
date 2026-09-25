const fs = require('node:fs');
const path = require('node:path');
const { randomBytes } = require('node:crypto');
const dotenv = require('dotenv');
if (!fs.existsSync('.env')) {
  const template = fs
    .readFileSync('.env.example', 'utf8')
    .replace(
      'replace-with-a-random-secret-at-least-32-characters',
      randomBytes(48).toString('hex'),
    )
    .replace(
      'replace-with-a-different-random-secret-at-least-32-characters',
      randomBytes(48).toString('hex'),
    );
  fs.writeFileSync('.env', template, { flag: 'wx' });
  console.log('Created .env with independent random JWT secrets.');
}
const env = dotenv.parse(fs.readFileSync('.env'));
const url = process.env.DATABASE_URL || env.DATABASE_URL;
if (!url || !url.startsWith('file:'))
  throw new Error('DATABASE_URL must be a SQLite file URL');
const filename = path.resolve('prisma', url.slice(5));
fs.mkdirSync(path.dirname(filename), { recursive: true });
if (!fs.existsSync(filename)) fs.closeSync(fs.openSync(filename, 'wx'));
console.log(
  'SQLite file is ready; existing environment and database were preserved.',
);
