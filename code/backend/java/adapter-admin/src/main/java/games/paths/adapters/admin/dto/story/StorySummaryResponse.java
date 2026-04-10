package games.paths.adapters.admin.dto.story;

/**
 * StorySummaryResponse - Admin REST response DTO for a story summary.
 */
public class StorySummaryResponse {

    private String uuid;
    private String title;
    private String description;
    private String author;
    private String category;
    private String group;
    private String visibility;
    private Integer priority;
    private Integer peghi;
    private int difficultyCount;

    public StorySummaryResponse() {}

    public StorySummaryResponse(String uuid, String title, String description, String author,
                                String category, String group, String visibility,
                                Integer priority, Integer peghi, int difficultyCount) {
        this.uuid = uuid;
        this.title = title;
        this.description = description;
        this.author = author;
        this.category = category;
        this.group = group;
        this.visibility = visibility;
        this.priority = priority;
        this.peghi = peghi;
        this.difficultyCount = difficultyCount;
    }

    public String getUuid() { return uuid; }
    public void setUuid(String uuid) { this.uuid = uuid; }

    public String getTitle() { return title; }
    public void setTitle(String title) { this.title = title; }

    public String getDescription() { return description; }
    public void setDescription(String description) { this.description = description; }

    public String getAuthor() { return author; }
    public void setAuthor(String author) { this.author = author; }

    public String getCategory() { return category; }
    public void setCategory(String category) { this.category = category; }

    public String getGroup() { return group; }
    public void setGroup(String group) { this.group = group; }

    public String getVisibility() { return visibility; }
    public void setVisibility(String visibility) { this.visibility = visibility; }

    public Integer getPriority() { return priority; }
    public void setPriority(Integer priority) { this.priority = priority; }

    public Integer getPeghi() { return peghi; }
    public void setPeghi(Integer peghi) { this.peghi = peghi; }

    public int getDifficultyCount() { return difficultyCount; }
    public void setDifficultyCount(int difficultyCount) { this.difficultyCount = difficultyCount; }
}
