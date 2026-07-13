package games.paths.adapters.rest.dto;

/**
 * ExecuteEventRequest - body of POST /api/gameplay/{uuidMatch}/action/execute-event (Step 29).
 */
public class ExecuteEventRequest {

    /** The uuid of the event the player wants to trigger. */
    private String eventUuid;

    public String getEventUuid() {
        return eventUuid;
    }

    public void setEventUuid(String eventUuid) {
        this.eventUuid = eventUuid;
    }
}
