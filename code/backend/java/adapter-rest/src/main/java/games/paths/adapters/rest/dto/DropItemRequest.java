package games.paths.adapters.rest.dto;

/**
 * DropItemRequest - body of POST /api/gameplay/{uuidMatch}/inventory/drop-item (Step 34).
 */
public class DropItemRequest {

    /** The uuid of the INVENTORY ROW ({@code items[].uuid}), see {@link UseItemRequest}. */
    private String itemInstanceUuid;

    public String getItemInstanceUuid() {
        return itemInstanceUuid;
    }

    public void setItemInstanceUuid(String itemInstanceUuid) {
        this.itemInstanceUuid = itemInstanceUuid;
    }
}
