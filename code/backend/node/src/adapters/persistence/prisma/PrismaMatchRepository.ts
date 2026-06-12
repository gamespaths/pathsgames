import { PrismaClient } from '@prisma/client';
import type { MatchRepository } from '../../../core/ports/MatchRepository';
import type { Match } from '../../../core/models/Match';
import { v4 as uuidv4 } from 'uuid';
import { toInt, toDate } from './textResolver';

export class PrismaMatchRepository implements MatchRepository {
  constructor(private prisma: PrismaClient) {}

  private _map(row: any): Match {
    return {
      id: String(row.id),
      uuid: row.uuid,
      guestId: String(row.idUserCreator),
      storyId: String(row.idStory),
      difficultyUuid: row.difficultyUuid ?? null,
      status: row.status,
      progress: row.progress ?? 0,
      createdAt: toDate(row.tsInsert),
      updatedAt: toDate(row.tsUpdate),
      endedAt: row.endedAt ?? null,
    };
  }

  async create(guestId: string, storyId: string, difficultyUuid?: string, name?: string): Promise<Match> {
    let idDifficulty = 0;
    if (difficultyUuid) {
      const diff = await this.prisma.difficulty.findUnique({ where: { uuid: difficultyUuid } });
      idDifficulty = diff?.id ?? 0;
    }
    const row = await this.prisma.gamingMatch.create({
      data: {
        uuid: uuidv4(),
        idStory: toInt(storyId),
        idUserCreator: toInt(guestId),
        idDifficulty,
        difficultyUuid: difficultyUuid ?? null,
        name: name ?? null,
        status: 'ACTIVE',
      },
    });
    return this._map(row);
  }

  async findByUuid(uuid: string): Promise<Match | null> {
    const row = await this.prisma.gamingMatch.findUnique({ where: { uuid } });
    return row ? this._map(row) : null;
  }

  async listByGuestId(guestId: string): Promise<Match[]> {
    const rows = await this.prisma.gamingMatch.findMany({ where: { idUserCreator: toInt(guestId) } });
    return rows.map((r) => this._map(r));
  }

  async listAll(): Promise<Match[]> {
    const rows = await this.prisma.gamingMatch.findMany();
    return rows.map((r) => this._map(r));
  }

  async update(uuid: string, data: Partial<Match>): Promise<Match> {
    const row = await this.prisma.gamingMatch.update({
      where: { uuid },
      data: {
        status: data.status,
        progress: data.progress,
        endedAt: data.endedAt ?? undefined,
      },
    });
    return this._map(row);
  }

  async delete(uuid: string): Promise<boolean> {
    try {
      await this.prisma.gamingMatch.delete({ where: { uuid } });
      return true;
    } catch {
      return false;
    }
  }

  async deleteByNameLike(pattern: string): Promise<number> {
    const marker = pattern.replace(/%/g, '');
    if (!marker) return 0;
    const result = await this.prisma.gamingMatch.deleteMany({ where: { name: { contains: marker } } });
    return result.count;
  }
}
