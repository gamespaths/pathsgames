package games.paths.core.service.match;

import games.paths.core.entity.story.ChoiceConditionEntity;
import games.paths.core.entity.story.ChoiceEntity;
import games.paths.core.entity.story.EventEntity;
import games.paths.core.model.match.RegistryLock;
import games.paths.core.port.match.EventExecutionPort.EventAvailability;
import games.paths.core.port.match.EventExecutionPort.EventExecutionException.Code;
import games.paths.core.port.match.EventExecutionPort.PendingChoice;
import games.paths.core.port.match.EventExecutionStorePort.EventCheckContext;
import games.paths.core.service.match.ChoiceAvailabilityChecker.ChoiceAvailability;
import games.paths.core.service.match.ChoiceAvailabilityChecker.ChoiceCheckContext;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.HashSet;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;

/** V1 step 1 - the event and choice checkers carry the raw registry lock of the failing check. */
@DisplayName("Checkers carry the registry lock (V1 step 1)")
class AvailabilityRegistryLockTest {

    // ── events ──────────────────────────────────────────────────────────────

    private static EventEntity event(String key, String op, String value) {
        EventEntity e = new EventEntity();
        e.setId(1L);
        e.setType("NORMAL");
        e.setCostEnery(0);
        e.setCostCoin(0);
        e.setRegistryKeyCondition(key);
        e.setRegistryValueOperatorCondition(op);
        e.setRegistryValueCondition(value);
        return e;
    }

    private static EventCheckContext ectx(int energy, Map<String, List<String>> registry) {
        return new EventCheckContext(1L, 100L, false, false, energy, 10, 10, 10, 50L,
                new HashSet<>(), null, new HashSet<>(), registry);
    }

    @Test
    @DisplayName("= on an absent key: MISSING with the expected value")
    void eventMissing() {
        EventAvailability a = EventAvailabilityChecker.check(event("gate", null, "open"),
                ectx(10, new HashMap<>()));
        assertEquals(Code.REGISTRY_CONDITION_NOT_MET, a.reason());
        assertEquals(new RegistryLock("MISSING", false, "gate", null, "=", "open"), a.registryLock());
    }

    @Test
    @DisplayName("!= on a held value: FORBIDDEN with the stored spelling")
    void eventForbidden() {
        EventAvailability a = EventAvailabilityChecker.check(event("gate", "!=", "open"),
                ectx(10, Map.of("gate", List.of("Open"))));
        assertEquals(Code.REGISTRY_CONDITION_NOT_MET, a.reason());
        assertEquals(new RegistryLock("FORBIDDEN", false, "gate", null, "!=", "Open"), a.registryLock());
    }

    @Test
    @DisplayName("an earlier failure wins and carries no lock; an available event has none")
    void eventOtherReasonsHaveNoLock() {
        EventEntity e = event("gate", "=", "open");
        e.setCostEnery(99);
        EventAvailability a = EventAvailabilityChecker.check(e, ectx(10, new HashMap<>()));
        assertEquals(Code.NOT_ENOUGH_ENERGY, a.reason());
        assertNull(a.registryLock());
        assertNull(EventAvailability.OK.registryLock());
        assertNull(EventAvailabilityChecker.check(event("gate", "=", "open"),
                ectx(10, Map.of("gate", List.of("open")))).registryLock());
    }

    // ── choices ─────────────────────────────────────────────────────────────

    private static ChoiceEntity choice(String logic) {
        ChoiceEntity c = new ChoiceEntity();
        c.setId(1L);
        c.setOtherwiseFlag(0);
        c.setLogicOperator(logic);
        return c;
    }

    private static ChoiceConditionEntity cond(String type, String key, String value, String op) {
        ChoiceConditionEntity c = new ChoiceConditionEntity();
        c.setType(type);
        c.setKey(key);
        c.setValue(value);
        c.setOperator(op);
        return c;
    }

    private static ChoiceCheckContext cctx(Map<String, List<String>> registry) {
        return new ChoiceCheckContext(Map.of("dex", 3), 50L, 100L, new HashSet<>(),
                new HashSet<>(), registry, List.of(100L), new HashMap<>());
    }

    @Test
    @DisplayName("AND: the first failing KEYS row names the lock")
    void choiceAndFirstFailure() {
        ChoiceAvailability a = ChoiceAvailabilityChecker.check(choice("AND"), List.of(
                cond("KEYS", "day", "1", ">"),
                cond("KEYS", "gate", "open", "!="),
                cond("KEYS", "bell", "rung", "=")), cctx(Map.of("day", List.of("2"),
                "gate", List.of("open"))));
        assertEquals(ChoiceAvailabilityChecker.CONDITION_KEYS_NOT_MET, a.reason());
        assertEquals(new RegistryLock("FORBIDDEN", false, "gate", null, "!=", "open"), a.registryLock());
    }

    @Test
    @DisplayName("AND: a non-KEYS first failure carries no lock")
    void choiceAndOtherType() {
        ChoiceAvailability a = ChoiceAvailabilityChecker.check(choice("AND"), List.of(
                cond("ITEM", null, "9", "="),
                cond("KEYS", "gate", "open", "=")), cctx(new HashMap<>()));
        assertEquals(ChoiceAvailabilityChecker.CONDITION_ITEM_NOT_MET, a.reason());
        assertNull(a.registryLock());
    }

    @Test
    @DisplayName("AND: a blank KEYS key is an authoring error, generic lock")
    void choiceBlankKey() {
        ChoiceAvailability a = ChoiceAvailabilityChecker.check(choice("AND"), List.of(
                cond("KEYS", "  ", "open", "=")), cctx(new HashMap<>()));
        assertEquals(RegistryLock.generic(), a.registryLock());
    }

    @Test
    @DisplayName("OR with a KEYS row: generic MISSING lock, no key")
    void choiceOrGeneric() {
        ChoiceAvailability a = ChoiceAvailabilityChecker.check(choice("or"), List.of(
                cond("ITEM", null, "9", "="),
                cond("KEYS", "gate", "open", "=")), cctx(new HashMap<>()));
        assertEquals(ChoiceAvailabilityChecker.CONDITIONS_NOT_MET, a.reason());
        assertEquals(RegistryLock.generic(), a.registryLock());
    }

    @Test
    @DisplayName("OR with no KEYS row, limits and OK carry no lock")
    void choiceNoLock() {
        assertNull(ChoiceAvailabilityChecker.check(choice("OR"), List.of(
                cond("ITEM", null, "9", "=")), cctx(new HashMap<>())).registryLock());
        ChoiceEntity limited = choice("AND");
        limited.setLimitDex(9);
        assertNull(ChoiceAvailabilityChecker.check(limited, List.of(
                cond("KEYS", "gate", "open", "=")), cctx(new HashMap<>())).registryLock());
        assertNull(ChoiceAvailability.OK.registryLock());
        assertNull(ChoiceAvailability.no("X").registryLock());
    }

    @Test
    @DisplayName("PendingChoice keeps the legacy 7-arg shape with a null lock")
    void pendingChoiceLegacyShape() {
        assertNull(new PendingChoice("u", 1, "n", "d", null, false, "R").registryLock());
    }
}
