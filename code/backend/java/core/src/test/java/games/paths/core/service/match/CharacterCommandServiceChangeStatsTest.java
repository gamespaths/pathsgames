package games.paths.core.service.match;

import games.paths.core.entity.match.GamingCharacterInstanceEntity;
import games.paths.core.entity.match.GamingMatchEntity;
import games.paths.core.port.match.CharacterCommandPort.ChangeStatsCommand;
import games.paths.core.port.match.CharacterCommandPort.ChangeStatsOutcome;
import games.paths.core.port.match.CharacterPersistencePort;
import games.paths.core.port.match.CharacterReadPort;
import games.paths.core.port.match.MatchReadPort;
import games.paths.core.port.match.UserAccessPort;
import games.paths.core.port.story.StoryReadPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;

import java.util.Optional;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/**
 * Unit tests for {@link CharacterCommandService#changeStatistics} — the admin
 * stat override (POST /api/admin/matches/{m}/player/{p}/changeStatistics).
 * Fields left null or set to {@code -1} are skipped; energy/life/sad are capped
 * at the character's max.
 */
class CharacterCommandServiceChangeStatsTest {

    private MatchReadPort matchReadPort;
    private CharacterReadPort characterReadPort;
    private CharacterPersistencePort persistencePort;
    private CharacterCommandService service;

    @BeforeEach
    void setUp() {
        StoryReadPort storyReadPort = mock(StoryReadPort.class);
        matchReadPort = mock(MatchReadPort.class);
        UserAccessPort userAccessPort = mock(UserAccessPort.class);
        persistencePort = mock(CharacterPersistencePort.class);
        characterReadPort = mock(CharacterReadPort.class);
        service = new CharacterCommandService(storyReadPort, matchReadPort, userAccessPort,
                persistencePort, characterReadPort);
    }

    private GamingMatchEntity match() {
        GamingMatchEntity m = new GamingMatchEntity();
        m.setId(1L);
        m.setUuid("match-uuid");
        return m;
    }

    private GamingCharacterInstanceEntity character() {
        GamingCharacterInstanceEntity c = new GamingCharacterInstanceEntity();
        c.setId(2L);
        c.setUuid("player-uuid");
        c.setEnergyMax(100);
        c.setLifeMax(120);
        c.setSadMax(50);
        return c;
    }

    private void wireMatchAndCharacter() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
        when(characterReadPort.findCharacterByMatchIdAndUuid(1L, "player-uuid"))
                .thenReturn(Optional.of(character()));
    }

    @Test
    void matchNotFound() {
        when(matchReadPort.findMatchByUuid("missing")).thenReturn(Optional.empty());

        assertEquals(ChangeStatsOutcome.MATCH_NOT_FOUND,
                service.changeStatistics("missing", "player-uuid", new ChangeStatsCommand()));
        verifyNoInteractions(persistencePort);
    }

    @Test
    void playerNotFound() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
        when(characterReadPort.findCharacterByMatchIdAndUuid(1L, "missing"))
                .thenReturn(Optional.empty());

        assertEquals(ChangeStatsOutcome.PLAYER_NOT_FOUND,
                service.changeStatistics("match-uuid", "missing", new ChangeStatsCommand()));
        verifyNoInteractions(persistencePort);
    }

    @Test
    void appliesEveryProvidedStatAndBackpackValue() {
        wireMatchAndCharacter();
        ChangeStatsCommand cmd = new ChangeStatsCommand();
        cmd.setDex(11);
        cmd.setIntel(12);
        cmd.setCon(13);
        cmd.setEnergy(60);
        cmd.setLife(70);
        cmd.setSad(8);
        cmd.setFood(3);
        cmd.setMagic(4);
        cmd.setCoin(5);

        assertEquals(ChangeStatsOutcome.UPDATED,
                service.changeStatistics("match-uuid", "player-uuid", cmd));

        verify(persistencePort).updateCharacterStats(1L, 2L, 11, 12, 13, 60, 70, 8);
        verify(persistencePort).updateBackpackStats(1L, 2L, 3, 4, 5);
    }

    @Test
    void minusOneAndNullFieldsAreSkipped() {
        wireMatchAndCharacter();
        ChangeStatsCommand cmd = new ChangeStatsCommand();
        cmd.setDex(-1);
        cmd.setIntel(null);
        cmd.setCon(15);
        cmd.setEnergy(-1);
        cmd.setLife(null);
        cmd.setSad(-1);
        cmd.setFood(-1);
        cmd.setMagic(-1);
        cmd.setCoin(-1);

        assertEquals(ChangeStatsOutcome.UPDATED,
                service.changeStatistics("match-uuid", "player-uuid", cmd));

        verify(persistencePort).updateCharacterStats(1L, 2L, null, null, 15, null, null, null);
        verify(persistencePort, never()).updateBackpackStats(any(), any(), any(), any(), any());
    }

    @Test
    void energyLifeAndSadAreCappedAtTheirMax() {
        wireMatchAndCharacter();
        ChangeStatsCommand cmd = new ChangeStatsCommand();
        cmd.setEnergy(999);
        cmd.setLife(999);
        cmd.setSad(999);

        assertEquals(ChangeStatsOutcome.UPDATED,
                service.changeStatistics("match-uuid", "player-uuid", cmd));

        verify(persistencePort).updateCharacterStats(1L, 2L, null, null, null, 100, 120, 50);
    }

    @Test
    void valuesBelowTheMaxArePassedThroughUnchanged() {
        wireMatchAndCharacter();
        ChangeStatsCommand cmd = new ChangeStatsCommand();
        cmd.setEnergy(100);
        cmd.setLife(1);
        cmd.setSad(0);

        assertEquals(ChangeStatsOutcome.UPDATED,
                service.changeStatistics("match-uuid", "player-uuid", cmd));

        verify(persistencePort).updateCharacterStats(1L, 2L, null, null, null, 100, 1, 0);
    }

    @Test
    void nullOrZeroMaxDisablesTheCap() {
        when(matchReadPort.findMatchByUuid("match-uuid")).thenReturn(Optional.of(match()));
        GamingCharacterInstanceEntity c = character();
        c.setEnergyMax(null);
        c.setLifeMax(0);
        when(characterReadPort.findCharacterByMatchIdAndUuid(1L, "player-uuid"))
                .thenReturn(Optional.of(c));

        ChangeStatsCommand cmd = new ChangeStatsCommand();
        cmd.setEnergy(999);
        cmd.setLife(999);

        assertEquals(ChangeStatsOutcome.UPDATED,
                service.changeStatistics("match-uuid", "player-uuid", cmd));

        verify(persistencePort).updateCharacterStats(1L, 2L, null, null, null, 999, 999, null);
    }

    @Test
    void backpackIsUpdatedWhenOnlyOneResourceIsProvided() {
        wireMatchAndCharacter();
        ChangeStatsCommand cmd = new ChangeStatsCommand();
        cmd.setCoin(7);

        assertEquals(ChangeStatsOutcome.UPDATED,
                service.changeStatistics("match-uuid", "player-uuid", cmd));

        verify(persistencePort).updateBackpackStats(1L, 2L, null, null, 7);
    }
}
