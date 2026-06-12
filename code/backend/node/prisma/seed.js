#!/usr/bin/env node
/**
 * Seed script (list_* schema): inserts demo story data required for the Robot
 * Framework tests. Idempotent — deletes the two demo stories then recreates.
 * Mirrors the Java reference seed (R__insert_story_seed_data.sql).
 */
const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();

const DEMO_1 = 'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d';
const DEMO_2 = 'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e';

async function text(idStory, id, idText, lang, shortText, longText) {
  await prisma.storyText.create({ data: { id, idStory, idText, lang, shortText, longText: longText ?? shortText } });
}

async function seedDemo1() {
  const idStory = 9001;
  await prisma.listStory.create({
    data: {
      id: idStory, uuid: DEMO_1, author: 'PathsMaster', versionMin: '0.14.0',
      idTextClockSingular: 10, idTextClockPlural: 11, category: 'tutorial', group: 'tutorial',
      visibility: 'PUBLIC', priority: 100, peghi: 0, idTextTitle: 1, idTextDescription: 2, idCard: 90001,
    },
  });

  // Texts
  await text(idStory, 1, 1, 'en', 'TUTORIAL', 'Welcome to Paths Games! This guided tutorial teaches every mechanic.');
  await text(idStory, 2, 1, 'it', 'TUTORIAL', 'Benvenuto in Paths Games!');
  await text(idStory, 3, 2, 'en', 'A short training adventure.', 'A short training adventure in the Academy of Paths.');
  await text(idStory, 4, 42, 'en', 'quarantadue', 'quarantadue desc');
  await text(idStory, 5, 100, 'en', 'Welcome Hall', 'A bright welcoming hall.');
  await text(idStory, 6, 100, 'it', 'Sala di Benvenuto', 'Una sala luminosa.');
  await text(idStory, 7, 200, 'en', 'Student');
  await text(idStory, 8, 201, 'en', 'Scholar');
  await text(idStory, 9, 202, 'en', 'Athlete');

  // Card (story.idCard = card.id = 90001)
  await prisma.card.create({
    data: {
      id: 90001, idStory, idTextTitle: 42, idTextDescription: 42, idTextName: 1,
      urlImmage: 'https://images.unsplash.com/photo-1585829365343-ea8ed0b1cb5b?q=80&w=1470',
      alternativeImage: 'tutorial-alt.png', awesomeIcon: 'fas fa-graduation-cap',
      styleMain: 'tutorial', styleDetail: 'tutorial-detail', linkCopyright: 'https://unsplash.com', cardType: 'tutorial',
    },
  });

  // Difficulties (stat fields; first matches expected seed values)
  await prisma.difficulty.create({ data: { id: 90001, idStory, expCost: 300, maxWeight: 20, life: 120, energy: 110, sad: 0, dexterity: 12, intelligence: 12, constitution: 12, weight: 12, traitCostPositiveBudget: 2, traitCostNegativeBudget: 3 } });
  await prisma.difficulty.create({ data: { id: 90002, idStory, expCost: 301, maxWeight: 20, life: 100, energy: 100, sad: 10, dexterity: 10, intelligence: 10, constitution: 10, weight: 10 } });

  // Classes
  await prisma.storyClass.create({ data: { id: 90001, idStory, idTextName: 200, weightMax: 12, dexterityBase: 3, intelligenceBase: 3, constitutionBase: 3 } });
  await prisma.storyClass.create({ data: { id: 90002, idStory, idTextName: 201, weightMax: 8, dexterityBase: 2, intelligenceBase: 5, constitutionBase: 2 } });
  await prisma.storyClass.create({ data: { id: 90003, idStory, idTextName: 202, weightMax: 10, dexterityBase: 5, intelligenceBase: 2, constitutionBase: 4 } });

  // Class bonuses
  const bonuses = [
    [90001, 90001, 'life', 3], [90002, 90001, 'energy', 3], [90003, 90001, 'exp', 2],
    [90004, 90002, 'intelligence', 3], [90005, 90002, 'energy', 2],
    [90006, 90003, 'dexterity', 3], [90007, 90003, 'life', 2], [90008, 90003, 'energy', 4],
  ];
  for (const [id, idClass, statistic, value] of bonuses) {
    await prisma.classBonus.create({ data: { id, idStory, idClass, statistic, value } });
  }

  // Traits (int class FKs)
  await prisma.trait.create({ data: { id: 90001, idStory, idTextName: 700, costPositive: 1, life: 2, constitution: 1 } });
  await prisma.trait.create({ data: { id: 90002, idStory, idTextName: 701, costPositive: 1, energy: 2, dexterity: 1, idClassPermitted: 90002 } });
  await prisma.trait.create({ data: { id: 90003, idStory, idTextName: 702, costPositive: 1, intelligence: 2, weight: 1, idClassProhibited: 90001 } });
  await prisma.trait.create({ data: { id: 90004, idStory, idTextName: 703, costNegative: 2, life: -2 } });
  await prisma.trait.create({ data: { id: 90005, idStory, idTextName: 704, costNegative: 2, energy: -2 } });

  // Character templates (idClass* nullable int)
  await prisma.characterTemplate.create({ data: { idTipo: 90001, idStory, idTextName: 210, lifeMax: 12, energyMax: 12, sadMax: 8, dexterityStart: 3, intelligenceStart: 3, constitutionStart: 3 } });
  await prisma.characterTemplate.create({ data: { idTipo: 90002, idStory, idTextName: 211, lifeMax: 10, energyMax: 10, sadMax: 6, dexterityStart: 2, intelligenceStart: 5, constitutionStart: 2, idClassPermitted: 90002 } });
  await prisma.characterTemplate.create({ data: { idTipo: 90003, idStory, idTextName: 212, lifeMax: 11, energyMax: 14, sadMax: 7, dexterityStart: 5, intelligenceStart: 2, constitutionStart: 4, idClassProhibited: 90001 } });

  console.log('  ✓ DEMO_1 seeded');
}

