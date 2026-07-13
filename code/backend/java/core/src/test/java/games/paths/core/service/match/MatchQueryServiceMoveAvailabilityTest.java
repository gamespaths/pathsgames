package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.match.GamingStateRegistryEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.LocationNeighborEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.LocationInfo;
import games.paths.core.model.match.LocationNeighborInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.MovementStorePort.MoveCharacterView;
import games.paths.core.port.match.MovementStorePort.WeatherMoveCost;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertFalse;
import static org.junit.jupiter.api.Assertions.assertNotNull;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertTrue;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/**
 * Every neighbor of {@code /api/match/{uuid}/info} carries the verdict that
 * {@code action/move} would give it — the twin of {@link MatchQueryServiceEventAvailabilityTest}
 * for movement. The reason a path is closed (coma, sleep, energy, a registry key, a full
 * destination) travels with the path, so the board never has to guess.
 */
@DisplayName("MatchQueryService neighbor availability")
class MatchQueryServiceMoveAvailabilityTest {

    private static final long STORY_ID = 9001L;
    private static final long MATCH_ID = 500L;
    private static final long USER_ID = 7L;
    private static final long CHAR_ID = 1L;
    private static final long HERE = 10L;
    private static final long THERE = 11L;

    private MatchReadPort matchReadPort;
    private StoryReadPort storyReadPort;
    private CharacterReadPort characterReadPort;
    private MovementStorePort movementStorePort;
    private MatchQueryService service;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        characterReadPort = mock(CharacterReadPort.class);
        movementStorePort = mock(MovementStorePort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);

        service = new MatchQueryService(matchReadPort, storyReadPort, userAccessPort,
                characterReadPort, null, movementStorePort);
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    /** An awake mover with 100 energy, carrying nothing. */
    private static MoveCharacterView mover(boolean coma, boolean sleeping, int energy) {
        return new MoveCharacterView(CHAR_ID, "char-uuid", USER_ID, HERE,
                energy, 100, 0, 50, sleeping, coma);
    }

    private static LocationEntity location(long id, String uuid) {
        LocationEntity l = new LocationEntity();
        l.setId(id);
        l.setUuid(uuid);
        l.setCostEnergyEnter(0);
        l.setSecureParam(0);
        l.setMaxCharacters(0);
        return l;
    }

    private static LocationNeighborEntity edge() {
        LocationNeighborEntity n = new LocationNeighborEntity();
        n.setIdLocationFrom((int) HERE);
        n.setIdLocationTo((int) THERE);
        n.setDirection("NORTH");
        n.setFlagBack(1);
        n.setEnergyCost(5);
        return n;
    }

