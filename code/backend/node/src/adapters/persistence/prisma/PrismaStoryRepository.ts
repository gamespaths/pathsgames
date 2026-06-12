import { PrismaClient } from '@prisma/client';
import type { StoryRepository } from '../../../core/ports/StoryRepository';
import type { Story } from '../../../core/models/Story';
import { resolveText, toInt, toDate } from './textResolver';

export class PrismaStoryRepository implements StoryRepository {
  constructor(private prisma: PrismaClient) {}

  /** Map a list_stories row to the Story domain object (title/description resolved). */
  private async _map(row: any): Promise<Story> {
    const title = (await resolveText(this.prisma, row.id, row.idTextTitle)) || row.uuid;
    const description = await resolveText(this.prisma, row.id, row.idTextDescription);
    return {
      id: String(row.id),
      uuid: row.uuid,
      title,
      description: description ?? undefined,
      author: row.author ?? undefined,
      category: row.category ?? undefined,
      group: row.group ?? undefined,
      visibility: row.visibility,
      priority: row.priority ?? 0,
      peghi: row.peghi ?? 0,
      idStory: row.id,
      idTextTitle: row.idTextTitle ?? null,
      idTextDescription: row.idTextDescription ?? null,
      idCard: row.idCard ?? null,
      idImage: row.idImage ?? null,
      idLocationStart: row.idLocationStart ?? null,
      idCreator: row.idCreator ?? null,
      idLocationAllPlayerComa: row.idLocationAllPlayerComa ?? null,
      idEventAllPlayerComa: row.idEventAllPlayerComa ?? null,
      idEventEndGame: row.idEventEndGame ?? null,
      idTextCopyright: row.idTextCopyright ?? null,
      idTextClockSingular: row.idTextClockSingular ?? null,
      idTextClockPlural: row.idTextClockPlural ?? null,
      linkCopyright: row.linkCopyright ?? null,
      createdAt: toDate(row.tsInsert),
      updatedAt: toDate(row.tsUpdate),
    };
  }

  private async _mapMany(rows: any[]): Promise<Story[]> {
    return Promise.all(rows.map((r) => this._map(r)));
  }

  async findById(id: string): Promise<Story | null> {
    const row = await this.prisma.listStory.findUnique({ where: { id: toInt(id) } });
    return row ? this._map(row) : null;
  }

  async findByUuid(uuid: string): Promise<Story | null> {
    const row = await this.prisma.listStory.findUnique({ where: { uuid } });
    return row ? this._map(row) : null;
  }

  async listPublic(): Promise<Story[]> {
    return this._mapMany(
      await this.prisma.listStory.findMany({ where: { visibility: 'PUBLIC' }, orderBy: { priority: 'desc' } }),
    );
  }

  async listAll(): Promise<Story[]> {
    return this._mapMany(await this.prisma.listStory.findMany({ orderBy: { priority: 'desc' } }));
  }

  async listCategories(): Promise<string[]> {
    const rows = await this.prisma.listStory.findMany({
      select: { category: true },
      where: { category: { not: null } },
      distinct: ['category'],
    });
    return rows.map((c) => c.category).filter(Boolean) as string[];
  }

  async listGroups(): Promise<string[]> {
    const rows = await this.prisma.listStory.findMany({
      select: { group: true },
      where: { group: { not: null } },
      distinct: ['group'],
    });
    return rows.map((g) => g.group).filter(Boolean) as string[];
  }

  async listByCategory(category: string): Promise<Story[]> {
    return this._mapMany(await this.prisma.listStory.findMany({ where: { category } }));
  }

  async listByGroup(group: string): Promise<Story[]> {
    return this._mapMany(await this.prisma.listStory.findMany({ where: { group } }));
  }

  async create(data: any): Promise<Story> {
    const row = await this.prisma.listStory.create({
      data: {
        uuid: data.uuid,
        author: data.author ?? null,
        category: data.category ?? null,
        group: data.group ?? null,
        visibility: data.visibility ?? 'DRAFT',
        priority: data.priority ?? 0,
        peghi: data.peghi ?? 0,
        idTextTitle: data.idTextTitle ?? null,
        idTextDescription: data.idTextDescription ?? null,
      },
    });
    return this._map(row);
  }

  async update(uuid: string, data: any): Promise<Story> {
    const row = await this.prisma.listStory.update({
      where: { uuid },
      data: {
        author: data.author,
        category: data.category,
        group: data.group,
        visibility: data.visibility,
        priority: data.priority,
        peghi: data.peghi,
        idTextTitle: data.idTextTitle,
        idTextDescription: data.idTextDescription,
        idCard: data.idCard,
        idImage: data.idImage,
        idLocationStart: data.idLocationStart,
        idCreator: data.idCreator,
        idEventEndGame: data.idEventEndGame,
        idTextClockSingular: data.idTextClockSingular,
        idTextClockPlural: data.idTextClockPlural,
      },
    });
    return this._map(row);
  }

  async delete(uuid: string): Promise<void> {
    await this.prisma.listStory.delete({ where: { uuid } });
  }
}
