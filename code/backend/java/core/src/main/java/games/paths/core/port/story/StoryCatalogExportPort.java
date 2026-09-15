package games.paths.core.port.story;

import games.paths.core.model.story.CatalogExportResult;

/**
 * StoryCatalogExportPort - v0.37.6 inbound port: (re)writes the static catalog
 * files `data/stories-{lang}.json` read by the game home page.
 */
public interface StoryCatalogExportPort {

    /** Relative path of the file for a language. */
    static String pathFor(String lang) {
        return "data/stories-" + lang + ".json";
    }

    /** Writes every configured language. */
    CatalogExportResult exportCatalog();

    /** Thrown when the backend has no export destination configured. */
    class CatalogNotConfiguredException extends RuntimeException {
        public CatalogNotConfiguredException() {
            super("No static catalog destination configured (CATALOG_EXPORT_DIR / WEBSITE_BUCKET)");
        }
    }
}
