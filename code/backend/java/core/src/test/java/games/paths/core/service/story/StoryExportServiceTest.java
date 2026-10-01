package games.paths.core.service.story;

import games.paths.core.port.story.StoryCrudPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;

import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.anyString;
import static org.mockito.ArgumentMatchers.eq;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** v0.41.4 — the server-side story export: the react-admin export shape, and its fingerprint. */
@DisplayName("StoryExportService + StoryFingerprint (v0.41.4)")
class StoryExportServiceTest {

    private static Map<String, Object> m(Object... kv) {
        Map<String, Object> out = new LinkedHashMap<>();
        for (int i = 0; i < kv.length; i += 2) {
            out.put((String) kv[i], kv[i + 1]);
        }
        return out;
    }

    @Test
    void exportsTheHeaderAndTheTwentyTwoListsLikeReactAdmin() {
        StoryCrudPort crud = mock(StoryCrudPort.class);
        when(crud.getStory("s1")).thenReturn(m("uuid", "s1", "id", 9, "author", null, "tsInsert", "t", "tsUpdate", "u",
                "idTextTitle", 10));
        when(crud.listEntities(eq("s1"), anyString())).thenReturn(List.of());
        when(crud.listEntities("s1", "texts")).thenReturn(List.of(m("idText", "10", "lang", "en", "shortText", "T",
                "tsInsert", "x", "idStory", 9, "uuid", "t1", "longText", null)));
        when(crud.listEntities("s1", "locations")).thenReturn(List.of(m("id", 1, "uuid", "l1", "idStory", 9)));
        when(crud.listEntities("s1", "classes")).thenReturn(null);
        when(crud.getStory("missing")).thenReturn(null);
        Map<String, Object> data = new StoryExportService(crud).exportStory("s1");
        assertEquals(22, StoryExportService.ENTITY_TYPES.size());
        assertFalse(data.containsKey("tsInsert"));
        assertFalse(data.containsKey("author"));
        assertEquals(List.of(Map.of("idText", 10L, "lang", "en", "shortText", "T", "uuid", "t1", "id", 10L)),
                data.get("texts"));
        assertEquals(List.of(Map.of("id", 1, "uuid", "l1")), data.get("locations"));
        assertEquals(List.of(), data.get("classes"));
        assertTrue(data.containsKey("missionSteps"));
        assertNull(new StoryExportService(crud).exportStory("missing"));
        assertNull(StoryExportService.asLong("abc"));
    }

    @Test
    void fingerprintIgnoresUuidsStampsOrderAndTheServerId() {
        Map<String, Object> a = m("uuid", "s1", "id", 9, "idStory", 9, "title", "x",
                "texts", List.of(m("idText", 2, "lang", "it"), m("idText", 2, "lang", "en"), m("idText", 1, "lang", "en")),
                "locations", List.of(m("id", 2, "uuid", "b"), m("id", 1, "uuid", "a", "tsInsert", "t")),
                "events", List.of(m("name", "b"), m("name", "a")), "tags", List.of("z", "a"));
        Map<String, Object> b = m("title", "x", "id", 1, "uuid", "other",
                "texts", List.of(m("idText", 1, "lang", "en"), m("idText", 2, "lang", "en"), m("idText", 2, "lang", "it")),
                "locations", List.of(m("id", 1, "uuid", "c"), m("id", 2, "uuid", "d", "note", null)),
                "events", List.of(m("name", "a"), m("name", "b")), "tags", List.of("z", "a"));
        assertEquals(StoryFingerprint.of(a), StoryFingerprint.of(b));
        b.put("title", "y");
        assertNotEquals(StoryFingerprint.of(a), StoryFingerprint.of(b));
        assertFalse(StoryFingerprint.projection(a).containsKey("id"));
        assertEquals(64, StoryFingerprint.of(null).length());
        Map<String, Object> mixed = new HashMap<>(Map.of("rows", List.of(m("id", "b"), m("id", 2), m("id", "a"), m())));
        @SuppressWarnings("unchecked")
        List<Map<String, Object>> sorted = (List<Map<String, Object>>) StoryFingerprint.projection(mixed).get("rows");
        assertEquals(List.of(Map.of(), Map.of("id", 2), Map.of("id", "a"), Map.of("id", "b")), sorted);
    }
}
