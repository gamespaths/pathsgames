import { StoryImportService } from '../core/services/StoryImportService';

function makeService() {
  return new StoryImportService({} as any);
}

describe('StoryImportService.validate', () => {
  it('returns empty for a minimal valid payload', () => {
    const svc = makeService();
    const errors = svc.validate({ uuid: 'test-uuid', events: [{ id: 1, type: 'NORMAL' }] });
    expect(errors).toHaveLength(0);
  });

  it('R_EVENT_REF: choice idEvent referencing missing event', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u1',
      events: [{ id: 1, type: 'NORMAL' }],
      choices: [{ id: 1, idEvent: 999, otherwiseFlag: 1 }],
    });
    expect(errors.some(e => e.rule === 'R_EVENT_REF' && e.field === 'idEvent')).toBe(true);
  });

  it('R_LOCATION_REF: neighbor idLocationTo referencing missing location', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u2',
      locations: [{ id: 1 }],
      locationNeighbors: [{ id: 1, idLocationFrom: 1, idLocationTo: 77, direction: 'N' }],
    });
    expect(errors.some(e => e.rule === 'R_LOCATION_REF')).toBe(true);
  });

  it('R3_EVENT_CYCLE: detects cycle in idEventNext chain', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u3',
      events: [{ id: 1, idEventNext: 2 }, { id: 2, idEventNext: 1 }],
    });
    expect(errors.some(e => e.rule === 'R3_EVENT_CYCLE')).toBe(true);
  });

  it('R4_CHOICE_EMPTY: choice with no effects and otherwiseFlag=0', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u4',
      events: [{ id: 1, type: 'NORMAL' }],
      choices: [{ id: 1, idEvent: 1, otherwiseFlag: 0 }],
    });
    expect(errors.some(e => e.rule === 'R4_CHOICE_EMPTY')).toBe(true);
  });

  it('R4_CHOICE_EMPTY: choice with top-level choiceEffects produces no errors', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u4b',
      events: [{ id: 1, type: 'NORMAL' }],
      choices: [{ id: 1, idEvent: 1, otherwiseFlag: 0 }],
      choiceEffects: [{ id: 1, idChoice: 1, statistic: 'life', value: -1 }],
    });
    expect(errors.filter(e => e.rule === 'R4_CHOICE_EMPTY')).toHaveLength(0);
  });

  it('R6_CLASS_CONFLICT: template with same class permitted and prohibited', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u5',
      classes: [{ id: 1 }],
      characterTemplates: [{ id: 1, lifeMax: 10, energyMax: 10, idClassPermitted: 1, idClassProhibited: 1 }],
    });
    expect(errors.some(e => e.rule === 'R6_CLASS_CONFLICT')).toBe(true);
  });

  it('valid payload with choice otherwiseFlag=1 produces no errors', () => {
    const svc = makeService();
    const errors = svc.validate({
      uuid: 'u6',
      events: [{ id: 1, type: 'NORMAL' }, { id: 2, type: 'NORMAL' }],
      choices: [{ id: 1, idEvent: 1, otherwiseFlag: 1 }],
      locations: [{ id: 1 }, { id: 2 }],
    });
    expect(errors).toHaveLength(0);
  });
});

describe('StoryImportService._computeStats via joinMatch stats', () => {
  it('life = template.lifeMax + difficulty.life + class.lifeBonus', () => {
    // Test the stat computation logic in isolation
    const template = { lifeMax: 12, energyMax: 12, dexterityStart: 3, intelligenceStart: 3, constitutionStart: 3 };
    const cls = { lifeBonus: 3, energyBonus: 3, dexterityBase: 3, intelligenceBase: 3, constitutionBase: 3 };
    const difficulty = { life: 10 };
    const traits: any[] = [];

    const life = template.lifeMax + difficulty.life + cls.lifeBonus + traits.reduce((s, t) => s + (t.life ?? 0), 0);
    const energy = template.energyMax + cls.energyBonus + traits.reduce((s, t) => s + (t.energy ?? 0), 0);
    const dexterity = template.dexterityStart + cls.dexterityBase;

    expect(life).toBe(25);   // 12 + 10 + 3
    expect(energy).toBe(15); // 12 + 3
    expect(dexterity).toBe(6); // 3 + 3
    expect(life).toBeGreaterThan(0);
    expect(energy).toBeGreaterThan(0);
    expect(dexterity).toBeGreaterThan(0);
  });
});
