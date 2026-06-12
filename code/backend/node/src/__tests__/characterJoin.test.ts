import { MatchCommandService } from '../core/services/MatchCommandService';

function makePrisma(overrides: any = {}) {
  return {
    gamingMatch: {
      findUnique: async () => null,
      update: async (_args: any) => ({}),
    },
    gamingCharacterInstance: {
      findFirst: async () => null,
      aggregate: async () => ({ _max: { id: 0 } }),
      create: async (args: any) => ({ ...args.data, createdAt: new Date(), updatedAt: new Date() }),
    },
    characterTemplate: { findUnique: async () => null },
    storyClass: { findUnique: async () => null },
    classBonus: { findMany: async () => [] },
    trait: { findUnique: async () => null },
    listStory: { findUnique: async () => null },
    difficulty: { findUnique: async () => null },
    ...overrides,
  };
}

function makeService(prismaOverrides: any = {}, matchRepoOverrides: any = {}) {
  const matchRepo: any = {
    findByUuid: async () => null,
    update: async () => ({}),
    create: async () => ({ uuid: 'match-uuid', createdAt: new Date(), updatedAt: new Date(), difficultyUuid: null }),
    ...matchRepoOverrides,
  };
  const guestRepo: any = {
    findByUuid: async (uuid: string) => ({ id: '1', uuid, username: 'test' }),
    findById: async () => null,
  };
  const storyRepo: any = {
    findByUuid: async (uuid: string) => ({ id: '1', uuid, idStory: 1 }),
    findById: async () => null,
  };
  const difficultyRepo: any = { findByUuid: async () => null };
  const prisma = makePrisma(prismaOverrides);

  return new MatchCommandService(matchRepo, guestRepo, storyRepo, difficultyRepo, prisma as any);
}

describe('MatchCommandService.joinMatch', () => {
  it('throws MATCH_NOT_FOUND for unknown match', async () => {
    const svc = makeService({ gamingMatch: { findUnique: async () => null } });
    await expect(svc.joinMatch('bad-uuid', 'guest-uuid')).rejects.toMatchObject({
      message: 'MATCH_NOT_FOUND', statusCode: 404,
    });
  });

  it('throws ALREADY_JOINED if guest already has instance', async () => {
    const fakeMatch = { id: 1, uuid: 'match-uuid', idStory: 1, status: 'ACTIVE', idUserCreator: 1, difficultyUuid: null, characterTemplateUuid: null, classUuid: null, traitUuids: [] };
    const svc = makeService({
      gamingMatch: { findUnique: async () => fakeMatch, update: async () => ({}) },
      gamingCharacterInstance: { findFirst: async () => ({ id: 1 }), aggregate: async () => ({ _max: { id: 0 } }), create: async (args: any) => args.data },
      listStory: { findUnique: async () => ({ id: 1, uuid: 'story-uuid' }) },
    });
    await expect(svc.joinMatch('match-uuid', 'guest-uuid')).rejects.toMatchObject({
      message: 'ALREADY_JOINED', statusCode: 409,
    });
  });

  it('creates CharacterInstance with computed stats', async () => {
    const fakeMatch = { id: 1, uuid: 'match-uuid', idStory: 1, status: 'ACTIVE', idUserCreator: 1, difficultyUuid: 'diff-1', characterTemplateUuid: null, classUuid: null, traitUuids: [] };
    const fakeTemplate = { idTipo: 1, uuid: 'tpl-1', idStory: 1, lifeMax: 12, energyMax: 12, sadMax: 8, dexterityStart: 3, intelligenceStart: 3, constitutionStart: 3, idClassPermitted: null, idClassProhibited: null };
    const fakeClass = { id: 1, uuid: 'cls-1', idStory: 1, dexterityBase: 3, intelligenceBase: 3, constitutionBase: 3 };
    const fakeDifficulty = { uuid: 'diff-1', life: 10, traitCostPositiveBudget: null, traitCostNegativeBudget: null };

    let created: any = null;
    const svc = makeService({
      gamingMatch: { findUnique: async () => fakeMatch, update: async () => ({}) },
      gamingCharacterInstance: {
        findFirst: async () => null,
        aggregate: async () => ({ _max: { id: 0 } }),
        create: async (args: any) => { created = args.data; return { ...args.data }; },
      },
      characterTemplate: { findUnique: async (args: any) => (args.where.uuid === 'tpl-1' ? fakeTemplate : null) },
      storyClass: { findUnique: async (args: any) => (args.where.uuid === 'cls-1' ? fakeClass : null) },
      // class life/energy bonuses come from list_classes_bonus
      classBonus: { findMany: async () => [{ statistic: 'life', value: 3 }, { statistic: 'energy', value: 3 }] },
      listStory: { findUnique: async () => ({ id: 1, uuid: 'story-uuid' }) },
      difficulty: { findUnique: async () => fakeDifficulty },
    });

    const result = await svc.joinMatch('match-uuid', 'guest-uuid', 'tpl-1', 'cls-1', []);
    expect(created.life).toBe(25);    // 12 + 10 + 3
    expect(created.energy).toBe(15);  // 12 + 3
    expect(created.dexterity).toBe(6); // 3 + 3
    expect(result.life).toBeGreaterThan(0);
    expect(result.energy).toBeGreaterThan(0);
  });

  it('throws TRAIT_NOT_FOUND for unknown trait uuid', async () => {
    const fakeMatch = { id: 1, uuid: 'match-uuid', idStory: 1, status: 'ACTIVE', idUserCreator: 1, difficultyUuid: null, characterTemplateUuid: null, classUuid: null, traitUuids: [] };
    const svc = makeService({
      gamingMatch: { findUnique: async () => fakeMatch, update: async () => ({}) },
      gamingCharacterInstance: { findFirst: async () => null, aggregate: async () => ({ _max: { id: 0 } }), create: async (args: any) => args.data },
      trait: { findUnique: async () => null },
      listStory: { findUnique: async () => ({ id: 1, uuid: 'story-uuid' }) },
    });
    await expect(svc.joinMatch('match-uuid', 'guest-uuid', undefined, undefined, ['no-such-trait'])).rejects.toMatchObject({
      message: 'TRAIT_NOT_FOUND', statusCode: 400,
    });
  });

  it('throws TRAIT_DUPLICATED for same trait twice', async () => {
    const fakeMatch = { id: 1, uuid: 'match-uuid', idStory: 1, status: 'ACTIVE', idUserCreator: 1, difficultyUuid: null, characterTemplateUuid: null, classUuid: null, traitUuids: [] };
    const svc = makeService({
      gamingMatch: { findUnique: async () => fakeMatch, update: async () => ({}) },
      gamingCharacterInstance: { findFirst: async () => null, aggregate: async () => ({ _max: { id: 0 } }), create: async (args: any) => args.data },
      listStory: { findUnique: async () => ({ id: 1, uuid: 'story-uuid' }) },
    });
    await expect(svc.joinMatch('match-uuid', 'guest-uuid', undefined, undefined, ['trait-1', 'trait-1'])).rejects.toMatchObject({
      message: 'TRAIT_DUPLICATED', statusCode: 400,
    });
  });
});
