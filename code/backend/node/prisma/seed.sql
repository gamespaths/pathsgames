-- =============================================
-- Paths Games - Node.js backend seed data
-- Matches Java seed R__insert_story_seed_data.sql
-- UUIDs must match variables/dev.yaml
-- =============================================

-- Clean previous seed data
DELETE FROM "Match" WHERE "storyId" IN (
  SELECT id FROM "Story" WHERE uuid IN (
    'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
    'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
    'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
    'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'
  )
);
DELETE FROM "Story" WHERE uuid IN (
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
  'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a'
);

-- =============================================
-- Story 1: DEMO - Learn to Play Paths Games (Tutorial)
-- UUID: a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d = DEMO_1_UUID
-- =============================================
INSERT INTO "Story" (id, uuid, title, description, author, category, "group", visibility, priority, peghi, "versionMin", "createdAt", "updatedAt")
VALUES (
  'story-seed-001',
  'a1b2c3d4-e5f6-4a7b-8c9d-0e1f2a3b4c5d',
  'TUTORIAL',
  'Welcome to Paths Games! This guided tutorial will teach you every mechanic step by step.',
  'PathsMaster',
  'tutorial',
  'tutorial',
  'PUBLIC',
  100,
  0,
  '0.14.0',
  NOW(),
  NOW()
);

-- =============================================
-- Story 2: Demo Story 1
-- UUID: b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e = DEMO_2_UUID
-- =============================================
INSERT INTO "Story" (id, uuid, title, description, author, category, "group", visibility, priority, peghi, "versionMin", "createdAt", "updatedAt")
VALUES (
  'story-seed-002',
  'b2c3d4e5-f6a7-4b8c-9d0e-1f2a3b4c5d6e',
  'Il Valvassore di Marca',
  'A medieval adventure set in Veneto, 1200 AD. Explore the life of a feudal lord.',
  'PathsMaster',
  'adventure',
  'medieval',
  'PUBLIC',
  90,
  5,
  '0.14.0',
  NOW(),
  NOW()
);

-- =============================================
-- Story 3: Demo Story 3 (DEMO_3_UUID)
-- UUID: c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f
-- =============================================
INSERT INTO "Story" (id, uuid, title, description, author, category, "group", visibility, priority, peghi, "versionMin", "createdAt", "updatedAt")
VALUES (
  'story-seed-003',
  'c3d4e5f6-a7b8-4c9d-0e1f-2a3b4c5d6e7f',
  'Demo Story 3',
  'Third demo story for test coverage.',
  'PathsMaster',
  'demo',
  'demo',
  'PUBLIC',
  80,
  0,
  '0.14.0',
  NOW(),
  NOW()
);

-- =============================================
-- Story 4: Demo Story 4 (DEMO_4_UUID)
-- UUID: d4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a
-- =============================================
INSERT INTO "Story" (id, uuid, title, description, author, category, "group", visibility, priority, peghi, "versionMin", "createdAt", "updatedAt")
VALUES (
  'story-seed-004',
  'd4e5f6a7-b8c9-4d0e-1f2a-3b4c5d6e7f8a',
  'Demo Story 4',
  'Fourth demo story for test coverage.',
  'PathsMaster',
  'demo',
  'demo',
  'PUBLIC',
  70,
  0,
  '0.14.0',
  NOW(),
  NOW()
);
