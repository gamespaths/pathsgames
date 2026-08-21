package games.paths.adapters.rest.dto;

/**
 * UseItemRequest - body of POST /api/gameplay/{uuidMatch}/inventory/use-item (Step 34).
 */
public class UseItemRequest {

    /**
     * The uuid of the INVENTORY ROW, i.e. {@code items[].uuid} — not {@code items[].itemUuid},
     * which is the story item. Use-item removes the row, so the row is what it names, and a
     * character can hold two rows of the same item in different states.
     */
    private String itemInstanceUuid;

    public String getItemInstanceUuid() {
        return itemInstanceUuid;
    }

    public void setItemInstanceUuid(String itemInstanceUuid) {
        this.itemInstanceUuid = itemInstanceUuid;
    }
}
