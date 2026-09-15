package games.paths.core.port.story;

import java.util.List;

import games.paths.core.model.story.StorySummary;

/**
 * CatalogWriterPort - v0.37.6 outbound port that serialises a story list and
 * stores it where the game website can read it (local dir, S3, …).
 */
public interface CatalogWriterPort {

    /** False when no destination is configured: the export must refuse to run. */
    boolean isConfigured();

    /** Human-readable destination, e.g. a directory path or `s3://bucket`. */
    String target();

    /** Writes the stories as the `GET /api/stories` JSON body; returns the byte count. */
    int write(String relativePath, List<StorySummary> stories);
}
