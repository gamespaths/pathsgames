package games.paths.adapters.rest.dto;

public abstract class AbstractUuidDescriptionDto {

    private String uuid;
    private String description;

    protected AbstractUuidDescriptionDto() {
    }

    protected AbstractUuidDescriptionDto(String uuid, String description) {
        this.uuid = uuid;
        this.description = description;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}