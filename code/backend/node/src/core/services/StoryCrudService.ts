import type { PrismaClient } from '@prisma/client';
import type { StoryCrudPort } from '../ports/StoryCrudPort';
import type { StoryRepository } from '../ports/StoryRepository';
import { v4 as uuidv4 } from 'uuid';
import { toInt } from '../../adapters/persistence/prisma/textResolver';

// Field descriptor: [inputKey, dbColumn, kind]. `int` → integer|null, `strnum`
// → stringified, `str` → passthrough. Builders are sparse: only keys present in
// the request payload are written (so PUT updates touch only provided fields).
type Field = [string, string, 'int' | 'str' | 'strnum'];

interface EntitySpec {
  model: string; // prisma delegate name
  idField: 'id' | 'idTipo';
  fields: Field[];
  createDefaults?: Record<string, any>; // required-no-default columns for create
}

const E: Record<string, EntitySpec> = {
  difficulties: {
    model: 'difficulty', idField: 'id',
    fields: [
      ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['idCard', 'idCard', 'int'],
      ['expCost', 'expCost', 'int'], ['maxWeight', 'maxWeight', 'int'], ['minCharacter', 'minCharacter', 'int'],
      ['maxCharacter', 'maxCharacter', 'int'], ['costHelpComa', 'costHelpComa', 'int'], ['costMaxCharacteristics', 'costMaxCharacteristics', 'int'],
      ['numberMaxFreeAction', 'numberMaxFreeAction', 'int'], ['life', 'life', 'int'], ['energy', 'energy', 'int'], ['sad', 'sad', 'int'],
      ['dexterity', 'dexterity', 'int'], ['intelligence', 'intelligence', 'int'], ['constitution', 'constitution', 'int'], ['weight', 'weight', 'int'],
      ['traitCostPositiveBudget', 'traitCostPositiveBudget', 'int'], ['traitCostNegativeBudget', 'traitCostNegativeBudget', 'int'],
    ],
  },
  keys: {
    model: 'storyKey', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['name', 'name', 'str'], ['value', 'value', 'strnum'], ['idTextDescription', 'idTextDescription', 'int'], ['group', 'group', 'str'], ['priority', 'priority', 'int'], ['visibility', 'visibility', 'str']],
    createDefaults: { name: 'new_key' },
  },
  classes: {
    model: 'storyClass', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['weightMax', 'weightMax', 'int'], ['dexterityBase', 'dexterityBase', 'int'], ['intelligenceBase', 'intelligenceBase', 'int'], ['constitutionBase', 'constitutionBase', 'int']],
  },
  'class-bonuses': {
    model: 'classBonus', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idClass', 'idClass', 'int'], ['statistic', 'statistic', 'str'], ['value', 'value', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int']],
    createDefaults: { idClass: 0, statistic: 'life' },
  },
  traits: {
    model: 'trait', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idClassPermitted', 'idClassPermitted', 'int'], ['idClassProhibited', 'idClassProhibited', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['costPositive', 'costPositive', 'int'], ['costNegative', 'costNegative', 'int'], ['life', 'life', 'int'], ['energy', 'energy', 'int'], ['sad', 'sad', 'int'], ['dexterity', 'dexterity', 'int'], ['intelligence', 'intelligence', 'int'], ['constitution', 'constitution', 'int'], ['weight', 'weight', 'int']],
  },
  'character-templates': {
    model: 'characterTemplate', idField: 'idTipo',
    fields: [['idCard', 'idCard', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['lifeMax', 'lifeMax', 'int'], ['energyMax', 'energyMax', 'int'], ['sadMax', 'sadMax', 'int'], ['dexterityStart', 'dexterityStart', 'int'], ['intelligenceStart', 'intelligenceStart', 'int'], ['constitutionStart', 'constitutionStart', 'int'], ['idClassPermitted', 'idClassPermitted', 'int'], ['idClassProhibited', 'idClassProhibited', 'int']],
  },
  creators: {
    model: 'creator', idField: 'id',
    fields: [['idText', 'idText', 'int'], ['link', 'link', 'str'], ['url', 'url', 'str'], ['urlImage', 'urlImage', 'str'], ['urlEmote', 'urlEmote', 'str'], ['urlInstagram', 'urlInstagram', 'str'], ['idCard', 'idCard', 'int']],
  },
  cards: {
    model: 'card', idField: 'id',
    fields: [['urlImage', 'urlImmage', 'str'], ['urlImmage', 'urlImmage', 'str'], ['idTextTitle', 'idTextTitle', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['idTextCopyright', 'idTextCopyright', 'int'], ['linkCopyright', 'linkCopyright', 'str'], ['idCreator', 'idCreator', 'int'], ['alternativeImage', 'alternativeImage', 'str'], ['awesomeIcon', 'awesomeIcon', 'str'], ['styleMain', 'styleMain', 'str'], ['styleDetail', 'styleDetail', 'str'], ['styleImageLittle', 'styleImageLittle', 'str'], ['styleImageMedium', 'styleImageMedium', 'str'], ['styleImageLarge', 'styleImageLarge', 'str'], ['cardType', 'cardType', 'str'], ['idCard', 'idCard', 'int'], ['idTextName', 'idTextName', 'int']],
  },
  locations: {
    model: 'location', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['idTextNarrative', 'idTextNarrative', 'int'], ['idImage', 'idImage', 'int'], ['isSafe', 'isSafe', 'int'], ['costEnergyEnter', 'costEnergyEnter', 'int'], ['counterTime', 'counterTime', 'int'], ['maxCharacters', 'maxCharacters', 'int']],
  },
  'location-neighbors': {
    model: 'locationNeighbor', idField: 'id',
    fields: [['idLocationFrom', 'idLocationFrom', 'int'], ['idLocationTo', 'idLocationTo', 'int'], ['direction', 'direction', 'str'], ['flagBack', 'flagBack', 'int'], ['energyCost', 'energyCost', 'int'], ['conditionRegistryKey', 'conditionRegistryKey', 'str'], ['conditionRegistryValue', 'conditionRegistryValue', 'str'], ['idTextGo', 'idTextGo', 'int'], ['idTextBack', 'idTextBack', 'int']],
    createDefaults: { idLocationFrom: 0, idLocationTo: 0, direction: 'NORTH' },
  },
  items: {
    model: 'item', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['weight', 'weight', 'int'], ['isConsumabile', 'isConsumabile', 'int'], ['idClassPermitted', 'idClassPermitted', 'int'], ['idClassProhibited', 'idClassProhibited', 'int']],
  },
  'item-effects': {
    model: 'itemEffect', idField: 'id',
    fields: [['idItem', 'idItem', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['effectCode', 'effectCode', 'str'], ['effectValue', 'effectValue', 'int']],
    createDefaults: { idItem: 0, effectCode: 'NONE' },
  },
  'weather-rules': {
    model: 'weatherRule', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['probability', 'probability', 'int'], ['costMoveSafeLocation', 'costMoveSafeLocation', 'int'], ['costMoveNotSafeLocation', 'costMoveNotSafeLocation', 'int'], ['active', 'active', 'int'], ['priority', 'priority', 'int'], ['deltaEnergy', 'deltaEnergy', 'int'], ['idEvent', 'idEvent', 'int']],
  },
  events: {
    model: 'event', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idSpecificLocation', 'idSpecificLocation', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['type', 'type', 'str'], ['costEnery', 'costEnery', 'int'], ['costEnergy', 'costEnery', 'int'], ['flagEndTime', 'flagEndTime', 'int'], ['idItemToAdd', 'idItemToAdd', 'int'], ['idWeather', 'idWeather', 'int'], ['idEventNext', 'idEventNext', 'int'], ['coinCost', 'coinCost', 'int']],
  },
  'event-effects': {
    model: 'eventEffect', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idEvent', 'idEvent', 'int'], ['statistics', 'statistics', 'str'], ['value', 'value', 'int'], ['target', 'target', 'str'], ['targetClass', 'targetClass', 'int'], ['idItemTarget', 'idItemTarget', 'int'], ['itemAction', 'itemAction', 'str']],
    createDefaults: { idEvent: 0 },
  },
  choices: {
    model: 'choice', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idEvent', 'idEvent', 'int'], ['idLocation', 'idLocation', 'int'], ['priority', 'priority', 'int'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['idTextNarrative', 'idTextNarrative', 'int'], ['idEventTorun', 'idEventTorun', 'int'], ['otherwiseFlag', 'otherwiseFlag', 'int'], ['isProgress', 'isProgress', 'int'], ['logicOperator', 'logicOperator', 'str']],
  },
  'choice-conditions': {
    model: 'choiceCondition', idField: 'id',
    fields: [['idChoices', 'idChoices', 'int'], ['type', 'type', 'str'], ['key', 'key', 'str'], ['value', 'value', 'strnum'], ['operator', 'operator', 'str'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int']],
    createDefaults: { idChoices: 0, type: 'statistics' },
  },
  'choice-effects': {
    model: 'choiceEffect', idField: 'id',
    fields: [['idChoices', 'idChoices', 'int'], ['idScelta', 'idScelta', 'int'], ['flagGroup', 'flagGroup', 'int'], ['statistics', 'statistics', 'str'], ['value', 'value', 'int'], ['idText', 'idText', 'int'], ['key', 'key', 'str'], ['valueToAdd', 'valueToAdd', 'strnum'], ['valueToRemove', 'valueToRemove', 'strnum']],
    createDefaults: { idChoices: 0 },
  },
  'global-random-events': {
    model: 'globalRandomEvent', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['conditionKey', 'conditionKey', 'str'], ['conditionValue', 'conditionValue', 'strnum'], ['probability', 'probability', 'int'], ['idText', 'idText', 'int'], ['idEvent', 'idEvent', 'int']],
  },
  missions: {
    model: 'mission', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['conditionKey', 'conditionKey', 'str'], ['conditionValueFrom', 'conditionValueFrom', 'strnum'], ['conditionValueTo', 'conditionValueTo', 'strnum'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['idEventCompleted', 'idEventCompleted', 'int']],
  },
  'mission-steps': {
    model: 'missionStep', idField: 'id',
    fields: [['idCard', 'idCard', 'int'], ['idMission', 'idMission', 'int'], ['step', 'step', 'int'], ['conditionKey', 'conditionKey', 'str'], ['conditionValueFrom', 'conditionValueFrom', 'strnum'], ['conditionValueTo', 'conditionValueTo', 'strnum'], ['idTextName', 'idTextName', 'int'], ['idTextDescription', 'idTextDescription', 'int'], ['idEventCompleted', 'idEventCompleted', 'int']],
    createDefaults: { idMission: 0, step: 1 },
  },
};

