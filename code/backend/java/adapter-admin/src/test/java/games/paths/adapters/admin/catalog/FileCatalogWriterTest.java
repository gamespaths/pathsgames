package games.paths.adapters.admin.catalog;

import com.fasterxml.jackson.core.JsonProcessingException;
import com.fasterxml.jackson.databind.ObjectMapper;
import games.paths.core.model.story.CardInfo;
import games.paths.core.model.story.StorySummary;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

import java.io.UncheckedIOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.*;

/** Unit tests for {@link FileCatalogWriter} (v0.37.6). */
class FileCatalogWriterTest {

    private static StorySummary story() {
        CardInfo card = new CardInfo("c1", "story", "http://img", null, "fa-book",
                null, null, null, null, null, "Card", "Desc", "©", "http://c", null);
        return new StorySummary("s1", "Title", "Desc", "Me", "Fantasy", "g", "PUBLIC", 5, 0, 2, card);
    }

    @Test
    @DisplayName("Blank dir → not configured, null target")
    void blankDirNotConfigured() {
        assertFalse(new FileCatalogWriter("", new ObjectMapper()).isConfigured());
        assertFalse(new FileCatalogWriter(null, new ObjectMapper()).isConfigured());
        assertNull(new FileCatalogWriter("  ", new ObjectMapper()).target());
    }

    @Test
    @DisplayName("Writes the REST-shaped JSON array under the dir, creating parents")
    void writesJson(@TempDir Path dir) throws Exception {
        FileCatalogWriter w = new FileCatalogWriter(dir.toString(), new ObjectMapper());
        assertTrue(w.isConfigured());
        assertEquals(dir.toAbsolutePath().toString(), w.target());

        int bytes = w.write("data/stories-en.json", List.of(story()));

        Path file = dir.resolve("data/stories-en.json");
        assertTrue(Files.exists(file));
        assertEquals(Files.size(file), bytes);
        var tree = new ObjectMapper().readTree(file.toFile());
        assertTrue(tree.isArray());
        assertEquals("s1", tree.get(0).get("uuid").asText());
        assertEquals("Title", tree.get(0).get("title").asText());
        assertEquals("http://img", tree.get(0).get("card").get("urlImage").asText());
        assertTrue(tree.get(0).get("card").get("creator").isNull());
    }

    @Test
    @DisplayName("Story without card → card: null")
    void nullCard(@TempDir Path dir) throws Exception {
        FileCatalogWriter w = new FileCatalogWriter(dir.toString(), new ObjectMapper());
        StorySummary s = new StorySummary("s2", "T", null, null, "c", null, "PUBLIC", 0, 0, 0, null);
        w.write("x.json", List.of(s));
        assertTrue(new ObjectMapper().readTree(dir.resolve("x.json").toFile()).get(0).get("card").isNull());
    }

    @Test
    @DisplayName("Serialisation failure → IllegalStateException")
    void serialisationFailure(@TempDir Path dir) throws Exception {
        ObjectMapper broken = mock(ObjectMapper.class);
        when(broken.writeValueAsString(any())).thenThrow(new JsonProcessingException("boom") {});
        FileCatalogWriter w = new FileCatalogWriter(dir.toString(), broken);
        assertThrows(IllegalStateException.class, () -> w.write("x.json", List.of(story())));
    }

    @Test
    @DisplayName("Unwritable path → UncheckedIOException")
    void ioFailure(@TempDir Path dir) throws Exception {
        Path blocker = dir.resolve("data");
        Files.writeString(blocker, "not a dir");
        FileCatalogWriter w = new FileCatalogWriter(dir.toString(), new ObjectMapper());
        assertThrows(UncheckedIOException.class, () -> w.write("data/stories-en.json", List.of(story())));
    }
}
