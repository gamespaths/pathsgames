package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.model.match.MatchDetail;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Covers the Step 21 enrichment of {@code MatchQueryService.buildDetail}: the
 * {@code players} list is populated when a {@link CharacterReadPort} is wired
 * (4-arg constructor) and stays empty for the legacy 3-arg constructor.
 */
class MatchQueryServicePlayersTest {

    private MatchReadPort matchReadPort;
    private StoryReadPort storyReadPort;
    private UserAccessPort userAccessPort;
    private CharacterReadPort characterReadPort;

    private static final long STORY_ID = 9001L;
    private static final long MATCH_ID = 500L;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        userAccessPort = mock(UserAccessPort.class);
        characterReadPort = mock(CharacterReadPort.class);
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

    private void wireMatchAndStory() {
        StoryEntity story = new StoryEntity();
        story.setId(STORY_ID);
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
        when(storyReadPort.findAllStories()).thenReturn(List.of(story));
        when(storyReadPort.findLocationsByStoryId(STORY_ID)).thenReturn(List.of());
        when(storyReadPort.findDifficultiesByStoryId(STORY_ID)).thenReturn(List.of());
        when(matchReadPort.findLocationsByMatchId(MATCH_ID)).thenReturn(List.of());
        when(storyReadPort.findTraitsByStoryId(STORY_ID)).thenReturn(List.of());
        CharacterTemplateEntity tpl = new CharacterTemplateEntity();
        tpl.setIdTipo(90001L);
        tpl.setUuid("tpl-uuid");
        when(storyReadPort.findCharacterTemplatesByStoryId(STORY_ID)).thenReturn(List.of(tpl));
    }

    private GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(1L);
        c.setIdMatch(MATCH_ID);
        c.setIdUser(7L);
        c.setUuid("char-uuid");
        c.setIdCharacterTemplate(90001L);
        c.setDexterity(19);
        return c;
    }

    @Test
    void adminInfo_populatesPlayers() {
        wireMatchAndStory();
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(character()));
        when(characterReadPort.findBackpack(MATCH_ID, 1L)).thenReturn(Optional.empty());
        when(characterReadPort.findTraits(MATCH_ID, 1L)).thenReturn(List.of());
        MatchQueryService service =
                new MatchQueryService(matchReadPort, storyReadPort, userAccessPort, characterReadPort);

        MatchDetail detail = service.getMatchInfoForAdmin("match-uuid");

        assertNotNull(detail);
        assertEquals(1, detail.getPlayers().size());
        assertEquals("char-uuid", detail.getPlayers().get(0).getUuid());
        assertEquals("tpl-uuid", detail.getPlayers().get(0).getCharacterTemplateUuid());
        // admin view -> no requester echo
        assertNull(detail.getPlayers().get(0).getUserUuid());
    }

    @Test
    void perUserInfo_echoesCreatorUuidOnOwnedCharacter() {
        wireMatchAndStory();
        when(userAccessPort.findByUuid("user-uuid"))
                .thenReturn(Optional.of(new UserAccessPort.UserView(7L, "user-uuid", "u", "PLAYER", 6)));
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(character()));
        when(characterReadPort.findBackpack(MATCH_ID, 1L)).thenReturn(Optional.empty());
        when(characterReadPort.findTraits(MATCH_ID, 1L)).thenReturn(List.of());
        MatchQueryService service =
                new MatchQueryService(matchReadPort, storyReadPort, userAccessPort, characterReadPort);

        MatchDetail detail = service.getMatchInfo("match-uuid", "user-uuid", "en");

        assertNotNull(detail);
        assertEquals(1, detail.getPlayers().size());
        assertEquals("user-uuid", detail.getPlayers().get(0).getUserUuid());
    }

    @Test
    void legacyThreeArgConstructor_leavesPlayersEmpty() {
        wireMatchAndStory();
        MatchQueryService service = new MatchQueryService(matchReadPort, storyReadPort, userAccessPort);

        MatchDetail detail = service.getMatchInfoForAdmin("match-uuid");

        assertNotNull(detail);
        assertTrue(detail.getPlayers().isEmpty());
        verify(characterReadPort, never()).findCharactersByMatchId(any());
    }
}