    /** Wire a RUNNING match: one character at HERE, one edge HERE→THERE. */
    private void wire(MoveCharacterView caller, LocationEntity there, LocationNeighborEntity n,
                      List<GamingStateRegistryEntity> registry) {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(MATCH_ID);
        m.setUuid("match-uuid");
        m.setIdStory(STORY_ID);
        m.setIdDifficulty(90001L);
        m.setStatus("RUNNING");
        m.setIdUserCreator(USER_ID);

        StoryEntity story = new StoryEntity();
        story.setId(STORY_ID);
        story.setIdLocationStart((int) HERE);

        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(CHAR_ID);
        c.setIdMatch(MATCH_ID);
        c.setIdUser(USER_ID);
        c.setUuid("char-uuid");
        c.setIdCharacterTemplate(90001L);
        c.setIdLocation(HERE);

        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(m));
        when(storyReadPort.findAllStories()).thenReturn(List.of(story));
        when(storyReadPort.findLocationsByStoryId(STORY_ID))
                .thenReturn(List.of(location(HERE, "loc-here"), there));
        when(storyReadPort.findLocationNeighborsByStoryId(STORY_ID)).thenReturn(List.of(n));
        when(storyReadPort.findEventsByStoryId(STORY_ID)).thenReturn(List.of());
        when(matchReadPort.findLocationsByMatchId(MATCH_ID)).thenReturn(List.of());
        when(matchReadPort.findRegistryByMatchId(MATCH_ID)).thenReturn(registry);
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(c));

        when(movementStorePort.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(HERE, THERE));
        when(movementStorePort.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                .thenReturn(Optional.of(caller));
        when(movementStorePort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(caller));
        when(movementStorePort.findCurrentWeatherMoveCost(MATCH_ID))
                .thenReturn(new WeatherMoveCost(0, 0));
    }

    private void wire(MoveCharacterView caller) {
        wire(caller, location(THERE, "loc-there"), edge(), List.of());
    }

    private LocationNeighborInfo neighbor() {
        MatchDetail d = service.getMatchInfoForAdmin("match-uuid");
        assertNotNull(d);
        List<LocationNeighborInfo> all = new ArrayList<>();
        for (LocationInfo li : d.getLocationsActive()) {
            all.addAll(li.getNeighbors());
        }
        assertEquals(1, all.size());
        return all.get(0);
    }

    // ── the verdict ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("A walkable path is available, with no reason")
    void available() {
        wire(mover(false, false, 100));

        LocationNeighborInfo n = neighbor();

        assertTrue(n.isAvailable());
        assertNull(n.getReason());
    }

    @Test
    @DisplayName("A comatose character cannot take any path")
    void coma() {
        wire(mover(true, false, 100));

        assertFalse(neighbor().isAvailable());
        assertEquals("COMA", neighbor().getReason());
    }

    @Test
    @DisplayName("A sleeping character cannot take any path")
    void sleeping() {
        wire(mover(false, true, 100));

        assertEquals("SLEEPING", neighbor().getReason());
    }

    @Test
    @DisplayName("Energy below edge + entry + weather → INSUFFICIENT_ENERGY")
    void insufficientEnergy() {
        LocationEntity there = location(THERE, "loc-there");
        there.setCostEnergyEnter(10);           // + edge 5 = 15 needed
        wire(mover(false, false, 14), there, edge(), List.of());

        assertEquals("INSUFFICIENT_ENERGY", neighbor().getReason());

        // one more energy point and the same path opens
        wire(mover(false, false, 15), there, edge(), List.of());
        assertTrue(neighbor().isAvailable());
    }

    @Test
    @DisplayName("An unmet registry condition closes the path")
    void conditionNotMet() {
        LocationNeighborEntity gated = edge();
        gated.setConditionRegistryKey("gate");
        gated.setConditionRegistryValue("open");

        wire(mover(false, false, 100), location(THERE, "loc-there"), gated, List.of());
        assertEquals("MOVEMENT_CONDITION_NOT_MET", neighbor().getReason());

        // ...and the same key, set to the expected value in the match registry, opens it
        wire(mover(false, false, 100), location(THERE, "loc-there"), gated,
                List.of(registryRow("gate", "open")));
        assertTrue(neighbor().isAvailable());
    }

    @Test
    @DisplayName("A destination at capacity → LOCATION_FULL")
    void locationFull() {
        LocationEntity there = location(THERE, "loc-there");
        there.setMaxCharacters(1);
        MoveCharacterView squatter = new MoveCharacterView(2L, "other-uuid", 8L, THERE,
                100, 100, 0, 50, false, false);

        wire(mover(false, false, 100), there, edge(), List.of());
        when(movementStorePort.findCharactersByMatchId(MATCH_ID))
                .thenReturn(List.of(mover(false, false, 100), squatter));

        assertEquals("LOCATION_FULL", neighbor().getReason());
    }

    @Test
    @DisplayName("No character in the match → every path reads CHARACTER_CANNOT_ACT, never a silent yes")
    void noCharacter() {
        wire(mover(false, false, 100));
        when(movementStorePort.findCharacterByMatchAndUser(MATCH_ID, USER_ID))
                .thenReturn(Optional.empty());

        assertFalse(neighbor().isAvailable());
        assertEquals("CHARACTER_CANNOT_ACT", neighbor().getReason());
    }

    private static GamingStateRegistryEntity registryRow(String key, String value) {
        GamingStateRegistryEntity r = new GamingStateRegistryEntity();
        r.setId(1L);
        r.setIdMatch(MATCH_ID);
        r.setUuid("reg-uuid");
        r.setKey(key);
        r.setStringValue(value);
        return r;
    }
}
