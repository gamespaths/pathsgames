package games.paths.core.entity.match;

import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * CharacterEntitiesTest - covers the {@code @PrePersist}/{@code @PreUpdate}
 * hooks and the composite-key equals/hashCode of the Step 21 entities.
 */
class CharacterEntitiesTest {

    @Test
    void characterInstance_onCreate_appliesDefaults() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        e.onCreate();
        assertNotNull(e.getUuid());
        assertEquals(1, e.getDexterity());
        assertEquals(1, e.getIntelligence());
        assertEquals(1, e.getConstitution());
        assertEquals(0, e.getEnergy());
        assertEquals(1, e.getLife());
        assertEquals(0, e.getSad());
        assertFalse(e.getIsSleeping());
        assertFalse(e.getIsComa());
        assertEquals(0, e.getClockInComa());
        assertEquals(0, e.getCounterConsecutivePass());
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void characterInstance_onCreate_keepsExistingValues() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        e.setUuid("keep");
        e.setDexterity(9);
        e.setLife(50);
        e.setTsInsert("t0");
        e.onCreate();
        assertEquals("keep", e.getUuid());
        assertEquals(9, e.getDexterity());
        assertEquals(50, e.getLife());
        assertEquals("t0", e.getTsInsert());
    }

    @Test
    void characterInstance_onUpdate_setsTsUpdate() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        e.onUpdate();
        assertNotNull(e.getTsUpdate());
    }

    @Test
    void backpack_onCreate_appliesDefaults() {
        GamingBackpackResourcesEntity b = new GamingBackpackResourcesEntity();
        b.onCreate();
        assertNotNull(b.getUuid());
        assertEquals(0, b.getFood());
        assertEquals(0, b.getMagic());
        assertEquals(0, b.getCoin());
        assertNotNull(b.getTsInsert());
        b.onUpdate();
        assertNotNull(b.getTsUpdate());
    }

    @Test
    void traits_onCreate_appliesDefaults() {
        GamingCharacterTraitsEntity t = new GamingCharacterTraitsEntity();
        t.onCreate();
        assertNotNull(t.getUuid());
        assertNotNull(t.getTsInsert());
        t.onUpdate();
        assertNotNull(t.getTsUpdate());
    }

    @Test
    void compositeIds_equalsAndHashCode() {
        assertEquals(new GamingCharacterInstanceEntityId(1L, 2L), new GamingCharacterInstanceEntityId(1L, 2L));
        assertEquals(new GamingCharacterInstanceEntityId(1L, 2L).hashCode(),
                new GamingCharacterInstanceEntityId(1L, 2L).hashCode());
        assertNotEquals(new GamingCharacterInstanceEntityId(1L, 2L), new GamingCharacterInstanceEntityId(1L, 3L));
        assertNotEquals(new GamingCharacterInstanceEntityId(1L, 2L), "x");
        GamingCharacterInstanceEntityId same = new GamingCharacterInstanceEntityId(1L, 2L);
        assertEquals(same, same);

        assertEquals(new GamingBackpackResourcesEntityId(1L, 2L), new GamingBackpackResourcesEntityId(1L, 2L));
        assertNotEquals(new GamingBackpackResourcesEntityId(1L, 2L), new GamingBackpackResourcesEntityId(3L, 2L));
        assertNotEquals(new GamingBackpackResourcesEntityId(1L, 2L), null);

        assertEquals(new GamingCharacterTraitsEntityId(1L, 2L), new GamingCharacterTraitsEntityId(1L, 2L));
        assertNotEquals(new GamingCharacterTraitsEntityId(1L, 2L), new GamingCharacterTraitsEntityId(1L, 9L));
    }

    @Test
    void compositeId_settersGetters() {
        GamingCharacterInstanceEntityId id = new GamingCharacterInstanceEntityId();
        id.setId(5L);
        id.setIdMatch(6L);
        assertEquals(5L, id.getId());
        assertEquals(6L, id.getIdMatch());
        GamingBackpackResourcesEntityId b = new GamingBackpackResourcesEntityId();
        b.setId(1L); b.setIdMatch(2L);
        assertEquals(1L, b.getId());
        assertEquals(2L, b.getIdMatch());
        GamingCharacterTraitsEntityId t = new GamingCharacterTraitsEntityId();
        t.setId(3L); t.setIdMatch(4L);
        assertEquals(3L, t.getId());
        assertEquals(4L, t.getIdMatch());
    }

    @Test
    void characterInstance_onCreate_leavesEveryValueTheCallerAlreadySet() {
        GamingCharacterInstanceEntity e = new GamingCharacterInstanceEntity();
        e.setDexterity(9);
        e.setIntelligence(8);
        e.setConstitution(7);
        e.setEnergy(6);
        e.setLife(5);
        e.setSad(4);
        e.setLifeMax(100);
        e.setEnergyMax(90);
        e.setSadMax(80);
        e.setWeightMax(70);
        e.setIsSleeping(true);
        e.setIsComa(true);
        e.setClockInComa(3);
        e.setCounterConsecutivePass(2);
        e.setExp(11);

        e.onCreate();

        assertAll(
                () -> assertEquals(9, e.getDexterity()),
                () -> assertEquals(8, e.getIntelligence()),
                () -> assertEquals(7, e.getConstitution()),
                () -> assertEquals(6, e.getEnergy()),
                () -> assertEquals(5, e.getLife()),
                () -> assertEquals(4, e.getSad()),
                () -> assertEquals(100, e.getLifeMax()),
                () -> assertEquals(90, e.getEnergyMax()),
                () -> assertEquals(80, e.getSadMax()),
                () -> assertEquals(70, e.getWeightMax()),
                () -> assertTrue(e.getIsSleeping()),
                () -> assertTrue(e.getIsComa()),
                () -> assertEquals(3, e.getClockInComa()),
                () -> assertEquals(2, e.getCounterConsecutivePass()),
                () -> assertEquals(11, e.getExp()));
    }
}
