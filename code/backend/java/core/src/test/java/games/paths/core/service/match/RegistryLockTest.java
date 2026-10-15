package games.paths.core.service.match;

import games.paths.core.entity.story.KeyEntity;
import games.paths.core.model.match.RegistryLock;
import games.paths.core.model.story.CardInfo;
import games.paths.core.port.match.RegistryStorePort;
import games.paths.core.port.story.ContentQueryPort;
import games.paths.core.port.story.StoryReadPort;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.params.ParameterizedTest;
import org.junit.jupiter.params.provider.CsvSource;

import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** V1 step 1 - the registry lock: the mode table and the visibility filter. */
@DisplayName("RegistryService lock (V1 step 1)")
class RegistryLockTest {

    // ── the mode table (same rows on Python and AWS) ────────────────────────

    @ParameterizedTest(name = "[{index}] {1} {2} over {3} -> {4} {5} {6}")
    @CsvSource(nullValues = "NULL", delimiter = '|', value = {
            "gate | =    | open | ''        | MISSING   | =  | open",
            "gate | NULL | open | ''        | MISSING   | =  | open",
            "gate | ' '  | open | closed    | MISSING   | =  | open",
            "gate | >    | 5    | 3         | MISSING   | >  | 5",
            "gate | <    | 5    | 7         | MISSING   | <  | 5",
            "gate | !=   | open | OPEN      | FORBIDDEN | != | OPEN",
            "gate | !=   | open | 'a,Open'  | FORBIDDEN | != | Open",
    })
    void modeTable(String key, String op, String expected, String actualCsv,
                   String mode, String operator, String value) {
        List<String> actual = actualCsv.isEmpty() ? List.of() : List.of(actualCsv.split(","));
        RegistryLock lock = RegistryService.lock(key, op, expected, actual);
        assertEquals(mode, lock.mode());
        assertFalse(lock.hidden());
        assertEquals("gate", lock.key());
        assertNull(lock.keyTitle());
        assertEquals(operator, lock.operator());
        assertEquals(value, lock.value());
    }

    @ParameterizedTest(name = "[{index}] authoring error {0} {1} {2}")
    @CsvSource(nullValues = "NULL", value = {
            "gate, ~,  open",
            "gate, =,  NULL",
            "gate, >,  abc",
            "gate, <,  NULL",
            "NULL, =,  open",
            "' ',  =,  open",
    })
    void authoringErrorIsGeneric(String key, String op, String expected) {
        RegistryLock lock = RegistryService.lock(key, op, expected, List.of());
        assertEquals(RegistryLock.generic(), lock);
        assertEquals(RegistryLock.MODE_MISSING, lock.mode());
        assertFalse(lock.hidden());
        assertNull(lock.key());
        assertNull(lock.operator());
        assertNull(lock.value());
    }

    @Test
    @DisplayName("!= with no matching member falls back to the expected value; null actual is empty")
    void forbiddenFallsBackToExpected() {
        assertEquals(" x ".trim(), RegistryService.lock("k", "!=", " x ", null).value());
        assertEquals("k", RegistryService.lock(" k ", "=", "v", null).key());
    }

    @Test
    @DisplayName("asHidden keeps the mode and blanks every key field")
    void asHidden() {
        RegistryLock h = new RegistryLock("FORBIDDEN", false, "k", "t", "!=", "v").asHidden();
        assertEquals(new RegistryLock("FORBIDDEN", true, null, null, null, null), h);
    }

    // ── the visibility filter ───────────────────────────────────────────────

    private StoryReadPort storyReadPort;
    private ContentQueryPort contentQueryPort;
    private RegistryService service;

    @BeforeEach
    void wire() {
        storyReadPort = mock(StoryReadPort.class);
        contentQueryPort = mock(ContentQueryPort.class);
        service = new RegistryService(mock(RegistryStorePort.class), storyReadPort, contentQueryPort);
    }

    private static KeyEntity def(String name, String visibility, Integer idCard) {
        KeyEntity k = new KeyEntity();
        k.setName(name);
        k.setVisibility(visibility);
        k.setIdCard(idCard);
        return k;
    }

    private static CardInfo card(String title) {
        return new CardInfo("c", null, null, null, null, null, null, null, null, null,
                title, null, null, null, null);
    }

    private static RegistryLock raw(String key) {
        return RegistryService.lock(key, "!=", "open", List.of("open"));
    }

    @Test
    @DisplayName("a PUBLIC key keeps its fields and gains its card title, read once")
    void publicKeyWithCard() {
        when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(def("gate", " public ", 4)));
        when(contentQueryPort.getCardByStoryIdAndCardId(9L, 4, "it")).thenReturn(card("Chiave"));

        RegistryService.LockView view = service.lockView(9L, "it");
        RegistryLock a = view.apply(raw("gate"));
        view.apply(raw("gate"));

        assertEquals(new RegistryLock("FORBIDDEN", false, "gate", "Chiave", "!=", "open"), a);
        verify(storyReadPort, times(1)).findKeysByStoryId(9L);
        verify(contentQueryPort, times(1)).getCardByStoryIdAndCardId(9L, 4, "it");
    }

    @Test
    @DisplayName("a PUBLIC key with no card has no title; a missing card reads as no title")
    void publicKeyWithoutCard() {
        when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(
                def("plain", "PUBLIC", null), def("lost", "PUBLIC", 8)));

        RegistryService.LockView view = service.lockView(9L, "en");

        assertNull(view.apply(raw("plain")).keyTitle());
        assertEquals("plain", view.apply(raw("plain")).key());
        assertNull(view.apply(raw("lost")).keyTitle());
        assertNull(view.apply(raw("lost")).keyTitle());
        verify(contentQueryPort, times(1)).getCardByStoryIdAndCardId(9L, 8, "en");
    }

    @Test
    @DisplayName("a non-PUBLIC, null-visibility or undeclared key is hidden")
    void hiddenKeys() {
        when(storyReadPort.findKeysByStoryId(9L)).thenReturn(List.of(
                def("secret", "PRIVATE", 4), def("blank", null, null)));
        RegistryService.LockView view = service.lockView(9L, "en");

        for (String key : List.of("secret", "blank", "undeclared")) {
            RegistryLock lock = view.apply(raw(key));
            assertTrue(lock.hidden(), key);
            assertEquals("FORBIDDEN", lock.mode());
            assertNull(lock.key());
            assertNull(lock.value());
        }
        verify(contentQueryPort, never()).getCardByStoryIdAndCardId(anyLong(), anyInt(), anyString());
    }

    @Test
    @DisplayName("null and keyless locks pass through without reading the definitions")
    void passThrough() {
        RegistryService.LockView view = service.lockView(9L, "en");
        assertNull(view.apply(null));
        assertEquals(RegistryLock.generic(), view.apply(RegistryLock.generic()));
        verify(storyReadPort, never()).findKeysByStoryId(anyLong());
    }

    @Test
    @DisplayName("an unwired service, or a bare one, hides every named key")
    void unwired() {
        assertTrue(RegistryService.lockViewOf(null, 9L, "en").apply(raw("gate")).hidden());
        assertTrue(RegistryService.lockViewOf(mock(RegistryService.class), 9L, "en")
                .apply(raw("gate")).hidden());
        RegistryService bare = new RegistryService(mock(RegistryStorePort.class));
        assertTrue(RegistryService.lockViewOf(bare, 9L, "en").apply(raw("gate")).hidden());
        assertTrue(RegistryService.LockView.hideAll().apply(raw("gate")).hidden());
        assertNotNull(new RegistryService.LockView(Map::of, id -> null));
    }
}
