import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';
import { versionStamp, withVersion } from './version';

describe('Version conflicts', () => {
  afterEach(() => jest.restoreAllMocks());
  it('does not execute a mutation without a valid version', async () => {
    const mutation = jest.fn();
    await expect(withVersion('', mutation)).rejects.toBeInstanceOf(
      BadRequestException,
    );
    expect(mutation).not.toHaveBeenCalled();
  });
  it('advances the version even if the clock has not advanced', () => {
    const expected = '2026-01-01T00:00:00.000Z';
    jest.spyOn(Date, 'now').mockReturnValue(Date.parse(expected) - 1000);
    expect(versionStamp(expected).updatedAt?.getTime()).toBe(
      Date.parse(expected) + 1,
    );
  });
  it('maps a failed atomic version match to a conflict', async () => {
    const error = new Prisma.PrismaClientKnownRequestError('Missing match', {
      code: 'P2025',
      clientVersion: '6.19.0',
    });
    await expect(
      withVersion('2026-01-01T00:00:00.000Z', async () => {
        throw error;
      }),
    ).rejects.toBeInstanceOf(ConflictException);
  });
  it('does not mask unrelated database failures as conflicts', async () => {
    const error = new Error('Database unavailable');
    await expect(
      withVersion('2026-01-01T00:00:00.000Z', async () => {
        throw error;
      }),
    ).rejects.toBe(error);
  });
});
