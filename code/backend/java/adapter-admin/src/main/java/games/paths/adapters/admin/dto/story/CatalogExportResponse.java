package games.paths.adapters.admin.dto.story;

import java.util.List;

import games.paths.core.model.story.CatalogExportResult;

/**
 * CatalogExportResponse - v0.37.6 body of POST /api/admin/stories/catalog.
 */
public record CatalogExportResponse(String status, String target, List<File> files) {

    public record File(String lang, String path, int count, int bytes) {}

    public static CatalogExportResponse fromModel(CatalogExportResult r) {
        return new CatalogExportResponse("WRITTEN", r.target(),
                r.files().stream().map(f -> new File(f.lang(), f.path(), f.count(), f.bytes())).toList());
    }
}
