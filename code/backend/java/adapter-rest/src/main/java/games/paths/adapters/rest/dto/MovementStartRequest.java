package games.paths.adapters.rest.dto;

/**
 * Request body for {@code POST /api/gameplay/{uuidMatch}/movements/start} (Step 28).
 * The target adjacent location is identified by its location uuid.
 */
public class MovementStartRequest {

    private String targetLocationUuid;

    public String getTargetLocationUuid() { return targetLocationUuid; }
    public void setTargetLocationUuid(String targetLocationUuid) { this.targetLocationUuid = targetLocationUuid; }
}
