<?php

declare(strict_types=1);

namespace Games\Paths\Tests\Integration;

use Games\Paths\Adapter\Auth\Persistence\Mysql\GuestMysqlRepository;
use Games\Paths\Adapter\Persistence\Matches\MatchMysqlPersistenceAdapter;
use Games\Paths\Core\Domain\Auth\GuestSession;
use Games\Paths\Core\Service\Dev\TestDataCleanupService;

/**
 * Safety tests for the dev-only test-data cleanup.
 *
 * They exercise the real repositories against the integration SQLite database
 * and assert the cleanup removes ONLY the robot-test rows (marker "robottest")
 * and never the real ("good") data, even when both kinds are present together.
 */
class TestDataCleanupIntegrationTest extends DatabaseIntegrationTestCase
{
    private GuestMysqlRepository $guestRepo;
    private MatchMysqlPersistenceAdapter $matchRepo;
    private TestDataCleanupService $service;

    protected function setUp(): void
    {
        parent::setUp();
        $this->guestRepo = new GuestMysqlRepository($this->getPdo());
        $this->matchRepo = new MatchMysqlPersistenceAdapter($this->getPdo());
        $this->service = new TestDataCleanupService($this->guestRepo, $this->matchRepo);
    }

    private function makeGuest(string $uuid, string $username): GuestSession
    {
        return new GuestSession(
            $uuid,
            $username,
            'ck-' . $uuid,
            new \DateTimeImmutable(),
            new \DateTimeImmutable('+10 days'),
            'PLAYER',
            6
        );
    }

    public function testCleanupGuestsPreservesRealGuests(): void
    {
        $this->guestRepo->save($this->makeGuest('real-1', 'guest_real0001'));
        $this->guestRepo->save($this->makeGuest('real-2', 'guest_real0002'));
        $this->guestRepo->save($this->makeGuest('rob-1', 'robottest_aaaa1111'));
        $this->guestRepo->save($this->makeGuest('rob-2', 'robottest_bbbb2222'));

        $deleted = $this->guestRepo->deleteGuestsByUsernameLike('robottest%');

        $this->assertSame(2, $deleted);
        $remaining = array_map(static fn($g) => $g->getUsername(), $this->guestRepo->findAll());
        sort($remaining);
        $this->assertSame(['guest_real0001', 'guest_real0002'], $remaining);
    }

    public function testCleanupMatchesPreservesRealMatchesAndChildren(): void
    {
        $real = $this->matchRepo->saveMatch(
            ['id_story' => 1, 'id_difficulty' => 1, 'id_user_creator' => 1, 'name' => 'My epic adventure']
        );
        $robot = $this->matchRepo->saveMatch(
            ['id_story' => 1, 'id_difficulty' => 1, 'id_user_creator' => 1, 'name' => 'robottest_match']
        );
        $this->matchRepo->saveLocations([['id_match' => (int)$robot['id'], 'id_location' => 1]]);
        $this->matchRepo->saveRegistry([['id' => 1, 'id_match' => (int)$robot['id'], 'key' => 'k']]);
        $this->matchRepo->saveLocations([['id_match' => (int)$real['id'], 'id_location' => 2]]);

        $deleted = $this->matchRepo->deleteMatchesByNameLike('robottest%');

        $this->assertSame(1, $deleted);
        $this->assertSame(['My epic adventure'], array_column($this->matchRepo->findAllMatches(), 'name'));
        $this->assertCount(0, $this->matchRepo->findLocationsByMatchId((int)$robot['id']));
        $this->assertCount(0, $this->matchRepo->findRegistryByMatchId((int)$robot['id']));
        // the real match keeps its own child rows untouched
        $this->assertCount(1, $this->matchRepo->findLocationsByMatchId((int)$real['id']));
    }

    public function testCleanupServiceEndToEndPreservesGoodData(): void
    {
        $this->guestRepo->save($this->makeGuest('real-1', 'guest_real0001'));
        $this->guestRepo->save($this->makeGuest('rob-1', 'robottest_aaaa1111'));
        $this->matchRepo->saveMatch(
            ['id_story' => 1, 'id_difficulty' => 1, 'id_user_creator' => 1, 'name' => 'Real match']
        );
        $this->matchRepo->saveMatch(
            ['id_story' => 1, 'id_difficulty' => 1, 'id_user_creator' => 1, 'name' => 'robottest_match']
        );

        $result = $this->service->cleanupTestData();

        $this->assertSame(1, $result->deletedGuests);
        $this->assertSame(1, $result->deletedMatches);
        $this->assertSame(
            ['guest_real0001'],
            array_map(static fn($g) => $g->getUsername(), $this->guestRepo->findAll())
        );
        $this->assertSame(['Real match'], array_column($this->matchRepo->findAllMatches(), 'name'));
    }
}
