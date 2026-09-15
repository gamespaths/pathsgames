package games.paths.core.service.story;

import games.paths.core.model.story.CatalogExportResult;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.CatalogWriterPort;
import games.paths.core.port.story.StoryCatalogExportPort;
import games.paths.core.port.story.StoryQueryPort;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.extension.ExtendWith;
import org.mockito.Mock;
import org.mockito.junit.jupiter.MockitoExtension;

import java.util.List;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.*;
import static org.mockito.Mockito.*;

/** Unit tests for {@link StoryCatalogExportService} (v0.37.6). */
@ExtendWith(MockitoExtension.class)
class StoryCatalogExportServiceTest {

    @Mock private StoryQueryPort queryPort;
    @Mock private CatalogWriterPort writer;

    private static StorySummary story(String uuid) {
        return new StorySummary(uuid, "T", "D", "A", "cat", "grp", "PUBLIC", 1, 0, 1, null);
    }

    @Test
    @DisplayName("Writes one file per language with the public list and reports count/bytes")
    void exportsEveryLanguage() {
        when(writer.isConfigured()).thenReturn(true);
        when(writer.target()).thenReturn("/srv/site");
        when(queryPort.listPublicStories("en")).thenReturn(List.of(story("a"), story("b")));
        when(queryPort.listPublicStories("it")).thenReturn(List.of(story("a")));
        when(writer.write(eq("data/stories-en.json"), anyList())).thenReturn(200);
        when(writer.write(eq("data/stories-it.json"), anyList())).thenReturn(100);

        CatalogExportResult r = new StoryCatalogExportService(queryPort, writer, List.of("en", "it")).exportCatalog();

        assertEquals("/srv/site", r.target());
        assertEquals(2, r.files().size());
        assertEquals(new CatalogExportResult.CatalogFile("en", "data/stories-en.json", 2, 200), r.files().get(0));
        assertEquals(new CatalogExportResult.CatalogFile("it", "data/stories-it.json", 1, 100), r.files().get(1));
    }

    @Test
    @DisplayName("Null or empty language list falls back to English only")
    void defaultsToEnglish() {
        when(writer.isConfigured()).thenReturn(true);
        when(queryPort.listPublicStories("en")).thenReturn(List.of());
        when(writer.write(anyString(), anyList())).thenReturn(2);

        assertEquals(1, new StoryCatalogExportService(queryPort, writer, null).exportCatalog().files().size());
        assertEquals(1, new StoryCatalogExportService(queryPort, writer, List.of()).exportCatalog().files().size());
        verify(queryPort, times(2)).listPublicStories("en");
    }

    @Test
    @DisplayName("Unconfigured writer → CatalogNotConfiguredException, nothing written")
    void refusesWhenNotConfigured() {
        when(writer.isConfigured()).thenReturn(false);
        StoryCatalogExportService svc = new StoryCatalogExportService(queryPort, writer, List.of("en"));

        assertThrows(StoryCatalogExportPort.CatalogNotConfiguredException.class, svc::exportCatalog);
        verify(writer, never()).write(anyString(), anyList());
        verifyNoInteractions(queryPort);
    }

    @Test
    @DisplayName("pathFor builds data/stories-{lang}.json")
    void pathFor() {
        assertEquals("data/stories-fr.json", StoryCatalogExportPort.pathFor("fr"));
    }
}
