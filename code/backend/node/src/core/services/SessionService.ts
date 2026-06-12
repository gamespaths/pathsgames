import type { TokenRepository } from '../ports/TokenRepository';
import type { JwtPort, JwtPayload } from '../ports/JwtPort';

export class SessionService {
  constructor(
    private tokenRepo: TokenRepository,
    private jwtPort: JwtPort,
  ) {}

  async refreshToken(refreshToken: string) {
    const payload = this.jwtPort.verify(refreshToken);
    if (!payload || payload.type !== 'refresh') {
      throw new Error('Invalid refresh token');
    }

    await this.tokenRepo.revoke(refreshToken);
    await this.tokenRepo.revokeAllByGuestId(payload.uuid);

    const newAccessToken = this.jwtPort.sign(
      { ...payload, type: 'access' },
      30,
    );
    const newRefreshToken = this.jwtPort.sign(
      { ...payload, type: 'refresh' },
      7 * 24 * 60,
    );

    return {
      userUuid: payload.uuid,
      username: payload.username,
      role: payload.role,
      accessToken: newAccessToken,
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
  }

  async logout(refreshToken: string): Promise<boolean> {
    return this.tokenRepo.revoke(refreshToken);
  }

  async revokeAllSessions(guestId: string): Promise<number> {
    return this.tokenRepo.revokeAllByGuestId(guestId);
  }
}
