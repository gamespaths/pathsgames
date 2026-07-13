package games.paths.core.service.match;

import games.paths.core.port.match.MovementPort.MovementException;
import games.paths.core.port.match.MovementPort.MovementResult;
import games.paths.core.port.match.MovementPort.NeighborCost;
import games.paths.core.port.match.MovementPort.VisitedLocation;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.MovementStorePort.MatchMovementView;
import games.paths.core.port.match.MovementStorePort.MoveCharacterView;
import games.paths.core.port.match.MovementStorePort.MoveLocationView;
import games.paths.core.port.match.MovementStorePort.NeighborEdge;
import games.paths.core.port.match.MovementStorePort.WeatherMoveCost;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.match.UserAccessPort.UserView;
import games.paths.core.port.story.ContentQueryPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

@DisplayName("MovementService (Step 28)")
class MovementServiceTest {

    private static final String MATCH = "match-uuid";
    private static final String USER = "user-uuid";
    private static final long USER_ID = 100L;
    private static final long MATCH_ID = 1L;
    private static final long STORY_ID = 9001L;

    private MovementStorePort store;
    private UserAccessPort userAccessPort;
    private ContentQueryPort contentQueryPort;
    private MovementService service;

    @BeforeEach
    void setUp() {
        store = mock(MovementStorePort.class);
        userAccessPort = mock(UserAccessPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        service = new MovementService(store, userAccessPort, contentQueryPort);
        when(userAccessPort.findByUuid(USER))
                .thenReturn(Optional.of(new UserView(USER_ID, USER, "name", "GUEST", 2)));
    }

    // ── fixtures ─────────────────────────────────────────────────────────────

    private MatchMovementView match(String status) {
        return new MatchMovementView(MATCH_ID, MATCH, status, 3, STORY_ID, USER_ID);
    }

    private MoveCharacterView character(int energy, Long location) {
        return new MoveCharacterView(50L, "char-uuid", USER_ID, location,
                energy, 100, 0, 30, false, false);
    }

    private MoveLocationView location(long id, String uuid, int secureParam, int costEnter, int maxChars) {
        return new MoveLocationView(id, uuid, 10, secureParam, costEnter, maxChars);
    }

    private NeighborEdge edge(long from, long to, int energyCost) {
        return new NeighborEdge(from, to, "NORTH", energyCost, null, null, 1);
    }

    /** Wire a runnable match where the caller is at location 1 and 2 is a valid neighbor. */
    private void wireHappyPath(int energy, int edgeCost, int targetSecure, int targetEnter,
                               int weatherSafe, int weatherUnsafe, int maxChars, int countAtTarget) {
        when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                .thenReturn(Optional.of(character(energy, 1L)));
        when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                .thenReturn(Optional.of(location(2L, "loc-2", targetSecure, targetEnter, maxChars)));
        when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of(edge(1L, 2L, edgeCost)));
        when(store.findCurrentWeatherMoveCost(MATCH_ID))
                .thenReturn(new WeatherMoveCost(weatherSafe, weatherUnsafe));
        when(store.countCharactersAtLocation(MATCH_ID, 2L)).thenReturn(countAtTarget);
    }

    @Nested
    @DisplayName("startMovement")
    class StartMovement {

        @Test
        @DisplayName("moves and deducts edge + entry + weather(safe) energy")
        void happyPathSafe() {
            // edge 2 + entry 1 + weatherSafe 3 = 6; energy 10 → 4
            wireHappyPath(10, 2, /*secure*/ 1, 1, 3, 99, 100, 0);

            MovementResult r = service.startMovement(MATCH, USER, "loc-2");

            assertEquals(2L, r.toLocationId());
            assertEquals("loc-2", r.toLocationUuid());
            assertEquals(6, r.energySpent());
            assertEquals(4, r.newEnergy());
            assertEquals(1L, r.fromLocationId());
            verify(store).updateCharacterLocationAndEnergy(MATCH_ID, 50L, 2L, 4);
            verify(store).insertMovementLog(MATCH_ID, 50L, 1L, 2L, 6);
        }

        @Test
        @DisplayName("uses unsafe weather modifier when target is unsafe")
        void unsafeWeather() {
            // edge 1 + entry 0 + weatherUnsafe 5 = 6
            wireHappyPath(20, 1, /*secure*/ 0, 0, 1, 5, 100, 0);
            MovementResult r = service.startMovement(MATCH, USER, "loc-2");
            assertEquals(6, r.energySpent());
            assertEquals(14, r.newEnergy());
        }

