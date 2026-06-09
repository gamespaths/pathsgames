package games.paths.core.service.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.Mockito.*;

class CharacterQueryServiceTest {

    private MatchReadPort matchReadPort;
    private CharacterReadPort characterReadPort;
    private StoryReadPort storyReadPort;
    private UserAccessPort userAccessPort;
    private CharacterQueryService service;

    private static final long STORY_ID = 9001L;
    private static final long MATCH_ID = 500L;
    private static final long USER_ID = 7L;

    @BeforeEach
    void setUp() {
        matchReadPort = mock(MatchReadPort.class);
        characterReadPort = mock(CharacterReadPort.class);
        storyReadPort = mock(StoryReadPort.class);
        userAccessPort = mock(UserAccessPort.class);
        service = new CharacterQueryService(matchReadPort, characterReadPort, storyReadPort, userAccessPort);
    }

    private GamingMatchEntity match(long creatorId) {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(MATCH_ID);
        m.setUuid("match-uuid");
        m.setIdStory(STORY_ID);
        m.setIdUserCreator(creatorId);
        return m;
    }

    private UserAccessPort.UserView user() {
        return new UserAccessPort.UserView(USER_ID, "user-uuid", "guest", "PLAYER", 6);
    }

    private GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(1L);
        c.setIdMatch(MATCH_ID);
        c.setIdUser(USER_ID);
        c.setUuid("char-uuid");
        c.setIdCharacterTemplate(90001L);
        c.setDexterity(19);
        c.setIntelligence(18);
        c.setConstitution(19);
        c.setEnergy(127);
        c.setLife(137);
        c.setSad(0);
        c.setIdLocation(90001L);
        c.setIsSleeping(false);
        c.setIsComa(false);
        return c;
    }

    private void wireStoryLookups() {
        CharacterTemplateEntity tpl = new CharacterTemplateEntity();
        tpl.setIdTipo(90001L);
        tpl.setUuid("tpl-uuid");
        when(storyReadPort.findCharacterTemplatesByStoryId(STORY_ID)).thenReturn(List.of(tpl));
        TraitEntity trait = new TraitEntity();
        trait.setId(90001L);
        trait.setIdStory(STORY_ID);
        trait.setUuid("trait-1");
        when(storyReadPort.findTraitsByStoryId(STORY_ID)).thenReturn(List.of(trait));
        LocationEntity loc = new LocationEntity();
        loc.setId(90001L);
        loc.setIdStory(STORY_ID);
        loc.setUuid("loc-uuid");
        when(storyReadPort.findLocationsByStoryId(STORY_ID)).thenReturn(List.of(loc));
        GamingBackpackResourcesEntity bp = new GamingBackpackResourcesEntity();
        bp.setFood(1);
        bp.setMagic(2);
        bp.setCoin(3);
        when(characterReadPort.findBackpack(MATCH_ID, 1L)).thenReturn(Optional.of(bp));
        GamingCharacterTraitsEntity tr = new GamingCharacterTraitsEntity();
        tr.setIdTraits(90001L);
        when(characterReadPort.findTraits(MATCH_ID, 1L)).thenReturn(List.of(tr));
    }

    // ─── listPlayers ─────────────────────────────────────────────────────────

    @Test
    void listPlayers_blankArgs_null() {
        assertNull(service.listPlayers(" ", "user-uuid"));
        assertNull(service.listPlayers("match-uuid", ""));
    }

    @Test
    void listPlayers_matchNotFound_null() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.empty());
        assertNull(service.listPlayers("match-uuid", "user-uuid"));
    }

    @Test
    void listPlayers_userUnknown_null() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(USER_ID)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.empty());
        assertNull(service.listPlayers("match-uuid", "user-uuid"));
    }

    @Test
    void listPlayers_noAccess_null() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(999L)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
        assertNull(service.listPlayers("match-uuid", "user-uuid"));
    }

    @Test
    void listPlayers_creatorAccess_returnsMappedList() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(USER_ID)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(character()));
        wireStoryLookups();

        List<CharacterInstanceInfo> players = service.listPlayers("match-uuid", "user-uuid");

        assertEquals(1, players.size());
        CharacterInstanceInfo p = players.get(0);
        assertEquals("char-uuid", p.getUuid());
        assertEquals("tpl-uuid", p.getCharacterTemplateUuid());
        assertEquals("user-uuid", p.getUserUuid());
        assertEquals(19, p.getDexterity());
        assertEquals(List.of("trait-1"), p.getTraitUuids());
        assertEquals("loc-uuid", p.getLocationUuid());
        assertEquals(1, p.getFood());
    }

    @Test
    void listPlayers_participantAccess_returnsList() {
        // not creator, but the user has a character in the match -> participant access
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(999L)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of(character()));
        wireStoryLookups();

        List<CharacterInstanceInfo> players = service.listPlayers("match-uuid", "user-uuid");
        assertEquals(1, players.size());
    }

    // ─── getCharacter ─────────────────────────────────────────────────────────

    @Test
    void getCharacter_blankArgs_null() {
        assertNull(service.getCharacter("", "c", "u"));
        assertNull(service.getCharacter("m", " ", "u"));
        assertNull(service.getCharacter("m", "c", null));
    }

    @Test
    void getCharacter_matchNotFound_null() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.empty());
        assertNull(service.getCharacter("match-uuid", "char-uuid", "user-uuid"));
    }

    @Test
    void getCharacter_noAccess_null() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(999L)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(characterReadPort.findCharactersByMatchId(MATCH_ID)).thenReturn(List.of());
        assertNull(service.getCharacter("match-uuid", "char-uuid", "user-uuid"));
    }

    @Test
    void getCharacter_characterNotFound_null() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(USER_ID)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(characterReadPort.findCharacterByMatchIdAndUuid(MATCH_ID, "char-uuid")).thenReturn(Optional.empty());
        assertNull(service.getCharacter("match-uuid", "char-uuid", "user-uuid"));
    }

    @Test
    void getCharacter_found_returnsFullInfo() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match(USER_ID)));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(characterReadPort.findCharacterByMatchIdAndUuid(MATCH_ID, "char-uuid"))
                .thenReturn(Optional.of(character()));
        wireStoryLookups();

        CharacterInstanceInfo info = service.getCharacter("match-uuid", "char-uuid", "user-uuid");

        assertNotNull(info);
        assertEquals("char-uuid", info.getUuid());
        assertEquals(137, info.getLife());
        assertEquals(List.of("trait-1"), info.getTraitUuids());
        assertEquals(2, info.getMagic());
    }
}