async function seedDemo2() {
  const idStory = 9002;
  await prisma.listStory.create({
    data: {
      id: idStory, uuid: DEMO_2, author: 'PathsMaster', versionMin: '0.14.0',
      category: 'adventure', group: 'medieval', visibility: 'PUBLIC', priority: 90, peghi: 5,
      idTextTitle: 1, idTextDescription: 2, idCard: 90010,
    },
  });
  await text(idStory, 1, 1, 'en', 'Il Valvassore di Marca', 'A medieval adventure set in Veneto, 1200 AD.');
  await text(idStory, 2, 2, 'en', 'A medieval adventure.', 'A medieval adventure set in Veneto.');
  await text(idStory, 3, 50, 'en', 'Valvassore Card');

  await prisma.card.create({
    data: {
      id: 90010, idStory, idTextTitle: 50, idTextDescription: 50,
      urlImmage: 'https://images.unsplash.com/photo-1461360228754-6e81c478b882?q=80&w=1470',
      awesomeIcon: 'fas fa-chess-rook', styleMain: 'medieval', styleDetail: 'medieval-detail',
    },
  });

  await prisma.difficulty.create({ data: { id: 90010, idStory, life: 100, energy: 100, sad: 0, dexterity: 10, intelligence: 10, constitution: 10, weight: 10 } });
  await prisma.difficulty.create({ data: { id: 90011, idStory, life: 80, energy: 80, sad: 5, dexterity: 8, intelligence: 8, constitution: 8, weight: 8 } });

  await prisma.storyClass.create({ data: { id: 90010, idStory, idTextName: 250, weightMax: 10, dexterityBase: 3, intelligenceBase: 4, constitutionBase: 3 } });
  await prisma.classBonus.create({ data: { id: 90010, idStory, idClass: 90010, statistic: 'life', value: 5 } });
  await prisma.characterTemplate.create({ data: { idTipo: 90010, idStory, idTextName: 260, lifeMax: 15, energyMax: 12, sadMax: 8, dexterityStart: 3, intelligenceStart: 4, constitutionStart: 3 } });

  console.log('  ✓ DEMO_2 seeded');
}

async function seed() {
  console.log('Seeding (list_* schema)...');
  // Idempotent: remove demo stories first (cascade clears all sub-entities)
  await prisma.listStory.deleteMany({ where: { uuid: { in: [DEMO_1, DEMO_2] } } });
  await seedDemo1();
  await seedDemo2();
  console.log('Seeding complete.');
}

seed()
  .catch((e) => { console.error('Seed failed:', e); process.exit(1); })
  .finally(async () => { await prisma.$disconnect(); });
