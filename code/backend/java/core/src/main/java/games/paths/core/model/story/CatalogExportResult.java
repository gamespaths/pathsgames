package games.paths.core.model.story;

import java.util.List;

/**
 * CatalogExportResult - v0.37.6 outcome of a static catalog export: where the
 * files went and one entry per written language.
 */
public record CatalogExportResult(String target, List<CatalogFile> files) {

    /** One written catalog file. */
    public record CatalogFile(String lang, String path, int count, int bytes) {}
}
