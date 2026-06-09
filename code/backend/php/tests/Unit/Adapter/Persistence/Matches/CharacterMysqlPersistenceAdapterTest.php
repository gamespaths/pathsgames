<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Persistence\Matches;

use Games\Paths\Adapter\Persistence\Matches\CharacterMysqlPersistenceAdapter;
use Games\Paths\Adapter\Persistence\Matches\StoryMatchMysqlReadAdapter;
use PDO;
use PHPUnit\Framework\TestCase;

class CharacterMysqlPersistenceAdapterTest extends TestCase
{
    private PDO $pdo;
    private CharacterMysqlPersistenceAdapter $adapter;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->exec('CREATE TABLE gaming_character_instance (
            id INTEGER, id_match INTEGER, uuid TEXT, id_user INTEGER, id_character_template INTEGER,
            dexterity INTEGER, intelligence INTEGER, constitution INTEGER, energy INTEGER, life INTEGER,
            sad INTEGER, id_location INTEGER, is_sleeping INTEGER, is_coma INTEGER,
            counter_consecutive_pass INTEGER, ts_insert TEXT, ts_update TEXT, PRIMARY KEY (id, id_match))');
        $this->pdo->exec('CREATE TABLE gaming_backpack_resources (
            id INTEGER, id_match INTEGER, uuid TEXT, id_character_match INTEGER,
            food INTEGER, magic INTEGER, coin INTEGER, ts_insert TEXT, ts_update TEXT, PRIMARY KEY (id, id_match))');
        $this->pdo->exec('CREATE TABLE gaming_character_traits (
            id INTEGER, id_match INTEGER, uuid TEXT, id_character_match INTEGER, id_traits INTEGER,
            ts_insert TEXT, ts_update TEXT, PRIMARY KEY (id, id_match))');
        $this->adapter = new CharacterMysqlPersistenceAdapter($this->pdo);
    }

    private function charRow(int $id = 1): array
    {
        return ['id' => $id, 'id_match' => 500, 'id_user' => 7, 'id_character_template' => 90001,
                'dexterity' => 19, 'intelligence' => 18, 'constitution' => 19, 'energy' => 127,
                'life' => 137, 'sad' => 0, 'id_location' => 90001, 'is_sleeping' => 0, 'is_coma' => 0];
    }

    public function testCharacterRoundTrip(): void
    {
        $this->assertSame(0, $this->adapter->countCharactersByMatchId(500));
        $saved = $this->adapter->saveCharacter($this->charRow());
        $this->assertNotEmpty($saved['uuid']);
        $this->assertSame(19, $saved['dexterity']);
        $this->assertSame(1, $this->adapter->countCharactersByMatchId(500));
        $this->assertCount(1, $this->adapter->findCharactersByMatchId(500));
        $this->assertSame(1, $this->adapter->findCharacterByMatchAndUuid(500, $saved['uuid'])['id']);
        $this->assertSame($saved['uuid'], $this->adapter->findCharacterByMatchAndUser(500, 7)['uuid']);
        $this->assertNull($this->adapter->findCharacterByMatchAndUser(500, 999));
        $this->assertNull($this->adapter->findCharacterByMatchAndUuid(500, 'missing'));
    }

    public function testBackpackAndTraits(): void
    {
        $this->adapter->saveCharacter($this->charRow());
        $this->adapter->saveBackpack(['id' => 1, 'id_match' => 500, 'id_character_match' => 1,
            'food' => 4, 'magic' => 5, 'coin' => 6]);
        $this->assertSame(['food' => 4, 'magic' => 5, 'coin' => 6], $this->adapter->findBackpack(500, 1));
        $this->assertNull($this->adapter->findBackpack(500, 999));

        $this->adapter->saveTraits([
            ['id' => 1, 'id_match' => 500, 'id_character_match' => 1, 'id_traits' => 90001],
            ['id' => 2, 'id_match' => 500, 'id_character_match' => 1, 'id_traits' => 90002],
        ]);
        $traits = $this->adapter->findTraits(500, 1);
        $this->assertCount(2, $traits);
        $this->adapter->saveTraits([]); // no-op
    }

    public function testStoryReadStep21(): void
    {
        $this->pdo->exec('CREATE TABLE list_character_templates (
            id_tipo INTEGER, id_story INTEGER, uuid TEXT, life_max INTEGER, energy_max INTEGER, sad_max INTEGER,
            dexterity_start INTEGER, intelligence_start INTEGER, constitution_start INTEGER,
            id_class_permitted INTEGER, id_class_prohibited INTEGER)');
        $this->pdo->exec('CREATE TABLE list_classes (id INTEGER, id_story INTEGER, uuid TEXT,
            weight_max INTEGER, dexterity_base INTEGER, intelligence_base INTEGER, constitution_base INTEGER)');
        $this->pdo->exec('CREATE TABLE list_classes_bonus (id INTEGER, id_story INTEGER, uuid TEXT,
            id_class INTEGER, statistic TEXT, value INTEGER)');
        $this->pdo->exec('CREATE TABLE list_traits (id INTEGER, id_story INTEGER, uuid TEXT,
            life INTEGER, energy INTEGER, sad INTEGER, dexterity INTEGER, intelligence INTEGER, constitution INTEGER)');
        $this->pdo->exec("INSERT INTO list_character_templates VALUES (90001, 9001, 'tpl', 12, 12, 8, 3, 3, 3, NULL, 90002)");
        $this->pdo->exec("INSERT INTO list_classes VALUES (90001, 9001, 'cls', 12, 3, 3, 3)");
        $this->pdo->exec("INSERT INTO list_classes_bonus VALUES (1, 9001, 'b', 90001, 'life', 3)");
        $this->pdo->exec("INSERT INTO list_traits VALUES (90001, 9001, 'trait-1', 2, 0, 0, 0, 0, 1)");

        $read = new StoryMatchMysqlReadAdapter($this->pdo);
        $tpl = $read->findCharacterTemplateByUuid(9001, 'tpl');
        $this->assertSame(90001, (int)$tpl['id_tipo']);
        $this->assertSame(90002, (int)$tpl['id_class_prohibited']);
        $this->assertNull($read->findCharacterTemplateByUuid(9001, 'x'));
        $this->assertCount(1, $read->findCharacterTemplatesByStoryId(9001));

        $cls = $read->findClassByUuid(9001, 'cls');
        $this->assertSame(3, (int)$cls['dexterity_base']);
        $this->assertNull($read->findClassByUuid(9001, 'x'));

        $trait = $read->findTraitByUuid(9001, 'trait-1');
        $this->assertSame(2, (int)$trait['life']);
        $this->assertCount(1, $read->findTraitsByStoryId(9001));

        $bonuses = $read->findClassBonusesByStoryId(9001);
        $this->assertSame('life', $bonuses[0]['statistic']);
    }
}
