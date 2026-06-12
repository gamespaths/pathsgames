import type { GuestRepository } from '../ports/GuestRepository';
import type { MatchRepository } from '../ports/MatchRepository';

export class TestDataCleanupService {
  static readonly ROBOT_TEST_MARKER = 'robottest';

  constructor(
    private guestRepo: GuestRepository,
    private matchRepo: MatchRepository,
  ) {}

  async cleanupTestData() {
    const guests = await this.guestRepo.listAll();
    let deletedGuests = 0;
    for (const guest of guests) {
      if (guest.username.startsWith(TestDataCleanupService.ROBOT_TEST_MARKER)) {
        await this.guestRepo.delete(guest.uuid);
        deletedGuests++;
      }
    }

    const deletedMatches = await this.matchRepo.deleteByNameLike(`%${TestDataCleanupService.ROBOT_TEST_MARKER}%`);

    return { deletedGuests, deletedMatches };
  }
}
