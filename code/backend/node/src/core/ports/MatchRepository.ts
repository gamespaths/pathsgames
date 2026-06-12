import type { Match } from '../models/Match';

export interface MatchRepository {
  create(guestId: string, storyId: string, difficultyUuid?: string, name?: string): Promise<Match>;
  findByUuid(uuid: string): Promise<Match | null>;
  listByGuestId(guestId: string): Promise<Match[]>;
  listAll(): Promise<Match[]>;
  update(uuid: string, data: Partial<Match>): Promise<Match>;
  delete(uuid: string): Promise<boolean>;
  deleteByNameLike(pattern: string): Promise<number>;
}
