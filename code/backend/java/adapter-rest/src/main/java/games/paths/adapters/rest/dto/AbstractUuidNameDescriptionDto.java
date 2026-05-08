package games.paths.adapters.rest.dto;

public abstract class AbstractUuidNameDescriptionDto {

    private String uuid;
    private String name;
    private String description;

    protected AbstractUuidNameDescriptionDto() {
    }

    protected AbstractUuidNameDescriptionDto(String uuid, String name, String description) {
        this.uuid = uuid;
        this.name = name;
        this.description = description;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getName() { return name; }
    public void setName(String name) { this.name = name; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }
}