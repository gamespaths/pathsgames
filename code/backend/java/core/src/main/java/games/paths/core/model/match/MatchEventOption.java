package games.paths.core.model.match;

/**
 * MatchEventOption - Lightweight projection of an event or choice
 * available for the active character at the current location.
 * Step 19: GET /match/{uuid}/info embeds these lists so the frontend
 * can render the option panel.
 */
public class MatchEventOption {

    private String uuid;
    private String name;
    private String type;

    public MatchEventOption() {
    }

    public MatchEventOption(String uuid, String name, String type) {
        this.uuid = uuid;
        this.name = name;
        this.type = type;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getType() { return type; }
    public void setType(String type) { this.type = type; }
}
