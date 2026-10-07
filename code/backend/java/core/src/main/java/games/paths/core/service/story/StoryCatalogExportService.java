package games.paths.core.service.story;

import java.util.ArrayList;
import java.util.List;

import games.paths.core.model.story.CatalogExportResult;
import games.paths.core.model.story.StorySummary;
import games.paths.core.port.story.CatalogWriterPort;
import games.paths.core.port.story.StoryCatalogExportPort;
import games.paths.core.port.story.StoryQueryPort;

/**
 * StoryCatalogExportService - v0.37.6 writes the public story list of every
 * configured language through the {@link CatalogWriterPort}.
 */
public class StoryCatalogExportService implements StoryCatalogExportPort {

    private final StoryQueryPort storyQueryPort;
    private final CatalogWriterPort writer;
    private final List<String> langs;

    public StoryCatalogExportService(StoryQueryPort storyQueryPort, CatalogWriterPort writer, List<String> langs) {
        this.storyQueryPort = storyQueryPort;
        this.writer = writer;
        this.langs = langs == null || langs.isEmpty() ? List.of("en") : List.copyOf(langs);
    }

    @Override
    public CatalogExportResult exportCatalog() {
        if (!writer.isConfigured()) {
            throw new CatalogNotConfiguredException();
        }
        List<CatalogExportResult.CatalogFile> files = new ArrayList<>();
        for (String lang : langs) {
            List<StorySummary> stories = storyQueryPort.listPublicStories(lang);
            String path = StoryCatalogExportPort.pathFor(lang);
            int bytes = writer.write(path, stories);
            files.add(new CatalogExportResult.CatalogFile(lang, path, stories.size(), bytes));
        }
        return new CatalogExportResult(writer.target(), files);
    }
}
