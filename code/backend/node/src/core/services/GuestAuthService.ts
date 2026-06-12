import { v4 as uuid } from 'uuid';
import type { GuestRepository } from '../ports/GuestRepository';
import type { TokenRepository } from '../ports/TokenRepository';
import type { JwtPort } from '../ports/JwtPort';

export class GuestAuthService {
  constructor(
    private guestRepo: GuestRepository,
    private tokenRepo: TokenRepository,
    private jwtPort: JwtPort,
  ) {}

  async createGuestSession(testMarker?: string) {
    const username = testMarker ? `${testMarker}_${uuid()}` : `guest_${uuid()}`;
    const guest = await this.guestRepo.create(username, testMarker);
    
    const accessToken = this.jwtPort.sign(
      { uuid: guest.uuid, username: guest.username, role: guest.role, type: 'access' },
      30,
    );
    const refreshToken = this.jwtPort.sign(
      { uuid: guest.uuid, username: guest.username, role: guest.role, type: 'refresh' },
      7 * 24 * 60,
    );

    await this.tokenRepo.create(guest.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'refresh');

    return {
      userUuid: guest.uuid,
      username: guest.username,
      accessToken,
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
  }

  async resumeGuestSession(guestUuid: string) {
    const guest = await this.guestRepo.findByUuid(guestUuid);
    if (!guest) return null;

    const accessToken = this.jwtPort.sign(
      { uuid: guest.uuid, username: guest.username, role: guest.role, type: 'access' },
      30,
    );
    const refreshToken = this.jwtPort.sign(
      { uuid: guest.uuid, username: guest.username, role: guest.role, type: 'refresh' },
      7 * 24 * 60,
    );

    await this.tokenRepo.create(guest.id, refreshToken, new Date(Date.now() + 7 * 24 * 60 * 60 * 1000), 'refresh');

    return {
      userUuid: guest.uuid,
      username: guest.username,
      accessToken,
      accessTokenExpiresAt: Date.now() + 30 * 60 * 1000,
      refreshTokenExpiresAt: Date.now() + 7 * 24 * 60 * 60 * 1000,
    };
  }

  async cleanupExpiredGuestSessions(): Promise<number> {
    return this.guestRepo.deleteExpired();
  }
}
