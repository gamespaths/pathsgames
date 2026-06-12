import type { MatchRepository } from '../ports/MatchRepository';
import type { GuestRepository } from '../ports/GuestRepository';
import type { StoryRepository } from '../ports/StoryRepository';
import type { DifficultyRepository } from '../ports/DifficultyRepository';
import type { PrismaClient } from '@prisma/client';
import { v4 as uuidv4 } from 'uuid';
import { toInt } from '../../adapters/persistence/prisma/textResolver';

export class MatchCommandService {
  constructor(
    private matchRepo: MatchRepository,
    private guestRepo: GuestRepository,
    private storyRepo: StoryRepository,
    private difficultyRepo: DifficultyRepository,
    private prisma: PrismaClient,
  ) {}

  async createMatch(
    guestUuid: string,
    storyUuid: string,
    difficultyUuid?: string,
    name?: string,
    characterTemplateUuid?: string,
    classUuid?: string,
    traitUuids?: string[],
    singlePlayer?: number | boolean,
  ) {
    const guest = await this.guestRepo.findByUuid(guestUuid);
    if (!guest) throw Object.assign(new Error('USER_NOT_FOUND'), { statusCode: 404 });

    const story = await this.storyRepo.findByUuid(storyUuid);
    if (!story) throw Object.assign(new Error('STORY_NOT_FOUND'), { statusCode: 404 });
    const idStory = story.idStory ?? toInt(story.id);

    let difficulty: any = null;
    if (difficultyUuid) {
      difficulty = await this.difficultyRepo.findByUuid(difficultyUuid);
      if (!difficulty) throw Object.assign(new Error('DIFFICULTY_NOT_FOUND'), { statusCode: 404 });
    }

    if (traitUuids && traitUuids.length > 0) {
      await this._validateTraits(idStory, classUuid, traitUuids, difficultyUuid);
    }

    const match = await this.matchRepo.create(guest.id, story.id, difficultyUuid, name);

    const sp = singlePlayer === undefined ? 1 : Number(singlePlayer) ? 1 : 0;
    await this.prisma.gamingMatch.update({
      where: { uuid: match.uuid },
      data: {
        characterTemplateUuid: characterTemplateUuid || null,
        classUuid: classUuid || null,
        traitUuids: traitUuids || [],
        singlePlayer: sp,
      },
    });

    return {
      uuid: match.uuid,
      storyUuid: story.uuid,
      difficultyUuid: match.difficultyUuid || null,
      status: 'CREATED',
      singlePlayer: sp,
      currentClock: 0,
      expCost: difficulty?.expCost ?? 0,
      creatorUuid: guest.uuid,
      userCreatorUuid: guest.uuid,
      tsInsert: match.createdAt.toISOString(),
      characterTemplateUuid: characterTemplateUuid || null,
      classUuid: classUuid || null,
      traitUuids: traitUuids || [],
      createdAt: match.createdAt.toISOString(),
      updatedAt: match.updatedAt.toISOString(),
    };
  }

