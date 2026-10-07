package games.paths.adapters.admin.controller.match;

import games.paths.core.port.match.MatchExportPort;
import games.paths.core.port.match.MatchExportPort.MatchExportException;
import org.junit.jupiter.api.DisplayName;
import org.junit.jupiter.api.Test;
import org.springframework.http.HttpHeaders;
import org.springframework.http.ResponseEntity;

import java.nio.charset.StandardCharsets;
import java.util.List;
import java.util.Map;

import static org.junit.jupiter.api.Assertions.*;
import static org.mockito.ArgumentMatchers.any;
import static org.mockito.Mockito.mock;
import static org.mockito.Mockito.when;

/** v0.41.4 — POST /api/admin/matches/{uuid}/export and POST /api/admin/matches/import. */
@DisplayName("MatchExportAdminController (v0.41.4)")
class MatchExportAdminControllerTest {

    private final MatchExportPort port = mock(MatchExportPort.class);
    private final MatchExportAdminController controller = new MatchExportAdminController(port, 100);

    @Test
    void exportAnswersTheFileAsAnAttachment() {
        when(port.exportMatch("m")).thenReturn(new MatchExportPort.ExportResult(Map.of(), "{\"a\":1}", "match-m-clock-3.json"));
        ResponseEntity<Object> r = controller.exportMatch("m");
        assertEquals(200, r.getStatusCode().value());
        assertEquals("attachment; filename=match-m-clock-3.json", r.getHeaders().getFirst(HttpHeaders.CONTENT_DISPOSITION));
        assertEquals("{\"a\":1}", new String((byte[]) r.getBody(), StandardCharsets.UTF_8));
    }

    @Test
    void exportErrorsCarryTheirStatusAndErrors() {
        when(port.exportMatch("m")).thenThrow(new MatchExportException(MatchExportException.Code.SNAPSHOT_INTEGRITY_FAILED,
                "bad", List.of(new MatchExportPort.Issue("USER_MISSING", "user 1"))));
        ResponseEntity<Object> r = controller.exportMatch("m");
        assertEquals(409, r.getStatusCode().value());
        Map<?, ?> body = (Map<?, ?>) r.getBody();
        assertEquals("SNAPSHOT_INTEGRITY_FAILED", body.get("error"));
        assertEquals(1, ((List<?>) body.get("errors")).size());
        when(port.exportMatch("x")).thenThrow(new MatchExportException(MatchExportException.Code.MATCH_NOT_FOUND, "no"));
        ResponseEntity<Object> missing = controller.exportMatch("x");
        assertEquals(404, missing.getStatusCode().value());
        assertFalse(((Map<?, ?>) missing.getBody()).containsKey("errors"));
    }

    @Test
    void importDryRunImportAndRefusals() {
        when(port.check(any())).thenReturn(Map.of("valid", true));
        when(port.importMatch(any())).thenReturn(Map.of("status", "IMPORTED"));
        assertEquals(200, controller.importMatch("{\"dryRun\":true,\"export\":{}}").getStatusCode().value());
        assertEquals(201, controller.importMatch("{\"export\":{}}").getStatusCode().value());
        assertEquals(400, controller.importMatch(null).getStatusCode().value());
        assertEquals(400, controller.importMatch(" ").getStatusCode().value());
        assertEquals(400, controller.importMatch("[1]").getStatusCode().value());
        assertEquals(400, controller.importMatch("{bad").getStatusCode().value());
        assertEquals(413, controller.importMatch("{\"x\":\"" + "y".repeat(5000) + "\"}").getStatusCode().value());
        when(port.importMatch(any())).thenThrow(new MatchExportException(MatchExportException.Code.IMPORT_INVALID, "no",
                List.of(new MatchExportPort.Issue("CHECKSUM_MISMATCH", "x"))));
        ResponseEntity<Object> invalid = controller.importMatch("{\"export\":{}}");
        assertEquals(422, invalid.getStatusCode().value());
        assertEquals("CHECKSUM_MISMATCH", ((Map<?, ?>) ((List<?>) ((Map<?, ?>) invalid.getBody()).get("errors")).get(0)).get("code"));
    }
}
