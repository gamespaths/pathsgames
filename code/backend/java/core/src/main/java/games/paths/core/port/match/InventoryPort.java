package games.paths.core.port.match;

import games.paths.core.model.match.ItemInstanceInfo;

import java.util.List;

/**
 * InventoryPort - Inbound port of the Step 34 inventory and Step 35 resources.
 *
 * <p>Four operations, all scoped to the character of the calling user: list what
 * it carries, use one item, drop one item, read its resources.</p>
 */
public interface InventoryPort {

    /** The caller's inventory, with the localised item cards resolved. */
    InventoryView listInventory(String matchUuid, String userUuid, String lang);

    /**
     * Consumes one item. Answers with the very same payload {@code execute-event}
     * returns, because an item carrying a SADNESS effect can trigger the Step 30
     * overflow or coma and the frontend then reuses its event handler unchanged.
     */
    EventExecutionPort.EventExecutionResult useItem(String matchUuid, String userUuid,
                                                    String itemInstanceUuid, String lang);

    /** Discards one item. No recipient: transferring an item to another character is multiplayer. */
    DropItemResult dropItem(String matchUuid, String userUuid, String itemInstanceUuid);

    /** Step 35 — food, magic, coin and the carried weight of the calling character. */
    ResourcesView getResources(String matchUuid, String userUuid);

    record InventoryView(String matchUuid, String characterUuid,
                         List<ItemInstanceInfo> items, int weight, int weightMax) {
    }

    record DropItemResult(String matchUuid, String characterUuid,
                          String itemInstanceUuid, String itemUuid,
                          int amountDropped, int weight, int weightMax) {
    }

    /** Plain numbers: resources are not story entities and have no {@code id_card}. */
    record ResourcesView(String matchUuid, String characterUuid,
                         int food, int magic, int coin, int weight, int weightMax) {
    }

    /**
     * Failure of an inventory operation.
     *
     * <p>Deliberately a separate enum from {@code EventExecutionException.Code}:
     * those values double as the {@code reason} of an unavailable event on
     * {@code /info}, where {@code ITEM_NOT_CONSUMABLE} would mean nothing.</p>
     */
    class InventoryException extends RuntimeException {

        public enum Code {
            /** Unknown match, unknown user, or the caller owns no character in it. */
            MATCH_NOT_FOUND,
            MATCH_NOT_RUNNING,
            SLEEPING,
            COMA,
            /** Unknown row uuid — or a row belonging to another character, masked as unknown. */
            ITEM_NOT_FOUND,
            ITEM_NOT_CONSUMABLE,
            ITEM_CLASS_NOT_PERMITTED,
            ITEM_CLASS_PROHIBITED,
            /**
             * v0.35.1 — the character carries fewer units than {@code amount_use} spends.
             * Only use-item can answer this: a drop takes what is there instead.
             */
            ITEM_NOT_ENOUGH
        }

        private final transient Code code;

        public InventoryException(Code code, String message) {
            super(message);
            this.code = code;
        }

        public Code getCode() {
            return code;
        }
    }
}
