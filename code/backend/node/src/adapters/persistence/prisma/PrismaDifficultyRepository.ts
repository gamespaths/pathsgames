import { PrismaClient } from '@prisma/client';
import { Difficulty } from '../../../core/models/Difficulty';
import { DifficultyRepository } from '../../../core/ports/DifficultyRepository';
import { resolveText, toInt } from './textResolver';

export class PrismaDifficultyRepository implements DifficultyRepository {
  constructor(private prisma: PrismaClient) {}

  private async _map(row: any): Promise<Difficulty> {
    const title = (await resolveText(this.prisma, row.idStory, row.idTextName)) || `Difficulty ${row.id}`;
    const description = await resolveText(this.prisma, row.idStory, row.idTextDescription);
    return {
      id: String(row.id),
      uuid: row.uuid,
      storyId: String(row.idStory),
      title,
      description: description ?? undefined,
      level: 1,
      idCard: row.idCard ?? undefined,
      idTextName: row.idTextName ?? undefined,
      idTextDescription: row.idTextDescription ?? undefined,
      life: row.life,
      energy: row.energy,
      sad: row.sad,
      dexterity: row.dexterity,
      intelligence: row.intelligence,
      constitution: row.constitution,
      weight: row.weight,
      // budgets carried through for the query/match layer
      ...( { traitCostPositiveBudget: row.traitCostPositiveBudget ?? null,
             traitCostNegativeBudget: row.traitCostNegativeBudget ?? null } as any ),
    } as Difficulty;
  }

  /** Next scoped integer id for a story (max+1). */
  private async _nextId(idStory: number): Promise<number> {
    const agg = await this.prisma.difficulty.aggregate({ where: { idStory }, _max: { id: true } });
    return (agg._max.id ?? 0) + 1;
  }

  async findByStoryUuid(storyUuid: string): Promise<Difficulty[]> {
    const story = await this.prisma.listStory.findUnique({ where: { uuid: storyUuid } });
    if (!story) return [];
    const rows = await this.prisma.difficulty.findMany({ where: { idStory: story.id }, orderBy: { id: 'asc' } });
    return Promise.all(rows.map((r) => this._map(r)));
  }

  async findByUuid(uuid: string): Promise<Difficulty | null> {
    const row = await this.prisma.difficulty.findUnique({ where: { uuid } });
    return row ? this._map(row) : null;
  }

  async create(data: Partial<Difficulty> & { idStory?: number }): Promise<Difficulty> {
    const idStory = data.idStory ?? toInt(data.storyId);
    const id = await this._nextId(idStory);
    const row = await this.prisma.difficulty.create({
      data: {
        id,
        idStory,
        uuid: data.uuid || undefined,
        idTextName: (data as any).idTextName ?? null,
        idTextDescription: (data as any).idTextDescription ?? null,
        idCard: (data as any).idCard ?? null,
        life: data.life ?? 0,
        energy: data.energy ?? 0,
        sad: data.sad ?? 0,
        dexterity: data.dexterity ?? 0,
        intelligence: data.intelligence ?? 0,
        constitution: data.constitution ?? 0,
        weight: data.weight ?? 0,
        traitCostPositiveBudget: (data as any).traitCostPositiveBudget ?? null,
        traitCostNegativeBudget: (data as any).traitCostNegativeBudget ?? null,
      },
    });
    return this._map(row);
  }

  async update(uuid: string, data: Partial<Difficulty>): Promise<Difficulty> {
    const row = await this.prisma.difficulty.update({
      where: { uuid },
      data: {
        idTextName: (data as any).idTextName,
        idTextDescription: (data as any).idTextDescription,
        idCard: (data as any).idCard,
        life: data.life,
        energy: data.energy,
        sad: data.sad,
        dexterity: data.dexterity,
        intelligence: data.intelligence,
        constitution: data.constitution,
        weight: data.weight,
        traitCostPositiveBudget: (data as any).traitCostPositiveBudget,
        traitCostNegativeBudget: (data as any).traitCostNegativeBudget,
      },
    });
    return this._map(row);
  }

  async delete(uuid: string): Promise<void> {
    await this.prisma.difficulty.delete({ where: { uuid } });
  }
}
