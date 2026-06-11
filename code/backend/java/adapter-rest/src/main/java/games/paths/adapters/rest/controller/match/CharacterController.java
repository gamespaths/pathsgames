package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.CharacterInstanceResponse;
import games.paths.adapters.rest.dto.CharacterSummaryResponse;
import games.paths.adapters.rest.dto.JoinMatchRequest;
import games.paths.core.model.match.CharacterInstanceInfo;
import games.paths.core.model.match.JoinMatchCommand;
import games.paths.core.port.match.CharacterCommandPort;
import games.paths.core.port.match.CharacterQueryPort;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;

/**
 * CharacterController - REST adapter for the Step 21 character endpoints.
 *
 * <ul>
 *   <li>POST /api/matches/&#123;uuidMatch&#125;/join — join a match, instantiate a character</li>
 *   <li>GET  /api/match/&#123;uuidMatch&#125;/players — list the characters of a match</li>
 *   <li>GET  /api/match/&#123;uuidMatch&#125;/characters/&#123;uuidCharacter&#125; — character detail</li>
 * </ul>
 *
 * <p>Step 21 — see {@code documentation_v0/Step21_CharacterSelection.md}.</p>
 */
@RestController
public class CharacterController {

    private final CharacterCommandPort characterCommandPort;
    private final CharacterQueryPort characterQueryPort;

    public CharacterController(CharacterCommandPort characterCommandPort,
                              CharacterQueryPort characterQueryPort) {
        this.characterCommandPort = characterCommandPort;
        this.characterQueryPort = characterQueryPort;
    }

    @PostMapping("/api/matches/{uuidMatch}/join")
    public ResponseEntity<Object> join(@PathVariable String uuidMatch,
                                       @RequestBody(required = false) JoinMatchRequest body,
                                       HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        JoinMatchCommand command = new JoinMatchCommand(
                uuidMatch,
                userUuid,
                body != null ? body.getCharacterTemplateUuid() : null,
                body != null ? body.getClassUuid() : null,
                body != null ? body.getTraitUuids() : null);
        try {
            CharacterInstanceInfo created = characterCommandPort.join(command);
            return ResponseEntity.status(HttpStatus.CREATED)
                    .body(CharacterInstanceResponse.fromModel(created));
        } catch (CharacterCommandPort.CharacterJoinException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @GetMapping("/api/match/{uuidMatch}/players")
    public ResponseEntity<Object> listPlayers(@PathVariable String uuidMatch,
                                              HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (isBlank(uuidMatch)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT", "Match uuid is required");
        }
        List<CharacterInstanceInfo> players = characterQueryPort.listPlayers(uuidMatch, userUuid);
        if (players == null) {
            return error(HttpStatus.NOT_FOUND, "MATCH_NOT_FOUND",
                    "Match not found or not accessible");
        }
        List<CharacterSummaryResponse> result = players.stream()
                .map(CharacterSummaryResponse::fromModel)
                .collect(Collectors.toList());
        return ResponseEntity.ok(result);
    }

    @GetMapping("/api/match/{uuidMatch}/characters/{uuidCharacter}")
    public ResponseEntity<Object> getCharacter(@PathVariable String uuidMatch,
                                               @PathVariable String uuidCharacter,
                                               HttpServletRequest request) {
        String userUuid = (String) request.getAttribute("userUuid");
        if (userUuid == null || userUuid.isBlank()) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED",
                    "User identity is missing from the request");
        }
        if (isBlank(uuidMatch) || isBlank(uuidCharacter)) {
            return error(HttpStatus.BAD_REQUEST, "INVALID_INPUT",
                    "Match uuid and character uuid are required");
        }
        CharacterInstanceInfo character = characterQueryPort.getCharacter(uuidMatch, uuidCharacter, userUuid);
        if (character == null) {
            return error(HttpStatus.NOT_FOUND, "CHARACTER_NOT_FOUND",
                    "Character not found or not accessible");
        }
        return ResponseEntity.ok(CharacterInstanceResponse.fromModel(character));
    }

    private static boolean isBlank(String s) {
        return s == null || s.isBlank();
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }

    private static HttpStatus mapStatus(CharacterCommandPort.CharacterJoinException.Code code) {
        return switch (code) {
            case MATCH_NOT_FOUND, TEMPLATE_NOT_FOUND, CLASS_NOT_FOUND, USER_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case USER_BANNED -> HttpStatus.FORBIDDEN;
            case ALREADY_JOINED, CLASS_NOT_COMPATIBLE, MATCH_NOT_JOINABLE -> HttpStatus.CONFLICT;
            case INVALID_INPUT, TRAIT_NOT_FOUND, TRAIT_DUPLICATED,
                 TRAIT_NOT_COMPATIBLE, TRAIT_COST_EXCEEDED -> HttpStatus.BAD_REQUEST;
        };
    }
}