  /** Join a match: create a gaming_character_instance with computed stats. */
  async joinMatch(
    matchUuid: string,
    guestUuid: string,
    characterTemplateUuid?: string,
    classUuid?: string,
    traitUuids?: string[],
  ) {
    const match = await this.prisma.gamingMatch.findUnique({ where: { uuid: matchUuid } });
    if (!match) throw Object.assign(new Error('MATCH_NOT_FOUND'), { statusCode: 404 });

    const guest = await this.guestRepo.findByUuid(guestUuid);
    if (!guest) throw Object.assign(new Error('USER_NOT_FOUND'), { statusCode: 404 });
    const idUser = toInt(guest.id);

    const existing = await this.prisma.gamingCharacterInstance.findFirst({ where: { idMatch: match.id, idUser } });
    if (existing) throw Object.assign(new Error('ALREADY_JOINED'), { statusCode: 409 });

    if (match.status === 'ENDED' || match.status === 'GAMEOVER') {
      throw Object.assign(new Error('MATCH_NOT_JOINABLE'), { statusCode: 409 });
    }

    const resolvedTemplateUuid = characterTemplateUuid || match.characterTemplateUuid || undefined;
    const resolvedClassUuid = classUuid || match.classUuid || undefined;
    const resolvedTraitUuids = traitUuids !== undefined ? traitUuids : match.traitUuids || [];

    const story = await this.prisma.listStory.findUnique({ where: { id: match.idStory } });
    if (!story) throw Object.assign(new Error('STORY_NOT_FOUND'), { statusCode: 404 });

    let template: any = null;
    if (resolvedTemplateUuid) {
      template = await this.prisma.characterTemplate.findUnique({ where: { uuid: resolvedTemplateUuid } });
      if (!template || template.idStory !== story.id) {
        throw Object.assign(new Error('TEMPLATE_NOT_FOUND'), { statusCode: 404 });
      }
    }

    let cls: any = null;
    let classLifeBonus = 0;
    let classEnergyBonus = 0;
    if (resolvedClassUuid) {
      cls = await this.prisma.storyClass.findUnique({ where: { uuid: resolvedClassUuid } });
      if (!cls || cls.idStory !== story.id) {
        throw Object.assign(new Error('CLASS_NOT_FOUND'), { statusCode: 404 });
      }
      const bonuses = await this.prisma.classBonus.findMany({ where: { idStory: story.id, idClass: cls.id } });
      for (const b of bonuses) {
        if (b.statistic === 'life') classLifeBonus += b.value;
        if (b.statistic === 'energy') classEnergyBonus += b.value;
      }
    }

    const resolvedTraits: any[] = [];
    if (resolvedTraitUuids.length > 0) {
      await this._validateTraits(story.id, resolvedClassUuid, resolvedTraitUuids, match.difficultyUuid || undefined);
      for (const tu of resolvedTraitUuids) {
        const trait = await this.prisma.trait.findUnique({ where: { uuid: tu } });
        if (trait) resolvedTraits.push(trait);
      }
    }

    let difficulty: any = null;
    if (match.difficultyUuid) {
      difficulty = await this.prisma.difficulty.findUnique({ where: { uuid: match.difficultyUuid } });
    }

    const clsForStats = cls ? { ...cls, lifeBonus: classLifeBonus, energyBonus: classEnergyBonus } : null;
    const stats = this._computeStats(template, clsForStats, difficulty, resolvedTraits);

    const agg = await this.prisma.gamingCharacterInstance.aggregate({ where: { idMatch: match.id }, _max: { id: true } });
    const id = (agg._max.id ?? 0) + 1;

    const instance = await this.prisma.gamingCharacterInstance.create({
      data: {
        id,
        idMatch: match.id,
        uuid: uuidv4(),
        idUser,
        idCharacterTemplate: template?.idTipo ?? 0,
        characterTemplateUuid: resolvedTemplateUuid || null,
        classUuid: resolvedClassUuid || null,
        traitUuids: resolvedTraitUuids,
        life: stats.life,
        energy: stats.energy,
        dexterity: stats.dexterity,
        intelligence: stats.intelligence,
        constitution: stats.constitution,
        sad: 0,
        food: 0,
        magic: 0,
        coin: 0,
        isSleeping: false,
        isComa: false,
      },
    });

    return this._formatInstance(instance, match.uuid, guest.uuid);
  }

  private _computeStats(template: any, cls: any, difficulty: any, traits: any[]) {
    const lifeBase = template?.lifeMax ?? 10;
    const energyBase = template?.energyMax ?? 10;
    const dexBase = template?.dexterityStart ?? 0;
    const intBase = template?.intelligenceStart ?? 0;
    const conBase = template?.constitutionStart ?? 0;

    const lifeBonus = (cls?.lifeBonus ?? 0) + (difficulty?.life ?? 0);
    const energyBonus = cls?.energyBonus ?? 0;
    const dexBonus = cls?.dexterityBase ?? 0;
    const intBonus = cls?.intelligenceBase ?? 0;
    const conBonus = cls?.constitutionBase ?? 0;

    const sum = (k: string) => traits.reduce((s, t) => s + (t[k] ?? 0), 0);
    return {
      life: lifeBase + lifeBonus + sum('life'),
      energy: energyBase + energyBonus + sum('energy'),
      dexterity: dexBase + dexBonus + sum('dexterity'),
      intelligence: intBase + intBonus + sum('intelligence'),
      constitution: conBase + conBonus + sum('constitution'),
    };
  }

  /** Validate traits: existence, no duplicates, class compatibility, cost budgets. */
  private async _validateTraits(idStory: number, classUuid: string | undefined, traitUuids: string[], difficultyUuid?: string) {
    const seen = new Set<string>();
    for (const tu of traitUuids) {
      if (seen.has(tu)) throw Object.assign(new Error('TRAIT_DUPLICATED'), { statusCode: 400 });
      seen.add(tu);
    }

    let classId: number | null = null;
    if (classUuid) {
      const cls = await this.prisma.storyClass.findUnique({ where: { uuid: classUuid } });
      classId = cls?.id ?? null;
    }

    let totalPositive = 0;
    let totalNegative = 0;
    for (const tu of traitUuids) {
      const trait = await this.prisma.trait.findUnique({ where: { uuid: tu } });
      if (!trait || trait.idStory !== idStory) {
        throw Object.assign(new Error('TRAIT_NOT_FOUND'), { statusCode: 400 });
      }
      if (classUuid) {
        const permittedOk = trait.idClassPermitted == null || trait.idClassPermitted === classId;
        const prohibitedOk = trait.idClassProhibited == null || trait.idClassProhibited !== classId;
        if (!permittedOk || !prohibitedOk) {
          throw Object.assign(new Error('TRAIT_NOT_COMPATIBLE'), { statusCode: 400 });
        }
      }
      totalPositive += trait.costPositive;
      totalNegative += trait.costNegative;
    }

    if (difficultyUuid) {
      const difficulty = await this.prisma.difficulty.findUnique({ where: { uuid: difficultyUuid } });
      if (difficulty) {
        if (difficulty.traitCostPositiveBudget != null && totalPositive > difficulty.traitCostPositiveBudget) {
          throw Object.assign(new Error('TRAIT_COST_EXCEEDED'), { statusCode: 400 });
        }
        if (difficulty.traitCostNegativeBudget != null && totalNegative > difficulty.traitCostNegativeBudget) {
          throw Object.assign(new Error('TRAIT_COST_EXCEEDED'), { statusCode: 400 });
        }
      }
    }
  }

