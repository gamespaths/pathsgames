package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.MatchRegistryResponse;
import games.paths.core.model.match.MatchRegistryGroup;
import games.paths.core.port.match.MatchQueryPort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;

/**
 * RegistryController - REST adapter for the Step 36 registry read.
 * GET /api/match/&#123;uuid&#125;/registry returns the visible keys grouped by category.
 */
@RestController
public class RegistryController {

    private final MatchQueryPort matchQueryPort;

    public RegistryController(MatchQueryPort matchQueryPort) {
        this.matchQueryPort = matchQueryPort;
    }

    @GetMapping("/api/match/{uuidMatch}/registry")
    public ResponseEntity<Object> getRegistry(
            @PathVariable String uuidMatch,
            @RequestParam(value = "lang", defaultValue = "en") String lang,
            @RequestParam(value = "includeHidden", defaultValue = "false") boolean includeHidden,
            HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (uuidMatch == null || uuidMatch.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        List<MatchRegistryGroup> groups =
                matchQueryPort.getMatchRegistry(uuidMatch, userUuid, includeHidden, lang);
        if (groups == null) {
            return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND",
                    "Match not found or not accessible");
        }
        return ResponseEntity.ok(MatchRegistryResponse.fromModel(groups));
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }
}
