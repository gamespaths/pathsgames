import type { PrismaClient } from '@prisma/client';
import type { StoryRepository } from '../ports/StoryRepository';
import type { DifficultyRepository } from '../ports/DifficultyRepository';
import type { StorySummaryResponse } from '../models/Story';
import { resolveText, toInt } from '../../adapters/persistence/prisma/textResolver';

export class StoryQueryService {
  constructor(
    private storyRepo: StoryRepository,
    private difficultyRepo: DifficultyRepository,
    private prisma: PrismaClient,
  ) {}

  /** Build the public card object (or null) for a list_cards row, resolving texts. */
  private async _cardResponse(card: any, lang: string): Promise<any | null> {
    if (!card) return null;
    return {
      uuid: card.uuid,
      urlImage: card.urlImmage ?? null,
      alternativeImage: card.alternativeImage ?? null,
      awesomeIcon: card.awesomeIcon ?? null,
      styleMain: card.styleMain ?? null,
      styleDetail: card.styleDetail ?? null,
      title: (await resolveText(this.prisma, card.idStory, card.idTextTitle, lang)) ?? null,
      description: (await resolveText(this.prisma, card.idStory, card.idTextDescription, lang)) ?? null,
      linkCopyright: card.linkCopyright ?? null,
    };
  }

  /** Resolve the story-level primary card (idCard FK, else first card with an image). */
  private async _primaryCard(idStory: number, idCard: number | null | undefined, lang: string): Promise<any | null> {
    let card: any = null;
    if (idCard != null) {
      // story.id_card references list_cards(id) (the card PK), not the id_card column.
      card = await this.prisma.card.findFirst({ where: { idStory, id: idCard } });
    }
    if (!card) {
      card =
        (await this.prisma.card.findFirst({ where: { idStory, NOT: { urlImmage: null } }, orderBy: { id: 'asc' } })) ??
        (await this.prisma.card.findFirst({ where: { idStory }, orderBy: { id: 'asc' } }));
    }
    return this._cardResponse(card, lang);
  }

  /** Resolve a nested entity's card by its idCard FK (nullable). */
  private async _cardByIdCard(idStory: number, idCard: number | null | undefined, lang: string): Promise<any | null> {
    if (idCard == null) return null;
    // id_card FK references list_cards(id) (the card PK).
    const card = await this.prisma.card.findFirst({ where: { idStory, id: idCard } });
    return this._cardResponse(card, lang);
  }

  private async _summaries(stories: any[], lang: string): Promise<StorySummaryResponse[]> {
    return Promise.all(
      stories.map(async (s) => ({
        uuid: s.uuid,
        title: s.title,
        description: s.description || null,
        author: s.author || null,
        category: s.category || null,
        group: s.group || null,
        visibility: s.visibility,
        priority: s.priority || 0,
        peghi: s.peghi || 0,
        difficultyCount: 0,
        card: await this._primaryCard(s.idStory ?? toInt(s.id), s.idCard, lang),
      })),
    );
  }

  async listPublicStories(lang = 'en'): Promise<StorySummaryResponse[]> {
    return this._summaries(await this.storyRepo.listPublic(), lang);
  }