export class StoryCrudService implements StoryCrudPort {
  constructor(
    private prisma: PrismaClient,
    private storyRepo: StoryRepository,
  ) {}

  private _delegate(model: string): any {
    return (this.prisma as any)[model];
  }

  private _coerce(value: any, kind: 'int' | 'str' | 'strnum'): any {
    if (kind === 'int') {
      if (value === null || value === undefined || value === '') return null;
      const n = typeof value === 'number' ? value : parseInt(String(value), 10);
      return Number.isNaN(n) ? null : n;
    }
    if (kind === 'strnum') return value == null ? null : String(value);
    return value;
  }

  /** Sparse builder: only keys present in `data` are written. */
  private _build(spec: EntitySpec, data: any): any {
    const out: any = {};
    for (const [inKey, col, kind] of spec.fields) {
      if (data[inKey] !== undefined) out[col] = this._coerce(data[inKey], kind);
    }
    return out;
  }

  /** Resolve story uuid → integer id (list_stories.id), or null. */
  private async _storyId(storyUuid: string): Promise<number | null> {
    const s = await this.prisma.listStory.findUnique({ where: { uuid: storyUuid }, select: { id: true } });
    return s ? s.id : null;
  }

  private async _nextId(spec: EntitySpec, idStory: number): Promise<number> {
    const agg = await this._delegate(spec.model).aggregate({ where: { idStory }, _max: { [spec.idField]: true } });
    return (agg._max[spec.idField] ?? 0) + 1;
  }

