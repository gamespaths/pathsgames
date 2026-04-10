package games.paths.adapters.admin.dto.story;

/**
 * StoryImportResponse - REST response DTO for a story import result.
 */
public class StoryImportResponse {

    private String storyUuid;
    private String status;
    private int textsImported;
    private int locationsImported;
    private int eventsImported;
    private int itemsImported;
    private int difficultiesImported;
    private int classesImported;
    private int choicesImported;

    public StoryImportResponse() {}

    public StoryImportResponse(String storyUuid, String status, int textsImported,
                               int locationsImported, int eventsImported, int itemsImported,
                               int difficultiesImported, int classesImported, int choicesImported) {
        this.storyUuid = storyUuid;
        this.status = status;
        this.textsImported = textsImported;
        this.locationsImported = locationsImported;
        this.eventsImported = eventsImported;
        this.itemsImported = itemsImported;
        this.difficultiesImported = difficultiesImported;
        this.classesImported = classesImported;
        this.choicesImported = choicesImported;
    }

    public String getStoryUuid() { return storyUuid; }
    public void setStoryUuid(String storyUuid) { this.storyUuid = storyUuid; }

    public String getStatus() { return status; }
    public void setStatus(String status) { this.status = status; }

    public int getTextsImported() { return textsImported; }
    public void setTextsImported(int textsImported) { this.textsImported = textsImported; }

    public int getLocationsImported() { return locationsImported; }
    public void setLocationsImported(int locationsImported) { this.locationsImported = locationsImported; }

    public int getEventsImported() { return eventsImported; }
    public void setEventsImported(int eventsImported) { this.eventsImported = eventsImported; }

    public int getItemsImported() { return itemsImported; }
    public void setItemsImported(int itemsImported) { this.itemsImported = itemsImported; }

    public int getDifficultiesImported() { return difficultiesImported; }
    public void setDifficultiesImported(int difficultiesImported) { this.difficultiesImported = difficultiesImported; }

    public int getClassesImported() { return classesImported; }
    public void setClassesImported(int classesImported) { this.classesImported = classesImported; }

    public int getChoicesImported() { return choicesImported; }
    public void setChoicesImported(int choicesImported) { this.choicesImported = choicesImported; }
}