  async getStoryByUuid(uuid: string, lang = 'en') {
    const story = await this.storyRepo.findByUuid(uuid);
    if (!story) return null;
    const idStory = story.idStory ?? toInt(story.id);

    const [difficulties, classes, traits, templates, classBonuses, card] = await Promise.all([
      this.difficultyRepo.findByStoryUuid(uuid),
      this.prisma.storyClass.findMany({ where: { idStory }, orderBy: { id: 'asc' } }),
      this.prisma.trait.findMany({ where: { idStory }, orderBy: { id: 'asc' } }),
      this.prisma.characterTemplate.findMany({ where: { idStory }, orderBy: { idTipo: 'asc' } }),
      this.prisma.classBonus.findMany({ where: { idStory }, orderBy: { id: 'asc' } }),
      this._primaryCard(idStory, story.idCard, lang),
    ]);

    // Group class bonuses by their integer class id (list_classes_bonus.id_class)
    const bonusesByClass = new Map<number, any[]>();
    for (const b of classBonuses) {
      const list = bonusesByClass.get(b.idClass) ?? [];
      list.push({ uuid: b.uuid, statistic: b.statistic, value: b.value });
      bonusesByClass.set(b.idClass, list);
    }

    const classesOut = await Promise.all(
      classes.map(async (c) => ({
        id: c.id,
        idClass: c.id,
        uuid: c.uuid,
        title: (await resolveText(this.prisma, idStory, c.idTextName, lang)) || `Class ${c.id}`,
        name: (await resolveText(this.prisma, idStory, c.idTextName, lang)) || `Class ${c.id}`,
        description: (await resolveText(this.prisma, idStory, c.idTextDescription, lang)) ?? null,
        idCard: c.idCard ?? null,
        card: await this._cardByIdCard(idStory, c.idCard, lang),
        weightMax: c.weightMax,
        dexterityBase: c.dexterityBase,
        intelligenceBase: c.intelligenceBase,
        constitutionBase: c.constitutionBase,
        bonuses: bonusesByClass.get(c.id) ?? [],
      })),
    );

    const traitsOut = await Promise.all(traits.map((t) => this._traitOut(idStory, t, lang)));

    const templatesOut = await Promise.all(
      templates.map(async (tpl) => ({
        uuid: tpl.uuid,
        title: (await resolveText(this.prisma, idStory, tpl.idTextName, lang)) || `Template ${tpl.idTipo}`,
        name: (await resolveText(this.prisma, idStory, tpl.idTextName, lang)) || `Template ${tpl.idTipo}`,
        description: (await resolveText(this.prisma, idStory, tpl.idTextDescription, lang)) ?? null,
        idCard: tpl.idCard ?? null,
        card: await this._cardByIdCard(idStory, tpl.idCard, lang),
        lifeMax: tpl.lifeMax,
        energyMax: tpl.energyMax,
        sadMax: tpl.sadMax,
        dexterityStart: tpl.dexterityStart,
        intelligenceStart: tpl.intelligenceStart,
        constitutionStart: tpl.constitutionStart,
        idClassPermitted: tpl.idClassPermitted ?? null,
        idClassProhibited: tpl.idClassProhibited ?? null,
      })),
    );

    const difficultiesOut = await Promise.all(
      difficulties.map(async (d: any) => ({
        uuid: d.uuid,
        title: d.title,
        name: d.title,
        description: d.description || null,
        level: d.level ?? 1,
        idCard: d.idCard ?? null,
        card: await this._cardByIdCard(idStory, d.idCard, lang),
        life: d.life,
        energy: d.energy,
        sad: d.sad,
        dexterity: d.dexterity,
        intelligence: d.intelligence,
        constitution: d.constitution,
        weight: d.weight,
        traitCostPositiveBudget: d.traitCostPositiveBudget ?? null,
        traitCostNegativeBudget: d.traitCostNegativeBudget ?? null,
      })),
    );

    return {
      uuid: story.uuid,
      title: story.title,
      description: story.description || null,
      author: story.author || null,
      category: story.category || null,
      group: story.group || null,
      visibility: story.visibility,
      priority: story.priority || 0,
      peghi: story.peghi || 0,
      difficultyCount: difficulties.length,
      card,
      difficulties: difficultiesOut,
      locationCount: 0,
      eventCount: 0,
      itemCount: 0,
      classCount: classes.length,
      characterTemplateCount: templates.length,
      traitCount: traits.length,
      classes: classesOut,
      traits: traitsOut,
      characterTemplates: templatesOut,
    };
  }

  private async _traitOut(idStory: number, t: any, lang: string) {
    const name = (await resolveText(this.prisma, idStory, t.idTextName, lang)) || `Trait ${t.id}`;
    return {
      uuid: t.uuid,
      title: name,
      name,
      description: (await resolveText(this.prisma, idStory, t.idTextDescription, lang)) ?? null,
      idCard: t.idCard ?? null,
      card: await this._cardByIdCard(idStory, t.idCard, lang),
      costPositive: t.costPositive,
      costNegative: t.costNegative,
      life: t.life,
      energy: t.energy,
      sad: t.sad,
      dexterity: t.dexterity,
      intelligence: t.intelligence,
      constitution: t.constitution,
      weight: t.weight,
      idClassPermitted: t.idClassPermitted ?? null,
      idClassProhibited: t.idClassProhibited ?? null,
    };
  }

  async listCategories(): Promise<string[]> {
    return this.storyRepo.listCategories();
  }

  async listStoriesByCategory(category: string, lang = 'en'): Promise<StorySummaryResponse[]> {
    return this._summaries(await this.storyRepo.listByCategory(category), lang);
  }

  async listGroups(): Promise<string[]> {
    return this.storyRepo.listGroups();
  }

  async listStoriesByGroup(group: string, lang = 'en'): Promise<StorySummaryResponse[]> {
    return this._summaries(await this.storyRepo.listByGroup(group), lang);
  }

  /**
   * Get traits for a specific class within a story. Class compatibility uses the
   * scoped integer class id (list_traits.id_class_permitted / prohibited).
   */
  async getTraitsForClass(storyUuid: string, classUuid: string) {
    const story = await this.storyRepo.findByUuid(storyUuid);
    if (!story) return { error: 'STORY_NOT_FOUND' };
    const idStory = story.idStory ?? toInt(story.id);

    const cls = await this.prisma.storyClass.findUnique({ where: { uuid: classUuid } });
    if (!cls || cls.idStory !== idStory) return { error: 'CLASS_NOT_FOUND' };

    const classId = cls.id;
    const allTraits = await this.prisma.trait.findMany({ where: { idStory }, orderBy: { id: 'asc' } });
    const compatible = allTraits.filter((t) => {
      const permittedOk = t.idClassPermitted == null || t.idClassPermitted === classId;
      const prohibitedOk = t.idClassProhibited == null || t.idClassProhibited !== classId;
      return permittedOk && prohibitedOk;
    });

    return { traits: await Promise.all(compatible.map((t) => this._traitOut(idStory, t, 'en'))) };
  }
}