  async listEntities(storyUuid: string, entityType: string): Promise<any[] | null> {
    const idStory = await this._storyId(storyUuid);
    if (idStory === null) return null;
    const spec = E[entityType];
    if (!spec) return [];
    return this._delegate(spec.model).findMany({ where: { idStory }, orderBy: { [spec.idField]: 'asc' } });
  }

  async getEntity(storyUuid: string, entityType: string, entityUuid: string): Promise<any | null> {
    const idStory = await this._storyId(storyUuid);
    if (idStory === null) return null;
    const spec = E[entityType];
    if (!spec) return null;
    return this._delegate(spec.model).findUnique({ where: { uuid: entityUuid } });
  }

  async createEntity(storyUuid: string, entityType: string, data: any): Promise<any | null> {
    const idStory = await this._storyId(storyUuid);
    if (idStory === null) return null;
    const spec = E[entityType];
    if (!spec) return null;
    try {
      const id = await this._nextId(spec, idStory);
      const created = {
        [spec.idField]: id,
        idStory,
        uuid: data.uuid || uuidv4(),
        ...(spec.createDefaults ?? {}),
        ...this._build(spec, data),
      };
      return await this._delegate(spec.model).create({ data: created });
    } catch (err) {
      console.error(`Failed to create ${entityType}:`, err);
      return null;
    }
  }