        @Test
        @DisplayName("unknown user is masked as MATCH_NOT_FOUND")
        void unknownUser() {
            when(userAccessPort.findByUuid("ghost")).thenReturn(Optional.empty());
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, "ghost", "loc-2"));
            assertEquals(MovementException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("missing match → MATCH_NOT_FOUND")
        void missingMatch() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.empty());
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("caller without a character → MATCH_NOT_FOUND")
        void notParticipant() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("match not RUNNING → MATCH_NOT_RUNNING")
        void notRunning() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("CREATED")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.MATCH_NOT_RUNNING, ex.getCode());
        }

        @Test
        @DisplayName("sleeping character → CHARACTER_CANNOT_ACT")
        void sleeping() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(new MoveCharacterView(
                            50L, "c", USER_ID, 1L, 10, 100, 0, 30, true, false)));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.CHARACTER_CANNOT_ACT, ex.getCode());
        }

        @Test
        @DisplayName("character with no location → NOT_A_NEIGHBOR")
        void noLocation() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, null)));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.NOT_A_NEIGHBOR, ex.getCode());
        }

        @Test
        @DisplayName("unknown target location → NOT_A_NEIGHBOR")
        void unknownTarget() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-x")).thenReturn(Optional.empty());
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-x"));
            assertEquals(MovementException.Code.NOT_A_NEIGHBOR, ex.getCode());
        }

        @Test
        @DisplayName("target not adjacent → NOT_A_NEIGHBOR")
        void notAdjacent() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L))
                    .thenReturn(List.of(edge(1L, 3L, 1))); // only 1↔3
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.NOT_A_NEIGHBOR, ex.getCode());
        }

        @Test
        @DisplayName("one-way link (flagBack=0): backward move A←B blocked → NOT_A_NEIGHBOR")
        void oneWayBackwardBlocked() {
            // Edge A(1)→B(2) with flagBack=0. Caller stands on B(2), tries to move to A(1).
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 2L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-1"))
                    .thenReturn(Optional.of(location(1L, "loc-1", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 2L))
                    .thenReturn(List.of(new NeighborEdge(1L, 2L, "N", 1, null, null, 0)));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-1"));
            assertEquals(MovementException.Code.NOT_A_NEIGHBOR, ex.getCode());
        }

        @Test
        @DisplayName("one-way link (flagBack=0): forward move A→B still allowed")
        void oneWayForwardAllowed() {
            // Edge A(1)→B(2) with flagBack=0. Caller stands on A(1), moves forward to B(2).
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L))
                    .thenReturn(List.of(new NeighborEdge(1L, 2L, "N", 1, null, null, 0)));
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.countCharactersAtLocation(MATCH_ID, 2L)).thenReturn(0);
            MovementResult r = service.startMovement(MATCH, USER, "loc-2");
            assertEquals(2L, r.toLocationId());
        }

        @Test
        @DisplayName("registry condition unmet → MOVEMENT_CONDITION_NOT_MET")
        void conditionUnmet() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L))
                    .thenReturn(List.of(new NeighborEdge(1L, 2L, "N", 1, "DOOR", "OPEN", 1)));
            when(store.findRegistryValue(MATCH_ID, "DOOR")).thenReturn(Optional.of("CLOSED"));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.MOVEMENT_CONDITION_NOT_MET, ex.getCode());
        }

        @Test
        @DisplayName("registry condition met → moves")
        void conditionMet() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L))
                    .thenReturn(List.of(new NeighborEdge(1L, 2L, "N", 1, "DOOR", "OPEN", 1)));
            when(store.findRegistryValue(MATCH_ID, "DOOR")).thenReturn(Optional.of("OPEN"));
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.countCharactersAtLocation(MATCH_ID, 2L)).thenReturn(0);
            MovementResult r = service.startMovement(MATCH, USER, "loc-2");
            assertEquals(1, r.energySpent());
        }

        @Test
        @DisplayName("overweight → OVERWEIGHT")
        void overweight() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(new MoveCharacterView(
                            50L, "c", USER_ID, 1L, 10, 100, /*weight*/ 40, /*weightMax*/ 30, false, false)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of(edge(1L, 2L, 1)));
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.OVERWEIGHT, ex.getCode());
        }

        @Test
        @DisplayName("insufficient energy → INSUFFICIENT_ENERGY")
        void insufficientEnergy() {
            wireHappyPath(2, 2, 1, 1, 3, 99, 100, 0); // cost 6 > energy 2
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.INSUFFICIENT_ENERGY, ex.getCode());
            verify(store, never()).updateCharacterLocationAndEnergy(anyLong(), anyLong(), anyLong(), anyInt());
        }

        @Test
        @DisplayName("target at capacity → LOCATION_FULL")
        void locationFull() {
            wireHappyPath(20, 1, 1, 0, 0, 0, /*maxChars*/ 2, /*count*/ 2);
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.startMovement(MATCH, USER, "loc-2"));
            assertEquals(MovementException.Code.LOCATION_FULL, ex.getCode());
        }

        @Test
        @DisplayName("maxCharacters 0 means unlimited capacity")
        void unlimitedCapacity() {
            wireHappyPath(20, 1, 1, 0, 0, 0, /*maxChars*/ 0, /*count*/ 99);
            MovementResult r = service.startMovement(MATCH, USER, "loc-2");
            assertEquals(2L, r.toLocationId());
        }

        @Test
        @DisplayName("null weather cost defaults to 0")
        void nullWeather() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(character(10, 1L)));
            when(store.findLocationByStoryAndUuid(STORY_ID, "loc-2"))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 1, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of(edge(1L, 2L, 1)));
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(null);
            when(store.countCharactersAtLocation(MATCH_ID, 2L)).thenReturn(0);
            MovementResult r = service.startMovement(MATCH, USER, "loc-2");
            assertEquals(2, r.energySpent()); // edge 1 + entry 1 + weather 0
        }
    }

    @Nested
    @DisplayName("listLocations")
    class ListLocations {

        @Test
        @DisplayName("returns visited locations with counts and neighbor total cost")
        void buildsPayload() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(1L));
            when(store.findCharactersByMatchId(MATCH_ID))
                    .thenReturn(List.of(character(10, 1L)));
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(2, 5));
            when(store.findLocationByStoryAndId(STORY_ID, 1L))
                    .thenReturn(Optional.of(location(1L, "loc-1", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of(edge(1L, 2L, 3)));
            when(store.findLocationByStoryAndId(STORY_ID, 2L))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 1, 100))); // safe → +2

            List<VisitedLocation> result = service.listLocations(MATCH, USER, null);

            assertEquals(1, result.size());
            VisitedLocation loc = result.get(0);
            assertEquals(1, loc.characterCount());
            assertTrue(loc.safe());
            assertEquals(1, loc.neighbors().size());
            // edge 3 + entry 1 + weatherSafe 2 = 6
            // breakdown: edge 3 + entry 1 + weatherSafe 2 = 6
            assertEquals(3, loc.neighbors().get(0).baseEnergyCost());
            assertEquals(1, loc.neighbors().get(0).entryEnergyCost());
            assertEquals(2, loc.neighbors().get(0).weatherEnergyCost());
            assertEquals(6, loc.neighbors().get(0).totalEnergyCost());
            assertEquals("loc-2", loc.neighbors().get(0).uuid());
        }

        @Test
        @DisplayName("resolves the location card and the neighbor's LOCATION card (visited)")
        void resolvesCards() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            // both 1 and 2 visited → the neighbor's location card is exposed
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(1L, 2L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 1L))
                    .thenReturn(Optional.of(new MoveLocationView(1L, "loc-1", 10, 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of(edge(1L, 2L, 0)));
            when(store.findLocationByStoryAndId(STORY_ID, 2L))
                    .thenReturn(Optional.of(new MoveLocationView(2L, "loc-2", 20, 1, 0, 100)));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 10, "en"))
                    .thenReturn(card("start"));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 20, "en"))
                    .thenReturn(card("center"));

            VisitedLocation loc = service.listLocations(MATCH, USER, null).get(0);

            assertEquals("card-start", loc.card().uuid());
            assertEquals("start", loc.card().title());
            assertEquals(20, loc.neighbors().get(0).idCard());
            assertEquals("card-center", loc.neighbors().get(0).card().uuid());
        }

        @Test
        @DisplayName("fog of war: a never-visited neighbor exposes no card (idCard + card null)")
        void hidesUnvisitedNeighborCard() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            // only 1 visited; neighbor 2 was never visited → its card must be hidden
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(1L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 1L))
                    .thenReturn(Optional.of(new MoveLocationView(1L, "loc-1", 10, 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of(edge(1L, 2L, 0)));
            when(store.findLocationByStoryAndId(STORY_ID, 2L))
                    .thenReturn(Optional.of(new MoveLocationView(2L, "loc-2", 20, 1, 0, 100)));
            when(contentQueryPort.getCardByStoryIdAndCardId(STORY_ID, 10, "en"))
                    .thenReturn(card("start"));

            VisitedLocation loc = service.listLocations(MATCH, USER, null).get(0);

            NeighborCost nb = loc.neighbors().get(0);
            assertNull(nb.idCard());
            assertNull(nb.card());
            // the visited location itself still exposes its card
            assertEquals("card-start", loc.card().uuid());
            // the hidden neighbor card is never resolved
            verify(contentQueryPort, never()).getCardByStoryIdAndCardId(STORY_ID, 20, "en");
        }

        @Test
        @DisplayName("lang parameter is forwarded to the card resolution")
        void langForwarded() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(1L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 1L))
                    .thenReturn(Optional.of(new MoveLocationView(1L, "loc-1", 10, 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of());

            service.listLocations(MATCH, USER, "it");

            verify(contentQueryPort).getCardByStoryIdAndCardId(STORY_ID, 10, "it");
        }

        @Test
        @DisplayName("null idCard → null card, resolver never called")
        void nullIdCard() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(1L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 1L))
                    .thenReturn(Optional.of(new MoveLocationView(1L, "loc-1", null, 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of());

            VisitedLocation loc = service.listLocations(MATCH, USER, null).get(0);

            assertNull(loc.card());
            verify(contentQueryPort, never()).getCardByStoryIdAndCardId(anyLong(), anyInt(), anyString());
        }

        @Test
        @DisplayName("legacy 2-arg constructor (no content port) → null cards")
        void legacyConstructorNullCards() {
            MovementService legacy = new MovementService(store, userAccessPort);
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(1L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 1L))
                    .thenReturn(Optional.of(new MoveLocationView(1L, "loc-1", 10, 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 1L)).thenReturn(List.of());

            assertNull(legacy.listLocations(MATCH, USER, null).get(0).card());
        }

        private CardInfo card(String title) {
            return new CardInfo("card-" + title, "location", null, null, "fa-x",
                    null, null, null, null, null, title, "desc-" + title, null, null, null);
        }

        @Test
        @DisplayName("one-way link (flagBack=0) is hidden when standing on the destination")
        void oneWayBackwardHidden() {
            // Edge A(1)→B(2), flagBack=0. Standing on B(2) → A must NOT be a neighbor.
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(2L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(character(10, 2L)));
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 2L))
                    .thenReturn(Optional.of(location(2L, "loc-2", 1, 0, 100)));
            when(store.findNeighborsOfLocation(STORY_ID, 2L))
                    .thenReturn(List.of(new NeighborEdge(1L, 2L, "N", 1, null, null, 0)));

            List<VisitedLocation> result = service.listLocations(MATCH, USER, null);

            assertEquals(1, result.size());
            assertTrue(result.get(0).neighbors().isEmpty());
        }

        @Test
        @DisplayName("skips visited ids with no matching location")
        void skipsMissingLocation() {
            when(store.findMatchByUuid(MATCH)).thenReturn(Optional.of(match("RUNNING")));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(7L));
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            when(store.findLocationByStoryAndId(STORY_ID, 7L)).thenReturn(Optional.empty());
            assertTrue(service.listLocations(MATCH, USER, null).isEmpty());
        }

        @Test
        @DisplayName("non-owner player → MATCH_NOT_FOUND")
        void nonOwner() {
            when(store.findMatchByUuid(MATCH))
                    .thenReturn(Optional.of(new MatchMovementView(MATCH_ID, MATCH, "RUNNING", 0, STORY_ID, 999L)));
            MovementException ex = assertThrows(MovementException.class,
                    () -> service.listLocations(MATCH, USER, null));
            assertEquals(MovementException.Code.MATCH_NOT_FOUND, ex.getCode());
        }

        @Test
        @DisplayName("admin variant skips ownership check")
        void adminVariant() {
            when(store.findMatchByUuid(MATCH))
                    .thenReturn(Optional.of(new MatchMovementView(MATCH_ID, MATCH, "RUNNING", 0, STORY_ID, 999L)));
            when(store.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of());
            when(store.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
            when(store.findCurrentWeatherMoveCost(MATCH_ID)).thenReturn(new WeatherMoveCost(0, 0));
            assertTrue(service.listLocationsForAdmin(MATCH, null).isEmpty());
        }

        @Test
        @DisplayName("admin variant on missing match → MATCH_NOT_FOUND")
        void adminMissing() {
            when(store.findMatchByUuid("missing")).thenReturn(Optional.empty());
            assertThrows(MovementException.class, () -> service.listLocationsForAdmin("missing", null));
        }
    }

    @Test
    @DisplayName("totalEnergyCost helper picks safe vs unsafe modifier")
    void helperCost() {
        // safe: secureParam=2 (>0), costEnergyEnter=1 → edge 2 + enter 1 + weatherSafe 1 = 4
        MoveLocationView safe = new MoveLocationView(1, "u", 1, 2, 1, 100);
        // unsafe: secureParam=0, costEnergyEnter=0 → edge 2 + enter 0 + weatherUnsafe 9 = 11
        MoveLocationView unsafe = new MoveLocationView(1, "u", 2, 0, 0, 100);
        assertEquals(2 + 1 + 1, MovementService.totalEnergyCost(2, safe, new WeatherMoveCost(1, 9)));
        assertEquals(2 + 0 + 9, MovementService.totalEnergyCost(2, unsafe, new WeatherMoveCost(1, 9)));
    }
}
