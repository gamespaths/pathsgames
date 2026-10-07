package games.paths.adapters.admin.controller.story;

import java.util.LinkedHashMap;
import java.util.Map;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import games.paths.adapters.admin.AdminConstant;
import games.paths.adapters.admin.dto.story.CatalogExportResponse;
import games.paths.core.port.story.StoryCatalogExportPort;

/**
 * StoryCatalogAdminController - v0.37.6 POST /api/admin/stories/catalog writes
 * the static `data/stories-{lang}.json` files read by the game home page.
 */
@RestController
@RequestMapping("/api/admin/stories")
public class StoryCatalogAdminController {

    private final StoryCatalogExportPort exportPort;

    public StoryCatalogAdminController(StoryCatalogExportPort exportPort) {
        this.exportPort = exportPort;
    }

    @PostMapping("/catalog")
    public ResponseEntity<Object> writeCatalog() {
        try {
            return ResponseEntity.ok(CatalogExportResponse.fromModel(exportPort.exportCatalog()));
        } catch (StoryCatalogExportPort.CatalogNotConfiguredException e) {
            Map<String, String> error = new LinkedHashMap<>();
            error.put(AdminConstant.KEY_ERROR, AdminConstant.CATALOG_TARGET_NOT_CONFIGURED);
            error.put(AdminConstant.KEY_MESSAGE, e.getMessage());
            return ResponseEntity.status(HttpStatus.SERVICE_UNAVAILABLE).body(error);
        }
    }
}
