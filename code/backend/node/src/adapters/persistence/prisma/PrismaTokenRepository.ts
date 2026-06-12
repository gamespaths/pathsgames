import { PrismaClient } from '@prisma/client';
import type { TokenRepository, TokenData } from '../../../core/ports/TokenRepository';
import { toInt } from './textResolver';

// Tokens are stored in `users_tokens` (idUser → users.id, refreshToken, revoked).
export class PrismaTokenRepository implements TokenRepository {
  constructor(private prisma: PrismaClient) {}

  private _map(row: any, type = 'refresh'): TokenData {
    return {
      id: String(row.id),
      guestId: String(row.idUser),
      type,
      token: row.refreshToken,
      expiresAt: new Date(row.expiresAt),
      revokedAt: row.revoked ? new Date() : null,
    };
  }

  async create(guestId: string, token: string, expiresAt: Date, type: string): Promise<TokenData> {
    const row = await this.prisma.userToken.create({
      data: { idUser: toInt(guestId), refreshToken: token, expiresAt: expiresAt.toISOString(), revoked: false },
    });
    return this._map(row, type);
  }

  async findByToken(token: string): Promise<TokenData | null> {
    const row = await this.prisma.userToken.findFirst({ where: { refreshToken: token } });
    if (!row || row.revoked) return null;
    return this._map(row);
  }

  async revoke(token: string): Promise<boolean> {
    const result = await this.prisma.userToken.updateMany({
      where: { refreshToken: token },
      data: { revoked: true },
    });
    return result.count > 0;
  }

  async revokeAllByGuestId(guestId: string): Promise<number> {
    const result = await this.prisma.userToken.updateMany({
      where: { idUser: toInt(guestId) },
      data: { revoked: true },
    });
    return result.count;
  }

  async deleteExpired(): Promise<number> {
    const result = await this.prisma.userToken.deleteMany({
      where: { expiresAt: { lt: new Date().toISOString() } },
    });
    return result.count;
  }
}
