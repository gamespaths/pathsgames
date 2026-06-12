import type { MatchRepository } from '../ports/MatchRepository';
import type { GuestRepository } from '../ports/GuestRepository';
import type { StoryRepository } from '../ports/StoryRepository';
import type { MatchSummaryResponse } from '../models/Match';
import type { PrismaClient } from '@prisma/client';
import { toDate } from '../../adapters/persistence/prisma/textResolver';

export class MatchQueryService {
  constructor(
    private matchRepo: MatchRepository,
    private guestRepo?: GuestRepository,
    private storyRepo?: StoryRepository,
    private prisma?: PrismaClient,
  ) {}

  private async _userUuid(idUser: number): Promise<string | null> {
    if (!this.prisma) return null;
    const u = await this.prisma.user.findUnique({ where: { id: idUser }, select: { uuid: true } });
    return u?.uuid ?? null;
  }

  async listUserMatches(guestUuid: string): Promise<MatchSummaryResponse[]> {
    let guestId = guestUuid;
    if (this.guestRepo) {
      const g = await this.guestRepo.findByUuid(guestUuid);
      if (g) guestId = g.id;
    }
    return this._summaries(await this.matchRepo.listByGuestId(guestId));
  }

  async listAllMatches(): Promise<MatchSummaryResponse[]> {
    return this._summaries(await this.matchRepo.listAll());
  }

  private async _summaries(matches: any[]): Promise<MatchSummaryResponse[]> {
    const result: MatchSummaryResponse[] = [];
    for (const m of matches) {
      const storyUuid = this.storyRepo ? (await this.storyRepo.findById(m.storyId))?.uuid || m.storyId : m.storyId;
      result.push({
        uuid: m.uuid, storyUuid, difficultyUuid: m.difficultyUuid, status: m.status,
        creatorUuid: m.guestId, createdAt: m.createdAt.toISOString(), updatedAt: m.updatedAt.toISOString(),
      });
    }
    return result;
  }

  async getMatchInfo(matchUuid: string, requestingGuestUuid?: string) {
    if (!this.prisma) return null;
    const match: any = await this.prisma.gamingMatch.findUnique({ where: { uuid: matchUuid } });
    if (!match) return null;

    let creatorUuid = await this._userUuid(match.idUserCreator);
    if (requestingGuestUuid !== undefined) {
      if (creatorUuid !== requestingGuestUuid) return null;
    }

    let storyUuid: string = String(match.idStory);
    if (this.storyRepo) {
      const story = await this.storyRepo.findById(String(match.idStory));
      if (story) storyUuid = story.uuid;
    }

    const players = await this.getMatchPlayers(matchUuid);

    return {
      match: {
        uuid: match.uuid, storyUuid, status: match.status,
        difficultyUuid: match.difficultyUuid || null,
        name: match.name || null,
        singlePlayer: match.singlePlayer ?? 1,
        characterTemplateUuid: match.characterTemplateUuid || null,
        classUuid: match.classUuid || null,
        traitUuids: match.traitUuids || [],
        creatorUuid,
        createdAt: toDate(match.tsInsert).toISOString(),
        updatedAt: toDate(match.tsUpdate).toISOString(),
      },
      players: players || [],
      currentClock: match.currentClock ?? 0, registry: {}, locations: [], events: [], choices: [],
    };
  }

  /** Get all character instances for a match (players list). */
  async getMatchPlayers(matchUuid: string, requestingGuestUuid?: string) {
    if (!this.prisma) return null;
    const match = await this.prisma.gamingMatch.findUnique({ where: { uuid: matchUuid } });
    if (!match) return null;

    if (requestingGuestUuid !== undefined && this.guestRepo) {
      const guest = await this.guestRepo.findByUuid(requestingGuestUuid);
      if (!guest) return null;
    }

    const instances = await this.prisma.gamingCharacterInstance.findMany({ where: { idMatch: match.id } });
    return Promise.all(
      instances.map(async (inst: any) => ({
        uuid: inst.uuid,
        userUuid: await this._userUuid(inst.idUser),
        characterTemplateUuid: inst.characterTemplateUuid || null,
        classUuid: inst.classUuid || null,
        life: inst.life,
        energy: inst.energy,
        dexterity: inst.dexterity,
        intelligence: inst.intelligence,
        constitution: inst.constitution,
        sad: inst.sad,
        isSleeping: inst.isSleeping,
        isComa: inst.isComa,
        idLocation: inst.idLocation || null,
        locationName: inst.locationName || null,
      })),
    );
  }

  /** Get a single character instance detail. */
  async getCharacterDetail(matchUuid: string, characterUuid: string, _requestingGuestUuid?: string) {
    if (!this.prisma) return null;
    const match = await this.prisma.gamingMatch.findUnique({ where: { uuid: matchUuid } });
    if (!match) return null;

    const instance: any = await this.prisma.gamingCharacterInstance.findUnique({ where: { uuid: characterUuid } });
    if (!instance || instance.idMatch !== match.id) return null;

    return {
      uuid: instance.uuid,
      matchUuid: match.uuid,
      userUuid: await this._userUuid(instance.idUser),
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
}
