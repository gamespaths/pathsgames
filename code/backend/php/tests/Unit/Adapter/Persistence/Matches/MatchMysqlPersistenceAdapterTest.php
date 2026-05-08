<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Unit\Adapter\Persistence\Matches;

use Games\Paths\Adapter\Persistence\Matches\MatchMysqlPersistenceAdapter;
use Games\Paths\Adapter\Persistence\Matches\StoryMatchMysqlReadAdapter;
use Games\Paths\Adapter\Persistence\Matches\UserAccessMysqlAdapter;
use PDO;
use PHPUnit\Framework\TestCase;

class MatchMysqlPersistenceAdapterTest extends TestCase
{
    private PDO $pdo;

    protected function setUp(): void
    {
        $this->pdo = new PDO('sqlite::memory:');
        $this->pdo->setAttribute(PDO::ATTR_ERRMODE, PDO::ERRMODE_EXCEPTION);
        $this->pdo->setAttribute(PDO::ATTR_DEFAULT_FETCH_MODE, PDO::FETCH_ASSOC);
        $this->pdo->exec(
            'CREATE TABLE gaming_match (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT NOT NULL UNIQUE,
                id_story INTEGER NOT NULL,
                id_difficulty INTEGER NOT NULL,
                id_user_creator INTEGER NOT NULL,
                name TEXT,
                exp_cost INTEGER NOT NULL DEFAULT 5,
                status TEXT NOT NULL DEFAULT "CREATED",
                current_clock INTEGER NOT NULL DEFAULT 0,
                secure_location_param INTEGER DEFAULT 0,
                counter_consecutive_pass INTEGER NOT NULL DEFAULT 0,
                ts_insert TEXT NOT NULL,
                ts_update TEXT NOT NULL
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE gaming_state_locations (
                id_match INTEGER NOT NULL,
                id_location INTEGER NOT NULL,
                uuid TEXT NOT NULL UNIQUE,
                flag_already_actived INTEGER NOT NULL DEFAULT 0,
                clock_counter INTEGER DEFAULT 0,
                ts_insert TEXT NOT NULL,
                ts_update TEXT NOT NULL,
                PRIMARY KEY (id_match, id_location)
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE gaming_state_registry (
                id INTEGER NOT NULL,
                id_match INTEGER NOT NULL,
                uuid TEXT NOT NULL UNIQUE,
                key TEXT NOT NULL,
                string_value TEXT,
                int_value INTEGER,
                ts_insert TEXT NOT NULL,
                ts_update TEXT NOT NULL,
                PRIMARY KEY (id, id_match)
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE list_stories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT,
                id_location_start INTEGER,
                category TEXT,
                visibility TEXT
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE list_stories_difficulty (
                id INTEGER,
                id_story INTEGER,
                uuid TEXT,
                exp_cost INTEGER,
                max_weight INTEGER,
                min_character INTEGER,
                max_character INTEGER,
                PRIMARY KEY (id, id_story)
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE list_locations (
                id INTEGER,
                id_story INTEGER,
                uuid TEXT,
                counter_start INTEGER,
                PRIMARY KEY (id, id_story)
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE list_keys (
                id INTEGER,
                id_story INTEGER,
                uuid TEXT,
                key_name TEXT,
                key_value TEXT,
                PRIMARY KEY (id, id_story)
            )'
        );
        $this->pdo->exec(
            'CREATE TABLE gaming_user_sessions (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                uuid TEXT,
                username TEXT,
                role TEXT,
                state INTEGER
            )'
        );
    }

    public function testSaveMatchAndFind(): void
    {
        $adapter = new MatchMysqlPersistenceAdapter($this->pdo);
        $saved = $adapter->saveMatch([
            'id_story' => 1, 'id_difficulty' => 2, 'id_user_creator' => 3,
            'name' => 'n', 'exp_cost' => 5, 'current_clock' => 0,
        ]);
        $this->assertNotEmpty($saved['uuid']);
        $this->assertSame(1, (int)$saved['id']);

        $found = $adapter->findMatchByUuid($saved['uuid']);
        $this->assertSame((int)$saved['id'], (int)$found['id']);
        $this->assertNull($adapter->findMatchByUuid('missing'));
    }

    public function testFindMatchesByUserId(): void
    {
        $adapter = new MatchMysqlPersistenceAdapter($this->pdo);
        $adapter->saveMatch(['id_story' => 1, 'id_difficulty' => 2, 'id_user_creator' => 7]);
        $adapter->saveMatch(['id_story' => 1, 'id_difficulty' => 2, 'id_user_creator' => 9]);
        $this->assertCount(1, $adapter->findMatchesByUserId(7));
        $this->assertSame([], $adapter->findMatchesByUserId(404));
    }

    public function testSaveLocationsRegistryNoOpsOnEmpty(): void
    {
        $adapter = new MatchMysqlPersistenceAdapter($this->pdo);
        $adapter->saveLocations([]);
        $adapter->saveRegistry([]);
        $this->assertSame([], $adapter->findLocationsByMatchId(99));
        $this->assertSame([], $adapter->findRegistryByMatchId(99));
    }

    public function testSaveLocationsAndRegistry(): void
    {
        $adapter = new MatchMysqlPersistenceAdapter($this->pdo);
        $saved = $adapter->saveMatch(['id_story' => 1, 'id_difficulty' => 2, 'id_user_creator' => 3]);
        $matchId = (int)$saved['id'];
        $adapter->saveLocations([
            ['id_match' => $matchId, 'id_location' => 10, 'flag_already_actived' => 0, 'clock_counter' => 5],
        ]);
        $adapter->saveRegistry([
            ['id' => 1, 'id_match' => $matchId, 'key' => 'k', 'string_value' => 'v', 'int_value' => null],
        ]);
        $locs = $adapter->findLocationsByMatchId($matchId);
        $this->assertCount(1, $locs);
        $this->assertSame(10, (int)$locs[0]['id_location']);
        $regs = $adapter->findRegistryByMatchId($matchId);
        $this->assertCount(1, $regs);
        $this->assertSame('v', $regs[0]['string_value']);
    }

    public function testStoryReadAdapter(): void
    {
        $this->pdo->exec("INSERT INTO list_stories (uuid, id_location_start) VALUES ('s', 10)");
        $storyId = (int)$this->pdo->lastInsertId();
        $this->pdo->exec("INSERT INTO list_stories_difficulty (id, id_story, uuid, exp_cost, max_weight, min_character, max_character) VALUES (1, $storyId, 'd', 5, 10, 1, 4)");
        $this->pdo->exec("INSERT INTO list_locations (id, id_story, uuid, counter_start) VALUES (10, $storyId, 'lu', 3)");
        $this->pdo->exec("INSERT INTO list_keys (id, id_story, uuid, key_name, key_value) VALUES (20, $storyId, 'ku', 'k', '1')");

        $read = new StoryMatchMysqlReadAdapter($this->pdo);
        $story = $read->findStoryByUuid('s');
        $this->assertSame($storyId, (int)$story['id']);
        $this->assertNull($read->findStoryByUuid('missing'));
        $this->assertSame($storyId, (int)$read->findStoryById($storyId)['id']);
        $this->assertNull($read->findStoryById(404));

        $diff = $read->findDifficultyByUuid($storyId, 'd');
        $this->assertSame(5, (int)$diff['exp_cost']);
        $this->assertNull($read->findDifficultyByUuid($storyId, 'x'));
        $this->assertSame('d', $read->findDifficultyById($storyId, 1)['uuid']);
        $this->assertNull($read->findDifficultyById($storyId, 99));

        $this->assertSame(3, (int)$read->findLocationsByStoryId($storyId)[0]['counter_start']);
        $this->assertSame('1', $read->findKeysByStoryId($storyId)[0]['key_value']);
    }

    public function testUserAccessAdapter(): void
    {
        $adapter = new UserAccessMysqlAdapter($this->pdo);
        $this->assertNull($adapter->findByUuid(''));
        $this->assertNull($adapter->findByUuid('missing'));
        $this->pdo->exec("INSERT INTO gaming_user_sessions (uuid, username, role, state) VALUES ('u', 'alice', 'PLAYER', 2)");
        $user = $adapter->findByUuid('u');
        $this->assertSame('alice', $user['username']);
        $this->assertSame(2, $user['state']);
    }
}
