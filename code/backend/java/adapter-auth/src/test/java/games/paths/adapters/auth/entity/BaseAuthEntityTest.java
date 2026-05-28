package games.paths.adapters.auth.entity;

import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import static org.junit.jupiter.api.Assertions.*;

/**
 * Unit tests for {@link BaseAuthEntity} shared fields and lifecycle.
 * Uses {@link UserTokenEntity} as a concrete implementation.
 */
class BaseAuthEntityTest {

    @Test
    @DisplayName("uuid round-trip via getter/setter")
    void uuidRoundTrip() {
        UserTokenEntity e = new UserTokenEntity();
        assertNull(e.getUuid());
        e.setUuid("test-uuid");
        assertEquals("test-uuid", e.getUuid());
    }

    @Test
    @DisplayName("tsInsert set via protected setter and readable via getter")
    void tsInsertRoundTrip() {
        UserTokenEntity e = new UserTokenEntity();
        assertNull(e.getTsInsert());
        e.onCreate(); // triggers protected setTsInsert
        assertNotNull(e.getTsInsert());
    }

    @Test
    @DisplayName("tsUpdate set via protected setter and readable via getter")
    void tsUpdateRoundTrip() {
        UserTokenEntity e = new UserTokenEntity();
        assertNull(e.getTsUpdate());
        e.onCreate(); // triggers protected setTsUpdate
        assertNotNull(e.getTsUpdate());
    }

    @Test
    @DisplayName("onUpdate refreshes tsUpdate via base class")
    void onUpdateRefreshes() throws InterruptedException {
        UserTokenEntity e = new UserTokenEntity();
        e.onCreate();
        String before = e.getTsUpdate();
        Thread.sleep(2);
        e.onUpdate(); // calls BaseAuthEntity.onUpdate()
        assertNotEquals(before, e.getTsUpdate());
    }

    @Test
    @DisplayName("UserEntity inherits BaseAuthEntity fields")
    void userEntityInherits() {
        UserEntity e = new UserEntity();
        e.setUuid("u-inherit");
        assertEquals("u-inherit", e.getUuid());

        e.onCreate();
        assertNotNull(e.getTsInsert());
        assertNotNull(e.getTsUpdate());
    }
}