  async updateEntity(storyUuid: string, entityType: string, entityUuid: string, data: any): Promise<any | null> {
    const spec = E[entityType];
    if (!spec) return null;
    try {
      return await this._delegate(spec.model).update({ where: { uuid: entityUuid }, data: this._build(spec, data) });
    } catch (err) {
      console.error(`Failed to update ${entityType} ${entityUuid}:`, err);
      return null;
    }
  }

  async deleteEntity(storyUuid: string, entityType: string, entityUuid: string): Promise<boolean> {
    const spec = E[entityType];
    if (!spec) return false;
    try {
      await this._delegate(spec.model).delete({ where: { uuid: entityUuid } });
      return true;
    } catch (err) {
      console.error(`Failed to delete ${entityType} ${entityUuid}:`, err);
      return false;
    }
  }

  async updateStory(storyUuid: string, data: any): Promise<any | null> {
    try {
      const d: any = {};
      const set = (k: string, v: any) => { if (v !== undefined) d[k] = v; };
      set('author', data.author);
      set('category', data.category);
      set('group', data.group);
      set('visibility', data.visibility);
      set('priority', data.priority);
      set('peghi', data.peghi);
      set('versionMin', data.versionMin);
      set('versionMax', data.versionMax);
      set('idTextTitle', toIntOrU(data.idTextTitle));
      set('idTextDescription', toIntOrU(data.idTextDescription));
      set('idCard', toIntOrU(data.idCard));
      set('idImage', toIntOrU(data.idImage));
      set('idLocationStart', toIntOrU(data.idLocationStart));
      set('idCreator', toIntOrU(data.idCreator));
      set('idEventEndGame', toIntOrU(data.idEventEndGame));
      set('idTextClockSingular', toIntOrU(data.idTextClockSingular));
      set('idTextClockPlural', toIntOrU(data.idTextClockPlural));
      return await this.prisma.listStory.update({ where: { uuid: storyUuid }, data: d });
    } catch (err) {
      console.error(`Failed to update story ${storyUuid}:`, err);
      return null;
    }
  }

  async createStory(data: any): Promise<any | null> {
    try {
      return await this.prisma.listStory.create({
        data: {
          uuid: data.uuid || uuidv4(),
          author: data.author ?? null,
          category: data.category ?? null,
          group: data.group ?? null,
          visibility: data.visibility ?? 'DRAFT',
          priority: toInt(data.priority ?? 0),
          peghi: toInt(data.peghi ?? 0),
          idTextTitle: toIntOrU(data.idTextTitle) ?? null,
          idTextDescription: toIntOrU(data.idTextDescription) ?? null,
        },
      });
    } catch (err) {
      console.error('Failed to create story:', err);
      return null;
    }
  }
}

function toIntOrU(value: any): number | undefined {
  if (value === undefined) return undefined;
  if (value === null || value === '') return undefined;
  const n = typeof value === 'number' ? value : parseInt(String(value), 10);
  return Number.isNaN(n) ? undefined : n;
}