  private _formatInstance(instance: any, matchUuid: string, userUuid: string) {
    return {
      uuid: instance.uuid,
      matchUuid,
      userUuid,
      characterTemplateUuid: instance.characterTemplateUuid || null,
      classUuid: instance.classUuid || null,
      traitUuids: instance.traitUuids || [],
      life: instance.life,
      energy: instance.energy,
      dexterity: instance.dexterity,
      intelligence: instance.intelligence,
      constitution: instance.constitution,
      sad: instance.sad,
      food: instance.food,
      magic: instance.magic,
      coin: instance.coin,
      isSleeping: instance.isSleeping,
      isComa: instance.isComa,
      idLocation: instance.idLocation || null,
      locationUuid: instance.locationUuid || null,
      locationName: instance.locationName || null,
    };
  }

  async updateMatch(matchUuid: string, status: string, _name?: string) {
    const match = await this.matchRepo.findByUuid(matchUuid);
    if (!match) throw new Error('MATCH_NOT_FOUND');
    const updated = await this.matchRepo.update(matchUuid, { status: status || match.status });
    return { uuid: updated.uuid, status: updated.status, createdAt: updated.createdAt.toISOString(), updatedAt: updated.updatedAt.toISOString() };
  }

  async endMatch(matchUuid: string, eventUuid: string, requestingGuestUuid?: string) {
    const match = await this.matchRepo.findByUuid(matchUuid);
    if (!match) throw Object.assign(new Error('MATCH_NOT_FOUND'), { statusCode: 404 });

    if (requestingGuestUuid !== undefined) {
      const guest = await this.guestRepo.findById(match.guestId);
      if (!guest || guest.uuid !== requestingGuestUuid) {
        throw Object.assign(new Error('MATCH_NOT_FOUND'), { statusCode: 404 });
      }
    }

    // The event must be the story's designated end-game event; otherwise 406.
    const story = await this.storyRepo.findById(match.storyId);
    let endEventUuid: string | null = null;
    if (story && story.idEventEndGame != null) {
      const endEvent = await this.prisma.event.findFirst({ where: { idStory: toInt(match.storyId), id: story.idEventEndGame } });
      endEventUuid = endEvent?.uuid ?? null;
    }
    if (!eventUuid || eventUuid.length === 0 || eventUuid !== endEventUuid) {
      throw Object.assign(new Error('EVENT_NOT_END_GAME'), { statusCode: 406 });
    }

    const updated = await this.matchRepo.update(matchUuid, { status: 'ENDED', endedAt: new Date() });
    return { uuid: updated.uuid, status: updated.status, endedAt: updated.endedAt?.toISOString() || null };
  }

  async deleteMatch(matchUuid: string): Promise<boolean> {
    const match = await this.matchRepo.findByUuid(matchUuid);
    if (!match) return false;
    if (match.status !== 'ENDED' && match.status !== 'GAMEOVER') {
      throw Object.assign(new Error('MATCH_NOT_STOPPED'), { statusCode: 409 });
    }
    return this.matchRepo.delete(matchUuid);
  }

  async setStatus(matchUuid: string, status: 'ENDED' | 'PAUSED' | 'RUNNING') {
    const match = await this.matchRepo.findByUuid(matchUuid);
    if (!match) throw Object.assign(new Error('MATCH_NOT_FOUND'), { statusCode: 404 });
    const patch: any = { status };
    if (status === 'ENDED') patch.endedAt = new Date();
    await this.matchRepo.update(matchUuid, patch);
    return { status: 'UPDATED', uuid: matchUuid };
  }
}

export const MATCH_STATUSES = [
  { value: 'CREATED', terminal: false },
  { value: 'RUNNING', terminal: false },
  { value: 'PAUSED', terminal: false },
  { value: 'ENDED', terminal: true },
  { value: 'GAMEOVER', terminal: true },
];
