package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.LocationNeighborEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.LocationInfo;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.*;

/**
 * Step 27.x — covers the {@code locationsActive} enrichment of
 * {@link MatchQueryService}: a location occupied by a player is returned with
 * its card, its neighbor locations (both directions) and its events, and the
 * current location reflects the player's position rather than the story start.
 */
class MatchQueryServiceLocationsActiveTest {

    private static final long STORY_ID = 9001L;
    private static final long MATCH_ID = 500L;

    private MatchReadPort matchReadPort;
    private StoryReadPort storyReadPort;
    private UserAccessPort userAccessPort;
    private CharacterReadPort characterReadPort;
    private ContentQueryPort contentQueryPort;
    private MatchQueryService service;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        userAccessPort = mock(UserAccessPort.class);
        characterReadPort = mock(CharacterReadPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        service = new MatchQueryService(matchReadPort, storyReadPort, userAccessPort,
                characterReadPort, contentQueryPort);
    }

    private GamingMatchEntity match() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(MATCH_ID);
        m.setUuid("match-uuid");
        m.setIdStory(STORY_ID);
        m.setIdDifficulty(90001L);
        m.setStatus("RUNNING");
        m.setIdUserCreator(7L);
        return m;
    }

    private LocationEntity location(Long id, String uuid, Integer idCard) {
        LocationEntity l = new LocationEntity();
        l.setId(id);
        l.setUuid(uuid);
        l.setIdCard(idCard);
        return l;
    }

    private LocationNeighborEntity neighbor(int from, int to, String dir, Integer idCard) {
        LocationNeighborEntity n = new LocationNeighborEntity();
        n.setIdLocationFrom(from);
        n.setIdLocationTo(to);
        n.setDirection(dir);
        n.setFlagBack(0);
        n.setEnergyCost(2);
        n.setIdCard(idCard);
        return n;
    }

    private EventEntity event(Long id, String uuid, Integer idLocation, Integer idCard) {
        EventEntity e = new EventEntity();
        e.setId(id);
        e.setUuid(uuid);
        e.setType("NORMAL");
        e.setIdSpecificLocation(idLocation);
        e.setIdCard(idCard);
        return e;
    }

    private CardInfo card(String title) {
        return new CardInfo("card-" + title, "location", null, null, "fa-x",
                null, null, null, null, null, title, "desc-" + title, null, null, null);
    }

    private GamingCharacterInstanceEntity playerAt(long locId) {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(1L);
        c.setIdMatch(MATCH_ID);
        c.setIdUser(7L);
        c.setUuid("char-uuid");
        c.setIdCharacterTemplate(90001L);
        c.setIdLocation(locId);
        return c;
    }

    private void wire(long playerLocation) {
        StoryEntity story = new StoryEntity();
        story.setId(STORY_ID);
        story.setIdLocationStart(11); // start differs from the player's location
        story.setIdEventEndGame(1);   // evt-1 (id 1) is the end-game event

        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
        when(storyReadPort.findAllStories()).thenReturn(List.of(story));
        when(storyReadPort.findLocationsByStoryId(STORY_ID)).thenReturn(List.of(
                location(10L, "loc-10", 100),
                location(11L, "loc-11", 110)));
        when(storyReadPort.findDifficultiesByStoryId(STORY_ID)).thenReturn(List.of());
        when(matchReadPort.findLocationsByMatchId(MATCH_ID)).thenReturn(List.of());
        when(matchReadPort.findRegistryByMatchId(MATCH_ID)).thenReturn(List.of());
        when(storyReadPort.findTraitsByStoryId(STORY_ID)).thenReturn(List.of());
        CharacterTemplateEntity tpl = new CharacterTemplateEntity();
        tpl.setIdTipo(90001L);
        tpl.setUuid("tpl-uuid");
        when(storyReadPort.findCharacterTemplatesByStoryId(STORY_ID)).thenReturn(List.of(tpl));

        when(characterReadPort.findCharactersByMatchId(MATCH_ID))
                .thenReturn(List.of(playerAt(playerLocation)));
        when(characterReadPort.findBackpack(MATCH_ID, 1L)).thenReturn(Optional.empty());
        when(characterReadPort.findTraits(MATCH_ID, 1L)).thenReturn(List.of());

        // neighbor 10<->11 (declared from 11) + event at location 10
        when(storyReadPort.findLocationNeighborsByStoryId(STORY_ID))
                .thenReturn(List.of(neighbor(10, 12, "N", 200), neighbor(11, 10, "S", 210)));
        when(storyReadPort.findEventsByStoryId(STORY_ID))
                .thenReturn(List.of(event(1L, "evt-1", 10, 300), event(2L, "evt-other", 11, 310)));

        when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), eq(100), eq("en")))
                .thenReturn(card("loc10"));
        when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), eq(200), eq("en")))
                .thenReturn(card("toCave"));
        when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), eq(300), eq("en")))
                .thenReturn(card("evt1"));
    }

    @Test
    void currentLocationReflectsPlayerNotStart() {
        wire(10L);
        MatchDetail detail = service.getMatchInfoForAdmin("match-uuid");

        assertNotNull(detail);
        assertEquals(10L, detail.getCurrentLocationId());
        assertEquals("loc-10", detail.getCurrentLocationUuid());
    }

    @Test
    void locationsActiveCarriesCardNeighborsAndEvents() {
        wire(10L);
        MatchDetail detail = service.getMatchInfoForAdmin("match-uuid");

        assertNotNull(detail);
        assertEquals(1, detail.getLocationsActive().size());
        LocationInfo active = detail.getLocationsActive().get(0);
        assertEquals(10L, active.getIdLocation());
        assertEquals(100, active.getIdCard());
        assertNotNull(active.getCard());
        assertEquals("loc10", active.getCard().title());

        // neighbors: link 10->12 (other=12) and link 11->10 (other=11) both touch 10
        assertEquals(2, active.getNeighbors().size());
        assertTrue(active.getNeighbors().stream().anyMatch(n -> n.getIdLocation() == 12L));
        assertTrue(active.getNeighbors().stream().anyMatch(n -> n.getIdLocation() == 11L));

        // events: only the one specific to location 10
        assertEquals(1, active.getEvents().size());
        assertEquals("evt-1", active.getEvents().get(0).getUuid());
        assertTrue(active.getEvents().get(0).isEndGame());
        assertEquals("evt1", active.getEvents().get(0).getCard().title());
    }

    @Test
    void getMatchInfoResolvesCardsInRequestedLang() {
        wire(10L);
        when(userAccessPort.findByUuid("user-7"))
                .thenReturn(Optional.of(new UserAccessPort.UserView(7L, "user-7", "u", "PLAYER", 2)));
        // Italian variant of the active location card.
        when(contentQueryPort.getCardByStoryIdAndCardId(eq(STORY_ID), eq(100), eq("it")))
                .thenReturn(card("loc10-it"));

        MatchDetail detail = service.getMatchInfo("match-uuid", "user-7", "it");

        assertNotNull(detail);
        LocationInfo active = detail.getLocationsActive().get(0);
        assertEquals("loc10-it", active.getCard().title());
        verify(contentQueryPort).getCardByStoryIdAndCardId(STORY_ID, 100, "it");
        verify(contentQueryPort, never()).getCardByStoryIdAndCardId(STORY_ID, 100, "en");
    }

    @Test
    void getMatchInfoBlankLangFallsBackToEnglish() {
        wire(10L);
        when(userAccessPort.findByUuid("user-7"))
                .thenReturn(Optional.of(new UserAccessPort.UserView(7L, "user-7", "u", "PLAYER", 2)));

        MatchDetail detail = service.getMatchInfo("match-uuid", "user-7", "  ");

        assertNotNull(detail);
        assertEquals("loc10", detail.getLocationsActive().get(0).getCard().title());
        verify(contentQueryPort).getCardByStoryIdAndCardId(STORY_ID, 100, "en");
    }

    @Test
    void noPlayersLeavesLocationsActiveEmptyAndFallsBackToStart() {
        wire(10L);
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());

        MatchDetail detail = service.getMatchInfoForAdmin("match-uuid");

        assertNotNull(detail);
        assertTrue(detail.getLocationsActive().isEmpty());
        assertEquals(11L, detail.getCurrentLocationId()); // story start fallback
    }
}
