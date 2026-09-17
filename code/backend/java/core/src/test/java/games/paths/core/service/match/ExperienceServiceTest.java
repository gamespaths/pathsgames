package games.paths.core.service.match;

import games.paths.core.port.match.ExperiencePort.ExperienceException;
import games.paths.core.port.match.ExperiencePort.ExperienceException.Code;
import games.paths.core.port.match.ExperiencePort.UseExpResult;
import games.paths.core.port.match.ExperienceStorePort;
import games.paths.core.port.match.ExperienceStorePort.CharacterExpView;
import games.paths.core.port.match.ExperienceStorePort.DifficultyExpView;
import games.paths.core.port.match.ExperienceStorePort.MatchExpView;
import games.paths.core.port.match.UserAccessPort;

import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Nested;
import org.junit.jupiter.api.Test;

import java.util.List;
import java.util.Optional;

import static org.junit.jupiter.api.Assertions.assertEquals;
import static org.junit.jupiter.api.Assertions.assertNull;
import static org.junit.jupiter.api.Assertions.assertThrows;
import static org.mockito.ArgumentMatchers.anyInt;
import static org.mockito.ArgumentMatchers.anyLong;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.never;
import static org.mockito.Mockito.verify;
import static org.mockito.Mockito.when;

/** ExperienceService (Step 38) — the gates, the price and the purchase of use-exp. */
@DisplayName("ExperienceService (Step 38)")
class ExperienceServiceTest {

    private static final String USER = "user-uuid";
    private static final long USER_ID = 100L;
    private static final long MATCH_ID = 1L;
    private static final long CHAR_ID = 10L;

    private ExperienceStorePort store;
    private ExperienceService service;

    @BeforeEach
    void setUp() {
        store = mock(ExperienceStorePort.class);
        UserAccessPort users = mock(UserAccessPort.class);
        when(users.findByUuid(USER)).thenReturn(Optional.of(new UserAccessPort.UserView(USER_ID, USER, "guest", "GUEST", 6)));
        when(users.findByUuid("ghost")).thenReturn(Optional.empty());
        service = new ExperienceService(store, users);
    }

    private static MatchExpView match(String status, Long turn) {
        return new MatchExpView(MATCH_ID, "m1", status, 5L, 2L, 99, 3, turn);
    }

    private static CharacterExpView actor(int dex, int exp, boolean sleeping, boolean coma, Long loc) {
        return new CharacterExpView(CHAR_ID, "c1", dex, 12, 4, exp, sleeping, coma, loc);
    }

