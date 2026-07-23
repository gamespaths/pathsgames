package games.paths.adapters.rest.dto;

/**
 * SelectChoiceRequest - body of POST /api/gameplay/{uuidMatch}/action/select-choice (Step 32).
 *
 * <p>The option alone identifies the resolution: a choice knows the event that owns it
 * ({@code list_choices.id_event}), so asking the caller to name the event too would only
 * create a second version of the truth that could disagree with the first.</p>
 */
public class SelectChoiceRequest {

    /** The uuid of the option the player picked, as served in {@code pendingChoices[]}. */
    private String choiceUuid;

    public String getChoiceUuid() {
        return choiceUuid;
    }

    public void setChoiceUuid(String choiceUuid) {
        this.choiceUuid = choiceUuid;
    }
}
