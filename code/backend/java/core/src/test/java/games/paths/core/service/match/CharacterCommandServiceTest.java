package games.paths.core.service.match;

import games.paths.core.entity.match.GamingBackpackResourcesEntity;
import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingCharacterTraitsEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.entity.story.CharacterTemplateEntity;
import games.paths.core.entity.story.ClassBonusEntity;
import games.paths.core.entity.story.ClassEntity;
import games.paths.core.entity.story.LocationEntity;
import games.paths.core.entity.story.StoryDifficultyEntity;
import games.paths.core.entity.story.StoryEntity;
import games.paths.core.entity.story.TraitEntity;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.JoinMatchCommand;
import games.paths.core.port.match.CharacterCommandPort.CharacterJoinException;
import games.paths.core.port.match.CharacterPersistencePort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;
import org.mockito.ArgumentCaptor;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.*;

class CharacterCommandServiceTest {

    private StoryReadPort storyReadPort;
    private MatchReadPort matchReadPort;
    private UserAccessPort userAccessPort;
    private CharacterPersistencePort persistencePort;
    private CharacterCommandService service;

    private static final long STORY_ID = 9001L;
    private static final long MATCH_ID = 500L;
    private static final long USER_ID = 7L;

    @BeforeEach
    void setUp() {
        storyReadPort = mock(StoryReadPort.class);
        matchReadPort = mock(MatchReadPort.class);
        userAccessPort = mock(UserAccessPort.class);
        persistencePort = mock(CharacterPersistencePort.class);
        service = new CharacterCommandService(storyReadPort, matchReadPort, userAccessPort, persistencePort);
    }

    // ─── builders ───────────────────────────────────────────────────────────