    private void wire(MatchExpView m, CharacterExpView c, Integer secure, DifficultyExpView d) {
        when(store.findMatchByUuid("m1")).thenReturn(Optional.of(m));
        when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.of(c));
        when(store.findLocationSecureParam(5L, 7L)).thenReturn(Optional.ofNullable(secure));
        when(store.findDifficulty(5L, 2L)).thenReturn(Optional.ofNullable(d));
    }

    private Code codeOf(String stat) {
        return assertThrows(ExperienceException.class, () -> service.useExp("m1", USER, stat)).getCode();
    }

    @Nested
    @DisplayName("gates, in engine order")
    class Gates {

        @Test
        void unknownUserMatchOrCharacterIsNotFound() {
            assertEquals(Code.MATCH_NOT_FOUND, assertThrows(ExperienceException.class,
                    () -> service.useExp("m1", "ghost", "dex")).getCode());
            assertEquals(Code.MATCH_NOT_FOUND, assertThrows(ExperienceException.class,
                    () -> service.useExp("m1", null, "dex")).getCode());
            when(store.findMatchByUuid("m1")).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND, codeOf("dex"));
            when(store.findMatchByUuid("m1")).thenReturn(Optional.of(match("RUNNING", null)));
            when(store.findCharacterByMatchAndUser(MATCH_ID, USER_ID)).thenReturn(Optional.empty());
            assertEquals(Code.MATCH_NOT_FOUND, codeOf("dex"));
        }

        @Test
        void notRunning() {
            wire(match("PAUSED", CHAR_ID), actor(10, 40, false, false, 7L), 1, null);
            assertEquals(Code.MATCH_NOT_RUNNING, codeOf("dex"));
        }

        @Test
        void notYourTurn() {
            wire(match("RUNNING", 999L), actor(10, 40, false, false, 7L), 1, null);
            assertEquals(Code.NOT_YOUR_TURN, codeOf("dex"));
        }

        @Test
        void comaThenSleeping() {
            wire(match("RUNNING", CHAR_ID), actor(10, 40, true, true, 7L), 1, null);
            assertEquals(Code.COMA, codeOf("dex"));
            wire(match("RUNNING", CHAR_ID), actor(10, 40, true, false, 7L), 1, null);
            assertEquals(Code.SLEEPING, codeOf("dex"));
        }

        @Test
        void invalidStat() {
            wire(match("RUNNING", CHAR_ID), actor(10, 40, false, false, 7L), 1, null);
            assertEquals(Code.INVALID_STAT, codeOf("life"));
            assertEquals(Code.INVALID_STAT, codeOf(null));
            assertEquals(Code.INVALID_STAT, codeOf(" "));
        }

        @Test
        void locationNotSafe() {
            wire(match("RUNNING", CHAR_ID), actor(10, 40, false, false, 7L), 0, null);
            assertEquals(Code.LOCATION_NOT_SAFE, codeOf("dex"));
            wire(match("RUNNING", CHAR_ID), actor(10, 40, false, false, 7L), null, null);
            assertEquals(Code.LOCATION_NOT_SAFE, codeOf("dex"));
            wire(match("RUNNING", CHAR_ID), actor(10, 40, false, false, null), 1, null);
            assertEquals(Code.LOCATION_NOT_SAFE, codeOf("dex"));
        }

        @Test
        void maxStatValueThenNotEnoughExp() {
            // difficulty: 2 × stat + 3, capped at 12 → int (12) is at the cap, dex (10) costs 23
            wire(match("RUNNING", CHAR_ID), actor(10, 22, false, false, 7L), 1, new DifficultyExpView(2, 3, 12));
            assertEquals(Code.MAX_STAT_VALUE, codeOf("int"));
            assertEquals(Code.NOT_ENOUGH_EXP, codeOf("dex"));
            verify(store, never()).updateCharacter(anyLong(), anyLong(), anyInt(), anyInt(), anyInt(), anyInt());
        }
    }

    @Nested
    @DisplayName("the purchase")
    class Purchase {

        @Test
        @DisplayName("buys the point, deducts the cost, logs EXP_USE and answers the refreshed price list")
        void buysDex() {
            wire(match("RUNNING", CHAR_ID), actor(10, 40, false, false, 7L), 1, new DifficultyExpView(2, 3, 12));

            UseExpResult r = service.useExp("m1", USER, " DEX ");

            verify(store).updateCharacter(MATCH_ID, CHAR_ID, 11, 12, 4, 17);
            verify(store).logExpUse(MATCH_ID, CHAR_ID, 3, "EXP_USE dex 10->11 cost 23");
            assertEquals("m1", r.matchUuid());
            assertEquals("c1", r.characterUuid());
            assertEquals("dex", r.stat());
            assertEquals(10, r.statBefore());
            assertEquals(11, r.statAfter());
            assertEquals(40, r.expBefore());
            assertEquals(17, r.expAfter());
            assertEquals(23, r.expCost());
            assertEquals(25, r.expCosts().get("dex"));
            assertNull(r.expCosts().get("int"));
            assertEquals(11, r.expCosts().get("cos"));
            assertEquals(List.of("dex", "exp"), r.statChanges().stream().map(c -> c.statistic()).toList());
            assertEquals(-23, r.statChanges().get(1).delta());
            assertEquals(1, r.statChanges().get(0).delta());
        }

        @Test
        @DisplayName("int and cos move their own column; a match with no active turn does not gate on it")
        void buysIntAndCos() {
            wire(match("RUNNING", null), actor(10, 100, false, false, 7L), 1, new DifficultyExpView(1, 0, 0));
            assertEquals(13, service.useExp("m1", USER, "int").statAfter());
            verify(store).updateCharacter(MATCH_ID, CHAR_ID, 10, 13, 4, 88);
            assertEquals(5, service.useExp("m1", USER, "cos").statAfter());
            verify(store).updateCharacter(MATCH_ID, CHAR_ID, 10, 12, 5, 96);
        }

        @Test
        @DisplayName("without a difficulty row the match's own expCost prices the point, uncapped")
        void fallsBackToMatchExpCost() {
            wire(match("RUNNING", CHAR_ID), actor(1, 100, false, false, 7L), 1, null);
            UseExpResult r = service.useExp("m1", USER, "dex");
            assertEquals(99, r.expCost());
            assertEquals(1, r.expAfter());

            when(store.findMatchByUuid("m1")).thenReturn(Optional.of(
                    new MatchExpView(MATCH_ID, "m1", "RUNNING", 5L, null, 4, 0, null)));
            assertEquals(4, service.useExp("m1", USER, "dex").expCost());
        }
    }
}
