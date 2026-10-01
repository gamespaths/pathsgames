package games.paths.adapters.admin.controller.match;

import games.paths.core.model.match.export.CanonicalJson;
import games.paths.core.port.match.MatchExportPort;
import games.paths.core.port.match.MatchExportPort.MatchExportException;
import org.springframework.beans.factory.annotation.Value;
import org.springframework.http.HttpHeaders;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.RestController;

import java.nio.charset.StandardCharsets;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * MatchExportAdminController - v0.41.4 Step 41 H: POST /api/admin/matches/{uuidMatch}/export (the neutral
 * file, attachment) and POST /api/admin/matches/import (dry-run 200, import 201). Admin port only.
 */
@RestController
@RequestMapping("/api/admin/matches")
public class MatchExportAdminController {

    private final MatchExportPort port;
    private final long maxBytes;

    public MatchExportAdminController(MatchExportPort port,
                                      @Value("${game.match.export.max-bytes:5000000}") long maxBytes) {
        this.port = port;
        this.maxBytes = maxBytes;
    }

    /** POST /api/admin/matches/{uuidMatch}/export — pauses, exports the latest snapshot, restores, restarts. */
    @PostMapping("/{uuidMatch}/export")
    public ResponseEntity<Object> exportMatch(@PathVariable String uuidMatch) {
        try {
            MatchExportPort.ExportResult result = port.exportMatch(uuidMatch);
            return ResponseEntity.ok()
                    .header(HttpHeaders.CONTENT_DISPOSITION, "attachment; filename=" + result.fileName())
                    .contentType(MediaType.APPLICATION_JSON)
                    .body(result.canonical().getBytes(StandardCharsets.UTF_8));
        } catch (MatchExportException ex) {
            return error(ex);
        }
    }

    /** POST /api/admin/matches/import — body MatchImportRequest; dryRun answers the check only. */
    @PostMapping("/import")
    public ResponseEntity<Object> importMatch(@RequestBody(required = false) String body) {
        if (body == null || body.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Body must be a MatchImportRequest", List.of());
        }
        // A raw guard before parsing; the precise cap is on the canonical export (413 as well).
        if (body.getBytes(StandardCharsets.UTF_8).length > 2 * maxBytes + 4096) {
            return error(HttpStatus.PAYLOAD_TOO_LARGE, "IMPORT_TOO_LARGE",
                    "The export is larger than " + maxBytes + " bytes", List.of());
        }
        if (!(CanonicalJson.parse(body) instanceof Map<?, ?> parsed)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Body must be valid JSON", List.of());
        }
        @SuppressWarnings("unchecked")
        Map<String, Object> request = (Map<String, Object>) parsed;
        try {
            if (Boolean.TRUE.equals(request.get("dryRun"))) {
                return ResponseEntity.ok(port.check(request));
            }
            return ResponseEntity.status(HttpStatus.CREATED).body(port.importMatch(request));
        } catch (MatchExportException ex) {
            return error(ex);
        }
    }

    static ResponseEntity<Object> error(MatchExportException ex) {
        List<Map<String, Object>> errors = ex.getErrors().stream().map(e -> {
            Map<String, Object> row = new LinkedHashMap<>();
            row.put("code", e.code());
            row.put("message", e.message());
            return row;
        }).toList();
        return error(HttpStatus.valueOf(ex.getCode().status()), ex.getCode().name(), ex.getMessage(), errors);
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message,
                                                List<Map<String, Object>> errors) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        if (!errors.isEmpty()) {
            body.put("errors", errors);
        }
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).contentType(MediaType.APPLICATION_JSON).body(body);
    }
}
