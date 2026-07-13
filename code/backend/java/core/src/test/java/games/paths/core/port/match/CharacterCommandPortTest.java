package games.paths.core.port.match;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

class CharacterCommandPortTest {

    @Test
    void changeStatsOutcome_allValues() {
        CharacterCommandPort.ChangeStatsOutcome[] vals = CharacterCommandPort.ChangeStatsOutcome.values();
        assertEquals(3, vals.length);
        assertEquals(CharacterCommandPort.ChangeStatsOutcome.UPDATED,
                CharacterCommandPort.ChangeStatsOutcome.valueOf("UPDATED"));
        assertEquals(CharacterCommandPort.ChangeStatsOutcome.MATCH_NOT_FOUND,
                CharacterCommandPort.ChangeStatsOutcome.valueOf("MATCH_NOT_FOUND"));
        assertEquals(CharacterCommandPort.ChangeStatsOutcome.PLAYER_NOT_FOUND,
                CharacterCommandPort.ChangeStatsOutcome.valueOf("PLAYER_NOT_FOUND"));
    }

    @Test
    void changeStatsCommand_gettersAndSetters() {
        CharacterCommandPort.ChangeStatsCommand cmd = new CharacterCommandPort.ChangeStatsCommand();
        cmd.setDex(1);
        cmd.setIntel(2);
        cmd.setCon(3);
        cmd.setEnergy(4);
        cmd.setLife(5);
        cmd.setSad(6);
        cmd.setCoin(7);
        cmd.setFood(8);
        cmd.setMagic(9);

        assertEquals(1, cmd.getDex());
        assertEquals(2, cmd.getIntel());
        assertEquals(3, cmd.getCon());
        assertEquals(4, cmd.getEnergy());
        assertEquals(5, cmd.getLife());
        assertEquals(6, cmd.getSad());
        assertEquals(7, cmd.getCoin());
        assertEquals(8, cmd.getFood());
        assertEquals(9, cmd.getMagic());
    }

    @Test
    void changeStatsCommand_defaultNulls() {
        CharacterCommandPort.ChangeStatsCommand cmd = new CharacterCommandPort.ChangeStatsCommand();
        assertNull(cmd.getDex());
        assertNull(cmd.getIntel());
        assertNull(cmd.getCon());
        assertNull(cmd.getEnergy());
        assertNull(cmd.getLife());
        assertNull(cmd.getSad());
        assertNull(cmd.getCoin());
        assertNull(cmd.getFood());
        assertNull(cmd.getMagic());
    }

    @Test
    void characterJoinException_storesCodeAndMessage() {
        CharacterCommandPort.CharacterJoinException ex =
                new CharacterCommandPort.CharacterJoinException(
                        CharacterCommandPort.CharacterJoinException.Code.ALREADY_JOINED,
                        "user already in match");
        assertEquals(CharacterCommandPort.CharacterJoinException.Code.ALREADY_JOINED, ex.getCode());
        assertEquals("user already in match", ex.getMessage());
    }

    @Test
    void characterJoinException_allCodes() {
        for (CharacterCommandPort.CharacterJoinException.Code code :
                CharacterCommandPort.CharacterJoinException.Code.values()) {
            CharacterCommandPort.CharacterJoinException ex =
                    new CharacterCommandPort.CharacterJoinException(code, code.name());
            assertEquals(code, ex.getCode());
        }
    }
}