    private GamingMatchEntity match() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(MATCH_ID);
        m.setUuid("match-uuid");
        m.setIdStory(STORY_ID);
        m.setIdDifficulty(90001L);
        m.setStatus("CREATED");
        m.setIdUserCreator(USER_ID);
        m.setCharacterTemplateUuid("tpl-uuid");
        m.setClassUuid("class-uuid");
        m.setTraitUuids("trait-1,trait-2");
        return m;
    }

    private UserAccessPort.UserView user() {
        return new UserAccessPort.UserView(USER_ID, "user-uuid", "guest", "PLAYER", 6);
    }

    private StoryEntity story() {
        StoryEntity s = new StoryEntity();
        s.setId(STORY_ID);
        s.setIdLocationStart(90001);
        return s;
    }

    private CharacterTemplateEntity template() {
        CharacterTemplateEntity t = new CharacterTemplateEntity();
        t.setIdTipo(90001L);
        t.setUuid("tpl-uuid");
        t.setLifeMax(12);
        t.setEnergyMax(12);
        t.setSadMax(8);
        t.setDexterityStart(3);
        t.setIntelligenceStart(3);
        t.setConstitutionStart(3);
        return t;
    }

    private ClassEntity clazz() {
        ClassEntity c = new ClassEntity();
        c.setId(90001L);
        c.setIdStory(STORY_ID);
        c.setUuid("class-uuid");
        c.setWeightMax(12);
        c.setDexterityBase(3);
        c.setIntelligenceBase(3);
        c.setConstitutionBase(3);
        return c;
    }

    private ClassBonusEntity bonus(String stat, int value) {
        ClassBonusEntity b = new ClassBonusEntity();
        b.setIdClass(90001);
        b.setStatistic(stat);
        b.setValue(value);
        return b;
    }

    private StoryDifficultyEntity difficulty() {
        StoryDifficultyEntity d = new StoryDifficultyEntity();
        d.setId(90001L);
        d.setIdStory(STORY_ID);
        d.setExpCost(300);
        d.setLife(120);
        d.setEnergy(110);
        d.setSad(0);
        d.setDexterity(12);
        d.setIntelligence(12);
        d.setConstitution(12);
        d.setWeight(12);
        return d;
    }

    private TraitEntity trait(long id, String uuid, int life, int energy, int dex, int intel, int con) {
        TraitEntity t = new TraitEntity();
        t.setId(id);
        t.setIdStory(STORY_ID);
        t.setUuid(uuid);
        t.setLife(life);
        t.setEnergy(energy);
        t.setDexterity(dex);
        t.setIntelligence(intel);
        t.setConstitution(con);
        t.setSad(0);
        t.setWeight(0);
        return t;
    }

    private LocationEntity startLocation() {
        LocationEntity l = new LocationEntity();
        l.setId(90001L);
        l.setIdStory(STORY_ID);
        l.setUuid("loc-start-uuid");
        return l;
    }

    /** Wires the full happy-path graph (match, user, story, template, class, difficulty, traits). */
    private void wireFullGraph() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
        when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
        when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
        when(persistencePort.countCharactersByMatchId(MATCH_ID)).thenReturn(0);
        when(storyReadPort.findStoryById(STORY_ID)).thenReturn(Optional.of(story()));
        when(storyReadPort.findCharacterTemplateByStoryIdAndUuid(STORY_ID, "tpl-uuid"))
                .thenReturn(Optional.of(template()));
        when(storyReadPort.findClassByStoryIdAndUuid(STORY_ID, "class-uuid"))
                .thenReturn(Optional.of(clazz()));
        when(storyReadPort.findClassBonusesByStoryId(STORY_ID))
                .thenReturn(List.of(bonus("life", 3), bonus("energy", 3), bonus("exp", 2)));
        when(storyReadPort.findDifficultiesByStoryId(STORY_ID)).thenReturn(List.of(difficulty()));
        when(storyReadPort.findTraitByStoryIdAndUuid(STORY_ID, "trait-1"))
                .thenReturn(Optional.of(trait(90001L, "trait-1", 2, 0, 0, 0, 1)));
        when(storyReadPort.findTraitByStoryIdAndUuid(STORY_ID, "trait-2"))
                .thenReturn(Optional.of(trait(90002L, "trait-2", 0, 2, 1, 0, 0)));
        when(storyReadPort.findLocationsByStoryId(STORY_ID)).thenReturn(List.of(startLocation()));
        when(persistencePort.saveCharacter(any())).thenAnswer(inv -> {
            GamingCharacterInstanceEntity e = inv.getArgument(0);
            if (e.getUuid() == null) e.setUuid("char-uuid");
            return e;
        });
    }

    private JoinMatchCommand cmd() {
        return new JoinMatchCommand("match-uuid", "user-uuid", "tpl-uuid", "class-uuid",
                List.of("trait-1", "trait-2"));
    }

    // ─── validation branches ────────────────────────────────────────────────

    @Nested
    class Validation {

        @Test
        void nullCommand_invalidInput() {
            CharacterJoinException ex = assertThrows(CharacterJoinException.class, () -> service.join(null));
            assertEquals(CharacterJoinException.Code.INVALID_INPUT, ex.getCode());
        }

        @Test
        void blankMatchUuid_invalidInput() {
            JoinMatchCommand c = new JoinMatchCommand(" ", "user-uuid", null, null, null);
            assertEquals(CharacterJoinException.Code.INVALID_INPUT,
                    assertThrows(CharacterJoinException.class, () -> service.join(c)).getCode());
        }

        @Test
        void blankUserUuid_invalidInput() {
            JoinMatchCommand c = new JoinMatchCommand("match-uuid", "", null, null, null);
            assertEquals(CharacterJoinException.Code.INVALID_INPUT,
                    assertThrows(CharacterJoinException.class, () -> service.join(c)).getCode());
        }

        @Test
        void matchNotFound() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.empty());
            assertEquals(CharacterJoinException.Code.MATCH_NOT_FOUND,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void terminalMatch_notJoinable() {
            GamingMatchEntity m = match();
            m.setStatus("ENDED");
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(m));
            assertEquals(CharacterJoinException.Code.MATCH_NOT_JOINABLE,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void userNotFound() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.empty());
            assertEquals(CharacterJoinException.Code.USER_NOT_FOUND,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void bannedUser() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(USER_ID, "user-uuid", "u", "PLAYER", 4)));
            assertEquals(CharacterJoinException.Code.USER_BANNED,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void blockedUser() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid"))
                    .thenReturn(Optional.of(new UserAccessPort.UserView(USER_ID, "user-uuid", "u", "PLAYER", 3)));
            assertEquals(CharacterJoinException.Code.USER_BANNED,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void alreadyJoined() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
            when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID))
                    .thenReturn(Optional.of(new GamingCharacterInstanceEntity()));
            assertEquals(CharacterJoinException.Code.ALREADY_JOINED,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void storyMissing_matchNotFound() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
            when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            when(storyReadPort.findStoryById(STORY_ID)).thenReturn(Optional.empty());
            assertEquals(CharacterJoinException.Code.MATCH_NOT_FOUND,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void noTemplate_invalidInput() {
            GamingMatchEntity m = match();
            m.setCharacterTemplateUuid(null);
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(m));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
            when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            when(storyReadPort.findStoryById(STORY_ID)).thenReturn(Optional.of(story()));
            JoinMatchCommand c = new JoinMatchCommand("match-uuid", "user-uuid", null, null, null);
            assertEquals(CharacterJoinException.Code.INVALID_INPUT,
                    assertThrows(CharacterJoinException.class, () -> service.join(c)).getCode());
        }

        @Test
        void templateNotFound() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
            when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            when(storyReadPort.findStoryById(STORY_ID)).thenReturn(Optional.of(story()));
            when(storyReadPort.findCharacterTemplateByStoryIdAndUuid(STORY_ID, "tpl-uuid"))
                    .thenReturn(Optional.empty());
            assertEquals(CharacterJoinException.Code.TEMPLATE_NOT_FOUND,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void classNotFound() {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
            when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            when(storyReadPort.findStoryById(STORY_ID)).thenReturn(Optional.of(story()));
            when(storyReadPort.findCharacterTemplateByStoryIdAndUuid(STORY_ID, "tpl-uuid"))
                    .thenReturn(Optional.of(template()));
            when(storyReadPort.findClassByStoryIdAndUuid(STORY_ID, "class-uuid")).thenReturn(Optional.empty());
            assertEquals(CharacterJoinException.Code.CLASS_NOT_FOUND,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void classNotPermitted_notCompatible() {
            CharacterTemplateEntity t = template();
            t.setIdClassPermitted(99999); // permitted class != selected class id 90001
            stubUpToTemplate(t);
            when(storyReadPort.findClassByStoryIdAndUuid(STORY_ID, "class-uuid")).thenReturn(Optional.of(clazz()));
            assertEquals(CharacterJoinException.Code.CLASS_NOT_COMPATIBLE,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        @Test
        void classProhibited_notCompatible() {
            CharacterTemplateEntity t = template();
            t.setIdClassProhibited(90001); // selected class id 90001 is prohibited
            stubUpToTemplate(t);
            when(storyReadPort.findClassByStoryIdAndUuid(STORY_ID, "class-uuid")).thenReturn(Optional.of(clazz()));
            assertEquals(CharacterJoinException.Code.CLASS_NOT_COMPATIBLE,
                    assertThrows(CharacterJoinException.class, () -> service.join(cmd())).getCode());
        }

        private void stubUpToTemplate(CharacterTemplateEntity t) {
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
            when(userAccessPort.findByUuid("user-uuid")).thenReturn(Optional.of(user()));
            when(persistencePort.findCharacterByMatchIdAndUserId(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            when(storyReadPort.findStoryById(STORY_ID)).thenReturn(Optional.of(story()));
            when(storyReadPort.findCharacterTemplateByStoryIdAndUuid(STORY_ID, "tpl-uuid"))
                    .thenReturn(Optional.of(t));
        }
    }

    // ─── happy paths & stat math ─────────────────────────────────────────────

    @Nested
    class HappyPath {

        @Test
        void computesFinalStats_andStartsLifeEnergyFull() {
            wireFullGraph();

            CharacterInstanceInfo info = service.join(cmd());

            // dex = 3(tpl)+3(class)+12(diff)+1(traits)+0(bonus) = 19
            assertEquals(19, info.getDexterity());
            // int = 3+3+12+0+0 = 18
            assertEquals(18, info.getIntelligence());
            // con = 3+3+12+1+0 = 19
            assertEquals(19, info.getConstitution());
            // life = 12+120+2(traits)+3(bonus life) = 137 ; starts full
            assertEquals(137, info.getLife());
            // energy = 12+110+2(traits)+3(bonus energy) = 127 ; starts full
            assertEquals(127, info.getEnergy());
            assertEquals(0, info.getSad());
            assertFalse(info.getIsSleeping());
            assertFalse(info.getIsComa());
            assertEquals(90001L, info.getIdLocation());
            assertEquals("loc-start-uuid", info.getLocationUuid());
            assertEquals("user-uuid", info.getUserUuid());
            assertEquals("tpl-uuid", info.getCharacterTemplateUuid());
            assertEquals("class-uuid", info.getClassUuid());
            assertEquals(List.of("trait-1", "trait-2"), info.getTraitUuids());
            assertEquals(0, info.getFood());
            assertEquals(0, info.getMagic());
            assertEquals(0, info.getCoin());
        }

        @Test
        void persistsInstanceBackpackAndTraitRows() {
            wireFullGraph();

            service.join(cmd());

            ArgumentCaptor<GamingCharacterInstanceEntity> charCap =
                    ArgumentCaptor.forClass(GamingCharacterInstanceEntity.class);
            verify(persistencePort).saveCharacter(charCap.capture());
            GamingCharacterInstanceEntity saved = charCap.getValue();
            assertEquals(1L, saved.getId());            // count 0 -> id 1
            assertEquals(MATCH_ID, saved.getIdMatch());
            assertEquals(USER_ID, saved.getIdUser());
            assertEquals(90001L, saved.getIdCharacterTemplate());

            ArgumentCaptor<GamingBackpackResourcesEntity> backCap =
                    ArgumentCaptor.forClass(GamingBackpackResourcesEntity.class);
            verify(persistencePort).saveBackpack(backCap.capture());
            assertEquals(0, backCap.getValue().getFood());
            assertEquals(1L, backCap.getValue().getIdCharacterMatch());

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<GamingCharacterTraitsEntity>> traitCap = ArgumentCaptor.forClass(List.class);
            verify(persistencePort).saveTraits(traitCap.capture());
            List<GamingCharacterTraitsEntity> rows = traitCap.getValue();
            assertEquals(2, rows.size());
            assertEquals(90001L, rows.get(0).getIdTraits());
            assertEquals(90002L, rows.get(1).getIdTraits());
            assertEquals(1L, rows.get(0).getId());
            assertEquals(2L, rows.get(1).getId());
        }

        @Test
        void assignsNextIdFromExistingCount() {
            wireFullGraph();
            when(persistencePort.countCharactersByMatchId(MATCH_ID)).thenReturn(3);

            service.join(cmd());

            ArgumentCaptor<GamingCharacterInstanceEntity> cap =
                    ArgumentCaptor.forClass(GamingCharacterInstanceEntity.class);
            verify(persistencePort).saveCharacter(cap.capture());
            assertEquals(4L, cap.getValue().getId());
        }

        @Test
        void fallsBackToMatchLoadoutWhenCommandEmpty() {
            wireFullGraph();
            // command without any loadout -> uses match's stored tpl/class/traits
            JoinMatchCommand bare = new JoinMatchCommand("match-uuid", "user-uuid", null, null, null);

            CharacterInstanceInfo info = service.join(bare);

            assertEquals("tpl-uuid", info.getCharacterTemplateUuid());
            assertEquals("class-uuid", info.getClassUuid());
            assertEquals(List.of("trait-1", "trait-2"), info.getTraitUuids());
            assertEquals(19, info.getDexterity());
        }

        @Test
        void noClass_appliesTemplateDifficultyTraitsOnly() {
            wireFullGraph();
            GamingMatchEntity m = match();
            m.setClassUuid(null);
            when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(m));
            JoinMatchCommand c = new JoinMatchCommand("match-uuid", "user-uuid", "tpl-uuid", null,
                    List.of("trait-1", "trait-2"));

            CharacterInstanceInfo info = service.join(c);

            // dex = 3(tpl)+0(no class)+12(diff)+1(traits) = 16
            assertEquals(16, info.getDexterity());
            assertNull(info.getClassUuid());
            verify(storyReadPort, never()).findClassByStoryIdAndUuid(anyLong(), any());
        }

        @Test
        void noDifficulty_appliesZeroDifficultyDeltas() {
            wireFullGraph();
            when(storyReadPort.findDifficultiesByStoryId(STORY_ID)).thenReturn(List.of()); // unknown difficulty

            CharacterInstanceInfo info = service.join(cmd());

            // dex = 3(tpl)+3(class)+0(diff)+1(traits) = 7
            assertEquals(7, info.getDexterity());
        }

        @Test
        void unresolvedTraitsAreSkipped() {
            wireFullGraph();
            when(storyReadPort.findTraitByStoryIdAndUuid(STORY_ID, "trait-2")).thenReturn(Optional.empty());

            service.join(cmd());

            @SuppressWarnings("unchecked")
            ArgumentCaptor<List<GamingCharacterTraitsEntity>> traitCap = ArgumentCaptor.forClass(List.class);
            verify(persistencePort).saveTraits(traitCap.capture());
            assertEquals(1, traitCap.getValue().size());
        }
    }
}
