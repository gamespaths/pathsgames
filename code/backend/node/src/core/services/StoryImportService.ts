import type { PrismaClient } from '@prisma/client';
import { v4 as uuidv4, v5 as uuidv5 } from 'uuid';

// Fixed namespace for deriving stable uuids for sub-entities that have no uuid
// in the import JSON (so re-imports keep the same uuid).
const IMPORT_UUID_NAMESPACE = '6f5a3c1e-2b4d-4f8a-9c0e-1a2b3c4d5e6f';

export interface StoryValidationError {
  rule: string;
  entityType: string;
  entityId: string;
  field: string;
  message: string;
}

export interface ImportResult {
  status: string;
  storyUuid: string;
  storyId: number;
  textsImported: number;
  locationsImported: number;
  eventsImported: number;
  itemsImported: number;
  difficultiesImported: number;
  classesImported: number;
  choicesImported: number;
}

export class StoryImportService {
  constructor(private prisma: PrismaClient) {}

  /**
   * Validate the payload before persisting. Pure (no DB). Operates on the
   * scoped integer ids of the list_* import format.
   */
  validate(payload: any): StoryValidationError[] {
    const errors: StoryValidationError[] = [];
    const events: any[] = payload.events || [];
    const choices: any[] = payload.choices || [];
    const locations: any[] = payload.locations || [];
    const locationNeighbors: any[] = payload.locationNeighbors || [];
    const characterTemplates: any[] = payload.characterTemplates || [];

    const eventIds = new Set(events.map((e: any) => e.id));
    const locationIds = new Set(locations.map((l: any) => l.id));

    // R_EVENT_REF: choice.idEvent must reference an existing event
    for (const choice of choices) {
      if (choice.idEvent != null && !eventIds.has(choice.idEvent)) {
        errors.push({ rule: 'R_EVENT_REF', entityType: 'choices', entityId: String(choice.id ?? '?'), field: 'idEvent', message: `Choice references non-existent event id=${choice.idEvent}` });
      }
    }

    // R_LOCATION_REF: neighbor.idLocationFrom/To must reference an existing location
    for (const nb of locationNeighbors) {
      for (const f of ['idLocationTo', 'idLocationFrom'] as const) {
        if (nb[f] != null && !locationIds.has(nb[f])) {
          errors.push({ rule: 'R_LOCATION_REF', entityType: 'locationNeighbors', entityId: String(nb.id ?? '?'), field: f, message: `Neighbor references non-existent location id=${nb[f]}` });
        }
      }
    }

    // R3_EVENT_CYCLE: detect cycles in event.idEventNext chain
    if (events.length > 0) {
      const nextMap = new Map<number, number>();
      for (const ev of events) if (ev.idEventNext != null) nextMap.set(ev.id, ev.idEventNext);
      for (const startId of nextMap.keys()) {
        const visited = new Set<number>();
        let cur: number | undefined = startId;
        while (cur !== undefined) {
          if (visited.has(cur)) {
            errors.push({ rule: 'R3_EVENT_CYCLE', entityType: 'events', entityId: String(startId), field: 'idEventNext', message: `Event chain starting at id=${startId} contains a cycle` });
            break;
          }
          visited.add(cur);
          cur = nextMap.get(cur);
        }
      }
    }

    // R4_CHOICE_EMPTY: event-attached choice with no effects and otherwiseFlag=0
    const topLevelChoiceEffects: any[] = payload.choiceEffects || [];
    for (const choice of choices) {
      if (choice.idEvent == null) continue;
      const hasInlineEffects = Array.isArray(choice.choiceEffects) && choice.choiceEffects.length > 0;
      const hasTopLevelEffects = topLevelChoiceEffects.some((e: any) => e.idChoice === choice.id);
      const hasOtherwise = Number(choice.otherwiseFlag) !== 0;
      if (!hasInlineEffects && !hasTopLevelEffects && !hasOtherwise) {
        errors.push({ rule: 'R4_CHOICE_EMPTY', entityType: 'choices', entityId: String(choice.id ?? '?'), field: 'otherwiseFlag', message: `Choice id=${choice.id} has no effects and otherwiseFlag=0` });
      }
    }

    // R6_CLASS_CONFLICT: template with same class permitted and prohibited
    for (const tpl of characterTemplates) {
      if (tpl.idClassPermitted != null && tpl.idClassProhibited != null && tpl.idClassPermitted === tpl.idClassProhibited) {
        errors.push({ rule: 'R6_CLASS_CONFLICT', entityType: 'characterTemplates', entityId: String(tpl.id ?? '?'), field: 'idClassPermitted', message: `Template id=${tpl.id} has same class for permitted and prohibited` });
      }
    }

    return errors;
  }

