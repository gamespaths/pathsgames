package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.EventInfo;
import games.paths.core.model.match.LocationInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.EventExecutionStorePort;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.MovementStorePort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.ArrayList;
import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import java.util.Set;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/**
 * Step 29 — the {@code available} flag on the events of {@code GET /api/match/{uuid}/info}.
 *
 * <p>The verdict must be the one {@code execute-event} would give, and it must cost a single
 * query no matter how many events the location holds.</p>
 */
@DisplayName("MatchQueryService event availability (Step 29)")
class MatchQueryServiceEventAvailabilityTest {

    private static final long STORY_ID = 9001L;
    private static final long MATCH_ID = 500L;
    private static final long USER_ID = 7L;
    private static final long CHAR_ID = 1L;
    private static final long LOC = 10L;

    private MatchReadPort matchReadPort;
    private StoryReadPort storyReadPort;
    private CharacterReadPort characterReadPort;
    private EventExecutionStorePort eventStorePort;
    private MatchQueryService service;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        characterReadPort = mock(CharacterReadPort.class);
        eventStorePort = mock(EventExecutionStorePort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);
        ContentQueryPort contentQueryPort = mock(ContentQueryPort.class);
        MovementStorePort movementStorePort = mock(MovementStorePort.class);

        service = new MatchQueryService(matchReadPort, storyReadPort, userAccessPort,
                characterReadPort, contentQueryPort, movementStorePort, eventStorePort);

