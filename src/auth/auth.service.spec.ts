import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from './auth.service';
describe('AuthService', () => {
  const user = { create: jest.fn(), findUnique: jest.fn() };
  const refreshToken = { create: jest.fn() };
  const tx = { user, refreshToken };
  const prisma = {
    ...tx,
    $transaction: (fn: (client: typeof tx) => unknown) => fn(tx),
  };
  const jwt = { signAsync: jest.fn().mockResolvedValue('signed-token') };
  const service = new AuthService(
    prisma as unknown as PrismaService,
    jwt as unknown as JwtService,
    new ConfigService({ JWT_SECRET: 'test', JWT_REFRESH_SECRET: 'refresh' }),
  );
  beforeEach(() => jest.clearAllMocks());
  it('hashes passwords with bcrypt cost 12 before persistence and stores only refresh digests', async () => {
    user.create.mockResolvedValue({ id: 'user' });
    await service.register({
      email: 'alice@example.com',
      name: 'Alice',
      password: 'StrongPassword1!',
    });
    const stored = user.create.mock.calls[0][0].data.password;
    expect(stored).not.toBe('StrongPassword1!');
    expect(bcrypt.getRounds(stored)).toBe(12);
    expect(await bcrypt.compare('StrongPassword1!', stored)).toBe(true);
    expect(refreshToken.create.mock.calls[0][0].data.tokenHash).toMatch(
      /^[a-f0-9]{64}$/,
    );
  });
  it('rejects incorrect credentials without issuing tokens', async () => {
    user.findUnique.mockResolvedValue({
      id: 'user',
      password: await bcrypt.hash('CorrectPassword1!', 10),
    });
    await expect(
      service.login({
        email: 'alice@example.com',
        password: 'WrongPassword1!',
      }),
    ).rejects.toThrow(UnauthorizedException);
    expect(jwt.signAsync).not.toHaveBeenCalled();
  });
  it('authenticates a correct password', async () => {
    user.findUnique.mockResolvedValue({
      id: 'user',
      password: await bcrypt.hash('CorrectPassword1!', 10),
    });
    await expect(
      service.login({
        email: 'alice@example.com',
        password: 'CorrectPassword1!',
      }),
    ).resolves.toHaveProperty('accessToken');
  });
  it('rejects passwords exceeding bcrypt UTF-8 byte capacity', async () => {
    await expect(
      service.register({
        email: 'a@example.com',
        name: 'Alice',
        password: `A1${'ü'.repeat(36)}`,
      }),
    ).rejects.toThrow('72 UTF-8 bytes');
    expect(user.create).not.toHaveBeenCalled();
  });
});