  async importStory(payload: any): Promise<ImportResult> {
    const uuid = payload.uuid;
    const texts: any[] = payload.texts || [];

    const storyData: any = {
      uuid,
      author: payload.author || null,
      category: payload.category || null,
      group: payload.group || null,
      visibility: payload.visibility || 'PUBLIC',
      priority: this._int(payload.priority, 0),
      peghi: this._int(payload.peghi, 0),
      versionMin: payload.versionMin || null,
      versionMax: payload.versionMax || null,
      idTextTitle: this._int(payload.idTextTitle, null),
      idTextDescription: this._int(payload.idTextDescription, null),
      idCard: this._int(payload.idCard, null),
      idImage: this._int(payload.idImage, null),
      idLocationStart: this._int(payload.idLocationStart, null),
      idCreator: this._int(payload.idCreator, null),
      idLocationAllPlayerComa: this._int(payload.idLocationAllPlayerComa, null),
      idEventAllPlayerComa: this._int(payload.idEventAllPlayerComa, null),
      idEventEndGame: this._int(payload.idEventEndGame, null),
      idTextCopyright: this._int(payload.idTextCopyright, null),
      idTextClockSingular: this._int(payload.idTextClockSingular, null),
      idTextClockPlural: this._int(payload.idTextClockPlural, null),
    };
    const explicitId = this._int(payload.id, null);
    if (explicitId != null) storyData.id = explicitId;

    // INVALID_IMPORT_DATA: explicit story id already used by a different story
    if (explicitId != null) {
      const clash = await this.prisma.listStory.findUnique({ where: { id: explicitId } });
      if (clash && clash.uuid !== uuid) {
        throw Object.assign(new Error(`story/list_stories id=${explicitId} already present`), { code: 'INVALID_IMPORT_DATA', statusCode: 400 });
      }
    }

    // Re-import of the same story (same uuid): wipe completely then recreate.
    const existing = await this.prisma.listStory.findUnique({ where: { uuid } });
    if (existing) await this._deleteStoryCompletely(existing.id);

    const story = await this.prisma.listStory.create({ data: storyData });
    const storyId = story.id;

    // ── Texts ──
    // The text row PK (id) is irrelevant to references (entities point to id_text,
    // not to the row id). Export files reuse the same `id` across lang variants,
    // so we assign a fresh sequential PK and dedupe on the (id_story, id_text, lang)
    // unique key via upsert.
    let textSeq = 0;
    for (const t of texts) {
      const idText = this._int(t.idText, 0);
      const lang = t.lang || 'en';
      const data = {
        shortText: t.shortText ?? null, longText: t.longText ?? null,
        idTextCopyright: this._int(t.idTextCopyright, null), idCreator: this._int(t.idCreator, null),
      };
      await this.prisma.storyText.upsert({
        where: { idStory_idText_lang: { idStory: storyId, idText, lang } },
        update: data,
        create: { id: ++textSeq, idStory: storyId, idText, lang, ...data },
      });
    }

    // ── Creators ── (before cards: cards reference creator)
    const creators: any[] = payload.creators || [];
    const crId = this._idAssigner(creators);
    for (const cr of creators) {
      await this.prisma.creator.create({
        data: {
          id: crId(cr), idStory: storyId, uuid: cr.uuid || uuidv4(),
          idText: this._int(cr.idText, null), link: cr.link ?? null, url: cr.url ?? null,
          urlImage: cr.urlImage ?? null, urlEmote: cr.urlEmote ?? null, urlInstagram: cr.urlInstagram ?? null,
          idCard: this._int(cr.idCard, null),
        },
      });
    }

    // ── Cards ── (id preserved; uuid derived stably when absent)
    const cards: any[] = payload.cards || [];
    const cardId = this._idAssigner(cards);
    for (const card of cards) {
      const id = cardId(card);
      await this.prisma.card.create({
        data: {
          id, idStory: storyId,
          uuid: card.uuid || uuidv5(`${uuid}:card:${id}`, IMPORT_UUID_NAMESPACE),
          urlImmage: card.urlImage ?? card.urlImmage ?? null,
          idTextTitle: this._int(card.idTextTitle, null), idTextDescription: this._int(card.idTextDescription, null),
          idTextCopyright: this._int(card.idTextCopyright, null), linkCopyright: card.linkCopyright ?? null,
          idCreator: this._int(card.idCreator, null),
          alternativeImage: card.alternativeImage ?? null, awesomeIcon: card.awesomeIcon ?? null,
          styleMain: card.styleMain ?? null, styleDetail: card.styleDetail ?? null,
          styleImageLittle: card.styleImageLittle ?? null, styleImageMedium: card.styleImageMedium ?? null,
          styleImageLarge: card.styleImageLarge ?? null, cardType: card.cardType ?? null,
          idCard: this._int(card.idCard, null), idTextName: this._int(card.idTextName, null),
        },
      });
    }

    // ── Difficulties ──
    const difficulties: any[] = payload.difficulties || [];
    const diffId = this._idAssigner(difficulties);
    for (const d of difficulties) {
      await this.prisma.difficulty.create({
        data: {
          id: diffId(d), idStory: storyId, uuid: d.uuid || uuidv4(),
          idTextName: this._int(d.idTextName, null), idTextDescription: this._int(d.idTextDescription, null), idCard: this._int(d.idCard, null),
          expCost: this._int(d.expCost, 5), maxWeight: this._int(d.maxWeight, 10), minCharacter: this._int(d.minCharacter, 1),
          maxCharacter: this._int(d.maxCharacter, 4), costHelpComa: this._int(d.costHelpComa, 3),
          costMaxCharacteristics: this._int(d.costMaxCharacteristics, 2), numberMaxFreeAction: this._int(d.numberMaxFreeAction, 0),
          life: this._int(d.life, 0), energy: this._int(d.energy, 0), sad: this._int(d.sad, 0), dexterity: this._int(d.dexterity, 0),
          intelligence: this._int(d.intelligence, 0), constitution: this._int(d.constitution, 0), weight: this._int(d.weight, 0),
          traitCostPositiveBudget: this._int(d.traitCostPositiveBudget, null), traitCostNegativeBudget: this._int(d.traitCostNegativeBudget, null),
        },
      });
    }

    // ── Classes ──
    const classes: any[] = payload.classes || [];
    const clsId = this._idAssigner(classes);
    for (const c of classes) {
      await this.prisma.storyClass.create({
        data: {
          id: clsId(c), idStory: storyId, uuid: c.uuid || uuidv4(), idCard: this._int(c.idCard, null),
          idTextName: this._int(c.idTextName, null), idTextDescription: this._int(c.idTextDescription, null),
          weightMax: this._int(c.weightMax, 10), dexterityBase: this._int(c.dexterityBase, 1),
          intelligenceBase: this._int(c.intelligenceBase, 1), constitutionBase: this._int(c.constitutionBase, 1),
        },
      });
    }

    // ── Class bonuses ──
    const classBonuses: any[] = payload.classBonuses || [];
    const cbId = this._idAssigner(classBonuses);
    for (const b of classBonuses) {
      await this.prisma.classBonus.create({
        data: {
          id: cbId(b), idStory: storyId, uuid: b.uuid || uuidv4(), idClass: this._int(b.idClass, 0),
          statistic: b.statistic, value: this._int(b.value, 0),
          idTextName: this._int(b.idTextName, null), idTextDescription: this._int(b.idTextDescription, null), idCard: this._int(b.idCard, null),
        },
      });
    }

    // ── Traits ──
    const traits: any[] = payload.traits || [];
    const trId = this._idAssigner(traits);
    for (const t of traits) {
      await this.prisma.trait.create({
        data: {
          id: trId(t), idStory: storyId, uuid: t.uuid || uuidv4(), idCard: this._int(t.idCard, null),
          idClassPermitted: this._int(t.idClassPermitted, null), idClassProhibited: this._int(t.idClassProhibited, null),
          idTextName: this._int(t.idTextName, null), idTextDescription: this._int(t.idTextDescription, null),
          costPositive: this._int(t.costPositive, 0), costNegative: this._int(t.costNegative, 0),
          life: this._int(t.life, 0), energy: this._int(t.energy, 0), sad: this._int(t.sad, 0), dexterity: this._int(t.dexterity, 0),
          intelligence: this._int(t.intelligence, 0), constitution: this._int(t.constitution, 0), weight: this._int(t.weight, 0),
        },
      });
    }

    // ── Character templates (PK id_tipo) ──
    const templates: any[] = payload.characterTemplates || [];
    const tplId = this._idAssigner(templates);
    for (const tpl of templates) {
      await this.prisma.characterTemplate.create({
        data: {
          idTipo: tplId(tpl), idStory: storyId, uuid: tpl.uuid || uuidv4(), idCard: this._int(tpl.idCard, null),
          idTextName: this._int(tpl.idTextName, null), idTextDescription: this._int(tpl.idTextDescription, null),
          lifeMax: this._int(tpl.lifeMax, 10), energyMax: this._int(tpl.energyMax, 10), sadMax: this._int(tpl.sadMax, 10),
          dexterityStart: this._int(tpl.dexterityStart, 1), intelligenceStart: this._int(tpl.intelligenceStart, 1), constitutionStart: this._int(tpl.constitutionStart, 1),
          idClassPermitted: this._int(tpl.idClassPermitted, null), idClassProhibited: this._int(tpl.idClassProhibited, null),
        },
      });
    }

    // ── Keys ──
    const keys: any[] = payload.keys || [];
    const keyId = this._idAssigner(keys);
    for (const k of keys) {
      await this.prisma.storyKey.create({
        data: {
          id: keyId(k), idStory: storyId, uuid: k.uuid || uuidv4(), idCard: this._int(k.idCard, null),
          name: k.name || `key_${k.id}`, value: k.value != null ? String(k.value) : null,
          idTextDescription: this._int(k.idTextDescription, null), group: k.group ?? null,
          priority: this._int(k.priority, 0), visibility: k.visibility || 'PUBLIC',
        },
      });
    }

    // ── Locations (story-scoped) ──
    const locations: any[] = payload.locations || [];
    const locId = this._idAssigner(locations);
    for (const loc of locations) {
      await this.prisma.location.create({
        data: {
          id: locId(loc), idStory: storyId, uuid: loc.uuid || uuidv4(), idCard: this._int(loc.idCard, null),
          idTextName: this._int(loc.idTextName, null), idTextDescription: this._int(loc.idTextDescription, null),
          idTextNarrative: this._int(loc.idTextNarrative, null), idImage: this._int(loc.idImage, null),
          isSafe: this._int(loc.isSafe, 0), costEnergyEnter: this._int(loc.costEnergyEnter, 1),
          counterTime: this._int(loc.counterTime, null), maxCharacters: this._int(loc.maxCharacters, 100),
        },
      });
    }

    // ── Location neighbors ──
    const neighbors: any[] = payload.locationNeighbors || [];
    const nbId = this._idAssigner(neighbors);
    for (const nb of neighbors) {
      await this.prisma.locationNeighbor.create({
        data: {
          id: nbId(nb), idStory: storyId, uuid: nb.uuid || uuidv4(),
          idLocationFrom: this._int(nb.idLocationFrom, 0), idLocationTo: this._int(nb.idLocationTo, 0),
          direction: nb.direction || 'NORTH', flagBack: this._int(nb.flagBack, 0), energyCost: this._int(nb.energyCost, 0),
          conditionRegistryKey: nb.conditionRegistryKey ?? null, conditionRegistryValue: nb.conditionRegistryValue ?? null,
          idTextGo: this._int(nb.idTextGo, null), idTextBack: this._int(nb.idTextBack, null),
        },
      });
    }

    // ── Items (story-scoped) ──
    const items: any[] = payload.items || [];
    const itId = this._idAssigner(items);
    for (const item of items) {
      await this.prisma.item.create({
        data: {
          id: itId(item), idStory: storyId, uuid: item.uuid || uuidv4(), idCard: this._int(item.idCard, null),
          idTextName: this._int(item.idTextName, null), idTextDescription: this._int(item.idTextDescription, null),
          weight: this._int(item.weight, 1), isConsumabile: this._int(item.isConsumabile, 1),
          idClassPermitted: this._int(item.idClassPermitted, null), idClassProhibited: this._int(item.idClassProhibited, null),
        },
      });
    }

    // ── Item effects ──
    const itemEffects: any[] = payload.itemsEffects || payload.itemEffects || [];
    const ieId = this._idAssigner(itemEffects);
    for (const e of itemEffects) {
      await this.prisma.itemEffect.create({
        data: {
          id: ieId(e), idStory: storyId, uuid: e.uuid || uuidv4(), idItem: this._int(e.idItem, 0),
          idTextName: this._int(e.idTextName, null), idTextDescription: this._int(e.idTextDescription, null),
          effectCode: e.effectCode || 'NONE', effectValue: this._int(e.effectValue, 0),
        },
      });
    }

    // ── Weather rules ──
    const weatherRules: any[] = payload.weatherRules || [];
    const wrId = this._idAssigner(weatherRules);
    for (const w of weatherRules) {
      await this.prisma.weatherRule.create({
        data: {
          id: wrId(w), idStory: storyId, uuid: w.uuid || uuidv4(), idCard: this._int(w.idCard, null),
          idTextName: this._int(w.idTextName, null), idTextDescription: this._int(w.idTextDescription, null),
          probability: this._int(w.probability, 0), costMoveSafeLocation: this._int(w.costMoveSafeLocation, 0),
          costMoveNotSafeLocation: this._int(w.costMoveNotSafeLocation, 0), active: this._int(w.active, 1),
          priority: this._int(w.priority, 0), deltaEnergy: this._int(w.deltaEnergy, 0), idEvent: this._int(w.idEvent, null),
        },
      });
    }

    // ── Events (story-scoped) ──
    const events: any[] = payload.events || [];
    const evId = this._idAssigner(events);
    for (const ev of events) {
      await this.prisma.event.create({
        data: {
          id: evId(ev), idStory: storyId, uuid: ev.uuid || uuidv4(), idCard: this._int(ev.idCard, null),
          idSpecificLocation: this._int(ev.idSpecificLocation, null),
          idTextName: this._int(ev.idTextName, null), idTextDescription: this._int(ev.idTextDescription, null),
          type: ev.type || 'NORMAL', costEnery: this._int(ev.costEnery ?? ev.costEnergy, 0), flagEndTime: this._int(ev.flagEndTime, 0),
          idItemToAdd: this._int(ev.idItemToAdd, null), idWeather: this._int(ev.idWeather, null), idEventNext: this._int(ev.idEventNext, null),
          coinCost: this._int(ev.coinCost, 0), keyToAdd: ev.keyToAdd ?? null, keyValueToAdd: ev.keyValueToAdd ?? null,
          characteristicToAdd: ev.characteristicToAdd ?? null, characteristicToRemove: ev.characteristicToRemove ?? null,
        },
      });
    }

    // ── Event effects ──
    const eventEffects: any[] = payload.eventsEffects || payload.eventEffects || [];
    const eeId = this._idAssigner(eventEffects);
    for (const e of eventEffects) {
      await this.prisma.eventEffect.create({
        data: {
          id: eeId(e), idStory: storyId, uuid: e.uuid || uuidv4(), idCard: this._int(e.idCard, null),
          idEvent: this._int(e.idEvent, 0), statistics: e.statistics ?? null, value: this._int(e.value, 0),
          target: e.target ?? 'ALL', traitsToAdd: e.traitsToAdd ?? null, traitsToRemove: e.traitsToRemove ?? null,
          targetClass: this._int(e.targetClass, null), idItemTarget: this._int(e.idItemTarget, null), itemAction: e.itemAction ?? null,
        },
      });
    }

    // ── Choices ──
    const choices: any[] = payload.choices || [];
    const chId = this._idAssigner(choices);
    for (const ch of choices) {
      await this.prisma.choice.create({
        data: {
          id: chId(ch), idStory: storyId, uuid: ch.uuid || uuidv4(), idCard: this._int(ch.idCard, null),
          idEvent: this._int(ch.idEvent, null), idLocation: this._int(ch.idLocation, null), priority: this._int(ch.priority, 0),
          idTextName: this._int(ch.idTextName, null), idTextDescription: this._int(ch.idTextDescription, null), idTextNarrative: this._int(ch.idTextNarrative, null),
          idEventTorun: this._int(ch.idEventTorun, null), limitSad: this._int(ch.limitSad, null), limitDex: this._int(ch.limitDex, null),
          limitInt: this._int(ch.limitInt, null), limitCos: this._int(ch.limitCos, null),
          otherwiseFlag: this._int(ch.otherwiseFlag, 0), isProgress: this._int(ch.isProgress, 0), logicOperator: ch.logicOperator || 'AND',
        },
      });
    }

    // ── Choice conditions ──
    const choiceConditions: any[] = payload.choicesConditions || payload.choiceConditions || [];
    const ccId = this._idAssigner(choiceConditions);
    for (const c of choiceConditions) {
      await this.prisma.choiceCondition.create({
        data: {
          id: ccId(c), idStory: storyId, uuid: c.uuid || uuidv4(), idChoices: this._int(c.idChoices, 0),
          type: c.type || 'statistics', key: c.key ?? null, value: c.value != null ? String(c.value) : null, operator: c.operator ?? '=',
          idTextName: this._int(c.idTextName, null), idTextDescription: this._int(c.idTextDescription, null),
        },
      });
    }

    // ── Choice effects ──
    const choiceEffects: any[] = payload.choicesEffects || payload.choiceEffects || [];
    const ceId = this._idAssigner(choiceEffects);
    for (const c of choiceEffects) {
      await this.prisma.choiceEffect.create({
        data: {
          id: ceId(c), idStory: storyId, uuid: c.uuid || uuidv4(), idChoices: this._int(c.idChoices, 0),
          idScelta: this._int(c.idScelta, null), flagGroup: this._int(c.flagGroup, 0), statistics: c.statistics ?? null,
          value: this._int(c.value, 0), idText: this._int(c.idText, null), key: c.key ?? null,
          valueToAdd: c.valueToAdd ?? null, valueToRemove: c.valueToRemove ?? null,
        },
      });
    }

    // ── Global random events ──
    const globalRandomEvents: any[] = payload.globalRandomEvents || [];
    const grId = this._idAssigner(globalRandomEvents);
    for (const g of globalRandomEvents) {
      await this.prisma.globalRandomEvent.create({
        data: {
          id: grId(g), idStory: storyId, uuid: g.uuid || uuidv4(), idCard: this._int(g.idCard, null),
          conditionKey: g.conditionKey ?? null, conditionValue: g.conditionValue != null ? String(g.conditionValue) : null,
          probability: this._int(g.probability, 0), idText: this._int(g.idText, null), idEvent: this._int(g.idEvent, null),
        },
      });
    }

    // ── Missions ──
    const missions: any[] = payload.missions || [];
    const mId = this._idAssigner(missions);
    for (const m of missions) {
      await this.prisma.mission.create({
        data: {
          id: mId(m), idStory: storyId, uuid: m.uuid || uuidv4(), idCard: this._int(m.idCard, null),
          conditionKey: m.conditionKey ?? null, conditionValueFrom: m.conditionValueFrom != null ? String(m.conditionValueFrom) : null,
          conditionValueTo: m.conditionValueTo != null ? String(m.conditionValueTo) : null,
          idTextName: this._int(m.idTextName, null), idTextDescription: this._int(m.idTextDescription, null), idEventCompleted: this._int(m.idEventCompleted, null),
        },
      });
    }

    // ── Mission steps ──
    const missionSteps: any[] = payload.missionsSteps || payload.missionSteps || [];
    const msId = this._idAssigner(missionSteps);
    for (const s of missionSteps) {
      await this.prisma.missionStep.create({
        data: {
          id: msId(s), idStory: storyId, uuid: s.uuid || uuidv4(), idCard: this._int(s.idCard, null),
          idMission: this._int(s.idMission, 0), step: this._int(s.step, 1),
          conditionKey: s.conditionKey ?? null, conditionValueFrom: s.conditionValueFrom != null ? String(s.conditionValueFrom) : null,
          conditionValueTo: s.conditionValueTo != null ? String(s.conditionValueTo) : null,
          idTextName: this._int(s.idTextName, null), idTextDescription: this._int(s.idTextDescription, null), idEventCompleted: this._int(s.idEventCompleted, null),
        },
      });
    }

    return {
      status: 'IMPORTED',
      storyUuid: uuid,
      storyId: explicitId ?? storyId,
      textsImported: texts.length,
      locationsImported: locations.length,
      eventsImported: events.length,
      itemsImported: items.length,
      difficultiesImported: difficulties.length,
      classesImported: classes.length,
      choicesImported: choices.length,
    };
  }