        when(movementStorePort.findVisitedLocationIds(MATCH_ID)).thenReturn(List.of(LOC));
        when(eventStorePort.loadCheckContext(eq(MATCH_ID), any())).thenReturn(ctx());
    }

    // ── fixtures ────────────────────────────────────────────────────────────

    private static EventCheckContext ctx() {
        return new EventCheckContext(CHAR_ID, LOC, false, false, 10, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static EventCheckContext sleepingCtx() {
        return new EventCheckContext(CHAR_ID, LOC, true, false, 10, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), new HashMap<>());
    }

    private static EventEntity event(long id, String uuid) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setUuid(uuid);
        e.setType("NORMAL");
        e.setCostEnery(0);
        e.setCoinCost(0);
        e.setIdSpecificLocation((int) LOC);
        return e;
    }

    /** Wire a match whose only character stands at {@link #LOC}, with the given events there. */
    private void wire(List<EventEntity> events) {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(MATCH_ID);
        m.setUuid("match-uuid");
        m.setIdStory(STORY_ID);
        m.setIdDifficulty(90001L);
        m.setStatus("RUNNING");
        m.setIdUserCreator(USER_ID);

        StoryEntity story = new StoryEntity();
        story.setId(STORY_ID);
        story.setIdLocationStart((int) LOC);

        LocationEntity loc = new LocationEntity();
        loc.setId(LOC);
        loc.setUuid("loc-uuid");

        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(CHAR_ID);
        c.setIdMatch(MATCH_ID);
        c.setIdUser(USER_ID);
        c.setUuid("char-uuid");
        c.setIdCharacterTemplate(90001L);
        c.setIdLocation(LOC);

        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(m));
        when(storyReadPort.findAllStories()).thenReturn(List.of(story));
        when(storyReadPort.findLocationsByStoryId(STORY_ID)).thenReturn(List.of(loc));
        when(storyReadPort.findLocationNeighborsByStoryId(STORY_ID)).thenReturn(List.of());
        when(storyReadPort.findEventsByStoryId(STORY_ID)).thenReturn(events);
        when(matchReadPort.findLocationsByMatchId(MATCH_ID)).thenReturn(List.of());
        when(matchReadPort.findRegistryByMatchId(MATCH_ID)).thenReturn(List.of());
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(c));
    }

    private List<EventInfo> events() {
        MatchDetail d = service.getMatchInfoForAdmin("match-uuid");
        assertNotNull(d);
        List<EventInfo> all = new ArrayList<>();
        for (LocationInfo li : d.getLocationsActive()) {
            all.addAll(li.getEvents());
        }
        return all;
    }

    // ── the verdict ─────────────────────────────────────────────────────────

    @Test
    @DisplayName("An executable event is reported as available with no reason")
    void available() {
        wire(List.of(event(1L, "evt-1")));

        EventInfo e = events().get(0);

        assertTrue(e.isAvailable());
        assertNull(e.getReason());
    }

    @Test
    @DisplayName("A blocked event carries the very code execute-event would return")
    void blockedCarriesTheReason() {
        EventEntity tooExpensive = event(1L, "evt-1");
        tooExpensive.setCostEnery(9999);
        wire(List.of(tooExpensive));

        EventInfo e = events().get(0);

        assertFalse(e.isAvailable());
        assertEquals("NOT_ENOUGH_ENERGY", e.getReason());
    }

    @Test
    @DisplayName("A sleeping character can trigger nothing")
    void sleepingBlocksEverything() {
        when(eventStorePort.loadCheckContext(eq(MATCH_ID), any())).thenReturn(sleepingCtx());
        wire(List.of(event(1L, "evt-1"), event(2L, "evt-2")));

        for (EventInfo e : events()) {
            assertFalse(e.isAvailable());
            assertEquals("CHARACTER_CANNOT_ACT", e.getReason());
        }
    }

    @Test
    @DisplayName("An AUTOMATIC event is listed, but never as available")
    void automaticIsNotExecutable() {
        EventEntity automatic = event(1L, "evt-1");
        automatic.setType("AUTOMATIC");
        wire(List.of(automatic));

        EventInfo e = events().get(0);

        assertFalse(e.isAvailable());
        assertEquals("EVENT_NOT_EXECUTABLE_TYPE", e.getReason());
    }

    // ── the cost of the flag ────────────────────────────────────────────────

    @Test
    @DisplayName("N events cost ONE context load — the checker never touches a port")
    void noNPlusOne() {
        List<EventEntity> many = new ArrayList<>();
        for (long i = 1; i <= 5; i++) {
            many.add(event(i, "evt-" + i));
        }
        wire(many);

        assertEquals(5, events().size());
        verify(eventStorePort, times(1)).loadCheckContext(anyLong(), any());
    }

    // ── the legacy wiring must not lie ──────────────────────────────────────

    @Test
    @DisplayName("With no event store wired, events report unavailable rather than claiming to work")
    void noEventStore() {
        MatchQueryService legacy = new MatchQueryService(matchReadPort, storyReadPort,
                mock(UserAccessPort.class), characterReadPort, mock(ContentQueryPort.class));
        wire(List.of(event(1L, "evt-1")));

        MatchDetail d = legacy.getMatchInfoForAdmin("match-uuid");

        Set<String> reasons = new HashSet<>();
        for (LocationInfo li : d.getLocationsActive()) {
            for (EventInfo e : li.getEvents()) {
                assertFalse(e.isAvailable());
                reasons.add(e.getReason());
            }
        }
        assertEquals(Set.of("CHARACTER_CANNOT_ACT"), reasons);
    }

    @Test
    @DisplayName("The context is loaded for the creator's character")
    void referenceCharacterIsTheCreator() {
        wire(List.of(event(1L, "evt-1")));

        events();

        verify(eventStorePort).loadCheckContext(MATCH_ID, CHAR_ID);
    }

    @Test
    @DisplayName("A match with no character loads a context with no character")
    void noCharacter() {
        wire(List.of(event(1L, "evt-1")));
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
        when(eventStorePort.loadCheckContext(MATCH_ID, null))
                .thenReturn(EventCheckContext.noCharacter());

        Map<String, String> byUuid = new HashMap<>();
        for (EventInfo e : events()) {
            byUuid.put(e.getUuid(), e.getReason());
        }

        // No player stands anywhere, so no location is "active" and no event is listed —
        // the point is that this does not blow up and does not fabricate an available event.
        assertTrue(byUuid.isEmpty() || "CHARACTER_CANNOT_ACT".equals(byUuid.get("evt-1")));
        verify(eventStorePort).loadCheckContext(MATCH_ID, null);
    }
}
