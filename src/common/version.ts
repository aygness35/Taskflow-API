import { BadRequestException, ConflictException } from '@nestjs/common';
import { Prisma } from '@prisma/client';

export function versionMatch(expected: string) {
  if (!expected || !Number.isFinite(Date.parse(expected))) {
    throw new BadRequestException('A valid expectedUpdatedAt is required');
  }
  return { updatedAt: new Date(expected) };
}

export function versionStamp(expected: string) {
  // Advance even when two edits occur within the same millisecond.
  const current = versionMatch(expected).updatedAt;
  return { updatedAt: new Date(Math.max(Date.now(), current.getTime() + 1)) };
}

export async function withVersion<T>(
  expected: string,
  update: () => Promise<T>,
): Promise<T> {
  versionMatch(expected);
  try {
    return await update();
  } catch (error) {
    if (
      expected &&
      error instanceof Prisma.PrismaClientKnownRequestError &&
      error.code === 'P2025'
    ) {
      throw new ConflictException(
        'Resource changed since it was opened. Reload before changing or deleting it.',
      );
    }
    throw error;
  }
}