  /** Completely remove a story and ALL its data from every table. */
  private async _deleteStoryCompletely(storyId: number): Promise<void> {
    await this.prisma.gamingMatch.deleteMany({ where: { idStory: storyId } });
    await this.prisma.listStory.delete({ where: { id: storyId } });
  }

  /**
   * Build a scoped-id assigner for an entity array: returns each entity's
   * explicit id, or synthesizes a unique one (max+counter) when absent.
   */
  private _idAssigner(arr: any[]): (e: any) => number {
    let max = 0;
    for (const e of arr) {
      const v = this._int(e?.id ?? e?.idTipo, 0);
      if (v > max) max = v;
    }
    let next = max;
    return (e: any) => {
      const raw = e?.id ?? e?.idTipo;
      return raw != null && raw !== '' ? this._int(raw, ++next) : ++next;
    };
  }

  /** Coerce an import value to an integer; empty/null/NaN → def. */
  private _int<T extends number | null>(value: any, def: T): number | T {
    if (value === null || value === undefined || value === '') return def;
    const n = typeof value === 'number' ? value : parseInt(String(value), 10);
    return Number.isNaN(n) ? def : n;
  }

  /** Validate an already-persisted story by uuid (R6 class conflict). */
  async validatePersistedStory(storyUuid: string): Promise<{ valid: boolean; count: number; errors: StoryValidationError[] }> {
    const story = await this.prisma.listStory.findUnique({ where: { uuid: storyUuid } });
    if (!story) return { valid: false, count: 1, errors: [{ rule: 'STORY_NOT_FOUND', entityType: 'story', entityId: storyUuid, field: 'uuid', message: 'Story not found' }] };

    const errors: StoryValidationError[] = [];
    const templates = await this.prisma.characterTemplate.findMany({ where: { idStory: story.id } });
    for (const tpl of templates) {
      if (tpl.idClassPermitted != null && tpl.idClassProhibited != null && tpl.idClassPermitted === tpl.idClassProhibited) {
        errors.push({ rule: 'R6_CLASS_CONFLICT', entityType: 'characterTemplates', entityId: tpl.uuid, field: 'idClassPermitted', message: `Template ${tpl.uuid} has same class for permitted and prohibited` });
      }
    }
    return { valid: errors.length === 0, count: errors.length, errors };
  }
}
