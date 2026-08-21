package games.paths.adapters.rest.controller.match;

import games.paths.adapters.rest.dto.DropItemRequest;
import games.paths.adapters.rest.dto.DropItemResponse;
import games.paths.adapters.rest.dto.ExecuteEventResponse;
import games.paths.adapters.rest.dto.InventoryResponse;
import games.paths.adapters.rest.dto.ResourcesResponse;
import games.paths.adapters.rest.dto.UseItemRequest;
import games.paths.core.port.match.InventoryPort;
import games.paths.core.port.match.InventoryPort.InventoryException;

import jakarta.servlet.http.HttpServletRequest;

import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.*;

import java.util.LinkedHashMap;
import java.util.Map;

/**
 * InventoryController - REST adapter for the inventory (Step 34) and the resources
 * (Step 35) of the calling character.
 *
 * <ul>
 *   <li>GET  /api/gameplay/&#123;uuidMatch&#125;/inventory — what the caller carries</li>
 *   <li>POST /api/gameplay/&#123;uuidMatch&#125;/inventory/use-item — consume one item</li>
 *   <li>POST /api/gameplay/&#123;uuidMatch&#125;/inventory/drop-item — discard one item</li>
 *   <li>GET  /api/gameplay/&#123;uuidMatch&#125;/resources — food, magic, coin, weight</li>
 * </ul>
 *
 * <p>Use-item answers with {@link ExecuteEventResponse}, the execute-event payload,
 * because an item carrying a SADNESS effect can trigger the Step 30 overflow or coma —
 * the frontend then reuses its event handler almost unchanged. On that response an item
 * usage reports {@code eventUuid: null} and {@code eventType: null}, and {@code card} is
 * the item's own card.</p>
 *
 * <p>Both request bodies name {@code itemInstanceUuid}: the uuid of the INVENTORY ROW
 * ({@code items[].uuid}), never the story item's {@code items[].itemUuid}.</p>
 */
@RestController
public class InventoryController {

    private final InventoryPort inventoryPort;

    public InventoryController(InventoryPort inventoryPort) {
        this.inventoryPort = inventoryPort;
    }

    @GetMapping("/api/gameplay/{uuidMatch}/inventory")
    public ResponseEntity<Object> inventory(@PathVariable String uuidMatch,
                                            @RequestParam(required = false) String lang,
                                            HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(InventoryResponse.fromModel(
                    inventoryPort.listInventory(uuidMatch, userUuid, lang)));
        } catch (InventoryException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @PostMapping("/api/gameplay/{uuidMatch}/inventory/use-item")
    public ResponseEntity<Object> useItem(@PathVariable String uuidMatch,
                                          @RequestParam(required = false) String lang,
                                          @RequestBody(required = false) UseItemRequest body,
                                          HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        String itemInstanceUuid = body == null ? null : body.getItemInstanceUuid();
        if (itemInstanceUuid == null || itemInstanceUuid.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "MISSING_ITEM", "itemInstanceUuid is required");
        }
        try {
            return ResponseEntity.ok(ExecuteEventResponse.fromModel(
                    inventoryPort.useItem(uuidMatch, userUuid, itemInstanceUuid, lang)));
        } catch (InventoryException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @PostMapping("/api/gameplay/{uuidMatch}/inventory/drop-item")
    public ResponseEntity<Object> dropItem(@PathVariable String uuidMatch,
                                           @RequestBody(required = false) DropItemRequest body,
                                           HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        String itemInstanceUuid = body == null ? null : body.getItemInstanceUuid();
        if (itemInstanceUuid == null || itemInstanceUuid.isBlank()) {
            return error(HttpStatus.BAD_REQUEST, "MISSING_ITEM", "itemInstanceUuid is required");
        }
        try {
            return ResponseEntity.ok(DropItemResponse.fromModel(
                    inventoryPort.dropItem(uuidMatch, userUuid, itemInstanceUuid)));
        } catch (InventoryException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    @GetMapping("/api/gameplay/{uuidMatch}/resources")
    public ResponseEntity<Object> resources(@PathVariable String uuidMatch,
                                            HttpServletRequest request) {
        String userUuid = userUuid(request);
        if (userUuid == null) {
            return error(HttpStatus.UNAUTHORIZED, "UNAUTHENTICATED", "User identity is missing");
        }
        try {
            return ResponseEntity.ok(ResourcesResponse.fromModel(
                    inventoryPort.getResources(uuidMatch, userUuid)));
        } catch (InventoryException ex) {
            return error(mapStatus(ex.getCode()), ex.getCode().name(), ex.getMessage());
        }
    }

    private static String userUuid(HttpServletRequest request) {
        String u = (String) request.getAttribute("userUuid");
        return (u == null || u.isBlank()) ? null : u;
    }

    private static ResponseEntity<Object> error(HttpStatus status, String code, String message) {
        Map<String, Object> body = new LinkedHashMap<>();
        body.put("error", code);
        body.put("message", message);
        body.put("timestamp", System.currentTimeMillis());
        return ResponseEntity.status(status).body(body);
    }

    /** Not-found for a missing entity; conflict for a state the player could act on. */
    private static HttpStatus mapStatus(InventoryException.Code code) {
        return switch (code) {
            case MATCH_NOT_FOUND, ITEM_NOT_FOUND -> HttpStatus.NOT_FOUND;
            case MATCH_NOT_RUNNING, SLEEPING, COMA, ITEM_NOT_CONSUMABLE,
                 ITEM_CLASS_NOT_PERMITTED, ITEM_CLASS_PROHIBITED -> HttpStatus.CONFLICT;
        };
    }
}
