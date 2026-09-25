import {
  BadRequestException,
  Injectable,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { Prisma } from '@prisma/client';
import * as bcrypt from 'bcrypt';
import { createHash, randomUUID } from 'node:crypto';
import { PrismaService } from '../prisma/prisma.service';
import { LoginDto, RegisterDto } from './dto/auth.dto';
@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
  ) {}
  async register(dto: RegisterDto) {
    if (Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new BadRequestException('password must be at most 72 UTF-8 bytes');
    const password = await bcrypt.hash(dto.password, 12);
    return this.prisma.$transaction(async (tx) => {
      const user = await tx.user.create({ data: { ...dto, password } });
      return this.issueTokens(tx, user.id);
    });
  }
  async login(dto: LoginDto) {
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    // A fixed valid hash also performs bcrypt work for unknown accounts.
    const hash =
      user?.password ??
      '$2b$12$R9h/cIPz0gi.URNNX3kh2OPST9/PgBkqquzi.Ss7KIUgO2t0jWMUW';
    const valid = await bcrypt.compare(dto.password, hash);
    if (!user || !valid || Buffer.byteLength(dto.password, 'utf8') > 72)
      throw new UnauthorizedException('Invalid email or password');
    return this.issueTokens(this.prisma, user.id);
  }
  private digest(token: string) {
    return createHash('sha256').update(token).digest('hex');
  }
  private async verifyRefresh(
    token: string,
  ): Promise<{ sub: string; jti: string }> {
    try {
      const payload = await this.jwt.verifyAsync(token, {
        secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
        algorithms: ['HS256'],
        issuer: 'taskflow',
        audience: 'taskflow-refresh',
      });
      if (
        payload.type !== 'refresh' ||
        typeof payload.sub !== 'string' ||
        typeof payload.jti !== 'string'
      )
        throw new Error('Invalid token');
      return payload;
    } catch {
      throw new UnauthorizedException('Invalid or expired refresh token');
    }
  }
  async refresh(token: string) {
    const payload = await this.verifyRefresh(token);
    return this.prisma.$transaction(async (tx) => {
      // Conditional update consumes a refresh token once, including concurrent requests.
      const result = await tx.refreshToken.updateMany({
        where: {
          id: payload.jti,
          userId: payload.sub,
          tokenHash: this.digest(token),
          revoked: false,
          expiresAt: { gt: new Date() },
        },
        data: { revoked: true },
      });
      if (result.count !== 1)
        throw new UnauthorizedException('Invalid or revoked refresh token');
      return this.issueTokens(tx, payload.sub);
    });
  }
  async logout(token: string) {
    const payload = await this.verifyRefresh(token);
    await this.prisma.refreshToken.updateMany({
      where: {
        id: payload.jti,
        userId: payload.sub,
        tokenHash: this.digest(token),
      },
      data: { revoked: true },
    });
  }
  private async issueTokens(tx: Prisma.TransactionClient, userId: string) {
    const id = randomUUID();
    const [accessToken, refreshToken] = await Promise.all([
      this.jwt.signAsync(
        { sub: userId, type: 'access' },
        {
          secret: this.config.getOrThrow<string>('JWT_SECRET'),
          algorithm: 'HS256',
          expiresIn: '15m',
          issuer: 'taskflow',
          audience: 'taskflow-api',
        },
      ),
      this.jwt.signAsync(
        { sub: userId, type: 'refresh' },
        {
          secret: this.config.getOrThrow<string>('JWT_REFRESH_SECRET'),
          algorithm: 'HS256',
          expiresIn: '7d',
          jwtid: id,
          issuer: 'taskflow',
          audience: 'taskflow-refresh',
        },
      ),
    ]);
    await tx.refreshToken.create({
      data: {
        id,
        userId,
        tokenHash: this.digest(refreshToken),
        expiresAt: new Date(Date.now() + 7 * 86400000),
      },
    });
    return { accessToken, refreshToken };
  }
}
