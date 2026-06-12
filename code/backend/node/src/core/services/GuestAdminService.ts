import type { GuestRepository } from '../ports/GuestRepository';

export class GuestAdminService {
  constructor(private guestRepo: GuestRepository) {}

  async listAllGuests() {
    return this.guestRepo.listAll();
  }

  async getGuestByUuid(uuid: string) {
    return this.guestRepo.findByUuid(uuid);
  }

  async deleteGuest(uuid: string): Promise<boolean> {
    return this.guestRepo.delete(uuid);
  }

  async deleteExpiredGuests(): Promise<number> {
    return this.guestRepo.deleteExpired();
  }

  async getGuestStats() {
    const all = await this.guestRepo.listAll();
    return {
      totalGuests: all.length,
      activeGuests: all.filter((g) => g.role === 'PLAYER').length,
      expiredGuests: 0,
    };
  }
}
